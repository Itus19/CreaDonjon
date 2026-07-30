# 0002 — Modèle de visibilité à deux colonnes

**Date :** 2026-07-27
**Statut :** acceptée

## Contexte

Le wiki, les blocs de règles et les journaux de session ont tous besoin de savoir qui peut voir quoi. Une chaîne encodée (« public », « gm-only:campaign123 ») est facile à mal filtrer et impossible à indexer proprement.

## Options envisagées

- **A.** Chaîne encodée libre — flexible, mais parseable de façons divergentes selon l'endroit du code qui la lit.
- **B.** `visibility_level` (6 valeurs fermées) + `visibility_scope_id` (uuid, requis seulement pour `campaign`/`user`) — deux colonnes typées, une fonction pure `canSee()` dans `src/core/visibility`.

## Décision

B. `canSee(subject, viewer, ctx)` est la seule porte d'entrée, testée exhaustivement (36 cas : 6 profils × 6 niveaux). RLS ne fait que filtrer par appartenance au monde en Phase 0 — la visibilité fine (MJ/joueur, blocs) est résolue côté serveur par cette fonction avant envoi, jamais par CSS ni par un champ inutilisé laissé dans le JSON.

## Conséquences

- Toute nouvelle table qui a besoin de visibilité réutilise les deux mêmes colonnes et la même fonction — pas de nouveau format à inventer.
- Un secret de campagne ne fuite pas vers une autre campagne du même MJ : `campaign` exige que `ctx.campaignId` corresponde exactement au `scopeId`.
- Ne pas ouvrir l'application à des joueurs tiers avant la fin de la Phase 2 (RLS fine), c'est un choix de séquencement assumé (SCHEMA.md §19.2), pas un oubli.
