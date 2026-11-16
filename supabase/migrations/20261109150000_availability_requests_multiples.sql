-- V3.1-190 — plusieurs demandes de disponibilites ouvertes en meme temps.
--
-- 1. Une campagne peut avoir plusieurs demandes ouvertes : l'index partiel
--    « une seule ouverte » (V3.1-8) disparait.
--
-- 2. Une reponse appartient a SA demande. La cle (campagne, joueuse, jour)
--    faisait de la reponse une propriete du jour : deux demandes qui
--    proposent le meme jour se seraient ecrasees. La ligne prend un
--    identifiant propre, et l'unicite devient (demande, joueuse, jour).
--    Les reponses anterieures a V3.1-8 (`request_id` nul) restent lisibles :
--    en SQL, deux NULL ne se heurtent pas, et on n'en ecrit plus.
--
-- 3. « Aucune date ne me va » : sans ligne de disponibilite, une joueuse
--    n'avait aucun moyen de compter comme ayant repondu. Une ligne de
--    `availability_declines` le dit. Cocher une date l'efface (service).

drop index if exists availability_requests_one_open_per_campaign;

alter table real_session_availabilities drop constraint real_session_availabilities_pkey;
alter table real_session_availabilities add column id uuid not null default gen_random_uuid();
alter table real_session_availabilities add primary key (id);
alter table real_session_availabilities
  add constraint real_session_availabilities_request_user_date_key unique (request_id, user_id, date);

-- La paire (id, campaign_id) d'une demande, pour qu'un refus ne puisse
-- jamais viser une demande d'une autre campagne que la sienne (cle etrangere
-- composee ci-dessous).
alter table availability_requests
  add constraint availability_requests_id_campaign_key unique (id, campaign_id);

create table availability_declines (
  request_id  uuid not null,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, user_id),
  foreign key (request_id, campaign_id) references availability_requests(id, campaign_id) on delete cascade
);

create index availability_declines_campaign_idx on availability_declines (campaign_id);

alter table availability_declines enable row level security;

-- Meme regle que `real_session_availabilities` : tout membre lit (le MJ
-- doit savoir qui a repondu), chacune n'ecrit que sa propre ligne.
create policy availability_declines_select on availability_declines for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy availability_declines_write on availability_declines for all
  using (user_id = auth.uid() and app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (user_id = auth.uid() and app.is_world_member(app.campaign_world_id(campaign_id)));
