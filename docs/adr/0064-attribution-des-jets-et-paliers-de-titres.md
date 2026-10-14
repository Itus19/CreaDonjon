# 0064 — Chaque jet dit qui l'a lancé, pour quel personnage, et de quel genre

**Date :** 2026-10-14
**Statut :** acceptée (V3.1-89 ; fondation des statistiques V3.1-90 à 92)

## Contexte

Les statistiques du joueur (20 et 1 naturels, action favorite, titres) lisent `dice_rolls`. Un jet n'y disait ni qui l'avait lancé, ni pour quel personnage, ni s'il s'agissait d'une attaque ou d'un soin ; le d20 naturel se perdait dans la trace. Deviner après coup à partir du texte aurait été fragile.

## Options envisagées

- **A.** Déduire personnage et genre du libellé (`detail.what`) à la lecture.
- **B.** Les écrire à chaque jet : colonnes `rolled_by_user_id` et `entity_id`, `kind` et `naturalD20` dans `detail`.

## Décision

**B.**

- `DiceRollAttribution` est **obligatoire** dans `insertDiceRoll` : un chemin d'écriture qui l'oublie ne compile pas. Les quatre chemins (fiche jouable, jets demandés, jet libre, intention de tour) la fournissent.
- **Genres** : `attack`, `damage`, `check`, `save`, `spell`, `heal`, `free`. L'initiative compte comme `check` ; les dés de vie comme `heal`.
- **d20 naturel** (`naturalD20FromTrace`) : retenu seulement si la trace porte exactement un tirage `1d20` ou `2d20kh1`/`2d20kl1`, de valeur 1 à 20. Sinon, rien : on n'invente pas un d20.
- **`rolled_by_user_id`** est posé par la base (`default auth.uid()`) et la politique d'insertion refuse toute autre valeur (colonne prévue par l'ADR 0038). **`entity_id`** doit appartenir au monde de la campagne et être modifiable par l'auteur (`app.can_edit_entity`). Le jet libre du joueur prend son personnage réclamé ; celui du MJ reste sans personnage.
- **Exclus des statistiques** : les jets antérieurs (sans `entity_id`, choix de l'auteur du 9 octobre) et tout jet non public, même relu par son auteur : un secret ne se déduit pas d'une moyenne.
- **Paliers de titres** : une table de réglages de plateforme, `player_title_tiers` (superadmin, V3.1-92), pas du contenu de règles. Couleurs limitées à cinq jetons de la charte, icônes à douze clés, actions favorites à cinq genres. Quatorze paliers par défaut.
- **Argent** : inchangé. Les pièces vivent dans le bloc d'inventaire, dont les révisions suffisent (`campaignEconomy`, `getPlayerEconomy`).

## Conséquences

- Le code écrit `entity_id` : il ne part en production qu'après l'application de la migration `20261014090000`.
- Reste ouvert, comme avant : un membre peut insérer directement un jet public au résultat ou au `detail` inventé. Il ne fausse ainsi que ses propres statistiques, jamais celles d'un autre (registre de `SECURITE.md`).
- Une lecture par personnage et par campagne est servie par l'index `(campaign_id, entity_id, created_at desc)`.
