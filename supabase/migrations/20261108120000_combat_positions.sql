-- V3.1-169 (ADR 0077) — le plan du combat : des positions en mètres.
--
-- 1. `combat_participants.pos_x`, `pos_y` (mètres, nullables : pas encore
--    posé). Le MJ les écrit comme le reste de la ligne (ADR 0040).
-- 2. `set_own_position` : une joueuse déplace SON PJ, et rien d'autre (même
--    patron que `set_own_initiative`). Rend la ligne avant et après, pour le
--    journal du combat (annulable par le MJ).
-- 3. `combat_player_view` rend aussi les positions. Ce qui est posé est vu ;
--    le caché et l'invisible relèvent du modèle du monde (V3.1-138). La
--    fonction est recréée (ses colonnes de retour changent), budget du tour
--    des alliés compris (migration 20261107160000).

alter table combat_participants add column pos_x numeric check (pos_x between -1000 and 1000);
alter table combat_participants add column pos_y numeric check (pos_y between -1000 and 1000);

create function public.set_own_position(p_participant uuid, p_x numeric, p_y numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_before combat_participants;
  v_after combat_participants;
  v_campaign uuid;
  v_status text;
begin
  if v_uid is null or p_x is null or p_y is null or abs(p_x) > 1000 or abs(p_y) > 1000 then
    return null;
  end if;
  select cp.* into v_before from combat_participants cp where cp.id = p_participant for update;
  if not found or v_before.entity_id is null then
    return null;
  end if;
  -- Verrou partagé, comme set_own_initiative ; un combat fini ne bouge plus.
  select c.campaign_id, c.status into v_campaign, v_status
    from combats c where c.id = v_before.combat_id for share;
  if v_status not in ('rolling', 'running', 'paused') then
    return null;
  end if;
  if not exists (
    select 1 from campaign_characters cc
     where cc.campaign_id = v_campaign and cc.entity_id = v_before.entity_id and cc.user_id = v_uid and cc.is_pc
  ) then
    return null;
  end if;
  update combat_participants set pos_x = p_x, pos_y = p_y where id = p_participant returning * into v_after;
  return jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after));
end;
$$;

revoke execute on function public.set_own_position(uuid, numeric, numeric) from public, anon;
grant execute on function public.set_own_position(uuid, numeric, numeric) to authenticated;

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
  budget jsonb,
  pos_x numeric,
  pos_y numeric
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
         case when p.ally then p.turn_usage -> 'budget' end,
         -- V3.1-169 (ADR 0077) : la position sur le plan, de tous (ce qui est posé est vu ; le caché attend V3.1-138).
         p.pos_x,
         p.pos_y
    from participants p;
end;
$$;

revoke execute on function public.combat_player_view(uuid) from public, anon;
grant execute on function public.combat_player_view(uuid) to authenticated;
