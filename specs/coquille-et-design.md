# Spécification — Coquille d'application et système visuel

**Version :** 0.1 — 30 juillet 2026
**Statut :** À implémenter immédiatement après V0-03, avant V0-04
**Amende :** `BACKLOG.md` (ajout du ticket V0-03b)

---

## 0. Pourquoi maintenant et pas plus tard

Jusqu'ici, aucun document ne parlait d'interface. C'était volontaire pour la Phase 0 — on ne dessine pas avant de savoir ce qu'on affiche — et c'est devenu une lacune dès la V0.

Deux raisons de traiter le sujet maintenant plutôt qu'à la fin de la V0 :

**La coquille est structurelle, pas décorative.** Une barre latérale persistante avec arborescence et une zone de travail à panneaux détermine le routage, la disposition et la gestion d'état. Ce sont des décisions d'architecture déguisées en choix esthétiques. Les prendre après huit écrans oblige à réécrire les huit.

**Le risque R9 du registre — perte de motivation faute de résultat visible — est réel.** Trois écrans à refaire coûtent une session ; huit en coûtent quatre, et le découragement entre les deux n'est pas gratuit.

**Ce qui reste correctement reporté :** le thème clair, les animations, le canevas, la réorganisation par glisser-déposer, les panneaux multiples. Voir §7.

---

## 1. La direction visuelle

La référence fournie pose une direction claire, et elle est bonne. Elle est reprise telle quelle plutôt que réinventée.

**Sombre, chaud, atmosphérique.** Le fond n'est pas une couleur : c'est **une image du monde de l'utilisateur, floutée et assombrie**. Les panneaux flottent au-dessus, translucides. L'application prend la couleur de ce qu'on y construit — un monde de glace n'a pas la même ambiance qu'un monde de cendres, sans une ligne de configuration.

C'est le seul effet un peu coûteux du système. Il est justifié : c'est ce qui distingue l'outil d'un Notion sombre.

### Le signe distinctif : la couleur encode la nature du lien

Trois couleurs de lien, jamais mélangées :

