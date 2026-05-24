# Fase 11 — Módulo `contracts` (template + assinatura digital)

## Contexto

Último pilar operacional do estúdio: o **contrato** entre estúdio e aluno, vinculado 1:1 a um `Plan`. Hoje é feito em Word/PDF + WhatsApp manual. Esta fase digitaliza o fluxo completo:

1. Estúdio edita um **template** em markdown (com headers/bold/italic/listas) uma única vez.
2. Ao gerar contrato para um plano, materializa cópia com **variáveis interpoladas** (nome do aluno, valor total, parcelas, datas, etc.).
3. Estúdio gera **link público único** e cola manualmente no WhatsApp do cliente.
4. Cliente abre o link (sem login), lê o contrato, **assina via canvas** (mouse no desktop, dedo no celular) e confirma.
5. Backend captura **evidências legais** (timestamp, IP, user-agent, geolocalização aproximada, hash SHA-256 do conteúdo) e gera **PDF assinado** arquivado.
6. Link público fica disponível por **7 dias após assinatura** com botão de download; depois disso, retorna 410 Gone. Estúdio sempre acessa o PDF pelo painel autenticado.

Segue o padrão **catálogo → materializado** já consolidado em `plans/`: `ContractTemplate` é a fonte editável; `PlanContract` é a cópia imutável após envio, com snapshot do markdown, do HTML renderizado, das variáveis resolvidas, das evidências e (após assinatura) do PDF + imagem da assinatura.

### Decisões já alinhadas com o usuário

- **PDF**: gerado via `pdfkit` (mais leve que Puppeteer; suficiente para texto + imagem da assinatura embedded).
- **Pós-7d da assinatura**: link público retorna 410 Gone; estúdio sempre acessa pelo painel interno (rota autenticada nunca expira).
- **Envio do link**: copy/paste manual do painel para WhatsApp. **Sem integração de email/WhatsApp** nesta fase.
- **Mudança de plano após assinatura**: fora de escopo (V2 decide aditivo vs novo contrato).
- **Menor de idade / assinatura de responsável**: fora de escopo. Todos assinam como adultos.
- **Edição do materializado**: permitida apenas em `draft`. Após `sent`, contrato é imutável — para corrigir, cancela e gera novo.
- **Notificação de assinatura ao estúdio**: apenas `domain_events` + badge de status no painel. Sem email.
- **Evidências coletadas**: `timestamp` da assinatura, `IP`, `user-agent`, **hash SHA-256** do HTML renderizado, **geolocalização aproximada por IP** (cidade/região via `geoip-lite` offline).

## Pré-requisitos

- Fases 0–10 concluídas. Especialmente: `Plan` materializado (Fase 5) com `Student` + `PlanCatalog`, `User` (estúdio) com nome do dono, eventos de domínio via `EventService`.
- **Firebase Storage bucket** habilitado no projeto Firebase. O `firebase-admin` já está inicializado em `apps/api/src/firebase/firebase.module.ts` — basta habilitar o serviço Storage no console e configurar `FIREBASE_STORAGE_BUCKET`.

---

## Backend

```
apps/api/src/modules/contracts/
├── contracts.module.ts
├── contracts.controller.ts                  — privado (Firebase auth)
├── public-contracts.controller.ts           — público (@Public)
├── contracts.service.ts
├── variable-resolver.service.ts             — resolve variáveis a partir de Plan + Student + User
├── markdown-renderer.service.ts             — wrapper sobre `marked`
├── pdf/
│   └── pdf-generator.service.ts             — pdfkit
├── storage/
│   ├── contract-storage.interface.ts
│   └── firebase-storage.provider.ts         — Cloud Storage for Firebase via firebase-admin
├── entities/
│   ├── contract-template.entity.ts
│   └── plan-contract.entity.ts
└── dto/
    ├── create-contract-template.dto.ts
    ├── update-contract-template.dto.ts
    ├── materialize-plan-contract.dto.ts
    ├── update-plan-contract.dto.ts
    └── sign-contract.dto.ts
```

### Entidades

**`ContractTemplate`** (tabela `contract_template`):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar | ex.: "Contrato Padrão 2026" |
| `bodyMarkdown` | text | conteúdo com `{{vars}}` |
| `version` | int | incrementa a cada `PATCH` |
| `isActive` | bool | soft delete via `DELETE` |
| `createdAt` / `updatedAt` | timestamptz | |

