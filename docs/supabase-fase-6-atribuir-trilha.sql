-- ============================================================
-- Cognita Hub — Fase 6 (roadmap do Marcus: "Fase 2 — Atribuição")
-- Rodar no SQL Editor, UM PASSO de cada vez. Sem blocos "do $$".
-- ============================================================
-- Objetivo: dar ao tutor um jeito de atribuir uma trilha oficial (fase 5)
-- a uma criança, escolhendo o módulo inicial. Cria child_trail + os
-- child_trail_modules/child_trail_missions dela numa função só —
-- transacional de graça, porque toda a função roda dentro de uma
-- transação implícita (se qualquer insert falhar, nada fica pela metade).
--
-- Materializa só a partir do módulo escolhido pra frente (módulos
-- anteriores não ganham linha — não é "concluído à força", é ausente,
-- mesma decisão já registrada nos comentários do Passo C da fase 5).
-- child_activities continua não nascendo aqui — só na liberação de
-- módulo (Fase 3 do roadmap, RPC release_child_module, ainda não escrita).
--
-- Pré-requisito: docs/supabase-fase-5-trilha-formal.sql já aplicado e
-- conferido (Passo F, principalmente F3 vazio).
-- ============================================================

-- PASSO A — Verificação prévia --------------------------------------

select table_name from information_schema.tables
where table_schema = 'public' and table_name in
  ('trail_templates', 'trail_modules', 'mission_templates',
   'child_trails', 'child_trail_modules', 'child_trail_missions');
-- Precisa devolver as 6 linhas. Se faltar alguma, rode a fase 5 antes.

-- PASSO B — Função assign_child_trail --------------------------------
-- Autorização: só quem é tutor da criança (is_tutor_of) pode chamar.
-- Regras que a função garante, não a UI:
--   1. a criança não pode ter outra child_trail 'ativa' ao mesmo tempo
--      (uma trilha por vez — "várias trilhas simultâneas" está fora de
--      escopo, ver a lista do que não construir agora);
--   2. o template precisa existir e estar 'published';
--   3. o módulo inicial precisa pertencer mesmo a esse template;
--   4. o ciclo passado precisa ser mesmo da criança passada.

create or replace function public.assign_child_trail(
  p_child_id uuid,
  p_cycle_id uuid,
  p_trail_template_id uuid,
  p_starting_module_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_version int;
  v_template_status  text;
  v_starting_position int;
  v_child_trail_id   uuid;
begin
  if not public.is_tutor_of(p_child_id) then
    raise exception 'Sem permissão: você não acompanha esta criança.';
  end if;

  if not exists (
    select 1 from public.support_cycles
    where id = p_cycle_id and child_id = p_child_id
  ) then
    raise exception 'Este ciclo não pertence a esta criança.';
  end if;

  if exists (
    select 1 from public.child_trails
    where child_id = p_child_id and status = 'ativa'
  ) then
    raise exception 'Esta criança já tem uma trilha ativa.';
  end if;

  select version, status into v_template_version, v_template_status
  from public.trail_templates
  where id = p_trail_template_id;

  if v_template_version is null then
    raise exception 'Trilha não encontrada.';
  end if;
  if v_template_status <> 'published' then
    raise exception 'Esta trilha não está publicada.';
  end if;

  select position into v_starting_position
  from public.trail_modules
  where id = p_starting_module_id and trail_template_id = p_trail_template_id;

  if v_starting_position is null then
    raise exception 'Módulo inicial não pertence a esta trilha.';
  end if;

  insert into public.child_trails
    (child_id, cycle_id, trail_template_id, template_version, starting_module_id, assigned_by)
  values
    (p_child_id, p_cycle_id, p_trail_template_id, v_template_version, p_starting_module_id, auth.uid())
  returning id into v_child_trail_id;

  insert into public.child_trail_modules (child_trail_id, trail_module_id, status)
  select v_child_trail_id, tm.id, 'bloqueado'
  from public.trail_modules tm
  where tm.trail_template_id = p_trail_template_id
    and tm.position >= v_starting_position;

  insert into public.child_trail_missions (child_trail_module_id, mission_template_id, status)
  select ctm.id, mt.id, 'bloqueada'
  from public.child_trail_modules ctm
  join public.mission_templates mt on mt.trail_module_id = ctm.trail_module_id
  where ctm.child_trail_id = v_child_trail_id;

  return v_child_trail_id;
end;
$$;

grant execute on function public.assign_child_trail(uuid, uuid, uuid, uuid) to authenticated;

-- Nota deliberada: não confiro aqui se o ciclo está 'ativo' (o gate de
-- "cycle_active" que já existe em tutor.js é estado calculado na tela,
-- não uma coluna crua de support_cycles — duplicar essa regra aqui sem
-- saber o valor exato arriscaria travar a função por engano). O botão
-- de atribuir trilha na UI deve continuar escondido/desabilitado nos
-- mesmos estados de ciclo que já bloqueiam "preparar atividade" hoje.

-- PASSO C — Teste manual (rode com o usuário TUTOR logado, não como admin) --
-- Troque os quatro uuids pelos reais (o child_id/cycle_id do Mateus, o
-- id do template — '00000000-0000-4000-a000-000000000001' já é fixo — e
-- o módulo inicial, '...000101' pra começar do Módulo 1):
--
-- select public.assign_child_trail(
--   '<child_id>', '<cycle_id>',
--   '00000000-0000-4000-a000-000000000001',
--   '00000000-0000-4000-a000-000000000101'
-- );

-- PASSO D — Conferência -----------------------------------------------
-- Troque <child_trail_id> pelo uuid devolvido no Passo C.

-- D1) A trilha, os módulos e as missões da criança, por extenso:
select ct.status as trilha_status, tm.position as modulo, tm.title as modulo_titulo,
       ctm.status as modulo_status, mt.position as missao, mt.title as missao_titulo,
       ctmi.status as missao_status
from public.child_trails ct
join public.child_trail_modules ctm on ctm.child_trail_id = ct.id
join public.trail_modules tm on tm.id = ctm.trail_module_id
join public.child_trail_missions ctmi on ctmi.child_trail_module_id = ctm.id
join public.mission_templates mt on mt.id = ctmi.mission_template_id
where ct.id = '<child_trail_id>'
order by tm.position, mt.position;
-- Esperado pro Mateus começando no Módulo 1: 2 módulos, 6 missões, tudo
-- 'bloqueado'/'bloqueada'.

-- D2) Chamar a função de novo pra mesma criança deve falhar com "Esta
-- criança já tem uma trilha ativa." — confirma a regra de uma trilha por
-- vez:
--
-- select public.assign_child_trail(
--   '<child_id>', '<cycle_id>',
--   '00000000-0000-4000-a000-000000000001',
--   '00000000-0000-4000-a000-000000000101'
-- );

-- Não é esta etapa: RPC de liberação de módulo em lote (gera as
-- child_activities de verdade — Fase 3 do roadmap), leitura pelo
-- front-end, tela de escolher trilha/módulo inicial no painel do tutor.
