# 0093 — Tester un monde généré

**Date :** 2026-10-30
**Statut :** proposée (V4-G9, V4-G10)

## Contexte

Une simulation émergente peut produire des absurdités (un mort qui agit), des mondes morts (un peuple éteint en vingt ans) ou des mondes plats. Dwarf Fortress rejette les mondes qui ne respectent pas ses seuils et se juge à l'œil dans le mode Légendes.

## Décision

Cinq outils : des **contrôles de cohérence** (un échec est un bogue, jamais silencieux) ; le **rejet automatique et silencieux** des mondes ratés, régénérés avec la graine dérivée suivante (au plus 5 essais, la graine retenue enregistrée), décision de l'auteur ; un **banc de 100 mondes** dans les tests du noyau ; un **rapport de génération** dans les Légendes ; un **indice d'intérêt** (profondeur des chaînes de causes). Détail : `specs/simulation-monde.md` §13.6.

## Conséquences

- Le joueur ne reçoit jamais un monde mort ni absurde.
- Régénérer depuis la graine enregistrée redonne le monde retenu, pas le monde rejeté.
