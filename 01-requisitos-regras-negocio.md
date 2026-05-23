# Sistema de Gestão para Studio de Pilates
## Documento 01 — Requisitos e Regras de Negócio (v1)

> **Status:** rascunho para revisão
> **Escopo:** versão 1 (MVP operacional)
> **Fonte de verdade:** este documento. Modelo de dados e arquitetura derivam dele.

---

## 1. Visão geral

Sistema web (responsivo) para o dono do studio gerir alunos, planos, agenda de aulas e o financeiro (contas a pagar e a receber). O objetivo da v1 é substituir o controle manual (planilha/papel) por uma ferramenta confiável de operação diária.

**Usuário da v1:** apenas o dono/operador (perfil único, acesso total). Acesso de professores e de alunos fica fora desta versão, mas o modelo deve ser desenhado sem impedir sua entrada futura.

**Plataforma:** aplicação web responsiva, utilizável em desktop e celular. Aplicativo nativo não está no escopo.

---

## 2. Glossário

- **Aluno:** pessoa que frequenta o studio.
- **Plano:** contrato de um aluno por um período (mensal, trimestral, semestral ou anual) com uma frequência semanal fixa.
- **Frequência:** número de aulas por semana (ex.: 2x). Cada aula semanal ocupa um **horário fixo**.
- **Horário fixo:** combinação de dia da semana + hora (ex.: segunda 17:00) que o aluno ocupa enquanto o plano vigorar.
- **Atendimento (ocorrência):** uma aula concreta, em uma data específica, na qual se registra presença ou falta. É a "materialização" de um horário fixo em uma data real.
- **Turma / slot:** o conjunto de alunos agendados num mesmo dia e hora. Capacidade máxima de 4 alunos.
- **Aula avulsa:** aula pontual fora de plano, tipicamente a primeira aula (experimental) de um aluno. Não ocupa horário fixo recorrente.
- **Lançamento financeiro:** um registro em contas a receber ou a pagar, com valor, vencimento e status.
- **Parcela:** cada lançamento a receber gerado por um plano parcelado (ex.: semestral em 6x = 6 parcelas).
- **Despesa recorrente:** regra de despesa que se repete mensalmente (ex.: aluguel) e que o sistema usa para gerar automaticamente os lançamentos a pagar de cada mês.

---

## 3. Entidades principais (visão de negócio)

Apenas a descrição conceitual; a modelagem de dados detalhada vem no Documento 02.

1. **Aluno** — dados cadastrais e de contato.
2. **Plano** — vínculo do aluno com um período, frequência, valor e horários fixos. Gera atendimentos e lançamentos a receber.
3. **Horário fixo do plano** — os dias/horas semanais escolhidos.
4. **Atendimento** — cada aula concreta gerada a partir dos horários fixos, com status de presença.
5. **Aula avulsa** — aula pontual fora de plano.
6. **Lançamento a receber** — parcelas de planos, aulas avulsas ou lançamentos manuais.
7. **Lançamento a pagar** — todas as despesas do studio.
8. **Despesa recorrente** — regra que gera automaticamente lançamentos a pagar mensais (ex.: aluguel, energia).

---

## 4. Regras de negócio — Planos

### 4.1 Tipos de plano (período)
O plano tem uma duração contratada, escolhida no momento da criação:

| Período | Duração |
|---|---|
| Mensal | 1 mês |
| Trimestral | 3 meses |
| Semestral | 6 meses |
| Anual | 12 meses |

A duração define a **data de início** e a **data de término** do plano, e portanto até quando os atendimentos são gerados.

**Preço é uma base, não uma regra.** O catálogo de planos serve apenas como **referência/sugestão** de preço. No momento da criação do plano, o operador pode **alterar livremente o valor**, manualmente e sem qualquer cálculo automático — para cobrir campanhas, descontos pontuais ou negociações. O valor efetivo é gravado no próprio plano (snapshot) e não depende do catálogo.

### 4.2 Frequência e horários fixos
- O plano tem uma frequência semanal (ex.: 1x, 2x, 3x...).
- A quantidade de horários fixos é **igual à frequência**. Plano 2x/semana → exatamente 2 horários fixos.
- Cada horário fixo é um par (dia da semana, hora). Ex.: segunda 17:00 e quinta 18:30.
- Os horários são definidos na criação do plano.

### 4.3 Capacidade da turma
- Cada combinação de dia + hora comporta no máximo **4 alunos**.
- Ao definir um horário fixo, o sistema deve impedir alocar um aluno em um horário que já tenha 4 alunos naquele dia/hora.

### 4.4 Geração de atendimentos
- Na **criação do plano**, o sistema gera **todos os atendimentos** do período contratado, com base nos horários fixos.
  - Ex.: plano trimestral 2x/semana → ~26 atendimentos (13 semanas × 2).
