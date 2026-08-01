-- ============================================================
-- VALIDAÇÃO DE IDADE NO BANCO (criança 5–11, tutor 18+)
-- ============================================================
-- Hoje a validação de idade só existe no navegador (cadastro-responsavel.html
-- / cadastro-tutor.html) — quem ignora o HTML ou chama o Supabase direto
-- consegue gravar uma criança de 200 anos ou um tutor de 3 anos. Isto fecha
-- essa brecha no servidor, sem duplicar a lógica do front pra dentro de um
-- CHECK constraint comum.
--
-- Por que TRIGGER e não CHECK: um CHECK que usa current_date é reavaliado
-- em TODO update da linha, não só quando birth_date muda — uma criança que
-- faz 12 anos quebraria qualquer update futuro nela (aprovar cadastro,
-- pausar ciclo, etc.), mesmo sem ninguém tocar em birth_date. O trigger com
-- "before insert or update of birth_date" só dispara na criação ou quando
-- a própria data de nascimento é alterada — validação correta no momento
-- certo, sem re-travar linhas antigas conforme o tempo passa.

-- ── PASSO A — children: 5 a 11 anos, sem data futura ──────────────────────

create or replace function public.validate_child_birth_date()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date is null then
    return new;
  end if;

  if new.birth_date > current_date then
    raise exception 'Data de nascimento não pode estar no futuro.';
  end if;

  if age(current_date, new.birth_date) < interval '5 years'
     or age(current_date, new.birth_date) >= interval '12 years' then
    raise exception 'O Cognita atende crianças de 5 a 11 anos.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_child_birth_date on public.children;
create trigger trg_validate_child_birth_date
  before insert or update of birth_date on public.children
  for each row
  execute function public.validate_child_birth_date();

-- ── PASSO B — tutor_applications: coluna birth_date + validação 18+ ──────
-- A coluna não existe ainda — a idade era só calculada no front e nunca
-- chegava a ser enviada/gravada.

alter table public.tutor_applications
  add column if not exists birth_date date;

create or replace function public.validate_tutor_birth_date()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date is null then
    return new;
  end if;

  if new.birth_date > current_date then
    raise exception 'Data de nascimento não pode estar no futuro.';
  end if;

  if age(current_date, new.birth_date) < interval '18 years' then
    raise exception 'É preciso ter 18 anos ou mais para ser tutor voluntário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_tutor_birth_date on public.tutor_applications;
create trigger trg_validate_tutor_birth_date
  before insert or update of birth_date on public.tutor_applications
  for each row
  execute function public.validate_tutor_birth_date();

-- ============================================================
-- TESTES MANUAIS (rodar e conferir, depois apagar as linhas de teste)
-- ============================================================
-- Data futura na criança — deve falhar:
-- update public.children set birth_date = current_date + 1
-- where id = '<algum id de teste>';

-- Criança de 12 anos — deve falhar:
-- update public.children set birth_date = current_date - interval '12 years'
-- where id = '<algum id de teste>';

-- Tutor de 17 anos — deve falhar:
-- update public.tutor_applications set birth_date = current_date - interval '17 years'
-- where id = '<algum id de teste>';

-- Depois de aprovado, mudar status da criança pra 'active' NÃO deve falhar
-- mesmo que ela já tenha feito 12 anos desde o cadastro (prova de que o
-- trigger não re-valida em updates que não tocam birth_date):
-- update public.children set status = 'active' where id = '<algum id de teste>';
