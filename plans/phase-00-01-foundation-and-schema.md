# Fase 0 + 1 — Fundação e Schema Completo

## Contexto

O repositório é um template skeleton (`representante-vendas`) com NestJS 11 + TypeORM + Postgres no back, React 19 + Vite + MUI no front, Firebase Auth com `FirebaseAuthGuard` global + provisionamento JIT, monorepo pnpm com `packages/contracts`. Os documentos `01-requisitos-regras-negocio.md`, `02-modelo-de-dados.md`, `03-arquitetura-tecnica.md` e `04-especificacao-api.md` na raiz especificam o sistema de gestão para um studio de Pilates.

Esta fase **prepara o terreno** antes de implementar qualquer domínio de negócio: alinha o template ao Doc 02, renomeia pacotes, monta observabilidade, e cria **toda a estrutura do banco** numa única migration. Tudo o que vem depois assume que esta fase está pronta.

## Pré-requisitos

Nenhum. Começa do estado atual do repositório (template intacto + 4 documentos de spec).

## Override autoritativo

**Capacidade de turma de 4 alunos é apenas warning, nunca blocker.** Memorizar para todas as fases seguintes. Sobrescreve Doc 01 §4.3 e Doc 02 §4.1.

---

## Parte A — Fundação (Fase 0)

### A.1 Renomeação do monorepo

Renomear de `@representante-vendas/*` para `@anna-maria/*` (confirmar nome com o operador antes; default `@anna-maria`):

- `package.json` raiz: scripts `pnpm --filter @representante-vendas/...` → `pnpm --filter @anna-maria/...`.
- `apps/api/package.json`: campo `name`.
- `apps/web/package.json`: campo `name` + dependência `@representante-vendas/contracts`.
- `packages/contracts/package.json`: campo `name`.
- Todos os imports `from '@representante-vendas/contracts'` → `from '@anna-maria/contracts'` (back e front).
- `CLAUDE.md`: substituir referências.
- `docker-compose.dev.yaml` e `Dockerfile.dev` se referenciarem o nome.
- Rodar `pnpm install` ao final para reescrever symlinks.

### A.2 Alinhar `User` ao Doc 02 §3.0

Estado atual (`apps/api/src/user/user.entity.ts`):
- Tabela `users` (plural), com `name`, `role` default `'user'`.

Alvo (Doc 02):
- Tabela `user` (singular).
- Sem coluna `name` (espelho do Firebase apenas).
- Adicionar `student_id uuid NULL FK → student ON DELETE SET NULL` (FK criada na Parte B.4, depois de `student` existir).
- Adicionar `is_active boolean NOT NULL DEFAULT true`.
- Tipo enum nativo `user_role_enum` com valor `operator` apenas (v1); default `'operator'`.

**Migration `UserAlignWithDoc02`** (`apps/api/src/database/migrations/<ts>-UserAlignWithDoc02.ts`):
- Criar enum `user_role_enum AS ENUM ('operator')`.
- `ALTER TABLE users RENAME TO "user"`.
- `ALTER TABLE "user" DROP COLUMN name`.
- `ALTER TABLE "user" ADD COLUMN is_active boolean NOT NULL DEFAULT true`.
- `ALTER TABLE "user" ALTER COLUMN role TYPE user_role_enum USING 'operator'::user_role_enum, ALTER COLUMN role SET DEFAULT 'operator'`.
- (A coluna `student_id` é adicionada numa segunda migration na Parte B.4, depois que `student` existir.)
- Constraint `UQ_user_firebase_uid` mantida.

**`User` entity** atualizada para refletir tabela `user`, sem `name`, com `isActive`, `studentId` opcional, enum `UserRole = 'operator'`.

**`UserService.findOrCreateFromToken`** (provisionamento JIT) ajustar:
- Não exigir `name` no decoded token (Firebase sempre tem `email` mas pode não ter `name`).
- Criar com `role='operator'`, `isActive=true`.

**Decorator `@CurrentUser()`** e `FirebaseAuthGuard` permanecem compatíveis (já injetam o `User`).

### A.3 Estrutura do contracts package