**`PlanContract`** (tabela `plan_contract`):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `planId` | uuid FK → plan(id), **unique** | 1:1 com Plan |
| `templateId` | uuid FK → contract_template(id) | mantido como referência histórica |
| `templateVersion` | int | snapshot da versão do template no momento do envio |
| `bodyMarkdown` | text | snapshot — imutável após `sent` |
| `resolvedVariables` | jsonb | mapa nome→valor das vars interpoladas |
| `renderedHtml` | text | snapshot HTML — base para PDF e hash |
| `contentHash` | varchar(64) nullable | SHA-256 do `renderedHtml` calculado no ato da assinatura |
| `status` | enum `plan_contract_status` | `draft` \| `sent` \| `signed` \| `cancelled` |
| `accessToken` | varchar(64) **unique**, indexado, nullable | `randomBytes(32).toString('hex')`; gerado no `send` |
| `sentAt` | timestamptz nullable | |
| `signedAt` | timestamptz nullable | |
| `cancelledAt` | timestamptz nullable | |
| `signatureImage` | text nullable | base64 PNG do canvas |
| `signedPdfPath` | varchar nullable | object key no bucket Firebase (ex.: `contracts/<id>.pdf`) |
| `signerIp` | varchar(45) nullable | suporta IPv6 |
| `signerUserAgent` | varchar(500) nullable | truncado |
| `signerGeoCity` | varchar nullable | |
| `signerGeoRegion` | varchar nullable | |
| `createdAt` / `updatedAt` | timestamptz | |

**Índices**: `(planId)` unique, `(accessToken)` unique, `(status)`.

### Variáveis suportadas

Definidas e resolvidas pelo `VariableResolverService` consultando `Plan` (com `student`, `planCatalog`, `installments` quando existirem):

| Variável | Origem |
|---|---|
| `studentName` | `plan.student.name` |
| `studentEmail` | `plan.student.email` |
| `studentPhone` | `plan.student.phone` |
| `studentCpf` | `plan.student.cpf` (se existir) |
| `planName` | `plan.planCatalog.name` |
| `modality` | `plan.planCatalog.modality` ou equivalente |
| `weeklyFrequency` | `plan.weeklyFrequency` |
| `period` | `plan.period` |
| `startDate` | `plan.startDate` formatado `dd/MM/yyyy` |
| `endDate` | `plan.endDate` formatado `dd/MM/yyyy` |
| `totalPrice` | `plan.totalPrice` formatado BRL (`R$ 2.400,00`) |
| `installmentsCount` | quantidade de receivables ligados ao plano |
| `installmentValue` | valor médio (ou primeiro) formatado BRL |
| `paymentMethod` | `plan.paymentMethod` |
| `studioOwnerName` | `User` autenticado (a dona do estúdio) |
| `studioName` | constante por enquanto (env `STUDIO_NAME`); editável no perfil em V2 |
| `todayDate` | data no fuso `America/Sao_Paulo`, `dd/MM/yyyy` |

Sintaxe no template: `{{studentName}}`. Interpolação simples por regex `/{{\s*(\w+)\s*}}/g`. No `send`, validar que todas as variáveis referenciadas no template existem no mapa resolvido — se faltar alguma, retornar **422** listando as chaves faltantes.

### Controller privado (`contracts.controller.ts`)

Todas as rotas autenticadas via guard global Firebase.

