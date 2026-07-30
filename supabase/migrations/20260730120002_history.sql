-- Migration 008 — historique du wiki (SCHEMA.md §15).

-- Snapshot complet plutot que diff : simple, robuste, et le volume est
-- negligeable au regard du cout d'une reconstruction de diff bugguee.
create table entity_revisions (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  revision_number int not null,
  snapshot        jsonb not null,
  change_source   text not null check (change_source in ('user','ai','import','system')),
  change_note     text,
  changed_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (entity_id, revision_number)
);