*(Une quatrième catégorie sémantique existe depuis `docs/adr/0010-couleurs-ecoles-de-magie.md` : une teinte par école de magie, pour les badges de l'onglet Sorts — ce ne sont jamais des couleurs de LIEN, elles ne pointent vers aucune fiche, la distinction avec les trois ci-dessous reste nette. Mêmes garanties de contraste, mêmes L/C par mode, seule la teinte change.)*

| Couleur | Signifie | Exemple |
|---|---|---|
| Violet doux | renvoi vers une **entité du wiki** | « la Main Silencieuse » |
| Vert d'eau | renvoi vers une **règle** | « jet de sauvegarde », « Boule de feu » |
| Terracotta | contenu **réservé au MJ** | un paragraphe caviardé pour les joueurs |

Le troisième est le plus important. **La question qu'un MJ se pose en permanence est « est-ce que je peux montrer cet écran à ma table ? »** Aucun outil généraliste n'y répond. Un liseré terracotta constant, sur un segment de texte comme sur un bloc entier, y répond d'un coup d'œil.

C'est là qu'on dépense l'audace du système. Tout le reste reste discret.

---

## 2. Jetons de design

À écrire dans `src/styles/tokens.css`, référencés par Tailwind. **Aucune couleur en dur ailleurs dans le code.**

**Les jetons sont écrits en OKLCH, pas en hexadécimal.** Ce n'est pas une préférence de syntaxe : c'est ce qui rend possible le thème dérivé de l'image (§2b). En OKLCH, la clarté `L` est *perceptuelle* — imposer `L = 0.93` garantit un contraste, ce qu'aucune valeur HSL ne garantit.

```css
:root {
  /* Deux variables pilotent tout le thème.
     Elles sont réécrites quand l'utilisateur change d'image ou de mode. */
  --h:    152;    /* teinte extraite de l'image de fond */
  --c:    0.022;  /* saturation des surfaces, plafonnée */

  /* Surfaces — teintées par l'image, clarté imposée par le mode */
  --bg:            oklch(0.17 var(--c) var(--h));
  --panel:         oklch(0.23 var(--c) var(--h) / 0.82);
  --panel-raised:  oklch(0.29 var(--c) var(--h) / 0.90);
  --panel-sunken:  oklch(0.14 var(--c) var(--h) / 0.60);
  --edge:          oklch(0.40 var(--c) var(--h) / 0.55);
  --edge-strong:   oklch(0.52 var(--c) var(--h) / 0.70);
  --scrim:         oklch(0.12 0.01 var(--h) / 0.70);  /* voile sur l'image */

  /* Texte — teinte héritée, clarté imposée. Jamais dérivée de l'image. */
  --ink:       oklch(0.93 0.008 var(--h));
  --ink-soft:  oklch(0.78 0.010 var(--h));
  --ink-muted: oklch(0.62 0.012 var(--h));

  /* Sémantique — teintes FIXES, seule la clarté suit le mode.
     Ces trois couleurs portent du sens : elles ne dépendent jamais de l'image. */
  --link-entity: oklch(0.72 0.13 295);  /* violet     — fiche de wiki */
  --link-rule:   oklch(0.70 0.10 168);  /* vert d'eau — règle */
  --gm:          oklch(0.68 0.11  45);  /* terracotta — réservé au MJ */

  /* Actions */
  --accent: oklch(0.76 0.13 78);   /* ambre */
  --danger: oklch(0.62 0.16 25);

  /* Rayons et profondeur */
  --r-sm: 6px;  --r-md: 10px;  --r-lg: 14px;
  --blur: 20px;
}
```

Le mode s'applique par un attribut sur `<html>` — `data-mode="dark | dim | soft | light"` — qui ne réécrit que les valeurs de `L`. Une quinzaine de lignes CSS par mode, pas quatre palettes à maintenir.

### Typographie

Trois familles, trois rôles, aucun chevauchement.

| Rôle | Famille | Usage |
|---|---|---|
| Narratif | **Spectral** (serif) | tout le texte de fiche, l'histoire, les descriptions |
| Chrome | **Inter** | menus, étiquettes, boutons, arborescence |
| Mécanique | **IBM Plex Mono** | `1d6+3`, `CA 14`, `{spell_save_dc}`, clés techniques |

La règle du monospace pour tout ce qui est valeur manipulée par le moteur n'est pas cosmétique : **le lecteur doit savoir sans réfléchir ce qui est du texte et ce qui est une donnée**. Elle a déjà été appliquée aux fiches de règles ; elle vaut partout.

Échelle : 12 / 13 / 15 / 18 / 24 / 32. Le corps narratif est à 15px avec un interligne de 1,7 — on lit ces fiches longtemps.

---

## 2b. Thème dérivé de l'image de fond

L'utilisateur téléverse une image ; l'interface en tire un thème, déclinable en quatre modes. C'est faisable sans risque de lisibilité, à condition de respecter une frontière stricte.

### Ce qu'on dérive, ce qu'on ne dérive jamais

| Dérivé de l'image | Jamais dérivé |
|---|---|
| La **teinte** des surfaces (`--h`) | La clarté du texte |
| La **saturation** des surfaces, plafonnée (`--c`) | Les trois couleurs sémantiques (entité, règle, MJ) |
| Le mode **suggéré** par défaut | Le rapport de contraste |

**La règle en une phrase : l'image teinte, elle ne décide pas.** Toute illisibilité d'un thème généré vient d'avoir laissé l'image influencer la clarté du texte. En bornant la dérivation à la teinte et en imposant `L`, le problème disparaît par construction.

Corollaire important : le violet des renvois wiki, le vert d'eau des règles et le terracotta du contenu MJ **gardent leur teinte dans les quatre modes**. Seule leur clarté s'ajuste. Sinon un accent dérivé pourrait tomber sur le vert des règles, et le codage par couleur — le signe distinctif du produit — cesserait de vouloir dire quelque chose.

### La chaîne de traitement, au téléversement

```
1. Réception de l'image
2. Réduction à 64×64, extraction de la palette (median cut ou k-means, 5 couleurs)
3. Teinte dominante → --h ; saturation moyenne → --c, plafonnée à 0.05
4. Luminance moyenne → mode suggéré :
      L < 0.30 → sombre    0.30–0.50 → demi-sombre
      0.50–0.75 → demi-clair    > 0.75 → clair
5. Génération d'une vignette 32×32 floutée (~1 Ko), stockée en base64
6. Contrôle de contraste sur les quatre modes
7. Stockage du thème sur le monde
```

**Tout cela se fait une seule fois, côté serveur, au téléversement.** Extraire une palette dans le navigateur à chaque chargement serait un gaspillage et provoquerait un scintillement au premier rendu.

**La vignette 32×32 floutée est le vrai fond.** Une image floutée n'a pas besoin d'être nette : agrandie et floutée, une miniature d'un kilo-octet est indiscernable de l'original de trois mégaoctets. L'image pleine résolution n'est jamais chargée pour le fond.

### Le contrôle de contraste

Après génération, chaque paire texte/surface est vérifiée. Si un mode ne passe pas le seuil, **on ne le propose pas** :

> Cette image ne permet pas un thème clair lisible. Modes disponibles : sombre, demi-sombre.

Dire à l'utilisateur qu'un mode est impossible vaut infiniment mieux que lui livrer un écran illisible en le laissant croire que c'est normal.

### Stockage

```json
// worlds.theme
{
  "asset_id": "ast_1f2e",
  "thumb_b64": "data:image/webp;base64,UklGR…",
  "hue": 152,
  "chroma": 0.022,
  "mode": "dark",
  "available_modes": ["dark", "dim", "soft"],
  "overrides": { "accent_hue": null }
}
```

Un champ `jsonb` sur `worlds`, déjà prévu au schéma pour le calendrier — même emplacement, aucune migration supplémentaire.

### Éviter le scintillement

Le thème doit être appliqué **avant le premier rendu**, sinon l'utilisateur voit une palette par défaut clignoter. En App Router : la disposition du monde lit `worlds.theme` côté serveur et injecte les variables dans une balise `<style>` du HTML rendu. Pas de `useEffect`, pas de lecture au montage.

### Accessibilité

- Un bouton **« contraste élevé »** ignore l'image et bascule sur une palette neutre garantie. Toujours accessible, jamais enfoui.
- `prefers-contrast: more` active ce mode automatiquement.
- Le voile sur l'image (`--scrim`) est **fixe par mode**, jamais adaptatif à la zone survolée.

### Images fournies

Prévoir six à huit fonds par défaut, couvrant des ambiances contrastées — forêt, désert, glace, cendre, parchemin, mer — chacun livré avec son thème déjà calculé. Un nouveau monde n'est donc jamais gris par défaut, et l'utilisateur voit tout de suite ce que la fonctionnalité fait.

### Quand le construire

| Quoi | Quand | Pourquoi |
|---|---|---|
| Jetons en OKLCH, `--h` et `--c` en variables, `data-mode` sur `<html>` | **V0-03b, maintenant** | Écrire les jetons en hexadécimal obligerait à tout reprendre. Coût aujourd'hui : deux heures |
| Les quatre modes, sans image (palettes fixes) | V0-03b | Quinze lignes de CSS par mode |
| Téléversement, extraction, vignette, contrôle de contraste, interface de réglage | **V1** | Ne force aucune reprise si fait plus tard |

Même règle que partout : on construit en avance uniquement ce dont l'omission obligerait à refaire l'existant.

---

## 3. La coquille

```
┌──────────────────────────────────────────────────────────────┐
│  ◈  Les chroniques…      [ Monde │ Règles ]         ⌘K  ⚙   │  56px
├───────────────┬──────────────────────────────────────────────┤
│ Rechercher ⌘K │                                              │
│               │      ┌────────────────────────────────┐      │
│ ▾ Personnages │      │  Bram le Tavernier      [PNJ]  │      │
│    Bram       │      │  Alias · Le Borgne             │      │
│    Naivara    │      │  ─────────────────────────     │      │
│ ▾ Lieux       │      │  Faction  › La Main Silencieuse│      │
│    L'Ancre    │      │  Lieu     › L'Ancre Rouillée   │      │
│ ▾ Factions    │      │  ─────────────────────────     │      │
│               │      │  Histoire                      │      │
│               │      │  …                             │      │
│ ▤ ▦ ⌗ ⌸ ⚹     │      └────────────────────────────────┘      │
└───────────────┴──────────────────────────────────────────────┘
      280px                  fond : image du monde, floutée
```

**Barre supérieure.** Monde courant à gauche, bascule de mode au centre (`Monde` / `Règles` — le mode solo viendra en V3), recherche et réglages à droite.

**Barre latérale, 280px, persistante.** Recherche en haut, arborescence au milieu, sélecteur de vue en bas.

**Zone de travail.** Un panneau translucide centré, largeur maximale 860px. Le fond reste visible autour — c'est ce qui donne l'atmosphère.

---

## 4. Trois décisions qui touchent le routage

Ce sont elles qui justifient de faire ce ticket maintenant.

### 4.1 Une URL par fiche — obligatoire

```
/m/[mondeSlug]                       accueil du monde
/m/[mondeSlug]/f/[ficheSlug]         une fiche
/m/[mondeSlug]/regles/[cle]          une règle
```

Sans URL propre, pas de partage, pas de bouton retour, pas d'onglet, pas de lien depuis une autre fiche. Le `slug` existe déjà en base précisément pour ça.

> **Note d'implémentation (V0-03b) :** `worlds.slug` n'est unique que par propriétaire (`unique(owner_id, slug)`, SCHEMA.md §3), jamais globalement. Deux mondes de deux utilisateurs différents peuvent porter le même slug — un visiteur membre de deux mondes distincts partageant un slug rendrait `/m/[mondeSlug]` ambigu si on résolvait par slug seul. Résolution retenue : le routage `/m/[mondeSlug]/...` reste tel que spécifié pour l'URL affichée, mais la résolution serveur désambiguïse par slug **filtré par appartenance de l'utilisateur courant** (RLS ne renvoie déjà que les mondes dont il est membre) ; si cela renvoyait malgré tout plus d'une ligne pour un même utilisateur (deux mondes à lui avec le même slug — impossible, contrainte `unique(owner_id, slug)` — ou un monde à lui et un monde d'un tiers partageant le slug), la page retourne 404 plutôt que de deviner. Cas limite documenté, pas silencieusement résolu au hasard.

