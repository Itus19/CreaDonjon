-- Migration 004 — regles : rulesets, entrees, blocs, traductions, renvois,
-- surcharges, verrou officiel (SCHEMA.md §9, §9.1-§9.5).

create table rulesets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  base_system        text not null check (base_system in ('dnd_srd_51','dnd_srd_52','custom')),
  parent_ruleset_id  uuid references rulesets(id),
  version            int not null default 1,
  is_official_base   boolean not null default false,
  lineage_id         uuid not null default gen_random_uuid(),  -- identite stable d'une variante
  published_at       timestamptz,                              -- non nul = fige, toute edition cree v+1
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  check (is_official_base = false or created_by is null)
);

create index rulesets_lineage_idx on rulesets (lineage_id, version desc);

create table ruleset_entries (
  id           uuid primary key default gen_random_uuid(),
  ruleset_id   uuid not null references rulesets(id) on delete cascade,
  entry_key    text not null,        -- cle canonique anglaise stable : 'fireball'
  entry_type   text not null check (entry_type in
                 ('spell','item','weapon','armor','class','subclass','feature',
                  'monster','condition','rule','background','species')),
  ai_digest    text,                 -- forme compressee pour le contexte IA, <= 120 tokens
  ai_digest_generated_at timestamptz,
  source_attribution text,           -- 'SRD 5.1' | 'SRD 5.2.1' | null
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (ruleset_id, entry_key)
);

create index ruleset_entries_type_idx on ruleset_entries (ruleset_id, entry_type);

create trigger touch_ruleset_entries_updated_at
  before update on ruleset_entries
  for each row execute function app.touch_updated_at();

-- Une fiche de regle est un conteneur de blocs types, comme une entite du
-- wiki. Jamais de contenu libre ici (SCHEMA.md §9.1).
create table ruleset_entry_blocks (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references ruleset_entries(id) on delete cascade,
  block_type     text not null,
  schema_version int not null default 1,
  display        jsonb not null default '{}'::jsonb,  -- { label, layout, collapsed }
  data           jsonb not null default '{}'::jsonb,
  display_order  numeric not null default 1000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (entry_id, block_type, display_order)
);

create index entry_blocks_entry_idx on ruleset_entry_blocks (entry_id, display_order);
create index entry_blocks_type_idx  on ruleset_entry_blocks (block_type);

create trigger touch_entry_blocks_updated_at
  before update on ruleset_entry_blocks
  for each row execute function app.touch_updated_at();

-- Traductions : les donnees 5e-bits sont en anglais, des versions
-- francaises officielles du SRD existent sous la meme licence CC-BY-4.0
-- (SCHEMA.md §9.2, PDD §33).
create table ruleset_entry_translations (
  entry_id uuid not null references ruleset_entries(id) on delete cascade,
  locale   text not null,
  name     text not null,
  blocks   jsonb not null default '{}'::jsonb,   -- surcharges de libelles par bloc
  source   text not null check (source in ('official_srd','community','machine','user')),
  primary key (entry_id, locale)
);

-- Renvois entre regles : deduits de la structure des blocs pour l'essentiel,
-- jamais saisis a la main (SCHEMA.md §9.3). target_key plutot que
-- target_entry_id : traverse la chaine d'heritage, un identifiant non.
create table ruleset_entry_refs (
  id              uuid primary key default gen_random_uuid(),
  source_entry_id uuid not null references ruleset_entries(id) on delete cascade,
  target_key      text not null,
  target_entry_id uuid references ruleset_entries(id) on delete set null,  -- cache de resolution
  ref_kind        text not null check (ref_kind in
                    ('uses_rule','applies_condition','damage_type','requires',
                     'replaces','see_also','part_of','grants')),
  origin          text not null check (origin in ('derived','declared')),
  path            text,              -- 'blocks.effects.e1.save.dc'
  note            text,
  created_at      timestamptz not null default now()
);

-- coalesce() dans la cle : path peut etre null, mais deux renvois qui ne
-- different que par un path null vs '' seraient sinon consideres distincts.
-- Une expression n'est autorisee que dans un index, pas dans un UNIQUE(...)
-- de table.
create unique index refs_target_uniq
  on ruleset_entry_refs (source_entry_id, target_key, ref_kind, coalesce(path, ''));

