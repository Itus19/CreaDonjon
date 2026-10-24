# 0088 — Accords et structures d'union

**Date :** 2026-10-24
**Statut :** proposée (V4-E7)

## Contexte

Un seul booléen d'exclusivité ne sait pas dire le couple libre (exclusif en amour, pas en sexe), le libertinage (sexualité vécue ensemble), le polyamour solo, ni le harem.

## Options envisagées

- **A.** Une orientation par cas, sans changer l'union — l'union ne sait toujours pas ce qui a été convenu.
- **B.** L'union porte une **structure** et un **accord** ; les orientations relationnelles proposent l'accord.

## Décision

**B.** Structures `pair`, `centered` (une personne au centre et plusieurs partenaires : polygynie, polyandrie, harem d'hommes ou de femmes), `group`. Accord `{ romantic_exclusive, sexual_exclusive, sexual_shared, primary_ids }`. Orientations ajoutées : `open_relationship`, `libertine`, `solo_poly`. `infidelity` devient « rompre l'accord convenu », quel qu'il soit. Les normes de la culture jugent les structures ; un membre contraint relève de la traite et des violences sexuelles, toujours voilées. Détail : `specs/simulation-monde.md` §8.5.

## Conséquences

- Les réactions de jalousie se lisent dans une table par orientation, en données.