### 4.2 Fenêtres flottantes avec URL (ADR-0006)

**Révisé après V0-06b.** La référence montre plusieurs fiches ouvertes à la fois, en fenêtres déplaçables sur un bureau — pas un panneau unique qui remplace tout l'écran. Ce document tranchait initialement pour un panneau unique en V0, le multi-panneau étant reporté en V1 ; l'écart avec l'attente s'est révélé porter sur le modèle d'interaction lui-même, pas sur un détail de finition. ADR-0006 avance donc le multi-panneau en V0, exécuté comme des fenêtres plutôt que des panneaux fixes côte à côte.

**Ce qui ne change pas :** chaque fiche ouverte reste une URL. La première fiche ouverte occupe `/m/[mondeSlug]/f/[ficheSlug]` (rendue serveur, comme avant). Les fiches ouvertes en plus apparaissent dans un paramètre `?avec=[slug1],[slug2],...`, récupérées côté client via une route API dédiée (mêmes données que la page : entité, blocs, relations, autres entités).

**Ce qui change :** `<Panel>` n'est plus le conteneur plein-page. Une couche de gestion de fenêtres maintient, par fiche ouverte, une position, une taille et un ordre d'empilement (z-index) — synchronisés avec `?avec=` sans provoquer de boucle de mise à jour. Fermer une fenêtre retire son slug du paramètre ; en faire glisser une au premier plan met à jour l'ordre d'empilement (pas l'URL, pour ne pas polluer l'historique de navigation à chaque interaction).

