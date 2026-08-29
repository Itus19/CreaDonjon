# 0013 — Tables de la psyché des PNJ (personnalité, attitudes, journal)

**Date :** 2026-08-29
**Statut :** acceptée

## Contexte

V2-H1 (`docs/BACKLOG_V2.md`, `specs/psyche-pnj.md`) demande un bloc `personality` (tempérament, hors campagne) et un bloc `relationship` par relation (attitude envers une cible précise, portée campagne). L'utilisateur a demandé en plus un tableau de « souvenirs » sous le bloc `personality`, visible dans sa propre maquette d'interface — la spec existante ne prévoit qu'un journal `attitude_events`, scopé à une paire (source, cible), rien pour les pôles de tempérament eux-mêmes.

## Options envisagées

- **A. Une seule table d'événements, multi-cibles** — une ligne peut modifier le tempérament ET plusieurs relations à la fois. Rejetée : demande une forme de `deltas` plus complexe (poles + liste de cibles), et l'utilisateur a précisé que le même souvenir peut avoir des conséquences différentes selon où il est raconté (ex. la victime d'un harcèlement et le témoin qui n'est pas intervenu vivent le même moment mais avec des effets différents sur des relations différentes).
- **B. Deux tables séparées, un même patron** — `attitude_events` (déjà spécifiée, par paire) et une nouvelle `personality_events` (par entité, hors campagne). Le même souvenir peut être saisi plusieurs fois, une fois par bloc concerné, chaque saisie portant ses propres deltas. Retenue, sur choix explicite de l'utilisateur.

## Décision

Trois tables, migration `20260829120001_psyche_tables.sql` :

- **`entity_attitudes`** — cache de la valeur courante par paire (source, cible), portée **campagne** (`specs/psyche-pnj.md` §6 : l'opinion du groupe est propre à une partie). Reconstructible en rejouant `attitude_events`.
- **`attitude_events`** — journal en ajout seul, par paire, portée campagne. `deltas` stocke le brut, jamais l'effectif (l'amortissement dépend de la valeur au moment de l'application — `applyDelta` est réappliqué à chaque rejeu, jamais mémorisé).
- **`personality_events`** — même patron, mais scopée à l'**entité seule**, sans `campaign_id` : le tempérament n'est pas propre à une partie (« Bram est Bram partout »), contrairement à une attitude envers quelqu'un.

Les deux tables d'événements portent un champ `occurred_at_ingame` en texte libre — la vraie date de monde (V2-H2, pas encore construite) n'existe pas encore. Voir le critère ajouté à V2-H2 dans `docs/BACKLOG_V2.md` : migrer ce texte libre vers le calendrier réel une fois qu'il existe, sans perdre les valeurs déjà saisies.

RLS : même patron que `sessions`/`entity_runtime_state` (`docs/adr` implicite de `20260730150001_rls.sql`) — un membre du monde peut lire/écrire, la RLS ne filtre que l'appartenance au monde. La visibilité fine (bande nommée plutôt que nombre, `known_as` jamais trahi) est une responsabilité de la couche service, jamais de la RLS — même séparation que le reste du modèle de visibilité (`docs/SCHEMA.md` §4).

## Conséquences

- Un même événement narratif peut apparaître comme plusieurs lignes indépendantes (une par bloc concerné) avec des résumés proches mais des deltas différents — assumé, pas un doublon à corriger.
- `personality_events.session_event_id` reste une référence optionnelle vers une session (via un `session_events.id`), sans rendre la table elle-même dépendante d'une campagne.
- Le calcul des bandes nommées (« méfiant », « confiant »...) et l'amortissement vers les extrêmes vivent dans `src/core/psyche/` (fonctions pures, testées aux bornes) — jamais dans une requête SQL, même règle que le reste du moteur de règles.
