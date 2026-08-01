-- V0-07 (suite) : pgcrypto (migration 001) s'installe dans le schema
-- `extensions` sur ce projet Supabase, jamais dans `public`/`app` — verifie
-- en interrogeant pg_proc/pg_namespace apres l'echec du premier correctif
-- (le cast bytea seul ne suffisait pas, digest() restait introuvable dans
-- le search_path de la fonction). Qualification explicite plutot que
-- d'ajouter `extensions` au search_path : plus robuste si l'installation
-- change un jour.
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
    where sl.token_hash = encode(extensions.digest(p_token::bytea, 'sha256'), 'hex')
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > now());
end;
$$;
