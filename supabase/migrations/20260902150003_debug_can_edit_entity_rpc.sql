-- Diagnostic TEMPORAIRE (retire par une migration suivante des que la
-- vraie cause du bug de suppression est confirmee) : expose can_edit_entity
-- et entity_world_id comme RPC PostgREST pour voir directement, depuis une
-- vraie session authentifiee, ce qu'elles renvoient reellement -- deux
-- correctifs deja tentes (20260902150001, 20260902150002) n'ont pas
-- resolu le bug, il faut arreter de deviner.
create or replace function public.debug_can_edit_entity(p_entity_id uuid)
returns table (
  can_edit boolean,
  world_id uuid,
  is_admin boolean,
  current_uid uuid
)
language sql stable security definer set search_path = public, app as $$
  select
    app.can_edit_entity(p_entity_id),
    app.entity_world_id(p_entity_id),
    app.is_world_admin(app.entity_world_id(p_entity_id)),
    auth.uid();
$$;

grant execute on function public.debug_can_edit_entity(uuid) to authenticated;
