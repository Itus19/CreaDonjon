-- V0-07 (suite) : `digest(p_token, 'sha256')` echoue en "function digest(
-- text, unknown) does not exist" — verifie en testant le lien de partage
-- reel. pgcrypto exige un premier argument bytea ; un litteral texte passe
-- tel quel dans une requete ad hoc s'accommode d'un typage souple, mais un
-- parametre plpgsql type `text` non caste ne resout aucune surcharge.
-- Cast explicite en bytea, verifie a la main (encode(digest('abc'::bytea,
-- 'sha256'),'hex') retourne bien la valeur de reference connue).
create or replace function app.resolve_share_link(p_token text)
returns table (world_id uuid, world_name text, world_slug text, scope text)
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  return query
    select w.id, w.name, w.slug, sl.scope
    from share_links sl
    join worlds w on w.id = sl.world_id
    where sl.token_hash = encode(digest(p_token::bytea, 'sha256'), 'hex')
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > now());
end;
$$;
