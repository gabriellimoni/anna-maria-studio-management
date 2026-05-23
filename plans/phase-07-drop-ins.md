# Fase 7 — Módulo `drop-ins` (Aulas Avulsas)

## Contexto

Aulas avulsas são aulas pontuais fora de plano, tipicamente experimentais (primeira aula de um interessado). Características (Doc 01 §5.3, §6.3; Doc 02 §3.6; Doc 04 §7):

- **Ocupam vaga na turma** daquele `(date, startTime)` — entram na agenda como `session(origin='drop_in')`.
- **Não geram recorrência** (são isoladas).
- Podem ter um aluno cadastrado **ou apenas um nome de interessado** (`prospect_name`).
- **Podem ou não gerar cobrança** — se sim, criam um `receivable(source='drop_in')` vinculado.

A tabela `drop_in_class` é uma **extensão** do `session`: armazena os dados extras (interessado sem cadastro, vínculo com receivable). O `session` correspondente é a fonte canônica para a agenda.

## Pré-requisitos

- Fases 0–6 concluídas. `SessionsModule` (Fase 6) e `SchedulingModule` (Fase 2 — `CapacityCheckerService`) operam.

## Override autoritativo

Capacidade da turma é warning, não blocker. Criar avulsa em slot com 4+ alunos retorna 201 com `warnings.overCapacity: true`.

---

## Backend

```
apps/api/src/modules/drop-ins/
├── drop-ins.module.ts
├── drop-ins.controller.ts
├── drop-ins.service.ts
├── entities/drop-in-class.entity.ts  (já existe)
└── dto/
    ├── create-drop-in.dto.ts
    ├── update-drop-in.dto.ts
    └── list-drop-ins.query.ts
```

`DropInsModule` importa `SchedulingModule` (para `CapacityCheckerService`) e usa `manager.transaction` para criar `session` + `drop_in_class` + opcional `receivable` atomicamente.

### Controller

| Método | Rota | Handler |
|---|---|---|
| GET | `/drop-ins` | `findAll(query)` |
| POST | `/drop-ins` | `create(dto)` |
| GET | `/drop-ins/:id` | `findOne(id)` |
| PATCH | `/drop-ins/:id` | `update(id, dto)` |
| DELETE | `/drop-ins/:id` | `remove(id)` (cancela session, marca drop_in inativo ou apaga) |

### `POST /drop-ins`

**DTO `CreateDropInDto`** (Doc 04 §7):
```ts
@IsUUID() @IsOptional() studentId?: string;
@IsString() @IsOptional() prospectName?: string;
@IsISO8601() scheduledAt: string;
@ValidateNested() @Type(() => ChargeDto) @IsOptional() charge?: ChargeDto;
@IsString() @IsOptional() notes?: string;
```

`ChargeDto`:
```ts
@Matches(/^\d+\.\d{2}$/) amount: string;
@IsDateString() dueDate: string;
@IsEnum(['cash','pix','card','boleto']) @IsOptional() paymentMethod?: PaymentMethod;
@IsEnum(['pending','paid']) @IsOptional() status?: LancamentoStatus;
@IsDateString() @IsOptional() paidAt?: string;
```

**Validação cruzada:** `studentId XOR prospectName` — exatamente um dos dois deve estar preenchido. Erro 422 caso contrário.

**Fluxo transacional:**

```ts
return dataSource.transaction(async (manager) => {
  // 1. Resolver student (se studentId fornecido)
  let student = null;
  if (dto.studentId) {
    student = await manager.findOneOrFail(Student, { id: dto.studentId, isActive: true });
  }

  // 2. Capacidade (não bloqueia)
  const capacity = await capacityChecker.countSlot({
    scheduledAt: parseISO(dto.scheduledAt),
    manager,
  });

  // 3. Criar session
  const session = await manager.save(Session, {
    student,                              // null se prospect; mas session.student_id é NOT NULL!
    scheduledAt: parseISO(dto.scheduledAt),
    status: 'scheduled',
    origin: 'drop_in',
    notes: dto.notes ?? null,
  });
});
```

**Problema de schema:** `session.student_id` é `NOT NULL` (Doc 02 §3.5), mas drop-in pode ter só `prospect_name`. Duas opções:

