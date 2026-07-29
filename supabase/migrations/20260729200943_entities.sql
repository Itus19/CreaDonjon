-- Migration 003 — entites, blocs, relations (SCHEMA.md §5, §6, §7, §7.1, §8, §8.1).
--
-- Note de sequencement : §7.1 decrit aussi `entity_assets`, qui reference
-- `assets(id)` — une table creee seulement en migration 011 (storage.sql).
-- La table des migrations de §22 ne liste d'ailleurs pas `entity_assets`
-- sous cette migration-ci. `entity_assets` est donc reporte a la migration
-- qui cree `assets`, pour eviter une reference en avant.

-- to_tsvector() et array_to_string() sont marques STABLE par Postgres
-- (jamais IMMUTABLE : un dictionnaire de recherche peut changer), donc
-- inutilisables directement dans une colonne generee. Le contournement
-- standard : une fonction wrapper explicitement declaree IMMUTABLE. Elle
-- doit etre en plpgsql (pas sql) : une fonction sql a instruction unique
-- est "inlinee" par le planificateur, qui redecouvre alors l'appel non
-- immuable en dessous, meme si le wrapper est marque immutable. Verifie
-- empiriquement : language sql echoue avec "generation expression is
-- not immutable", language plpgsql fonctionne.
create or replace function app.entities_search_fr(p_name text, p_summary text, p_aliases text[])
returns tsvector
language plpgsql
immutable
as $$
begin
  return to_tsvector('french'::regconfig,
    coalesce(p_name, '') || ' ' || coalesce(p_summary, '') || ' ' || array_to_string(p_aliases, ' '));
end;
$$;

create table entities (
  id            uuid primary key default gen_random_uuid(),
  world_id      uuid not null references worlds(id) on delete cascade,
  slug          text not null,
  name          text not null,
  aliases       text[] not null default '{}',
  summary       text not null default '',
  narrative_content jsonb not null default '[]'::jsonb,   -- voir §6
  tags          text[] not null default '{}',
  entity_kind   text not null default 'other',
  current_mechanical_revision_id uuid,                     -- FK ajoutee en migration 006
  version       int not null default 1,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  search_fr tsvector generated always as (
    app.entities_search_fr(name, summary, aliases)
  ) stored,

  unique (world_id, slug)
);

create index entities_world_idx     on entities (world_id) where deleted_at is null;
create index entities_search_idx    on entities using gin (search_fr);
create index entities_tags_idx      on entities using gin (tags);
create index entities_aliases_idx   on entities using gin (aliases);
create index entities_name_trgm_idx on entities using gin (name gin_trgm_ops);
create index entities_kind_idx      on entities (world_id, entity_kind) where deleted_at is null;

create trigger touch_entities_updated_at
  before update on entities
  for each row execute function app.touch_updated_at();

create table blocks (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  block_type    text not null,
  data          jsonb not null default '{}'::jsonb,
  display_order numeric not null default 1000,
  version       int not null default 1,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint blocks_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  )
);

create index blocks_entity_idx on blocks (entity_id, display_order);
create index blocks_type_idx   on blocks (block_type);

create trigger touch_blocks_updated_at
  before update on blocks
  for each row execute function app.touch_updated_at();

create table relations (
  id                uuid primary key default gen_random_uuid(),
  world_id          uuid not null references worlds(id) on delete cascade,
  source_entity_id  uuid not null references entities(id) on delete cascade,
  target_entity_id  uuid not null references entities(id) on delete cascade,
  relation_type     text not null check (relation_type in (
                      -- famille
                      'parent_of','sibling_of','married_to','adopted_by','ancestor_of',
                      -- social
                      'friend_of','rival_of','mentor_of','serves','member_of','leads',
                      -- spatial
                      'part_of','located_in','origin_of',
                      -- possession
                      'owns','created','carries',
                      -- narratif
                      'knows','loves','hates','participated_in','witnessed')),
  metadata          jsonb not null default '{}'::jsonb,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  constraint relations_no_self check (source_entity_id <> target_entity_id),
  constraint relations_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  ),
  unique (source_entity_id, target_entity_id, relation_type)
);

