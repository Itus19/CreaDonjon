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

## Réalisé (V3.1-96, 13 octobre 2026)

- **Portée.**
  - `scope` facultatif sur une entrée, et `resolveScope` (`src/core/timeline/worldTimeline.ts`).
  - Les genres que la décision ne classe pas (`trauma`, `custom`) valent `detail` : la frise ne met rien en avant sans qu'on le choisisse.
  - **Écart** : `__v` n'est pas relevé. Un champ facultatif garde valides les blocs écrits avant, et une nouvelle version aurait imposé une migration sans gain.
- **Fiche système.**
  - `world_timeline`, index unique partiel.
  - **Ajouté** : la création de ce genre est réservée au MJ dans `entities_insert`. Tout membre pouvait créer une entité de n'importe quel genre, donc un joueur aurait pu occuper la place unique (migration `20261013160000`).
  - Les genres cachés du wiki sont regroupés dans `WIKI_HIDDEN_KINDS` (troisième cas : règle des trois).
- **Agrégation.**
  - Les blocs `timeline` et `character` sont lus en **une** requête (`listBlocksByTypesForEntities`).
  - **Ajouté** : la visibilité du **bloc** est filtrée avant celle de l'entrée. Avant, seule l'entrée l'était, et la RLS couvrait le bloc.
  - Chaque entrée porte `source` (`world`, `entity` avec son bloc, `birth`, `death`) et sa portée résolue.
- **Écritures.**
  - `addTimelineEvent` : frise générale pour le MJ ; fiche quelconque selon le droit d'écriture sur la fiche.
  - `setTimelineEntryScope` : `null` rend la portée au défaut du genre.
  - Toutes deux passent par des actions serveur validées par Zod (`app/m/[worldSlug]/(monde)/chronologie/actions.ts`).
