-- V1-E4 — suivi d'initiative (specs/outils-mj.md §5). Schema repris tel
-- quel de la spec (deja revu et arbitre avant ce ticket), remonte de la V2
-- comme le reste du lot E (V1-E1/E2/E3/E5).
--
-- Trois instances de combat, distinctes des entites : un gobelin generique
-- dans un combat n'a pas besoin d'une fiche de wiki. `hp_current` sur un
-- participant `source_kind = 'entity'` (un PJ) est un CACHE d'affichage —
-- la valeur qui fait foi reste `entity_runtime_state.state.hp`, deja geree
-- par `applyRuntimeStateChange`/`changeHp` (V1-B5). Ne jamais la dupliquer :
-- sinon le combat se termine et le personnage retrouve magiquement ses PV
-- (specs/outils-mj.md §5.2).
create table combats (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  session_id  uuid references sessions(id) on delete set null,
  name        text,
  round       int not null default 0,
  turn_index  int not null default 0,
  status      text not null default 'draft'
                check (status in ('draft','running','ended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger touch_combats_updated_at
  before update on combats
  for each row execute function app.touch_updated_at();

create table combat_participants (
  id            uuid primary key default gen_random_uuid(),
  combat_id     uuid not null references combats(id) on delete cascade,
  source_kind   text not null check (source_kind in ('entity','statblock','custom')),
  entity_id     uuid references entities(id) on delete set null,  -- un PJ, un PNJ nomme
  rule_key      text,                                             -- une creature du bestiaire (entry_key)
  label         text not null,                                    -- "Gobelin 2"
  initiative    int,
  ac            int,
  hp_max        int,
  hp_current    int,
  temp_hp       int not null default 0,
  conditions    jsonb not null default '[]'::jsonb,
  concentration jsonb,
  is_ally       boolean not null default false,
  display_order numeric not null default 1000,
  created_at    timestamptz not null default now()
);

create index combat_participants_idx on combat_participants (combat_id, display_order);

alter table combats enable row level security;
alter table combat_participants enable row level security;

-- combat_participants n'a pas de campaign_id direct : meme motif que
-- app.session_world_id (20260730150001_rls.sql) pour session_events, une
-- table a un saut de la campagne.
create function app.combat_world_id(p_combat uuid)
returns uuid
language sql stable security definer set search_path = public, app as $$
  select app.campaign_world_id(campaign_id) from combats where id = p_combat;
$$;

revoke execute on function app.combat_world_id(uuid) from public;
grant execute on function app.combat_world_id(uuid) to authenticated;

-- Perimetre Phase 0 (voir 20260730150001_rls.sql) : filtre par
-- appartenance au monde, pas encore de distinction MJ/joueur.
create policy combats_select on combats for select
  using (app.is_world_member(app.campaign_world_id(campaign_id)));
create policy combats_write on combats for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (app.is_world_member(app.campaign_world_id(campaign_id)));

create policy combat_participants_select on combat_participants for select
  using (app.is_world_member(app.combat_world_id(combat_id)));
create policy combat_participants_write on combat_participants for all
  using (app.is_world_member(app.combat_world_id(combat_id)))
  with check (app.is_world_member(app.combat_world_id(combat_id)));
