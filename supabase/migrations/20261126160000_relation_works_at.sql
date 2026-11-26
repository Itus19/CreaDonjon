-- V3.2-30 (ADR 0115, specs/vie-du-monde.md §3, décision 4) : le lien de
-- travail devient une relation du wiki. Une entité reliée à un lieu par
-- `works_at` (source : la personne, cible : le lieu) fait partie de son
-- personnel et remplace l'occupant tiré de même rang
-- (src/core/worldgen/occupants.ts).
--
-- Le vocabulaire reste fermé : la contrainte CHECK est la seule porte
-- d'entrée d'un type, et `RELATION_TYPES` (src/core/relations/inverses.ts)
-- en est le miroir exact.

alter table relations drop constraint relations_relation_type_check;

alter table relations add constraint relations_relation_type_check check (relation_type in (
                    -- famille
                    'parent_of','sibling_of','married_to','adopted_by','ancestor_of',
                    'partner_of','ex_partner_of','half_sibling_of','step_parent_of',
                    -- social
                    'friend_of','rival_of','mentor_of','serves','member_of','leads',
                    'works_at',
                    -- spatial
                    'part_of','located_in','origin_of',
                    -- possession
                    'owns','created','carries',
                    -- narratif
                    'knows','loves','hates','participated_in','witnessed'));
