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