- Cada atendimento nasce com status "agendado".
- **Feriados (v1):** os atendimentos são gerados mecanicamente, inclusive em datas de feriado. O operador cancela manualmente o atendimento de um dia sem aula. Tratamento automático de feriados fica para depois.

### 4.5 Alteração de horário durante o plano
- O aluno pode solicitar mudança de dias/horários no meio do plano.
- Ao alterar, o sistema:
  1. **Preserva** todos os atendimentos passados (data anterior a hoje) com seu histórico de presença/falta. **O passado é imutável.**
  2. **Exclui** os atendimentos futuros (data a partir de hoje) ligados aos horários antigos.
  3. **Regenera** os atendimentos futuros com base nos novos horários, até a data de término do plano.
- A validação de capacidade (4 por turma) também se aplica aos novos horários.

### 4.6 Renovação
- O sistema **não** renova automaticamente.
- O sistema deve **avisar** sobre planos próximos do vencimento e já vencidos.
- Deve existir um **filtro de vencimento** com faixas: próximos **7, 30, 60 e 90 dias**, e incluindo **planos já vencidos**.
- A renovação é uma ação manual do operador, que cria um novo ciclo de plano (novo período, novo término, novos atendimentos, novos lançamentos a receber). Os horários fixos podem ser mantidos por conveniência, mas é uma nova criação de plano.

---

## 5. Regras de negócio — Agenda e atendimentos

### 5.1 Status do atendimento
Cada atendimento tem um status:

- **Agendado** — estado inicial, aula futura.
- **Presente** — aluno compareceu.
- **Falta avisada** — aluno faltou, mas avisou previamente.
- **Falta não avisada** — aluno faltou sem avisar.
- **Cancelado** — aula não ocorreu (ex.: feriado, fechamento do studio).

> **Reposição:** na v1 o sistema **não gerencia** reposição de faltas. O registro de "falta avisada" vs. "falta não avisada" existe apenas como dado de controle interno para o operador. As regras de reposição (até 3 por mês, dentro de 30 dias) ficam para uma versão futura.

### 5.2 Visualização da agenda
- O operador deve visualizar a agenda por dia e por semana, vendo cada turma (dia/hora) com os alunos alocados e as vagas livres (de 0 a 4 ocupadas).
- A partir da agenda, o operador marca presença/falta de cada aluno.

### 5.3 Aula avulsa
- Aula avulsa é registrada de forma pontual: aluno (ou nome do interessado), data e hora.
- Ocupa uma vaga na turma daquele dia/hora (respeitando o limite de 4), mas **não** gera recorrência.
- Pode gerar um lançamento a receber (ver seção 6).

---

## 6. Regras de negócio — Financeiro

### 6.1 Princípios
- O financeiro tem dois lados: **contas a receber** e **contas a pagar**.
- Lançamentos podem ser **gerados automaticamente** (a partir de planos e aulas avulsas) ou **lançados manualmente** pelo operador (sem vínculo obrigatório com plano).

### 6.2 Contas a receber a partir de planos
- As parcelas de um plano são **montadas na contratação** e podem ter vencimentos **independentes da data de início** do plano (ex.: início dia 1, pagamentos todo dia 10).
- Ao criar um plano:
  - **À vista:** 1 parcela com o valor total.
  - **Parcelado em N vezes:** N parcelas, normalmente mensais, cada uma com seu vencimento.
    - Ex.: plano semestral em 6x → 6 parcelas mensais.
- Cada parcela tem: valor, data de vencimento, **meio de pagamento** e status (pendente / pago).
- **Transparência (UX):** o operador **visualiza e ajusta** as parcelas (valores, vencimentos, meio de pagamento) **antes de confirmar** o plano. A interface sugere uma divisão padrão (total ÷ N, periodicidade mensal a partir de uma data escolhida para a 1ª parcela), e o operador pode ajustar. Nada é calculado de forma oculta.
- **Convenção de arredondamento:** quando a divisão não é exata, o centavo residual fica na **última** parcela.
- **Meio de pagamento por parcela:** normalmente o mesmo em todas, mas pode variar parcela a parcela (definido na montagem).
- **Primeira parcela paga no ato:** é comum a 1ª parcela já ser lançada como **paga** (com data e meio do pagamento) no momento da contratação. O sistema permite que qualquer parcela já nasça quitada.
- **Regra de integridade:** a soma das parcelas deve ser igual ao valor total do plano (tolerância de centavos por arredondamento).

### 6.3 Contas a receber avulsas e manuais
- Uma aula avulsa pode gerar um lançamento a receber.
- O operador pode criar lançamentos a receber manuais, sem vínculo com plano (ex.: venda de um acessório).

