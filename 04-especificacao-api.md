# Sistema de Gestão para Studio de Pilates
## Documento 04 — Especificação de API (v1)

> **Status:** rascunho para revisão
> **Base:** Documentos 01 (Requisitos), 02 (Modelo de Dados), 03 (Arquitetura)
> **Base URL:** `/api/v1`
> **Formato:** JSON. Datas em ISO 8601. Dinheiro como string decimal (ex.: `"249.90"`).

---

## 1. Convenções gerais

### 1.1 Autenticação
- Todas as rotas exigem `Authorization: Bearer <firebaseIdToken>`, exceto as marcadas como **público**.
- O `FirebaseAuthGuard` valida o token e faz o provisionamento JIT do `user` (Doc 03 §3.3).

### 1.2 Formato de erro
```json
{ "statusCode": 422, "error": "Unprocessable Entity", "message": "Turma cheia para o horário selecionado" }
```

### 1.3 Paginação
Listagens aceitam `?page=1&pageSize=20`. Resposta:
```json
{ "data": [ /* ... */ ], "page": 1, "pageSize": 20, "total": 137 }
```

### 1.4 Status derivado "atrasado"
`receivable` e `payable` não armazenam "atrasado". A API expõe um campo calculado `isOverdue` (`status='pending' AND dueDate < hoje`) e aceita filtro `?status=overdue`.

### 1.5 Enums (referência)
- `period`: `monthly` | `quarterly` | `semiannual` | `annual`
- `paymentMethod`: `cash` | `pix` | `card` | `boleto`
- `planStatus`: `active` | `finished` | `cancelled`
- `sessionStatus`: `scheduled` | `present` | `absence_notified` | `absence_unnotified` | `cancelled`
- `sessionOrigin`: `plan` | `drop_in`
- `receivableSource`: `plan` | `drop_in` | `manual`
- `payableSource`: `recurring` | `manual`
- `lancamentoStatus`: `pending` | `paid`
- `userRole`: `operator` (v1)

---

## 2. Auth & sessão

| Método | Rota | Descrição |
|---|---|---|
| GET | `/auth/me` | Retorna o `user` do token (cria via JIT se for o 1º acesso) |

`GET /auth/me` → `200`:
```json
{ "id": "uuid", "firebaseUid": "abc", "email": "dono@studio.com", "role": "operator", "isActive": true }
```
> O login (e-mail/senha) acontece no **front, contra o Firebase**. A API não tem endpoint de login/logout; apenas valida tokens.

---

## 3. Alunos (`/students`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/students` | Lista; filtros `?search=&isActive=` |
| POST | `/students` | Cria aluno |
| GET | `/students/:id` | Detalha aluno |
| PATCH | `/students/:id` | Atualiza |
| DELETE | `/students/:id` | Arquiva (soft delete → `isActive=false`) |
| GET | `/students/:id/plans` | Planos do aluno (histórico) |
| GET | `/students/:id/sessions` | Atendimentos do aluno; filtros de data |

**POST `/students`** (body):
```json
{ "fullName": "Maria Silva", "phone": "+55...", "email": "m@x.com", "birthDate": "1990-05-10", "notes": "Lombalgia" }
```

---

## 4. Catálogo de planos (`/plan-catalog`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/plan-catalog` | Lista tipos de plano; filtro `?isActive=` |
| POST | `/plan-catalog` | Cria tipo de plano |
| PATCH | `/plan-catalog/:id` | Atualiza (não afeta planos já contratados) |
| DELETE | `/plan-catalog/:id` | Desativa (`isActive=false`) |

**POST** (body):
```json
{ "name": "Trimestral 2x", "period": "quarterly", "weeklyFrequency": 2, "basePrice": "450.00" }
```
> `durationMonths` é derivado de `period` no servidor.

---

## 5. Planos contratados (`/plans`)

