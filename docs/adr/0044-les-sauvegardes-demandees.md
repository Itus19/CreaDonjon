# 0044 — Les sauvegardes demandées à la cible

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-39)

## Contexte

Un effet à sauvegarde (Moquerie cruelle) n'est pas lancé par l'auteur : la cible résiste. Il faut demander le jet au joueur de la cible (ou au MJ pour un PNJ), recevoir le résultat, puis appliquer l'effet. Aucun effet ne porte de restriction de cible (`zEffectData`).

## Options envisagées

- **A.** Garder la demande dans `entity_runtime_state.pending_request` (comme le solo) — une seule demande par entité, pas de lecture croisée auteur/cible.
- **B.** Une table `save_requests` : une ligne par demande, lue par l'auteur, la cible et le MJ.

## Décision

B.
- **Table `save_requests`** : `campaign_id`, `combat_id` null, `origin_roll_id` (le jet de l'auteur), `author_user_id`, `target_kind` (`entity` | `participant`), `target_id`, `target_user_id` null (le joueur qui répond ; null = le MJ), `ability`, `dc`, `effect` (jsonb : dégâts et états à appliquer selon réussite ou échec, calculés par le moteur à la demande), `status` (`pending` | `answered` | `cancelled`), `natural` null, `total` null, `answered_by`, horodatages. RLS : lecture par l'auteur, la cible (`target_user_id`) et le MJ ; création par le serveur pour l'auteur ; **réponse** par la cible ou le MJ (une fonction `app.answer_save_request`, qui n'écrit que `natural`/`total`/`status`).
- **Qui applique** : la réponse est traitée par le serveur **au nom de celui qui répond** — le joueur de la cible applique sur **son** PJ, le MJ sur un PNJ ou un participant. Aucun privilège nouveau (pas d'ADR 0041).
- **Restriction de cible** dans `zEffectData` : `target?: { creature_types?: string[]; exclude_creature_types?: string[]; immune_conditions_block?: boolean }`, validée par Zod ; une fonction pure `isValidTarget(effect, target)` refuse avant toute demande (Charme-personne sur un mort-vivant). Les fiches SRD concernées la reçoivent par l'import.
- **Temps réel** : les clients écoutent `save_requests` (RLS respectée) ; la pastille du dé encoché compte les demandes `pending` de l'utilisateur.

## Conséquences

Une table, une fonction, `docs/SCHEMA.md`, tests RLS. Les écrans : bandeau de la cible (lancer, vrai dé avec « modificateur inclus », laisser le MJ), Initiative en combat, Table hors combat (V3.1-38, 34).

## Réalisation de la restriction de cible (V3.1-110, 17 octobre 2026)

- `immune_conditions_block` est une **liste d'états**, pas un booléen : l'effet doit dire quel état il impose pour qu'une immunité le bloque (Charme-personne : `["charmed"]`). Types et états en minuscules.
- `isValidTarget` (`src/core/rules/targetRestriction.ts`) lit un profil `{ creatureType, conditionImmunities }` : le type du bloc de stats (`creatureTypeOf`, premier mot), « humanoid » pour un PJ. Un type inconnu (saisie libre) n'est jamais refusé par une liste de types ; une immunité connue refuse toujours.
- Les restrictions viennent de `data/srd/spell-targets.json`, **par édition** (en 2024, les soins ne disent plus « sans effet sur les morts-vivants »), posées sur le premier effet par l'import ; un sort sans bloc `effects` (Charme-personne) en reçoit un, avec sa sauvegarde. Un sort saisi mais introuvable arrête l'import.
- La fiche d'un sort affiche la restriction sous l'effet (« Cible : Humanoïde seulement · Une immunité à Charmé protège »).
- La demande de sauvegarde (V3.1-111) appellera `isValidTarget` avant de créer la demande.

## Réalisation de la demande et de la réponse (V3.1-111, 17 octobre 2026)

- Migration `20261017120000_save_requests.sql` : la table de la décision, plus `target_entity_id` (la fiche de la cible, pour le bonus de sauvegarde de son joueur) et `label`.
- **Création par le MJ seulement** tant que les joueurs ne ciblent pas (ADR 0041, V3.1-104) : l'effet figé dans la demande s'applique au PJ du répondant, et une joueuse qui pourrait créer une demande pourrait en fabriquer une fausse (« 100 dégâts ») contre le PJ d'une autre.
- **« Cibler » avec un sort à sauvegarde** vérifie la cible (`isValidTarget`, avant de dépenser l'emplacement), lance le sort et ses dégâts, fige les deux issues (dégâts ; états imposés = `immune_conditions_block`) et crée la demande — le MJ répond pour un monstre, le joueur pour son PJ. Plus de jet de sauvegarde fait d'office par le serveur.
- **Écart avec « aucun privilège nouveau »** : depuis V3.1-101 (ADR 0040), un joueur n'écrit plus la ligne de combat de son PJ. `set_own_participant_vitals` lui rend une écriture étroite — PV, PV temporaires et états de SON PJ, ce qu'il change déjà sur sa fiche — même patron que `set_own_initiative`. Le MJ peut l'annuler (journal du combat).
- **La réponse** (`answerSaveRequest`) : lancer par le serveur ou vrai dé (« modificateur inclus ») ; la fonction de réponse d'abord, puis le jet (attribué, V3.1-89), un `roll` qui porte la demande et son jet d'origine, l'application et son `rule_application`. Rien n'est relancé : les dégâts sont ceux de la demande.
- Routes : `GET /api/campaigns/[campaignId]/save-requests` (en attente, vues par l'appelant) et `POST …/save-requests/[requestId]/answer`. Le temps réel (publication de la table) viendra avec l'écran qui l'écoute.
