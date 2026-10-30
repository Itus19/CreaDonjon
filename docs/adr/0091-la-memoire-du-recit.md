# 0091 — La mémoire du récit : le moteur assemble, le modèle raconte

**Date :** 2026-10-30
**Statut :** proposée (lot I)

## Contexte

Les MJ par IA qui gardent toute l'histoire dans la fenêtre de contexte deviennent incohérents au bout de quelques heures : le contexte déborde, on résume ou on tronque, et rien ne fait foi hors du texte. L'auteur l'a constaté en jouant.

## Options envisagées

- **A.** Un long contexte et des résumés glissants — la dérive est seulement repoussée.
- **B.** La vérité en base, un contexte assemblé à chaque tour par couches bornées, et un modèle qui ne fait que raconter.

## Décision

**B.** Dix couches ordonnées, chacune avec un budget et une sélection déterministe ; la couche qui déborde se coupe elle-même. Ce que la narration invente est **capté en propositions** (décision de l'auteur), refusées d'office si elles contredisent la base. Le moteur tient les **fils ouverts** (promesses, dettes, menaces, indices, quêtes). Un **contrôle après coup** déterministe vérifie noms, issues et thèmes voilés ; échec : une régénération, puis un récit sobre composé depuis les faits. Résumé de scène, journal de personnage et reprise sont composés depuis les faits. Détail : `specs/memoire-du-recit.md`.

## Conséquences

- La longueur d'une partie ne change pas la taille du contexte.
- V3-E1, V3-E3 et V3-F1 sont conçus ici ; leurs budgets se mesurent sur de vraies parties.
