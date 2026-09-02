-- Lot I, phase E (ADR 0017 decision 2) — couches d'une carte.
--
-- Meme discipline que map_pins/map_regions : `block_id` (bloc
-- PROPRIETAIRE), visibilite propre (public/players/gm/campaign/user/
-- private). Une couche n'est PAS un filtre de securite a elle seule : un
-- element qui lui est assigne n'est visible que si canSee(element) ET
-- canSee(couche) — jamais l'un sans l'autre (ADR 0017 decision 2, "la
-- couche la plus restrictive gagne toujours"). Distinct de la bascule
-- afficher/masquer cote MJ pendant l'edition (confort, jamais persiste,
-- jamais un filtre de securite).

create table map_layers (
  id       uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks(id) on delete cascade,

  name          text not null default '',
  display_order numeric not null default 1000,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint map_layers_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  )
);

create index map_layers_block_idx on map_layers (block_id, display_order);

create trigger touch_map_layers_updated_at
  before update on map_layers
  for each row execute function app.touch_updated_at();

alter table map_layers enable row level security;

create policy map_layers_select on map_layers for select
  using (
    app.is_world_member(app.entity_world_id(app.block_entity_id(block_id)))
    and app.visibility_permits(
      app.entity_world_id(app.block_entity_id(block_id)),
      visibility_level,
      visibility_scope_id,
      created_by
    )
  );

create policy map_layers_insert on map_layers for insert
  with check (app.can_edit_entity(app.block_entity_id(block_id)));
create policy map_layers_update on map_layers for update
  using (app.can_edit_entity(app.block_entity_id(block_id)))
  with check (app.can_edit_entity(app.block_entity_id(block_id)));
create policy map_layers_delete on map_layers for delete
  using (app.can_edit_entity(app.block_entity_id(block_id)));

-- Contrainte differee depuis les migrations 20260901160001_map_pins.sql et
-- 20260902090001_map_regions.sql (map_layers n'existait pas encore) —
-- jamais ces migrations modifiees, ajoutee ici a la place. `on delete set
-- null` : supprimer une couche detache ses elements, jamais ne les
-- supprime en cascade (une couche est une organisation, pas une propriete
-- structurelle des punaises/zones qu'elle regroupe).
alter table map_pins
  add constraint map_pins_layer_id_fkey foreign key (layer_id) references map_layers(id) on delete set null;
alter table map_regions
  add constraint map_regions_layer_id_fkey foreign key (layer_id) references map_layers(id) on delete set null;