O recurso mais complexo: criar um plano dispara, **em uma transação**, a geração de horários, atendimentos e parcelas (Doc 03 §3.5).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/plans` | Lista; filtros abaixo |
| POST | `/plans` | Cria plano + gera agenda + gera parcelas |
| GET | `/plans/:id` | Detalha (com schedules, resumo de sessions e parcelas) |
| PATCH | `/plans/:id` | Atualiza campos simples (notes, status) |
| POST | `/plans/:id/change-schedule` | Troca de horários (preserva passado, regenera futuro) |
| POST | `/plans/:id/renew` | Cria novo ciclo a partir deste |
| POST | `/plans/:id/cancel` | Cancela o plano |

### 5.1 Filtros de listagem
- `?expiringInDays=7|30|60|90` — planos com `endDate <= hoje + N` **incluindo vencidos** (Doc 01 §4.6).
- `?status=active|finished|cancelled`
- `?studentId=`

### 5.2 POST `/plans` (criação)
```json
{
  "studentId": "uuid",
  "planCatalogId": "uuid",
  "startDate": "2026-06-01",
  "totalPrice": "450.00",
  "schedules": [
    { "weekday": 1, "startTime": "17:00" },
    { "weekday": 4, "startTime": "18:30" }
  ],
  "installments": [
    { "amount": "150.00", "dueDate": "2026-06-10", "paymentMethod": "pix", "status": "paid", "paidAt": "2026-06-01" },
    { "amount": "150.00", "dueDate": "2026-07-10", "paymentMethod": "pix" },
    { "amount": "150.00", "dueDate": "2026-08-10", "paymentMethod": "pix" }
  ],
  "notes": ""
}
```
> **Parcelas vêm montadas do front (transparência).** O front calcula uma sugestão (total ÷ nº parcelas, periodicidade mensal a partir de uma data de 1ª parcela escolhida), exibe ao operador para conferência/ajuste, e envia o array final. Vencimento das parcelas é **independente** da `startDate`. Cada parcela pode já vir **paga** (caso comum: 1ª parcela quitada no ato).
> **`totalPrice` é definido pelo operador.** O `basePrice` do catálogo apenas pré-preenche o campo na tela; o operador pode alterá-lo livremente (descontos, campanhas). A API grava o valor recebido como o preço efetivo do plano.

**Validações:**
- `schedules.length` deve ser igual ao `weeklyFrequency` do catálogo.
- Cada `(weekday, startTime)` deve ter < 4 alunos no período (capacidade da turma). Se cheio → `422` com a turma conflitante.
- `installments.length >= 1`.
- **Soma das parcelas = `totalPrice`** (tolerância de centavos para arredondamento). Se não fechar → `422`. O resíduo de arredondamento, por convenção do front, fica na **última** parcela.
- Parcela com `status='paid'` deve trazer `paidAt` (e idealmente `paymentMethod`).

**Efeitos (transação):**
1. Cria `plan` (snapshot de `period`, `weeklyFrequency`, `endDate` calculado).
2. Cria `plan_schedule` (uma por item).
3. Gera todos os `session` de `startDate` a `endDate` (inclusive feriados — Doc 01 §4.4).
4. Persiste os `receivable` exatamente como recebidos (valor, vencimento, método, e status/paidAt quando pago). O backend **não recalcula** valores — apenas valida a soma.

**Resposta `201`** inclui o plano e um resumo:
```json
{ "id": "uuid", "...": "...", "generated": { "sessions": 26, "receivables": 3 } }
```

### 5.3 POST `/plans/:id/change-schedule`
```json
{ "schedules": [ { "weekday": 2, "startTime": "07:00" }, { "weekday": 5, "startTime": "07:00" } ] }
```
**Efeitos (transação) (Doc 01 §4.5, Doc 02 §3.4–3.5):**
1. Preserva `session` passados (`scheduledAt < agora`).
2. Apaga `session` futuros do plano.
3. Substitui as linhas de `plan_schedule`.
4. Regenera `session` futuros até `endDate`, validando capacidade.

Resposta inclui `{ "removedFutureSessions": N, "createdSessions": M }`.

### 5.4 POST `/plans/:id/renew`
```json
{
  "startDate": "2026-09-01",
  "totalPrice": "450.00",
  "keepSchedules": true,
  "installments": [
    { "amount": "150.00", "dueDate": "2026-09-10", "paymentMethod": "pix" },
    { "amount": "150.00", "dueDate": "2026-10-10", "paymentMethod": "pix" },
    { "amount": "150.00", "dueDate": "2026-11-10", "paymentMethod": "pix" }
  ]
}
```
- Cria um **novo** `plan` (não altera o atual; opcionalmente marca o antigo como `finished`).
- `keepSchedules=true` reaproveita os horários do ciclo anterior (validando capacidade no novo período).
- Parcelas montadas no front e validadas pela mesma regra de soma da criação (§5.2). Geração de sessions idêntica.

### 5.5 POST `/plans/:id/cancel`
```json
{ "reason": "Mudança de cidade", "cancelFutureSessions": true }
```
- `status='cancelled'`.
- `cancelFutureSessions=true` marca os `session` futuros como `cancelled` (passado intacto).
- **Parcelas:** não mexe automaticamente nos `receivable` — a baixa/estorno é decisão manual do operador (evita efeito financeiro silencioso). A resposta lista as parcelas pendentes para o operador decidir.

---

## 6. Agenda / Atendimentos (`/sessions`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/sessions` | Agenda; filtros `?date=`, `?from=&to=`, `?studentId=` |
| GET | `/sessions/calendar` | Visão agregada por turma (dia/hora com ocupação) |
| PATCH | `/sessions/:id` | Atualiza status (presença/falta) e notes |
| POST | `/sessions/:id/cancel` | Cancela um atendimento (ex.: feriado) |

