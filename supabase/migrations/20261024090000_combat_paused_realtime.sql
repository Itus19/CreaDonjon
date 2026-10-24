-- V3.1-38 — l'outil Initiative refondu.
--
-- 1. « Quitter le combat » suspend sans rien perdre (décision du 4 octobre,
--    retouches 2 et 3 ; choix de l'auteur du 24 octobre : un statut à part,
--    pas `ended`). Un combat suspendu garde ordre, round, tour, PV et états ;
--    le MJ le reprend tel quel ou le recommence. Suspendu et terminé restent
--    distincts dans la liste des combats. Les joueuses ne le voient plus comme
--    actif (service `getPlayerCombatView`) : elles retrouvent leur fiche.
-- 2. Temps réel (ADR 0040) : les joueuses écoutent leur ligne `combats`
--    (lisible des membres de la campagne, rien de secret : statut, round,
--    tour) et relisent leur vue filtrée. `combat_participants` n'est PAS
--    publiée : elle reste fermée au MJ.

alter table combats drop constraint if exists combats_status_check;
alter table combats
  add constraint combats_status_check check (status in ('draft', 'rolling', 'running', 'paused', 'ended'));

alter publication supabase_realtime add table combats;

-- 3. Les PV d'un PJ se répondent dans les deux sens (critère de V3.1-38).
--    MJ → fiche : `patchCombatParticipant` écrit déjà les deux lignes.
--    Fiche → MJ : une joueuse ne peut pas écrire `combat_participants`
--    (ADR 0040) ; ce déclencheur recopie donc, en base, les PV, les PV
--    temporaires et les états de l'état de jeu d'un PJ vers ses lignes de
--    combat NON terminées de la même campagne. `security definer` : il
--    n'ouvre rien de plus que l'écriture de l'état de jeu, déjà réservée à
--    qui peut éditer la fiche (`app.can_edit_entity`, ADR 0043). Il n'écrit
--    que si une valeur change (pas de signal temps réel inutile), et
--    `combat_participants` n'écrit jamais l'état de jeu en retour : pas de
--    boucle. La concentration n'est pas recopiée (formes différentes ; le
--    sens participant → fiche existe déjà).

create or replace function app.sync_combat_participants_from_runtime_state()
returns trigger
language plpgsql
security definer
set search_path = public, app
set row_security = off
as $$
declare
  v_current int := case when jsonb_typeof(new.state->'hp'->'current') = 'number' then (new.state->'hp'->>'current')::int end;
  v_temp int := case when jsonb_typeof(new.state->'hp'->'temp') = 'number' then (new.state->'hp'->>'temp')::int end;
  v_conditions jsonb := case when jsonb_typeof(new.state->'conditions') = 'array' then new.state->'conditions' end;
begin
  if new.campaign_id is null then
    return new;
  end if;
  update combat_participants p
     set hp_current = coalesce(v_current, p.hp_current),
         temp_hp = coalesce(v_temp, p.temp_hp),
         conditions = coalesce(v_conditions, p.conditions)
    from combats c
   where p.combat_id = c.id
     and c.campaign_id = new.campaign_id
     and c.status <> 'ended'
     and p.source_kind = 'entity'
     and p.entity_id = new.entity_id
     and (p.hp_current is distinct from coalesce(v_current, p.hp_current)
          or p.temp_hp is distinct from coalesce(v_temp, p.temp_hp)
          or p.conditions is distinct from coalesce(v_conditions, p.conditions));
  return new;
end;
$$;

create trigger sync_combat_participants_from_runtime_state
  after insert or update of state on entity_runtime_state
  for each row execute function app.sync_combat_participants_from_runtime_state();