create index refs_source_idx on ruleset_entry_refs (source_entry_id);
create index refs_target_idx on ruleset_entry_refs (target_key, ref_kind);

-- Surcharge : une variante ne duplique pas sa base, elle stocke seulement ce
-- qu'elle change, bloc par bloc (SCHEMA.md §9.4). L'algorithme de resolution
-- (remontee de chaine, empilement de patchs, anti-cycle) vit dans
-- src/core/rules/resolve.ts, pas ici.
create table ruleset_overrides (
  id          uuid primary key default gen_random_uuid(),
  ruleset_id  uuid not null references rulesets(id) on delete cascade,
  entry_key   text not null,
  block_type  text,          -- null = l'action porte sur l'entree entiere
  action      text not null check (action in
                ('add_entry','disable_entry','replace_entry',
                 'add_block','patch_block','replace_block','remove_block')),
  payload     jsonb,
  patch       jsonb,         -- JSON Merge Patch (RFC 7386) si action = 'patch_block'
  note        text,          -- "pourquoi j'ai change ca", affiche dans la fiche
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint overrides_block_required check (
    (action in ('add_entry','disable_entry','replace_entry') and block_type is null)
    or (action in ('add_block','patch_block','replace_block','remove_block') and block_type is not null)
  )
);

create unique index overrides_target_uniq
  on ruleset_overrides (ruleset_id, entry_key, coalesce(block_type,''));

-- Protection des bases officielles : le principe PDD 3.6 est applique par
-- la base, pas seulement par convention (SCHEMA.md §9.5).
create or replace function app.forbid_official_ruleset_write()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    if old.is_official_base then raise exception 'Ruleset officiel non modifiable'; end if;
    return old;
  end if;
  if old.is_official_base and new.is_official_base then
    raise exception 'Ruleset officiel non modifiable';
  end if;
  return new;
end;
$$;

create trigger rulesets_forbid_official_write
  before update or delete on rulesets
  for each row execute function app.forbid_official_ruleset_write();

-- Meme verrou sur les entrees et blocs d'un ruleset officiel. Un
-- contournement explicite (variable de session) est prevu pour le script
-- d'import du SRD (P0-08) qui doit pouvoir rejouer un upsert sans dupliquer :
-- c'est le seul endroit autorise a s'en servir.
create or replace function app.forbid_official_ruleset_entry_write()
returns trigger language plpgsql as $$
declare
  target_ruleset_id uuid;
  is_official boolean;
begin
  if coalesce(current_setting('app.allow_official_writes', true), 'off') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  target_ruleset_id := coalesce(new.ruleset_id, old.ruleset_id);
  select is_official_base into is_official from rulesets where id = target_ruleset_id;

  if is_official then
    raise exception 'Entree d''un ruleset officiel non modifiable (voir app.allow_official_writes pour l''import SRD)';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ruleset_entries_forbid_official_write
  before update or delete on ruleset_entries
  for each row execute function app.forbid_official_ruleset_entry_write();

create or replace function app.forbid_official_entry_block_write()
returns trigger language plpgsql as $$
declare
  target_entry_id uuid;
  is_official boolean;
begin
  if coalesce(current_setting('app.allow_official_writes', true), 'off') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  target_entry_id := coalesce(new.entry_id, old.entry_id);
  select r.is_official_base into is_official
    from ruleset_entries re join rulesets r on r.id = re.ruleset_id
   where re.id = target_entry_id;

  if is_official then
    raise exception 'Bloc d''une entree officielle non modifiable (voir app.allow_official_writes pour l''import SRD)';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger entry_blocks_forbid_official_write
  before update or delete on ruleset_entry_blocks
  for each row execute function app.forbid_official_entry_block_write();

-- FK differee depuis la migration 002 : worlds.default_ruleset_id existait
-- deja, rulesets vient seulement d'etre cree.
alter table worlds
  add constraint worlds_default_ruleset_fk
  foreign key (default_ruleset_id) references rulesets(id);
