# Banco de Dados — Cognita Hub

Última verificação no projeto Supabase de produção: 3 de setembro de 2026.

O banco oficial do Cognita Hub é PostgreSQL por meio do Supabase. O schema em produção é atualmente a fonte de verdade.

> O repositório ainda não possui uma baseline nem uma sequência confiável de migrations. Portanto, neste momento, clonar o projeto não é suficiente para reconstruir o banco.

O schema `public` contém 26 tabelas, organizadas abaixo por domínio.

## Identidade

- `profiles`
- `tutor_applications`

`auth.users` é gerenciado pelo Supabase. `profiles.id` corresponde ao identificador do usuário em `auth.users`.

Papéis disponíveis em `profiles.role`:

- `guardian`;
- `tutor`;
- `admin`;
- `child_device`.

Estados disponíveis em `profiles.status`:

- `pending`;
- `active`;
- `inactive`.

## Crianças e consentimentos

- `children`
- `learning_profiles`
- `consents`
- `consent_acceptances`

## Acompanhamento

- `matches`
- `support_cycles`
- `sessions`
- `reports`
- `progress_logs`
- `admin_notes`

## Atividades

- `activities`
- `child_activities`
- `atividade_execucao`
- `skills`

`activities` representa o catálogo; `child_activities` materializa uma atividade preparada para uma criança; `atividade_execucao` registra sua execução.

## Trilhas e jornadas

- `trail_templates`
- `trail_modules`
- `mission_templates`
- `child_trails`
- `child_trail_modules`
- `child_trail_missions`

As três primeiras tabelas definem modelos. As tabelas iniciadas por `child_` representam a instância atribuída à criança e seu estado de avanço.

## Aplicação infantil

- `child_pairing_codes`
- `paired_devices`

Um dispositivo infantil possui um usuário em `auth.users` com `is_anonymous = true` e um perfil com `role = child_device` e `status = active`. Para acessar o contexto de uma criança, precisa existir um vínculo ativo em `paired_devices`.

## Documentos legais

- `legal_documents`
- `legal_acceptances`

## Funções importantes

### Identidade e autorização

- `handle_new_user` — cria o perfil após a criação de um usuário;
- `my_role`, `is_admin` e `current_user_is_admin` — consultam o contexto de autorização;
- `is_guardian_of`, `is_tutor_of` e `is_paired_device_of` — verificam relações com uma criança;
- `block_admin_signup` — impede a concessão pública do papel administrativo;
- `can_guardian_read_tutor_avatar` e `can_read_trail_template` — verificações auxiliares de acesso.

### Pareamento

- `create_pairing_code`;
- `claim_pairing_code`;
- `revoke_paired_device`;
- `unpair_current_device`;
- `get_paired_child_context`;
- `get_paired_child_context_v2`;
- `cleanup_unclaimed_anonymous_users`.

O frontend infantil atual usa `get_paired_child_context_v2`. A versão sem sufixo permanece no banco por compatibilidade.

### Trilhas e jornadas

- `create_private_journey`;
- `save_journey_draft`;
- `save_journey_draft_v2`;
- `publish_journey`;
- `assign_child_trail`;
- `release_child_module`;
- `advance_child_trail_module`;
- `advance_child_trail_on_execucao`;
- `reopen_child_trail_mission`.

O construtor atual usa `save_journey_draft_v2`. Funções sem o sufixo podem representar contratos mantidos para compatibilidade e devem ser revisadas antes de remoção.

### Sessões e família

- `create_session_with_execucoes`;
- `get_family_sessions`;
- `get_family_sessions_v2`;
- `get_guardian_tutor_profiles`.

O painel da família usa `get_family_sessions_v2`.

### Personalização, validação e documentos

- `set_child_personalization`;
- `validate_child_birth_date`;
- `validate_tutor_birth_date`;
- `can_insert_legal_acceptance`.

## Storage

O projeto possui dois buckets:

- `profile-photos` — privado;
- `email-assets` — público.

## Segurança

Todas as 26 tabelas do schema `public` estão com RLS habilitado. Isso não elimina a necessidade de revisar as políticas e as permissões das funções.

Regras que devem continuar válidas:

- nunca usar `raw_user_meta_data` diretamente para autorizar acesso;
- nunca expor a chave `service_role` no frontend;
- combinar o papel autenticado com relações de propriedade ou vínculo;
- tratar funções `SECURITY DEFINER` como superfícies privilegiadas;
- conceder `EXECUTE` somente aos papéis que realmente precisam da função.

`handle_new_user()` é uma função interna acionada por trigger de `auth.users`. Na verificação mais recente, `PUBLIC`, `anon` e `authenticated` não possuíam permissão de execução direta.

## Estado das migrations

O histórico de migrations do projeto Supabase está vazio. Os antigos arquivos `.sql` em `docs/` eram scripts históricos executados manualmente e foram removidos porque não representavam o estado completo nem a ordem reproduzível do schema.

A correção futura é criar uma baseline real e manter mudanças incrementais em:

```text
supabase/
└── migrations/
    └── ...
```

Essa tarefa deve incluir geração da baseline, revisão de RLS e funções, validação em ambiente separado e documentação do fluxo de deploy.
