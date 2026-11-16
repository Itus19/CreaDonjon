-- V3.1-181 (ADR 0078) — la perception en combat, et la réunion de deux
-- versions concurrentes de `apply_engine_change`.
--
-- 1. `combats.lighting` : la lumière ambiante du combat (`bright`, `dim`,
--    `dark`), réglée par le MJ (la RLS de `combats` ne laisse écrire que lui).
-- 2. `combat_participants.hidden_from_players` : un DRAPEAU D'ACCÈS, de même
--    nature que `visibility_level` (pas une valeur de jeu, règle 16) : vrai
--    quand aucun PJ du combat ne voit la créature. Le serveur le recalcule après
--    chaque écriture qui change la perception ; le MJ peut le forcer.
--    `stealth_total` : le total du test de Discrétion d'un Caché (lancé par le
--    serveur, règle 8), contre lequel se mesure la Perception de qui le cherche.
-- 3. `apply_engine_change` : deux migrations de même version (`20261108120000`)
--    redéfinissaient chacune la fonction entière ; `player_save_requests`
--    (V3.1-200), appliquée après, a effacé l'ajout de `combat_positions`
--    (V3.1-169 : `budget.moved`), et le mouvement d'une joueuse est refusé
--    depuis. La fonction ci-dessous est celle de `player_save_requests`, plus
--    `moved` dans le budget, plus le genre `perception` (le masquage recalculé
--    après le geste d'une joueuse, qui n'écrit pas les lignes des autres).
-- 4. `combat_player_view` : un adversaire masqué reste dans l'ordre du tour
--    (le tour en cours désigne le même participant que chez le MJ) mais sous le
--    nom « Quelqu'un », sans position, état ni blessure. Un allié n'est jamais
--    masqué aux joueuses. `stealth_total` n'est jamais rendu.

