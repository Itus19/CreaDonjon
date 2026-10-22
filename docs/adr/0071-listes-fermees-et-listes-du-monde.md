# 0071 — Listes fermées, et ce qu'un monde peut ajouter

**Date :** 2026-10-22
**Statut :** proposée (V4-A6)

## Contexte

La V2 annonçait des pôles configurables par monde. La V4 a des dizaines de listes ; certaines sont lues par le moteur (besoins, émotions, actions, éthiques, rêves, genres d'événements), d'autres seulement décrites (préférences, étiquettes d'identité).

## Options envisagées

- **A.** Tout extensible — un monde ajoute une émotion que personne ne sait évaluer.
- **B.** Tout fermé — un univers de cour ne peut pas ajouter « loyauté ↔ ambition ».
- **C.** Fermé quand le moteur lit, extensible quand c'est descriptif.

## Décision

**C.** Fermées, dans le code : besoins, émotions, rêves, éthiques et réponses, actions, genres d'événements, réputations. Extensibles par monde : facettes et valeurs **descriptives** (affichées, saisissables, transmises au modèle, sans effet moteur ; l'écran le dit), préférences, étiquettes d'identité (avec libellé libre). Masquer une entrée par défaut est permis ; la retirer, non. L'extension vit dans un bloc `world_lists` sur une fiche système du monde (même patron que `world_timeline`).

## Conséquences

- Aucune donnée d'un monde ne peut casser le moteur.
- Rendre une facette ajoutée « active » demandera d'écrire ses effets : un ticket, pas un réglage.
