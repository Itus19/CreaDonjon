# ADR 0076 — PV temporaires, dé relu, et regain d'une ressource contre une autre dépense

**Date** : 7 novembre 2026 · **Ticket** : V3.1-183 · **Statut** : accepté

## Contexte

Le Collège de la séduction (Manuel des joueurs 2024, p. 66) demande trois choses que les briques ne savaient pas dire :
- Mante d'inspiration : « autant de points de vie temporaires que le double du nombre obtenu sur le dé d'Inspiration bardique » ;
- Magie envoûtante : se récupère « en dépensant l'une de vos Inspirations bardiques » ;
- Mante de majesté : se récupère « en dépensant un emplacement du 3e niveau ou supérieur ».

Le vocabulaire des effets est fermé (`triggers.ts`) : l'élargir est une décision consignée.

## Options

1. Détourner `heal` pour des PV temporaires : faux (les soins s'additionnent, plafonnent au maximum et relèvent un mourant).
2. Une action `temp_hp`, et un moyen de relire le dé lancé par l'effet précédent.
3. Pour le regain : une seconde ressource « miroir » dépensée par une utilisation à la main — fragile, et la fiche ne dirait pas ce que coûte le regain.

## Décision

- **`temp_hp`** rejoint le vocabulaire des effets : `{ action: "temp_hp", who, amount }`. Appliquée par `applyEffects` avec `grantTempHp` : on garde le plus grand des deux, jamais la somme. Le serveur l'écrit comme tout changement de PV (participant ou état de jeu).
- **Le dé relu** : dans une liste d'effets (`resolveEffectList`), le résultat d'un effet `roll` devient `event.last_roll` pour les effets qui suivent. Le dé est lancé une fois, par le générateur injecté (règle 8) ; aucun nouvel opérateur de formule.
- **Le regain** : une ressource déclarée peut porter `regain` — `{ kind: "resource", key, amount }` ou `{ kind: "slot", min_level }`. `planResourceRegain` (pur) décide et rend les compteurs ; la route `resource-regain` n'accepte qu'une intention, relit la fiche et l'état de jeu côté serveur, et écrit les deux compteurs dans le même changement. Contre un emplacement, le plus petit libre au niveau minimal ou au-dessus.

## Conséquences

- L'éditeur de briques propose « PV temporaires » et, sur la carte d'une ressource, « Regagner une utilisation en dépensant… » ; la fiche montre « Regagner (− 1 Inspiration bardique) » sur une ressource entamée.
- `event.last_roll` n'existe qu'à l'intérieur d'une même liste d'effets ; un déclencheur n'en hérite pas d'un autre.
- Un regain ne se fait pas automatiquement : c'est un geste de la joueuse, comme dans le livre.
