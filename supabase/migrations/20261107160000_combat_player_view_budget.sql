-- V3.1-166 (ADR 0076) — le budget du tour vu par les joueurs.
--
-- `combat_player_view` (ADR 0040) rend aussi le budget du tour
-- (`turn_usage.budget` : action, action bonus, attaques restantes) des
-- ALLIÉS seulement : le tour est public à la table, l'économie d'un
-- adversaire ne l'est pas (règle 5). Une fonction ne change pas ses colonnes
-- de retour en place : on la supprime et on la recrée, droits compris. Le
-- reste du corps est inchangé.

drop function if exists public.combat_player_view(uuid);

create function public.combat_player_view(p_combat uuid)
returns table (
  id uuid,
  label text,
  initiative int,
  display_order numeric,
  side text,
  entity_id uuid,
  conditions jsonb,
  hp_current int,
  hp_max int,
  temp_hp int,
  wound text,
  budget jsonb
)
language plpgsql
stable
security definer
set search_path = public, app
set row_security = off
as $$
#variable_conflict use_column
declare
  v_campaign uuid;
begin
  select c.campaign_id into v_campaign from combats c where c.id = p_combat;
  if v_campaign is null or not app.is_world_member(app.campaign_world_id(v_campaign)) then
    raise exception 'combat_player_view : accès refusé' using errcode = '42501';
  end if;

  return query
  with participants as (
    select cp.*,
           (cp.is_ally or exists (
              select 1 from campaign_characters cc
               where cc.campaign_id = v_campaign and cc.entity_id = cp.entity_id and cc.is_pc
           )) as ally
      from combat_participants cp
     where cp.combat_id = p_combat
  )
  select p.id,
         p.label,
         p.initiative,
         p.display_order,
         case when p.ally then 'ally' else 'enemy' end,
         case when p.ally then p.entity_id end,
         p.conditions,
         case when p.ally then p.hp_current end,
         case when p.ally then p.hp_max end,
         case when p.ally then p.temp_hp end,
         case
           when p.ally then null
           when p.hp_current is null or p.hp_max is null then null
           when p.hp_current >= p.hp_max then 'unhurt'
           when p.hp_current * 2 > p.hp_max then 'hurt'
           when p.hp_current > 0 then 'bloodied'
           else 'down'
         end,
         -- V3.1-166 (ADR 0076) : le budget du tour d'un allié (le tour est public à la table) ; jamais celui d'un adversaire.
         case when p.ally then p.turn_usage -> 'budget' end
    from participants p;
end;
$$;

revoke execute on function public.combat_player_view(uuid) from public, anon;
grant execute on function public.combat_player_view(uuid) to authenticated;
