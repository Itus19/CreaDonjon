-- V3.1-104 (ADR 0041, option B) — les écritures du moteur au nom d'un joueur.
--
-- Quand un joueur cible un adversaire, le moteur (serveur) calcule les PV et
-- les états de la cible, que le joueur n'a pas le droit d'écrire. Le serveur
-- SIGNE ce changement (HMAC-SHA256, clé connue du serveur et de la base
-- seulement) ; cette fonction ne l'applique que si la signature est bonne.
-- Sans la clé, un joueur ne peut fabriquer aucun changement accepté.
--
-- La clé vit dans `app_private.engine_signing_keys`, sans aucun droit pour
-- `anon` ni `authenticated` : seule la fonction ci-dessous (security definer)
-- la lit. La poser est un geste manuel (docs/CLE-MOTEUR.md). Deux clés
-- actives à la fois permettent la rotation.
--
-- Écart assumé avec l'ADR : le changement arrive en TEXTE (`p_payload text`),
-- celui-là même que le serveur a signé, et non en `jsonb`. Un `jsonb` réordonne
-- et reformate ses clés : recalculer la signature sur sa sortie ferait
-- dépendre la sécurité d'un détail de sérialisation. Ici l'HMAC porte sur les
-- octets exacts reçus, puis le texte est lu comme `jsonb`.
--
-- Refus (exception, transaction annulée, rien d'écrit) :
-- - clé inconnue ou inactive ; signature fausse ;
-- - `issued_at` à plus de 60 s de l'heure de la base ;
-- - `nonce` déjà vu (un changement ne se rejoue pas) ;
-- - une clé hors liste, au premier niveau ou dans un changement ;
-- - une ligne hors de la campagne nommée.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.engine_signing_keys (
  id     text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  secret bytea not null check (length(secret) >= 32),
  active boolean not null default true
);

create table app_private.engine_change_nonces (
  nonce   uuid primary key,
  seen_at timestamptz not null default now()
);

alter table app_private.engine_signing_keys enable row level security;
alter table app_private.engine_change_nonces enable row level security;
revoke all on app_private.engine_signing_keys from public, anon, authenticated;
revoke all on app_private.engine_change_nonces from public, anon, authenticated;

create function public.apply_engine_change(p_payload text, p_signature text)
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
       or exists (select 1 from jsonb_object_keys(v_change) k where k not in ('kind', 'id', 'hp', 'temp_hp', 'conditions')) then
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
