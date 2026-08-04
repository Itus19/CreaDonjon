# 0008 — Lien entre une campagne et l'entité `faction` de son groupe de joueurs

**Date :** 2026-08-04
**Statut :** acceptée

## Contexte

V1-C1 demande que « le groupe de joueurs soit une entité `faction` créée avec la campagne » (`docs/BACKLOG_V1.md`). La table `campaigns`, déjà migrée depuis la Phase 0 (`20260729204002_campaigns.sql`), n'a aucune colonne pour référencer cette entité, et `docs/SCHEMA.md` §11 ne le prévoyait pas.

## Options envisagées

- **A. Nouvelle colonne `campaigns.party_entity_id`** (FK vers `entities`). Lien direct, non ambigu, retrouvable en une jointure. Même patron que `entities.current_mechanical_revision_id`, déjà dans le schéma. Coût : une migration de plus sur une table déjà appliquée.
- **B. Déduire la faction via les relations existantes** (chaque personnage joueur porte une relation « membre de » vers l'entité faction). Aucune migration, mais indirect : rien dans le schéma ne garantit qu'une seule faction est ainsi reliée à une campagne donnée.

## Décision

Option A — `alter table campaigns add column party_entity_id uuid references entities(id) on delete set null` (migration `20260804140001_campaign_party_entity.sql`). Nullable : les campagnes déjà seedées par `scripts/seed-dev.ts` n'en ont pas, et l'imposer `not null` exigerait un backfill sans bénéfice réel — l'invariant « une campagne créée par le service a toujours sa faction » est porté par la couche service, pas par une contrainte SQL.

## Conséquences

- Le service de création de campagne doit créer l'entité `faction` **avant** la ligne `campaigns` (ou dans la même transaction), puis renseigner `party_entity_id` — jamais l'inverse, sinon la fenêtre sans faction s'allonge sans raison.
- `docs/SCHEMA.md` §11 est mis à jour pour lister cette colonne : la doc doit rester la source de vérité du schéma réel, pas seulement des migrations d'origine.
- Aucune donnée existante ne casse : colonne nullable, les campagnes seedées avant cette migration restent valides avec `party_entity_id = null`.
