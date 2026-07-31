-- specs/outils-mj.md §1 : le generateur de rencontres (V2) aura besoin, par
-- creature, du facteur de puissance/XP/type/taille ; le suivi d'initiative
-- de la CA et des PV. Plutot que de parier que le mapping actuel (P0-08)
-- les a tous conserves sous une forme exploitable, on garde l'objet JSON
-- source integral : remapper plus tard devient un script local, pas un
-- reimport.

alter table ruleset_entries add column source_raw jsonb;