### 6.4 Contas a pagar
- Registra todas as despesas do studio (aluguel, energia, fornecedores, etc.).
- Cada lançamento tem: descrição, valor, vencimento, status e (opcionalmente) categoria.
- Lançamentos a pagar são manuais na v1. Podem ser únicos ou parcelados.

### 6.5 Status e baixa
- Status possíveis de um lançamento: **pendente**, **pago**, **atrasado**.
- "Atrasado" é derivado: um lançamento pendente cuja data de vencimento já passou. (Pode ser calculado em vez de armazenado.)
- Dar **baixa** = marcar como pago, registrando data e meio do pagamento.

### 6.6 Observação sobre cobrança
- Na v1 o sistema **apenas registra** pagamentos. Não há integração com gateway, geração de PIX ou cobrança automática. Isso é candidato a versão futura.

### 6.7 Despesas recorrentes
- O operador cadastra **despesas recorrentes** (ex.: aluguel, energia, internet) que se repetem **mensalmente**.
- Cada despesa recorrente guarda: descrição, **valor previsto (fixo)**, **dia de vencimento** dentro do mês, categoria (opcional) e se está ativa.
- **Geração automática:** todo dia **25**, o sistema gera automaticamente os lançamentos a pagar **do mês seguinte**, um para cada despesa recorrente ativa.
  - O lançamento gerado herda descrição, categoria e o valor previsto da despesa recorrente.
  - O **valor é editável no lançamento materializado**, para cobrir contas que variam (ex.: energia). Editar o lançamento não altera o valor previsto da regra.
  - O vencimento do lançamento é montado a partir do dia de vencimento da despesa recorrente aplicado ao mês de competência.
- A geração é **automática** (tarefa agendada no backend). Deve haver também a possibilidade de **disparo manual** da geração, como rede de segurança caso o job não rode (ver requisito técnico 7.1).
- Desativar uma despesa recorrente interrompe gerações futuras, mas **não** afeta lançamentos já gerados.

---

## 7. Requisitos técnicos transversais

### 7.1 Tarefas agendadas (jobs)
O sistema depende de pelo menos uma tarefa agendada no backend:

- **Geração de despesas recorrentes:** executa todo dia 25, gera os lançamentos a pagar do mês seguinte (ver 6.7).
- Deve ser **idempotente**: rodar duas vezes no mesmo mês não pode duplicar lançamentos.
- Deve haver um **disparo manual** equivalente, para o operador acionar caso necessário.

Candidatos futuros a job agendado: cálculo/aviso de planos vencendo, marcação de lançamentos atrasados.

---

## 8. Fora de escopo na v1 (registrado para o futuro)

Itens citados como "vêm depois" — não implementar agora, mas o desenho não deve bloqueá-los:

1. **Gestão de contrato dos planos** (documento de contrato, assinatura, termos).
2. **Autoagendamento pelos alunos** (acesso do aluno para marcar/desmarcar).
3. **Gestão de reposição de faltas** com as regras completas (até 3/mês, janela de 30 dias, encaixe em turma com vaga).
4. **Acesso de professores** ao sistema.
5. **Integração de cobrança** (gateway, PIX automático, cartão recorrente, boleto).
6. **Tratamento automático de feriados** na geração de atendimentos.
7. **Multiunidade / rede** de studios.
8. **Aplicativo nativo** (mobile).
9. **Comissão de professores** (hoje não há).

---

## 9. Premissas assumidas (a confirmar)

Decisões tomadas por padrão onde não houve definição explícita. Corrigir aqui se divergir:

1. Atendimentos passados são **imutáveis**; alterações de horário só afetam o futuro.
2. Na v1, feriados são tratados manualmente (cancelar atendimento do dia).
3. As parcelas são montadas no front (com vencimentos independentes da data de início) e o backend valida que a soma = valor total; o resíduo de arredondamento fica na última parcela; o meio de pagamento é por parcela e qualquer parcela pode já nascer paga.
4. O número de horários fixos é sempre igual à frequência do plano.
5. O status "atrasado" é derivado da data de vencimento, não um estado armazenado manualmente.
6. Perfil de usuário único na v1 (operador com acesso total).
7. Despesas recorrentes são mensais; a geração roda no dia 25 para o mês seguinte e o valor do lançamento é editável sem alterar a regra.

---

## 10. Próximos documentos

- **02 — Modelo de Dados** (entidades, atributos, relacionamentos, diagrama).
- **03 — Arquitetura Técnica** (estrutura React + NestJS + Postgres, módulos, organização do código).
- **04 — Especificação de API / Casos de uso** (endpoints e fluxos), se necessário.
