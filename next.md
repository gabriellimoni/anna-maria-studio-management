# Next developments

1. Refatorar aplicação para adicionar os domain.events em todas as operações que o sistema realiza e salvar memória + claude.md para sempre colocar um evento pareado com as operações - ongoing
1. Add e2e tests on frontend - ensure all works after changes... DO THIS BEFORE GO LIVE
1. Mobile resolution...
1. Login with correct name/logo
1. PWA pra permitir download
1. Link temporário para o usuário poder preencher seu próprio cadastro - salvou não pode usar de novo
1. Deploy DEV env
1. Deploy PRD env

## Migration from old system

1. Think about of how to migrate from old system - maybe some xlsx format with tabs?

## Later

1. Better date formatting - receivables and maybe payables and maybe all system
1. Add logs on Posthog
1. Add error tracing on posthog - backend
1. Add error tracing on posthog - frontend
1. Add session replay on posthog
1. Version tracker + updater
1. Add an "expired" tag to plans - computed: active + endDate in the past - plan on how to properly do that because we need to keep these in the "next expiring results" as well...
