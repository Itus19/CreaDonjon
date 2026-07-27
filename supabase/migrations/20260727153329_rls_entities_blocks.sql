-- Basic RLS on entities and blocks, filtered by world_id/campaign_id.
-- Per-block visibility (public/joueurs/mj/...) is a separate, finer-grained
-- concern handled server-side later; this only gates row-level DB access.
--
-- Not yet covered by RLS: worlds, campaigns, campaign_members, relations,
-- rulesets, ruleset_entries, entity_mechanical_revisions,
-- campaign_entity_snapshots. Intentional for this phase per the schema doc;
-- revisit before any of this is reachable from a client.

create function has_world_access(target_world_id uuid)
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
  )
  or exists (
    select 1 from campaigns
    join campaign_members on campaign_members.campaign_id = campaigns.id
    where campaigns.world_id = target_world_id
      and campaign_members.user_id = auth.uid()
  );
$$;

create function has_entity_access(target_entity_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select has_world_access(world_id)
  from entities
  where id = target_entity_id;
$$;

alter table entities enable row level security;

create policy entities_access on entities
  for all
  using (has_world_access(world_id))
  with check (has_world_access(world_id));

alter table blocks enable row level security;

create policy blocks_access on blocks
  for all
  using (has_entity_access(entity_id))
  with check (has_entity_access(entity_id));
