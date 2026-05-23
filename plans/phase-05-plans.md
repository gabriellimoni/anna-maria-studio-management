# Fase 5 — Módulo `plans` (Criação Transacional)

## Contexto

O recurso mais complexo do sistema. Criar um plano dispara, **numa única transação**:
1. Persistência do `plan` (com snapshot de `period`, `weekly_frequency`, `end_date`).
2. Persistência dos `plan_schedule[]`.
3. Geração de todos os `session[]` do período (via `SessionGeneratorService`, Fase 2).
4. Persistência dos `receivable[]` exatamente como recebidos do front, com validação de soma (via `ReceivablePersistService`).

Também cobre os fluxos de **troca de horário** (preservando passado), **renovação** (novo ciclo) e **cancelamento**. Toda lógica de transparência financeira (parcelas montadas pelo front) está aqui.

Referências: Doc 01 §4, §6.2; Doc 02 §3.3–3.5; Doc 03 §3.5; Doc 04 §5.

## Pré-requisitos

- Fases 0–4 concluídas.
- `SchedulingModule` (Fase 2) com `SessionGeneratorService`, `ReceivablePersistService`, `CapacityCheckerService` testados.
- `StudentsModule` (Fase 3) e `PlanCatalogModule` (Fase 4) operando.

## Overrides autoritativos

- **Capacidade da turma é warning, não blocker.** Em `POST /plans` e `POST /plans/:id/change-schedule`, ocupação ≥4 **não** retorna 422. Retornar `warnings.overCapacitySlots[]` no payload de resposta. UI exibe aviso visível mas não desabilita submit.

---

## Backend

### Estrutura

```
apps/api/src/modules/plans/
├── plans.module.ts
├── plans.controller.ts
├── plans.service.ts
├── entities/
│   ├── plan.entity.ts          (já criada Fase 1)
│   └── plan-schedule.entity.ts (já criada Fase 1)
└── dto/
    ├── create-plan.dto.ts
    ├── update-plan.dto.ts
    ├── change-schedule.dto.ts
    ├── renew-plan.dto.ts
    ├── cancel-plan.dto.ts
    └── list-plans.query.ts
```

`PlansModule` importa `SchedulingModule`, `StudentsModule` (para validar `studentId`), `PlanCatalogModule` (para resolver `weeklyFrequency` e `durationMonths` no momento da criação).

### Controller

| Método | Rota | Handler |
|---|---|---|
| GET | `/plans` | `findAll(query)` |
| POST | `/plans` | `create(dto)` |
| GET | `/plans/:id` | `findOne(id)` |
| PATCH | `/plans/:id` | `updateBasics(id, dto)` (apenas `notes`, `status` simples) |
| POST | `/plans/:id/change-schedule` | `changeSchedule(id, dto)` |
| POST | `/plans/:id/renew` | `renew(id, dto)` |
| POST | `/plans/:id/cancel` | `cancel(id, dto)` |

### Fluxo: `POST /plans` (criação)

**DTO `CreatePlanDto`** (Doc 04 §5.2):
```ts
@IsUUID() studentId: string;
@IsUUID() planCatalogId: string;
@IsDateString() startDate: string;
@Matches(/^\d+\.\d{2}$/) totalPrice: string;
@ValidateNested({ each: true }) @Type(() => ScheduleSpecDto)
@ArrayMinSize(1) schedules: ScheduleSpecDto[];
@ValidateNested({ each: true }) @Type(() => InstallmentInputDto)
@ArrayMinSize(1) installments: InstallmentInputDto[];
@IsString() @IsOptional() notes?: string;
```

`ScheduleSpecDto`: `{ weekday: number (0-6), startTime: string ('HH:mm') }`.
`InstallmentInputDto`: `{ amount, dueDate, paymentMethod?, status?: 'pending'|'paid', paidAt? }` (`paidAt` obrigatório se `status='paid'`).

**Lógica `PlansService.create(dto)`** — toda em `dataSource.transaction(async manager => { ... })`:

1. **Carregar referências** (com `manager.findOneOrFail`):
   - `student = findOneOrFail(Student, { id: dto.studentId, isActive: true })`. Se inativo → 422 "Aluno arquivado".
   - `catalog = findOneOrFail(PlanCatalog, { id: dto.planCatalogId })`.
