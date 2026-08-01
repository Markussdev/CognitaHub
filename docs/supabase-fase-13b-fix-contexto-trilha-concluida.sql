-- ============================================================
-- Cognita Hub — Fase 13b: fix em get_paired_child_context()
-- Rodar no SQL Editor. Sem blocos "do $$".
-- ============================================================
-- Bug: a versão original filtrava "ct.status = 'ativa'" no left join —
-- uma criança com trilha 'concluida' (sem nenhuma nova atribuída ainda)
-- caía como child_trail_id = null, indistinguível de "nunca teve trilha
-- nenhuma". O app infantil mostrava "sua trilha está sendo preparada" em
-- vez de "Você terminou! 🎉" — a lógica pra esse estado já existe em
-- mostrarTrilhaComum() (app-crianca.js), só nunca era alcançada porque a
-- RPC filtrava antes de chegar lá.
--
-- Fix: pega a trilha mais recente da criança, qualquer status — mesmo
-- critério que getLatestChildTrail() já usa no JS (order by created_at
-- desc limit 1), não mais "só se estiver ativa".
--
-- Pré-requisito: docs/supabase-fase-13-pareamento-dispositivo.sql aplicado.
-- ============================================================

create or replace function public.get_paired_child_context()
returns table (
  child_id uuid,
  primeiro_nome text,
  cycle_id uuid,
  child_trail_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.paired_devices
  set last_seen_at = now()
  where auth_user_id = auth.uid() and revoked_at is null;

  return query
    select c.id, split_part(c.name, ' ', 1), ct.cycle_id, ct.id
    from public.paired_devices pd
    join public.children c on c.id = pd.child_id
    left join lateral (
      select * from public.child_trails
      where child_id = pd.child_id
      order by created_at desc
      limit 1
    ) ct on true
    where pd.auth_user_id = auth.uid() and pd.revoked_at is null;
end;
$$;

-- Conferência: com uma criança que já tem trilha 'concluida' e nenhuma
-- nova, chamar get_paired_child_context() (como o dispositivo pareado
-- dela) deve devolver child_trail_id preenchido agora, não null.
