-- V2-M7b suite (coquille joueur) : retour utilisateur — "les stations
-- radio sont celles que le MJ met en place pour ce monde et accessibles
-- aux joueurs". `RadioWidget.tsx` stockait jusqu'ici en `localStorage`
-- (un simple confort de navigateur, jamais partage) : une vraie table
-- monde, lue par tout membre, ecrite par le MJ seul.
--
-- Deux policies separees pour l'ecriture (insert/delete), jamais une seule
-- `for all` — meme correction que `dice_rolls_write` (migration
-- 20260831091000) : une policy `for all` s'ajoute par OR a la policy de
-- lecture (policies permissives Postgres), un `using (is_world_admin)`
-- unique y laisserait fuiter un SELECT reserve au MJ. Ici la lecture est
-- deja ouverte a tout membre, donc rien ne fuit — mais autant ecrire la
-- meme forme partout plutot que de reintroduire le piege ailleurs.

create table world_radio_stations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  label text not null,
  url text not null,
  display_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index world_radio_stations_world_id_idx on world_radio_stations(world_id);

alter table world_radio_stations enable row level security;

create policy world_radio_stations_select on world_radio_stations for select
  using (app.is_world_member(world_id));

create policy world_radio_stations_insert on world_radio_stations for insert
  with check (app.is_world_admin(world_id));

create policy world_radio_stations_delete on world_radio_stations for delete
  using (app.is_world_admin(world_id));
