-- ADR 0111 (V3.2-13) — L'attitude perçue : ce qu'un PNJ laisse voir.
--
-- `entity_attitudes.axes` porte ce que la source RESSENT envers la cible.
-- Deux colonnes portent ce qu'elle MONTRE, quand c'est différent :
--   * `entity_attitudes.shown_axes` : la façade courante, même forme que
--     `axes`. NULL = la source montre ce qu'elle ressent. Un axe absent de
--     la façade retombe sur l'axe ressenti (src/core/psyche/perception.ts).
--     Cache, comme `axes` : reconstruit en rejouant les événements.
--   * `attitude_events.shown_deltas` : le journal de la façade, en ajout
--     seul, rejoué avec le même amortissement que `deltas`.
--
-- Aucune table nouvelle, aucune politique à changer : les politiques de
-- 20260829120001_psyche_tables.sql portent sur la ligne entière.
-- La valeur ressentie ne doit jamais partir vers un client qui ne doit voir
-- que la façade (règle absolue 5) : c'est la couche service qui en répond.

alter table entity_attitudes add column if not exists shown_axes jsonb;
alter table attitude_events add column if not exists shown_deltas jsonb not null default '{}'::jsonb;

comment on column entity_attitudes.shown_axes is 'ADR 0111 : ce que la source laisse voir à la cible (façade). NULL = elle montre ce qu''elle ressent.';
comment on column attitude_events.shown_deltas is 'ADR 0111 : deltas bruts de la façade, rejoués comme deltas.';