### 6.1 GET `/sessions/calendar?from=2026-06-01&to=2026-06-07`
Retorna turmas agrupadas por `(date, startTime)` com ocupação:
```json
{
  "slots": [
    {
      "date": "2026-06-01", "startTime": "17:00", "capacity": 4, "occupied": 3,
      "sessions": [
        { "id": "uuid", "studentId": "uuid", "studentName": "Maria", "status": "scheduled", "origin": "plan" }
      ]
    }
  ]
}
```

### 6.2 PATCH `/sessions/:id` (marcar presença/falta)
```json
{ "status": "absence_notified", "notes": "Avisou por WhatsApp" }
```
- Valores aceitos: `present` | `absence_notified` | `absence_unnotified` | `scheduled`.
- Sem lógica de reposição na v1 (Doc 01 §5.1).

---

## 7. Aulas avulsas (`/drop-ins`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/drop-ins` | Lista avulsas |
| POST | `/drop-ins` | Registra avulsa (cria session origin=drop_in) |
| PATCH | `/drop-ins/:id` | Atualiza |
| DELETE | `/drop-ins/:id` | Remove (cancela o session associado) |

**POST** (body):
```json
{
  "studentId": "uuid | null",
  "prospectName": "João (experimental)",
  "scheduledAt": "2026-06-03T07:00:00-03:00",
  "charge": { "amount": "60.00", "dueDate": "2026-06-03", "paymentMethod": "pix" }
}
```
**Efeitos:**
- Cria `session` com `origin='drop_in'`, validando capacidade da turma (máx. 4).
- Cria `drop_in_class` (com `studentId` **ou** `prospectName`).
- Se `charge` presente, cria `receivable` (`source='drop_in'`) e vincula em `drop_in_class.receivableId`.

---

## 8. Contas a receber (`/receivables`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/receivables` | Lista; filtros abaixo |
| POST | `/receivables` | Cria lançamento manual (`source='manual'`) |
| GET | `/receivables/:id` | Detalha |
| PATCH | `/receivables/:id` | Edita valor/vencimento/método (incl. parcela de plano) |
| POST | `/receivables/:id/pay` | Dá baixa (marca pago) |
| POST | `/receivables/:id/unpay` | Estorna baixa (volta a pendente) |

**Filtros:** `?status=pending|paid|overdue`, `?from=&to=` (por `dueDate`), `?planId=`, `?source=`.

**POST `/receivables/:id/pay`:**
```json
{ "paidAt": "2026-06-05", "paymentMethod": "cash" }
```
→ `status='paid'`, grava `paidAt` e o método efetivo.

**POST `/receivables` (manual):**
```json
{ "description": "Venda de faixa elástica", "amount": "40.00", "dueDate": "2026-06-10", "paymentMethod": "pix" }
```

---

## 9. Contas a pagar (`/payables`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/payables` | Lista; filtros abaixo |
| POST | `/payables` | Cria lançamento manual (`source='manual'`) |
| GET | `/payables/:id` | Detalha |
| PATCH | `/payables/:id` | Edita (incl. valor de lançamento gerado por recorrente) |
| POST | `/payables/:id/pay` | Dá baixa |
| POST | `/payables/:id/unpay` | Estorna |

