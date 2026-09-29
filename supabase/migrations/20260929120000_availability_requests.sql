-- V3.1-8 — demande structuree de disponibilites (ronde de demande, facon
-- crab.fit mais avec la DA de CreaDonjon) : le MJ propose des dates
-- candidates et une plage horaire, les joueuses ne repondent plus sur un
-- calendrier libre de 12 mois (V2.1-4) mais seulement sur ces dates-la.
--
-- Dates candidates en `date[]` plutot qu'une table enfant : le motif "jour
-- de semaine sur une fenetre" propose par le MJ est deja resolu en dates
-- concretes cote assistant avant l'ecriture — une ronde n'a jamais besoin
-- de reevaluer le motif plus tard, seulement de connaitre les dates qui en
-- ont resulte.
create table availability_requests (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  title           text not null,
  candidate_dates date[] not null,
  starts_at       time not null,
  ends_at         time not null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  check (cardinality(candidate_dates) > 0)
);

-- Une seule ronde ouverte a la fois par campagne (retour utilisateur,
-- V3.1-8) — index partiel plutot qu'une verification applicative, meme
-- discipline que `campaigns_world_id_unique`.
create unique index availability_requests_one_open_per_campaign
  on availability_requests (campaign_id) where status = 'open';

create index availability_requests_campaign_idx on availability_requests (campaign_id);

alter table availability_requests enable row level security;

-- Lecture ouverte a tout membre du monde (comme `real_sessions`) : toute
-- joueuse doit voir la ronde ouverte pour y repondre. Ecriture (ouvrir,
-- fermer) reservee au MJ.
create policy availability_requests_select on availability_requests for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy availability_requests_write on availability_requests for all
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));

-- Une reponse de disponibilite repond desormais toujours a une ronde
-- precise (nullable : les lignes deja en base, saisies en libre-service
-- avant ce ticket, restent lisibles pour l'historique mais ne sont
-- rattachees a aucune ronde — jamais supprimees ni migrees de force).
alter table real_session_availabilities
  add column request_id uuid references availability_requests(id) on delete cascade;

create index real_session_availabilities_request_idx on real_session_availabilities (request_id);
