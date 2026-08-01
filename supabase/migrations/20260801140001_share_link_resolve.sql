-- V0-07 — Partage en lecture seule (SCHEMA.md §18).
--
-- Un visiteur anonyme n'a aucune session Supabase Auth : les policies RLS
-- de `share_links`/`worlds` (scopees a app.is_world_member) lui refusent
-- systematiquement l'acces, meme pour verifier un jeton valide. La seule
-- operation qui a besoin de contourner la RLS est cette resolution — le
-- reste de la lecture publique (entites/blocs) passe ensuite par un client
-- service-role scope a ce seul usage cote application (jamais reutilise
-- ailleurs), filtre par src/core/visibility comme n'importe quel lecteur.
--
-- Le hachage se fait ici (pgcrypto, deja installee migration 001), jamais
-- cote application : une seule implementation du "jeton en clair -> hache
-- compare" plutot que deux qui pourraient diverger.
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
    where sl.token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > now());
end;
$$;

revoke execute on function app.resolve_share_link(text) from public;
grant execute on function app.resolve_share_link(text) to anon, authenticated;

-- Wrapper mince expose via PostgREST (le schema `app` n'est jamais expose
-- directement — meme raison que public.search_entities, migration
-- 20260801110001). Pas besoin d'etre security definer lui-meme : appeler
-- une fonction security definer depuis un appelant security invoker
-- execute quand meme celle-ci avec ses propres privileges.
create or replace function public.resolve_share_link(p_token text)
returns table (world_id uuid, world_name text, world_slug text, scope text)
language sql
stable
security invoker
set search_path = public
as $$
  select * from app.resolve_share_link(p_token);
$$;

revoke execute on function public.resolve_share_link(text) from public;
grant execute on function public.resolve_share_link(text) to anon, authenticated;
