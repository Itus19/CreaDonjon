# 0072 — La version maison d'une règle officielle : une copie sous la même clé

**Date :** 2026-11-03
**Statut :** acceptée (V3.1-94, choix de l'auteur)

## Contexte

Le ⋮ d'une règle (planche « Règles sur ordinateur ») propose « Créer une version maison (copie dans ta variante, éditable) ». Ce geste n'existait pas : on savait créer une fiche maison neuve (`add_entry`, V1-D4), la modifier (V3.1-2) ou surcharger un bloc d'une règle officielle (`patch_block`/`replace_block`, §9.4), mais pas copier une règle officielle pour la réécrire.

## Options envisagées

- **Copie sous la même clé** : la copie remplace l'officielle partout dans le monde (fiches, renvois, assistant), l'officielle restant intacte dans sa base.
- **Fiche à côté** : nouvelle clé (« … (maison) »), l'officielle reste utilisée partout.
- Reporter le geste.

## Décision

**Copie sous la même clé** (choix de l'auteur, 2 novembre). Elle s'écrit par une surcharge `replace_entry`, déjà prévue par le schéma (SCHEMA.md §9.4) et lue par `applyOverrides` : la charge utile porte l'entrée entière (clé, type, nom, blocs, `zHouseVersionPayload`). Aucune migration.

- **Où** : la variante active du monde ; refus si c'est une base officielle (règle 18 ; la RPC `upsert_ruleset_override` le refuse aussi, et n'écrit que dans une variante dont l'appelant est le créateur). Route `POST /api/worlds/[worldSlug]/rules/house-version`, Zod strict, administrateur du monde.
- **Quoi** : les blocs de la base, traduits, validés bloc par bloc ; seuls les cinq types qui ont un formulaire (sort, sous-classe, aptitude, historique, arme), pour que la copie se modifie ensuite par « Modifier » (V3.1-2), qui réécrit la même surcharge `replace_entry`.
- **Lecture** : `getRuleEntryForWorld` et `resolveOneEntryBlocks` (la mécanique) lisent la copie ; « Modifiée dans ta variante » marque les blocs qui diffèrent de l'officielle (`houseVersionChangedBlocks`), et la bascule Officiel / Ta variante ne fait que lire.

## Conséquences

- Les listes (sommaire, chips) gardent le nom officiel tant que la résolution au niveau liste n'applique pas `replace_entry` (limite déjà notée dans `resolve.ts`) ; la fiche, elle, montre le nom de la copie.
- Revenir à l'officielle n'existe pas encore : il faudrait retirer la surcharge (journal en ajout seul, §9.4). À concevoir si le besoin vient.
- Une variante déjà publiée est copiée en v+1 par la RPC, comme pour toute écriture de fiche maison.
