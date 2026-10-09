# 0043 — Ce que les joueurs modifient : la base ferme, le serveur règle

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-23 ; applique l'ADR 0036 §5)

## Contexte

`entity_runtime_state` (PV, états, inspiration, emplacements, dés de vie…) est écrit par **tout membre du monde** (`20260730150001_rls.sql`) : une joueuse peut, par l'API, changer les PV d'une autre ou d'un PNJ. Les six interrupteurs « ce que les joueurs modifient eux-mêmes » (`campaigns.table_settings`, ADR 0036 §5) doivent en plus refuser certaines écritures de la joueuse **sur sa propre fiche**, alors que le moteur (repos, résolution) écrit les mêmes champs pour elle.

## Options envisagées

- **A.** Tout faire en base : RLS `can_edit_entity` + déclencheur qui compare l'ancien et le nouvel état champ par champ selon les interrupteurs — le déclencheur ne sait pas distinguer une écriture du moteur (repos) d'une écriture à la main.
- **B.** La base ferme ce qui n'est pas à soi ; le serveur applique les interrupteurs.

## Décision

B.
- **RLS** de `entity_runtime_state` et `entity_active_effects` : écriture par `app.can_edit_entity(entity_id)` (le MJ, le propriétaire, les octrois) au lieu de « tout membre ». Lecture inchangée.
- **Interrupteurs** : une fonction pure `mayPlayerChange(field, settings)` (`src/core/campaigns/tableSettings.ts`) et une garde dans **chaque service** qui écrit un champ réglé pour une joueuse (états, inspiration, PV, pièces, emplacements, dés de vie) : un appelant qui n'est pas MJ et dont l'interrupteur est coupé reçoit un refus (403). Le moteur passe par ses propres fonctions (repos, résolution), qui ne consultent pas les interrupteurs.
- **Écart assumé** : une joueuse qui écrirait directement en base pourrait encore changer **sa propre** fiche malgré un interrupteur coupé (c'est sa fiche, et le journal le montre). Le jour où l'ADR 0041 donne au moteur un chemin d'écriture signé, les champs réglés pourront être fermés en base aussi.
- La colonne `campaigns.table_settings` (déjà acceptée) arrive dans le même ticket : migration, `docs/SCHEMA.md`, `zCampaignTableSettings`.

## Conséquences

Ferme une écriture croisée entre joueuses. Les écrans (fiche, Table, Règles actives V3.1-57) lisent les interrupteurs pour cacher les commandes, mais la règle vit dans le serveur.
