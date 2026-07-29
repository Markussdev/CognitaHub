-- ============================================================
-- Cognita Hub — Correção do erro "Database error saving new user"
-- (500 no cadastro de tutor). Rodar no SQL Editor, PASSO por PASSO.
-- ============================================================
-- Contexto: esse erro só acontece quando o trigger que cria a linha
-- em public.profiles logo após o auth.users falha — o 500 vem do
-- próprio endpoint /auth/v1/signup, antes de qualquer chamada do
-- front. Já aconteceu uma vez neste projeto (docs/supabase-signup-fix.sql)
-- e a Fase 13 (docs/supabase-fase-13-pareamento-dispositivo.sql) reescreveu
-- handle_new_user() depois disso — o Passo B daquela fase pedia edição
-- manual da constraint de role, que pode ter ficado pra trás.
-- ============================================================

-- PASSO 1 — Diagnóstico (só leitura, rode tudo de uma vez) --------------

-- 1a) Triggers ativos no auth.users. Se aparecer MAIS de uma linha,
-- achamos a causa (trigger duplicado brigando).
select t.tgname  as trigger_name,
       p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal;

-- 1b) Constraint de role — precisa aceitar 'tutor' (e, se a Fase 13
-- foi aplicada, também 'child_device').
select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and pg_get_constraintdef(oid) ilike '%role%';

-- 1c) Constraint de status — precisa aceitar 'pending' (tutor entra
-- como pending até o admin aprovar).
select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and pg_get_constraintdef(oid) ilike '%status%';

-- 1d) Colunas NOT NULL sem default — o trigger abaixo preenche id,
-- name, email, phone, role, status. Qualquer OUTRA coluna NOT NULL
-- sem default aqui quebra todo signup.
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and is_nullable = 'NO' and column_default is null;

-- PASSO 2 — Remove qualquer trigger duplicado/antigo e recria só UM ------
-- (idempotente — pode rodar de novo sem medo)

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists handle_new_user on auth.users;
drop trigger if exists on_new_user on auth.users;
drop trigger if exists create_profile_on_signup on auth.users;

-- Mesma função da Fase 13 (com o branch de dispositivo anônimo) —
-- reafirmada aqui pra garantir que é ESSA versão que está valendo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) then
    insert into public.profiles (id, name, email, phone, role, status)
    values (new.id, 'Dispositivo infantil', null, null, 'child_device', 'active')
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, name, email, phone, role, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      new.email,
      new.raw_user_meta_data ->> 'phone',
      coalesce(new.raw_user_meta_data ->> 'role', 'guardian'),
      case
        when coalesce(new.raw_user_meta_data ->> 'role', 'guardian') = 'guardian'
          then 'active'
        else 'pending'
      end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- PASSO 3 — Teste direto do insert que o trigger faz (sem passar pelo
-- Auth) — se ESTE falhar, a mensagem de erro mostra a constraint real
-- (me manda o texto exato). Se passar, roda o delete e testa o
-- cadastro de tutor no site de novo.

insert into public.profiles (id, name, email, phone, role, status)
values ('00000000-0000-0000-0000-000000000002',
        'Teste Trigger Tutor', 'teste-trigger-tutor@cognita.local',
        null, 'tutor', 'pending');

delete from public.profiles
where id = '00000000-0000-0000-0000-000000000002';

-- PASSO 4 — SE o Passo 1b mostrou que a constraint de role NÃO inclui
-- 'tutor' (não deveria acontecer, mas se acontecer): copie o conname
-- que apareceu e rode, ajustando a lista pros valores que já existem
-- mais os que faltam:
--
-- alter table public.profiles drop constraint <conname_do_passo_1b>;
-- alter table public.profiles add constraint profiles_role_check
--   check (role in ('guardian', 'tutor', 'admin', 'child_device'));
