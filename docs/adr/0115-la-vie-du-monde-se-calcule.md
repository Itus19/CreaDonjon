# 0115 — La vie du monde se calcule : routines déterministes, événements à deux niveaux de détail, régime qui règle leur visibilité

**Date :** 2026-11-26
**Statut :** proposée le 26 novembre 2026 (fil « Mettre à jour les présents selon la pièce ») ; points 2, 3 et 6 choisis par l'auteur ; le reste à relire. Détail : `specs/vie-du-monde.md`.

## Contexte

En solo, les présents d'un lieu ne bougent pas : le personnage dort dix heures et retrouve les mêmes personnes au réveil. L'auteur veut une simulation organique : des routines, des aspirations, des habitués et des gens de passage, une ville qui vit sans le personnage, plus ou moins selon sa taille, son régime et sa stabilité. Les plans gratuits (`docs/QUOTAS.md`) interdisent un tic de fond, et l'ADR 0104 veut que l'IA propose et que le moteur décide.

## Options

- **A — Simuler chaque habitant en continu** (à la Dwarf Fortress). Refusé : un tic de fond, des milliers d'écritures, et rien à gagner tant que personne ne regarde.
- **B — Laisser l'IA dire qui arrive et qui part.** Refusé : des personnes et des faits inventés par un modèle, impossibles à rendre cohérents d'un jour à l'autre.
- **C — Calculer la vie à la demande, à graine fixe, avec deux niveaux de détail.** Retenu.

## Décision

1. **La position d'une personne est une fonction pure** de sa graine, de son archétype, du jour et de l'heure. Seules les exceptions (agenda, états) sont stockées.
2. **Les routines sont à l'heure** (choix de l'auteur).
3. **L'archétype d'un PNJ écrit à la main est déduit de son métier et corrigeable** dans sa fiche (choix de l'auteur).
4. **Les événements se tirent à l'heure autour du personnage, à la semaine ailleurs**, avec un rattrapage paresseux à l'arrivée dans une ville.
5. **Leur fréquence dépend de la taille de la ville et de son régime** (stabilité, emprise, légitimité, cohésion, prospérité). **Leur visibilité dépend de l'emprise** : un régime répressif étouffe ce qui se voit et pousse le reste dans l'ombre. Un événement caché ne se révèle que par les découvertes.
6. **Des événements arrivent sans le personnage** (choix de l'auteur), proportionnés à la ville.
7. **Un questionnaire de dilemmes à la Ultima IV**, au choix de qui crée le personnage, remplit le bloc `personality` (pôles et aspirations). Les PNJ de fond tirent leur psyché à graine fixe.

## Conséquences

- Aucun coût quand personne ne regarde ; un calcul pur et une requête par tour ; un rattrapage borné à l'arrivée.
- Une nouvelle table pour l'agenda et les états (migration à écrire, ticket VM-4), et des agrégats de plus dans le bloc `settlement`.
- Les boucles (stabilité basse → émeutes → stabilité plus basse) exigent des effets bornés et un retour à l'équilibre, faute de quoi une ville s'effondre en quelques semaines.
- La chronique d'avant la partie reste figée (ADR 0104) : cette décision fait vivre le présent, pas le passé.
- Dépend de la ville en agrégat (PR #17, `deriveSeed`, `materializeOccupants`), dont les clients « par moment de la journée » deviennent des clients à l'heure.