| Método | Rota | Handler |
|---|---|---|
| GET | `/contract-templates` | `listTemplates(query)` |
| POST | `/contract-templates` | `createTemplate(dto)` |
| GET | `/contract-templates/:id` | `getTemplate(id)` |
| PATCH | `/contract-templates/:id` | `updateTemplate(id, dto)` — incrementa `version` |
| DELETE | `/contract-templates/:id` | `archiveTemplate(id)` — soft delete |
| POST | `/contract-templates/:id/preview` | `previewTemplate(id, { planId? })` — renderiza HTML com vars de um plano real ou com dummies |
| POST | `/plans/:planId/contract` | `materialize(planId, { templateId })` — cria `PlanContract` em `draft` |
| GET | `/plans/:planId/contract` | `getByPlan(planId)` — detalhe completo (inclui `renderedHtml`, evidências, etc.) |
| PATCH | `/plans/:planId/contract` | `updateDraft(planId, { bodyMarkdown })` — só em `draft` (409 caso contrário) |
| POST | `/plans/:planId/contract/send` | `send(planId)` — `draft → sent`; gera `accessToken`, snapshot `renderedHtml`, retorna `{ publicUrl }` |
| POST | `/plans/:planId/contract/cancel` | `cancel(planId)` — qualquer estado exceto `signed` (409) |
| GET | `/plans/:planId/contract/pdf` | `downloadPdf(planId)` — se `signed`, faz stream do PDF arquivado no Firebase Storage; senão gera PDF preview com marca d'água "PRÉVIA" |
| GET | `/plans/:planId/contract/signature-link` | `getSignatureLink(planId)` — retorna URL pública atual (só em `sent` ou `signed` dentro de 7d) |

### Controller público (`public-contracts.controller.ts`)

Rotas decoradas com `@Public()` (skip do `FirebaseAuthGuard` via `IS_PUBLIC_KEY`). Prefixo lógico `/public/contracts` sob o `/api/v1` global.

| Método | Rota | Handler |
|---|---|---|
| GET | `/public/contracts/:token` | `view(token)` — devolve `{ renderedHtml, status, signedAt, pdfAvailable, studentName, studioName }`. Se `signed` e >7d desde `signedAt`, lança 410 Gone. |
| POST | `/public/contracts/:token/sign` | `sign(token, { signatureImage }, req)` — só em `sent`. Calcula hash, captura IP/UA/geo, gera PDF, salva no storage, transição → `signed`. Retorna `{ pdfUrl }`. |
| GET | `/public/contracts/:token/pdf` | `downloadSignedPdf(token)` — só em `signed` e ≤7d. Senão 410. **Backend faz proxy do stream do Firebase Storage** (não devolve signed URL diretamente) para preservar o controle de janela de 7d via token. |

**Rate-limit** via `@nestjs/throttler` no endpoint de `sign` (5 requests/min por token). Sem rate-limit agressivo no `view` para permitir reload normal pelo cliente.

### Service — pontos críticos

```ts
async send(planId: string, currentUser: User) {
  return this.dataSource.transaction(async (manager) => {
    const contract = await manager.findOneOrFail(PlanContract, {
      where: { planId },
      relations: ['plan', 'plan.student', 'plan.planCatalog'],
    });
    if (contract.status !== 'draft') throw new ConflictException('Contract already sent');

    const vars = await this.variableResolver.resolve(contract.plan, currentUser);
    const missing = findMissingVariables(contract.bodyMarkdown, vars);
    if (missing.length) throw new UnprocessableEntityException({ missingVariables: missing });

    const interpolatedMarkdown = interpolate(contract.bodyMarkdown, vars);
    const renderedHtml = this.markdownRenderer.toHtml(interpolatedMarkdown);

    contract.resolvedVariables = vars;
    contract.renderedHtml = renderedHtml;
    contract.accessToken = randomBytes(32).toString('hex');
    contract.templateVersion = (await manager.findOneOrFail(ContractTemplate, { where: { id: contract.templateId } })).version;
    contract.status = 'sent';
    contract.sentAt = new Date();

    await manager.save(contract);
    await this.eventService.record(manager, {
      action: 'plan_contract.sent',
      entity: 'plan_contract',
      entityId: contract.id,
      userId: currentUser.id,
      dto: { planId },
    });
    return { publicUrl: `${this.config.frontendUrl}/contrato/${contract.accessToken}` };
  });
}

async sign(token: string, signatureImage: string, req: Request) {
  return this.dataSource.transaction(async (manager) => {
    const contract = await manager.findOneOrFail(PlanContract, { where: { accessToken: token } });
    if (contract.status !== 'sent') throw new ConflictException('Contract is not awaiting signature');

    validateSignaturePng(signatureImage);  // base64 PNG; mínimo de tamanho e dimensão

    const ip = extractIp(req);
    const ua = (req.headers['user-agent'] ?? '').slice(0, 500);
    const geo = this.geoLookup(ip);  // geoip-lite, síncrono, sem network

    contract.signatureImage = signatureImage;
    contract.signerIp = ip;
    contract.signerUserAgent = ua;
    contract.signerGeoCity = geo?.city ?? null;
    contract.signerGeoRegion = geo?.region ?? null;
    contract.contentHash = sha256(contract.renderedHtml);
    contract.signedAt = new Date();
    contract.status = 'signed';

    const pdfBuffer = await this.pdfGenerator.generate(contract);
    contract.signedPdfPath = await this.storage.save(
      `contracts/${contract.id}.pdf`,
      pdfBuffer,
      'application/pdf',
    );

    await manager.save(contract);
    await this.eventService.record(manager, {
      action: 'plan_contract.signed',
      entity: 'plan_contract',
      entityId: contract.id,
      userId: null,
      dto: { ip, ua, geoCity: geo?.city, geoRegion: geo?.region, contentHash: contract.contentHash },
    });
    return { pdfUrl: `/api/v1/public/contracts/${token}/pdf` };
  });
}
```

