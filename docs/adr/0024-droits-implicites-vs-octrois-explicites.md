# 0024 — Un droit qu'aucun geste ne peut reprendre n'a pas sa place dans `can_edit_entity`

**Date :** 2026-09-15
**Statut :** acceptée

## Contexte

`canEditEntity` (et son miroir SQL `app.can_edit_entity`) a grossi par
accumulation de cas particuliers. Aux quatre cas d'origine (V2-M3) se sont
ajoutés deux cas « je l'ai créée moi-même » :

- **5.** sa propre fiche de notes privée (`entity_kind = 'notes'`, V2-M7b) ;
- **6.** sa propre entrée du Livre de sessions (`entity_kind =
  'session_journal'`, V2.1-3).

Les deux répondaient au même constat réel : `entities_insert` est ouvert à tout
membre du monde, donc un joueur peut créer une fiche de ce genre, mais aucun des
quatre cas précédents ne lui permet d'y toucher ensuite.

Le défaut du cas 6 est apparu à l'usage, signalé par l'auteur : **le MJ ne peut
pas reprendre ce droit.** L'outil de gestion de campagne possède depuis V2-M9
une section « Octrois d'édition » qui liste `entity_grants` et porte un bouton
« Retirer ». Le droit de l'autrice n'y figurait pas — il ne figurait nulle part.
Une joueuse qui quitte la table, un texte qu'on veut figer après relecture :
rien ne permettait de fermer la porte.

Un droit inscrit dans la définition d'une fonction RLS n'est pas un droit
accordé, c'est une propriété du schéma de données.

## Options

1. **Laisser le cas 6 et ajouter une exception.** Une colonne « révoqué » sur
   `session_journal_entries`, ou une table de révocations. Deux mécanismes
   concurrents pour la même question, et l'écran des octrois continue de mentir
   par omission.
2. **Faire porter le droit par l'assignation** (`assigned_to`) plutôt que par
   `created_by`. Le MJ reprendrait le droit en réassignant le devoir. Mais le
   geste vit alors dans l'écran du Livre de sessions, pas dans l'outil de
   gestion de campagne où l'auteur le cherche — et supprimer un devoir emporte
   autre chose que le droit.
3. **Retirer le cas 6 et poser un vrai `entity_grants`** à la création de
   l'entrée. Le mécanisme d'octroi, son écran et son bouton « Retirer »
   existent déjà depuis V2-M3/V2-M9.

## Décision

**Option 3.** Le droit de l'autrice devient une ligne `entity_grants` posée par
`public.claim_journal_entry_grant` au moment où elle commence à écrire, avec
pour `granted_by` le MJ qui lui a assigné le devoir — ce qui s'est
littéralement passé.

`entity_grants_write` n'est pas assouplie : elle reste réservée au MJ (« jamais
quelque chose que le bénéficiaire s'accorde lui-même »). La fonction
`security definer` est l'unique exception, et elle est étroite par
construction — elle ne prend aucun `user_id` en paramètre, ne sait poser qu'une
ligne, pour l'appelante elle-même, sur une fiche qu'elle vient de créer, et
seulement si un devoir **en attente** lui est réellement assigné.

**Le cas 5 (notes) reste.** Il ne peut pas suivre le même chemin, et la
différence est instructive : une fiche de notes privée n'est visible d'aucun
autre compte, donc aucun MJ n'a d'octroi à lui accorder ni à lui reprendre. Le
droit implicite y est le seul possible — ce qui est exactement le critère.

## La règle qui en sort

> Un cas « je l'ai créée moi-même » n'entre dans `can_edit_entity` que si la
> fiche concernée est **invisible de tout autre compte**. Dès qu'un MJ peut la
> voir, il doit pouvoir décider qui l'édite : le droit passe par
> `entity_grants`, jamais par la définition de la fonction.

## Conséquences

- L'ordre compte dans `submitJournalEntry` : l'octroi est posé **avant** les
  blocs, car `blocks_insert` appelle `app.can_edit_entity`. Sans lui, l'autrice
  créerait sa fiche puis échouerait à y poser une ligne.
- Les entrées déjà rédigées ont été reprises par la migration elle-même : sans
  cela, leurs autrices auraient perdu leur droit à l'instant de l'application.
- Une entrée rédigée par un MJ porte désormais une ligne d'octroi redondante
  avec son droit d'administration. Choix assumé : une règle uniforme (« toute
  entrée porte un octroi pour son autrice ») se lit mieux qu'une règle à trous,
  et la ligne se retire en un clic.
- `canEditEntity` redescend à cinq cas. C'est la première fois qu'elle rétrécit.
