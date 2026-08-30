-- V2-M10 (Lot M, retour utilisateur) : URL de partage courte et explicite
-- pour un lien "public_only" — "y mettre le nom de la campagne" plutot que
-- le jeton aleatoire de 43 caracteres. Reserve a `public_only` : le
-- contenu qu'il expose est deja destine a n'importe qui, un slug devinable
-- (nom de campagne) n'y change rien. Un lien `players` (jamais encore
-- emis en pratique, cf. src/server/services/shareLinks.ts) garderait le
-- jeton aleatoire comme seule protection — jamais de slug pour ce scope.
alter table share_links add column slug text unique;

comment on column share_links.slug is 'Alias court et lisible (nom de campagne slugifie), public_only uniquement. NULL pour un lien players ou cree avant cette migration — /partage/[token] reste toujours valide.';

-- Resolution par slug OU par jeton (le meme parametre texte peut porter
-- l'un ou l'autre, sans ambiguite possible : un slug ne fait jamais 43
-- caracteres base64url). Postgres refuse un CREATE OR REPLACE qui change
-- les colonnes de sortie d'une fonction existante, mais ici la signature
-- de sortie ne change pas -- CREATE OR REPLACE suffit.
create or replace function app.resolve_share_link(p_token text)
returns table (
  world_id uuid,
  world_name text,
  world_slug text,
  scope text,
  password_hash text,
  password_attempts int
)
language plpgsql
stable
security definer
set search_path = public, app
as $$
begin
  return query
    select w.id, w.name, w.slug, sl.scope, sl.password_hash, sl.password_attempts
    from share_links sl
    join worlds w on w.id = sl.world_id
    where (sl.slug = p_token or sl.token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex'))
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > now());
end;
$$;

create or replace function app.record_share_link_password_attempt(p_token text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  update share_links
  set password_attempts = case when p_success then 0 else password_attempts + 1 end
  where (slug = p_token or token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex'))
    and revoked_at is null;
end;
$$;
