# Charte d'interface

**À lire avant d'écrire du code d'interface. Aucune exception.**

Ce fichier est **normatif** et **extrait du code réel** — chaque recette ci-dessous est le motif déjà majoritaire dans le dépôt, compté, pas inventé. Il se distingue de `specs/coquille-et-design.md`, qui est une référence d'*intention* : ici, c'est ce que le code fait, et ce qu'il doit continuer de faire.

Court volontairement. Une charte de 800 lignes est une charte qu'on cesse de lire.

---

## 1. Pourquoi les contrôles sortent blancs

Trois causes, toutes mécaniques. Les connaître évite de chercher au mauvais endroit.

**a. `color-scheme` n'était pas déclaré — corrigé le 6 septembre.** Sans lui, le navigateur rend en clair tout ce qu'il dessine lui-même, quelles que soient les classes appliquées : le menu déroulant d'un `<select>`, les `<option>`, le sélecteur de date, les barres de défilement, le remplissage automatique de mot de passe. Aucune classe Tailwind ne peut corriger ça — c'est le navigateur qui peint, pas la feuille de style. `tokens.css` le déclare désormais par mode (`dark` pour dark/dim, `light` pour soft/light, `dark` pour le contraste élevé quel que soit le mode).

**b. Un composant partagé dont le `className` *remplaçait* le style au lieu de s'y ajouter — corrigé le 6 septembre.** `Dropdown.tsx` s'écrivait `className ?? "…style par défaut…"` : un appelant qui passait `className="w-full"` pour régler une largeur perdait **tout** le style — bordure, fond, rembourrage, couleur — et se retrouvait avec un déclencheur sans cadre, impossible à distinguer du texte autour. Sur ses 67 appels, huit variantes du même style coexistaient, chacune recopiée à la main.

**c. Un jeton de surface employé comme couleur de texte — corrigé le 6 septembre.** Cinq boutons à fond coloré portaient `text-panel` ou `text-white` au lieu de `text-accent-ink`. Voir la règle du §2.

**Ce qui n'est PAS une cause, contrairement à ce que ce fichier affirmait d'abord :** un `<button>` sans classe de couleur n'est pas gris-blanc natif. Le reset de Tailwind v4 pose `background-color: transparent` et `color: inherit` sur `button`, `input`, `select` et `textarea` — vérifié dans la feuille compilée. Un bouton sans style est donc transparent et hérite la couleur de son parent, jamais le rendu natif du navigateur. **La seule cause réelle du blanc était (a).**

---

## 2. Les jetons, et rien d'autre

Toutes les couleurs viennent de `src/styles/tokens.css`, via les classes Tailwind engendrées dans `app/globals.css`. Elles sont définies en OKLCH pour les quatre modes (`dark`/`dim`/`soft`/`light`) plus le mode contraste élevé, avec un ratio vérifié par calcul.

| Jeton | Rôle | Ne pas confondre |
|---|---|---|
| `bg` | le fond de page | jamais sur un panneau |
| `panel` | la surface courante d'un panneau, d'une carte | — |
| `panel-raised` | une surface **au-dessus** : menu, modale, survol | c'est le fond de survol par défaut |
| `panel-sunken` | une surface **en creux** : champ, zone de saisie, piste de jauge | — |
| `edge` | bordure ordinaire | — |
| `edge-strong` | bordure d'un élément détaché (menu en portail, modale) | — |
| `ink` | texte principal | — |
| `ink-soft` | texte secondaire | — |
| `ink-muted` | texte tertiaire, métadonnées | pas pour du texte qu'il faut lire |
| `accent` | l'action principale, l'état sélectionné | jamais deux accents dans une même zone |
| `accent-hover` | survol de `accent` | — |
| `accent-ink` | **le texte posé sur `accent` ou sur `danger`** | jamais `text-white` |
| `danger` | destruction, erreur | — |
| `success` | réussite d'un jet, confirmation | — |
| `link-entity` · `link-rule` · `gm` | liens de fiche, de règle, contenu MJ | sémantiques, pas décoratifs |
| `scrim` | voile derrière une modale | — |

**Interdits, sans exception :**

```
bg-white  bg-black  text-white  text-black
text-gray-*  bg-gray-*  text-slate-*  text-zinc-*  border-gray-*
text-red-*  bg-blue-*  text-green-*   (toute couleur de la palette Tailwind)
#3b82f6   rgb(...)   hsl(...)          (toute couleur littérale)
```

Une couleur qui manque s'ajoute à `tokens.css`, dans **les quatre modes plus le mode contraste élevé**, jamais en dur dans un composant.

