-- V3.1-149 — Le journal de session sans la CA ni les PV des adversaires.
--
-- `session_events` se lisait par tout membre du monde. Or les jets ciblés du
-- MJ y écrivaient « … contre CA 15 », « Worg : 26 → 13 PV » et les
-- changements bruts, et le journal de combat (`kind = 'combat'`) garde les
-- lignes de participant avant/après, CA comprise : un joueur lisait par l'API
-- ce que la vue filtrée (ADR 0040) lui cache.
--
-- Désormais :
-- - un événement `combat` se lit par l'administrateur du monde (MJ,
--   propriétaire, éditeur), le superadmin, et son AUTEUR (un joueur journalise
--   la ligne de SON PJ après une sauvegarde : il la relit au retour de
--   l'insertion, et ce n'est que la sienne) ;
-- - les autres genres restent lisibles des membres, mais un jet du MJ n'y
--   écrit que les phrases destinées aux joueurs (`playerFacing.ts`) ; les
--   chiffres vont dans `session_event_gm_details`, réservée à l'administrateur ;
-- - l'ancienne politique `session_events_write` (FOR ALL) ouvrait AUSSI la
--   lecture : elle est remplacée par une insertion (membres) et une
--   modification/suppression (administrateur seul : le journal est en ajout
--   seul, aucun code ne retouche un événement).
-- - le numéro suivant d'une session se lit par une fonction : un joueur qui
--   ne voit plus les événements `combat` calculerait sinon un `seq` déjà pris.

drop policy if exists session_events_select on session_events;
drop policy if exists session_events_write on session_events;

create policy session_events_select on session_events for select
  using (
    app.is_superadmin()
    or app.is_world_admin(app.session_world_id(session_id))
    or (
      app.is_world_member(app.session_world_id(session_id))
      and (kind <> 'combat' or actor_user_id = auth.uid())
    )
  );

create policy session_events_insert on session_events for insert
  with check (app.is_world_member(app.session_world_id(session_id)));

create policy session_events_update on session_events for update
  using (app.is_world_admin(app.session_world_id(session_id)))
  with check (app.is_world_admin(app.session_world_id(session_id)));

create policy session_events_delete on session_events for delete
  using (app.is_world_admin(app.session_world_id(session_id)));

-- Les chiffres d'un événement, pour le MJ seul. Une ligne par événement au
-- plus ; elle suit l'événement (suppression en cascade).
create table session_event_gm_details (
  event_id   uuid primary key references session_events(id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function app.session_event_world_id(p_event uuid)
returns uuid
language sql stable security definer set search_path = public, app set row_security = off as $$
  select app.session_world_id(session_id) from session_events where id = p_event;
$$;
revoke execute on function app.session_event_world_id(uuid) from public;
grant execute on function app.session_event_world_id(uuid) to authenticated;

alter table session_event_gm_details enable row level security;

create policy session_event_gm_details_select on session_event_gm_details for select
  using (app.is_superadmin() or app.is_world_admin(app.session_event_world_id(event_id)));
create policy session_event_gm_details_write on session_event_gm_details for all
  using (app.is_world_admin(app.session_event_world_id(event_id)))
  with check (app.is_world_admin(app.session_event_world_id(event_id)));

-- Le prochain `seq` d'une session, compté sur TOUS ses événements, pour un
-- membre du monde seulement. Ne rend qu'un nombre.
create function public.next_session_event_seq(p_session uuid)
returns int
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not (app.is_superadmin() or app.is_world_member(app.session_world_id(p_session))) then
    raise exception 'session hors de portée' using errcode = '42501';
  end if;
  return coalesce((select max(seq) from session_events where session_id = p_session), 0) + 1;
end;
$$;
revoke execute on function public.next_session_event_seq(uuid) from public, anon;
grant execute on function public.next_session_event_seq(uuid) to authenticated;
