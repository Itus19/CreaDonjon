-- V3.1-112 (ADR 0044) — les écrans des sauvegardes demandées écoutent la table.
--
-- Realtime respecte la RLS de `save_requests` (V3.1-111) : l'auteur, le
-- joueur de la cible et le MJ reçoivent les lignes qu'ils lisent déjà ;
-- personne d'autre. Un seul canal par page, filtré sur la campagne
-- (docs/QUOTAS.md Q3) : pastille du dé encoché, bandeau de la cible, listes
-- du MJ, issue revenue à l'auteur.

alter publication supabase_realtime add table save_requests;