2. **Validar `schedules.length === catalog.weeklyFrequency`** — 422 caso contrário (Doc 04 §5.2).
3. **Calcular `endDate`** = `startDate + catalog.durationMonths meses - 1 dia` (ajuste exato a definir; usar `date-fns.addMonths` e subtrair 1 dia para fechar no último dia do período).
4. **Persistir `plan`** com snapshots:
   ```ts
   { student, planCatalog: catalog, period: catalog.period, weeklyFrequency: catalog.weeklyFrequency,
     startDate: dto.startDate, endDate, totalPrice: dto.totalPrice,
     paymentMethod: <derivado da maioria das parcelas ou null>, installmentsCount: dto.installments.length,
     status: 'active', notes: dto.notes ?? null }
   ```
5. **Persistir `plan_schedule[]`** (uma linha por item de `dto.schedules`).
6. **Gerar `session[]`** via `SessionGeneratorService.generate({ plan, schedules: dto.schedules, manager })`.
7. **Detectar capacidade**: chamar `CapacityCheckerService.detectOverCapacity({ scheduledAts: sessions.map(s => s.scheduledAt), manager, ignoreSessionIds: sessions.map(s => s.id) })`. Coletar warnings — **não aborta**.
8. **Persistir `receivable[]`** via `ReceivablePersistService.persistForPlan({ plan, installments: dto.installments, manager })`.
   - Esse service valida soma vs. `totalPrice` (1 centavo de tolerância). Erro → 422.
9. **Retorno**:
   ```json
   {
     "id": "uuid", "studentId": "...", "period": "quarterly", "weeklyFrequency": 2,
     "startDate": "2026-06-01", "endDate": "2026-08-31", "totalPrice": "450.00",
     "status": "active",
     "generated": { "sessions": 26, "receivables": 3 },
     "warnings": { "overCapacitySlots": [ { "scheduledAt": "2026-06-08T17:00-03:00", "occupied": 4 } ] }
   }
   ```
   Se `warnings.overCapacitySlots` está vazio, omitir o campo `warnings`.

### Fluxo: `POST /plans/:id/change-schedule` (Doc 04 §5.3)

**DTO:** `{ schedules: ScheduleSpec[] }` (mesma validação de `weeklyFrequency`).

**Transação:**
1. Carregar `plan` (404 se `status='cancelled'` ou `finished`).
2. Validar `schedules.length === plan.weeklyFrequency`.
3. `now = new Date()`.
4. **Apagar `plan_schedule[]`** atuais (manager.delete).
5. **Inserir novos `plan_schedule[]`**.
6. **Regenerar sessions futuros** via `SessionGeneratorService.regenerateFuture({ plan, newSchedules, manager, now })`. Retorna `{ removed, created }`.
7. **Capacidade**: `CapacityCheckerService.detectOverCapacity` sobre os scheduledAt dos novos sessions futuros — apenas warnings.
8. Retornar `{ removedFutureSessions: removed, createdSessions: created, warnings? }`.

**Cuidado:** preservar sessions passados (`scheduledAt < now`) e sessions futuros com `status` diferente de `scheduled` (já marcados como presente/falta/cancelado por algum motivo). `SessionGeneratorService.regenerateFuture` já trata isso, mas reconfirmar no teste.

### Fluxo: `POST /plans/:id/renew` (Doc 04 §5.4)

**DTO:** `{ startDate, totalPrice, keepSchedules: boolean, installments: InstallmentInput[], notes? }`.

- Se `keepSchedules=true`, carrega `plan_schedule[]` atuais e usa como `schedules` do novo ciclo.
- Se `keepSchedules=false`, exige `schedules` no payload (ajustar DTO).
- Cria **novo `Plan`** (não modifica o atual) reusando o fluxo de `create()` internamente.
- Opcionalmente marca o antigo como `status='finished'` (regra: se o antigo já passou de `end_date`, finaliza; senão deixa `active`). Confirmar com operador — default recomendado: **deixar status atual intacto, operador decide manualmente**.
- Retorno: `{ newPlanId, generated: {...}, warnings? }`.

### Fluxo: `POST /plans/:id/cancel` (Doc 04 §5.5)

**DTO:** `{ reason?: string, cancelFutureSessions: boolean }`.

**Transação:**
1. `plan.status = 'cancelled'`, salvar `notes` apendado com `reason` se fornecido.
2. Se `cancelFutureSessions=true`: `UPDATE session SET status='cancelled' WHERE plan_id=:id AND scheduled_at >= now AND status='scheduled'`. (Passado intacto; futuros com presença já marcada também intactos.)
3. **Não mexe em `receivable`**. Devolve a lista de parcelas `status='pending'` para o operador decidir.
4. Retorno: `{ cancelledFutureSessions: N, pendingReceivables: [...] }`.

### Filtros de `GET /plans`

