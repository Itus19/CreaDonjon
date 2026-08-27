-- Ordre manuel des fiches (glisser-depose, V2-G9) : meme patron que
-- blocks.display_order, un numeric jamais renumerote entierement, une
-- moyenne fractionnaire par insertion.
alter table entities add column display_order numeric not null default 0;

-- Backfill : conserve l'ordre visuel actuel (le plus recent d'abord, comme
-- listEntitiesForWorld le lit deja) comme point de depart plutot que 0
-- partout, qui rendrait le premier classement instable au sein d'un groupe
-- avant le premier glisser-depose.
with ranked as (
  select id, row_number() over (partition by world_id, entity_kind order by created_at desc) as rn
  from entities
)
update entities e set display_order = ranked.rn * 1000
from ranked where e.id = ranked.id;

-- Ordre manuel des categories de la sidebar (V2-G9) : tableau des cles de
-- groupe (les 8 types fixes, "pj"/"pnj", ou une categorie personnalisee).
-- Vide par defaut -> repli sur l'ordre alphabetique actuel, aucune
-- migration de donnees necessaire.
alter table worlds add column entity_kind_order jsonb not null default '[]'::jsonb;
