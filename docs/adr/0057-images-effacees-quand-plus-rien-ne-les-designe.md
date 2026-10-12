# ADR 0057 — Une image est effacée quand plus rien ne la désigne

**Date** : 12 octobre 2026 · **Ticket** : V3.1-128 · **Statut** : accepté

## Contexte

Remplacer l'image d'une carte, ou supprimer un bloc `map`, laissait ses deux fichiers (carte et vignette) dans le stockage : 1 Go sur le plan gratuit (`docs/QUOTAS.md` Q5). Le recensement du 12 octobre en trouve 19, 27,8 Mo sur 31,5 Mo stockés, tous des essais de carte remplacés.

Mais une image de carte peut être **partagée** : dupliquer une fiche (`duplicateEntity`) ou un bloc recopie `assetId` tel quel. Effacer sans compter casserait la copie. Et le compte ne peut pas se faire avec les droits de l'appelant : la RLS de `blocks` cache certains blocs même au MJ (`private`, `user`).

## Options

1. **Fonction SQL `security definer`** qui compte les références dans tout le monde de l'image.
2. **Sans migration** : compter avec les droits du MJ. Un bloc privé d'une joueuse qui désigne l'image la ferait effacer sous elle.
3. **Copier les fichiers à la duplication**. Les cartes déjà dupliquées partagent quand même leurs images : un compte reste nécessaire.

## Décision

Option 1, choisie par l'auteur. `app.asset_reference_count(asset_id)` (migration `20261012120000`) :
- ne répond qu'à un membre du monde de l'image, et ne renvoie qu'un nombre ; sinon `null`, lu comme « encore utilisée » ;
- compte les blocs du monde dont les données contiennent l'identifiant (tout type de bloc, fiches à la corbeille comprises), `block_images`, `entity_assets` et `background_images`.

Le serveur (`deleteAssetIfUnreferenced`) n'efface qu'**après** l'écriture qui abandonne l'image, et seulement à un compte de 0.

**L'historique ne compte pas.** `entity_revisions` est immuable et garde tout : s'il comptait, aucune image ne serait jamais libérée. Restaurer une ancienne version d'une carte dont l'image a été remplacée rend donc une carte sans image. C'était déjà le cas des blocs `image` et des portraits (V2-L1).

## Conséquences

- Plus d'orphelin nouveau pour les cartes. Un échec d'effacement est journalisé, n'annule pas l'écriture, et laisse au pire un orphelin.
- Avant que la migration soit appliquée, l'appel échoue et rien n'est effacé : l'app reste sûre.
- Les orphelins anciens se recensent avec `npm run recenser:images-orphelines`, en lecture seule. Leur effacement reste une décision de l'auteur.
