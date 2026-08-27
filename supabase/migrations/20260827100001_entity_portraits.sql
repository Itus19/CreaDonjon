-- Portrait televersable pour toute fiche (retour utilisateur) : au niveau
-- de l'entite elle-meme, pas d'un bloc -- une entite ne porte pas de
-- visibilite propre (SCHEMA.md §5), le portrait est donc public comme le
-- nom, y compris pour un visiteur anonyme du wiki. Image traitee et
-- stockee directement en bytea Postgres (meme patron que
-- background_images -- cible locale, pas de bucket Supabase Storage),
-- jamais dans `assets`/`entity_assets` (schema-only, prevu pour un futur
-- stockage reel, hors perimetre ici). Une seule ligne par entite : un
-- nouveau televersement remplace l'ancien (upsert), "remplacer" n'a donc
-- pas besoin d'action separee.
create table entity_portraits (
  entity_id  uuid primary key references entities(id) on delete cascade,
  image      bytea not null,
  mime_type  text not null,
  width      int not null,
  height     int not null,
  created_at timestamptz not null default now()
);

alter table entity_portraits enable row level security;

create policy entity_portraits_select on entity_portraits for select using (true);

create policy entity_portraits_write on entity_portraits for all
  using (exists (select 1 from entities e where e.id = entity_id and app.is_world_member(e.world_id)))
  with check (exists (select 1 from entities e where e.id = entity_id and app.is_world_member(e.world_id)));
