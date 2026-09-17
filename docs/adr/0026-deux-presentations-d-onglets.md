# 0026 — Deux présentations d'onglets, distinguées par leur rôle et non par leur dessin

**Date :** 2026-09-16
**Statut :** acceptée

## Contexte

V2.1-24 fait passer le détail d'un monde, sur l'écran d'accueil, à des onglets
en intercalaire de classeur — ceux de la fiche jouable, que l'auteur a demandés
nommément. Le §3 de `CHARTE-UI.md` s'y oppose : « **Toujours
`components/shared/Tabs.tsx`. Ne pas dessiner une deuxième présentation
d'onglets.** »

Compté avant de trancher, plutôt que supposé :

| Présentation | Ce que c'est | Usages réels |
|---|---|---|
| `components/shared/Tabs.tsx` | segments égaux dans un conteneur arrondi, `role="tablist"`, roving tabindex, flèches/Home/End | **0** |
| `components/shell/SectionToggle.tsx` | le même dessin, mais des `<Link>` | la bascule Monde/Règles/MJ des trois barres latérales |
| Les intercalaires de `PlayableCharacterSheet.tsx:620` | un classeur : la ligne du haut est composée par le bord bas des onglets **inactifs**, l'actif n'en a pas | la fiche jouable |

Trois faits en découlent, et ils renversent la règle telle qu'elle est écrite :

1. **`Tabs.tsx` n'a aucun importateur.** Il est né avec V2-K5 (« Réglages à
   onglets »), et l'écran de réglages a ensuite quitté l'application entière
   sur retour de l'auteur. Le composant est resté, orphelin. La règle de la
   charte désigne donc du code mort.
2. **`SectionToggle` n'est pas des onglets.** Ce sont des liens qui changent de
   route. Il partage le dessin de `Tabs.tsx`, pas sa sémantique.
3. **La seule présentation d'onglets en service est celle que la charte
   interdit** — et elle est née d'un retour de l'auteur (« les onglets ne sont
   pas très visibles »), c'est-à-dire d'un défaut réel de la première.

Un quatrième fait pèse dans l'autre sens : les intercalaires sont des `<button>`
nus. Ni `role="tablist"`, ni `aria-selected`, ni navigation aux flèches. Toute
la mécanique ARIA correcte du dépôt est dans le composant que personne
n'utilise.

## Décision

**Deux présentations d'onglets sont autorisées. Elles se choisissent sur ce
qu'elles font, jamais sur le goût de qui écrit l'écran.**

| Présentation | Quand | Forme |
|---|---|---|
| **Bascule segmentée** — `Tabs.tsx` | Choisir une vue **à l'intérieur** d'un panneau, d'une barre, d'une carte. Deux à quatre entrées courtes. L'onglet est un filtre sur un contenu qui reste le même. | segments égaux, `rounded-full border border-edge p-0.5` |
| **Intercalaires de classeur** — `BinderTabs` | Les onglets **sont** la page. Le panneau occupe la largeur, chaque onglet a son propre contenu, et l'onglet actif doit visiblement s'ouvrir sur lui. | `rounded-t-lg`, liseré d'accent en `inset`, ligne du haut composée par les onglets inactifs |

**Et une règle qui les traverse toutes les deux :** une présentation d'onglets
porte le contrat ARIA complet — `role="tablist"`, `aria-selected`, un seul
onglet dans l'ordre de tabulation, flèches/`Home`/`End` pour circuler. C'est ce
que `Tabs.tsx` implémente déjà et ce que les intercalaires n'ont jamais eu.
L'extraction de `BinderTabs` reprend cette mécanique plutôt que de la
réécrire — c'est la raison de garder `Tabs.tsx` malgré ses zéro usage.

**`SectionToggle` reste hors de ce cadre.** Ce sont des liens de navigation qui
empruntent un dessin ; il n'a pas à devenir un `Tabs`, et ce dessin partagé
n'est pas une troisième présentation.

## Conséquences

- Le §3 de `CHARTE-UI.md` est corrigé dans le même geste. Sa phrase actuelle ne
  décrit plus la règle, et une charte qui ment sur un point est une charte
  qu'on cesse de croire sur les autres — c'est son propre §8 qui le dit.
- `components/shared/BinderTabs.tsx` est extrait de `PlayableCharacterSheet`, à
  apparence strictement inchangée pour la fiche.

  > **Corrigé après extraction.** Cet ADR annonçait ici une entorse assumée à la
  > règle des trois, au motif que l'accueil serait le 2ᵉ usage. Il y en avait un
  > troisième, trouvé en extrayant : `characterCreatorSteps/PreviewStep.tsx`
  > rendait les mêmes cinq onglets, libellés importés compris, dans une
  > **troisième** présentation — `rounded-t-md` et un souligné de 2 px, c'est-à-dire
  > celle dont le joueur s'était plaint et qui a fait naître le classeur. La règle
  > des trois était donc satisfaite sans entorse. `PreviewStep` est converti,
  > cette fois avec un changement d'apparence assumé.
- La fiche jouable **gagne** le clavier au passage. Ce n'était pas le but de
  V2.1-24, c'est un effet de l'extraction, et il ne doit pas se perdre : les
  cinq onglets deviennent navigables aux flèches comme le prescrit le motif
  ARIA.
- Un troisième dessin d'onglets qui apparaîtrait est une dérive, pas un cas
  particulier. Deux, et le tableau ci-dessus dit lequel.
- Si `Tabs.tsx` n'avait toujours aucun usage une fois `BinderTabs` livré, la
  question de sa suppression se poserait pour de bon. Elle n'est pas tranchée
  ici : son contrat ARIA est justement ce que `BinderTabs` vient lui emprunter.