- **(A)** Tornar `session.student_id` nullable. Requer migration. Doc 02 fica desalinhado.
- **(B)** Criar (ou exigir) um `Student` "leve" para o prospect antes de inserir o session, com flag de prospect.

**Decisão recomendada (mais simples e revisitável):** **opção A** — tornar `session.student_id` nullable e ajustar Doc 02. Drop-in com prospect terá `session.student_id = null` e `drop_in_class.prospect_name` populado. Adicionar migration `MakeSessionStudentNullable` nesta fase.

Continuando o fluxo:

```ts
  // 4. Criar receivable opcional
  let receivable = null;
  if (dto.charge) {
    if (dto.charge.status === 'paid' && !dto.charge.paidAt) {
      throw new UnprocessableEntityException('paidAt obrigatório quando status=paid');
    }
    receivable = await manager.save(Receivable, {
      plan: null,
      source: 'drop_in',
      description: `Aula avulsa — ${student?.fullName ?? dto.prospectName}`,
      amount: dto.charge.amount,
      dueDate: dto.charge.dueDate,
      paymentMethod: dto.charge.paymentMethod ?? null,
      status: dto.charge.status ?? 'pending',
      paidAt: dto.charge.paidAt ?? null,
    });
  }

  // 5. Criar drop_in_class
  const dropIn = await manager.save(DropInClass, {
    session,
    student,
    prospectName: dto.prospectName ?? null,
    receivable,
  });

  return {
    id: dropIn.id,
    sessionId: session.id,
    receivableId: receivable?.id ?? null,
    warnings: capacity.isOverCapacity ? { overCapacity: true, occupied: capacity.occupied } : undefined,
  };
});
```

### `GET /drop-ins`

`ListDropInsQuery`:
- `from?, to?` (por `session.scheduledAt`).
- `studentId?`.
- `hasCharge?: boolean`.

Joins necessários: `session` (para `scheduledAt`, `status`), `student` (nome), `receivable` (status de cobrança).

### `PATCH /drop-ins/:id`

`UpdateDropInDto`:
- Pode atualizar `prospectName` (se ainda for prospect).
- Pode atualizar `notes` no session associado.
- **Não** muda `studentId` (se prospect virou aluno cadastrado, criar avulsa nova). Decisão: simples > flexível.

### `DELETE /drop-ins/:id`

- Cancela o `session` associado (status='cancelled') ao invés de apagar (preserva auditoria).
- Apaga a linha `drop_in_class` (`ON DELETE CASCADE` já cuidaria, mas estamos preservando o session — manter `drop_in_class` ou apagar? **Decisão:** apagar `drop_in_class` mantendo o session cancelado, para liberar o slot do nome do prospect na agenda).
- Se houver `receivable` vinculado e ainda `pending`, **não** apaga automaticamente; deixa para o operador (alinhado com cancelamento de plano da Fase 5). Resposta inclui `pendingReceivableId`.

---

## Contracts

`packages/contracts/src/drop-in/index.ts`:

```ts
import type { PaymentMethod, LancamentoStatus, SessionStatus } from '../common/enums';

export interface DropInClass {
  id: string;
  sessionId: string;
  studentId: string | null;
  prospectName: string | null;
  receivableId: string | null;
  // joins úteis para listagem
  scheduledAt: string;
  sessionStatus: SessionStatus;
  studentName: string | null;
  chargeStatus: LancamentoStatus | null;
}

export interface DropInChargeInput {
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  status?: LancamentoStatus;
  paidAt?: string;
}

export interface CreateDropInInput {
  studentId?: string;
  prospectName?: string;
  scheduledAt: string;
  charge?: DropInChargeInput;
  notes?: string;
}

export interface CreateDropInResponse {
  id: string;
  sessionId: string;
  receivableId: string | null;
  warnings?: { overCapacity: boolean; occupied: number };
}

export interface UpdateDropInInput {
  prospectName?: string;
  notes?: string;
}

export interface ListDropInsQuery {
  from?: string;
  to?: string;
  studentId?: string;
  hasCharge?: boolean;
}
```

---

