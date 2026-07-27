-- Closes the gap left after the first RLS pass: worlds, campaigns,
-- campaign_members, relations, entity_mechanical_revisions and
-- campaign_entity_snapshots had no RLS at all, so any authenticated client
-- could read every world/campaign regardless of ownership or membership
-- (confirmed in practice: a brand new account could see another user's
-- "Monde de test" right after signup).
--
-- rulesets/ruleset_entries stay without RLS on purpose: SRD content is
-- public reference text, not per-user data.

create function is_world_owner(target_world_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from worlds
    where id = target_world_id
      and owner_id = auth.uid()
  );
$$;

create function has_campaign_access(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select has_world_access(world_id)
  from campaigns
  where id = target_campaign_id;
$$;

-- worlds: anyone with world access can read; only the owner can write.
alter table worlds enable row level security;

create policy worlds_select on worlds
  for select
  using (has_world_access(id));

create policy worlds_insert on worlds
  for insert
  with check (owner_id = auth.uid());

create policy worlds_update on worlds
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy worlds_delete on worlds
  for delete
  using (owner_id = auth.uid());

-- campaigns: readable by anyone with access to the parent world;
-- only the world owner manages campaigns for now (no GM-level nuance yet).
alter table campaigns enable row level security;

create policy campaigns_select on campaigns
  for select
  using (has_world_access(world_id));

create policy campaigns_insert on campaigns
  for insert
  with check (is_world_owner(world_id));

create policy campaigns_update on campaigns
  for update
  using (is_world_owner(world_id))
  with check (is_world_owner(world_id));

create policy campaigns_delete on campaigns
  for delete
  using (is_world_owner(world_id));

-- campaign_members: same access story, one level down.
alter table campaign_members enable row level security;

create policy campaign_members_select on campaign_members
  for select
  using (has_campaign_access(campaign_id));

create policy campaign_members_insert on campaign_members
  for insert
  with check (is_world_owner((select world_id from campaigns where id = campaign_id)));

create policy campaign_members_update on campaign_members
  for update
  using (is_world_owner((select world_id from campaigns where id = campaign_id)))
  with check (is_world_owner((select world_id from campaigns where id = campaign_id)));

create policy campaign_members_delete on campaign_members
  for delete
  using (is_world_owner((select world_id from campaigns where id = campaign_id)));

-- relations: mirror whichever entities they connect.
alter table relations enable row level security;

create policy relations_access on relations
  for all
  using (has_entity_access(source_entity_id) and has_entity_access(target_entity_id))
  with check (has_entity_access(source_entity_id) and has_entity_access(target_entity_id));

-- entity_mechanical_revisions: mirrors the entity they snapshot.
alter table entity_mechanical_revisions enable row level security;

create policy entity_mechanical_revisions_access on entity_mechanical_revisions
  for all
  using (has_entity_access(entity_id))
  with check (has_entity_access(entity_id));

-- campaign_entity_snapshots: mirrors the campaign they belong to.
alter table campaign_entity_snapshots enable row level security;

create policy campaign_entity_snapshots_access on campaign_entity_snapshots
  for all
  using (has_campaign_access(campaign_id))
  with check (has_campaign_access(campaign_id));
