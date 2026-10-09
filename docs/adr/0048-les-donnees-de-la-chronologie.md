# 0048 — Les données de la Chronologie du monde

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-96)

## Contexte

La frise générale (décidée le 9 octobre) a besoin d'une portée par date, d'une place pour les événements ajoutés directement, et des naissances et morts des fiches personnage.

## Options envisagées

- Portée : un champ obligatoire, ou optionnel avec défaut par genre. Événements directs : une table nouvelle, ou une fiche système. Agrégation : une lecture par fiche, ou une requête groupée.

## Décision

- **Portée** : `scope?: "major" | "notable" | "detail"` sur une entrée de bloc Chronologie, **optionnel** ; absent = défaut par genre (guerre, catastrophe, fondation → `major` ; bataille, découverte, serment, trahison → `notable` ; naissance, mort, rencontre → `detail`) calculé par une fonction pure. Naissances et morts des fiches personnage : `detail`. Version de bloc relevée, migration lue par le schéma.
- **Événements directs** : une **fiche système** par monde, `entity_kind = 'world_timeline'`, créée à la première date ajoutée, avec un bloc Chronologie ; exclue des listes du wiki (comme `session_journal`). Un index unique partiel (`world_id` où `entity_kind = 'world_timeline'` et non supprimée) — migration et `docs/SCHEMA.md`.
- **Agrégation** : `getWorldTimeline` lit les blocs Chronologie et les blocs personnage du monde **en deux requêtes groupées** ; chaque date garde la visibilité de son bloc, **filtrée côté serveur** (règle 5) ; chaque entrée dit sa source. Les séances n'y entrent pas.

## Conséquences

V3.1-96 passe « prêt (Opus) ». Le noyau (V3.1-97) reçoit la portée déjà résolue.
