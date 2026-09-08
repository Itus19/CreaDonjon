# 0020 — Une charte d'interface normative, distincte de la spécification de design

**Date :** 2026-09-07
**Statut :** acceptée

## Contexte

Retour utilisateur : *« il oublie certaines choses de la charte graphique, notamment autour des boutons et des boutons-listes qui sont toujours blancs — mais je pense qu'on n'en a pas une claire. »*

Le diagnostic a trouvé trois causes, dont aucune n'était de l'indiscipline. Le dépôt était en fait très propre : **363 boutons conformes sur 370**, deux couleurs hexadécimales sur ~36 000 lignes d'interface, les jetons respectés presque partout.

1. **`color-scheme` n'était déclaré nulle part.** C'est la seule propriété qui pilote ce que le navigateur peint lui-même — le menu déroulant d'un `<select>` et ses `<option>`, le sélecteur de date, les barres de défilement, le remplissage automatique. Aucune classe ni aucun jeton ne les atteint. C'était **la** cause du « blanc », et elle était invisible à toute relecture de code : elle ne se voit dans aucun composant.
2. **`Dropdown.tsx` s'écrivait `className ?? "…style…"`.** Un appelant qui passait une largeur perdait bordure, fond et couleur. Sur ses 67 appels, huit variantes du même style coexistaient.
3. **Un jeton de surface employé comme couleur de texte** — `text-panel` (qui porte un canal alpha) et `text-white` sur cinq boutons à fond coloré, au lieu de `text-accent-ink`.

`specs/coquille-et-design.md` existait déjà, mais `CLAUDE.md` en dit explicitement : *« Ne modifie pas l'apparence existante pour la conformer à `specs/coquille-et-design.md` : **le code fait foi**, la spécification est une référence d'intention. »* Ce document ne pouvait donc pas servir de norme — c'est précisément ce qu'il n'est pas.

## Options envisagées

- **A. Durcir `specs/coquille-et-design.md`.** Un seul document — mais il perdrait son statut de référence d'intention, et la règle citée ci-dessus deviendrait fausse. On aurait aussi risqué de « corriger » du code vers une intention que le code avait délibérément dépassée.
- **B. Un second document, normatif, extrait du code.** Deux fichiers à distinguer — mais chacun avec un statut clair : l'un dit ce qu'on voulait, l'autre ce qu'on fait et doit continuer de faire.
- **C. Ne rien écrire, corriger seulement les trois causes.** Le moins de documentation — mais la dérive recommence au composant suivant, puisque rien n'est écrit.

## Décision

**B.** `docs/CHARTE-UI.md`, normative et **extraite du code réel** : chaque recette y est le motif déjà majoritaire dans le dépôt, compté, jamais inventé. Ajoutée au tableau des documents de référence de `CLAUDE.md`, à lire avant tout code d'interface.

Trois décisions de conception l'accompagnent, chacune prise contre la solution qui paraissait la plus évidente :

**`color-scheme` déclaré par mode, pas une fois globalement.** La valeur suit la palette du mode (`dark` pour dark/dim, `light` pour soft/light), et `.wiki-bg-scope` peut porter un mode différent de la racine — ses contrôles doivent suivre le sien. Le contraste élevé repasse à `dark` même par-dessus soft/light, sa palette étant sombre quel que soit le mode.

**Un hook clavier plutôt que l'élément `<dialog>` natif** pour les modales. `<dialog>` offre gratuitement le piège de focus, `Échap` et la restauration — mais il change le positionnement et remplace le voile par `::backdrop`, donc l'**apparence**. Or ces correctifs ont été faits alors que l'auteur n'avait pas accès à sa machine : rien de visuel ne pouvait être relu. `<dialog>` reste la bonne cible quand quelqu'un pourra regarder.

**Deux props explicites sur `Dropdown` plutôt qu'une heuristique.** `className` s'ajoute au style (mise en page), `triggerClassName` le remplace (hérité, à ne plus écrire). L'alternative — deviner d'après le contenu de `className` s'il faut ajouter ou remplacer — aurait marché sans toucher aux 67 appels, mais une règle qui se devine surprend. Ce projet préfère les frontières visibles.

## Conséquences

- **Deux documents de design coexistent**, et il faut savoir lequel fait autorité : `CHARTE-UI.md` sur ce qui doit être écrit, `coquille-et-design.md` sur l'intention. La charte le dit dans sa première phrase.
- **La charte doit être maintenue contre le code**, sinon elle devient ce qu'elle prétend corriger. Sa vérification complète du 7 septembre a d'ailleurs trouvé **deux règles fausses de ma part** : une prescription sur les rayons qui aurait provoqué une régression visuelle sur seize éléments (canevas, portraits, encarts en `rounded-xl`/`2xl`), et deux recettes qui ne correspondaient pas au motif réel du dépôt.
- **`color-scheme` change l'aspect des contrôles natifs partout** — barres de défilement, sélecteurs de date, remplissage automatique. Effet de bord assumé, c'est le but.
- **Le §7 de la charte tient l'inventaire des écarts restants**, avec leur état. Les deux plus gros n'ont volontairement pas été traités : un composant `Button` (le recensement a montré que 363/370 boutons sont déjà conformes — le gain serait d'empêcher la dérive future, pas de réparer l'existant) et les 209 tailles de texte sous `text-xs`, qui demandent de voir l'écran.
- **Une leçon de méthode, inscrite au §8 :** *mesurer avant de refondre*. Le recensement des 370 boutons a pris dix minutes et a ramené le chantier de « 700 boutons à convertir » à « 7 à corriger ».
