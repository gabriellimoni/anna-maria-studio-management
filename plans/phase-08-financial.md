# Fase 8 — Módulos `receivables` e `payables` (Financeiro)

## Contexto

Implementa o lado financeiro: **contas a receber** (parcelas de planos, cobranças de avulsas e lançamentos manuais) e **contas a pagar** (despesas manuais — recorrentes geradas automaticamente entram na Fase 9). Esta fase também consolida a regra de **status "atrasado" derivado** (Doc 02 §4.3, Doc 04 §1.4): nunca armazenado, sempre calculado como `status='pending' AND due_date < hoje`.

Funcionalidades:
- CRUD de lançamentos a receber e a pagar (manuais).
- **Baixa** (`/pay`) — marca como pago, registra `paidAt` e `paymentMethod`.
- **Estorno** (`/unpay`) — reverte para `pending`, limpa `paidAt`.
- Filtros: status (incl. derivado `overdue`), período, source, vínculos (planId, recurringExpenseId).
- Edição de parcelas de plano e de payables vindos de recorrente.

Referências: Doc 01 §6; Doc 02 §3.7–3.8; Doc 04 §8–9.

## Pré-requisitos

- Fases 0–7 concluídas. Tabelas existem; `Receivable`s já existem para planos (Fase 5) e drop-ins com cobrança (Fase 7).

---

## Parte A — Módulo `receivables`

### Backend

```
apps/api/src/modules/receivables/
├── receivables.module.ts
├── receivables.controller.ts
├── receivables.service.ts
├── entities/receivable.entity.ts  (já existe)
└── dto/
    ├── create-receivable.dto.ts        — somente lançamento manual
    ├── update-receivable.dto.ts
    ├── pay-receivable.dto.ts
    ├── list-receivables.query.ts
    └── receivable-response.dto.ts      — inclui isOverdue derivado
```

### Controller

| Método | Rota | Handler |
|---|---|---|
| GET | `/receivables` | `findAll(query)` |
| POST | `/receivables` | `createManual(dto)` |
| GET | `/receivables/:id` | `findOne(id)` |
| PATCH | `/receivables/:id` | `update(id, dto)` |
| POST | `/receivables/:id/pay` | `pay(id, dto)` |
| POST | `/receivables/:id/unpay` | `unpay(id)` |

### `POST /receivables` (Doc 04 §8)

`CreateReceivableDto` (manual):
```ts
@IsString() @IsNotEmpty() description: string;
@Matches(/^\d+\.\d{2}$/) amount: string;
@IsDateString() dueDate: string;
@IsEnum(['cash','pix','card','boleto']) @IsOptional() paymentMethod?: PaymentMethod;
```

- `source='manual'`, `plan_id=null`, `installmentNumber/Total=null`, `status='pending'`.
- Não aceita criação direta de `source='plan'` ou `source='drop_in'` (esses nascem das fases 5 e 7).

### `GET /receivables`

`ListReceivablesQuery`:
- `status?: 'pending' | 'paid' | 'overdue'`.
- `from?, to?` (por `dueDate`).
- `planId?`.
- `source?: ReceivableSource`.
- Paginação.

**`status='overdue'`** é derivado: gerar query `WHERE status='pending' AND due_date < CURRENT_DATE`. Não armazenado.

### Resposta com `isOverdue` (Doc 04 §1.4)

Toda resposta de `receivable` inclui campo calculado:
```ts
{
  // ...campos persistidos...
  isOverdue: status === 'pending' && dueDate < today
}
```

Calcular no service ao mapear entity → DTO. Não armazenar.

### `PATCH /receivables/:id`

`UpdateReceivableDto`:
- `description?`, `amount?`, `dueDate?`, `paymentMethod?`.
- **Não** permite mudar `source`, `planId`, `installmentNumber`, `installmentTotal`.
- **Não** permite mudar `status` direto — use `/pay` e `/unpay`.
- Permite editar parcela de plano (operador pode renegociar vencimento de parcela individual sem mexer no plano).

