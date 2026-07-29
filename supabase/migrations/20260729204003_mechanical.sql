-- Migration 006 — revisions mecaniques (SCHEMA.md §10) + FK circulaires
-- differees (entities.current_mechanical_revision_id, migration 003 ;
-- campaign_entity_snapshots.mechanical_revision_id, migration 005).

create table entity_mechanical_revisions (
  id                        uuid primary key default gen_random_uuid(),
  entity_id                 uuid not null references entities(id) on delete cascade,
  revision_number           int not null,
  mechanical_data           jsonb not null,     -- snapshot immuable de la fiche derivee
  based_on_ruleset_entry_id uuid references ruleset_entries(id),
  change_note               text,
  created_by                uuid references auth.users(id),
  created_at                timestamptz not null default now(),
  unique (entity_id, revision_number)
);

alter table entities
  add constraint entities_current_revision_fk
  foreign key (current_mechanical_revision_id)
  references entity_mechanical_revisions(id)
  deferrable initially deferred;

alter table campaign_entity_snapshots
  add constraint campaign_entity_snapshots_revision_fk
  foreign key (mechanical_revision_id)
  references entity_mechanical_revisions(id);

-- Une entite mecanique n'est jamais editee en place : modifier les stats
-- cree une nouvelle ligne ici. Une donnee dite immuable qui peut etre
-- modifiee n'est pas immuable (SCHEMA.md §10).
create or replace function app.forbid_mechanical_revision_update()
returns trigger language plpgsql as $$
begin
  raise exception 'entity_mechanical_revisions est immuable : aucune mise a jour autorisee, inserer une nouvelle revision';
end;
$$;

create trigger mechanical_revisions_forbid_update
  before update on entity_mechanical_revisions
  for each row execute function app.forbid_mechanical_revision_update();