**Filtros:** `?status=pending|paid|overdue`, `?from=&to=`, `?recurringExpenseId=`, `?source=`, `?competenceMonth=YYYY-MM`.

**POST** (manual):
```json
{ "description": "Material de limpeza", "category": "Insumos", "amount": "120.00", "dueDate": "2026-06-15" }
```

---

## 10. Despesas recorrentes (`/recurring-expenses`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/recurring-expenses` | Lista regras; filtro `?isActive=` |
| POST | `/recurring-expenses` | Cria regra |
| PATCH | `/recurring-expenses/:id` | Atualiza (não afeta lançamentos já gerados) |
| DELETE | `/recurring-expenses/:id` | Desativa (`isActive=false`) |
| POST | `/recurring-expenses/run-generation` | **Disparo manual** da geração mensal |

**POST** (body):
```json
{ "description": "Aluguel", "category": "Fixos", "expectedAmount": "2500.00", "dueDay": 10 }
```
- `dueDay` validado em **1–28** (Doc 02).

**POST `/recurring-expenses/run-generation`** (rede de segurança — Doc 01 §7.1):
```json
{ "month": "2026-07" }
```
- Gera os `payable` do mês informado para todas as regras ativas.
- **Idempotente:** não duplica se já gerado (índice único `(recurringExpenseId, competenceMonth)`).
- O job automático de dia 25 chama exatamente esta mesma rotina para `M+1`.
- Resposta: `{ "created": 4, "skipped": 1 }`.

---

## 11. Dashboard (`/dashboard`)

Endpoint(s) de leitura agregada para a tela inicial.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/dashboard/summary` | Indicadores da visão geral |

**GET `/dashboard/summary`** → exemplo:
```json
{
  "plansExpiring": { "in7": 2, "in30": 5, "in60": 9, "in90": 12, "overdue": 1 },
  "receivables": { "pendingMonth": "1840.00", "overdue": "300.00", "paidMonth": "3120.00" },
  "payables": { "pendingMonth": "2620.00", "overdue": "0.00" },
  "todaySessions": 14
}
```
> Todos os valores derivados por consulta; nada de status "atrasado" persistido.

---

## 12. Resumo de fluxos compostos (transacionais)

Pontos onde múltiplas tabelas mudam atomicamente (Doc 03 §3.5):

1. **Criar plano** → `plan` + `plan_schedule[]` + `session[]` (gerados) + `receivable[]` (persistidos como recebidos do front, validada a soma).
2. **Trocar horário** → apaga `session` futuros + recria `plan_schedule[]` + regenera `session` futuros.
3. **Renovar** → novo `plan` + (opcional) finaliza o antigo + nova geração.
4. **Registrar avulsa com cobrança** → `session` + `drop_in_class` + `receivable`.
5. **Geração recorrente** (job ou manual) → `payable[]` idempotente por competência.

---

## 13. Pontos em aberto

1. Confirmar se o cancelamento de plano deve **sugerir** baixa/estorno de parcelas futuras ou apenas listá-las (atual: apenas lista, decisão manual).
2. Definir se `GET /sessions/calendar` cobre também slots **vazios** (turmas sem ninguém) ou só os ocupados — afeta a UX da agenda.
3. Política de edição de `session` passado: bloquear edição de status após X dias? (atual: sem bloqueio temporal, passado é só imutável quanto à regeneração).
4. Necessidade de endpoint de relatórios financeiros (export CSV) — candidato a v1.1.

---

## 14. Encerramento do planejamento

Com os documentos 01–04, o planejamento da v1 está completo: requisitos, modelo de dados, arquitetura e contrato de API. Próximo passo natural é a **implementação**, sugerida em fatia vertical:

1. Esqueleto NestJS + `FirebaseAuthGuard` + provisionamento JIT + `/auth/me`.
2. Primeira migration (todas as tabelas) + seed do `plan-catalog`.
3. Módulo `scheduling` (geradores) com testes unitários.
4. Fluxo vertical Alunos → Planos (criação com geração) → Agenda, validando o padrão antes de replicar para o financeiro.
