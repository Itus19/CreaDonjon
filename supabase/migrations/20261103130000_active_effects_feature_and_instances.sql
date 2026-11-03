-- V3.1-130 (ADR 0060 §3, ADR 0073) — les effets qui durent, écrits pour de bon.
--
-- 1. `entity_active_effects` accepte les effets posés par une règle
--    (`source_kind = 'feature'`), leur description validée par Zod (`payload`),
--    et un porteur qui est une INSTANCE de combat (`combat_participant_id`) :
--    un monstre du SRD n'a pas de fiche, et « Gobelin ×4 » en partage une.
--    Exactement un porteur : l'entité OU l'instance.
-- 2. Une ligne d'instance se lit et s'écrit par l'administrateur du monde
--    seulement, comme `combat_participants` (ADR 0040). Les lignes d'entité
--    gardent leurs politiques (`app.can_edit_entity`, 20261010130000).
-- 3. `apply_engine_change` (ADR 0041) gagne deux genres : `effect_add` (poser
--    un effet sur une instance ou un PJ de la campagne) et `effect_remove`
--    (retirer un effet de la campagne). Le reste de la fonction est inchangé.

alter table entity_active_effects drop constraint if exists entity_active_effects_source_kind_check;
alter table entity_active_effects add constraint entity_active_effects_source_kind_check
  check (source_kind in ('spell', 'condition', 'item', 'custom', 'feature'));

alter table entity_active_effects add column payload jsonb not null default '{}'::jsonb;
alter table entity_active_effects add constraint entity_active_effects_payload_object
  check (jsonb_typeof(payload) = 'object');

alter table entity_active_effects alter column entity_id drop not null;
alter table entity_active_effects
  add column combat_participant_id uuid references combat_participants(id) on delete cascade;
alter table entity_active_effects add constraint entity_active_effects_one_bearer
  check (num_nonnulls(entity_id, combat_participant_id) = 1);

create index active_effects_participant_idx on entity_active_effects (combat_participant_id)
  where combat_participant_id is not null;

-- Une instance appartient à un combat de LA campagne de la ligne : sinon, un
-- administrateur d'un monde poserait un effet daté d'une autre campagne.
create policy entity_active_effects_participant on entity_active_effects for all
  using (
    combat_participant_id is not null
    and app.is_world_admin(app.campaign_world_id(campaign_id))
  )
  with check (
    combat_participant_id is not null
    and app.is_world_admin(app.campaign_world_id(campaign_id))
    and exists (
      select 1 from combat_participants cp join combats c on c.id = cp.combat_id
       where cp.id = combat_participant_id and c.campaign_id = entity_active_effects.campaign_id
    )
  );

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
       or exists (select 1 from jsonb_object_keys(v_change) k where k not in ('kind', 'id', 'hp', 'temp_hp', 'conditions', 'bearer', 'effect')) then
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

-- 4. Lecture signée des effets d'un combat (même demande que
--    `engine_read_combat`, ADR 0069) : un joueur ne lit pas les effets portés
--    par une instance (MJ seulement). Le moteur les lit ainsi pour décider, en
--    TypeScript, de ce qui expire (dégâts subis, concentration rompue), puis
--    retire par `effect_remove` signé. Rend les effets posés par une règle sur
--    les instances de ce combat et sur les fiches de la campagne.
create function public.engine_read_combat_effects(p_payload text, p_signature text)
returns setof entity_active_effects
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload  jsonb;
  v_secret   bytea;
  v_issued   timestamptz;
  v_combat   uuid;
  v_campaign uuid;
begin
  if p_payload is null or p_signature is null or length(p_payload) > 2000 then
    raise exception 'lecture du moteur invalide' using errcode = '22023';
  end if;
  v_payload := p_payload::jsonb;
  if jsonb_typeof(v_payload) <> 'object'
     or exists (select 1 from jsonb_object_keys(v_payload) k where k not in ('key_id', 'nonce', 'issued_at', 'campaign_id', 'combat_id')) then
    raise exception 'lecture du moteur invalide' using errcode = '22023';
  end if;

  select secret into v_secret
    from app_private.engine_signing_keys
   where id = v_payload ->> 'key_id' and active;
  if v_secret is null then
    raise exception 'clé de signature inconnue ou inactive' using errcode = '28000';
  end if;
  if encode(extensions.hmac(convert_to(p_payload, 'UTF8'), v_secret, 'sha256'), 'hex') <> lower(p_signature) then
    raise exception 'signature invalide' using errcode = '28000';
  end if;

  v_issued := (v_payload ->> 'issued_at')::timestamptz;
  if v_issued is null or abs(extract(epoch from (now() - v_issued))) > 60 then
    raise exception 'demande périmée' using errcode = '28000';
  end if;

  insert into app_private.engine_change_nonces (nonce) values ((v_payload ->> 'nonce')::uuid)
  on conflict (nonce) do nothing;
  if not found then
    raise exception 'demande déjà servie' using errcode = '28000';
  end if;

  v_combat := (v_payload ->> 'combat_id')::uuid;
  v_campaign := (v_payload ->> 'campaign_id')::uuid;
  if not exists (select 1 from combats c where c.id = v_combat and c.campaign_id = v_campaign) then
    raise exception 'combat hors de la campagne' using errcode = '28000';
  end if;

  return query
    select e.* from entity_active_effects e
     where e.campaign_id = v_campaign
       and e.source_kind = 'feature'
       and (e.entity_id is not null
            or e.combat_participant_id in (select cp.id from combat_participants cp where cp.combat_id = v_combat))
     order by e.created_at;
end;
$$;

revoke execute on function public.engine_read_combat_effects(text, text) from public, anon;
grant execute on function public.engine_read_combat_effects(text, text) to authenticated;