Query (`ListPlansQuery`):
- `expiringInDays?: 7 | 30 | 60 | 90` → `endDate <= TODAY + N` (inclui já vencidos, Doc 01 §4.6).
- `status?: 'active' | 'finished' | 'cancelled'`.
- `studentId?: uuid`.
- Paginação padrão.

Para `expiringInDays`, ordenar por `endDate ASC` para mostrar primeiro os mais próximos do vencimento.

### `GET /plans/:id`

Retorna o plano com:
- `schedules: PlanSchedule[]`
- `summary: { totalSessions, sessionsByStatus: { scheduled, present, absence_notified, absence_unnotified, cancelled }, totalReceivables, paidReceivables }`
- Lista das parcelas (top-N? ou completa? — default: completa, são poucas).

Reuso de query: serviço carrega com `relations: ['schedules', 'receivables']` e agrega no service.

---

## Contracts

`packages/contracts/src/plan/index.ts`:

```ts
import type { Period, PaymentMethod, PlanStatus, LancamentoStatus } from '../common/enums';

export interface PlanSchedule {
  id: string;
  weekday: number;
  startTime: string;
}

export interface Plan {
  id: string;
  studentId: string;
  planCatalogId: string | null;
  period: Period;
  weeklyFrequency: number;
  startDate: string;
  endDate: string;
  totalPrice: string;
  paymentMethod: PaymentMethod | null;
  installmentsCount: number;
  status: PlanStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentInput {
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  status?: LancamentoStatus;
  paidAt?: string;
}

export interface CreatePlanInput {
  studentId: string;
  planCatalogId: string;
  startDate: string;
  totalPrice: string;
  schedules: { weekday: number; startTime: string }[];
  installments: InstallmentInput[];
  notes?: string;
}

export interface OverCapacityWarning {
  scheduledAt: string;
  occupied: number;
}

export interface CreatePlanResponse extends Plan {
  generated: { sessions: number; receivables: number };
  warnings?: { overCapacitySlots: OverCapacityWarning[] };
}

export interface ChangeScheduleInput {
  schedules: { weekday: number; startTime: string }[];
}

export interface RenewPlanInput {
  startDate: string;
  totalPrice: string;
  keepSchedules: boolean;
  schedules?: { weekday: number; startTime: string }[]; // obrigatório se keepSchedules=false
  installments: InstallmentInput[];
  notes?: string;
}

export interface CancelPlanInput {
  reason?: string;
  cancelFutureSessions: boolean;
}

export interface ListPlansQuery {
  expiringInDays?: 7 | 30 | 60 | 90;
  status?: PlanStatus;
  studentId?: string;
  page?: number;
  pageSize?: number;
}
```

---

## Frontend

```
apps/web/src/features/plans/
├── api/plans.ts
├── hooks/
│   ├── usePlans.ts
│   ├── usePlan.ts
│   ├── useCreatePlan.ts
│   ├── useChangeSchedule.ts
│   ├── useRenewPlan.ts
│   └── useCancelPlan.ts
├── pages/
│   ├── PlansListPage.tsx       — com filtro de vencimento
│   ├── PlanCreateWizardPage.tsx — 3 passos
│   ├── PlanDetailPage.tsx       — com botões "Trocar horário", "Renovar", "Cancelar"
│   └── PlanChangeSchedulePage.tsx
├── components/
│   ├── ScheduleSlotPicker.tsx   — seletor de (weekday, startTime) com indicador de ocupação
│   ├── InstallmentsEditor.tsx   — tabela editável de parcelas
│   ├── ExpiryFilterChips.tsx    — chips 7/30/60/90 + vencidos
│   └── OverCapacityWarningBanner.tsx
└── utils/
    └── installments-suggester.ts — total ÷ N, periodicidade mensal a partir de data escolhida
```

### Wizard de criação (3 passos)

**Passo 1 — Dados básicos:**
- Select de aluno (autocomplete de `useStudents`).
- Select de catálogo (autocomplete de `usePlanCatalog`).
- Date picker `startDate`.
- Input `totalPrice` — **pré-preenchido com `catalog.basePrice`**, livremente editável (Doc 01 §4.1).
- Botão "Próximo".

**Passo 2 — Horários:**
- Renderiza N seletores de slot onde N = `catalog.weeklyFrequency`.
- `ScheduleSlotPicker`: dropdown de weekday + time picker.
- Ao selecionar, busca ocupação atual do slot (call separada `GET /sessions/calendar?...` ou endpoint dedicado — decisão: **reaproveitar** o calendar da Fase 6, ou criar um endpoint leve `GET /plans/check-capacity?weekday=&startTime=&from=&to=` para esta UI). Recomendação: criar endpoint dedicado para evitar dependência da Fase 6.
- **Aviso visível** quando ocupação ≥4: badge amarelo "Turma cheia (4/4) — você pode prosseguir mesmo assim". Sem bloqueio.
- Botão "Próximo".

