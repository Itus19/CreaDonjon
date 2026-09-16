# 0025 — Le défilement appartient aux fenêtres et aux barres latérales, jamais au document

**Date :** 2026-09-16
**Statut :** acceptée

## Contexte

L'auteur signale deux gênes, captures à l'appui : une fiche ouverte « a beau
être tout en haut de l'écran, elle déborde en bas » ; et en faisant défiler
avec une fiche ouverte, « la fenêtre reste stable alors que le reste de la page
défile ».

Ce sont deux symptômes d'un même fait : **la page pouvait défiler**. La couche
des fenêtres est `position: fixed`, donc ancrée à l'écran et non au document —
choix correct pour un paradigme de fenêtres flottantes, mais qui suppose que le
document, lui, ne bouge pas.

La cause était à la racine. `<body>` était `min-h-full` : une hauteur
**minimale**, jamais une hauteur à résoudre. Or un pourcentage ne se résout que
contre une hauteur définie. Tout `h-full` en dessous retombait donc sur `auto`,
et chaque coquille s'est bornée dans son coin :

| Coquille | Contournement | Conséquence |
|---|---|---|
| `PlayerShell` | `h-dvh` | Ignore le bandeau « voir comme », qu'un pourcentage soustrairait tout seul |
| `Sidebar`, `RulesSidebar` | `md:h-screen` | 100vh posé **sous** un en-tête de 56 px : la page mesure 56 px de trop |
| `MjSidebar` | aucun | Dix-sept outils sans zone défilante, qui allongent la page quand l'écran est court |

Mesuré avant correction, écran de 1280×800 : `<body>` faisait **856 px** pour
un `<html>` de 800, et `window.scrollTo(0, 500)` laissait la page à
`scrollY = 56` — la hauteur exacte de l'en-tête.

Un commentaire de `BookSkin.tsx` décrivait par ailleurs une borne `h-screen`
d'`AppShell` qui n'a jamais existé. Un contournement par section finit par
produire une description du système que le système ne tient pas.

## Décision

**Le document ne défile jamais dans la coquille de monde. Le défilement
appartient aux barres latérales et aux fenêtres, chacune dans son cadre borné.**

Trois règles s'ensuivent :

1. `<body>` a une hauteur **définie** (`h-full`), pas seulement minimale. Les
   pages hors `/m` continuent de défiler : la taille minimale automatique d'un
   item flex empêche leur contenu d'être écrasé, et leur débordement remonte au
   viewport. Seul un enfant en `min-height: 0` se laisse borner.
2. La coquille de monde (`AppShell`) est ce `min-height: 0` + `overflow-hidden`.
   Elle prend la place restante après le bandeau « voir comme », qui est donc
   soustrait tout seul : aucune constante de hauteur à tenir à jour.
3. Une fenêtre se plafonne à sa zone de travail par une règle CSS **déduite de
   sa position** (`max-height: calc(100% - top)`), jamais par un état
   mémorisé : rien à recalculer, aucun écouteur de redimensionnement, et la
   borne vaut pendant qu'on tire le bord du navigateur.

Corollaire de la règle 3, tranché avec l'auteur, esquisses à l'appui : quand
l'écran rétrécit, **une fiche se comprime, elle ne se déplace pas**. On la
retrouve où on l'a posée. Le prix accepté : sur un écran très réduit, une fiche
posée bas devient un bandeau étroit. Déplacer la fiche aurait demandé de
réécrire sa géométrie à chaque redimensionnement sans jamais lui rendre sa
place d'origine.

## Conséquences

- Toute coquille nouvelle hérite de la borne : elle n'a plus à se donner de
  hauteur. Un `h-dvh` ou un `h-screen` qui réapparaîtrait dans la coquille est
  le signe qu'on rebricole ce qui est déjà résolu.
- Tout conteneur qui doit défiler le déclare lui-même (`min-h-0` +
  `overflow-y-auto`). C'est plus verbeux qu'un document qui défile tout seul, et
  c'est le prix de la disposition en fenêtres.
- Une barre posée sur la zone de travail doit **réserver sa hauteur** plutôt que
  de se poser par-dessus. C'est pourquoi la barre des fiches réduites a une
  hauteur constante et une rangée unique qui défile en largeur : une hauteur
  variable obligerait les deux zones de travail à la mesurer pour se borner.
- Mesuré après correction, même écran : `<body>` 800 px, `scrollY` reste à 0,
  la barre latérale s'arrête à 744 (800 − 56) et son sommaire défile dans son
  cadre (675 pour 1060 de contenu).
