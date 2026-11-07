-- V3.1-160 (ADR 0075) — le jet suspendu : une fenêtre de réaction entre le
-- dé et ses conséquences.
--
-- 1. `roll_windows` : la partie lisible d'une fenêtre (libellé, total, issue,
--    réactions possibles et qui répond, réponses). Ni la CA ni le DD d'un
--    adversaire n'y sont (ADR 0040). Aucune écriture directe : ouverture
--    signée, réponse et fermeture par fonctions.
-- 2. `app_private.roll_window_states` : l'état figé du jet (dés, CA, DD, la
--    suite à appliquer). Aucun droit pour `anon` ni `authenticated` ; il
--    n'entre que par l'ouverture signée et ne sort que par la lecture signée,
--    une seule fois. Une joueuse ne peut ni fabriquer ni retoucher un jet.
-- 3. `combat_participants.turn_usage` : la réaction dépensée (datée) et les
--    usages « une fois par tour » ; écrit par le changement signé (ADR 0041),
--    qui gagne le genre `turn_usage`.

-- 1. La partie lisible.
create table roll_windows (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references campaigns(id) on delete cascade,
  combat_id      uuid references combats(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('attack', 'save', 'check', 'damage')),
  label          text not null check (length(label) between 1 and 300),
  view           jsonb not null check (jsonb_typeof(view) = 'object'),
  -- [{ user_id (null : le MJ), actor_label, rule_key, activation_id, label, changes_outcome }]
  choices        jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 1 and 20),
  -- { "<index>": { use, by, at } }
  answers        jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  status         text not null default 'pending' check (status in ('pending', 'closed')),
  created_at     timestamptz not null default now(),
  closed_at      timestamptz,
  resumed_at     timestamptz
);

create index roll_windows_campaign_status_idx on roll_windows (campaign_id, status, created_at desc);

alter table roll_windows enable row level security;

-- Lecture : l'auteur du jet, ceux qui peuvent réagir, le MJ.
create policy roll_windows_select on roll_windows for select
  using (
    author_user_id = auth.uid()
    or app.is_world_admin(app.campaign_world_id(campaign_id))
    or exists (select 1 from jsonb_array_elements(choices) c where c ->> 'user_id' = auth.uid()::text)
  );
-- Pas de politique d'écriture : tout passe par les fonctions ci-dessous.

-- 2. L'état figé.
create table app_private.roll_window_states (
  window_id uuid primary key references roll_windows(id) on delete cascade,
  state     jsonb not null check (jsonb_typeof(state) = 'object')
);
revoke all on app_private.roll_window_states from public, anon, authenticated;

-- 3. Le compte de tour.
alter table combat_participants
  add column turn_usage jsonb not null default '{"reaction_at": null, "once": {}}'::jsonb;
alter table combat_participants add constraint combat_participants_turn_usage_object
  check (jsonb_typeof(turn_usage) = 'object');

-- 4. Vérifier une demande signée du moteur (même contrôle que
--    `apply_engine_change`) : signature, fraîcheur, nonce. Rend la demande.
create function app_private.verify_engine_request(p_payload text, p_signature text, p_keys text[], p_max_length int)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload jsonb;
  v_secret  bytea;
  v_issued  timestamptz;
begin
  if p_payload is null or p_signature is null or length(p_payload) > p_max_length then
    raise exception 'demande du moteur invalide' using errcode = '22023';
  end if;
  v_payload := p_payload::jsonb;
  if jsonb_typeof(v_payload) <> 'object'
     or exists (select 1 from jsonb_object_keys(v_payload) k where k <> all (p_keys)) then
    raise exception 'demande du moteur invalide' using errcode = '22023';
  end if;
  select secret into v_secret from app_private.engine_signing_keys where id = v_payload ->> 'key_id' and active;
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
  return v_payload;
end;
$$;
revoke execute on function app_private.verify_engine_request(text, text, text[], int) from public, anon, authenticated;

-- 5. Ouvrir une fenêtre : par le moteur seulement (signé), au nom de
--    l'appelant, membre de la campagne. Rend l'identifiant.
create function public.engine_open_roll_window(p_payload text, p_signature text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload  jsonb;
  v_window   jsonb;
  v_campaign uuid;
  v_combat   uuid;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'non connecté' using errcode = '28000';
  end if;
  v_payload := app_private.verify_engine_request(p_payload, p_signature, array['key_id', 'nonce', 'issued_at', 'campaign_id', 'window'], 60000);
  v_campaign := (v_payload ->> 'campaign_id')::uuid;
  v_window := v_payload -> 'window';
  if v_window is null or jsonb_typeof(v_window) <> 'object'
     or exists (select 1 from jsonb_object_keys(v_window) k where k not in ('combat_id', 'kind', 'label', 'view', 'choices', 'state'))
     or jsonb_typeof(v_window -> 'state') <> 'object'
     or exists (select 1 from jsonb_array_elements(v_window -> 'choices') c
                 where jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'user_id') not in ('string', 'null')) then
    raise exception 'fenêtre invalide' using errcode = '22023';
  end if;
  if app.campaign_role(v_campaign) is null and not app.is_world_admin(app.campaign_world_id(v_campaign)) then
    raise exception 'hors de la campagne' using errcode = '28000';
  end if;
  v_combat := (v_window ->> 'combat_id')::uuid;
  if v_combat is not null and not exists (select 1 from combats c where c.id = v_combat and c.campaign_id = v_campaign) then
    raise exception 'combat hors de la campagne' using errcode = '28000';
  end if;

  insert into roll_windows (campaign_id, combat_id, author_user_id, kind, label, view, choices)
  values (v_campaign, v_combat, auth.uid(), v_window ->> 'kind', v_window ->> 'label', v_window -> 'view', v_window -> 'choices')
  returning id into v_id;
  insert into app_private.roll_window_states (window_id, state) values (v_id, v_window -> 'state');
  return v_id;