### `POST /receivables/:id/pay`

`PayReceivableDto`:
```ts
@IsDateString() paidAt: string;
@IsEnum(['cash','pix','card','boleto']) paymentMethod: PaymentMethod;
```

- 409 se já está `paid`.
- Seta `status='paid'`, `paidAt`, `paymentMethod`.

### `POST /receivables/:id/unpay`

- Sem body.
- 409 se já está `pending`.
- Seta `status='pending'`, `paidAt=null`. **Mantém** `paymentMethod` (era o método previsto antes da baixa).

---

## Parte B — Módulo `payables`

Estrutura espelhada de `receivables`. Diferenças notáveis:

- Source pode ser `'manual'` ou `'recurring'`. Criação direta só aceita `'manual'` (recurrente vem da Fase 9).
- Campo extra `competence_month` (mês de competência) populado apenas em `source='recurring'`.
- Campo `category` (livre).

### Controller

| Método | Rota |
|---|---|
| GET | `/payables` |
| POST | `/payables` |
| GET | `/payables/:id` |
| PATCH | `/payables/:id` |
| POST | `/payables/:id/pay` |
| POST | `/payables/:id/unpay` |

### `POST /payables` (manual)

`CreatePayableDto`:
```ts
@IsString() @IsNotEmpty() description: string;
@IsString() @IsOptional() category?: string;
@Matches(/^\d+\.\d{2}$/) amount: string;
@IsDateString() dueDate: string;
@IsEnum(...) @IsOptional() paymentMethod?: PaymentMethod;
```

### `GET /payables` filtros

- `status?: 'pending' | 'paid' | 'overdue'` (overdue derivado).
- `from?, to?` (por `dueDate`).
- `recurringExpenseId?`.
- `source?: PayableSource`.
- `competenceMonth?: 'YYYY-MM'` (converte para 1º dia do mês na query).

### `PATCH /payables/:id`

- Edita `description`, `amount`, `category`, `dueDate`, `paymentMethod`.
- **Editar `amount` de payable vindo de recorrente é permitido** — não afeta a regra `recurring_expense.expected_amount` (Doc 01 §6.7).
- Não permite mudar `source`, `recurringExpenseId`, `competenceMonth`.

### `/pay` e `/unpay` idênticos ao receivable.

---

## Contracts

`packages/contracts/src/receivable/index.ts`:

```ts
import type { ReceivableSource, LancamentoStatus, PaymentMethod } from '../common/enums';

export interface Receivable {
  id: string;
  planId: string | null;
  source: ReceivableSource;
  description: string;
  amount: string;
  dueDate: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
  paymentMethod: PaymentMethod | null;
  status: LancamentoStatus;
  paidAt: string | null;
  isOverdue: boolean;       // derivado
  createdAt: string;
  updatedAt: string;
}

export interface CreateReceivableManualInput {
  description: string;
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
}

export interface UpdateReceivableInput {
  description?: string;
  amount?: string;
  dueDate?: string;
  paymentMethod?: PaymentMethod;
}

export interface PayReceivableInput {
  paidAt: string;
  paymentMethod: PaymentMethod;
}

export interface ListReceivablesQuery {
  status?: 'pending' | 'paid' | 'overdue';
  from?: string;
  to?: string;
  planId?: string;
  source?: ReceivableSource;
  page?: number;
  pageSize?: number;
}
```

`packages/contracts/src/payable/index.ts` — análogo, com `category`, `competenceMonth` e `recurringExpenseId`.

---

## Frontend

```
apps/web/src/features/financial/
├── api/
│   ├── receivables.ts
│   └── payables.ts
├── hooks/
│   ├── useReceivables.ts
│   ├── useReceivableMutations.ts
│   ├── usePayables.ts
│   └── usePayableMutations.ts
├── pages/
│   ├── ReceivablesPage.tsx
│   ├── PayablesPage.tsx
│   ├── ReceivableFormPage.tsx        — só para manuais; edit para qualquer
│   └── PayableFormPage.tsx
└── components/
    ├── FinancialFiltersBar.tsx       — chips status (incl. overdue) + range de datas
    ├── ReceivablesTable.tsx
    ├── PayablesTable.tsx
    ├── PayDialog.tsx                 — modal de baixa (paidAt + paymentMethod)
    └── UnpayConfirmDialog.tsx
```

