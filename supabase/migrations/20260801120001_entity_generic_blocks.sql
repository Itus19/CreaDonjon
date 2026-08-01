-- V0-06e : resume/tags/contenu narratif de l'entite disparaissent de la
-- fiche — tout passe desormais par des blocs (docs/BACKLOG.md V0-06e).
-- `summary` n'etait affiche nulle part dans l'UI actuelle (verifie par
-- grep) ; il ne servait qu'a ponderer `search_fr`. `tags` etait indexe
-- (`entities_tags_idx`) mais jamais exploite par une requete du code.
--
-- Le type de bloc `description` (wiki) devient `text` : meme contenu
-- (segments narratifs porteurs de visibilite), mais son nom ne presuppose
-- plus un role — le titre libre du bloc porte desormais le sens. `gallery`
-- devient `image` (une image + une legende optionnelle, plus de tableau
-- d'images). Aucune donnee reelle en production a migrer : seul le jeu de
-- demonstration (scripts/seed-dev.ts) utilise ces types, mis a jour a part.
--
-- Note : `ruleset_overrides.block_type = 'description'` (seed-dev.ts) et
-- `src/core/schemas/rule-blocks/blocks.ts` appartiennent au catalogue des
-- blocs de REGLES (specs/regles-blocs.md), un systeme de types entierement
-- distinct des blocs de wiki modifies ici — non concerne par ce
-- renommage.

-- La colonne generee search_fr depend de la fonction a 3 arguments ; il
-- faut la retirer avant de pouvoir supprimer `summary`.
drop index if exists entities_search_idx;
alter table entities drop column search_fr;
drop function if exists app.entities_search_fr(text, text, text[]);

create function app.entities_search_fr(p_name text, p_aliases text[])
returns tsvector
language plpgsql
immutable
as $$
begin
  return to_tsvector('french'::regconfig,
    unaccent(coalesce(p_name, '')) || ' ' || unaccent(array_to_string(p_aliases, ' ')));
end;
$$;

drop index if exists entities_tags_idx;

alter table entities
  drop column summary,
  drop column tags,
  drop column narrative_content;

alter table entities add column search_fr tsvector generated always as (
  app.entities_search_fr(name, aliases)
) stored;

create index entities_search_idx on entities using gin (search_fr);

-- Le layout `gallery` de l'enveloppe de bloc (specs/wiki-blocs.md §1) suit
-- le meme renommage que le type de bloc — rien d'autre ne l'utilisait.
-- (Rien a migrer en base : `display`/`layout` vit dans le Zod, pas dans une
-- colonne contrainte par un check ici.)
