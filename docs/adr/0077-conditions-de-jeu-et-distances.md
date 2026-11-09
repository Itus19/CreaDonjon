# 0077 — Les conditions de jeu et les distances réelles : plan, zones, auras, défenses, conditions d'équipement

**Date :** 2026-11-08
**Statut :** acceptée (V3.1-137 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

L'ADR 0059 a tranché que le moteur tient des **distances réelles en mètres**, sans grille. Il restait à dire comment elles arrivent au moteur.

L'étude range quatorze règles derrière cinq manques, regroupés dans le chantier « conditions de jeu » :

- **M18, les zones** : cône et ligne du Souffle, rayons.
- **M5, les auras** : Aura de protection, alliés à 3 m.
- **M4, résistances, vulnérabilités et immunités** : Rage, Résistance naine, monstres.
- **M17, les conditions d'équipement** : sans armure, arme de finesse, tient l'arme.
- **M9, les règles qui en modifient d'autres** : Aura étendue, Source d'inspiration.

S'y ajoutent les étiquettes d'arme sur `attack_hit` (ADR 0028), qui manquaient.

Aujourd'hui, seul le solo connaît trois zones abstraites (`engaged`, `near`, `far`). La table ne connaît aucune position.

## Options envisagées

1. **D'où viennent les distances** (choix de l'auteur).
   - A : une distance par paire, saisie par le MJ.
   - B : **un plan sans grille où l'on pose les jetons**, positions en mètres ; le moteur calcule toutes les distances et la géométrie.
   - C : des zones étendues par participant.

   A et C approximent, et ne savent pas dire qui est dans un cône.
2. **Les défenses aux dégâts** (choix de l'auteur). A : **appliquées d'office** à tout dégât typé, le journal disant pourquoi. B : signalées seulement.
3. **Une règle qui en modifie une autre**. A : des **retouches fermées**, déclarées par la fiche qui modifie, sur une courte liste de champs (rayon d'aura, recharge, durée, portée). B : une copie de la règle modifiée. B dédouble la donnée.

## Décision

**1-B, 2-A, 3-A.**

### Le plan

- Chaque participant d'un combat porte une **position** `pos_x`, `pos_y` en mètres (nullable : pas encore posé). C'est une colonne de `combat_participants` ; une migration l'ajoute.
- **Qui déplace** :
  - le MJ, tout le monde ;
  - une joueuse, son seul PJ, par une fonction étroite (`set_own_position`, même patron que `set_own_initiative`).

  Un déplacement de son PJ pendant son tour dépense le **mouvement** du budget du tour (ADR 0076). Un dépassement est signalé, jamais bloqué.
- **Qui voit** : les positions des alliés et des adversaires visibles. Le caché et l'invisible relèvent du modèle du monde (138) ; d'ici là, tout ce qui est posé est vu.
- **Distance** : euclidienne entre deux jetons, arrondie au demi-mètre près pour l'affichage. « Au contact », c'est 1,5 m ou moins. Les trois zones du solo deviennent une **lecture** de ces distances (ADR 0059) : contact ≤ 1,5 m, proche ≤ 9 m, loin au-delà. Sans positions, elles restent celles d'aujourd'hui.
- **Sans positions** (personne n'est posé, ou un seul), tout ce qui suit **retombe sur le choix du MJ**, comme aujourd'hui, et le moteur le dit : « portée non vérifiée ».

### Les zones

- Une activation peut viser une **zone** : `targets: { kind: "area", shape: "cone" | "line" | "sphere" | "cube", size, width?, origin: "self" | "point" }`.
- Le joueur pose la zone sur le plan : une direction pour un cône ou une ligne, un point pour une sphère. Le moteur calcule, par une fonction pure de géométrie, **qui est dedans**. Le MJ peut retirer une cible, jamais en ajouter une hors de la zone.
- Une portée (`targets.range`, `trigger.range` de l'ADR 0075) se **vérifie** contre les positions quand elles existent.

### Les auras

- Une fiche, ou un effet qui dure, peut porter `aura: { radius, affects: "allies" | "enemies" | "all", self: boolean, while?: condition, modifiers }`. L'Aura de protection donne ainsi `save + max(1, mod. CHA)` aux alliés à 3 m, tant que le paladin n'est pas Neutralisé.
- Quand le serveur construit une fiche en combat, il ajoute les auras des autres participants dont la position couvre celle-ci, en couche 7, avec leur source. Une aura se recalcule, elle ne se stocke pas (règle 16).

### Les défenses aux dégâts

- Cibles de modificateur `resist.<type>`, `vulnerable.<type>` et `immune.<type>` sur une fiche (la Rage les pose pendant qu'elle dure). Les blocs de stats des monstres en portent déjà (`damage_resistances`…), et le serveur les lit.
- Un dégât **typé** est modifié par une fonction pure (`adjustDamage`) : immunité 0 ; résistance ½, arrondie à l'inférieur ; vulnérabilité ×2 ; résistance et vulnérabilité s'annulent. Un dégât **sans type** n'est jamais modifié. Le journal dit « Lia résiste au feu : 12 → 6 ».

### Les conditions d'équipement

Un modificateur déclaré, ou une activation, peut porter `when` dans un vocabulaire fermé : `armor: none | light | medium | heavy`, `shield: true | false`, `wielding: <propriété d'arme>`. La fiche ne l'applique que si l'équipement le permet : Défense sans armure, fin de la Rage en armure lourde, Attaque sournoise avec une arme de finesse ou à distance (l'arme du jet).

### Les retouches

Une fiche peut déclarer `patches: [{ rule, field, value }]`. `field` est pris dans une liste fermée :
- `aura.radius` ;
- `resource.<clé>.recharge` ;
- `durable_effect.<id>.duration` ;
- `activation.<id>.range`.

La fiche du personnage applique les retouches de ses aptitudes avant de calculer. Aura étendue fait ainsi passer le rayon à 9 m.

### Les étiquettes d'arme

`eventsForAttack` ajoute `weapon:<clé>` et `property:<propriété>` (finesse, distance, lourde…) aux étiquettes de `attack_hit` et `attack_miss`. `event_has` les lit (ADR 0028).

## Conséquences

- **Migration** : `pos_x` et `pos_y` sur `combat_participants`, `set_own_position`, la vue des joueurs (`combat_player_view`) étendue aux positions visibles. Une écriture par déplacement : le temps réel du combat existe déjà (ADR 0040).
- **Un écran** : le plan dans l'Initiative, avec jetons déplaçables au doigt et à la souris, l'outil de zone et une échelle. C'est le plus gros morceau du chantier.
- Le solo garde ses zones tant qu'il n'a pas de plan ; la lecture des zones depuis les distances lui servira quand il en aura un.
- **Découpé** en V3.1-168 (noyau), 169 (migration et service), 170 (le plan et l'éditeur), 171 (données du SRD).
