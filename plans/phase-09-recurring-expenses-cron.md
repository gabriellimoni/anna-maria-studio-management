# Fase 9 — Módulo `recurring-expenses` + Cron Mensal

## Contexto

Implementa o último pedaço crítico do financeiro: **regras de despesas recorrentes** (ex.: aluguel, energia) e a **geração automática mensal** dos `payable`s correspondentes (Doc 01 §6.7, §7.1; Doc 02 §3.9; Doc 04 §10).

Regras-chave:
- Job roda **todo dia 25** (no fuso `America/Sao_Paulo`) e gera os `payable`s do **mês seguinte (M+1)** para todas as regras `is_active=true`.
- **Idempotente:** rodar duas vezes no mesmo mês não duplica (garantido pelo índice único parcial criado na Fase 1).
- **Disparo manual** equivalente, via endpoint, como rede de segurança caso o job falhe.
- **Editar `amount` no `payable` materializado** não altera a regra `expected_amount` (Doc 01 §6.7).
- **Desativar regra** interrompe gerações futuras mas **não** afeta `payable`s já gerados.
- `due_day` restrito a 1–28 (Doc 02 §3.9).
- Erros do cron são capturados explicitamente e enviados ao PostHog (Doc 03 §5.1) — falha silenciosa de job é perigosa.

## Pré-requisitos

- Fases 0–8 concluídas. `PayableGeneratorService` (Fase 2) já implementa a geração idempotente por mês. `payable` table existe com índice único parcial.
- `@nestjs/schedule` instalado (provavelmente já está nas deps do template; senão adicionar).

---

## Backend

```
apps/api/src/modules/recurring-expenses/
├── recurring-expenses.module.ts
├── recurring-expenses.controller.ts
├── recurring-expenses.service.ts
├── recurring-expenses.scheduler.ts     — classe com @Cron
├── entities/recurring-expense.entity.ts  (já existe)
└── dto/
    ├── create-recurring-expense.dto.ts
    ├── update-recurring-expense.dto.ts
    ├── list-recurring-expenses.query.ts
    └── run-generation.dto.ts
```

`RecurringExpensesModule` importa `SchedulingModule` para usar `PayableGeneratorService`. Habilitar `ScheduleModule.forRoot()` no `AppModule`.

### Controller (Doc 04 §10)

| Método | Rota | Handler |
|---|---|---|
| GET | `/recurring-expenses` | `findAll(query)` |
| POST | `/recurring-expenses` | `create(dto)` |
| GET | `/recurring-expenses/:id` | `findOne(id)` |
| PATCH | `/recurring-expenses/:id` | `update(id, dto)` |
| DELETE | `/recurring-expenses/:id` | `archive(id)` — soft delete (`isActive=false`) |
| POST | `/recurring-expenses/run-generation` | `runGenerationManual(body)` |

### `POST /recurring-expenses`

`CreateRecurringExpenseDto`:
```ts
@IsString() @IsNotEmpty() description: string;
@IsString() @IsOptional() category?: string;
@Matches(/^\d+\.\d{2}$/) expectedAmount: string;
@IsInt() @Min(1) @Max(28) dueDay: number;
```

Service:
```ts
async create(dto: CreateRecurringExpenseDto) {
  return manager.save(RecurringExpense, { ...dto, isActive: true });
}
```

### `PATCH /recurring-expenses/:id`

- Aceita atualizar `description`, `category`, `expectedAmount`, `dueDay`, `isActive`.
- **Não afeta** payables já gerados (Doc 01 §6.7). Apenas a próxima geração usará os novos valores.

### `DELETE /recurring-expenses/:id`

- Soft delete: seta `isActive=false`.
- Payables já gerados permanecem.

### `POST /recurring-expenses/run-generation`

`RunGenerationDto`:
```ts
@Matches(/^\d{4}-\d{2}$/) month: string;  // 'YYYY-MM'
```

