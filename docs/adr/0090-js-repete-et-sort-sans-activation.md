# 0090 — Le JS répété en fin de tour, et « lancer un sort » qui n'a pas d'activation

**Date :** 2026-11-08
**Statut :** acceptée (V3.1-195 et 196)

**Numéro.** 0081 à 0089 sont pris par la branche `eloquent-dirac` (non fusionnée) : ce chantier prend 0090. Au moment de la fusion, les ADR 0078 à 0080 de cette branche-ci entreront aussi en collision avec cette branche-là.

## Contexte

Le Collège de la séduction, saisi avec l'outil de règles, bute sur deux manques du moteur :
- **Magie envoûtante** : la cible charmée ou effrayée refait son JS de Sagesse à la fin de chacun de ses tours. Un effet durable ne s'arrêtait qu'à la fin de sa durée, sur un événement ou sur congé.
- **Mante de majesté** : l'effet « Lancer un sort » (Injonction, gratuit) exigeait que le sort ait sa propre activation. Sur les 339 sorts du SRD 5.2.1, seul Bouclier en a une. Le moteur renvoyait « à jouer à la main ».

## Décision

1. **`repeat_save` sur un effet durable** : `{ ability, dc }`, où `dc` est une formule. Il est calculé à la pose avec les nombres de la source, puis figé dans l'instance (`repeatSave`, dans le `payload` JSON, donc sans migration). À la fin du tour du porteur, la bascule de tour (MJ) lance le d20 côté serveur, avec le bonus et les dés de bonus de la sauvegarde. Chaque jet va au journal. Une réussite retire l'effet par un nouvel événement d'expiration, `save_passed` (raison `save`), et ses états partent avec lui. Le moment est fixe (fin du tour du porteur) : c'est la formule de presque tous les textes de 2024. On généralisera au troisième cas concret.
2. **« Lancer un sort » se rabat sur le jet ciblé** quand le sort n'a pas d'activation mais déclare une sauvegarde. C'est le chemin ordinaire d'un sort à sauvegarde : DD de la lanceuse, demande de sauvegarde à la cible, échecs imposés compris (Mante de majesté contre une cible charmée). Il y a un jet par cible de l'aptitude. `free` traverse jusqu'à `castSpell` par un paramètre de service (`freeCast`), jamais par une entrée de route : ni emplacement, ni sort connu exigé. Un sort sans sauvegarde déclarée, ou lancé hors combat, ou par un joueur (le jet ciblé d'un joueur n'ouvre pas de sauvegarde), reste « à la main », et le moteur dit pourquoi.

## Conséquences

- Injonction n'a pas de sauvegarde dans l'import SRD 5.2.1. Sa « version maison » dans la variante, faite par le formulaire de sort (Effet : Sauvegarde, Sagesse), suffit. D'autres sorts importés sont dans ce cas : 153 blocs d'effets pour 339 sorts.
- L'éditeur de briques doit savoir saisir `repeat_save`, le jeton et la condition d'accès (V3.1-197).