### Página `ReceivablesPage`

- `FinancialFiltersBar` no topo: chips "Pendentes", "Pagas", "Atrasadas", "Todas" + range de datas + filtros avançados (source, planId).
- Tabela colunas: descrição, vínculo (link ao plano se houver), parcela X/N, valor, vencimento, status (badge), ações (`Dar baixa`, `Estornar`, `Editar`).
- Badge "ATRASADA" em vermelho quando `isOverdue=true`.
- Total no rodapé: pendentes / pagas / atrasadas do filtro atual.
- Mobile: cards.

### `PayDialog`

- Inputs `paidAt` (default hoje) e `paymentMethod`.
- Confirmar → mutação `/pay` → toast "Pagamento registrado".

### `UnpayConfirmDialog`

- Texto "Deseja reverter o pagamento desta parcela? Ela voltará para 'pendente'."
- Confirmar → mutação `/unpay`.

### Página `PayablesPage`

- Estrutura idêntica + coluna `category` + filtro `competenceMonth` (selector mês/ano para recurring).

### Lançamento manual

- Botão "+ Novo lançamento" no header das duas páginas → modal/página com formulário simples.

### Acesso a partir do plano (Fase 5)

- Em `PlanDetailPage`, aba "Parcelas" usa `useReceivables({ planId })`. Botões de baixa por parcela.

### Acesso a partir da avulsa (Fase 7)

- Em `DropInsListPage`, coluna "Cobrança" link ao receivable correspondente.

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/receivables/{receivables.module.ts, controller, service, dto/*.ts}`
- `apps/api/src/modules/payables/{payables.module.ts, controller, service, dto/*.ts}`

**Backend modificar:**
- `apps/api/src/app.module.ts` — importar ambos.

**Contracts criar:**
- `packages/contracts/src/receivable/index.ts`
- `packages/contracts/src/payable/index.ts`

**Frontend criar:** estrutura completa de `apps/web/src/features/financial/`.

**Frontend modificar:**
- `App.tsx` — rotas `/financeiro/receber`, `/financeiro/pagar`.
- `AppLayout.tsx` — sub-menu "Financeiro" → "A receber", "A pagar".
- `apps/web/src/features/plans/pages/PlanDetailPage.tsx` — popular aba "Parcelas".

## Verificação

### Receivables
1. **Auto-criados pela Fase 5** aparecem em `/financeiro/receber` filtrados por `planId`.
2. Filtro `?status=overdue` retorna apenas `status='pending' AND due_date < hoje`. `isOverdue=true` em todos.
3. **Baixa**: clicar "Dar baixa" → modal → confirmar → status='paid', `paidAt` registrado.
4. **Estorno**: clicar "Estornar" na linha paga → status volta para 'pending', `paidAt=null`.
5. **Manual**: criar "Venda de faixa elástica" R$ 40,00 → aparece com `source='manual'`, `planId=null`.
6. **Editar vencimento** de parcela de plano → persiste sem afetar o plano nem outras parcelas.
7. Soma do rodapé bate com o filtro aplicado.

### Payables
1. Criar manual "Material de limpeza" R$ 120,00 categoria "Insumos" → 201.
2. Filtros funcionam igual a receivables.
3. Baixa e estorno idem.
4. (Payables `source='recurring'` só aparecem após Fase 9. Reconfirmar lá que editar `amount` deles não muda a regra.)

## Próxima fase

**Fase 9 — `recurring-expenses` + cron**: regras de despesas recorrentes mensais, com geração automática (job dia 25) idempotente e disparo manual.