Criar a árvore por domínio espelhando o back:

```
packages/contracts/src/
├── common/
│   ├── enums.ts        — Period, PaymentMethod, PlanStatus, SessionStatus, SessionOrigin, ReceivableSource, PayableSource, LancamentoStatus, UserRole
│   ├── pagination.ts   — PaginatedResponse<T>, PaginationQuery
│   └── index.ts
├── user/index.ts       — User
├── student/index.ts    — placeholder (preenchido na Fase 3)
├── plan-catalog/index.ts — placeholder (Fase 4)
├── plan/index.ts       — placeholder (Fase 5)
├── plan-schedule/index.ts — placeholder (Fase 5)
├── session/index.ts    — placeholder (Fase 6)
├── drop-in/index.ts    — placeholder (Fase 7)
├── receivable/index.ts — placeholder (Fase 8)
├── payable/index.ts    — placeholder (Fase 8)
├── recurring-expense/index.ts — placeholder (Fase 9)
└── index.ts            — reexporta tudo
```

Enums em `common/enums.ts` (exatamente como Doc 04 §1.5):
```ts
export type Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type PaymentMethod = 'cash' | 'pix' | 'card' | 'boleto';
export type PlanStatus = 'active' | 'finished' | 'cancelled';
export type SessionStatus = 'scheduled' | 'present' | 'absence_notified' | 'absence_unnotified' | 'cancelled';
export type SessionOrigin = 'plan' | 'drop_in';
export type ReceivableSource = 'plan' | 'drop_in' | 'manual';
export type PayableSource = 'recurring' | 'manual';
export type LancamentoStatus = 'pending' | 'paid';
export type UserRole = 'operator';
```

### A.4 Observabilidade (Doc 03 §5)

**Back — Pino + OTLP:**
- Dependências: `nestjs-pino`, `pino`, `pino-http`, `@opentelemetry/sdk-logs`, `@opentelemetry/exporter-logs-otlp-http` (ou stack equivalente).
- `apps/api/src/common/logger/logger.module.ts` — configura `LoggerModule.forRoot` do `nestjs-pino` com:
  - JSON output (sem pretty-print em produção; pretty só local).
  - Request-id automático (`pino-http` `genReqId`).
  - Redactor para campos sensíveis: `authorization`, `password`, qualquer payload em rotas financeiras (campos `amount`, `paidAt`, `paymentMethod`), dados pessoais (`phone`, `email`, `birthDate`, `notes`).
- Bootstrap OTLP em `main.ts` antes de criar a app, usando `OTEL_EXPORTER_OTLP_ENDPOINT`.

**Back — PostHog:**
- Dependência: `posthog-node`.
- `apps/api/src/common/posthog/posthog.module.ts` provider global injetável. Singleton inicializado com `POSTHOG_API_KEY`, `POSTHOG_HOST`.
- `apps/api/src/common/filters/all-exceptions.filter.ts` (global via `APP_FILTER`):
  - Catch `HttpException` e `Error`.
  - Status ≥500 ou não-`HttpException` → `posthog.captureException(err, { distinctId: user?.id ?? 'anon', properties: { route, method, firebaseUid } })`.
  - 4xx fluxo normal, **não** envia.
  - Resposta padronizada `{ statusCode, error, message }` (Doc 04 §1.2).
  - **Nunca** logar/enviar body com dados pessoais ou financeiros.

**Front — PostHog Web:**
- Dependência: `posthog-js`.
- Init em `apps/web/src/main.tsx` com `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`.
- `ErrorBoundary` no topo da árvore em `App.tsx` que envia `posthog.captureException`.
- `window.addEventListener('unhandledrejection', ...)` global.
- No `apps/web/src/api/client.ts` (axios): interceptor de response que reporta 5xx ao PostHog (sem body).

### A.5 Env e config

`apps/api/.env.example`:
```
DATABASE_URL=postgres://...
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
PORT=3000
NODE_ENV=development
TZ=America/Sao_Paulo
CORS_ORIGIN=http://localhost:5173
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com
OTEL_EXPORTER_OTLP_ENDPOINT=
LOG_LEVEL=info
```

