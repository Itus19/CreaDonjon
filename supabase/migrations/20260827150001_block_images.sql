-- Televersement pour le bloc `image` (V2-G12) : par bloc, pas par entite
-- (une fiche peut avoir plusieurs blocs image), contrairement au portrait.
-- Meme patron bytea que entity_portraits/background_images -- cible
-- locale, pas de bucket Supabase Storage.
--
-- RLS restreinte aux membres du monde (comme blocks_select,
-- docs/SCHEMA.md §Phase 0) : un bloc a sa propre visibilite
-- (visibility_level, peut etre "gm") -- contrairement au portrait, ces
-- octets ne sont donc jamais "using (true)". Un visiteur anonyme du wiki
-- passe par publicShare.ts (client service_role) qui reapplique le meme
-- filterBlocks deja utilise pour le reste du contenu du bloc avant de
-- servir l'image -- jamais un raccourci qui contournerait cette visibilite.
create table block_images (
  block_id   uuid primary key references blocks(id) on delete cascade,
  image      bytea not null,
  mime_type  text not null,
  width      int not null,
  height     int not null,
  created_at timestamptz not null default now()
);

alter table block_images enable row level security;

create policy block_images_select on block_images for select
  using (exists (select 1 from blocks b
                 join entities e on e.id = b.entity_id
                 where b.id = block_id and app.is_world_member(e.world_id)));

create policy block_images_write on block_images for all
  using (exists (select 1 from blocks b
                 join entities e on e.id = b.entity_id
                 where b.id = block_id and app.is_world_member(e.world_id)))
  with check (exists (select 1 from blocks b
                       join entities e on e.id = b.entity_id
                       where b.id = block_id and app.is_world_member(e.world_id)));
