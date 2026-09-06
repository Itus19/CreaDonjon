# Charte d'interface

**À lire avant d'écrire du code d'interface. Aucune exception.**

Ce fichier est **normatif** et **extrait du code réel** — chaque recette ci-dessous est le motif déjà majoritaire dans le dépôt, compté, pas inventé. Il se distingue de `specs/coquille-et-design.md`, qui est une référence d'*intention* : ici, c'est ce que le code fait, et ce qu'il doit continuer de faire.

Court volontairement. Une charte de 800 lignes est une charte qu'on cesse de lire.

---

## 1. Pourquoi les contrôles sortent blancs

Trois causes, toutes mécaniques. Les connaître évite de chercher au mauvais endroit.

**a. `color-scheme` n'était pas déclaré — corrigé le 6 septembre.** Sans lui, le navigateur rend en clair tout ce qu'il dessine lui-même, quelles que soient les classes appliquées : le menu déroulant d'un `<select>`, les `<option>`, le sélecteur de date, les barres de défilement, le remplissage automatique de mot de passe. Aucune classe Tailwind ne peut corriger ça — c'est le navigateur qui peint, pas la feuille de style. `tokens.css` le déclare désormais par mode (`dark` pour dark/dim, `light` pour soft/light, `dark` pour le contraste élevé quel que soit le mode).

**b. Un composant partagé dont le `className` *remplace* le style au lieu de s'y ajouter.** `Dropdown.tsx` s'écrit `className ?? "…style par défaut…"` : un appelant qui passe `className="w-full"` pour régler une largeur perd **tout** le style et récupère un `<button>` nu, c'est-à-dire gris-blanc natif. Sur ses 67 appels, huit variantes du même style coexistent, chacune recopiée à la main.

**c. Il n'existe pas de composant `Button`.** Les quelque 700 boutons du dépôt sont stylés un par un. Un oubli de `border border-edge` ou de `text-ink` donne un bouton natif.

(a) est corrigé. **La charte traite (b) et (c)** — voir §7 pour leur état.

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

**Ne passez `className` que pour la mise en page** — largeur, marge, `flex-1`, `shrink-0`. Dès qu'on y met une couleur, une bordure ou un rayon, on remplace le style du composant et on obtient un bouton nu. Si l'apparence par défaut ne convient pas, c'est le composant qu'il faut corriger, pas l'appel.

### Case à cocher

**Toujours `components/shared/Checkbox.tsx`.** Même raison qu'au-dessus : la case native ne suit ni les couleurs ni les rayons. Le composant existe déjà pour ça.

### Onglets

**Toujours `components/shared/Tabs.tsx`** — segments égaux dans un conteneur arrondi. Ne pas dessiner une deuxième présentation d'onglets.

### Panneau, carte

```
rounded-lg border border-edge bg-panel p-4
```

Menu, modale ou tout ce qui flotte au-dessus : `border-edge-strong bg-panel-raised shadow-2xl`.

### Puce, étiquette

```
rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted
```

### État vide

**Toujours `components/shell/EmptyState.tsx`.** Un écran vide est une invitation à agir, avec un bouton — pas une ligne de texte gris en italique.

---

## 4. Rayons, densité, mouvement

| Élément | Rayon |
|---|---|
| Bouton, puce, onglet | `rounded-full` |
| Champ, menu, petit panneau | `rounded-md` |
| Carte, modale | `rounded-lg` |

Ne pas utiliser `rounded` nu ni `rounded-sm`/`rounded-xl` : trois rayons suffisent, et ils viennent des jetons `--r-sm`/`--r-md`/`--r-lg`.

**Taille de texte** — `text-sm` (14 px) est le défaut de l'interface, `text-xs` (12 px) pour ce qui est dense et secondaire, `text-base` (16 px) pour ce qui se lit vraiment (contenu de bloc, narration).
**Rien en dessous de `text-xs`.** Les `text-[10px]` et `text-[9px]` présents dans le dépôt sont de la dette, pas un exemple à suivre — ne pas en ajouter.

**Cible de clic** — au moins 24 px de haut sur un élément interactif, ce que donne `py-1` avec `text-xs`. En dessous (`py-0.5`), étendre la zone cliquable sans grossir le visuel plutôt que de laisser une cible de 20 px.

**Transitions** — `transition-colors` sur tout ce qui a un survol, et rien d'autre par défaut. `prefers-reduced-motion` est déjà traité globalement dans `tokens.css` ; ne pas le réimplémenter.

**Focus** — ne jamais écrire `outline-none` sans reposer un anneau visible. `:focus-visible` est défini une fois pour toute l'application dans `app/globals.css` ; le `outline-none` des champs ci-dessus ne retire que le contour permanent, pas celui du focus clavier.

---

## 5. Ce qu'un écran doit avoir

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

### b. Rendre le style de `Dropdown` non écrasable — à faire

Aujourd'hui `className ?? "…"`. Il faudrait fusionner (style de base **puis** `className`), et n'accepter en `className` que de la mise en page. Les 67 appels peuvent rester tels quels le temps de la transition : leurs classes de style deviennent redondantes, pas nuisibles.

### c. Écrire un composant `Button` — à faire

`components/shared/Button.tsx`, avec des variantes fermées — `primary` · `secondary` · `ghost` · `danger`, et deux tailles. C'est ce qui rend la charte mécanique plutôt que déclarative : on ne peut plus oublier une classe si on ne l'écrit plus.

À faire comme `Checkbox` et `Tabs` l'ont été : le composant d'abord, la conversion au fil des écrans qu'on rouvre, jamais une refonte de 700 boutons en une fois.

### d. Deux violations à corriger au passage — à faire

- `text-white` sur fond `danger` — `DeleteAccountSection.tsx:44` et `WorldCardActions.tsx:197`. Doit être `text-accent-ink`.
- Deux couleurs hexadécimales — `MapWorkspace.tsx:262-263`, couleur par défaut d'une zone de carte. C'est de la donnée plus que du style, mais la valeur devrait venir d'un jeton.

---

## 8. Pourquoi cette charte existe

Le dépôt est déjà très propre : sur ~36 000 lignes d'interface, **deux** `text-white` et **deux** couleurs hexadécimales. Les jetons sont respectés presque partout, et les motifs de boutons sont remarquablement homogènes.

Le problème n'est donc pas l'indiscipline : c'est que la règle n'était écrite nulle part, et qu'un style recopié à la main dans 700 endroits dérive fatalement — un `py-1` devenu `py-1.5`, un `hover:bg-panel` devenu `hover:bg-panel-raised`, une classe oubliée qui laisse un bouton nu.

Ce fichier rend la règle lisible. Le §7 la rendrait mécanique — et c'est ce qui marche vraiment, comme l'ont montré la règle ESLint sur `src/core` et celle sur le client `service_role`.
