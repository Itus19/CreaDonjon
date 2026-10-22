# 0079 — Les lots de simulation : proposer, appliquer, défaire

**Date :** 2026-10-22
**Statut :** proposée (V4-F3, V4-F4)

## Contexte

Le MJ humain veut accepter ou rejeter ce que la simulation propose, élément par élément. Le solo applique tout. Avec l'effet papillon, rejeter un fait sans ses suites laisserait des conséquences sans cause.

## Options envisagées

- **A.** Réutiliser `ai_proposals` — une sortie du moteur n'est pas une sortie de modèle, et sa validation n'est pas la même.
- **B.** Des lots et leurs éléments, communs aux deux modes.

## Décision

**B.** `sim_batches` et `sim_batch_items`. Chaque élément porte ses événements, ses effets, l'état `before` et ses dépendances (conservatrices). Mode `propose` : relu avant écriture ; tant qu'un lot attend, la simulation ne repart pas. Mode `auto` : appliqué aussitôt. Modifier se limite au résumé et à la portée. Défaire un élément appliqué n'est possible que dans le **dernier** lot (restauration de `before` et compensations). Détail : `specs/simulation-monde.md` §12.

## Conséquences

- V3-F2 (annuler un tour) défait aussi le lot du tour.
- Corriger un lot ancien passe par un fait marquant, pas par une réécriture.
