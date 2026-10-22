# 0084 — Jouer sa psyché rapporte l'Inspiration

**Date :** 2026-10-22
**Statut :** proposée (V4-H5)

## Contexte

L'auteur veut que la psyché d'un PJ soit une récompense, pas une contrainte (Burning Wheel, Fate). En solo, le moteur ne lit pas la prose : il ne peut pas juger qu'un joueur « a joué » sa colère.

## Options envisagées

- **A.** Le modèle juge — interdit (règle 8).
- **B.** Le joueur déclare son **motif** dans la barre d'intention, parmi une liste fermée tirée de son état (émotion forte du moment, valeur prioritaire, rêve actif) ; le moteur vérifie que ce motif existe vraiment.

## Décision

**B.** Une puce facultative « par… » dans la barre d'intention (V3-B1). Si le motif correspond à l'état du PJ et que l'action comporte un risque (un jet demandé), le moteur accorde l'Inspiration héroïque (effet `grant_inspiration`, ADR 0050), au plus une fois par scène. Avec un MJ humain, l'écran lui **suggère** ces moments ; il accorde ou non. L'élan (`specs/simulation-monde.md` §6.5) propose aussi l'Inspiration.

## Conséquences

- La barre d'intention gagne une puce, sans changer ce qu'elle résout.
