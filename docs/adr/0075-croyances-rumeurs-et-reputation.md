# 0075 — Croyances, rumeurs et réputation

**Date :** 2026-10-22
**Statut :** proposée (V4-C4)

## Contexte

Dans Dwarf Fortress, une rumeur n'est jamais fausse. Talk of the Town montre l'intérêt de personnages qui se trompent, déforment et mentent. `known_as` (V2) était un premier pas.

## Options envisagées

- **A.** Rumeurs toujours exactes — simple, mais pas d'enquête possible.
- **B.** Croyances avec source, certitude, mutation et mensonge, chez les figures complètes et dans les lieux.

## Décision

**B.** Table `sim_beliefs` : un porteur (figure ou lieu), un événement ou une personne, la version crue, la source, la certitude, le nombre de transmissions, l'exactitude (pour le MJ). Mutations fermées (exagérer, confondre l'acteur, déplacer, omettre), mensonges motivés par `sincerity`, réputation par lieu calculée depuis les croyances. **Un PJ ne voit le monde qu'à travers ses croyances.** Détail : `specs/simulation-monde.md` §9.

## Conséquences

- Les figures légères ne portent pas de croyances : leur lieu en porte pour elles.
- `is_accurate` ne quitte jamais le serveur vers un joueur.