end;
$$;
revoke execute on function public.engine_open_roll_window(text, text) from public, anon;
grant execute on function public.engine_open_roll_window(text, text) to authenticated;

-- 6. Répondre : sa propre ligne seulement (le MJ pour celles d'un
--    participant), une fois. Rend la fenêtre, ou null si refusé.
create function public.answer_roll_window(p_window uuid, p_index int, p_use boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid    uuid := auth.uid();
  v_row    roll_windows;
  v_choice jsonb;
begin
  if v_uid is null or p_index is null or p_use is null or p_index < 0 then
    return null;
  end if;
  select * into v_row from roll_windows where id = p_window for update;
  if not found or v_row.status <> 'pending' or v_row.answers ? p_index::text then
    return null;
  end if;
  v_choice := v_row.choices -> p_index;
  if v_choice is null then
    return null;
  end if;
  if v_choice ->> 'user_id' is null then
    if not app.is_world_admin(app.campaign_world_id(v_row.campaign_id)) then return null; end if;
  elsif v_choice ->> 'user_id' <> v_uid::text then
    return null;
  end if;
  update roll_windows
     set answers = answers || jsonb_build_object(p_index::text, jsonb_build_object('use', p_use, 'by', v_uid, 'at', now()))
   where id = p_window
   returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke execute on function public.answer_roll_window(uuid, int, boolean) from public, anon;
grant execute on function public.answer_roll_window(uuid, int, boolean) to authenticated;

-- 7. Fermer : quand tout le monde a répondu (l'auteur, un répondant ou le
--    MJ), ou à tout moment par le MJ (« Continuer » : les réponses manquantes
--    valent « passer »). Rend la fenêtre fermée, ou null.
create function public.close_roll_window(p_window uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_uid uuid := auth.uid();
  v_row roll_windows;
  v_gm  boolean;
begin
  if v_uid is null then return null; end if;
  select * into v_row from roll_windows where id = p_window for update;
  if not found or v_row.status <> 'pending' then return null; end if;
  v_gm := app.is_world_admin(app.campaign_world_id(v_row.campaign_id));
  if not v_gm then
    if v_row.author_user_id <> v_uid
       and not exists (select 1 from jsonb_array_elements(v_row.choices) c where c ->> 'user_id' = v_uid::text) then
      return null;
    end if;
    if (select count(*) from jsonb_object_keys(v_row.answers)) < jsonb_array_length(v_row.choices) then
      return null;
    end if;
  end if;
  update roll_windows set status = 'closed', closed_at = now() where id = p_window returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke execute on function public.close_roll_window(uuid) from public, anon;
grant execute on function public.close_roll_window(uuid) to authenticated;

-- 8. Reprendre : le moteur lit l'état figé d'une fenêtre FERMÉE, une seule
--    fois (une seconde reprise est refusée : la suite ne s'applique pas deux
--    fois), et seulement pour l'AUTEUR du jet : la suite s'applique avec ses
--    droits d'aujourd'hui (le MJ pour l'attaque d'un monstre, la joueuse pour
--    son propre jet). Ceux qui réagissent n'écrivent que leur réponse.
create function public.engine_resume_roll_window(p_payload text, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload jsonb;
  v_state   jsonb;
begin
  v_payload := app_private.verify_engine_request(p_payload, p_signature, array['key_id', 'nonce', 'issued_at', 'campaign_id', 'window_id'], 2000);
  update roll_windows w set resumed_at = now()
   where w.id = (v_payload ->> 'window_id')::uuid
     and w.campaign_id = (v_payload ->> 'campaign_id')::uuid
     and w.status = 'closed' and w.resumed_at is null
     and w.author_user_id = auth.uid();
  if not found then
    raise exception 'fenêtre absente, ouverte ou déjà reprise' using errcode = '28000';
  end if;
  select s.state into v_state from app_private.roll_window_states s where s.window_id = (v_payload ->> 'window_id')::uuid;
  return v_state;
end;
$$;
revoke execute on function public.engine_resume_roll_window(text, text) from public, anon;
grant execute on function public.engine_resume_roll_window(text, text) to authenticated;

-- 9. Temps réel : la RLS de `roll_windows` s'applique.
alter publication supabase_realtime add table roll_windows;

-- 10. Le changement signé gagne `turn_usage` (le reste est inchangé).
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
         or exists (select 1 from jsonb_object_keys(v_usage) k where k not in ('reaction_at', 'once'))
         or jsonb_typeof(v_usage -> 'reaction_at') not in ('string', 'null')
         or jsonb_typeof(v_usage -> 'once') <> 'object'
         or exists (select 1 from jsonb_each(v_usage -> 'once') e where jsonb_typeof(e.value) <> 'string')
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
