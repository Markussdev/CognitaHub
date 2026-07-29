-- Todas as constraints de profiles (PK, FK, UNIQUE, CHECK) --------------
select conname, contype, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.profiles'::regclass;

-- Triggers na própria tabela profiles (não em auth.users) ---------------
select t.tgname as trigger_name, p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.profiles'::regclass
  and not t.tgisinternal;

-- O código-fonte exato da função que roda hoje ---------------------------
select pg_get_functiondef(oid)
from pg_proc
where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace;
