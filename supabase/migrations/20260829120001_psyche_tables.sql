-- V2-H1 (specs/psyche-pnj.md, docs/adr/0013-tables-psyche-pnj.md) : trois
-- tables pour les blocs `personality`/`relationship`.
--
-- entity_attitudes  : valeur courante par paire (source, cible), portee
--                     CAMPAGNE — l'opinion du groupe est propre a une
--                     partie (specs/psyche-pnj.md §6). Cache, reconstruit
--                     en rejouant attitude_events.
-- attitude_events   : journal en ajout seul, par paire, portee campagne.
--                     `deltas` stocke le BRUT, jamais l'effectif — l'amor-
--                     tissement (src/core/psyche/apply.ts) est reapplique
--                     a chaque rejeu.
-- personality_events: meme patron, mais scopee a l'ENTITE seule, sans
--                     campaign_id — le temperament n'est pas propre a une
--                     partie (« Bram est Bram partout »).
--
-- `occurred_at_ingame` (texte libre, sur les deux tables d'evenements) :
-- la date de monde reelle n'existe pas encore (V2-H2, pas construite) —
-- critere ajoute a ce ticket pour migrer ce champ vers le vrai calendrier
-- une fois qu'il existe, docs/BACKLOG_V2.md.

create table entity_attitudes (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  target_entity_id uuid not null references entities(id) on delete cascade,
  axes             jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),
  unique (campaign_id, source_entity_id, target_entity_id)
);

create table attitude_events (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references campaigns(id) on delete cascade,
  source_entity_id   uuid not null references entities(id) on delete cascade,
  target_entity_id   uuid not null references entities(id) on delete cascade,
  summary            text not null,
  deltas             jsonb not null default '{}'::jsonb,
  origin             text not null check (origin in ('ai','gm','player','system')),
  session_event_id   uuid references session_events(id),
  occurred_at_ingame text,
  created_at         timestamptz not null default now()
);

create index attitude_events_pair_idx
  on attitude_events (campaign_id, source_entity_id, target_entity_id, created_at desc);

create table personality_events (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references entities(id) on delete cascade,
  summary            text not null,
  deltas             jsonb not null default '{}'::jsonb,
  origin             text not null check (origin in ('ai','gm','player','system')),
  session_event_id   uuid references session_events(id),
  occurred_at_ingame text,
  created_at         timestamptz not null default now()
);

create index personality_events_entity_idx
  on personality_events (entity_id, created_at desc);

alter table entity_attitudes    enable row level security;
alter table attitude_events     enable row level security;
alter table personality_events  enable row level security;

-- Perimetre Phase 0 (20260730150001_rls.sql) : filtre par appartenance au
-- monde, pas encore de distinction MJ/joueur — la bande nommee et
-- `known_as` restent une responsabilite de la couche service, jamais de
-- la RLS (meme separation que le reste du modele de visibilite,
-- docs/SCHEMA.md §4).
create policy entity_attitudes_select on entity_attitudes for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy entity_attitudes_write on entity_attitudes for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy attitude_events_select on attitude_events for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy attitude_events_write on attitude_events for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy personality_events_select on personality_events for select
  using (app.is_world_member(app.entity_world_id(entity_id)));
create policy personality_events_write on personality_events for all
  using (app.is_world_member(app.entity_world_id(entity_id)))
  with check (app.is_world_member(app.entity_world_id(entity_id)));
