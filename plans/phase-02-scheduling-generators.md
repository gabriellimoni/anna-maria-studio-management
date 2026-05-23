# Fase 2 — Módulo `scheduling` (Geradores de Domínio)

## Contexto

O Doc 02 §1.2 identifica um padrão que se repete três vezes no domínio: **regra-mãe → ocorrências materializadas**.
- `plan` gera `session[]` e `receivable[]`.
- `recurring_expense` gera `payable[]`.

O Doc 03 §3.2 manda isolar esses geradores num módulo dedicado (`scheduling/`), reusável pelos módulos `plans` (Fase 5), `drop-ins` (Fase 7) e `recurring-expenses` (Fase 9). Esta é a **lógica mais crítica** do sistema e a mais fácil de testar isoladamente — por isso vem cedo, **antes** dos módulos que a consomem.

## Pré-requisitos

- Fase 0 + 1 concluídas: enums, tabelas e entities TypeORM existem; transformer de `numeric(10,2)` decidido (string).

## Override autoritativo a respeitar

**Capacidade de turma (4 alunos) é warning, não blocker.** O serviço de capacidade nunca lança exception por sobrelotação.

---

## Estrutura do módulo

```
apps/api/src/modules/scheduling/
├── scheduling.module.ts
├── services/
│   ├── session-generator.service.ts
│   ├── receivable-persist.service.ts
│   ├── payable-generator.service.ts
│   └── capacity-checker.service.ts
├── utils/
│   ├── date.utils.ts          — iteração de datas por weekday no intervalo
│   └── money.utils.ts         — soma de strings numeric(10,2) com tolerância
└── services/__tests__/
    ├── session-generator.service.spec.ts
    ├── receivable-persist.service.spec.ts
    ├── payable-generator.service.spec.ts
    └── capacity-checker.service.spec.ts
```

`SchedulingModule` apenas declara e exporta os serviços (sem controllers — não é exposto via HTTP). É importado pelos módulos que precisam dos geradores.

---

## Serviços

### 1. `SessionGeneratorService`

**Responsabilidade:** materializar `session[]` a partir de um `plan` + seus `plan_schedule[]`.

**Contrato (assinaturas):**

```ts
type ScheduleSpec = { weekday: number; startTime: string /* 'HH:mm' */ };

class SessionGeneratorService {
  // Gera todos os sessions de start_date a end_date para os schedules dados.
  // status='scheduled', origin='plan'. scheduled_at é snapshot.
  // Inclui feriados mecanicamente (Doc 01 §4.4) — operador cancela manual.
  // Retorna os sessions criados (não persistidos ainda, ou já persistidos via manager — ver implementação).
  async generate(input: {
    plan: Plan;
    schedules: ScheduleSpec[];
    manager: EntityManager;
  }): Promise<Session[]>;

  // Regenera apenas o futuro (scheduled_at >= now). Preserva passado.
  // Apaga sessions futuros com status='scheduled' do plano + insere novos para os schedules.
  // NÃO toca sessions com status diferente de 'scheduled' (já tiveram presença/cancelamento marcado).
  async regenerateFuture(input: {
    plan: Plan;
    newSchedules: ScheduleSpec[];
    manager: EntityManager;
    now: Date;
  }): Promise<{ removed: number; created: number }>;
}
```

**Lógica de geração:**
1. Iterar de `plan.startDate` a `plan.endDate` (inclusivo).
2. Para cada data, se `weekday(data)` corresponder a algum schedule:
   - Construir `scheduledAt = data + schedule.startTime` em timezone `America/Sao_Paulo`, persistir como `timestamptz` (UTC interno mas representando o instante no fuso BR).
   - Criar `Session { plan, student: plan.student, scheduledAt, status: 'scheduled', origin: 'plan' }`.
3. Inserir em lote via `manager.save(Session, sessions)`.

**Atenção a timezones:** o `@Cron` da Fase 9 e a interpretação de datas neste serviço devem **sempre** usar `America/Sao_Paulo`. Documentar no JSDoc.

**Regeneração:**
1. `manager.delete(Session, { plan: {id}, scheduledAt: MoreThanOrEqual(now), status: 'scheduled' })`. Captura count.
2. Chama `generate` com uma versão filtrada que só insere a partir de `max(now, plan.startDate)`. (Ou faz a iteração com filtro inline.)
3. Retorna `{ removed, created }`.

### 2. `ReceivablePersistService`

**Responsabilidade:** persistir as parcelas montadas pelo front, exatamente como recebidas, **validando apenas** que a soma fecha. Não recalcula.

**Contrato:**

