-- V3.1-107 (ADR 0069) — le moteur lit le combat au nom d'un joueur.
--
-- Pour résoudre l'attaque d'un joueur, le serveur doit lire la cible (CA, PV)
-- dans `combat_participants`, que le joueur ne lit pas (ADR 0040). Comme pour
-- l'écriture (ADR 0041, `apply_engine_change`), la base ne rend ces lignes
-- qu'à une demande SIGNÉE par le serveur, avec la même clé : un joueur qui
-- appelle cette fonction lui-même n'a pas de signature valide.
--
-- Mêmes refus que l'écriture : clé inconnue ou inactive, signature fausse,
-- `issued_at` à plus de 60 s, `nonce` déjà vu (table commune : une demande
-- d'écriture ne se rejoue pas en lecture). Les clés permises diffèrent de
-- celles d'un changement (`combat_id` ici, `changes` là) : l'un ne passe
-- jamais pour l'autre. Ne rend que les participants d'un combat de la
-- campagne nommée.

create function public.engine_read_combat(p_payload text, p_signature text)
returns setof combat_participants
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload jsonb;
  v_secret  bytea;
  v_issued  timestamptz;
  v_combat  uuid;
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
  if not exists (select 1 from combats c where c.id = v_combat and c.campaign_id = (v_payload ->> 'campaign_id')::uuid) then
    raise exception 'combat hors de la campagne' using errcode = '28000';
  end if;

  return query select * from combat_participants cp where cp.combat_id = v_combat order by cp.display_order;
end;
$$;

revoke execute on function public.engine_read_combat(text, text) from public, anon;
grant execute on function public.engine_read_combat(text, text) to authenticated;
