---
name: database-change
description: Planeja e implementa mudanças reproduzíveis no PostgreSQL/Supabase do Cognita Hub, incluindo schema, migrations, RLS, grants, RPCs e Storage. Use quando uma tarefa altera persistência ou autorização no banco.
---

# Alterar banco de dados

Leia as seções Authorization e Database de `CLAUDE.md`,
`.claude/agents/supabase-reviewer.md` e `docs/DATABASE.md`.
Para mobile, leia também `apps/mobile/CLAUDE.md` e `docs/MOBILE.md` e examine
`apps/mobile/src/services/` junto dos consumidores web em `js/data/`.

A entrada experimental local planejada não requer mudança no banco. Não
ampliar autorização ou criar crianças/execuções para viabilizar exemplos.
Se o escopo passar a exigir banco, identificar essa mudança antes de editar.

Consulte a documentação oficial atual do Supabase antes de usar comandos,
opções ou recursos dependentes de versão.

O projeto ainda não possui baseline versionada. Antes de criar uma migration,
confirme o estado real do schema e como a mudança será reproduzida sem fingir
que o repositório reconstrói produção.

## Entrega segura

1. Defina invariantes, dados afetados, consumidores e estratégia de rollback.
2. Modele schema, constraints e índices junto com o padrão real de consulta.
3. Defina grants mínimos e uma policy por operação; teste allow e deny para os
   papéis e vínculos relevantes.
4. Prefira `SECURITY INVOKER`. Justifique e endureça qualquer
   `SECURITY DEFINER`, inclusive `search_path` e `EXECUTE`.
5. Valide em ambiente separado. Não execute em produção sem autorização
   explícita para essa ação.
6. Rode testes do banco e advisors disponíveis, revise o diff SQL e verifique
   compatibilidade dos clientes.
7. Atualize `docs/DATABASE.md` e registre decisões arquiteturais duradouras.

Nunca resolva falhas desabilitando RLS, ampliando grants indiscriminadamente ou
expondo `service_role` ao cliente.
