-- V2-H2 phase 3 (docs/BACKLOG_V2.md) : `occurred_at_ingame` (texte libre,
-- `personality_events`/`attitude_events`, V2-H1) devient une date de jeu
-- structuree maintenant que le calendrier existe (phase 1) — meme forme
-- que `GameDate` (src/core/schemas/calendar.ts::zGameDate).
--
-- Conversion, jamais un vidage (critere du ticket) : chaque texte deja
-- saisi devient le `label` de sa nouvelle date structuree (qui prime
-- toujours a l'affichage, formatGameDate) — les coordonnees calendaires
-- restent vides tant que personne ne les renseigne, mais AUCUNE valeur
-- deja saisie ne disparait. `year`/`precision` recoivent des valeurs
-- neutres (0/"era") uniquement pour satisfaire la forme du type, jamais
-- lues tant que `label` est present.

alter table personality_events add column occurred_at_ingame_date jsonb;
alter table attitude_events    add column occurred_at_ingame_date jsonb;

update personality_events
set occurred_at_ingame_date = jsonb_build_object(
  'year', 0, 'month', null, 'day', null,
  'precision', 'era', 'end', null,
  'label', occurred_at_ingame
)
where occurred_at_ingame is not null;

update attitude_events
set occurred_at_ingame_date = jsonb_build_object(
  'year', 0, 'month', null, 'day', null,
  'precision', 'era', 'end', null,
  'label', occurred_at_ingame
)
where occurred_at_ingame is not null;

alter table personality_events drop column occurred_at_ingame;
alter table attitude_events    drop column occurred_at_ingame;

alter table personality_events rename column occurred_at_ingame_date to occurred_at_ingame;
alter table attitude_events    rename column occurred_at_ingame_date to occurred_at_ingame;
