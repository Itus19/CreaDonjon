-- V2.1-4 — calendrier reel de planification des seances (retour
-- utilisateur : "un outil de type doodle", disponibilites libres sur un
-- an, MJ voit le chevauchement horaire par jour/mois, historique des
-- parties jouees).
--
-- Table separee de `sessions` (jeu reellement joue, `session_events`,
-- rouverte automatiquement des qu'une action de jeu a lieu,
-- `getOrOpenSessionForCampaign`) plutot qu'une reutilisation : une seance
-- planifiee dans le futur avec `ended_at` null serait a tort choisie comme
-- "la session en cours" par cette logique si quelqu'un joue avant cette
-- date. V2.1-3 (Livre de seance, pas encore ecrit) decidera comment
-- rapprocher les deux au moment voulu.
--
-- Une seule plage horaire par jour et par joueuse (retour utilisateur :
-- jamais deux disponibilites disjointes le meme soir) : cle primaire
-- (campaign_id, user_id, date).
create table real_session_availabilities (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  starts_at   time not null,
  ends_at     time not null,
  updated_at  timestamptz not null default now(),
  primary key (campaign_id, user_id, date),
  check (ends_at > starts_at)
);

create trigger touch_real_session_availabilities_updated_at
  before update on real_session_availabilities
  for each row execute function app.touch_updated_at();

create index real_session_availabilities_campaign_date_idx
  on real_session_availabilities (campaign_id, date);

-- Une ligne par seance CONFIRMEE (retour utilisateur : "je dois pouvoir
-- mettre deux sessions dans le meme mois" — aucune contrainte d'unicite
-- par mois, juste par campagne+date+heure). `source` distingue une
-- confirmation issue du classement de disponibilites d'un reglage manuel
-- du MJ (retour utilisateur : "le MJ doit pouvoir mettre manuellement la
-- prochaine date sans passer par l'outil") — jamais utilise pour filtrer,
-- juste un contexte affiche.
create table real_sessions (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  scheduled_date   date not null,
  starts_at        time not null,
  duration_minutes int not null check (duration_minutes > 0),
  source           text not null check (source in ('availability', 'manual')),
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now()
);

create index real_sessions_campaign_date_idx on real_sessions (campaign_id, scheduled_date);

alter table real_session_availabilities enable row level security;
alter table real_sessions enable row level security;

-- Lecture ouverte a tout membre du monde (comme `combats`, phase 0) : le
-- recap MJ a besoin de voir les disponibilites de tout le monde, et rien
-- ici n'est sensible entre coequipieres. Ecriture de sa propre
-- disponibilite reservee a soi-meme.
create policy real_session_availabilities_select on real_session_availabilities for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy real_session_availabilities_write on real_session_availabilities for all
  using (user_id = auth.uid() and app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (user_id = auth.uid() and app.is_world_member(app.campaign_world_id(campaign_id)));

-- Confirmer une seance (issue des disponibilites ou manuelle) reste un
-- geste MJ, comme poser une date de calendrier ingame.
create policy real_sessions_select on real_sessions for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy real_sessions_write on real_sessions for all
  using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));