Service:
```ts
async runForMonth(monthString: string): Promise<{ created: number; skipped: number }> {
  const competenceMonth = parseMonthToFirstDay(monthString); // 2026-07-01
  const activeRules = await this.manager.find(RecurringExpense, { where: { isActive: true } });
  let created = 0;
  let skipped = 0;

  await this.dataSource.transaction(async (manager) => {
    for (const rule of activeRules) {
      const result = await this.payableGenerator.generateForMonth({ rule, competenceMonth, manager });
      if (result.created) created++;
      else skipped++;
    }
  });

  return { created, skipped };
}
```

A idempotência é garantida pelo `INSERT ... ON CONFLICT DO NOTHING` no `PayableGeneratorService` (Fase 2). Não precisa de lock adicional.

**Endpoint manual usa esta MESMA rotina** — uma única fonte de verdade entre cron e disparo manual (Doc 04 §10).

### Scheduler

`recurring-expenses.scheduler.ts`:

```ts
@Injectable()
export class RecurringExpensesScheduler {
  constructor(
    private readonly service: RecurringExpensesService,
    private readonly posthog: PostHogProvider,
    private readonly logger: Logger,
  ) {}

  // Todo dia 25, 03:00 BRT — sufic. antes da virada do mês para ter buffer.
  @Cron('0 3 25 * *', { timeZone: 'America/Sao_Paulo', name: 'recurring-expenses-monthly' })
  async runMonthly() {
    const nextMonth = addMonths(startOfMonth(new Date()), 1); // 1º dia do mês seguinte
    const monthString = format(nextMonth, 'yyyy-MM');
    this.logger.log({ msg: 'cron.recurring-expenses.start', month: monthString });
    try {
      const result = await this.service.runForMonth(monthString);
      this.logger.log({ msg: 'cron.recurring-expenses.done', month: monthString, ...result });
    } catch (err) {
      this.logger.error({ msg: 'cron.recurring-expenses.failed', err, month: monthString });
      this.posthog.captureException(err, { properties: { job: 'recurring-expenses-monthly', month: monthString } });
      throw err; // re-lança para que reten try (se algum) saiba; cron do nest não retenta sozinho
    }
  }
}
```

**Atenção a timezone:** `@Cron` com `timeZone: 'America/Sao_Paulo'` exige `TZ` configurado no container (env `TZ=America/Sao_Paulo` da Fase 0). Validar com teste manual: rodar localmente alterando o `cron` para `* * * * *` e verificar logs.

---

## Contracts

`packages/contracts/src/recurring-expense/index.ts`:

```ts
export interface RecurringExpense {
  id: string;
  description: string;
  category: string | null;
  expectedAmount: string;
  dueDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringExpenseInput {
  description: string;
  category?: string;
  expectedAmount: string;
  dueDay: number;  // 1..28
}

export type UpdateRecurringExpenseInput = Partial<CreateRecurringExpenseInput> & {
  isActive?: boolean;
};

export interface ListRecurringExpensesQuery {
  isActive?: boolean;
}

export interface RunGenerationInput {
  month: string;  // 'YYYY-MM'
}

export interface RunGenerationResponse {
  created: number;
  skipped: number;
}
```

---

## Frontend

```
apps/web/src/features/financial/
├── pages/
│   └── RecurringExpensesPage.tsx
├── hooks/
│   ├── useRecurringExpenses.ts
│   ├── useRecurringExpenseMutations.ts
│   └── useRunRecurringGeneration.ts
└── components/
    ├── RecurringExpenseForm.tsx
    └── RunGenerationDialog.tsx
```

### `RecurringExpensesPage`

- Tabela: descrição, categoria, valor previsto, dia de vencimento, status (Ativa/Inativa), ações (Editar / Desativar).
- Botão "+ Nova despesa recorrente" no header.
- Botão "▶ Gerar agora" no header → abre `RunGenerationDialog`.

### `RunGenerationDialog`

- Selector de mês/ano (default: próximo mês).
- Texto explicativo: "Gera os lançamentos a pagar de todas as despesas ativas para o mês selecionado. Pode rodar várias vezes — duplicatas são impedidas."
- Botão "Gerar" → mutação `useRunRecurringGeneration`.
- Resultado: toast "Gerados: X. Já existentes: Y."