```ts
type InstallmentInput = {
  amount: string;          // numeric(10,2) como string
  dueDate: string;         // 'YYYY-MM-DD'
  paymentMethod?: PaymentMethod;
  status?: LancamentoStatus;  // 'paid' permitido (1ª no ato)
  paidAt?: string;            // 'YYYY-MM-DD', obrigatório se status='paid'
};

class ReceivablePersistService {
  async persistForPlan(input: {
    plan: Plan;
    installments: InstallmentInput[];
    manager: EntityManager;
  }): Promise<Receivable[]>;
}
```

**Validações (lançar `UnprocessableEntityException` com mensagem clara):**
- `installments.length >= 1`.
- Para cada `status='paid'` → `paidAt` obrigatório (Doc 04 §5.2).
- `sumDecimals(amounts)` igual a `plan.totalPrice` com **tolerância de 1 centavo** (Doc 01 §6.2). Implementar `sumDecimals` em `money.utils.ts` usando arredondamento decimal seguro (ex.: multiplicar por 100, somar inteiros, comparar).

**Persistência:**
- Mapear cada `InstallmentInput` para `Receivable`:
  - `plan = plan`, `source = 'plan'`.
  - `description = `Parcela ${i+1}/${N} — ${plan.catalogName}` ` (se catálogo existe, senão "Plano contratado").
  - `installmentNumber = i+1`, `installmentTotal = N`.
  - `amount`, `dueDate`, `paymentMethod`, `status`, `paidAt` como vieram.
- `manager.save(Receivable, receivables)`.

### 3. `PayableGeneratorService`

**Responsabilidade:** gerar 1 `payable` para uma regra recorrente num mês de competência específico. Idempotente.

**Contrato:**

```ts
class PayableGeneratorService {
  async generateForMonth(input: {
    rule: RecurringExpense;
    competenceMonth: Date;  // 1º dia do mês (ex.: 2026-07-01)
    manager: EntityManager;
  }): Promise<{ created: boolean; payable?: Payable }>;
}
```

**Lógica:**
1. Calcular `dueDate` = `competenceMonth` com dia = `rule.dueDay` (1–28, garantido pelo CHECK).
2. Construir `Payable { recurringExpense: rule, source: 'recurring', description: rule.description, category: rule.category, amount: rule.expectedAmount, dueDate, competenceMonth, status: 'pending' }`.
3. **Insert idempotente** usando `INSERT ... ON CONFLICT DO NOTHING` no índice único parcial `uq_payable_recurring_competence`. Implementar via QueryBuilder:
   ```ts
   const result = await manager.createQueryBuilder()
     .insert().into(Payable).values(payable).orIgnore() // ON CONFLICT DO NOTHING
     .returning('*').execute();
   ```
4. Se `result.identifiers.length === 0` → já existia → `{ created: false }`. Caso contrário → `{ created: true, payable }`.

### 4. `CapacityCheckerService`

**Responsabilidade:** informar ocupação de um slot. **Nunca bloqueia.** (Override autoritativo.)

**Contrato:**

```ts
const SLOT_CAPACITY = 4;

class CapacityCheckerService {
  async countSlot(input: {
    scheduledAt: Date;
    manager: EntityManager;
    ignoreSessionIds?: string[]; // p/ casos de edição em que estamos sobrescrevendo
  }): Promise<{ occupied: number; isOverCapacity: boolean }>;

  // Conveniência para validar um conjunto de slots de uma vez (criação de plano).
  // Retorna apenas os slots com isOverCapacity=true como "warnings".
  async detectOverCapacity(input: {
    scheduledAts: Date[];
    manager: EntityManager;
    ignoreSessionIds?: string[];
  }): Promise<Array<{ scheduledAt: Date; occupied: number }>>;
}
```

**Lógica:**
- `SELECT COUNT(*) FROM session WHERE scheduled_at = ? AND status <> 'cancelled' AND id NOT IN (...ignoreSessionIds)`.
- `isOverCapacity = occupied >= SLOT_CAPACITY` (≥4 já considera sobrelotação).
- **Não lança nada.** Chamadores decidem.

---

## Utils

### `date.utils.ts`

```ts
// Itera dias entre [from, to] inclusive (em America/Sao_Paulo) e retorna apenas os que batem com algum weekday.
export function iterateDatesMatchingWeekday(
  from: Date, to: Date, weekday: number
): Date[];

// Compõe scheduled_at a partir de uma data (Y-M-D) + hora 'HH:mm' em America/Sao_Paulo.
export function composeScheduledAt(date: Date, startTime: string): Date;
```

Usar lib `date-fns` + `date-fns-tz` (preferir sobre Moment.js, mais leve). Adicionar como dependência.

### `money.utils.ts`

```ts
// Soma valores string 'X.YY' como inteiros (centavos) para evitar float.
export function sumDecimals(values: string[]): string; // retorna 'X.YY'

// Compara dois valores 'X.YY' com tolerância de N centavos.
export function decimalsEqual(a: string, b: string, toleranceCents = 1): boolean;
```

