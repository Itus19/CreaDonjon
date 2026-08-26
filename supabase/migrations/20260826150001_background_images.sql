-- Fond d'ecran personnel par joueur (V2-G4 reformule, specs/coquille-et-design.md
-- §2b) : bibliotheque personnelle d'images televersees, jamais partagee entre
-- comptes. Aucun fichier d'origine conserve — seule la miniature floutee deja
-- calculee (32x32, base64) est stockee, c'est elle qui sert reellement de fond
-- ("la vignette 32x32 floutee est le vrai fond", §2b). Pas de bucket Supabase
-- Storage : rien n'a jamais besoin de l'image pleine resolution apres son
-- traitement a l'upload.
create table background_images (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  thumb_data_url  text not null,
  hue             numeric not null,
  chroma          numeric not null,
  available_modes text[] not null,
  created_at      timestamptz not null default now()
);

create index background_images_owner_idx on background_images (owner_id);

alter table background_images enable row level security;

-- Motif RLS le plus simple deja en production sur `profiles`
-- (id = auth.uid()) : un compte est seul proprietaire de ses lignes, aucune
-- notion de monde ou de membre ici.
create policy background_images_select on background_images for select
  using (owner_id = auth.uid());
create policy background_images_write on background_images for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
