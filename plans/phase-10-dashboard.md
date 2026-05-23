# Fase 10 — Dashboard

## Contexto

A tela inicial do operador. Consolida indicadores operacionais e financeiros derivados de tudo que foi implementado nas fases anteriores. Tudo é **leitura agregada** — nenhum dado é armazenado, tudo deriva por query (alinhado com o princípio "atrasado é derivado" da Doc 02 §4.3).

Referências: Doc 04 §11.

Indicadores principais:
- **Planos vencendo** nos próximos 7, 30, 60, 90 dias + já vencidos.
- **Receivables** do mês corrente: pendentes, atrasados, já pagos.
- **Payables** do mês corrente: pendentes, atrasados.
- **Sessions de hoje**: contagem total.

Cada indicador é **clicável** e navega para a lista correspondente com filtro pré-aplicado.

## Pré-requisitos

- Fases 0–9 concluídas. Todos os módulos operam e têm dados de exemplo (planos, sessions, receivables, payables).

---

## Backend

```
apps/api/src/modules/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts
└── dashboard.service.ts
```

Não há entity nem DTO de input — só resposta. O módulo importa repositórios das entities relevantes (Plan, Receivable, Payable, Session) via `TypeOrmModule.forFeature`.

### Controller

| Método | Rota |
|---|---|
| GET | `/dashboard/summary` |

### `GET /dashboard/summary`

Service executa as queries (idealmente em paralelo via `Promise.all`):

```ts
async getSummary() {
  const today = startOfToday(SP);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [
    plansExpiring,
    receivables,
    payables,
    todaySessions,
  ] = await Promise.all([
    this.queryPlansExpiring(today),
    this.queryReceivables(today, monthStart, monthEnd),
    this.queryPayables(today, monthStart, monthEnd),
    this.queryTodaySessions(today),
  ]);

  return { plansExpiring, receivables, payables, todaySessions };
}
```

#### Plans expiring

Cinco contagens, uma query por bucket (ou uma só com `FILTER` clauses):

```sql
SELECT
  COUNT(*) FILTER (WHERE end_date < :today AND status = 'active')                                     AS overdue,
  COUNT(*) FILTER (WHERE end_date BETWEEN :today AND :today + INTERVAL '7 days' AND status = 'active') AS in7,
  COUNT(*) FILTER (WHERE end_date BETWEEN :today AND :today + INTERVAL '30 days' AND status = 'active') AS in30,
  COUNT(*) FILTER (WHERE end_date BETWEEN :today AND :today + INTERVAL '60 days' AND status = 'active') AS in60,
  COUNT(*) FILTER (WHERE end_date BETWEEN :today AND :today + INTERVAL '90 days' AND status = 'active') AS in90
FROM plan;
```

Observação: in30 inclui in7, etc. (são buckets cumulativos, ver Doc 04 §11). Confirmar com operador — recomendar **cumulativo** (alinhado com filtro `?expiringInDays=N` do Doc 04 §5.1).

#### Receivables do mês

```sql
SELECT
  COALESCE(SUM(amount) FILTER (WHERE status='pending' AND due_date BETWEEN :monthStart AND :monthEnd), 0)::numeric(10,2) AS pendingMonth,
  COALESCE(SUM(amount) FILTER (WHERE status='pending' AND due_date < :today), 0)::numeric(10,2) AS overdue,
  COALESCE(SUM(amount) FILTER (WHERE status='paid' AND paid_at BETWEEN :monthStart AND :monthEnd), 0)::numeric(10,2) AS paidMonth
FROM receivable;
```

- `pendingMonth` — pendentes a vencer dentro do mês corrente (incluindo já atrasadas? **Decisão recomendada:** incluir tudo `pending` com `due_date` no mês — alinha com expectativa do operador). Reavaliar com operador.
- `overdue` — soma de `pending` cujo `due_date < hoje` (não limitado ao mês).
- `paidMonth` — soma das que foram **pagas** dentro do mês (independente do vencimento; baseado em `paid_at`).

#### Payables do mês

```sql
SELECT
  COALESCE(SUM(amount) FILTER (WHERE status='pending' AND due_date BETWEEN :monthStart AND :monthEnd), 0)::numeric(10,2) AS pendingMonth,
  COALESCE(SUM(amount) FILTER (WHERE status='pending' AND due_date < :today), 0)::numeric(10,2) AS overdue
FROM payable;
```

#### Sessions de hoje

```sql
SELECT COUNT(*) AS count
FROM session
WHERE scheduled_at >= :todayStart
  AND scheduled_at < :tomorrowStart
  AND status <> 'cancelled';
```

Usar `America/Sao_Paulo` para limites do dia.

### Resposta (Doc 04 §11)

```json
{
  "plansExpiring": { "in7": 2, "in30": 5, "in60": 9, "in90": 12, "overdue": 1 },
  "receivables": { "pendingMonth": "1840.00", "overdue": "300.00", "paidMonth": "3120.00" },
  "payables": { "pendingMonth": "2620.00", "overdue": "0.00" },
  "todaySessions": 14
}
```

Valores monetários como string `'X.YY'` (mesma convenção do resto da API).

---

## Contracts

`packages/contracts/src/dashboard/index.ts`:

```ts
export interface DashboardSummary {
  plansExpiring: {
    in7: number;
    in30: number;
    in60: number;
    in90: number;
    overdue: number;
  };
  receivables: {
    pendingMonth: string;
    overdue: string;
    paidMonth: string;
  };
  payables: {
    pendingMonth: string;
    overdue: string;
  };
  todaySessions: number;
}
```