### Acesso público pós-assinatura

```ts
const PUBLIC_ACCESS_WINDOW_DAYS = 7;

if (contract.status === 'signed' && differenceInDays(new Date(), contract.signedAt!) > PUBLIC_ACCESS_WINDOW_DAYS) {
  throw new GoneException('This link has expired');
}
```

O estúdio nunca passa por esse check — rota autenticada `/plans/:planId/contract/pdf` é eterna.

### Storage — Firebase Cloud Storage

`ContractStorageProvider` interface:

```ts
export interface ContractStorageProvider {
  save(key: string, buffer: Buffer, contentType: string): Promise<string>;  // retorna o object key persistido
  read(key: string): Promise<Buffer>;
  createReadStream(key: string): NodeJS.ReadableStream;
  delete(key: string): Promise<void>;
}
```

**Implementação**: `FirebaseStorageProvider` usa `firebase-admin/storage` — o app já é inicializado em `apps/api/src/firebase/firebase.module.ts`. Esqueleto:

```ts
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseStorageProvider implements ContractStorageProvider {
  private readonly bucket;

  constructor(config: ConfigService) {
    const bucketName = config.getOrThrow<string>('FIREBASE_STORAGE_BUCKET');
    this.bucket = admin.storage().bucket(bucketName);
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const file = this.bucket.file(key);
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0, no-store' },
    });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const [buf] = await this.bucket.file(key).download();
    return buf;
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    return this.bucket.file(key).createReadStream();
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }
}
```

**Convenções**:
- Objetos sob o prefixo `contracts/<planContractId>.pdf` — `planContractId` é UUID, então não há colisão.
- **Bucket permanece privado** (regras padrão do Firebase Storage negam leitura pública). Acesso sempre via API: rotas autenticadas para o estúdio, rota pública gated por `accessToken` + janela de 7d.
- **Não emitir signed URLs públicas**: o backend faz proxy do stream (`createReadStream`) para preservar o controle da janela de 7d e permitir revogação imediata via cancelamento. Signed URL ficaria válida fora desse controle.
- `contentType: 'application/pdf'` ao salvar; `Content-Disposition: attachment; filename="contrato-<studentName>.pdf"` no response do endpoint.
- Tratamento de erro: se `file.download()` falhar com 404, lança `NotFoundException` (objeto perdido — registrar incident em `domain_events`).

