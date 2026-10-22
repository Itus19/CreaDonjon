# 0072 — Les couches de la psyché V4

**Date :** 2026-10-22
**Statut :** proposée (V4-B1)

## Contexte

Six pôles décrivent un personnage ; ils ne le font pas vivre. L'auteur vise la richesse de Dwarf Fortress, dont la psyché a été relevée dans DFHack et le wiki (`docs/recherche/simulation-inspirations.md`).

## Options envisagées

- **A.** Garder six pôles et ajouter des besoins — trop pauvre pour l'émergence.
- **B.** Recopier Dwarf Fortress — 170 émotions, 550 pensées : impossible à écrire en règles, et ce n'est pas notre jeu.
- **C.** Les couches de Dwarf Fortress, à notre échelle, complétées où il est faible.

## Décision

**C.** 50 facettes en six familles (dont `sincerity`, prise à HEXACO), 35 valeurs communes aux personnes et aux factions, 15 éthiques typées à 7 réponses (lignes rouges mécaniques), 3 besoins du corps et 25 de l'esprit, 19 types de rêves, 22 familles d'émotions à trois intensités, préférences libres. Stockage −100…+100 et bandes nommées conservés. Blocs `personality` et `worldview` en version 2, lus depuis la version 1 par une conversion pure. Détail : `specs/psyche-v4.md`.

## Conséquences

- La saisie à la main devient lourde : le questionnaire (lot D) est indispensable.
- L'horizon `session` des aspirations disparaît ; les envies du moment viennent des besoins.