**Petit écran :** la mécanique de fenêtres déplaçables ne s'applique pas — repli sur l'affichage plein écran actuel, une fiche à la fois (aucune régression sur le critère de lisibilité à 375px de V0-03b).

### 4.3 L'arborescence est dérivée, pas saisie

C'est le point où je m'écarte de la référence, qui semble utiliser des dossiers manuels.

**Un dossier manuel est une seconde hiérarchie.** Elle divergera de `part_of`, et il faudra un jour expliquer pourquoi une ville est dans le dossier « Cormyr » alors qu'elle est rattachée à Amn.

À la place :

- **V0** : groupement par `entity_kind`, imbrication par `part_of`. Simple, toujours juste.
- **V1** : des **vues enregistrées** — un nom, une icône, un filtre. « PJ » est un filtre (`campaign_characters.is_pc = true`), « Artefacts » est un filtre (`entity_kind = 'item'` + étiquette). On obtient la sensation de dossiers, sans le doublon.

Presque tout ce que montre la référence est dérivable. PJ contre PNJ l'est. Artefacts l'est. Pays l'est.

---

## 5. Les composants à écrire une fois

| Composant | Rôle |
|---|---|
| `<AppShell>` | barre supérieure, latérale, zone de travail, fond |
| `<Sidebar>` · `<EntityTree>` | arborescence dérivée, repliable |
| `<CommandPalette>` | ⌘K — recherche et navigation |
| `<WindowFrame>` | fenêtre déplaçable/redimensionnable d'une fiche (ADR-0006, remplace `<Panel>`) |
| `<EntityChip>` · `<RuleChip>` | renvois, violet et vert d'eau, avec résumé au survol |
| `<PropertyRow>` | une ligne de relations en en-tête de fiche |
| `<BlockShell>` | cadre commun d'un bloc : titre, visibilité, repli, menu |
| Six composants de mise en page | `prose`, `key_values`, `table`, `progression_table`, `chips`, `gallery` |
| `<VisibilityBadge>` | le liseré terracotta — le signe distinctif |
| `<EmptyState>` | un écran vide est une invitation à agir, pas un message d'erreur |

