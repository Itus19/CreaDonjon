-- Migration 009 — propositions IA et quotas (SCHEMA.md §16.2, §16.3).

-- L'IA n'ecrit jamais directement en base. Chaine obligatoire : sortie
-- structuree -> validation Zod -> validation metier -> ai_proposals ->
-- application transactionnelle (mutation + session_event + entity_revision).
create table ai_proposals (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid references campaigns(id) on delete cascade,
  world_id         uuid not null references worlds(id) on delete cascade,
  session_event_id uuid references session_events(id),
  kind             text not null check (kind in
                     ('create_entity','update_entity','create_block','update_block',
                      'create_relation','set_discovery','update_mechanical')),
  target_entity_id uuid references entities(id),
  payload          jsonb not null,
  status           text not null default 'pending'
                     check (status in ('pending','applied','rejected','failed')),
  validation_errors jsonb,
  auto_applied     boolean not null default false,
  reviewed_by      uuid references auth.users(id),
  applied_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index ai_proposals_pending_idx on ai_proposals (world_id, status) where status = 'pending';

-- A creer des le premier appel d'API, pas quand la facture surprend.
create table ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  campaign_id   uuid references campaigns(id) on delete set null,
  purpose       text not null,
  model         text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cached_tokens int not null default 0,
  cost_micros   bigint not null default 0,
  created_at    timestamptz not null default now()
);

create index ai_usage_user_idx on ai_usage_log (user_id, created_at desc);