create index relations_source_idx on relations (source_entity_id);
create index relations_target_idx on relations (target_entity_id);
create index relations_world_idx  on relations (world_id, relation_type);

-- world_id est duplique ici volontairement (seule denormalisation du
-- schema) : sans elle, chaque politique RLS ferait une double jointure
-- vers entities puis worlds a chaque ligne (SCHEMA.md §8). Ce trigger
-- verifie que les deux entites appartiennent bien a ce monde.
create or replace function app.check_relation_world_consistency()
returns trigger language plpgsql as $$
declare
  source_world uuid;
  target_world uuid;
begin
  select world_id into source_world from entities where id = new.source_entity_id;
  select world_id into target_world from entities where id = new.target_entity_id;

  if source_world is null or target_world is null then
    raise exception 'Entite source ou cible introuvable pour cette relation';
  end if;
  if source_world <> target_world then
    raise exception 'Les deux entites d''une relation doivent appartenir au meme monde';
  end if;
  if new.world_id <> source_world then
    raise exception 'relations.world_id doit correspondre au monde des entites liees';
  end if;

  return new;
end;
$$;

create trigger relations_world_consistency_check
  before insert or update on relations
  for each row execute function app.check_relation_world_consistency();

-- Un cycle sur 'part_of' uniquement ferait tourner app.entity_path a
-- l'infini (jusqu'a sa limite de profondeur) a chaque affichage de fil
-- d'Ariane (SCHEMA.md §8.1).
create or replace function app.check_part_of_no_cycle()
returns trigger language plpgsql as $$
begin
  if new.relation_type <> 'part_of' then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select new.target_entity_id as id
      union all
      select r.target_entity_id
        from relations r
        join ancestors a on r.source_entity_id = a.id
       where r.relation_type = 'part_of'
    )
    select 1 from ancestors where id = new.source_entity_id
  ) then
    raise exception 'part_of introduit un cycle';
  end if;

  return new;
end;
$$;

create trigger relations_part_of_no_cycle_check
  before insert or update on relations
  for each row execute function app.check_part_of_no_cycle();

-- Fil d'Ariane via 'part_of' : la relation fait autorite, pas de colonne
-- parent_id qui doublonnerait le graphe et divergerait (SCHEMA.md §8.1).
create or replace function app.entity_path(p_entity uuid)
returns table (id uuid, name text, depth int)
language sql stable as $$
  with recursive up as (
    select e.id, e.name, 0 as depth from entities e where e.id = p_entity
    union all
    select p.id, p.name, up.depth + 1
      from up
      join relations r on r.source_entity_id = up.id and r.relation_type = 'part_of'
      join entities p on p.id = r.target_entity_id
     where up.depth < 10
  )
  select * from up order by depth desc;
$$;

-- Retroliens derives du contenu, recalcules a chaque ecriture, jamais
-- saisis a la main (SCHEMA.md §7.1).
create table entity_mentions (
  id               uuid primary key default gen_random_uuid(),
  world_id         uuid not null references worlds(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  source_path      text not null,      -- 'narrative.s1' | 'block.<uuid>.description'
  target_kind      text not null check (target_kind in ('entity','rule','asset')),
  target_entity_id uuid references entities(id) on delete set null,
  target_rule_key  text,
  origin           text not null check (origin in ('link','alias_detected')),
  visibility_level text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,
  created_at       timestamptz not null default now(),

  constraint mentions_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  )
);

create index mentions_target_idx on entity_mentions (target_entity_id);
create index mentions_source_idx on entity_mentions (source_entity_id);
create index mentions_rule_idx   on entity_mentions (target_rule_key);

create table entity_templates (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid references worlds(id) on delete cascade,  -- null = modele fourni
  name        text not null,
  entity_kind text not null,
  icon        text,
  blocks      jsonb not null default '[]'::jsonb,
  is_builtin  boolean not null default false,
  created_at  timestamptz not null default now()
);