## Migration adicional

`apps/api/src/database/migrations/<ts>-MakeSessionStudentNullable.ts`:
- `ALTER TABLE session ALTER COLUMN student_id DROP NOT NULL`.
- Atualiza Doc 02 informalmente: comentário na entity dizendo "nullable para suportar prospects em drop-ins".

---

## Frontend

```
apps/web/src/features/drop-ins/
├── api/drop-ins.ts
├── hooks/
│   ├── useDropIns.ts
│   ├── useCreateDropIn.ts
│   ├── useUpdateDropIn.ts
│   └── useDeleteDropIn.ts
├── pages/
│   ├── DropInsListPage.tsx
│   └── DropInFormPage.tsx
└── components/
    ├── DropInForm.tsx
    └── ChargeFields.tsx          — toggle "Cobrar agora" com sub-formulário
```

### `DropInFormPage`

- Toggle no topo: **"Aluno cadastrado"** vs. **"Interessado novo (prospect)"**.
  - Cadastrado → autocomplete `useStudents`.
  - Prospect → input `prospectName`.
- Date picker + time picker para `scheduledAt`.
- **Indicador de ocupação** do slot ao selecionar dia/horário (call ao endpoint de capacidade ou calendar). Badge amarelo "Turma cheia" sem bloqueio.
- Toggle "Cobrar agora":
  - `amount`, `dueDate` (default = scheduledAt), `paymentMethod`, "Já paga" checkbox + `paidAt`.
- Botão "Registrar".

### Acesso a partir da agenda (Fase 6)

- Em `WeekGrid` / `DayList`, botão "+ Aula avulsa" no header de cada dia. Abre `DropInFormPage` pré-preenchendo `scheduledAt`.

### Lista de avulsas

- Tabela com: data/hora, aluno ou prospect, status do session, valor cobrado, status da cobrança.
- Filtros: período, tem cobrança, status.
- Mobile: cards.

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/drop-ins/drop-ins.module.ts`
- `apps/api/src/modules/drop-ins/drop-ins.controller.ts`
- `apps/api/src/modules/drop-ins/drop-ins.service.ts`
- `apps/api/src/modules/drop-ins/dto/*.ts`
- `apps/api/src/database/migrations/<ts>-MakeSessionStudentNullable.ts`

**Backend modificar:**
- `apps/api/src/app.module.ts` — importar `DropInsModule`.
- `apps/api/src/modules/sessions/entities/session.entity.ts` — `student` agora opcional.

**Contracts criar:** `packages/contracts/src/drop-in/index.ts`.

**Frontend criar:** estrutura completa em `apps/web/src/features/drop-ins/`.

**Frontend modificar:**
- `App.tsx` — rotas `/drop-ins`, `/drop-ins/new`.
- `AppLayout.tsx` — menu "Aulas avulsas".
- `apps/web/src/features/schedule/components/WeekGrid.tsx` — botão "+ Aula avulsa" por dia.

## Verificação

1. Registrar avulsa de **prospect** (sem cadastro) em horário com 2 alunos:
   - 201 com `sessionId`, `receivableId=null` (sem cobrança).
   - Banco: `session(origin='drop_in', student_id=null)`, `drop_in_class(prospect_name='João', student_id=null)`.
   - Aparece na agenda (Fase 6) com nome "João (avulsa)".
2. Registrar avulsa de **aluno cadastrado** **com cobrança**:
   - `charge: { amount: '60.00', dueDate, paymentMethod:'pix' }`.
   - 201 com `receivableId` populado.
   - Receivable aparece em `GET /receivables?source=drop_in` (Fase 8).
3. Registrar avulsa em slot **com 4 alunos** → 201 com `warnings.overCapacity: true`.
4. Tentar com `studentId` e `prospectName` ao mesmo tempo → 422.
5. Tentar com nenhum dos dois → 422.
6. Deletar avulsa com cobrança pendente → session cancelado, drop_in_class apagado, receivable continua existindo, resposta inclui `pendingReceivableId`.

## Próxima fase

**Fase 8 — `receivables` + `payables`**: financeiro completo (a receber + a pagar), baixas, estornos, filtros (incl. overdue derivado).