### `RecurringExpenseForm`

- Inputs: `description`, `category` (autocomplete livre de categorias já usadas), `expectedAmount` (moeda BRL), `dueDay` (número 1–28 com `step=1`, label "Dia do vencimento mensal").
- Toggle `isActive` em edição.

### Integração com `/financeiro/pagar`

- Filtro `recurringExpenseId` → ver histórico de uma regra.
- Filtro `competenceMonth` → ver lançamentos de um mês específico.
- Coluna "Origem" mostra "Recorrente: Aluguel" quando `source='recurring'`.

---

## Configuração

### `AppModule`

```ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // ...existentes...
    ScheduleModule.forRoot(),
    RecurringExpensesModule,
  ],
})
```

### Env

- `TZ=America/Sao_Paulo` deve estar setada no ambiente do container (já configurada na Fase 0).

### Deploy

- **Backend precisa rodar em processo persistente** (Doc 03 §6.3). Serverless puro (lambda) não roda `@Cron`. Use Railway/Render/Fly. Se for forçado a serverless, configurar scheduler externo (cron do provedor de cloud) chamando `POST /recurring-expenses/run-generation?month=YYYY-MM` com auth de operador.

### Alertas

- Configurar no PostHog alerta para erros com `properties.job = 'recurring-expenses-monthly'` (Doc 03 §5.3).

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/recurring-expenses/recurring-expenses.module.ts`
- `apps/api/src/modules/recurring-expenses/recurring-expenses.controller.ts`
- `apps/api/src/modules/recurring-expenses/recurring-expenses.service.ts`
- `apps/api/src/modules/recurring-expenses/recurring-expenses.scheduler.ts`
- `apps/api/src/modules/recurring-expenses/dto/*.ts`

**Backend modificar:**
- `apps/api/src/app.module.ts` — `ScheduleModule.forRoot()` + `RecurringExpensesModule`.

**Contracts criar:** `packages/contracts/src/recurring-expense/index.ts`.

**Frontend criar:**
- `apps/web/src/features/financial/pages/RecurringExpensesPage.tsx`
- Hooks e form components correspondentes.

**Frontend modificar:**
- `App.tsx` — rota `/financeiro/recorrentes`.
- `AppLayout.tsx` — sub-menu "Financeiro" → "Despesas recorrentes".
- `apps/web/src/features/financial/components/PayablesTable.tsx` — coluna "Origem" com link à regra.

## Verificação

1. **Criar regra** "Aluguel" R$ 2500,00 `dueDay=10` → 201, aparece ativa.
2. **Tentar criar com `dueDay=31`** → 422 (validação client + server).
3. **Disparo manual** para "2026-07": Cria 1 `payable` (description="Aluguel", category, amount=2500, dueDate=2026-07-10, competenceMonth=2026-07-01, source='recurring', status='pending'). Resposta `{ created: 1, skipped: 0 }`.
4. **Rodar de novo** para "2026-07" → `{ created: 0, skipped: 1 }`. Banco continua com 1 payable.
5. **Editar o payable gerado**: mudar `amount` para 2600 → persiste no payable. Verificar que `RecurringExpense.expectedAmount` continua 2500.
6. **Desativar a regra** → `isActive=false`. Rodar para "2026-08" → `{ created: 0, skipped: 0 }` (regra inativa). Payable de julho continua existindo.
7. **Reativar e rodar agosto** → `{ created: 1, skipped: 0 }`.
8. **Cron local**: alterar temporariamente `@Cron('* * * * *')` (cada minuto), confirmar que log Pino mostra `cron.recurring-expenses.start/done` e payable é criado.
9. **Erro forçado** no cron (lançar exception num mock) → captura no log + PostHog recebe evento com `properties.job=recurring-expenses-monthly`.
10. Frontend: `RunGenerationDialog` mostra resultado correto.

## Próxima fase

**Fase 10 — `dashboard`**: agrega tudo numa visão única (indicadores de planos vencendo, financeiro do mês, atendimentos do dia).
