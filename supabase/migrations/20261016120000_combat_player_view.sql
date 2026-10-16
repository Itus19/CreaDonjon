-- V3.1-102 (ADR 0040) — l'initiative vue par les joueurs.
--
-- Depuis V3.1-101, `combat_participants` ne se lit plus que par le MJ. Les
-- joueuses voient l'ordre, le tour et les états par cette fonction, qui ne
-- renvoie que des colonnes sûres (règle 5 : rien de caché n'est envoyé) :
-- - allié (PJ de la campagne, ou `is_ally`) : PV courants, max, temporaires,
--   et sa fiche (`entity_id`) ;
-- - adversaire : un ÉTAT DE BLESSURE calculé ici — Indemne (PV ≥ max),
--   Blessé (> ½), En sang (> 0), Hors de combat (0) — jamais ses PV, jamais
--   sa CA, jamais `rule_key` ni sa fiche : seulement le nom que le MJ affiche.
-- L'ordre de passage et le tour en cours se calculent côté serveur par le
-- même tri que l'écran du MJ (`sortByInitiative`) : d'où `display_order`.
-- Exposée dans `public` pour être appelable par l'API (comme
-- `claim_campaign_character`) ; l'ADR la nommait `app.combat_player_view`.
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
  wound text
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
         end
    from participants p;
end;
$$;

revoke execute on function public.combat_player_view(uuid) from public, anon;
grant execute on function public.combat_player_view(uuid) to authenticated;

-- Signal temps réel : chaque changement de participant touche
-- `combats.updated_at` (la ligne que les joueuses lisent et écoutent). Un
-- déclencheur par instruction, pas par ligne : « lancer toutes les
-- initiatives » ne touche le combat qu'une fois.
create function app.touch_combat_from_participants()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if tg_op = 'DELETE' then
    update combats set updated_at = now() where id in (select distinct o.combat_id from old_rows o);
  else
    update combats set updated_at = now() where id in (select distinct n.combat_id from new_rows n);
  end if;
  return null;
end;
$$;

revoke execute on function app.touch_combat_from_participants() from public;

create trigger combat_participants_touch_combat_insert
  after insert on combat_participants
  referencing new table as new_rows
  for each statement execute function app.touch_combat_from_participants();

create trigger combat_participants_touch_combat_update
  after update on combat_participants
  referencing new table as new_rows
  for each statement execute function app.touch_combat_from_participants();

create trigger combat_participants_touch_combat_delete
  after delete on combat_participants
  referencing old table as old_rows
  for each statement execute function app.touch_combat_from_participants();
