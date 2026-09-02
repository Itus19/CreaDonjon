-- Lot I, phase D (ADR 0017 decision 1) — zones d'une carte.
--
-- Meme discipline que map_pins (migration 20260901160001_map_pins.sql,
-- app.block_entity_id deja cree la) : `block_id` (bloc PROPRIETAIRE
-- uniquement — une zone appartient au bloc `map` qui porte l'image, jamais
-- a la fiche qui l'affiche), `ref`/`name` independants (retour utilisateur,
-- point 1), visibilite propre a chaque zone (retour utilisateur, point 3),
-- `layer_id` deja la (nullable, sans contrainte de cle etrangere tant que
-- `map_layers` n'existe pas — Phase E l'ajoutera dans une nouvelle
-- migration, jamais celle-ci modifiee).
--
-- `shape` (jsonb) : liste ordonnee de sommets normalises (0-1), memes
-- conventions que x/y de map_pins — jamais des pixels, casserait a chaque
-- remplacement d'image.
--
-- Deux couleurs (retour utilisateur : "un choix de couleur (remplissage
-- et contour)") plutot qu'une seule ou un objet jsonb — indexables/
-- verifiables individuellement si un jour necessaire, memes colonnes
-- texte simples que le reste du schema pour une valeur scalaire.

create table map_regions (
  id       uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks(id) on delete cascade,

  name  text not null default '',
  ref   jsonb,
  shape jsonb not null,

  fill_color   text not null default '#3b82f6',
  border_color text not null default '#1d4ed8',

  layer_id uuid,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint map_regions_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  )
);

create index map_regions_block_idx on map_regions (block_id);

create trigger touch_map_regions_updated_at
  before update on map_regions
  for each row execute function app.touch_updated_at();

alter table map_regions enable row level security;

create policy map_regions_select on map_regions for select
  using (
    app.is_world_member(app.entity_world_id(app.block_entity_id(block_id)))
    and app.visibility_permits(
      app.entity_world_id(app.block_entity_id(block_id)),
      visibility_level,
      visibility_scope_id,
      created_by
    )
  );

-- Ecrire une zone est une edition du bloc `map` qui la porte, meme garde
-- que map_pins_insert/update/delete.
create policy map_regions_insert on map_regions for insert
  with check (app.can_edit_entity(app.block_entity_id(block_id)));
create policy map_regions_update on map_regions for update
  using (app.can_edit_entity(app.block_entity_id(block_id)))
  with check (app.can_edit_entity(app.block_entity_id(block_id)));
create policy map_regions_delete on map_regions for delete
  using (app.can_edit_entity(app.block_entity_id(block_id)));
