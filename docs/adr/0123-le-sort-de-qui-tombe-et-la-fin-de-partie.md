# 0123 — Le sort de qui tombe, et la fin de la partie solo

**Date :** 2026-11-28
**Statut :** acceptée le 28 novembre 2026 (choix de l'auteur : « le moteur, selon le but » ; « si le personnage joueur est mort dans une partie solo, la partie se termine et c'est ok »). Suit l'ADR 0122.

## Contexte

Les PNJ ont un but et un moral en combat (ADR 0122), le personnage à terre lance ses jets contre la mort (V3.2-75). Restait : que font les vainqueurs de quelqu'un à terre ? L'auteur : le détrousser, le tuer, le capturer… selon pourquoi il est dans le combat.

## Options

(1) Le moteur décide une seule issue d'après le but et la psyché ; (2) le moteur liste les issues que le but autorise et l'IA choisit. **Retenu : (1).** (2) pourra s'y ajouter comme pour V3.2-73.

## Décision

1. **L'issue** (`sortDuVaincu`, `combatMinds.ts`) : la garde (but `arreter`) **capture** ; sinon un pillard (`piller`) **détrousse** ; sinon un impitoyable **achève** ; sinon on **laisse** à terre. Impitoyable : dureté extrême (`empathy_hardness` ≤ -67) ou haine extrême de l'adversaire (`friendship_hostility` ≤ -67), lu à l'entrée en combat. Qui défend ou veut survivre n'achève jamais.
2. **Pour le personnage**, quand le combat est perdu (il est à terre, plus personne ne se bat de son côté) : capturé, il est Entravé et stabilisé ; détroussé, sa bourse part et le pillard quitte la pièce ; achevé, trois échecs aux jets contre la mort ; laissé, ses jets continuent.
3. **Mort, en solo, la partie est terminée.** Un état dérivé, sans colonne : trois échecs aux jets contre la mort. La barre du tour se ferme, le serveur refuse tout tour. « Annuler ce tour » reste possible.
4. **Stabilisé**, il ne peut pas agir : en combat son tour passe ; hors combat il reprend 1 PV au bout de 1d4 heures (règles 2024), lancées par le serveur et comptées par l'horloge.
5. Un PNJ à terre vaincu par le personnage : c'est la personne qui joue qui décide (« je le fouille », « je l'achève »).

## Conséquences

- Aucune migration. Coût : une fois par combat perdu, une lecture de l'état de jeu, et pour un détroussage la bourse et le système monétaire.
- **Reste** : ~~la captivité comme lieu ; la bourse volée dans l'inventaire du pillard ; les objets détroussés~~ (addendum ci-dessous) ; un PNJ à terre vaincu par un autre PNJ ; l'ennemi impitoyable qui achève pendant le combat (aujourd'hui seulement à la fin).

## Addendum du 28 novembre 2026 (V3.2-77, demande de l'auteur)

- **Le butin passe chez le voleur.** Le pillard prend toute la bourse et ce que le personnage tient en main (`butinVisible`, `loot.ts`) ; jamais un objet caché, ni ce qu'il porte sur lui (ôter une armure prend des minutes, et le pillard lâche vite), ni le fond du sac. Le transfert passe par le règlement des échanges (`applyTrade`) : ce qui sort d'un sac entre tel quel dans l'autre. Le sac du voleur d'avant le tour est relevé dans le journal (`others_inventory_before`) et « Annuler ce tour » le remet.
- **La captivité a un lieu.** Une fois le combat clos, la scène part au lieu où travaille le garde (`works_at`), et le personnage y est enfermé seul, le garde dehors : une cellule de la page du lieu si elle en a une (cellule, cachot, geôle…), sinon une cellule esquissée, ou une pièce fermée à clé si le garde n'a pas de poste connu (`pieceDeCaptivite`). Une pièce réservée au MJ ne sert pas de cellule.
- **Reste** : s'évader, être jugé, être libéré ; ce que le personnage sait de son voleur.
