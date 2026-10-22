# 0069 — Le temps qui passe est un événement

**Date :** 2026-10-22
**Statut :** proposée (V4-A3) · **Remplace :** `specs/psyche-pnj.md` §1 (« pas de dérive de fond »)

## Contexte

La V2 interdisait toute évolution sans événement explicite, parce que chaque mouvement coûtait des tokens ou de l'attention. La V4 simule en code pur : ce coût disparaît. Les plans gratuits interdisent toujours une tâche de fond.

## Options envisagées

- **A.** Une tâche planifiée qui fait vivre le monde — interdite par les quotas, et le monde vivrait sans personne.
- **B.** Un rattrapage paresseux par figure — économe, mais non déterministe dès que deux figures interagissent.
- **C.** Le monde entier avance quand le temps de jeu avance, par pas alignés sur des frontières absolues.

## Décision

**C.** Une horloge absolue en minutes depuis l'an 0 du calendrier. Quatre classes de distance (`scene`, `near` à l'heure, `far` au jour, `light` au mois). `advanceWorld(from, to)` traite les frontières dans l'ordre chronologique, avec un budget et une reprise par curseur. Avancer en deux fois ou en une donne le même monde. Détail : `specs/simulation-monde.md` §2.

## Conséquences

- Rien ne bouge tant que personne ne joue.
- Un long voyage peut demander plusieurs appels : l'écran le dit.
- En campagne avec MJ, seuls les gestes du MJ lancent la simulation.
