# 0076 — Ressentir : l'évaluation suit OCC, l'humeur se calcule, le stress s'accumule

**Date :** 2026-10-22
**Statut :** proposée (V4-E1)

## Contexte

Il faut transformer un événement en émotion, différemment selon la personne, sans écrire une règle par couple (événement, émotion).

## Options envisagées

- **A.** Une table complète événement × rôle × émotion — 49 genres × 5 rôles : illisible.
- **B.** La grille OCC (Ortony, Clore, Collins) : bon ou mauvais pour moi, pour un proche, acte louable ou blâmable, et moi qui ai agi ; plus quelques règles propres à un genre.

## Décision

**B.** Rôles (acteur, cible, proche, témoin, auditeur), intensité modulée par facettes et relation, émotions converties en deltas d'attitude. L'**humeur** est calculée (jamais stockée), somme lisible des souvenirs et des besoins, comme les pensées de RimWorld. Le **stress** s'accumule chaque jour ; une crise exige stress haut **et** humeur basse (Dwarf Fortress) ; agir contre ses éthiques coûte du stress (Crusader Kings III). Symétrique positif : l'élan. Détail : `specs/simulation-monde.md` §6.

## Conséquences

- Chaque terme de l'humeur s'affiche avec sa cause.
- Les coefficients de départ se règlent par tests (pas de saturation, pas de monde endormi).
