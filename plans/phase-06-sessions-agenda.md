# Fase 6 — Módulo `sessions` (Agenda e Atendimentos)

## Contexto

Implementa a **agenda operacional** — o coração do dia-a-dia do studio. Os `session`s já foram gerados pela Fase 5 ao criar planos; esta fase expõe a visualização (dia/semana), marcação de presença/falta e cancelamento individual de aulas (ex.: feriado).

Referências: Doc 01 §5; Doc 02 §3.5; Doc 04 §6.

**Sem regra de reposição na v1** (Doc 01 §5.1) — `absence_notified` vs. `absence_unnotified` são apenas dados de controle interno, sem efeito sistêmico.

## Pré-requisitos

- Fases 0–5 concluídas. Sessions já existem no banco (gerados por criação de planos da Fase 5).

## Decisão a tomar (Doc 04 §13.2)

**`GET /sessions/calendar` retorna slots vazios?** Recomendação: **não** na v1. Retornar apenas slots com pelo menos 1 sessão. Slots vazios viram lacunas naturais na grade. Se o operador precisar marcar/agendar em horário ainda não usado, ele cria uma aula avulsa (Fase 7).

## Override autoritativo

Capacidade da turma de 4 alunos é informativa. Slots com 5+ alunos exibem o valor real (ex.: "5/4") com indicador visual de sobrelotação, sem bloqueio.

---

## Backend

```
apps/api/src/modules/sessions/
├── sessions.module.ts
├── sessions.controller.ts
├── sessions.service.ts
├── entities/session.entity.ts   (já existe)
└── dto/
    ├── list-sessions.query.ts
    ├── calendar.query.ts
    ├── update-session.dto.ts
    └── cancel-session.dto.ts
```

### Controller

| Método | Rota | Handler |
|---|---|---|
| GET | `/sessions` | `findAll(query)` — lista plana de sessions |
| GET | `/sessions/calendar` | `getCalendar(query)` — agrupado por slot |
| GET | `/sessions/:id` | `findOne(id)` |
| PATCH | `/sessions/:id` | `updateStatus(id, dto)` |
| POST | `/sessions/:id/cancel` | `cancel(id, dto)` |

### `GET /sessions`

`ListSessionsQuery`:
- `date?: 'YYYY-MM-DD'` (atalho para from=to=date).
- `from?: 'YYYY-MM-DD'`, `to?: 'YYYY-MM-DD'`.
- `studentId?: uuid`.
- `planId?: uuid`.
- `status?: SessionStatus`.
- Paginação opcional.

Retorna `Session[]` planos, ordenados por `scheduledAt ASC`, com `student.fullName` populado via relation.

### `GET /sessions/calendar`

`CalendarQuery`:
- `from: 'YYYY-MM-DD'` (obrigatório).
- `to: 'YYYY-MM-DD'` (obrigatório, máximo 31 dias de janela — validar).

Lógica:
1. Buscar todos os sessions no intervalo `[from, to]` (inclui cancelados? **incluir** para que apareçam na UI como "cancelado", mas sem contar na ocupação).
2. Agrupar por `(date, startTime)` onde:
   - `date = scheduledAt.toLocaleDateString('pt-BR-AS-SP-style')` (1º dia BR).
   - `startTime = scheduledAt.format('HH:mm')` em America/Sao_Paulo.
3. Para cada grupo, calcular:
   - `capacity = 4` (constante informativa).
   - `occupied = count of sessions where status <> 'cancelled'`.
   - `sessions: [{ id, studentId, studentName, status, origin }]`.

Resposta (Doc 04 §6.1):
```json
{
  "slots": [
    {
      "date": "2026-06-01", "startTime": "17:00",
      "capacity": 4, "occupied": 3,
      "isOverCapacity": false,
      "sessions": [{ "id":"...", "studentId":"...", "studentName":"Maria", "status":"scheduled", "origin":"plan" }]
    }
  ]
}
```

### `PATCH /sessions/:id`

`UpdateSessionDto`:
```ts
@IsEnum(['scheduled', 'present', 'absence_notified', 'absence_unnotified']) @IsOptional()
status?: SessionStatus;
@IsString() @IsOptional() notes?: string;
```

- `status='cancelled'` **não** é aceito aqui — use o endpoint específico (`/cancel`).
- Sem bloqueio temporal (Doc 04 §13.3 — operador pode editar passado, é apenas imutável quanto à regeneração).

### `POST /sessions/:id/cancel`

`CancelSessionDto`: `{ reason?: string }`.

- Seta `status='cancelled'`, apende `reason` ao `notes` se fornecido.
- Uso típico: feriado, fechamento pontual.

---

## Contracts

`packages/contracts/src/session/index.ts`:

```ts
import type { SessionStatus, SessionOrigin } from '../common/enums';

export interface Session {
  id: string;
  planId: string | null;
  studentId: string;
  studentName?: string;       // populado em listagens
  scheduledAt: string;        // ISO 8601 com tz
  status: SessionStatus;
  origin: SessionOrigin;
  notes: string | null;
}

export interface CalendarSlot {
  date: string;        // 'YYYY-MM-DD'
  startTime: string;   // 'HH:mm'
  capacity: number;    // sempre 4
  occupied: number;
  isOverCapacity: boolean;
  sessions: Array<{
    id: string;
    studentId: string;
    studentName: string;
    status: SessionStatus;
    origin: SessionOrigin;
  }>;
}

export interface CalendarResponse {
  slots: CalendarSlot[];
}

export interface ListSessionsQuery {
  date?: string;
  from?: string;
  to?: string;
  studentId?: string;
  planId?: string;
  status?: SessionStatus;
}

export interface UpdateSessionInput {
  status?: Exclude<SessionStatus, 'cancelled'>;
  notes?: string;
}

export interface CancelSessionInput {
  reason?: string;
}
```