**Passo 3 — Parcelas:**
- `InstallmentsEditor`:
  - Input "Nº de parcelas" e "Data da 1ª parcela" + "Periodicidade" (default mensal).
  - Botão "Sugerir" → preenche tabela via `installments-suggester.ts` (total ÷ N, resíduo na última, vencimentos consecutivos).
  - Cada linha editável: `amount`, `dueDate`, `paymentMethod`, checkbox "Já paga" + `paidAt` quando marcado.
  - **Indicador de soma** ao final: badge verde "✓ Fecha 450.00" ou vermelho "Diferença: -10.00".
- Botão "Criar plano" desabilita só se a soma não fecha (validação local; backend revalida).

Resposta da API: se `warnings.overCapacitySlots`, mostrar banner amarelo persistente no detalhe do plano até o operador descartar.

### Lista de planos

- Chips `ExpiryFilterChips` no topo: "Próximos 7 dias", "30 dias", "60 dias", "90 dias", "Vencidos". Clicar aplica `?expiringInDays=N`.
- Tabela: aluno, período, frequência, `endDate`, status, ações (ver, trocar horário, cancelar).
- Mobile: cards.

### Detalhe do plano

- Header: aluno, período, datas, status.
- Aba "Horários": lista de schedules, botão "Trocar".
- Aba "Atendimentos": resumo + link para agenda filtrada por plan.
- Aba "Parcelas": tabela de receivables, com botão "Dar baixa" (cobre quando Fase 8 entrar).

### Cancelar plano (modal)

- Textarea `reason`.
- Checkbox "Cancelar aulas futuras" (default `true`).
- Confirmar → mostrar resultado: "X aulas canceladas. Y parcelas pendentes — gerencie manualmente em Financeiro."

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/plans/plans.module.ts`
- `apps/api/src/modules/plans/plans.controller.ts`
- `apps/api/src/modules/plans/plans.service.ts`
- `apps/api/src/modules/plans/dto/*.ts` (6 DTOs)
- Opcional: `apps/api/src/modules/plans/plans.controller-check-capacity.ts` (endpoint leve para wizard)

**Backend modificar:**
- `apps/api/src/app.module.ts` — importar `PlansModule`.
- `apps/api/src/modules/students/students.service.ts` — implementar `listPlansOfStudent` agora que `plans` existe.

**Contracts criar:**
- `packages/contracts/src/plan/index.ts` (completo)

**Frontend criar:**
- Estrutura completa em `apps/web/src/features/plans/`.
- Atualizar `App.tsx` com rotas `/plans`, `/plans/new`, `/plans/:id`, `/plans/:id/change-schedule`.
- Atualizar `AppLayout.tsx` (menu) com link "Planos".

## Verificação

1. **Criar plano trimestral 2x** (catálogo: Trimestral 2x), `startDate=2026-06-01`:
   - Schedules: seg 17:00, qui 18:30.
   - Parcelas: 3× 150.00, vencimentos 10/jun, 10/jul, 10/ago. 1ª como `paid`.
   - Resposta 201: `generated.sessions ≈ 26`, `generated.receivables = 3`.
   - Banco: 26 sessions com `status='scheduled'`, 3 receivables (1 com `status='paid'`).
2. **Tentar criar plano onde algum slot já tem 4 alunos** → 201 com `warnings.overCapacitySlots` populado. Aceita.
3. **Soma divergente** (parcelas somam 440 vs total 450) → 422.
4. **`weeklyFrequency` × `schedules.length`** divergente → 422.
5. **Trocar horário no meio do plano**:
   - Marcar uma sessão passada como `present`.
   - Trocar schedules.
   - Confirmar: a sessão passada continua `present`; sessions futuros foram apagados e regenerados nos novos schedules.
6. **Renovar**: criar novo ciclo com `keepSchedules=true` → novo plan_id, mesmos schedules, 26 sessions novas, 3 receivables novas.
7. **Cancelar** com `cancelFutureSessions=true` → sessões futuras viram `cancelled`, passado intacto, `pendingReceivables[]` listadas na resposta.
8. **Filtro `?expiringInDays=30`** retorna planos com `endDate <= hoje + 30`, incluindo já vencidos.
9. **UI**: wizard completo do início ao fim com todos os campos. Indicador de soma das parcelas atualiza em tempo real.

## Próxima fase

**Fase 6 — `sessions`**: visualização da agenda (dia/semana), marcação de presença/falta, cancelamento individual de aulas.