`apps/web/.env.example`:
```
VITE_API_URL=http://localhost:3000/api/v1
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

`apps/api/src/config/env.validation.ts` — validar com `class-validator` no boot. Erros bloqueiam start.

### A.6 API versionada

- `main.ts`: `app.setGlobalPrefix('api/v1')`.
- Swagger expor em `/api/v1/docs`. Configurar Bearer auth no Swagger.

---

## Parte B — Schema completo (Fase 1)

### B.1 Extensão Postgres

Confirmar `uuid-ossp` (template já usa `uuid_generate_v4()`). Manter consistência — não migrar para `pgcrypto`/`gen_random_uuid()` agora.

### B.2 Criar enums nativos

Numa migration nova `CreateDomainEnums` (ou no mesmo `CreateDomainSchema` da B.3, antes das tabelas):

```sql
CREATE TYPE period_enum AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
CREATE TYPE payment_method_enum AS ENUM ('cash', 'pix', 'card', 'boleto');
CREATE TYPE plan_status_enum AS ENUM ('active', 'finished', 'cancelled');
CREATE TYPE session_status_enum AS ENUM ('scheduled', 'present', 'absence_notified', 'absence_unnotified', 'cancelled');
CREATE TYPE session_origin_enum AS ENUM ('plan', 'drop_in');
CREATE TYPE receivable_source_enum AS ENUM ('plan', 'drop_in', 'manual');
CREATE TYPE payable_source_enum AS ENUM ('recurring', 'manual');
CREATE TYPE lancamento_status_enum AS ENUM ('pending', 'paid');
```

### B.3 Migration `CreateDomainSchema`

`apps/api/src/database/migrations/<ts>-CreateDomainSchema.ts`. Uma única migration para todas as tabelas do Doc 02 §3 (exceto `user`, que já existe e foi alinhada na A.2).

Tabelas e políticas FK (espelham Doc 02 literalmente):

- **`student`** — `id uuid PK`, `full_name text NOT NULL`, `phone text`, `email text`, `birth_date date`, `notes text`, `is_active boolean NOT NULL DEFAULT true`, `created_at/updated_at`.
- **`plan_catalog`** — `id`, `name text NOT NULL`, `period period_enum`, `duration_months int NOT NULL`, `weekly_frequency int NOT NULL`, `base_price numeric(10,2) NOT NULL`, `is_active boolean NOT NULL DEFAULT true`, auditoria.
- **`plan`** — `id`, `student_id uuid NOT NULL REFERENCES student(id) ON DELETE RESTRICT`, `plan_catalog_id uuid REFERENCES plan_catalog(id) ON DELETE SET NULL`, `period period_enum NOT NULL`, `weekly_frequency int NOT NULL`, `start_date date NOT NULL`, `end_date date NOT NULL`, `total_price numeric(10,2) NOT NULL`, `payment_method payment_method_enum NULL`, `installments_count int NOT NULL DEFAULT 1`, `status plan_status_enum NOT NULL`, `notes text`, auditoria.
- **`plan_schedule`** — `id`, `plan_id uuid NOT NULL REFERENCES plan(id) ON DELETE CASCADE`, `weekday int NOT NULL`, `start_time time NOT NULL`, auditoria. (Padronizar `weekday`: **0=domingo … 6=sábado** — adotar e documentar.)
- **`session`** — `id`, `plan_id uuid REFERENCES plan(id) ON DELETE SET NULL`, `student_id uuid NOT NULL REFERENCES student(id) ON DELETE RESTRICT`, `scheduled_at timestamptz NOT NULL`, `status session_status_enum NOT NULL`, `origin session_origin_enum NOT NULL DEFAULT 'plan'`, `notes text`, auditoria.
  - Índices: `(scheduled_at)`, `(student_id, scheduled_at)`, `(plan_id)`.
- **`drop_in_class`** — `id`, `session_id uuid REFERENCES session(id) ON DELETE CASCADE`, `student_id uuid REFERENCES student(id) ON DELETE SET NULL`, `prospect_name text`, `receivable_id uuid REFERENCES receivable(id) ON DELETE SET NULL` (FK adicionada depois da criação de `receivable`), auditoria.
- **`receivable`** — `id`, `plan_id uuid REFERENCES plan(id) ON DELETE SET NULL`, `source receivable_source_enum NOT NULL`, `description text NOT NULL`, `amount numeric(10,2) NOT NULL`, `due_date date NOT NULL`, `installment_number int`, `installment_total int`, `payment_method payment_method_enum`, `status lancamento_status_enum NOT NULL DEFAULT 'pending'`, `paid_at date`, auditoria.
  - Índices: `(due_date, status)`, `(plan_id)`.
- **`payable`** — `id`, `recurring_expense_id uuid REFERENCES recurring_expense(id) ON DELETE SET NULL`, `source payable_source_enum NOT NULL`, `description text NOT NULL`, `category text`, `amount numeric(10,2) NOT NULL`, `due_date date NOT NULL`, `competence_month date`, `status lancamento_status_enum NOT NULL DEFAULT 'pending'`, `paid_at date`, `payment_method payment_method_enum`, auditoria.
  - Índices: `(due_date, status)`, `(recurring_expense_id, competence_month)`.
  - **Único parcial:** `CREATE UNIQUE INDEX uq_payable_recurring_competence ON payable (recurring_expense_id, competence_month) WHERE source = 'recurring'`. (Doc 02 §5, idempotência da geração.)
- **`recurring_expense`** — `id`, `description text NOT NULL`, `category text`, `expected_amount numeric(10,2) NOT NULL`, `due_day int NOT NULL CHECK (due_day BETWEEN 1 AND 28)`, `is_active boolean NOT NULL DEFAULT true`, auditoria.

**Ordem de criação** dentro da migration (devido às FKs):
1. `student`, `plan_catalog`, `recurring_expense`.
2. `plan` (depende de student, plan_catalog).
3. `plan_schedule`, `receivable`, `payable` (dependem de plan/recurring_expense).
4. `session` (depende de plan, student).
5. `drop_in_class` (depende de session, student, receivable).
6. Todos os índices, incluindo o único parcial.

### B.4 Migration `UserAddStudentFk`

`apps/api/src/database/migrations/<ts>-UserAddStudentFk.ts`:
- `ALTER TABLE "user" ADD COLUMN student_id uuid NULL REFERENCES student(id) ON DELETE SET NULL`.

(Separada da Parte A.2 porque depende de `student` existir.)

### B.5 Entities TypeORM

Criar em `apps/api/src/modules/<domínio>/entities/*.entity.ts` mapeando 1:1 as tabelas. Os módulos ainda não terão services/controllers — só as entidades, para validar:
- Glob `entities: [__dirname + '/**/*.entity{.ts,.js}']` continua descobrindo automaticamente.
- Enums declarados com `{ type: 'enum', enum: ... }` referenciando os tipos Postgres.
- `numeric(10,2)` com transformer string ↔ number (ex.: `to: (n: number) => n.toString(), from: (s: string) => parseFloat(s)`) ou manter como string em todo lugar — **decisão recomendada: manter como string** para evitar perda de precisão (alinha com Doc 04 que envia/recebe string).

