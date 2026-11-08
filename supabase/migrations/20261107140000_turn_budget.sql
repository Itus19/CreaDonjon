-- V3.1-165 (ADR 0076) — le budget du tour compté en combat.
--
-- `combat_participants.turn_usage` (ADR 0075) gagne `budget` : action, action
-- bonus, attaques restantes de l'action Attaque, actions accordées « pas pour
-- la Magie », datés du dernier tour du participant. Aucune colonne nouvelle :
-- seul `apply_engine_change` (ADR 0041) doit accepter cette clé quand une
-- joueuse dépense son budget par un changement signé. Le reste de la fonction
-- est inchangé.

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
         -- V3.1-165 (ADR 0076) : le budget du tour, s'il est là : { at, action, bonus, attacks, extraNotMagic }, rien d'autre.
         or (v_usage ? 'budget' and (
               jsonb_typeof(v_usage -> 'budget') <> 'object'
               or exists (select 1 from jsonb_object_keys(v_usage -> 'budget') k where k not in ('at', 'action', 'bonus', 'attacks', 'extraNotMagic'))
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