Adicionar ao reexport do `packages/contracts/src/index.ts`.

---

## Frontend

```
apps/web/src/features/dashboard/
├── api/dashboard.ts
├── hooks/useDashboardSummary.ts
├── pages/DashboardPage.tsx       — substitui o atual stub
└── components/
    ├── PlansExpiringCard.tsx
    ├── FinancialMonthCard.tsx
    ├── TodaySessionsCard.tsx
    └── DashboardSkeleton.tsx
```

### `DashboardPage`

Layout em grid responsivo (MUI `Grid`):
- Desktop: 2 colunas × 2 linhas (4 cards principais).
- Mobile: 1 coluna empilhada.

Cards:
1. **Planos vencendo** (`PlansExpiringCard`):
   - 5 mini-indicadores: "Vencidos", "7 dias", "30 dias", "60 dias", "90 dias".
   - Cada um clicável → navega para `/plans?expiringInDays=N` (ou `?status=active&endDateBefore=today` para vencidos).
2. **A receber no mês** (`FinancialMonthCard` variante "receivables"):
   - "Pendentes: R$ 1.840,00", "Atrasadas: R$ 300,00" (em vermelho se > 0), "Recebidas: R$ 3.120,00".
   - Clicáveis → `/financeiro/receber?status=...`.
3. **A pagar no mês** (`FinancialMonthCard` variante "payables"):
   - "Pendentes", "Atrasadas".
   - Clicáveis → `/financeiro/pagar?status=...`.
4. **Aulas de hoje** (`TodaySessionsCard`):
   - "14 aulas hoje" — clicável → `/agenda/dia/today`.

### Hook

```ts
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
    refetchInterval: 60_000,  // atualiza a cada minuto
    refetchOnWindowFocus: true,
  });
}
```

### Loading / Error

- `DashboardSkeleton` enquanto carrega (placeholder de cards).
- Erro: card global "Não foi possível carregar o resumo. Tentar novamente." com retry.

### Header

- Saudação ao operador: "Bom dia, [nome do operador]" baseado em `useAuth().user.email` (ou `name` se a fase 0 mantiver algum campo de nome — checar). Hora dinâmica BRT.
- Botão "Ir para agenda" como atalho proeminente.

---

## Arquivos críticos

**Backend criar:**
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`

**Backend modificar:**
- `apps/api/src/app.module.ts` — importar `DashboardModule`.

**Contracts criar:**
- `packages/contracts/src/dashboard/index.ts` + reexport.

**Frontend modificar/criar:**
- `apps/web/src/features/dashboard/` — estrutura completa.
- `apps/web/src/pages/DashboardPage.tsx` existente do template → substituir pelo novo (ou movê-lo para `features/dashboard/pages/`).
- `apps/web/src/App.tsx` — rota raiz `/` aponta para o novo `DashboardPage`.

## Verificação

1. **Setup de dados de teste** (idealmente via seed ou via UI):
   - 3 planos: 1 vencendo em 5 dias, 1 em 25 dias, 1 já vencido.
   - 5 receivables: 2 pendentes do mês (R$ 200 + R$ 150), 1 atrasada (R$ 300, vencimento mês anterior), 2 pagas (R$ 100 + R$ 250 com `paid_at` no mês).
   - 2 payables: 1 pendente do mês (R$ 2.500), 0 atrasados.
   - 4 sessions hoje (`status=scheduled`).
2. `GET /api/v1/dashboard/summary` retorna:
   ```json
   {
     "plansExpiring": { "in7": 1, "in30": 2, "in60": 2, "in90": 2, "overdue": 1 },
     "receivables": { "pendingMonth": "350.00", "overdue": "300.00", "paidMonth": "350.00" },
     "payables": { "pendingMonth": "2500.00", "overdue": "0.00" },
     "todaySessions": 4
   }
   ```
3. **UI**: dashboard mostra os cards com esses números.
4. **Clicar em "30 dias"** navega para `/plans?expiringInDays=30` e a lista mostra os 2 planos certos.
5. **Clicar em "Atrasadas"** (receivables) navega para `/financeiro/receber?status=overdue` mostrando a parcela de R$ 300.
6. **Clicar em "Aulas de hoje"** navega para a visão diária da agenda.
7. **Refresh automático**: aguardar 60s, dashboard re-fetch (verificar via DevTools network tab).
8. **Erro forçado** (kill backend) → card de erro com retry funciona ao restaurar.

## Conclusão da v1

Após esta fase, a v1 do sistema está **completa**. Próximos passos (fora de escopo deste plano, mas registrados em Doc 01 §8):

1. **Testes de integração** — `FirebaseAuthGuard` + transação de criação de plano + ciclo completo de geração recorrente.
2. **Deploy** (Doc 03 §6.3) — Postgres gerenciado, backend persistente (com cron), front estático, env vars todas configuradas.
3. **Backup** do Postgres configurado.
4. **Alertas PostHog** revisados (picos de erro, falha do cron).
5. **Verificação fim-a-fim manual** documentada no plano-mestre `read-the-new-files-rustling-duckling.md`.

A partir daqui, os candidatos a **v1.1+** (Doc 01 §8) entram em discussão: reposição de faltas, acesso de alunos/professores, integração de cobrança, feriados automáticos, multiunidade, app nativo.