### La règle qui se rate le plus souvent : le texte sur un fond coloré

Sur `bg-accent` ou `bg-danger`, la couleur du texte est **`text-accent-ink`**. Toujours.

C'est le seul jeton conçu pour être posé sur un fond coloré : il vaut `oklch(0.15 …)` en mode sombre et `oklch(0.98 …)` en mode clair, donc il s'inverse avec le fond. Deux erreurs se ressemblent et donnent toutes deux un résultat acceptable *dans un seul mode* :

- **`text-white`** — ne s'inverse jamais. Passable sur `danger` en mode sombre, délavé en mode clair.
- **`text-panel`** — c'est une couleur de **surface**, et elle porte un canal alpha (0,82 à 0,88 selon le mode). Employée comme couleur de texte, elle donne un texte semi-transparent sur un fond plein.

Les deux ont été trouvées et corrigées le 6 septembre (5 boutons). L'inverse — `bg-ink` avec `text-panel` — reste légitime : c'est une pastille volontairement inversée, pas un bouton (`DiceRollPanel.tsx:590`).

---

## 3. Les recettes

Copiables telles quelles. Ce sont les motifs déjà dominants dans le dépôt.

### Bouton principal — une action par écran

```
rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink
transition-colors hover:bg-accent-hover disabled:opacity-50
```

