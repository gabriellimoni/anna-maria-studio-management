# Fase 3 + 4 — `students` e `plan-catalog`

## Contexto

Duas fatias verticais simples (CRUD back + contracts + front) que estabelecem o **padrão arquitetural** do projeto antes do fluxo complexo de planos (Fase 5). São cadastros relativamente autocontidos:
- **Alunos** (`student`) — Doc 02 §3.1, Doc 04 §3.
- **Catálogo de planos** (`plan_catalog`) — Doc 02 §3.2, Doc 04 §4.

Ambos usam soft delete via `is_active=false`, paginação padrão, e expõem rotas REST sob `/api/v1`.

## Pré-requisitos

- Fases 0 + 1 + 2 concluídas. Tabelas e enums existem; entities mapeadas; `@anna-maria/contracts` montado; `FirebaseAuthGuard` global.

---

## Parte A — Módulo `students` (Fase 3)

### A.1 Backend

```
apps/api/src/modules/students/
├── students.module.ts
├── students.controller.ts
├── students.service.ts
├── entities/student.entity.ts        (já criada na Fase 1)
└── dto/
    ├── create-student.dto.ts
    ├── update-student.dto.ts
    └── list-students.query.ts
```

**`StudentsService`:**
- `create(dto)` — `manager.save(Student, { ...dto, isActive: true })`.
- `findAll(query)` — filtros `search` (ILIKE em `full_name`), `isActive`. Paginação.
- `findOne(id)` — 404 se não existe.
- `update(id, dto)` — `PATCH` parcial.
- `archive(id)` — soft delete: seta `isActive=false`. Não `DELETE` físico.
- `listPlansOfStudent(id)` — vazio na Fase 3 (preenche quando Fase 5 entrar). Pode já retornar `[]` agora.
- `listSessionsOfStudent(id, query)` — idem (Fase 6).

**`StudentsController`** (todas autenticadas por padrão; sem `@Public()`):

| Método | Rota | Handler |
|---|---|---|
| GET | `/students` | `findAll(query)` |
| POST | `/students` | `create(dto)` |
| GET | `/students/:id` | `findOne(id)` |
| PATCH | `/students/:id` | `update(id, dto)` |
| DELETE | `/students/:id` | `archive(id)` (retorna 204) |
| GET | `/students/:id/plans` | `listPlansOfStudent(id)` — stub `[]` |
| GET | `/students/:id/sessions` | `listSessionsOfStudent(id, query)` — stub `[]` |

**DTOs (`class-validator`):**

`CreateStudentDto`:
```ts
@IsString() @IsNotEmpty() fullName: string;
@IsString() @IsOptional() phone?: string;
@IsEmail() @IsOptional() email?: string;
@IsDateString() @IsOptional() birthDate?: string;
@IsString() @IsOptional() notes?: string;
```

`UpdateStudentDto` extends `PartialType(CreateStudentDto)`.

`ListStudentsQuery`:
```ts
@IsOptional() @IsString() search?: string;
@IsOptional() @IsBooleanString() isActive?: string; // 'true'/'false'
@IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
```

**Swagger:** anotar todos os endpoints com `@ApiTags('students')`, `@ApiBearerAuth()`, `@ApiResponse` exemplos.

**Registrar no `app.module.ts`:** `StudentsModule` na lista de imports.

### A.2 Contracts

`packages/contracts/src/student/index.ts`:

```ts
export interface Student {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentInput {
  fullName: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  notes?: string;
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

export interface ListStudentsQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}
```

Reexportar no `packages/contracts/src/index.ts`.

### A.3 Frontend

```
apps/web/src/features/students/
├── api/students.ts           — axios wrappers
├── hooks/
│   ├── useStudents.ts        — useQuery list
│   ├── useStudent.ts         — useQuery single
│   └── useStudentMutations.ts — create/update/archive
├── pages/
│   ├── StudentsListPage.tsx
│   ├── StudentFormPage.tsx   — create + edit (rota /:id?)
│   └── StudentDetailPage.tsx — abas: dados, planos, atendimentos
└── components/
    ├── StudentForm.tsx
    └── StudentsTable.tsx     — vira lista de cards no mobile
```

**Padrões:**
- React Hook Form + Zod (schema espelhando contracts).
- TanStack Query: `queryKey: ['students', filters]`. Invalidar após mutações.
- MUI v9: `DataGrid` no desktop, `Card`+`List` no mobile (breakpoint `md`).
- Toasts (`ToastProvider` existente do template) para feedback de sucesso/erro.
- Rotas em `App.tsx`:
  - `/students` → `StudentsListPage`
  - `/students/new` → `StudentFormPage`
  - `/students/:id` → `StudentDetailPage`
  - `/students/:id/edit` → `StudentFormPage`
- Todas protegidas por `RequireAuth` (existente).

**Detalhe do aluno** com 3 abas (Material UI `Tabs`):
1. **Dados** — exibe campos + botão "Editar" e "Arquivar".
2. **Planos** — lista de planos do aluno (vazia na Fase 3; conectada na Fase 5).
3. **Atendimentos** — histórico de sessions (vazio na Fase 3; Fase 6).

Layout mobile-first: tabela vira lista no `< md`.

---