**Un composant par mise en page, jamais un par type de bloc.** C'était déjà la décision de `Spec_Blocs_de_Regles` §4 ; elle vaut ici aussi. Vingt types de blocs, six composants de rendu.

---

## 6. Deux motifs repris de la référence

**Les relations vivent dans l'en-tête, pas dans un bloc.** La référence affiche « Personnage › Epitha, Sah, Godefroy » et « Faction › À l'Ouest, Magiciens rouges » juste sous le titre, en pastilles cliquables, avec un bouton « Ajouter une propriété ». C'est mieux qu'un bloc enfoui en bas de page : les relations sont ce qu'on consulte le plus souvent.

Conséquence : le bloc `relationships` prévu en V1 devient **facultatif**. Le rendu par défaut de `relations` est la bande de propriétés en en-tête. Même donnée, meilleur emplacement.

**Le sélecteur de bloc est en bas de la fiche.** Une rangée discrète — Texte, Image, Carte, Arbre, Chronologie, Bloc de stats, Fiche de personnage — plutôt qu'un menu caché. L'utilisateur voit ce qu'il peut ajouter sans le chercher, et le catalogue devient auto-documenté.

Les « Modèles guidés » de la référence sont exactement nos `entity_templates`.

---

## 7. Ce qu'il ne faut pas faire maintenant

