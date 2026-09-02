-- V2-I2 (brouillard de guerre) — une zone marquee `fog_gated` (voir
-- 20260902180001) n'est visible a un joueur d'une campagne que si elle a ete
-- explicitement revelee POUR CETTE CAMPAGNE : deux campagnes du meme monde
-- (rare mais possible, une active a la fois par `campaigns_world_id_unique`
-- suffit deja a isoler dans le temps une campagne remplacante de la
-- precedente) ne partagent jamais leur decouverte du meme monde.
--
-- Table dediee plutot qu'une colonne sur map_regions (comme entity_grants
-- pour l'edition, campaign_encounters pour les rencontres) : "revele" est un
-- fait de partie qui s'accumule, jamais une valeur qu'on ecrase.

create table map_region_reveals (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  region_id   uuid not null references map_regions(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (campaign_id, region_id)
);

create index map_region_reveals_campaign_idx on map_region_reveals (campaign_id);

alter table map_region_reveals enable row level security;

-- Lecture : tout membre du monde (le calcul de visibilite d'une zone a
-- besoin de savoir si ELLE est revelee, y compris pour un simple joueur —
-- meme raisonnement que map_regions_select, qui expose deja la zone elle
-- meme une fois ce filtre passe).
create policy map_region_reveals_select on map_region_reveals for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));

-- Ecriture : reveler une zone est un geste de MJ (proprietaire/editeur du
-- monde ou MJ humain de la campagne) — jamais quelque chose qu'un joueur
-- declenche lui-meme. Meme garde que entity_grants_write.
create policy map_region_reveals_write on map_region_reveals for all
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
