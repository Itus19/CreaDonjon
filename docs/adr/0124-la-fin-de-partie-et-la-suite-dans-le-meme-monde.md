# 0124 — La fin de partie, et la suite dans le même monde

**Date :** 2026-11-28
**Statut :** proposée. L'auteur veut toutes les options (« elles me paraissent toutes bien »). Reste à valider l'écran (croquis : https://claude.ai/artifact/YCNzkQgkGVcrVBUurDQXNP). Ticket V3.2-78. Suite de l'ADR 0123, point 3.

## Contexte

Depuis l'ADR 0123, à la mort du personnage (trois échecs aux jets contre la mort), la barre du tour se ferme sur une phrase, et rien d'autre. L'auteur veut un écran de fin, et pouvoir continuer dans le monde où le personnage a vécu : avec un autre personnage, un descendant, un compagnon.

## Options

Huit propositions, toutes retenues par l'auteur. Elles ne dépendent pas des mêmes briques, d'où trois étapes.

## Décision

1. **Étape 1, codable maintenant.** Un écran de fin remplace la partie quand le personnage est mort. Il montre :
   - **L'épilogue**, raconté par l'IA. Le moteur lui fournit les faits tirés du journal : la cause de la mort, les témoins, ce que le personnage laisse. L'IA ne décide rien (règle 8). Un appel par fin, journalisé (règle 13).
   - **La chronique**, tirée du journal sans IA : jours vécus, lieux vus, personnes connues, et les moments marquants par jour.
   - **« Revenir avant le coup fatal »**, qui est l'annulation de tour existante, proposée franchement.
2. **Étape 2, après la copie du monde par partie** (projet à part). Ces options écrivent dans le monde (la page du défunt, une tombe, les souvenirs des PNJ). Tant que des parties partagent un monde, elles toucheraient aussi l'autre partie :
   - **Un nouveau personnage**, sans lien avec le défunt.
   - **Un héritier ou une héritière** : un parent tiré de la généalogie, ou créé. Hérite d'une part des biens. Les liens envers le défunt passent au parent, atténués.
   - **Reprendre un compagnon** : un PNJ allié (but `defendre`) devient le personnage joué. Sa fiche allégée devient une fiche complète.
3. **Étape 3, après la simulation d'histoire** (V4, ADR 0109) : **laisser passer le temps** (un an, dix ans, une génération) avant de reprendre. Cette option s'ajoute à celles de l'étape 2.
4. **Recommencer à neuf** dans un monde neuf viendra avec le projet « chaque partie a son monde ».

## Conséquences

- L'étape 1 ne demande aucune migration. Son coût est une lecture du journal et un appel d'IA, une fois par fin.
- L'étape 2 attend la copie du monde par partie. Il faudra un ADR pour l'héritage : la part des biens, le facteur d'atténuation des liens, la création de la fiche.
- Hors périmètre : la mort d'un compagnon ; la mort dans une partie avec un MJ humain, qui décide seul.