alter table combats add column lighting text not null default 'bright' check (lighting in ('bright', 'dim', 'dark'));
alter table combat_participants add column hidden_from_players boolean not null default false;
alter table combat_participants add column stealth_total int check (stealth_total between -10 and 60);

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
  v_req      jsonb;
  v_per      jsonb;
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
       or exists (select 1 from jsonb_object_keys(v_change) k where k not in ('kind', 'id', 'hp', 'temp_hp', 'conditions', 'bearer', 'effect', 'turn_usage', 'request', 'perception')) then
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
    elsif v_change ->> 'kind' = 'save_request' then
      -- V3.1-200 : `request` = { combat_id, target_id, label, ability, dc, effect, origin_roll_id }, rien d'autre.
      -- `id` est l'identifiant de la NOUVELLE demande, tiré par le serveur.
      v_req := v_change -> 'request';
      if v_req is null or jsonb_typeof(v_req) <> 'object'
         or exists (select 1 from jsonb_object_keys(v_req) k where k not in ('combat_id', 'target_id', 'label', 'ability', 'dc', 'effect', 'origin_roll_id'))
         or jsonb_typeof(v_req -> 'label') <> 'string' or length(v_req ->> 'label') not between 1 and 300
         or (v_req ->> 'ability') not in ('str', 'dex', 'con', 'int', 'wis', 'cha')
         or jsonb_typeof(v_req -> 'dc') <> 'number' or (v_req ->> 'dc')::int not between 1 and 40
         or jsonb_typeof(v_req -> 'effect') <> 'object' or length((v_req -> 'effect')::text) > 4000
         or jsonb_typeof(v_req -> 'origin_roll_id') not in ('string', 'null') then
        raise exception 'demande de sauvegarde invalide' using errcode = '22023';
      end if;
      insert into save_requests (id, campaign_id, combat_id, origin_roll_id, author_user_id, target_kind, target_id, target_entity_id, target_user_id, label, ability, dc, effect)
      select v_id, v_campaign, c.id,
             -- le jet d'origine : seulement un événement d'une session de CETTE campagne, sinon rien.
             (select se.id from session_events se join sessions s on s.id = se.session_id
               where se.id = (v_req ->> 'origin_roll_id')::uuid and s.campaign_id = v_campaign),
             auth.uid(), 'participant', cp.id, cp.entity_id,
             (select cc.user_id from campaign_characters cc
               where cc.campaign_id = v_campaign and cc.entity_id = cp.entity_id and cc.is_pc limit 1),
             v_req ->> 'label', v_req ->> 'ability', (v_req ->> 'dc')::int, v_req -> 'effect'
        from combat_participants cp join combats c on c.id = cp.combat_id
       where cp.id = (v_req ->> 'target_id')::uuid
         and c.id = (v_req ->> 'combat_id')::uuid
         and c.campaign_id = v_campaign
         and auth.uid() is not null;
    elsif v_change ->> 'kind' = 'perception' then
      -- V3.1-181 (ADR 0078) : le masquage recalculé par le serveur (drapeau d'accès) et le total de
      -- Discrétion d'un Caché. `perception` = { hidden_from_players?: booléen, stealth_total?: entier ou null }, rien d'autre.
      v_per := v_change -> 'perception';
      if v_per is null or jsonb_typeof(v_per) <> 'object'
         or exists (select 1 from jsonb_object_keys(v_per) k where k not in ('hidden_from_players', 'stealth_total'))
         or (v_per ? 'hidden_from_players' and jsonb_typeof(v_per -> 'hidden_from_players') <> 'boolean')
         or (v_per ? 'stealth_total' and jsonb_typeof(v_per -> 'stealth_total') not in ('number', 'null'))
         or (jsonb_typeof(v_per -> 'stealth_total') = 'number' and (v_per ->> 'stealth_total')::int not between -10 and 60) then
        raise exception 'perception invalide' using errcode = '22023';
      end if;
      update combat_participants cp
         set hidden_from_players = case when v_per ? 'hidden_from_players' then (v_per ->> 'hidden_from_players')::boolean else cp.hidden_from_players end,
             stealth_total       = case when v_per ? 'stealth_total' then (v_per ->> 'stealth_total')::int else cp.stealth_total end
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
           )) as ally,
           -- V3.1-181 : un adversaire que le groupe ne voit pas.
           (cp.hidden_from_players and not (cp.is_ally or exists (
              select 1 from campaign_characters cc
               where cc.campaign_id = v_campaign and cc.entity_id = cp.entity_id and cc.is_pc
           ))) as masque
      from combat_participants cp
     where cp.combat_id = p_combat
  )
  select p.id,
         case when p.masque then 'Quelqu''un' else p.label end,
         p.initiative,
         p.display_order,
         case when p.ally then 'ally' else 'enemy' end,
         case when p.ally then p.entity_id end,
         case when p.masque then '[]'::jsonb else p.conditions end,
         case when p.ally then p.hp_current end,
         case when p.ally then p.hp_max end,
         case when p.ally then p.temp_hp end,
         case
           when p.ally or p.masque then null
           when p.hp_current is null or p.hp_max is null then null
           when p.hp_current >= p.hp_max then 'unhurt'
           when p.hp_current * 2 > p.hp_max then 'hurt'
           when p.hp_current > 0 then 'bloodied'
           else 'down'
         end,
         -- V3.1-166 (ADR 0076) : le budget du tour d'un allié (le tour est public à la table) ; jamais celui d'un adversaire.
         case when p.ally then p.turn_usage -> 'budget' end,
         -- V3.1-169 (ADR 0077) : la position sur le plan ; V3.1-181 : sauf d'un adversaire masqué.
         case when p.masque then null else p.pos_x end,
         case when p.masque then null else p.pos_y end
    from participants p;
end;
$$;

revoke execute on function public.combat_player_view(uuid) from public, anon;
grant execute on function public.combat_player_view(uuid) to authenticated;
