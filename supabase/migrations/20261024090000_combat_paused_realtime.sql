-- V3.1-38 — l'outil Initiative refondu.
--
-- 1. « Quitter le combat » suspend sans rien perdre (décision du 4 octobre,
--    retouches 2 et 3 ; choix de l'auteur du 24 octobre : un statut à part,
--    pas `ended`). Un combat suspendu garde ordre, round, tour, PV et états ;
--    le MJ le reprend tel quel ou le recommence. Suspendu et terminé restent
--    distincts dans la liste des combats. Les joueuses ne le voient plus comme
--    actif (service `getPlayerCombatView`) : elles retrouvent leur fiche.
-- 2. Temps réel (ADR 0040) : les joueuses écoutent leur ligne `combats`
--    (lisible des membres de la campagne, rien de secret : statut, round,
--    tour) et relisent leur vue filtrée. `combat_participants` n'est PAS
--    publiée : elle reste fermée au MJ.

alter table combats drop constraint if exists combats_status_check;
alter table combats
  add constraint combats_status_check check (status in ('draft', 'rolling', 'running', 'paused', 'ended'));

alter publication supabase_realtime add table combats;