### Regras de segurança do bucket (Firebase Console)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;  // tudo passa pelo Admin SDK no backend
    }
  }
}
```

Apenas o Admin SDK (com credencial de serviço) escreve/lê. Frontend nunca acessa diretamente.

### PDF generator

`pdf-generator.service.ts` usa `pdfkit`:

- A4, margens generosas, fonte serif legível.
- **Header**: nome do estúdio (env `STUDIO_NAME`) e data.
- **Corpo**: parser simples do HTML renderizado (apenas `<h1-h3>`, `<p>`, `<strong>`, `<em>`, `<ul>/<ol>/<li>`) → comandos pdfkit. Manter renderer pequeno e tipado; rejeitar tags desconhecidas no `markdownRenderer` (sanitização).
- **Rodapé na última página**: imagem da assinatura (decode base64 PNG), nome do aluno, `signedAt` formatado, IP, cidade/região, e em fonte pequena: `Hash SHA-256: <contentHash>`. Para contrato em `draft`/preview: marca d'água diagonal "PRÉVIA" e omitir bloco de assinatura.

### Eventos de domínio

Sempre dentro da transação correspondente:

- `contract_template.created`, `contract_template.updated`, `contract_template.archived`
- `plan_contract.materialized`, `plan_contract.updated`, `plan_contract.sent`, `plan_contract.signed`, `plan_contract.cancelled`

---

## Contracts package

`packages/contracts/src/contract-template/index.ts`:

```ts
export interface ContractTemplate {
  id: string;
  name: string;
  bodyMarkdown: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractTemplateInput {
  name: string;
  bodyMarkdown: string;
}

export type UpdateContractTemplateInput = Partial<CreateContractTemplateInput> & {
  isActive?: boolean;
};

export interface ListContractTemplatesQuery {
  isActive?: boolean;
}

export interface PreviewContractTemplateInput {
  planId?: string;
}

export interface PreviewContractTemplateResponse {
  renderedHtml: string;
  resolvedVariables: Record<string, string>;
  missingVariables: string[];
}
```

`packages/contracts/src/plan-contract/index.ts`:

```ts
export type PlanContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled';

export interface PlanContract {
  id: string;
  planId: string;
  templateId: string;
  templateVersion: number;
  status: PlanContractStatus;
  sentAt: string | null;
  signedAt: string | null;
  cancelledAt: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanContractDetail extends PlanContract {
  bodyMarkdown: string;
  renderedHtml: string | null;
  resolvedVariables: Record<string, string> | null;
  signatureImage: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  signerGeoCity: string | null;
  signerGeoRegion: string | null;
  publicUrl: string | null;  // construído a partir de accessToken + FRONTEND_URL
}

export interface MaterializePlanContractInput {
  templateId: string;
}

export interface UpdatePlanContractInput {
  bodyMarkdown: string;
}

export interface SendPlanContractResponse {
  publicUrl: string;
}

export interface PublicContractView {
  renderedHtml: string;
  status: PlanContractStatus;
  signedAt: string | null;
  pdfAvailable: boolean;
  studentName: string;
  studioName: string;
}

export interface SignContractInput {
  signatureImage: string;  // base64 PNG data URL
}

export interface SignContractResponse {
  pdfUrl: string;
}
```

---

## Frontend

```
apps/web/src/features/contracts/
├── pages/
│   ├── ContractTemplatesPage.tsx         — privado: lista + CRUD de templates
│   ├── ContractTemplateEditPage.tsx      — editor markdown lado a lado com preview HTML
│   └── PublicContractSignPage.tsx        — público (sem AppLayout, sem auth) em /contrato/:token
├── components/
│   ├── MarkdownEditor.tsx                — textarea + preview via react-markdown
│   ├── ContractVariablesHelper.tsx       — chips clicáveis inserem {{var}} no cursor
│   ├── ContractPreview.tsx               — render HTML (sanitizado)
│   ├── SignatureCanvas.tsx               — canvas HTML5 com pointer events, botões Limpar/Confirmar
│   ├── ContractStatusBadge.tsx           — chip colorido por status
│   └── PlanContractSection.tsx           — bloco usado em PlanDetailPage
├── hooks/
│   ├── useContractTemplates.ts
│   ├── useContractTemplateMutations.ts   — create/update/archive/preview
│   ├── usePlanContract.ts                — query por planId
│   ├── usePlanContractMutations.ts       — materialize/updateDraft/send/cancel
│   ├── usePublicContract.ts              — fetch sem header de auth
│   └── useSignPublicContract.ts          — mutation pública
└── api/
    ├── contractTemplates.ts
    ├── planContracts.ts
    └── publicContracts.ts                — axios instance separada, SEM interceptor de Firebase token
```

### Rotas (`App.tsx`)

- **Privadas (dentro do `AppLayout`)**:
  - `/contratos/templates` → `ContractTemplatesPage`
  - `/contratos/templates/:id` → `ContractTemplateEditPage`
  - O detalhe do contrato por plano vive **dentro** do `PlanDetailPage` em uma aba/seção (`PlanContractSection`).
- **Pública (fora do `AppLayout`, sem `AuthProvider` exigindo login)**:
  - `/contrato/:token` → `PublicContractSignPage`
  - Estrutura a rota como elemento de `<Routes>` no nível raiz, antes do bloco que requer auth. Garantir que `App.tsx` permite essa rota mesmo se Firebase não inicializou (ou se o user não está logado).

### `AppLayout` (menu)

Adicionar grupo "Contratos" no menu lateral com item "Templates".

### `MarkdownEditor`

- Layout split: textarea (esquerda) + preview (direita) em telas grandes; toggle abas em telas pequenas.
- Preview via `react-markdown` + `remark-gfm`.
- `ContractVariablesHelper` no header: lista de chips com todas as variáveis suportadas — clique insere `{{var}}` na posição do cursor da textarea.

### `SignatureCanvas`

- Canvas HTML5, **sem libs externas** (`react-signature-canvas` adiciona dep desnecessária).
- Eventos `pointerdown` / `pointermove` / `pointerup` / `pointercancel` (unificam touch + mouse + caneta).
- `touch-action: none` no canvas para evitar scroll durante traçado.
- Responsivo: canvas ocupa 100% da largura disponível; `width/height` reais sincronizados via `getBoundingClientRect` (cuidado com DPR — multiplicar por `window.devicePixelRatio`).
- Botões "Limpar" (zera canvas) e "Confirmar assinatura" (gera `toDataURL('image/png')`).
- **Validação client-side**: rejeitar traçado com menos de ~50 pontos ou bounding box menor que 30×30 px ("Por favor, assine maior").

### `PublicContractSignPage` (em `/contrato/:token`)

- Fetch `GET /public/contracts/:token` no mount.
- Estados:
  - `sent` → renderiza o HTML do contrato (em container scrollável, fontes serif), checkbox obrigatório "Li e concordo com os termos acima", `SignatureCanvas`, botão "Assinar" disabled até checkbox + assinatura válida. Ao confirmar, chama `POST /public/contracts/:token/sign` e mostra tela de sucesso com botão "Baixar PDF".
  - `signed` (≤7d) → tela "Contrato assinado em DD/MM/YYYY às HH:mm" + botão "Baixar PDF".
  - 410 Gone → "Este link expirou. Entre em contato com o estúdio para receber uma nova cópia."
  - 404 → "Link inválido."
- Sem header autenticado, sem menu. Marca discreta do estúdio no topo.
- Meta viewport configurada para mobile-first.

### `PlanContractSection` (dentro de `PlanDetailPage`)

Bloco condicional pelo estado:

- **Sem contrato**: botão "Gerar contrato" → modal seleciona template ativo → cria `draft`.
- **`draft`**: `MarkdownEditor` inline com auto-save (debounce) ou botão "Salvar"; preview lateral; botão **"Enviar para assinatura"** (confirma em modal); botão "Trocar template" (recria draft preservando edições? — manter simples: recria do zero, com confirmação).
- **`sent`**: link público com botão "Copiar link" (toast "Copiado!"); status; data de envio; botão "Cancelar e refazer".
- **`signed`**: badge verde "Assinado em DD/MM/YYYY"; botão "Baixar PDF"; bloco "Evidências" expansível com IP, cidade/região, user-agent truncado, hash SHA-256.
- **`cancelled`**: bloco discreto com data de cancelamento; botão "Gerar novo".

---

## Migrations

`apps/api/src/database/migrations/<timestamp>-CreateContractsSchema.ts`:

```ts
CREATE TYPE plan_contract_status AS ENUM ('draft', 'sent', 'signed', 'cancelled');

CREATE TABLE contract_template (
  id uuid PK,
  name varchar NOT NULL,
  body_markdown text NOT NULL,
  version int NOT NULL DEFAULT 1,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plan_contract (
  id uuid PK,
  plan_id uuid NOT NULL UNIQUE REFERENCES plan(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES contract_template(id) ON DELETE RESTRICT,
  template_version int NOT NULL,
  body_markdown text NOT NULL,
  resolved_variables jsonb,
  rendered_html text,
  content_hash varchar(64),
  status plan_contract_status NOT NULL DEFAULT 'draft',
  access_token varchar(64) UNIQUE,
  sent_at timestamptz,
  signed_at timestamptz,
  cancelled_at timestamptz,
  signature_image text,
  signed_pdf_path varchar,
  signer_ip varchar(45),
  signer_user_agent varchar(500),
  signer_geo_city varchar,
  signer_geo_region varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_contract_status ON plan_contract(status);
CREATE UNIQUE INDEX idx_plan_contract_access_token ON plan_contract(access_token) WHERE access_token IS NOT NULL;
```

---

## Dependências novas

**Backend (`apps/api`):**
- `marked` (markdown → HTML, parser simples)
- `sanitize-html` (sanitização do HTML; remove tags fora do whitelist)
- `pdfkit` + `@types/pdfkit`
- `geoip-lite` (lookup IP → cidade/região offline; sem network, ~50MB de dados embedded)
- `@nestjs/throttler` (se ainda não estiver) — rate-limit no endpoint público de `sign`

**Frontend (`apps/web`):**
- `react-markdown` + `remark-gfm` (preview do editor e do contrato)
- **Nenhuma lib de canvas** — usar API HTML5 nativa

---

## Configuração

### Env

Adicionar ao `.env.example` de `apps/api`:

```
FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
FRONTEND_URL=http://localhost:5173
STUDIO_NAME=Anna Maria Studio
```

A credencial Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) já existe para autenticação e é reaproveitada para Storage — não precisa de credencial nova.

Adicionar ao `.env.example` de `apps/web`: nada novo (a URL pública vem da API).

### Setup Firebase Storage

No console Firebase do projeto:
1. Ativar **Storage** (escolher região; idealmente `southamerica-east1` para baixa latência BR).
2. Configurar regras de segurança conforme bloco acima (negar tudo via cliente — backend usa Admin SDK).
3. Copiar o nome do bucket (formato `<project-id>.appspot.com` ou similar) para a env var.

### Docker

Sem necessidade de volume para storage de contratos (PDFs vão para Firebase). Apenas Postgres precisa do volume já existente.

### Deploy

Backend continua precisando de processo persistente (Fase 9 — cron). Storage agora é **stateless do ponto de vista da máquina**: pode escalar horizontalmente e rodar em qualquer plataforma sem necessidade de disco montado.

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/contracts/contracts.module.ts`
- `apps/api/src/modules/contracts/entities/contract-template.entity.ts`
- `apps/api/src/modules/contracts/entities/plan-contract.entity.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/contracts/public-contracts.controller.ts`
- `apps/api/src/modules/contracts/variable-resolver.service.ts`
- `apps/api/src/modules/contracts/markdown-renderer.service.ts`
- `apps/api/src/modules/contracts/pdf/pdf-generator.service.ts`
- `apps/api/src/modules/contracts/storage/contract-storage.interface.ts`
- `apps/api/src/modules/contracts/storage/firebase-storage.provider.ts`
- `apps/api/src/modules/contracts/dto/*.ts`
- `apps/api/src/database/migrations/<ts>-CreateContractsSchema.ts`

**Backend modificar:**
- `apps/api/src/app.module.ts` — registrar `ContractsModule` + `ThrottlerModule.forRoot()` se ainda não estiver.
- Confirmar que o `FirebaseAuthGuard` respeita `@Public()` (lê `IS_PUBLIC_KEY` via `Reflector`).

**Contracts criar:**
- `packages/contracts/src/contract-template/index.ts`
- `packages/contracts/src/plan-contract/index.ts`

**Frontend criar:** tudo em `apps/web/src/features/contracts/` (ver árvore acima).

**Frontend modificar:**
- `apps/web/src/App.tsx` — rotas privadas `/contratos/templates*` + rota pública `/contrato/:token` fora do bloco autenticado.
- `apps/web/src/components/AppLayout.tsx` — item de menu "Contratos → Templates".
- `apps/web/src/features/plans/pages/PlanDetailPage.tsx` — embutir `PlanContractSection`.
- `apps/web/src/api/` — possivelmente uma nova instância axios para chamadas públicas (sem interceptor de token).

---

## Verificação

1. **Criar template** "Contrato Padrão" com markdown contendo `{{studentName}}`, `{{totalPrice}}`, `{{startDate}}` → salva, `version=1`.
2. **Editar template** (mudar texto) → `version=2`. Listar templates mostra a versão atualizada.
3. **Preview do template** com `planId` real → retorna HTML interpolado + lista vazia de `missingVariables`.
4. **Preview com variável inexistente** (`{{xyz}}` no template) → resposta inclui `missingVariables: ['xyz']`.
5. **Materializar contrato** num plano → cria `PlanContract` em `draft`, herda `bodyMarkdown` do template.
6. **Editar markdown do materializado** em `draft` → persiste; preview reflete.
7. **Enviar para assinatura** → status→`sent`, response traz `publicUrl` no formato `https://app/contrato/<token>`. `accessToken` persistido, `renderedHtml` snapshot salvo. Tentar `PATCH` no markdown → **409 Conflict**.
8. **Envio com variável faltando**: editar template para incluir `{{naoExiste}}`, materializar, tentar enviar → **422** com `{ missingVariables: ['naoExiste'] }`.
9. **Acessar link público em janela anônima** (sem login Firebase) → `GET /public/contracts/:token` retorna HTML + status `sent`.
10. **Assinar via mouse no desktop**: desenha no canvas, confirma → `POST /sign` aceita, status→`signed`, PDF gerado e enviado para Firebase Storage em `contracts/<id>.pdf` (verificar no console Firebase ou via `gcloud storage ls`), response traz `pdfUrl`.
11. **Assinar via touch no celular** (DevTools mobile emulation ou device real) → mesmo resultado.
12. **Hash imutável**: alterar manualmente `rendered_html` no DB após assinatura → `sha256` calculado agora difere do `content_hash` salvo (prova de adulteração).
13. **Reacessar link público dentro de 7d após assinar** → mostra "Assinado", botão "Baixar PDF" funciona.
14. **Manipular `signed_at` para 8d atrás no DB** → `GET /public/contracts/:token` retorna **410 Gone**; tela pública mostra "Link expirou". Estúdio ainda consegue baixar PDF em `/plans/:planId/contract/pdf`.
15. **Cancelar `sent`** → status→`cancelled`, link público retorna 410. Gerar novo contrato no mesmo plano funciona.
16. **Tentar cancelar `signed`** → **409 Conflict**.
17. **Rate-limit**: 6 POSTs em `/public/contracts/:token/sign` em 1 min → 6º retorna **429**.
18. **Geo lookup**: testar com IP brasileiro conhecido (mockando ou via header `x-forwarded-for`) → `signer_geo_city` e `signer_geo_region` populados. Com IP inválido/local → nulos sem erro.
19. **PDF inspecionado**: contém nome do estúdio no header, corpo do contrato renderizado, imagem da assinatura, nome do aluno, data/hora, IP, cidade, hash. Em `draft`/preview: marca d'água "PRÉVIA", sem bloco de assinatura.
20. **Domain events**: após cada transição, `domain_events` tem registro correspondente com payload esperado.
21. **Acesso público com token inválido** → 404.
22. **Tentar `POST /public/contracts/:token/sign` em status `signed`** → 409.
23. **Acesso direto ao bucket**: tentar acessar o objeto via URL pública do GCS sem token → 403 (regras negam). Confirma que toda leitura passa pelo backend.
24. **Objeto perdido**: deletar manualmente o PDF do bucket e tentar baixar via API → 404 + evento `plan_contract.pdf_missing` registrado em `domain_events`.

---

## Fora de escopo (V2)

- Envio automático por email/WhatsApp.
- Aluno menor de idade com assinatura de responsável (e/ou dupla assinatura).
- Aditivo/distrato quando o plano muda após a assinatura.
- Storage alternativo (S3/R2) — Firebase Storage atende V1; trocar é trivial com a interface `ContractStorageProvider`.
- Assinatura em duas vias (cliente + estúdio).
- Cadeia/timestamping criptográfico externo (RFC 3161 / blockchain) — SHA-256 simples atende a necessidade atual.
- Editor markdown WYSIWYG (toolbar com botões de negrito/itálico/etc.). A V1 é textarea + preview.
- Versionamento histórico de templates com diff entre versões.

## Próxima fase

Esta é, por enquanto, a **última fase do roadmap operacional**. Próximos passos provavelmente envolvem polimento, métricas no dashboard incluindo contratos pendentes de assinatura, e/ou os itens marcados como V2 acima.