---

## Frontend

```
apps/web/src/features/schedule/
├── api/sessions.ts
├── hooks/
│   ├── useCalendar.ts
│   ├── useSessions.ts
│   ├── useUpdateSession.ts
│   └── useCancelSession.ts
├── pages/
│   ├── WeeklyAgendaPage.tsx     — visão semanal (default)
│   └── DailyAgendaPage.tsx      — visão diária (mobile/zoom)
└── components/
    ├── WeekGrid.tsx             — grade weekday × horário
    ├── DayList.tsx              — lista vertical
    ├── SlotCard.tsx             — turma com ocupação X/4 e nomes
    ├── AttendanceDialog.tsx     — modal de marcação de presença/falta
    └── CancelSessionDialog.tsx
```

### Visão semanal (`WeekGrid`)

- Header: setas anterior/próximo + seletor de semana (date picker que ancora na segunda).
- Grade: linhas = horários únicos do conjunto retornado, colunas = seg–dom.
- Cada célula: `SlotCard` com ocupação (ex.: "3/4") + miniatura dos nomes. Borda amarela se `isOverCapacity`.
- Clicar no slot abre modal com todos os alunos e botões de presença/falta/cancelar.

### Visão diária (`DayList`)

- Default no mobile (`< md`). No desktop pode ser uma terceira opção via toggle.
- Lista vertical de slots do dia, ordenados por horário. Cada `SlotCard` expandido.

### Marcação de presença/falta

- `AttendanceDialog`:
  - Lista os alunos do slot com radio buttons: Presente / Falta avisada / Falta não avisada / Agendado (reverter).
  - Campo de notes opcional por aluno.
  - "Salvar" dispara múltiplas mutações em paralelo (uma por session alterado). Toast de sucesso.

### Cancelar uma aula individual

- Botão "Cancelar esta aula" no `AttendanceDialog` (acima dos alunos) abre `CancelSessionDialog` com textarea `reason`. Aplica a todos os sessions daquele slot (uma mutação por session), efetivamente cancelando a turma inteira (uso típico: feriado).
- **Alternativa:** botão "Cancelar dia inteiro" no header da grade — itera todos os slots do dia. Útil para feriado.

### Filtros

- Toggle "Mostrar canceladas" (default ligado, para o operador ver feriados marcados).
- Filtro por aluno (autocomplete) → reduz grade aos slots desse aluno.

### Acesso pela ficha do aluno

- Em `StudentDetailPage` (Fase 3), a aba "Atendimentos" agora carrega `GET /sessions?studentId={id}` ordenado por `scheduledAt DESC` com paginação.

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/sessions/sessions.module.ts`
- `apps/api/src/modules/sessions/sessions.controller.ts`
- `apps/api/src/modules/sessions/sessions.service.ts`
- `apps/api/src/modules/sessions/dto/*.ts`

**Backend modificar:**
- `apps/api/src/app.module.ts` — importar `SessionsModule`.
- `apps/api/src/modules/students/students.service.ts` — implementar `listSessionsOfStudent` (delegando ou chamando direto a query).

**Contracts criar:** `packages/contracts/src/session/index.ts`.

**Frontend criar:** estrutura completa de `apps/web/src/features/schedule/`.

**Frontend modificar:**
- `apps/web/src/App.tsx` — rotas `/agenda`, `/agenda/dia/:date?`.
- `apps/web/src/components/AppLayout.tsx` — link "Agenda".
- `apps/web/src/features/students/pages/StudentDetailPage.tsx` — popular aba "Atendimentos" com `useSessions({ studentId })`.

## Verificação

1. Após Fase 5 ter criado um plano trimestral 2x, abrir `/agenda` na semana atual → ver os slots correspondentes.
2. Marcar uma aula como `present` → reabrir a UI, status persistiu.
3. Marcar como `absence_notified` e adicionar nota → persiste no banco com `notes`.
4. Cancelar uma aula (feriado) → desaparece da contagem `occupied` mas continua visível com badge "Cancelada" se filtro "Mostrar canceladas" está ativo.
5. Criar um 5º plano com slot já com 4 → o slot na agenda mostra "5/4" com indicador de sobrelotação, sem erro.
6. Filtro por aluno reduz a grade.
7. `GET /api/v1/sessions/calendar?from=2026-06-01&to=2026-06-07` retorna o JSON do Doc 04 §6.1.
8. `PATCH /api/v1/sessions/:id` com `status='cancelled'` → 400/422 (use o endpoint dedicado).
9. `POST /api/v1/sessions/:id/cancel` com `reason='Feriado'` → seta status e apende ao notes.

## Próxima fase

**Fase 7 — `drop-ins` (aulas avulsas)**: registrar aulas pontuais (experimentais) que ocupam vaga na turma e podem gerar cobrança.
