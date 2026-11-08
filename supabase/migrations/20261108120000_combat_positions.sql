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
-- 4. Le budget du tour gagne `moved` (mètres parcourus pendant le tour,
--    ADR 0076/0077) : `apply_engine_change` l'accepte quand une joueuse le
--    dépense par changement signé. Le reste de la fonction est inchangé
--    (copie de la migration 20261107140000).

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

create or replace function public.apply_engine_change(p_payload text, p_signature text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload  jsonb;
  v_secret   bytea;
  v_attendue text;
  v_issued   timestamptz;
  v_campaign uuid;
  v_change   jsonb;
  v_id       uuid;
  v_hp       int;
  v_temp     int;
  v_cond     jsonb;
  v_effect   jsonb;
  v_usage    jsonb;
  v_lignes   int;
begin
  if p_payload is null or p_signature is null or length(p_payload) > 20000 then
    raise exception 'changement du moteur invalide' using errcode = '22023';
  end if;
  v_payload := p_payload::jsonb;
  if jsonb_typeof(v_payload) <> 'object'
     or exists (select 1 from jsonb_object_keys(v_payload) k where k not in ('key_id', 'nonce', 'issued_at', 'campaign_id', 'changes')) then
    raise exception 'changement du moteur invalide' using errcode = '22023';
  end if;

  select secret into v_secret
    from app_private.engine_signing_keys
   where id = v_payload ->> 'key_id' and active;
  if v_secret is null then
    raise exception 'clé de signature inconnue ou inactive' using errcode = '28000';
  end if;

  v_attendue := encode(extensions.hmac(convert_to(p_payload, 'UTF8'), v_secret, 'sha256'), 'hex');
  if v_attendue <> lower(p_signature) then
    raise exception 'signature invalide' using errcode = '28000';
  end if;

  v_issued := (v_payload ->> 'issued_at')::timestamptz;
  if v_issued is null or abs(extract(epoch from (now() - v_issued))) > 60 then
    raise exception 'changement périmé' using errcode = '28000';
  end if;

  insert into app_private.engine_change_nonces (nonce) values ((v_payload ->> 'nonce')::uuid)
  on conflict (nonce) do nothing;
  if not found then
    raise exception 'changement déjà appliqué' using errcode = '28000';
  end if;

  v_campaign := (v_payload ->> 'campaign_id')::uuid;
  if v_campaign is null or jsonb_typeof(v_payload -> 'changes') <> 'array'
     or jsonb_array_length(v_payload -> 'changes') = 0 or jsonb_array_length(v_payload -> 'changes') > 50 then
    raise exception 'changement du moteur invalide' using errcode = '22023';
  end if;

  for v_change in select value from jsonb_array_elements(v_payload -> 'changes') loop
    if jsonb_typeof(v_change) <> 'object'
       or exists (select 1 from jsonb_object_keys(v_change) k where k not in ('kind', 'id', 'hp', 'temp_hp', 'conditions', 'bearer', 'effect', 'turn_usage')) then
      raise exception 'champ hors liste' using errcode = '22023';
    end if;
    v_id   := (v_change ->> 'id')::uuid;
    v_hp   := (v_change ->> 'hp')::int;
    v_temp := (v_change ->> 'temp_hp')::int;
    v_cond := v_change -> 'conditions';
    if (v_hp is not null and v_hp < 0) or (v_temp is not null and v_temp < 0)
       or (v_cond is not null and (jsonb_typeof(v_cond) <> 'array'
           or exists (select 1 from jsonb_array_elements(v_cond) c where jsonb_typeof(c) <> 'string'))) then
      raise exception 'valeur invalide' using errcode = '22023';
    end if;

    if v_change ->> 'kind' = 'participant' then
      update combat_participants cp
         set hp_current = coalesce(v_hp, cp.hp_current),
             temp_hp    = coalesce(v_temp, cp.temp_hp),
             conditions = coalesce(v_cond, cp.conditions)
       where cp.id = v_id
         and exists (select 1 from combats c where c.id = cp.combat_id and c.campaign_id = v_campaign);
    elsif v_change ->> 'kind' = 'runtime' then
      update entity_runtime_state rs
         set state = rs.state
                     || case when v_hp is null and v_temp is null then '{}'::jsonb
                             else jsonb_build_object('hp', jsonb_build_object(
                                    'current', coalesce(v_hp, (rs.state -> 'hp' ->> 'current')::int, 0),
                                    'temp',    coalesce(v_temp, (rs.state -> 'hp' ->> 'temp')::int, 0))) end
                     || case when v_cond is null then '{}'::jsonb else jsonb_build_object('conditions', v_cond) end,
             updated_at = now()
       where rs.entity_id = v_id and rs.campaign_id = v_campaign;
    elsif v_change ->> 'kind' = 'effect_add' then
      -- V3.1-130 : `effect` = { label, source_key, modifiers, duration, payload }, rien d'autre.
      v_effect := v_change -> 'effect';
      if v_effect is null or jsonb_typeof(v_effect) <> 'object'
         or exists (select 1 from jsonb_object_keys(v_effect) k where k not in ('label', 'source_key', 'modifiers', 'duration', 'payload'))
         or jsonb_typeof(v_effect -> 'label') <> 'string' or length(v_effect ->> 'label') not between 1 and 200
         or jsonb_typeof(v_effect -> 'modifiers') <> 'array'
         or jsonb_typeof(v_effect -> 'duration') <> 'object'
         or jsonb_typeof(v_effect -> 'payload') <> 'object' then
        raise exception 'effet invalide' using errcode = '22023';
      end if;
      if v_change ->> 'bearer' = 'participant' then
        insert into entity_active_effects (combat_participant_id, campaign_id, source_kind, source_key, label, modifiers, duration, payload)
        select cp.id, v_campaign, 'feature', v_effect ->> 'source_key', v_effect ->> 'label', v_effect -> 'modifiers', v_effect -> 'duration', v_effect -> 'payload'
          from combat_participants cp join combats c on c.id = cp.combat_id
         where cp.id = v_id and c.campaign_id = v_campaign;
      elsif v_change ->> 'bearer' = 'entity' then
        insert into entity_active_effects (entity_id, campaign_id, source_kind, source_key, label, modifiers, duration, payload)
        select cc.entity_id, v_campaign, 'feature', v_effect ->> 'source_key', v_effect ->> 'label', v_effect -> 'modifiers', v_effect -> 'duration', v_effect -> 'payload'
          from campaign_characters cc
         where cc.entity_id = v_id and cc.campaign_id = v_campaign
         limit 1;
      else
        raise exception 'porteur inconnu' using errcode = '22023';
      end if;
    elsif v_change ->> 'kind' = 'effect_remove' then
      delete from entity_active_effects e where e.id = v_id and e.campaign_id = v_campaign;
    elsif v_change ->> 'kind' = 'turn_usage' then
      -- V3.1-160 : `turn_usage` = { reaction_at: texte ou null, once: { clé: texte } }, rien d'autre.
      v_usage := v_change -> 'turn_usage';
      if v_usage is null or jsonb_typeof(v_usage) <> 'object'
         or exists (select 1 from jsonb_object_keys(v_usage) k where k not in ('reaction_at', 'once', 'budget'))
         or jsonb_typeof(v_usage -> 'reaction_at') not in ('string', 'null')
         or jsonb_typeof(v_usage -> 'once') <> 'object'
         or exists (select 1 from jsonb_each(v_usage -> 'once') e where jsonb_typeof(e.value) <> 'string')
         -- V3.1-165 (ADR 0076) : le budget du tour, s'il est là : { at, action, bonus, attacks, extraNotMagic, moved }, rien d'autre (moved : V3.1-169).
         or (v_usage ? 'budget' and (
               jsonb_typeof(v_usage -> 'budget') <> 'object'
               or exists (select 1 from jsonb_object_keys(v_usage -> 'budget') k where k not in ('at', 'action', 'bonus', 'attacks', 'extraNotMagic', 'moved'))
               or jsonb_typeof(v_usage -> 'budget' -> 'at') <> 'string'
               or exists (select 1 from jsonb_each(v_usage -> 'budget') e where e.key <> 'at' and jsonb_typeof(e.value) <> 'number')))
         or length(v_usage::text) > 4000 then
        raise exception 'compte de tour invalide' using errcode = '22023';
      end if;
      update combat_participants cp
         set turn_usage = v_usage
       where cp.id = v_id
         and exists (select 1 from combats c where c.id = cp.combat_id and c.campaign_id = v_campaign);
    else
      raise exception 'genre de changement inconnu' using errcode = '22023';
    end if;

    get diagnostics v_lignes = row_count;
    if v_lignes <> 1 then
      raise exception 'ligne hors de la campagne' using errcode = '28000';
    end if;
  end loop;

  delete from app_private.engine_change_nonces where seen_at < now() - interval '1 hour';
end;
$$;

revoke execute on function public.apply_engine_change(text, text) from public, anon;
grant execute on function public.apply_engine_change(text, text) to authenticated;
