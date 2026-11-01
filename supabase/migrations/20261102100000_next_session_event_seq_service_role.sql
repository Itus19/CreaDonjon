-- V3.1-149 (suite) — `next_session_event_seq` refusait le client service-role.
--
-- La fonction (20261102090000) n'acceptait qu'un membre du monde ou le
-- superadmin, tous deux reconnus par `auth.uid()`. Le client service-role
-- n'a pas d'utilisateur : il était refusé, et tout service appelé avec lui
-- (les tests d'intégration du tour solo) ne pouvait plus journaliser. Ce
-- client contourne déjà toute la RLS : le refuser ici ne protège rien. On
-- l'accepte, et rien d'autre ne change.

create or replace function public.next_session_event_seq(p_session uuid)
returns int
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not (
    auth.role() = 'service_role'
    or app.is_superadmin()
    or app.is_world_member(app.session_world_id(p_session))
  ) then
    raise exception 'session hors de portée' using errcode = '42501';
  end if;
  return coalesce((select max(seq) from session_events where session_id = p_session), 0) + 1;
end;
$$;
revoke execute on function public.next_session_event_seq(uuid) from public, anon;
grant execute on function public.next_session_event_seq(uuid) to authenticated, service_role;
