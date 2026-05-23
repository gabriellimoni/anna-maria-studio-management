# Sistema de Gestão para Studio de Pilates
## Documento 03 — Arquitetura Técnica (v1)

> **Status:** rascunho para revisão
> **Base:** Documentos 01 (Requisitos) e 02 (Modelo de Dados)
> **Stack:** React + Vite (front) · NestJS (back) · PostgreSQL · TypeORM · Firebase Auth

---

## 1. Visão geral da arquitetura

Aplicação web em duas camadas, com autenticação delegada ao Firebase:

```
┌─────────────────────┐         ┌──────────────────────────┐         ┌──────────────┐
│   React + Vite      │  HTTPS  │        NestJS API         │  TCP    │  PostgreSQL  │
│   (SPA responsiva)  │ ───────>│  (REST, TypeORM, Guards)  │ ──────> │              │
│                     │  Bearer │                           │         └──────────────┘
│  Firebase Web SDK   │  token  │  Firebase Admin SDK       │
└─────────┬───────────┘         └──────────────────────────┘
          │                                  ▲
          │  login (email/senha)             │ verifica ID token
          ▼                                  │
   ┌─────────────────────────────────────────┘
   │            Firebase Authentication
   └──────────────────────────────────────────
```

**Princípio de segurança:** o Firebase cuida da **identidade** (login/senha, emissão de ID token). O NestJS cuida da **autorização** e de toda a regra de negócio. O backend **nunca** confia no front: todo request protegido tem seu token verificado pelo Firebase Admin SDK.

---

## 2. Stack e justificativas

| Camada | Escolha | Por quê |
|---|---|---|
| Front | React + Vite + TypeScript | Build rápido, DX moderno; alinhado ao pedido |
| UI | (a definir) — sugestão: Tailwind + shadcn/ui ou MUI | Responsividade rápida; decisão de produto |
| Estado servidor | TanStack Query (React Query) | Cache, refetch, estados de loading/erro sem boilerplate |
| Back | NestJS + TypeScript | Modular, opinativo, ótimo para domínios bem definidos |
| ORM | TypeORM | Integração idiomática com NestJS (`@nestjs/typeorm`), repositórios injetáveis |
| Banco | PostgreSQL | Relacional, transações fortes, ideal para o domínio financeiro |
| Auth | Firebase Auth + Admin SDK | Identidade gerenciada; e-mail/senha na v1 |
| Agendador | `@nestjs/schedule` | Cron nativo para a geração de despesas recorrentes |
| Validação | `class-validator` + `class-transformer` | DTOs validados na borda da API |
| Observabilidade | PostHog (error tracking) | Captura de exceções e alertas, front e back |
| Logging | Pino (`nestjs-pino`) + OTLP | Logs estruturados em JSON, exportáveis via OpenTelemetry |

---

## 3. Backend (NestJS)

### 3.1 Organização por módulos de domínio

Cada módulo espelha um agregado do modelo de dados. Estrutura sugerida:

```
src/
├── main.ts
├── app.module.ts
├── common/                  # transversais
│   ├── auth/
│   │   ├── firebase-auth.guard.ts
│   │   ├── firebase-admin.provider.ts
│   │   ├── current-user.decorator.ts
│   │   └── roles.guard.ts        # preparado p/ fase 2 (operator/teacher/student)
│   ├── filters/                  # exception filters
│   ├── interceptors/
│   └── pipes/
├── config/                  # env, validação de configuração
├── database/
│   ├── data-source.ts            # TypeORM DataSource (CLI de migrations)
│   └── migrations/
└── modules/
    ├── users/
    ├── students/
    ├── plan-catalog/
    ├── plans/                    # inclui plan-schedule
    ├── sessions/                 # agenda / atendimentos
    ├── drop-ins/                 # aulas avulsas
    ├── receivables/              # contas a receber
    ├── payables/                 # contas a pagar
    ├── recurring-expenses/       # regras + job de geração
    └── scheduling/               # SERVIÇO DE DOMÍNIO compartilhado (geradores)
```