Lista de arquivos:
```
apps/api/src/modules/students/entities/student.entity.ts
apps/api/src/modules/plan-catalog/entities/plan-catalog.entity.ts
apps/api/src/modules/plans/entities/plan.entity.ts
apps/api/src/modules/plans/entities/plan-schedule.entity.ts
apps/api/src/modules/sessions/entities/session.entity.ts
apps/api/src/modules/drop-ins/entities/drop-in-class.entity.ts
apps/api/src/modules/receivables/entities/receivable.entity.ts
apps/api/src/modules/payables/entities/payable.entity.ts
apps/api/src/modules/recurring-expenses/entities/recurring-expense.entity.ts
```

### B.6 Seed `plan_catalog`

`apps/api/src/database/seeds/plan-catalog.seed.ts` — idempotente (verifica `name` antes de inserir). Script `package.json`: `"seed": "ts-node -r tsconfig-paths/register src/database/seeds/run.ts"`. Combinações mínimas:

| Nome | Período | duration_months | weekly_frequency | base_price |
|---|---|---|---|---|
| Mensal 1x | monthly | 1 | 1 | 180.00 |
| Mensal 2x | monthly | 1 | 2 | 280.00 |
| Mensal 3x | monthly | 1 | 3 | 360.00 |
| Trimestral 1x | quarterly | 3 | 1 | 510.00 |
| Trimestral 2x | quarterly | 3 | 2 | 780.00 |
| Trimestral 3x | quarterly | 3 | 3 | 990.00 |
| Semestral 2x | semiannual | 6 | 2 | 1500.00 |
| Anual 2x | annual | 12 | 2 | 2880.00 |