## Parte B — Módulo `plan-catalog` (Fase 4)

### B.1 Backend

```
apps/api/src/modules/plan-catalog/
├── plan-catalog.module.ts
├── plan-catalog.controller.ts
├── plan-catalog.service.ts
├── entities/plan-catalog.entity.ts  (já existe)
└── dto/
    ├── create-plan-catalog.dto.ts
    ├── update-plan-catalog.dto.ts
    └── list-plan-catalog.query.ts
```

**`PlanCatalogService`:**
- `create(dto)` — derivar `durationMonths` de `period` no service (não aceitar do client; mapping: monthly=1, quarterly=3, semiannual=6, annual=12).
- `findAll(query)` — filtro `isActive`. Sem paginação obrigatória aqui (catálogo é pequeno; pode retornar lista plana).
- `findOne(id)`, `update(id, dto)`, `archive(id)` (soft delete).

**Controller:**

| Método | Rota |
|---|---|
| GET | `/plan-catalog` |
| POST | `/plan-catalog` |
| GET | `/plan-catalog/:id` |
| PATCH | `/plan-catalog/:id` |
| DELETE | `/plan-catalog/:id` |

**DTOs:**

`CreatePlanCatalogDto`:
```ts
@IsString() @IsNotEmpty() name: string;
@IsEnum(['monthly', 'quarterly', 'semiannual', 'annual']) period: Period;
@IsInt() @Min(1) @Max(7) weeklyFrequency: number;
@IsString() @Matches(/^\d+\.\d{2}$/) basePrice: string;
```

(Não aceita `durationMonths` nem `isActive` no create.)

`UpdatePlanCatalogDto` extends `PartialType(CreatePlanCatalogDto)` + `@IsBoolean() @IsOptional() isActive?: boolean`.

**Regra de proteção:** atualizar `plan_catalog` **não afeta** `plan`s já contratados (snapshot já feito em Doc 02 §3.3). Documentar no Swagger.

### B.2 Contracts

`packages/contracts/src/plan-catalog/index.ts`:

```ts
import type { Period } from '../common/enums';

export interface PlanCatalog {
  id: string;
  name: string;
  period: Period;
  durationMonths: number;
  weeklyFrequency: number;
  basePrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanCatalogInput {
  name: string;
  period: Period;
  weeklyFrequency: number;
  basePrice: string;
}

export type UpdatePlanCatalogInput = Partial<CreatePlanCatalogInput> & { isActive?: boolean };
```

### B.3 Frontend

```
apps/web/src/features/plan-catalog/
├── api/plan-catalog.ts
├── hooks/
│   ├── usePlanCatalog.ts
│   └── usePlanCatalogMutations.ts
├── pages/
│   ├── PlanCatalogListPage.tsx
│   └── PlanCatalogFormPage.tsx
└── components/PlanCatalogForm.tsx
```

Tela simples: lista com badge `Inativo` para `isActive=false`, formulário com selects de `period` e `weeklyFrequency`, campo de `basePrice` com máscara monetária (BRL).

Rotas:
- `/plan-catalog` → lista
- `/plan-catalog/new` e `/plan-catalog/:id/edit` → formulário

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/students/{students.module.ts, students.controller.ts, students.service.ts, dto/*.ts}`
- `apps/api/src/modules/plan-catalog/{plan-catalog.module.ts, plan-catalog.controller.ts, plan-catalog.service.ts, dto/*.ts}`

**Backend modificar:**
- `apps/api/src/app.module.ts` (importar os dois módulos)

**Contracts criar/atualizar:**
- `packages/contracts/src/student/index.ts`
- `packages/contracts/src/plan-catalog/index.ts`
- `packages/contracts/src/index.ts` (reexportar)

**Frontend criar:**
- Estrutura completa de `apps/web/src/features/students/`
- Estrutura completa de `apps/web/src/features/plan-catalog/`
- Atualizar `apps/web/src/App.tsx` com as rotas
- Atualizar `apps/web/src/components/AppLayout.tsx` (menu lateral) — adicionar links "Alunos" e "Catálogo de planos"

## Verificação

### Alunos
1. UI: criar aluno → aparece na lista; editar → persiste; arquivar → some da lista (filtro padrão `isActive=true`).
2. API direto via Swagger:
   - `POST /api/v1/students` retorna 201 com body.
   - `GET /api/v1/students?search=Maria&isActive=true` filtra.
   - `DELETE /api/v1/students/:id` retorna 204; o aluno continua no banco com `is_active=false`.
3. `GET /api/v1/students/:id/plans` retorna `[]` (stub) sem erro.
4. Mobile: redimensionar viewport, tabela vira cards.

### Catálogo de planos
1. Seed da Fase 1 deve aparecer na listagem.
2. Criar novo "Mensal 4x" → `durationMonths=1` no banco (derivado).
3. Editar `basePrice` de um item → planos contratados existentes (depois da Fase 5) não são afetados (validar quando Fase 5 estiver pronta).
4. Desativar → não aparece em `?isActive=true`.

## Próxima fase

**Fase 5 — `plans`**: a fatia vertical mais complexa, que junta scheduling (Fase 2), students (Fase 3) e plan-catalog (Fase 4) numa criação transacional com geração de sessions e parcelas.