| Reporté | Quand |
|---|---|
| Thème clair | après la V1, si quelqu'un le demande |
| Animations et transitions | jamais gratuitement ; seulement là où elles expliquent un changement d'état |
| Panneaux multiples | V1 |
| Canevas, vue graphe, vue carte | V2 |
| Réorganisation par glisser-déposer | V1 (le `display_order` en `numeric` est déjà prêt) |
| Une quatrième famille typographique | non |

Plancher de qualité, sans en faire un sujet : responsive jusqu'au mobile, focus clavier visible, `prefers-reduced-motion` respecté, contraste suffisant sur le fond flouté — c'est le piège de cette direction visuelle, à vérifier réellement et pas à supposer.

---

## 8. Le ticket

## V0-03b — Coquille d'application et système visuel · `L`

À faire **après V0-03, avant V0-04**.

**Livrables**
- `src/styles/tokens.css` avec les jetons de §2, **en OKLCH**, `--h` et `--c` en variables, branchés dans la configuration Tailwind.
- Attribut `data-mode` sur `<html>` et les quatre modes (`dark`, `dim`, `soft`, `light`) en palettes fixes — sans extraction d'image, qui viendra en V1.
- Bouton « contraste élevé » ignorant la teinte, et prise en compte de `prefers-contrast: more`.
- Les trois familles typographiques chargées localement (pas de requête à un CDN tiers).
- `<AppShell>` : barre supérieure, barre latérale 280px, zone de travail, fond image floutée.
- Routage `/m/[mondeSlug]` et `/m/[mondeSlug]/f/[ficheSlug]`.
- `<EntityTree>` dérivée : groupée par `entity_kind`, imbriquée par `part_of`.
- `<CommandPalette>` sur ⌘K : recherche d'entité, navigation.
- `<Panel>`, `<BlockShell>`, `<EntityChip>`, `<VisibilityBadge>`, `<EmptyState>`.
- Reprise des écrans de V0-02 et V0-03 dans la coquille.

**Critères d'acceptation**
- [ ] Aucune couleur ni taille de police en dur hors de `tokens.css` (vérifiable par recherche).
- [ ] Changer `--h` sur `<html>` reteinte toute l'interface sans qu'aucun texte ne passe sous 7:1.
- [ ] Les quatre modes sont lisibles, et les trois couleurs sémantiques restent reconnaissables dans chacun.
- [ ] Ouvrir une fiche change l'URL ; recharger la page rouvre la même fiche ; le bouton retour fonctionne.
- [ ] La barre latérale reflète les entités réelles du monde, sans aucune saisie de dossier.
- [ ] Un bloc en visibilité MJ porte le liseré terracotta et un libellé explicite.
- [ ] ⌘K ouvre la palette, la flèche et Entrée naviguent, Échap ferme.
- [ ] Le focus clavier est visible sur tous les éléments interactifs.
- [ ] La page reste lisible à 375px de large.
- [ ] `prefers-reduced-motion: reduce` désactive toute transition.
- [ ] Un monde sans aucune fiche affiche un état vide qui propose une action, pas un écran blanc.

**À donner à Claude Code avec le ticket :** ce document **et les captures d'écran de référence**. Il sait lire les images, et une capture transmet une direction visuelle infiniment mieux que trois paragraphes de description.

---

## 9. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| L'image de fond est-elle choisie par monde ou par l'utilisateur ? | par monde, dans les réglages ; défaut fourni |
| ~~Que se passe-t-il si l'image de fond est claire ?~~ | **Tranché (30/07) :** thème dérivé à quatre modes, voir §2b. L'image teinte, elle ne décide pas |
| Combien de fonds fournis au départ ? | six à huit, ambiances contrastées, thème pré-calculé |
| Sous-types d'entité (Écologie › Flore, Faune) | des étiquettes, pas un second niveau de `entity_kind` |
| Densité : confortable ou compacte ? | une seule densité en V0 ; un réglage seulement si quelqu'un le demande |
