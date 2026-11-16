# 0100 — La couverture du SRD : ce que « jouable » veut dire, et le compte jusqu'à 100 %

**Date :** 2026-11-16
**Statut :** acceptée (V3.1-139 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

L'ADR 0059 vise une table où toute règle en jeu se joue par le moteur, sans qu'un modèle la lise. La vue « règles non jouables » (V3.1-132) ne regarde que trois catégories (aptitudes, sorts, objets magiques), et sur un seul critère : la règle porte-t-elle un bloc mécanique ? Mesuré le 16 novembre sur l'officiel, ce critère trompe :
- **Sorts :** 338 sur 339 seraient non évalués. Pourtant 153 se jouent déjà par leur bloc d'effets (attaque, sauvegarde, dégâts : le jet ciblé, ADR 0098).
- **Armes et armures :** elles se jouent par leurs données (propriétés, CA), sans bloc de briques.
- **Monstres :** leurs 317 blocs de stats se jouent par les actions chiffrées ; leurs traits restent en prose.
- **Espèces, classes, sous-classes :** elles se jouent par leurs aptitudes, qui sont des fiches à part.

Les lacunes déclarées (bloc `coverage`) sont du texte libre : on ne peut pas dire quelle brique manque le plus.

## Options envisagées

1. **Où vit le compte** (choix de l'auteur).
   - A : **un rapport généré**, `docs/couverture-srd.md`, écrit par un script en lecture seule, relancé après chaque ticket de données et commité. L'historique Git montre la progression.
   - B : un tableau de bord dans l'app, calculé à chaque ouverture.
2. **Les lacunes par brique** (choix de l'auteur).
   - A : **une étiquette en données**, `brick`, dans un vocabulaire fermé, sur chaque lacune.
   - B : un regroupement déduit des mots du texte.

## Décision

**1-A, 2-A.**

### Jouable, par catégorie

Une fonction pure du noyau, `coverageOf(catégorie, faits)`, rend `playable`, `partial`, `unevaluated` ou `out_of_scope`, et le détail des lacunes. Les faits sont les types de blocs présents, les lacunes, et quelques champs lus (les actions d'un monstre).

| Catégorie | Jouable quand | Partielle quand |
|---|---|---|
| Aptitude, don, objet magique | un bloc mécanique (ADR 0059) | des lacunes déclarées |
| Sort | une activation, **ou** un bloc d'effets (attaque, sauvegarde, dégâts) | des lacunes déclarées |
| Arme, armure | toujours (ses données suffisent au moteur) | — |
| Monstre | toutes ses actions ont un jet ou des dégâts chiffrés | des actions sans chiffre, ou des traits non joués |
| Espèce, classe, sous-classe | toutes ses aptitudes atteintes sont jouables | l'une d'elles est partielle ou non évaluée |
| État | la clé est dans la liste des états joués par le moteur | — |
| Historique, monture, règle générale, équipement d'aventurier | **hors du compte** (`out_of_scope`) : rien à jouer, ou joué ailleurs | — |

Un **trait de monstre** en prose compte comme une lacune de la brique `monster_trait`, tant qu'il n'est pas traduit en briques.

### Les briques manquantes

Une lacune gagne un champ facultatif, `brick`. Il est choisi dans un vocabulaire fermé, tenu dans le noyau (`COVERAGE_BRICKS`), qui grandit par ticket. Les briques de départ viennent des lacunes existantes :
- `timing` : le moment n'est pas vérifié (« en prenant l'action Attaque », « au jet d'Initiative ») ;
- `duration_formula` : une durée en formule ;
- `choice` : le choix d'une forme, d'une créature, d'une option ;
- `slot_regain` : regagner des emplacements de sort ;
- `turn_restriction` : restreindre le tour d'une créature ;
- `equipment_condition` : une fin ou une condition liée à l'équipement ;
- `ending_event` : une fin sur un événement non émis (Neutralisé, mort, repos long) ;
- `monster_trait` : un trait de monstre ;
- `other`.

Une lacune sans étiquette compte dans `other`. L'éditeur de briques propose la liste.

### Le rapport

`scripts/couverture-srd.ts` lit l'officiel en lecture seule et écrit `docs/couverture-srd.md` :
- le compte par catégorie (jouable, partielle, non évaluée) ;
- les lacunes par brique, avec les règles concernées ;
- les règles les plus fréquentes en jeu d'abord : aptitudes des niveaux 1 à 5, sorts des niveaux 0 à 3.

Coût (QUOTAS) : une lecture paginée des fiches et de leurs blocs de l'officiel, à la main, jamais dans l'app ni dans les tests.

La vue « règles non jouables » du MJ s'étend aux espèces et aux monstres, avec la brique de chaque lacune, et utilise la même fonction `coverageOf`.

## Conséquences

- Le schéma du bloc `coverage` gagne `brick` (facultatif, aucune migration : c'est du `jsonb` validé par Zod). Les lacunes existantes sont étiquetées.
- `COVERAGE_ENTRY_TYPES` s'élargit ; `coverageState` reste pour la fiche d'une règle, et `coverageOf` devient la source du compte.
- Découpé en V3.1-212 à 215.
