-- ============================================================
-- Cognita Hub — Fase 16: responsável lê perfil E FOTO do tutor
-- Rodar no SQL Editor. Sem blocos "do $$".
-- ============================================================
-- Sintoma: o card "Tutor que acompanha" no painel da família sempre caía
-- no fallback "aparece aqui quando fizer o pareamento", mesmo com
-- support_cycles.tutor_id preenchido — js/data/guardian.js buscava o
-- perfil com `.from('profiles').select(...).in('id', tutorIds)`, que
-- depende de RLS de leitura em profiles pro responsável.
--
-- docs/supabase-fase-4a.sql já contém uma policy pra isso
-- (profiles_guardian_tutor_select, Passo 2b) — mas não há confirmação de
-- que foi de fato aplicada no projeto real (mesma lacuna de "escrito no
-- docs/ mas não rodado" já vista neste repo). Em vez de depender dessa
-- policy (e de confiar que o embed do PostgREST vai casar cycle→tutor
-- certo), uma RPC security definer, no mesmo padrão de
-- get_family_sessions_v2, resolve de vez: escopo explícito por
-- auth.uid() como guardian, e devolve só os 4 campos que o card usa —
-- nem email, phone ou tutor_availability (que o front nunca lê aqui).
--
-- Passo 2 (adicionado depois de o card do tutor já mostrar nome/formação
-- mas não a foto): mesma família de bug, na Storage. O bucket
-- 'profile-photos' é privado (docs/avatar-storage.sql) e a ÚNICA policy de
-- select é "cada um lê só a própria pasta"
-- ((storage.foldername(name))[1] = auth.uid()::text) — o responsável
-- nunca teve caminho pra ler a pasta do tutor, então getAvatarUrl()
-- sempre falhava (silenciosamente — createSignedUrl devolve erro, o
-- front cai pro fallback de iniciais sem quebrar nada visualmente, por
-- isso passou despercebido). A policy nova abaixo é ADITIVA (policies de
-- select se somam por OR) — não toca a leitura do próprio tutor.
--
-- Pré-requisito: is_guardian_of (docs/supabase-rls-fix.sql) e
-- docs/avatar-storage.sql já aplicados.
-- Idempotente — pode rodar mesmo se a Fase 4A já tiver sido aplicada
-- (não conflita, só passa a não ser mais necessária pro card do tutor).
-- ============================================================

create or replace function public.get_guardian_tutor_profiles()
returns table (
  cycle_id uuid,
  tutor_id uuid,
  tutor_name text,
  avatar_path text,
  tutor_presentation text,
  tutor_formation text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select sc.id, p.id, p.name, p.avatar_path, p.tutor_presentation, p.tutor_formation
  from public.support_cycles sc
  join public.children c on c.id = sc.child_id
  join public.profiles p on p.id = sc.tutor_id
  where c.guardian_id = auth.uid()
    and sc.tutor_id is not null;
$$;

revoke all privileges on function public.get_guardian_tutor_profiles() from public;
revoke all privileges on function public.get_guardian_tutor_profiles() from anon;
grant execute on function public.get_guardian_tutor_profiles() to authenticated;

-- ── Passo 2 — Storage: responsável lê a FOTO do tutor vinculado ──────────
-- Compara sc.tutor_id (uuid, coluna de verdade) convertido pra texto contra
-- o nome da pasta — mesma direção de cast que a policy "select own" já usa
-- (uuid::text), nunca o contrário (texto vindo do nome do arquivo → uuid),
-- que quebraria a query inteira se algum objeto tiver pasta fora do padrão.

drop policy if exists "profile photos select guardian of tutor" on storage.objects;
create policy "profile photos select guardian of tutor"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1
      from public.support_cycles sc
      join public.children c on c.id = sc.child_id
      where c.guardian_id = auth.uid()
        and sc.tutor_id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- Conferência (rodar como o RESPONSÁVEL logado, não admin):
--
--   select * from public.get_guardian_tutor_profiles();
--
-- Esperado: uma linha por ciclo com tutor_id preenchido, tutor_name/
-- avatar_path/tutor_presentation/tutor_formation vindos de profiles.
-- Logado como outro responsável (sem essa criança), a mesma chamada deve
-- devolver 0 linhas — confirma que o escopo por auth.uid() está certo.
--
-- Foto: com o tutor tendo avatar_path preenchido (fez upload em Meu
-- perfil), logado como o responsável dessa criança:
--
--   select name from storage.objects
--   where bucket_id = 'profile-photos'
--     and (storage.foldername(name))[1] = '<tutor_id>';
--
-- Esperado: a(s) linha(s) do avatar do tutor aparecem (antes desta fase,
-- essa query devolvia 0 linhas pro responsável mesmo com o arquivo
-- existindo — RLS bloqueava). Logado como um responsável de OUTRA
-- criança (sem esse tutor), a mesma query deve devolver 0 linhas.
-- ============================================================
