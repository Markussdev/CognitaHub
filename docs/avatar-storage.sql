-- Avatar de tutor: coluna no profiles + bucket privado + RLS
-- Rodar no SQL Editor do Supabase (um bloco por vez — sem DO $$)

-- 1. Coluna no profiles
alter table public.profiles
  add column if not exists avatar_path text;

-- 2. Bucket privado (sem public = true)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

-- 3. Políticas de Storage
-- Cada tutor só acessa a própria pasta: profile-photos/{user.id}/...

drop policy if exists "profile photos select own" on storage.objects;
create policy "profile photos select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile photos insert own" on storage.objects;
create policy "profile photos insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile photos update own" on storage.objects;
create policy "profile photos update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile photos delete own" on storage.objects;
create policy "profile photos delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