---

## Testes unitários

**Framework:** Jest (já configurado pelo template). Para banco, usar `EntityManager` em memória mockado **ou** um Postgres de teste via `testcontainers`/docker. Recomendação: **Postgres real em testcontainers** para SessionGenerator e PayableGenerator (lógica depende de comportamento real de SQL); **mock** para ReceivablePersist e CapacityChecker.

### `session-generator.service.spec.ts`

- Plano trimestral 2x (start 2026-06-01, end 2026-08-31, schedules: seg 17:00 + qui 18:30). Esperar **≈26 sessions** (13 semanas × 2, ajustar pela contagem exata da janela). Conferir que todos os `scheduledAt` caem no weekday e horário corretos.
- Plano semestral 1x → ≈26 sessions também (26 semanas × 1).
- Plano mensal 3x → ≈12-13 sessions.
- `scheduledAt` correto em timezone BR (não escorrega por UTC).
- `regenerateFuture`: criar plano, simular passado (alguns sessions com `status='present'`), trocar schedules, chamar regenerate → passado intacto, sessions futuras substituídas. `status='cancelled'` no futuro **não** é apagado (apenas `scheduled`).

### `receivable-persist.service.spec.ts`

- 3 parcelas de 150.00 + total 450.00 → persiste 3, todas com `source='plan'`, `installmentNumber/Total` corretos.
- 1ª parcela `status='paid'` com `paidAt='2026-06-01'` → persistida pago.
- 1ª parcela `status='paid'` sem `paidAt` → 422.
- Soma 449.99 vs total 450.00 (1 centavo) → aceita (tolerância).
- Soma 449.50 vs total 450.00 → 422.
- Resíduo de arredondamento na última (caso 450/3 = 150.00 exato; outro caso: 100.00/3 = 33.33+33.33+33.34 → aceita).
- 1 parcela à vista 450.00 → persiste 1 com `installmentNumber=1, installmentTotal=1`.

### `payable-generator.service.spec.ts`

- Regra `due_day=10`, competence 2026-07 → cria payable com `due_date=2026-07-10`.
- Mesma regra, mesma competence, 2ª chamada → `{ created: false }` (não duplica).
- Regra desativada (`is_active=false`) → serviço **não filtra** isso; quem filtra é o caller (`RecurringExpensesService` da Fase 9). Aqui o teste é só de idempotência.
- Confirmar índice único parcial cobre o cenário (criar payable manual `source='manual'` com mesma chave **não conflita**, pois o índice é parcial).

### `capacity-checker.service.spec.ts`

- Slot vazio → `{ occupied: 0, isOverCapacity: false }`.
- 3 sessions ativos → `{ occupied: 3, isOverCapacity: false }`.
- 4 sessions ativos → `{ occupied: 4, isOverCapacity: true }`.
- 5 sessions ativos → `{ occupied: 5, isOverCapacity: true }` — **não lança**.
- 4 sessions ativos + 2 cancelados → `{ occupied: 4, isOverCapacity: true }` (cancelados ignorados).
- `ignoreSessionIds` exclui da contagem (caso de edição/regeneração).
- `detectOverCapacity([slotsA, slotsB, slotsC])` retorna só os slots em sobrelotação.

---

## Arquivos críticos

**Criar:**
- `apps/api/src/modules/scheduling/scheduling.module.ts`
- `apps/api/src/modules/scheduling/services/session-generator.service.ts`
- `apps/api/src/modules/scheduling/services/receivable-persist.service.ts`
- `apps/api/src/modules/scheduling/services/payable-generator.service.ts`
- `apps/api/src/modules/scheduling/services/capacity-checker.service.ts`
- `apps/api/src/modules/scheduling/utils/date.utils.ts`
- `apps/api/src/modules/scheduling/utils/money.utils.ts`
- `apps/api/src/modules/scheduling/services/__tests__/*.spec.ts` (4 arquivos)

**Dependências novas:** `date-fns`, `date-fns-tz`, possivelmente `@testcontainers/postgresql` (dev).

## Verificação

1. `pnpm --filter @anna-maria/api test scheduling` verde, todos os specs acima passam.
2. Cobertura ≥90% nos 4 services (rodar com `--coverage`).
3. `SchedulingModule` importável (criar um teste de integração mínimo `scheduling.module.spec.ts` que apenas instancia o módulo e valida que os serviços são resolvíveis via DI).
4. Nenhum service de `scheduling` é exposto via HTTP — confirmar que não há controller no módulo.

## Próxima fase

Com os geradores prontos e testados, partimos para a primeira fatia vertical de domínio: **Fase 3 — `students` + Fase 4 — `plan-catalog`** (CRUDs simples antes do fluxo complexo de planos).
