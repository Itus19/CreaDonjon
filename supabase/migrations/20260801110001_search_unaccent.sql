-- V0-06 : `entities_search_fr` ne passait jamais par `unaccent()` malgre
-- l'extension deja installee (migration 001) — verifie empiriquement :
-- rechercher "epee legere" ne trouvait pas une entite nommee "Épée
-- Légère". Recherche par nom/alias/resume "insensible aux accents" est un
-- critere d'acceptation explicite du ticket, pas une amelioration a part.
--
-- unaccent() est STABLE (pas IMMUTABLE) au sens strict de Postgres — meme
-- situation que to_tsvector() deja documentee dans la migration 003 :
-- le wrapper plpgsql marque immutable est le contournement standard,
-- deja en place ici, on l'etend simplement.
create or replace function app.entities_search_fr(p_name text, p_summary text, p_aliases text[])
returns tsvector
language plpgsql
immutable
as $$
begin
  return to_tsvector('french'::regconfig,
    unaccent(coalesce(p_name, '')) || ' ' ||
    unaccent(coalesce(p_summary, '')) || ' ' ||
    unaccent(array_to_string(p_aliases, ' ')));
end;
$$;

-- Un changement de fonction ne recalcule pas retroactivement une colonne
-- generee stockee pour les lignes existantes : cette mise a jour no-op
-- force Postgres a reevaluer search_fr avec la nouvelle definition.
update entities set updated_at = updated_at;

-- Recherche exposee via PostgREST (le schema `app` est prive, jamais
-- expose directement — meme raison que les enveloppes d'import SRD,
-- migration 20260730180002). `security invoker` (par defaut, explicite
-- ici) : la RLS de `entities` s'applique normalement, la recherche ne
-- voit jamais une entite hors des mondes de l'appelant.
create or replace function public.search_entities(p_world_id uuid, p_query text)
returns table (id uuid, name text, slug text, entity_kind text)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.name, e.slug, e.entity_kind
  from entities e
  where e.world_id = p_world_id
    and e.deleted_at is null
    and e.search_fr @@ plainto_tsquery('french', unaccent(p_query))
  order by ts_rank(e.search_fr, plainto_tsquery('french', unaccent(p_query))) desc
  limit 20;
$$;

revoke execute on function public.search_entities(uuid, text) from public;
grant execute on function public.search_entities(uuid, text) to authenticated;
