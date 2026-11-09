# 0091 — Les sorts à sauvegarde d'une joueuse

**Date :** 2026-11-09
**Statut :** acceptée (V3.1-200) ; migration `20261108120000_player_save_requests` à appliquer par l'auteur

## Contexte

Une demande de sauvegarde (`save_requests`, ADR 0044) porte un effet figé (dégâts déjà lancés, états imposés), que le serveur applique au personnage de celui qui répond. Jusqu'ici, seul le MJ pouvait la créer : ouverte aux joueuses, l'une d'elles aurait pu fabriquer une demande « 100 dégâts » contre le PJ d'une autre. Conséquence : une joueuse ne lançait aucun sort à sauvegarde sur une cible (Injonction, Charme-personne, Immobilisation de personne…). Mante de majesté (Collège de la séduction) ne se jouait donc que par le MJ, alors que la règle ne pose aucune limite. Défaut au passage : le refus (`save_gm_only`) tombait après le lancer, emplacement dépensé.

## Décision

La demande d'une joueuse s'écrit par un **changement signé du moteur** (ADR 0041), nouveau genre `save_request` :
- le **serveur** calcule l'effet (sort connu ou accordé, dégâts lancés par lui, règle 8) et signe ; la joueuse n'écrit jamais la ligne (la RLS d'insertion reste réservée au MJ) ;
- le changement est **fermé** (`zSaveRequestChange`, et la même liste dans la fonction SQL) : combat, cible, libellé, caractéristique, DD, effet, jet d'origine ;
- la base **déduit** ce qui donne un droit : la cible doit être un participant d'un combat de la campagne nommée ; la fiche de la cible et le compte qui répond viennent de cette ligne et de `campaign_characters` (le joueur du PJ, sinon le MJ) ; l'auteur est l'appelant ; un jet d'origine hors des sessions de la campagne est ignoré ;
- l'échec d'office ou le désavantage d'une sauvegarde (ADR 0079, 0080) se lit, côté joueuse, par la lecture signée des effets (ADR 0073).

Viser le PJ d'une autre joueuse reste possible, comme à la table : la demande vient du vrai sort, et c'est l'autre joueuse qui répond.

## Conséquences

- « Cibler » s'ouvre aux sorts à sauvegarde dans l'outil de dés de la joueuse ; « Lancer un sort » d'une aptitude (Mante de majesté) lance pour elle.
- Tant que la migration n'est pas appliquée, la base refuse le genre `save_request` : le jet d'une joueuse finit en 503 (« Prévenez le MJ »), et le MJ garde son chemin.
