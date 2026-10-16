# 0049 — Rejoindre sans choisir de PJ, et le lien qui vise un PJ

**Date :** 2026-10-09
**Statut :** acceptée, réalisée (V3.1-100, 16 octobre 2026)

## Contexte

Rejoindre exige aujourd'hui un PJ ouvert (`missing_entity` dans `accountProvisioning.ts`). L'auteur veut qu'on rejoigne sans PJ (puis le carrousel), et qu'un lien puisse viser un PJ précis. `campaign_invites` n'a pas de colonne de personnage.

## Décision

- `campaign_invites.entity_id uuid null references entities(id) on delete set null` : un lien **nominatif**. Migration et `docs/SCHEMA.md`.
- `accountProvisioning` accepte un joueur **sans** `entityId` (adhésion seule) ; la réclamation se fait ensuite par le carrousel. Un lien nominatif non encore utilisé **réserve** son PJ.
- **Réservation** : le service `listUnclaimedCharacters` exclut un PJ réservé par un lien actif non utilisé, **sauf** pour la joueuse arrivée par ce lien, à qui il rend seulement ce PJ (et la carte « Nouveau personnage »), avec `startOn` = ce PJ. La réclamation (`claimOwnOpenCharacter`, fonction SQL) accepte un PJ réservé seulement si l'appelant a utilisé le lien qui le réserve.
- Gestion de campagne (V3.1-54) : « pour : [PJ ▾] (facultatif) » à la génération d'un lien joueur.

## Conséquences

V3.1-100 passe « prêt (Opus) ». Les écrans (V3.1-82, 86) lisent `startOn` et la liste filtrée du serveur.

## Réalisation (V3.1-100, 16 octobre 2026)

- Migration `20261016090000_nominative_player_invites.sql`. Un lien nominatif est **à usage unique** : `accountProvisioning` retient qui l'utilise (`claimed_by_user_id`, course-safe sur le lien) et n'écrit plus jamais dans `campaign_characters`. La page `/rejoindre` dit « Ce lien a déjà servi » avant le formulaire, pour ne pas créer un compte pour rien.
- La réservation dure tant que le lien n'est pas révoqué. Révoquer un lien nominatif ne retire l'accès à personne (lien joueur, migration 20261001140000) ; cela libère seulement le PJ.
- **Écriture de `campaign_characters` réservée au MJ.** L'ancienne politique laissait tout compte connecté s'attribuer une ligne libre ou en insérer une, donc devenir éditeur de la fiche (`app.can_edit_entity` lit cette table) et contourner la réservation. Une joueuse réclame par `public.claim_campaign_character` : un PJ ouvert non réservé, le PJ que lui réserve son lien, ou une fiche qu'elle vient de créer (« Nouveau personnage », réclamée avant ses blocs).
- `public.list_claimable_characters` dit à l'écran de choix quels PJ montrer ; la règle d'affichage (lien nominatif → ce PJ seul, ouvert sur lui) est pure (`src/core/campaigns/claimable.ts`).
- La liste anonyme des PJ par jeton (`list_unclaimed_campaign_characters`) est supprimée : Rejoindre ne choisit plus de PJ, et elle aurait montré un PJ réservé à tout porteur d'un lien ouvert.
- Gestion de campagne : « pour : [PJ] » à la génération d'un lien joueur ; les liens nominatifs sont rangés avec les liens à usage unique.
