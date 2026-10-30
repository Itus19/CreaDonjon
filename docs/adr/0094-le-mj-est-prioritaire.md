# 0094 — Le MJ est prioritaire

**Date :** 2026-10-30
**Statut :** proposée (V4-F7)

## Contexte

Le MJ peut modifier une fiche pendant que la simulation tourne. Qui gagne quand la fiche dit une chose et l'état courant une autre ?

## Options envisagées

- **A.** La simulation gagne — le MJ perd la main sur son monde.
- **B.** Un abonnement en temps réel aux changements — coûte du quota pour un besoin qui n'est pas instantané.
- **C.** Le MJ gagne toujours, et le moteur réconcilie au début de chaque lot.

## Décision

**C.** Ce que le MJ écrit fait foi : la simulation ne le réécrit jamais, elle peut seulement le proposer. Au début de chaque lot, les fiches modifiées depuis la dernière simulation sont comparées à l'état courant, qui est mis à jour ; chaque écart devient un ajustement du MJ au journal. Les éléments d'un lot en attente qui reposent sur une figure modifiée depuis sont périmés et ne peuvent plus être acceptés. Décision de l'auteur, le 30 octobre. Détail : `specs/simulation-monde.md` §11.4.

## Conséquences

- Aucun temps réel : une modification compte au prochain lot.
- Le MJ n'accepte jamais une proposition calculée sur un état qui n'existe plus.