(Valores são placeholders — confirmar com operador antes do deploy. Idempotência protege re-runs.)

---

## Arquivos críticos

**Criar:**
- `apps/api/src/database/migrations/<ts>-UserAlignWithDoc02.ts`
- `apps/api/src/database/migrations/<ts>-CreateDomainSchema.ts`
- `apps/api/src/database/migrations/<ts>-UserAddStudentFk.ts`
- `apps/api/src/database/seeds/plan-catalog.seed.ts` + runner
- `apps/api/src/common/logger/logger.module.ts`
- `apps/api/src/common/posthog/posthog.module.ts`
- `apps/api/src/common/filters/all-exceptions.filter.ts`
- `apps/api/src/config/env.validation.ts`
- `apps/api/src/modules/*/entities/*.entity.ts` (9 entities, sem módulos ainda)
- `packages/contracts/src/common/enums.ts` + estrutura completa do package
- `apps/web/src/lib/posthog.ts`

**Modificar:**
- Todos os `package.json` (renomeação).
- `apps/api/src/user/user.entity.ts` (remover `name`, adicionar `isActive`, `studentId`).
- `apps/api/src/user/user.service.ts` (JIT sem `name`).
- `apps/api/src/main.ts` (prefix `api/v1`, OTLP, logger Pino).
- `apps/api/src/app.module.ts` (logger, posthog, exception filter global).
- `apps/web/src/main.tsx` (PostHog init).
- `apps/web/src/App.tsx` (ErrorBoundary).
- `apps/web/src/api/client.ts` (interceptor erros).
- `CLAUDE.md`.

## Verificação

1. `pnpm install` na raiz sem erros.
2. `pnpm --filter @anna-maria/api lint && pnpm --filter @anna-maria/api type-check` passam.
3. Subir Postgres limpo (`docker compose -f docker-compose.dev.yaml up -d postgres`), rodar `pnpm --filter @anna-maria/api migration:run` — aplica todas as migrations sem erro.
4. Adminer (`localhost:8080`) mostra todas as tabelas (`user`, `student`, `plan_catalog`, `plan`, `plan_schedule`, `session`, `drop_in_class`, `receivable`, `payable`, `recurring_expense`) + todos os enums.
5. `pnpm --filter @anna-maria/api seed` popula `plan_catalog`. Rodar de novo → 0 inserts (idempotente).
6. `pnpm --filter @anna-maria/api start:dev` sobe sem erro.
7. `GET /api/v1/health` responde 200.
8. Com token Firebase válido, `GET /api/v1/auth/me` provisiona `user` (role=`operator`, `is_active=true`) e devolve `{ id, firebaseUid, email, role:'operator', isActive:true }`.
9. Lançar exceção 500 propositalmente no `/health` (temporário) → aparece no PostHog + no log JSON do Pino.
10. Reverter `migration:revert` desfaz `UserAddStudentFk`; reverter mais 1 vez desfaz `CreateDomainSchema` (todas as tabelas somem); reverter mais 1 desfaz `UserAlignWithDoc02`.

## Próximas fases

Após esta fase, todas as tabelas existem mas só `user` tem service/controller. As fases 2–10 vão implementar a lógica de negócio em cima dessa fundação. Próxima: **Fase 2 — Módulo `scheduling` (geradores)** — implementa a lógica regra-mãe → ocorrências antes de qualquer CRUD de domínio.
