-- Server-side resolution of the visibility column on blocks/relations.
-- Until now, "mj"/"prive"/"joueurs"/"public" were only visual labels in the
-- UI (see components/desktop/EntityDetail.tsx VISIBILITY_LABELS) — RLS
-- granted the same full read access to the world owner and any
-- campaign_members alike, regardless of a row's visibility (deliberately
-- deferred, see comment in 20260727153329_rls_entities_blocks.sql). This
-- closes that gap: from now on the actual filtering happens in Postgres,
-- not just in whatever the client chooses to render.
--
-- Model:
--   public / joueurs -> visible to the world owner, any campaign_members
--                       with role = 'mj', and any other campaign_members
--                       ("joueurs"). public vs joueurs only matters once an
--                       unauthenticated share link exists (not built yet):
--                       public will be visible there too, joueurs won't.
--   mj                -> visible to the world owner and campaign_members
--                       with role = 'mj' only, never to joueurs.
--   prive              -> visible to the world owner only, not even
--                       co-MJs.

create function entity_world_id(target_entity_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select world_id from entities where id = target_entity_id;
$$;

create function is_campaign_mj(target_world_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from campaigns
    join campaign_members on campaign_members.campaign_id = campaigns.id
    where campaigns.world_id = target_world_id
      and campaign_members.user_id = auth.uid()
      and campaign_members.role = 'mj'
  );
$$;

create function can_view_visibility(target_world_id uuid, vis text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when is_world_owner(target_world_id) then true
    when vis = 'prive' then false
    when vis = 'mj' then is_campaign_mj(target_world_id)
    else has_world_access(target_world_id) -- 'public' / 'joueurs'
  end;
$$;

-- blocks: split the old "for all" policy so reads get the visibility
-- filter while writes keep the previous (unchanged) access check.
drop policy blocks_access on blocks;

create policy blocks_select on blocks
  for select
  using (can_view_visibility(entity_world_id(entity_id), visibility));

create policy blocks_insert on blocks
  for insert
  with check (has_entity_access(entity_id));

create policy blocks_update on blocks
  for update
  using (has_entity_access(entity_id))
  with check (has_entity_access(entity_id));

create policy blocks_delete on blocks
  for delete
  using (has_entity_access(entity_id));

-- relations: same split; visibility is evaluated against the source
-- entity's world since source/target are always in the same world today.
drop policy relations_access on relations;

create policy relations_select on relations
  for select
  using (
    can_view_visibility(entity_world_id(source_entity_id), visibility)
    and has_entity_access(target_entity_id)
  );

create policy relations_insert on relations
  for insert
  with check (has_entity_access(source_entity_id) and has_entity_access(target_entity_id));

create policy relations_update on relations
  for update
  using (has_entity_access(source_entity_id) and has_entity_access(target_entity_id))
  with check (has_entity_access(source_entity_id) and has_entity_access(target_entity_id));

create policy relations_delete on relations
  for delete
  using (has_entity_access(source_entity_id) and has_entity_access(target_entity_id));
