-- V3.1-183 (ADR 0078) — une joueuse journalise le déplacement de la créature
-- qu'elle pilote.
--
-- Un événement `combat` d'un joueur ne s'insère que sur une ligne qui est SON
-- personnage (20261102110000, « Annuler » ne rejoue pas un événement forgé).
-- Une créature invoquée par son PJ est pilotée par elle (`controlled_by`) :
-- elle la déplace déjà (`set_own_position`), le journal doit suivre. Rien
-- d'autre ne s'ouvre : toujours sa propre ligne, signée de son compte.

create or replace function app.is_own_combat_participant(p_participant uuid, p_session uuid)
returns boolean
language sql stable security definer set search_path = public, app set row_security = off as $$
  select exists (
    select 1
      from combat_participants cp
      join combats c on c.id = cp.combat_id
      join sessions s on s.id = p_session and s.campaign_id = c.campaign_id
     where cp.id = p_participant
       and (
         exists (select 1 from campaign_characters cc
                  where cc.campaign_id = c.campaign_id and cc.entity_id = cp.entity_id and cc.user_id = auth.uid())
         or cp.controlled_by = auth.uid()
       )
  );
$$;
revoke execute on function app.is_own_combat_participant(uuid, uuid) from public;
grant execute on function app.is_own_combat_participant(uuid, uuid) to authenticated;