Cada módulo de domínio segue o padrão NestJS: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`.

### 3.2 O módulo `scheduling` (coração do domínio)

No Documento 02 identificamos o padrão **regra-mãe → ocorrências materializadas**, que aparece três vezes. Para não duplicar lógica, isolamos os geradores num serviço de domínio:

- **`SessionGeneratorService`** — dado um `plan` + seus `plan_schedule`, gera os `session` de `start_date` a `end_date`. Usado na criação do plano e na regeneração após troca de horário.
- **`ReceivablePersistService`** — dado um `plan` e a **lista de parcelas montada pelo front**, valida que a soma = `total_price` (tolerância de centavos) e persiste os `receivable` exatamente como recebidos (incluindo parcelas já pagas). **Não calcula** valores; o cálculo/sugestão é responsabilidade do front (transparência ao operador — Doc 01 §6.2, Doc 04 §5.2).
- **`PayableGeneratorService`** — dada uma `recurring_expense`, gera o `payable` de um mês de competência (idempotente).

Esses serviços são chamados pelos respectivos módulos (plans, recurring-expenses), mantendo a regra de negócio num só lugar e testável isoladamente.

### 3.3 Autenticação — Firebase

**Fluxo:**
1. Front loga no Firebase (e-mail/senha) e obtém o ID token.
2. Cada request à API envia `Authorization: Bearer <idToken>`.
3. `FirebaseAuthGuard` extrai o token, valida com `admin.auth().verifyIdToken(token)`.
4. **Provisionamento JIT:** busca `user` por `firebase_uid`; se não existir, cria (`role='operator'` na v1).
5. Anexa o `user` ao request; `@CurrentUser()` o disponibiliza nos controllers.

**Pontos de implementação:**
- `firebase-admin.provider.ts` inicializa o Admin SDK uma vez (credenciais via env / service account).
- O guard é global (`APP_GUARD`), com um decorator `@Public()` para rotas abertas (ex.: health check).
- `RolesGuard` + `@Roles('operator')` já ficam no código, mesmo que a v1 só tenha um papel — evita retrabalho na fase 2.

### 3.4 Agendador — despesas recorrentes

- `RecurringExpensesModule` registra um `@Cron` (via `@nestjs/schedule`) que dispara **todo dia 25**.
- O cron chama um serviço que, para cada `recurring_expense` ativa, invoca `PayableGeneratorService` para o mês seguinte.
- **Idempotência** garantida por: (a) checagem prévia de `(recurring_expense_id, competence_month)`; (b) índice único parcial no banco (Doc 02 §5). Se o índice barrar, o serviço trata o conflito sem erro.
- **Disparo manual:** endpoint protegido `POST /recurring-expenses/run-generation?month=YYYY-MM` que executa a mesma rotina — rede de segurança (Doc 01 §7.1).
- **Atenção a fuso/horário:** o `@Cron` deve usar o timezone correto (ex.: `America/Sao_Paulo`) para "dia 25" não escorregar por UTC.

### 3.5 Transações e regras críticas

- **Geração de plano** (criar plan + schedules + sessions + receivables) roda **numa única transação** (`DataSource.transaction` ou `QueryRunner`). Ou tudo, ou nada.
- **Troca de horário** (apagar sessions futuros + recriar schedules + regerar) idem, em transação.
- **Capacidade de turma (máx. 4):** validada na aplicação dentro da transação que cria/regenera sessions (Doc 02 §4–5). Para v1 (um operador, baixa concorrência) é suficiente. Reavaliar com lock/serializable quando entrar autoagendamento.
- **"Atrasado" é derivado** em consulta (`status='pending' AND due_date < hoje`); não há job para isso.

### 3.6 TypeORM — boas práticas adotadas

- **`synchronize: false` sempre.** Schema evolui só por **migrations** versionadas (`database/migrations/`). Nunca autogerar schema em produção.
- **`DataSource` dedicado** (`data-source.ts`) para a CLI de migrations, separado do registro no módulo Nest.
- **Entidades** mapeiam 1:1 as tabelas do Doc 02. Relações declaradas explicitamente; **evitar lazy relations** (preferir `relations: [...]` ou QueryBuilder) para não esconder N+1.
- **Enums** como `enum` nativo do Postgres via `{ type: 'enum', enum: ... }` — alinhado ao Doc 02; alterações de enum entram por migration.
- **Dinheiro** como `numeric(10,2)` com transformer para evitar perda de precisão (string ↔ number controlado).
- **Soft delete** via coluna `is_active` (decisão de negócio), não o `@DeleteDateColumn`, para manter histórico explícito.

### 3.7 API REST — convenções

- Versionada sob `/api/v1`.
- Recursos no plural: `/students`, `/plans`, `/sessions`, `/receivables`, `/payables`, `/recurring-expenses`.
- DTOs validados com `class-validator`; `ValidationPipe` global com `whitelist: true`.
- Erros padronizados por exception filter (formato único `{ statusCode, message, error }`).
- Paginação e filtros por query string (ex.: `/plans?expiringInDays=30`, `/receivables?status=overdue`).
- Documentação automática via **Swagger** (`@nestjs/swagger`).

---

## 4. Frontend (React + Vite)

### 4.1 Organização

```
src/
├── main.tsx
├── app/                    # providers (Query, Auth, Router), layout
├── lib/
│   ├── firebase.ts         # init do Firebase Web SDK
│   ├── api-client.ts       # axios/fetch + injeção do Bearer token
│   └── query-client.ts
├── features/               # por domínio, espelhando o back
│   ├── auth/
│   ├── students/
│   ├── plans/
│   ├── schedule/           # agenda (dia/semana)
│   ├── drop-ins/
│   ├── financial/          # receivables + payables + recorrentes
│   └── dashboard/          # visão geral, vencimentos
├── components/             # UI compartilhada
└── routes/
```

### 4.2 Padrões

- **TanStack Query** para todo dado de servidor: cache, invalidação após mutações, estados de loading/erro padronizados.
- **Interceptor de auth:** o `api-client` pega o ID token atual do Firebase e injeta no header a cada request; renova token automaticamente (o Web SDK cuida do refresh).
- **Rotas protegidas:** um `RequireAuth` no router redireciona ao login se não houver sessão Firebase.
- **Responsividade:** layout mobile-first; a agenda precisa de atenção especial (grade de horários funcional no celular). Tabelas financeiras viram cards/listas no mobile.
- **Formulários:** React Hook Form + validação (zod) espelhando os DTOs do back.

### 4.3 Telas principais da v1

1. **Login** (e-mail/senha).
2. **Dashboard:** planos vencendo (7/30/60/90 + vencidos), contas do mês (a pagar/receber, pendentes/atrasadas).
3. **Alunos:** lista, cadastro, ficha do aluno (com histórico de planos e atendimentos).
4. **Planos:** criar plano (catálogo, horários, parcelamento), trocar horário, renovar, cancelar.
5. **Agenda:** visão dia/semana, turmas com 0–4 alunos, marcação de presença/falta, cancelar aula.
6. **Aulas avulsas:** registrar avulsa (aluno ou prospect), opcional cobrança.
7. **Financeiro:** contas a receber, contas a pagar, despesas recorrentes (cadastro das regras), baixa de pagamentos.

---

## 5. Observabilidade (PostHog — erros e alertas)

**Escopo v1:** captura de erros/exceções no front e no back, com alertas. **Não** se instrumenta analytics de uso de produto nesta versão (porta deixada aberta para o futuro, pois o mesmo SDK cobre isso quando se desejar).

### 5.1 Backend (PostHog Node SDK)
- Inicialização única do client PostHog (provider injetável), credenciais via env (`POSTHOG_API_KEY`, `POSTHOG_HOST`).
- **Ponto central de captura:** o **exception filter global** do NestJS. Toda exceção não tratada (ou ≥ 500) é enviada ao PostHog error tracking com contexto: rota, método, `user.id`/`firebase_uid`, mensagem e stack.
- Erros esperados de validação (4xx) **não** sobem como erro — são fluxo normal.
- Erros no **job de despesas recorrentes** são capturados explicitamente (falha silenciosa de cron é perigosa) e geram alerta.

### 5.2 Frontend (PostHog Web SDK)
- Inicialização no bootstrap do app, credenciais via env (`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`).
- **Error Boundary** React no topo da árvore captura erros de render e envia ao PostHog.
- Handler global para `unhandledrejection` e erros de chamadas à API (no interceptor do `api-client`) reporta falhas relevantes.

### 5.3 Alertas
- Configurar alertas no PostHog para: pico de erros, novos tipos de erro, e falha do job de geração recorrente.
- Destino dos alertas (e-mail/Slack) a definir na configuração do projeto PostHog.

### 5.4 Privacidade (regra obrigatória)
- **Nunca** enviar ao PostHog dados sensíveis: valores e detalhes financeiros, dados pessoais de alunos (telefone, e-mail, observações de saúde), conteúdo de tokens.
- Identificar usuários por `id`/`firebase_uid`, nunca por dados pessoais.
- Sanitizar payloads de erro: remover corpos de request que possam conter dados pessoais antes do envio.

### 5.5 Logging estruturado (Pino + OTLP)
Complementa o PostHog: enquanto o PostHog foca em **erros e alertas**, o Pino cobre o **fluxo de logs operacionais** (info/warn/error estruturados).

- **`nestjs-pino`** como logger padrão do NestJS. Saída **sempre em JSON** (sem pretty-print em produção).
- **Correlação:** request-id automático por requisição, propagado nos logs daquela request, facilitando rastrear um fluxo ponta a ponta.
- **Exportação OTLP:** logs exportados no padrão OpenTelemetry (OTLP), tipicamente para um **OpenTelemetry Collector**, que roteia ao backend de observabilidade. A aplicação permanece **agnóstica de destino**.
- **Destino OTLP:** a definir na infra (ex.: Grafana Loki, collector self-hosted, ou serviço gerenciado). Configurado por env (`OTEL_EXPORTER_OTLP_ENDPOINT`, etc.).
- **Mesma regra de privacidade da §5.4** vale para os logs: redigir/omitir dados sensíveis (financeiro, dados pessoais de aluno, tokens). Usar serializers do Pino para mascarar campos sensíveis automaticamente.
- **Níveis:** `info` para eventos de negócio relevantes (plano criado, geração recorrente executada), `warn` para situações recuperáveis, `error` para falhas — estas também capturadas pelo PostHog via exception filter.

---

## 6. Configuração, ambientes e deploy

### 6.1 Variáveis de ambiente (back)
- `DATABASE_URL`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account do Admin SDK)
- `PORT`, `NODE_ENV`, `TZ=America/Sao_Paulo` (importante para o cron)
- `POSTHOG_API_KEY`, `POSTHOG_HOST` (error tracking do back)
- `OTEL_EXPORTER_OTLP_ENDPOINT` e demais vars OTLP (destino dos logs estruturados; a definir)
- `LOG_LEVEL` (nível mínimo do Pino, ex.: `info`)

### 6.2 Variáveis de ambiente (front)
- `VITE_API_URL`
- `VITE_FIREBASE_*` (config do Web SDK — apiKey, authDomain, etc.)
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (error tracking do front)

### 6.3 Deploy (sugestão, a definir)
- **Banco:** Postgres gerenciado (ex.: Neon, Supabase, RDS).
- **Back:** container (Railway, Render, Fly.io) — precisa de processo persistente para o cron.
- **Front:** estático (Vercel, Netlify, Cloudflare Pages).
- **Atenção:** o agendador exige um backend **sempre ligado**; serverless puro (lambda) não serve para o `@Cron` — usar serviço com processo contínuo ou um scheduler externo chamando o endpoint manual.

---

## 7. Migrations e seed

- **Migrations TypeORM** versionadas, uma por mudança de schema. Primeira migration cria todas as tabelas do Doc 02.
- **Seed inicial:** popular `plan_catalog` com os planos oferecidos (Mensal/Trimestral/Semestral/Anual nas frequências usadas). Script de seed separado, idempotente.
- O usuário operador **não** é semeado: nasce via provisionamento JIT no primeiro login.

---

## 8. Testes (mínimo recomendado para v1)

- **Unitários** nos geradores (`scheduling/`): são a lógica mais crítica e mais fácil de testar isolada.
  - Geração de sessions cobre todo o período e bate com a frequência.
  - Regeneração preserva o passado e só recria o futuro.
  - Geração de parcelas: N parcelas, valores e vencimentos corretos.
  - Geração de payable recorrente é idempotente.
- **Integração** no `FirebaseAuthGuard` (provisionamento JIT) e nas transações de criação de plano.
- E2E pode ficar para depois.

---

## 9. Pontos em aberto / decisões de produto

1. **Biblioteca de UI** (Tailwind+shadcn vs. MUI vs. outra) — decisão de produto/estética.
2. **Hospedagem** definitiva (afeta como o cron roda — ver §6.3).
3. **Backup do Postgres** — definir rotina (provedor gerenciado normalmente cobre).
4. Internacionalização/moeda — assume-se BRL e pt-BR; sem i18n na v1.

---

## 10. Resumo das decisões técnicas travadas

- ORM: **TypeORM**, `synchronize: false`, migrations versionadas.
- Auth: **Firebase** (e-mail/senha), Admin SDK no guard, **provisionamento JIT** do `user`.
- Geração recorrente: **`@nestjs/schedule`** dia 25, idempotente, com disparo manual.
- Geradores de domínio isolados no módulo **`scheduling`** (reuso do padrão regra-mãe → ocorrências).
- Operações compostas (criar/renovar plano, trocar horário, gerar recorrentes) em **transação**.
- Front com **TanStack Query** + interceptor de token; rotas protegidas; mobile-first.
- Observabilidade com **PostHog** (erros e alertas, front e back), sem dados sensíveis.
- Logs estruturados com **Pino** (JSON) exportados via **OTLP** (OpenTelemetry), destino agnóstico.

---

## 11. Próximos passos sugeridos

1. Validar este documento.
2. (Opcional) **Documento 04 — Especificação de API**: endpoints, payloads e fluxos detalhados por módulo.
3. Inicializar os repositórios (back e front), primeira migration e o esqueleto de auth.
4. Implementar verticalmente o primeiro fluxo ponta-a-ponta (sugestão: Alunos → Planos → geração de agenda + parcelas), validando o padrão antes de replicar.
