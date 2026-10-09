# 0049 — Rejoindre sans choisir de PJ, et le lien qui vise un PJ

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-100)

## Contexte

Rejoindre exige aujourd'hui un PJ ouvert (`missing_entity` dans `accountProvisioning.ts`). L'auteur veut qu'on rejoigne sans PJ (puis le carrousel), et qu'un lien puisse viser un PJ précis. `campaign_invites` n'a pas de colonne de personnage.

## Décision

- `campaign_invites.entity_id uuid null references entities(id) on delete set null` : un lien **nominatif**. Migration et `docs/SCHEMA.md`.
- `accountProvisioning` accepte un joueur **sans** `entityId` (adhésion seule) ; la réclamation se fait ensuite par le carrousel. Un lien nominatif non encore utilisé **réserve** son PJ.
- **Réservation** : le service `listUnclaimedCharacters` exclut un PJ réservé par un lien actif non utilisé, **sauf** pour la joueuse arrivée par ce lien, à qui il rend seulement ce PJ (et la carte « Nouveau personnage »), avec `startOn` = ce PJ. La réclamation (`claimOwnOpenCharacter`, fonction SQL) accepte un PJ réservé seulement si l'appelant a utilisé le lien qui le réserve.
- Gestion de campagne (V3.1-54) : « pour : [PJ ▾] (facultatif) » à la génération d'un lien joueur.

## Conséquences

V3.1-100 passe « prêt (Opus) ». Les écrans (V3.1-82, 86) lisent `startOn` et la liste filtrée du serveur.
