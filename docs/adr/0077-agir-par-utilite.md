# 0077 — Agir : publicité des besoins et score d'utilité

**Date :** 2026-10-22
**Statut :** proposée (V4-E4)

## Contexte

Il faut qu'une personne choisisse quoi faire selon ses besoins, ses rêves, ses émotions et ses valeurs, sans arbre de décision écrit à la main et sans code fourni par l'utilisateur.

## Options envisagées

- **A.** Arbres de comportement — rigides, du code par personnage.
- **B.** Planification (GOAP) — puissante, coûteuse, difficile à rendre déterministe et bornée.
- **C.** Utilité : chaque action annonce ce qu'elle comble (Les Sims) et se note par des considérations à courbes (IAUS de Dave Mark).

## Décision

**C.** Actions en données, entrées et courbes fermées, compensation de l'IAUS, tirage parmi les trois meilleures par le hasard dérivé. Une éthique `unthinkable` retire l'action. Un rêve donne un petit plan en données (trouver, rejoindre, agir). Un PJ n'est jamais acteur. Détail : `specs/simulation-monde.md` §10.

## Conséquences

- Ajouter une action ne touche à aucune personne.
- Le réglage fin des poids demandera des parties d'essai : il se fait dans les données, sans code.
