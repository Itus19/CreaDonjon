# 0017 — Cartes (Lot I) : blocs propriétaires/référents, visibilité en ET, activation de `assets`

**Date :** 2026-09-01
**Statut :** acceptée

## Contexte

Retour utilisateur, captures d'écran d'un outil de référence à l'appui : un bloc `map` sur une fiche, avec punaises, zones (polygones) et couches, chacun pouvant être public ou masqué au public — et une fiche peut vouloir *réutiliser* la carte d'une autre fiche avec un cadrage différent (ex. la fiche d'un personnage centrée sur son village natal, alors que la carte elle-même appartient à la fiche du continent).

Trois décisions structurantes, prises avant d'écrire du code.

## Décision 1 — Un bloc `map` est propriétaire OU référent, jamais les deux

**Propriétaire** (`mode: "own"`) : porte l'image (un `asset`), et c'est lui qui possède les punaises/zones/couches (`map_pins.block_id`, `map_regions.block_id`, `map_layers.block_id` pointent vers CE bloc).

**Référent** (`mode: "ref"`) : ne porte ni image ni punaises/zones à lui — pointe vers un bloc propriétaire (`sourceBlockId`) et ne stocke qu'un cadrage par défaut (`defaultView: {x, y, zoom}`) qui lui est propre. Modifier une punaise sur le bloc propriétaire la modifie partout où elle est référencée ; le cadrage, lui, reste propre à chaque bloc référent.

Alternative rejetée : chaque bloc entièrement indépendant (sa propre image, ses propres punaises). Plus simple, mais duplique le placement des punaises à chaque réutilisation et désynchronise silencieusement les copies — rejeté explicitement par l'utilisateur.

Punaises/zones/couches vivent dans de vraies tables (jamais dans le JSON du bloc) : elles ont besoin d'une visibilité propre filtrée côté serveur (§4 bis, RLS) — un sous-champ JSON ne peut pas porter de RLS.

## Décision 2 — Visibilité d'un élément ET de sa couche, jamais l'une sans l'autre

Retour utilisateur : « les points, les zones et les couches répondent aux mêmes besoins que n'importe quelles infos [...] je dois pouvoir les masquer aux joueurs ». Une couche porte donc sa propre `visibility_level`, distincte de celle de chaque punaise/zone qui lui est rattachée.

Un viewer voit un élément seulement si **`canSee(élément) ET canSee(couche assignée, si présente)`** — jamais l'un sans l'autre. Une punaise publique posée sur une couche `gm` reste invisible à un joueur ; réciproquement une couche publique n'expose pas une punaise explicitement marquée `gm`. La couche la plus restrictive gagne toujours.

Distinct du brouillard (V2-I2, `map_region_reveals`) : le brouillard révèle une région *déjà visible en base* à mesure que la campagne avance (mécanisme de découverte, par campagne) — la visibilité de couche ci-dessus décide qui a even le DROIT de la voir un jour, jamais un état qui progresse.

## Décision 3 — Active `assets` (Storage) maintenant, jamais `entity_portraits` (bytea) pour les cartes

`entity_portraits` stocke l'image en `bytea` directement dans Postgres — simple, jamais branché à un vrai stockage de fichiers, jamais utilisé au-delà d'un portrait (quelques centaines de Ko). Le critère du ticket (« carte de 4000 px, vignette d'abord ») et la table `assets` déjà prévue en base (`docs/SCHEMA.md` §18, jamais câblée) rendent `bytea` inadapté ici.

Décision, à la demande explicite de l'utilisateur : construire l'interface de stockage prévue par CLAUDE.md règle 16 bis (jamais un appel direct à Supabase Storage depuis un composant) et l'utiliser pour les cartes — puis, dans un second temps séparé, migrer `entity_portraits` vers la même interface plutôt que de garder deux mécanismes de fichiers en parallèle.

Bucket Supabase Storage géré par migration (`insert into storage.buckets`), jamais créé à la main dans le tableau de bord — même discipline que le reste du schéma (rien qui vive hors des migrations versionnées).

## Conséquences

- Nouvelles tables : `map_pins`, `map_regions`, `map_layers` (toutes avec `visibility_level`/`visibility_scope_id`, RLS), `block_id` plutôt que `entity_id` (le brouillon initial du ticket dans `docs/BACKLOG_V2.md` visait `entity_id` — révisé ici pour porter le modèle propriétaire/référent).
- Nouvelle interface `src/server/services/storage.ts` (upload/URL/suppression), implémentation Supabase Storage — swappable plus tard pour du disque local (cible locale, specs/cible-locale-et-ia.md) sans toucher aux appelants.
- Portée volontairement étalée en phases (voir `docs/BACKLOG_V2.md`, Lot I) : l'infrastructure de stockage d'abord (bloque tout le reste), puis bloc+image, puis punaises, puis zones, puis couches, puis mode référent, puis migration de `entity_portraits` en tout dernier — jamais en un seul morceau.
