-- Migration 007 — sessions, journal d'evenements, etat de jeu, decouvertes,
-- jets de des (SCHEMA.md §12, §12.1, §12.2, §13, §14).

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title       text,
  summary     text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Journal en ajout seul : annuler un tour ajoute un evenement de
-- compensation, ne supprime rien. C'est ce qui permet de reconstruire
-- l'etat, de deboguer une partie solo, et d'auditer ce que l'IA a fait.
create table session_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  seq           int not null,
  kind          text not null check (kind in
                  ('player_action','narration','roll','rule_application',
                   'world_update','note','system')),
  actor         text not null check (actor in ('player','gm','ai','system')),
  actor_user_id uuid references auth.users(id),
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (session_id, seq)
);

create index session_events_session_idx on session_events (session_id, seq desc);

-- Etat de jeu : ni build, ni valeur derivee, ce qui change a chaque tour et
-- depend de la campagne (PV courants, epuisement, emplacements de sorts...).
create table entity_runtime_state (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create unique index runtime_state_uniq on entity_runtime_state
  (entity_id, coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- La duree est ancree sur des evenements de session, pas des horodatages :
-- "trois rounds" n'a aucun sens en temps reel.
create table entity_active_effects (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  source_kind text not null check (source_kind in ('spell','condition','item','custom')),
  source_key  text,
  label       text not null,
  modifiers   jsonb not null default '[]'::jsonb,
  duration    jsonb not null default '{}'::jsonb,
  applied_at_event uuid references session_events(id),
  expires_at_event uuid references session_events(id),
  created_at  timestamptz not null default now()
);

create index active_effects_entity_idx on entity_active_effects (entity_id, campaign_id);

-- Wiki progressif : ce qu'un joueur (ou toute la table si user_id est nul)
-- sait deja d'une entite.
create table entity_discoveries (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  entity_id     uuid not null references entities(id) on delete cascade,
  user_id       uuid references auth.users(id),
  detail_level  text not null default 'known'
                  check (detail_level in ('mentioned','known','detailed')),
  discovered_at timestamptz not null default now(),
  source_event_id uuid references session_events(id)
);

create unique index entity_discoveries_uniq on entity_discoveries
  (campaign_id, entity_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Aucun de n'est jamais lance par un modele d'IA : le serveur lance, l'IA
-- raconte le resultat.
create table dice_rolls (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  expression  text not null,
  ast         jsonb not null,
  context     jsonb not null default '{}'::jsonb,
  result      int not null,
  detail      jsonb not null,
  rolled_by   text not null check (rolled_by in ('player','gm','ai','system')),
  seed_step   bigint,
  created_at  timestamptz not null default now()
);
