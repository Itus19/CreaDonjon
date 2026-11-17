# 0102 — Le système monétaire en données

**Date :** 2026-11-17
**Statut :** acceptée (V3.1-141 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

Depuis le 13 octobre, la monnaie se range en or, argent et cuivre. Le platine et l'électrum forment une réserve : jamais formés, gardés, et cassés seulement au besoin, l'électrum d'abord. C'est codé en dur dans `src/core/rules/currency.ts` (`COMMON_COINS`, `RESERVE_BREAK_ORDER`, `COIN_VALUE_CP`). L'auteur veut le régler sans code, et ajouter des pièces propres à un monde, dans l'esprit de l'ADR 0059 (une règle de jeu vit dans les données).

Le porte-monnaie a cinq cases fixes (`pp`, `gp`, `ep`, `sp`, `cp`), présentes :
- dans le schéma du bloc `inventory` ;
- dans `InventoryPanel` ;
- dans les statistiques d'économie (`totalValueCp`, V2-M12) ;
- dans la route `actions/currency`.

## Options envisagées

1. **La forme du porte-monnaie** (choix de l'auteur).
   - A : **les cinq cases restent, plus `extra: { clé: nombre }`** pour les pièces maison. Les inventaires enregistrés se relisent tels quels.
   - B : tout le porte-monnaie en dictionnaire libre. Tous les écrans et la route changent, et les inventaires existants passent par un adaptateur.
2. **Où vit le système** (choix de l'auteur).
   - A : **un bloc typé « système monétaire »** sur la fiche de règle « Pièces de monnaie » (`standard-exchange-rates`, SRD 5.2.1), qu'une variante surcharge (règle 18).
   - B : un réglage du ruleset, hors des fiches, avec une migration.

## Décision

**1-A, 2-A.**

### Le bloc `currency_system`

Il décrit chaque pièce :
- `key` : l'une des cinq clés connues, ou une clé maison en `snake_case` ;
- `label` : fr et en ;
- `value_cp` : un entier positif, sa valeur en pièces de cuivre ;
- `role` : `common` (elle se regroupe) ou `reserve` (gardée, cassée au besoin).

S'y ajoute `break_order`, l'ordre de casse des réserves.

Le bloc est validé par Zod :
- des clés uniques ;
- au moins une pièce courante, et une pièce de valeur 1, pour que tout total se rende ;
- `break_order` ne cite que des réserves.

**Sans bloc, le système par défaut** est exactement celui du 13 octobre. Il est exporté par le noyau (`DEFAULT_CURRENCY_SYSTEM`).

### Le porte-monnaie

- `zCurrency` garde ses cinq champs et gagne `extra`, un dictionnaire facultatif de nombres entiers positifs ou nuls.
- Une pièce SRD absente du système reste lisible (affichée, comptée à sa valeur standard), mais elle n'est plus formée.
- Une pièce maison absente du système est affichée « inconnue » et comptée à 0, jamais devinée.

### Le moteur

- `depositCoins`, `spendCoins`, `applyCurrencyDelta` et `totalValueCp` reçoivent le système en paramètre (par défaut : `DEFAULT_CURRENCY_SYSTEM`).
- Les 28 tests de `currency.test.ts` restent verts tels quels.
- Le service lit le système par la chaîne de rulesets de la campagne, en une résolution de la fiche « Pièces de monnaie », déjà en cache quand l'inventaire est chargé.

## Conséquences

- Aucune migration SQL : le bloc et le porte-monnaie sont du `jsonb` validé par Zod.
- L'écran d'inventaire affiche les pièces du système (cinq ou plus), et le formulaire de règle sait saisir le bloc.
- Découpé en V3.1-217 à 220.

## Mise en œuvre (17 novembre, V3.1-217 à 220)

- Le système voyage avec le ruleset résolu (`/resolved-ruleset`, en cache 30 s à l'écran) plutôt que par une route à lui : aucune requête de plus pour l'écran.
- Le formulaire écrit par le chemin de l'éditeur de briques (`savePlayableBlocks`, route `rules/playable`) : une seule logique de surcharge (`replace_block`, `add_block`, version maison).
- La route de monnaie refuse une pièce absente du système (`unknown_coin`) : une faute de frappe ne crée pas de pièce.