Version compacte (barre d'outils, en-tête de panneau) : `px-3 py-1 text-xs`.

### Bouton secondaire — le cas courant

```
rounded-full border border-edge px-3 py-1 text-xs text-ink
transition-colors hover:bg-panel-raised disabled:opacity-50
```

Version confortable (formulaire, page pleine) : `px-4 py-2 text-sm`.

### Bouton fantôme accent — action secondaire mais visible

```
rounded-full border border-accent px-3 py-1 text-xs text-accent
transition-colors hover:bg-accent/10 disabled:opacity-50
```

### Bouton destructeur

```
rounded-full bg-danger px-3 py-1 text-xs font-medium text-accent-ink
transition-colors hover:opacity-90 disabled:opacity-50
```

`text-accent-ink`, **jamais `text-white`** : le jeton s'inverse avec le mode, le blanc non.

C'est la seule recette de cette section qui soit une **forme normalisée** plutôt qu'un motif compté : le couple `bg-danger` + `text-accent-ink` vient de `ConfirmDialog.tsx`, les quatre boutons destructeurs du dépôt s'en écartent encore par leur rembourrage (`px-3 py-1.5`, `px-4 py-1.5`) et deux d'entre eux sont en `rounded-md`. Aligner les nouveaux sur la forme ci-dessus ; ne pas rouvrir les anciens pour ça seul.

Pour une suppression discrète dans une liste, un lien suffit : `text-xs text-danger hover:underline`. Dans les deux cas, la confirmation passe par `ConfirmDialog`, jamais par `window.confirm`.

### Champ de saisie

```
rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none
```

`bg-transparent` et non `bg-panel` : le champ prend le fond de son conteneur, ce qui le garde lisible dans un panneau comme dans une modale. Toujours dans un `<label>` qui enveloppe le champ — c'est la convention du dépôt, elle vaut association accessible sans `htmlFor`.

### Liste déroulante

**Toujours `components/shared/Dropdown.tsx`. Jamais un `<select>` natif** — son menu est peint par le navigateur et ne suivra jamais les jetons.

```tsx
<Dropdown value={v} options={opts} onChange={setV} aria-label="Type de fiche" />
```

**`className` ne sert qu'à la mise en page** — largeur, marge, `flex-1`, `shrink-0`. Il **s'ajoute** au style du composant, il ne le remplace jamais : un appel qui ne passe qu'une largeur garde donc bordure, fond et couleur de texte. N'y mettez ni couleur, ni bordure, ni rayon — ils entreraient en conflit avec le style de base, et c'est l'ordre des utilitaires dans la feuille générée qui trancherait, pas celui écrit dans l'attribut.

Si l'apparence par défaut ne convient pas, **c'est le composant qu'on corrige** — en lui ajoutant une prop fermée (une taille, une forme) — jamais l'appel.

`triggerClassName` existe encore et remplace tout le style : c'est le comportement hérité, porté par 32 appels antérieurs à cette charte. **Ne pas en écrire de nouveau.**

### Case à cocher

**Toujours `components/shared/Checkbox.tsx`.** Même raison qu'au-dessus : la case native ne suit ni les couleurs ni les rayons. Le composant existe déjà pour ça.

### Onglets

**Toujours `components/shared/Tabs.tsx`** — segments égaux dans un conteneur arrondi. Ne pas dessiner une deuxième présentation d'onglets.

### Panneau, carte

```
rounded-lg border border-edge bg-panel p-6
```

`p-6` est le rembourrage réel des panneaux du dépôt (11 occurrences ; aucune en `p-4`). Menu, modale ou tout ce qui flotte au-dessus : `border-edge-strong bg-panel-raised shadow-2xl`.

### Puce, étiquette

```
rounded-full border border-edge px-3 py-1 text-xs text-ink
```

C'est le motif le plus répandu du dépôt, toutes catégories confondues — **51 occurrences**. Il est identique au bouton secondaire ci-dessus, et c'est normal : une puce cliquable *est* un petit bouton. En version discrète, remplacer `text-ink` par `text-ink-muted`.

### État vide

**Toujours `components/shell/EmptyState.tsx`.** Un écran vide est une invitation à agir, avec un bouton — pas une ligne de texte gris en italique.

Le composant existe et **un seul écran l'utilise** (`(monde)/page.tsx`). Partout ailleurs le vide est traité par une phrase en `text-xs italic text-ink-muted`, c'est-à-dire dans le style le moins visible du système, au moment précis où l'on a le plus besoin d'être guidé.

---

## 4. Rayons, densité, mouvement

| Élément | Rayon | Usages |
|---|---|---|
| Bouton, puce, onglet | `rounded-full` | 285 |
| Champ, menu, petit panneau | `rounded-md` | 302 |
| Carte, modale | `rounded-lg` | 39 |
| Grande surface : canevas, portrait, encart d'état vide | `rounded-xl` / `rounded-2xl` | 16 |

Les trois premiers viennent des jetons `--r-sm`/`--r-md`/`--r-lg`. Le quatrième est délibéré et couvre les grandes surfaces — un canevas de généalogie, un portrait, un encart en pointillés : un rayon de 10 px sur un bloc de 400 px se lit comme un angle droit. **Ne pas « corriger » ces seize-là vers `rounded-lg`.**

Seul écart réel : **`rounded` nu, 36 usages**, tous sur des champs de saisie — c'est-à-dire exactement l'usage de `rounded-md`, avec un rayon un peu plus petit. Une variante involontaire, à faire converger au fil des écrans qu'on rouvre, jamais en une passe.

**Taille de texte** — `text-sm` (14 px) est le défaut de l'interface, `text-xs` (12 px) pour ce qui est dense et secondaire, `text-base` (16 px) pour ce qui se lit vraiment (contenu de bloc, narration).
**Rien en dessous de `text-xs`.** Les `text-[10px]` et `text-[9px]` présents dans le dépôt sont de la dette, pas un exemple à suivre — ne pas en ajouter.

**Cible de clic** — au moins 24 px de haut sur un élément interactif, ce que donne `py-1` avec `text-xs`. En dessous (`py-0.5`), étendre la zone cliquable sans grossir le visuel plutôt que de laisser une cible de 20 px.

**Transitions** — `transition-colors` sur tout ce qui a un survol, et rien d'autre par défaut. `prefers-reduced-motion` est déjà traité globalement dans `tokens.css` ; ne pas le réimplémenter.

**Focus** — ne jamais écrire `outline-none` sans reposer un anneau visible. `:focus-visible` est défini une fois pour toute l'application dans `app/globals.css` ; le `outline-none` des champs ci-dessus ne retire que le contour permanent, pas celui du focus clavier.

---

## 5. Ce qu'un écran doit avoir

> **Cette section est prescriptive, pas descriptive** — contrairement aux §2 à §4, qui sont extraits du code. Aujourd'hui l'application compte **zéro `error.tsx`**, **zéro `loading.tsx`**, un seul usage d'`EmptyState`, et environ cent `fetch` sur cent trente qui ne testent pas `res.ok`. C'est l'écart le plus large entre cette charte et le dépôt, et c'est F‑01 à F‑05 du [rapport d'audit](./audit/2026-09-06-frontend-ux.md). À appliquer aux nouveaux écrans ; le rattrapage de l'existant est un chantier à part.

Quatre états, pas un. Un écran qui n'a que le cas nominal n'est pas fini.

| État | Ce qu'on affiche |
|---|---|
| **Chargement** | un indicateur, jamais un écran figé |
| **Vide** | `EmptyState`, avec l'action qui en sort |
| **Erreur** | ce qui a échoué, en français, et un bouton « Réessayer » |
| **Nominal** | le contenu |

**Un `fetch` dont on ne teste pas `res.ok` est un bug.** Un échec silencieux qui laisse l'écran sur « Chargement… » est le pire des rendus possibles : l'utilisateur attend quelque chose qui n'arrivera jamais.

---

## 6. Vérification avant de livrer un écran

- [ ] Aucune couleur littérale, aucune classe de couleur Tailwind — que des jetons.
- [ ] Les quatre modes testés : `dark`, `dim`, `soft`, `light`. Un panneau clair qui devient illisible en mode clair est le cas le plus fréquent.
- [ ] Le mode contraste élevé testé.
- [ ] Aucun `<select>`, aucune `<input type="checkbox">` native — `Dropdown` et `Checkbox`.
- [ ] Aucun `window.confirm`/`alert` — `ConfirmDialog`.
- [ ] Le `className` passé à `Dropdown` ne contient que de la mise en page.
- [ ] Rien sous `text-xs`.
- [ ] Navigable au clavier : `Tab` atteint tout, `Échap` ferme ce qui est ouvert.
- [ ] Les quatre états du §5 existent.
- [ ] Lisible à 375 px de large.

---

## 7. L'état des correctifs structurels

### a. Déclarer `color-scheme` — **fait le 6 septembre**

La cause racine. `src/styles/tokens.css` déclare désormais `color-scheme` dans chaque bloc de mode, au plus près de la palette qu'il accompagne :

| Mode | Valeur |
|---|---|
| `dark`, `dim` (et `:root` sans attribut) | `dark` |
| `soft`, `light` | `light` |
| `[data-contrast="high"]` et `prefers-contrast: more` | `dark` — la palette de contraste élevé est sombre quel que soit le mode choisi |

Déclaré aussi sur `.wiki-bg-scope[data-mode=…]`, qui peut porter un mode différent de la racine (fond de page wiki, V2-G13) : ses contrôles suivent alors sa propre palette, pas celle de l'application autour.

Les deux dernières règles gagnent sur les modes par l'ordre du document, à spécificité égale — vérifié dans le CSS compilé, pas seulement raisonné.

Effet de bord assumé et voulu : les barres de défilement, les sélecteurs de date et le remplissage automatique changent d'aspect partout.

### b. Rendre le style de `Dropdown` non écrasable — **fait le 6 septembre**

Le composant portait `className ?? "…style…"` : passer une simple largeur effaçait tout le style et donnait un bouton nu.

Deux props distinctes désormais, plutôt qu'une seule dont le rôle se devine :

| Prop | Effet |
|---|---|
| `className` | **s'ajoute** au style de base — mise en page uniquement |
| `triggerClassName` | **remplace** tout le style — hérité, à ne plus écrire |

Le choix de deux noms explicites plutôt qu'une heuristique (« si `className` contient une couleur, alors… ») est délibéré : une règle qui se devine surprend, et le projet préfère les frontières visibles. `triggerClassName` rend la dette lisible, et il ne s'écrit pas par accident.

**Conversion faite, à l'apparence strictement inchangée** : les 32 appels qui composaient déjà leur propre style ont été renommés en `triggerClassName` tels quels — un renommage mécanique, pas un remappage vers de nouvelles valeurs. Les 35 autres appels prennent le style de base comme avant.

Un défaut du style de base a été corrigé au passage : il n'avait pas `inline-flex`, alors que le libellé porte `flex-1 truncate` et le chevron `shrink-0` — trois classes sans le moindre effet dans un `<button>` resté en `inline-block`. Le troncage d'un libellé long ne fonctionnait donc pas pour les appels sans style propre.

Reste à faire, au fil des écrans qu'on rouvre : convertir les `triggerClassName` en props fermées (taille, forme) et les supprimer.

### c. Les boutons hors charte — **corrigés le 6 septembre**

Recensement des **370 `<button>`** du dépôt, par analyse des balises. Le résultat justifie de ne rien avoir refondu :

| Contrôle | Hors charte |
|---|---|
| Couleur de la palette Tailwind au lieu d'un jeton | **2** |
| Fond coloré sans couleur de texte adaptée | **3** |
| `disabled` sans état visible | **2** |
| Tout le reste | **conforme** |

Soit **7 boutons sur 370**. Les corrections :

- `text-white` → `text-accent-ink` sur `bg-danger` — `DeleteAccountSection.tsx`, `WorldCardActions.tsx`.
- `text-panel` → `text-accent-ink` sur `bg-accent`/`bg-danger` — `InitiativeTracker.tsx` (×2), `EncounterBuilder.tsx`. Voir la règle du §2 : `--panel` porte un alpha, ce n'est pas une couleur de texte.
- `disabled:opacity-50` ajouté aux deux flèches « tour précédent / suivant » — `InitiativeTracker.tsx`. Elles étaient désactivées pendant un chargement sans que rien ne le montre : on cliquait, rien ne se passait.

Une douzaine d'autres boutons à `bg-accent`/`bg-danger` ont été examinés et laissés tels quels — pastilles de fenêtre de 11 px, cases à cocher de 4 px, barres de chronologie de 6 px (aucun texte), et fonds à 10 % d'opacité (`bg-accent/10`) sur lesquels la couleur héritée est lisible.

### d. Écrire un composant `Button` — à faire, sans urgence

`components/shared/Button.tsx`, variantes fermées — `primary` · `secondary` · `ghost` · `danger`, deux tailles. C'est ce qui rendrait la charte mécanique plutôt que déclarative : on n'oublie pas une classe qu'on n'écrit plus.

**Mais le recensement du §7c montre que ce n'est pas urgent** : 363 boutons sur 370 sont déjà conformes. Le gain n'est pas de réparer l'existant, il est d'empêcher la dérive future. À faire comme `Checkbox` et `Tabs` l'ont été — le composant d'abord, la conversion au fil des écrans qu'on rouvre, jamais une refonte en une passe.

### e. Les contrôles natifs qui subsistent — à faire

Recensé le 6 septembre. Ces trois-là contredisent une règle explicite du §3, et aucun n'était listé avant ce contrôle.

| Contrôle natif | Nombre | Où |
|---|---|---|
| `<select>` | **8** (+2 dans `/spike-solo`, écran jetable, hors périmètre) | `CreateHomebrewWeaponForm` (4), `GeneratorToolPanel`, `FormulaSandbox`, `RandomTableBlockEditor`, `InventoryPanel` |
| `<input type="checkbox">` | **12** | `GameDateInput`, `CalendarSettingsPanel`, `RandomTableBlockEditor`, `QuestBlockEditor`, `SpellcastingBlockEditor`, `ImageBlockEditor`, `EntityHistoryPanel`, `MapRegionEditorPopup`, les trois tables de psyché |
| `window.confirm` | **3** | `InitiativeTracker:139`, `AdminPanel:88`, `WorldCardActions:250` |

**Depuis le correctif `color-scheme`, aucun n'est plus blanc** — le navigateur les peint désormais dans la teinte du mode. Ils restent hors charte pour le reste : ni le rayon, ni la couleur d'accent du projet (une case cochée sort dans l'accent du système, pas dans l'ambre de `--accent`), et le menu d'un `<select>` ne peut pas s'ouvrir en portail, donc il se fait couper par un conteneur défilant.

Les trois `window.confirm` sont les plus gênants des trois lots, parce qu'ils gardent les gestes les plus destructeurs — supprimer un combat, supprimer le compte d'un ami, lancer un export volumineux — derrière la boîte du navigateur, qu'on valide sans lire. `ConfirmDialog` existe et prend déjà une variante `danger`.

Aucun n'est urgent. À convertir au fil des écrans qu'on rouvre.

### f. Deux couleurs hexadécimales — à faire

`MapWorkspace.tsx:262-263`, couleur par défaut d'une zone de carte. C'est de la donnée plus que du style, mais la valeur devrait venir d'un jeton.

### g. Les tailles sous `text-xs` — dette de fond, pas un chantier

**209 occurrences** : `text-[10px]` (170), `text-[9px]` (22), `text-[11px]` (17). C'est F‑11 du rapport d'audit, et la réponse y est développée : figer une échelle et l'appliquer aux nouveaux écrans, convertir les anciens quand on les rouvre. Surtout pas une passe globale.

---

## 8. Pourquoi cette charte existe

Le dépôt est déjà très propre, et le recensement l'a confirmé plutôt que l'inverse : **363 boutons conformes sur 370**, deux couleurs hexadécimales sur ~36 000 lignes d'interface, les jetons respectés presque partout.

Le problème n'était donc pas l'indiscipline, et il n'appelait pas une refonte. C'était deux choses, l'une invisible et l'autre silencieuse :

- une propriété manquante (`color-scheme`) qui échappait à toute relecture de code, parce qu'elle ne se voit dans aucun composant ;
- un style recopié à la main qui dérive lentement — un `py-1` devenu `py-1.5`, un jeton de surface employé comme couleur de texte.

D'où la méthode suivie ici, et qui vaut pour la suite : **mesurer avant de refondre.** Le recensement des 370 boutons a pris dix minutes et a ramené le chantier de « 700 boutons à convertir » à « 7 boutons à corriger ».

Ce fichier rend la règle lisible. Le §7d la rendrait mécanique — et c'est ce qui marche vraiment, comme l'ont montré la règle ESLint sur `src/core` et celle sur le client `service_role`.
