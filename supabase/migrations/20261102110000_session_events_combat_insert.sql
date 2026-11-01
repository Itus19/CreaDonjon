-- V3.1-149 (suite, registre de SECURITE.md du 1er nov.) — « Annuler » ne
-- rejoue plus un événement de combat forgé par un joueur.
--
-- `undoLastCombatAction` applique l'état `before` du dernier événement
-- `combat` de la session. Depuis 20261102090000, tout membre pouvait encore
-- INSÉRER un tel événement : un joueur pouvait en glisser un qui visait un
-- monstre (ou le tour du combat), et le prochain « Annuler » du MJ l'aurait
-- appliqué.
--
-- Désormais, un événement `combat` ne s'insère que :
-- - par l'administrateur du monde (le MJ) ;
-- - ou par un joueur, signé de son compte (`actor_user_id = auth.uid()`),
--   sur une ligne de participant (`payload.target = 'participant'`) qui est
--   SON personnage dans la campagne de cette session — le seul cas réel
--   (sa sauvegarde, `answerSaveRequest`, journalise sa propre ligne).
-- Un joueur peut déjà changer les PV de son PJ ; rien de plus ne s'ouvre.
-- Les autres genres d'événement ne changent pas.

create or replace function app.is_own_combat_participant(p_participant uuid, p_session uuid)
returns boolean
language sql stable security definer set search_path = public, app set row_security = off as $$
  select exists (
    select 1
      from combat_participants cp
      join combats c on c.id = cp.combat_id
      join sessions s on s.id = p_session and s.campaign_id = c.campaign_id
      join campaign_characters cc on cc.campaign_id = c.campaign_id and cc.entity_id = cp.entity_id
     where cp.id = p_participant
       and cc.user_id = auth.uid()
  );
$$;
revoke execute on function app.is_own_combat_participant(uuid, uuid) from public;
grant execute on function app.is_own_combat_participant(uuid, uuid) to authenticated;

drop policy if exists session_events_insert on session_events;

create policy session_events_insert on session_events for insert
  with check (
    app.is_world_member(app.session_world_id(session_id))
    and (
      kind <> 'combat'
      or app.is_world_admin(app.session_world_id(session_id))
      or (
        actor_user_id = auth.uid()
        and payload ->> 'target' = 'participant'
        -- `case` : l'ordre d'un `and` n'est pas garanti, la conversion ne se fait qu'après le contrôle de forme.
        and case
              when (payload ->> 'targetId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                then app.is_own_combat_participant((payload ->> 'targetId')::uuid, session_id)
              else false
            end
      )
    )
  );
