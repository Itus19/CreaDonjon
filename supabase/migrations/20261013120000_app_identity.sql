-- V3.1-84 (ADR 0061) — l'identité de l'application : nom, phrase d'accueil,
-- logo. Ce que voient tous les visiteurs, connectés ou non : l'écran-titre la
-- lit AVANT toute connexion.
--
-- Une table à ligne UNIQUE : `id` vaut toujours `true` (clé primaire et
-- contrainte), une seconde ligne est donc impossible. Aucune ligne : les
-- valeurs par défaut du code (« Antre Nous », d20) s'appliquent.
--
-- Lecture : tout le monde, y compris `anon`. Il n'y a rien de secret ici.
-- Écriture : le superadmin seul (`app.is_superadmin()`), vérifié aussi côté
-- serveur avant l'appel. « Rétablir » supprime la ligne.
create table public.app_identity (
  id boolean primary key default true check (id),
  name text not null check (char_length(btrim(name)) between 1 and 32),
  tagline text not null default '' check (char_length(tagline) <= 80),
  logo_key text not null default 'd20' check (logo_key in (
    'd20', 'dungeon_door', 'dragon_eye', 'dice_cup', 'quill_die', 'key',
    'grimoire', 'tower', 'maze', 'scale', 'lair', 'map'
  )),
  -- Logo téléversé (WebP 512 px réencodé par le serveur), dans le bucket
  -- `brand` ; `null` : le logo au trait `logo_key` s'affiche.
  logo_storage_path text check (logo_storage_path is null or logo_storage_path like 'logo/%'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.app_identity enable row level security;

grant select on public.app_identity to anon, authenticated;
grant insert, update, delete on public.app_identity to authenticated;

create policy app_identity_select on public.app_identity for select
  to anon, authenticated
  using (true);

create policy app_identity_insert on public.app_identity for insert
  to authenticated
  with check (app.is_superadmin());

create policy app_identity_update on public.app_identity for update
  to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

create policy app_identity_delete on public.app_identity for delete
  to authenticated
  using (app.is_superadmin());

-- Le logo téléversé : un bucket à part, privé. Il n'appartient à aucun monde,
-- donc les règles du bucket `assets` (dossier = monde) ne s'y appliquent pas.
-- Le serveur le sert par `/api/app-identity/logo`, avec un long cache : chaque
-- navigateur ne le télécharge qu'une fois par version (docs/QUOTAS.md).
-- Seul le WebP est admis : le serveur réencode tout logo avant de l'écrire.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', false, 1048576, array['image/webp'])
on conflict (id) do nothing;

create policy brand_bucket_select on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'brand');

create policy brand_bucket_insert on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brand' and app.is_superadmin());

create policy brand_bucket_update on storage.objects for update
  to authenticated
  using (bucket_id = 'brand' and app.is_superadmin())
  with check (bucket_id = 'brand' and app.is_superadmin());

create policy brand_bucket_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'brand' and app.is_superadmin());
