# Backlog V3.1 — Tickets des Règles sur ordinateur et de la Chronologie du monde (9 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage de deux décisions de V3.1-19 : « Règles sur ordinateur » (8
octobre) et « Chronologie du monde » (9 octobre). Les règles de lecture des
tickets du lot i et de la fiche du wiki (plus haut) valent ici : planches qui
font foi, jetons de la charte, libellés dans `messages/`, MJ en fenêtre,
fenêtre étroite par requête de conteneur, typecheck + lint + test + planche
du catalogue.

**Les planches** (canevas https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm,
x = 5420) :

| Fichier de planche | Contenu |
|---|---|
| `Regles-Ordi-Decide.dc.html` (y = 31 600) | Règles : MJ sur ordinateur, joueur en page pleine, fenêtre étroite |
| `Chrono-B-Horizontale.dc.html` (y = 33 710) | Chronologie : la frise du MJ, la page des joueurs, le panneau « Ères… » |

Les données des planches (Sildar, la Guerre des Orcs, « 1492 »…) sont des
exemples.

| Ticket | Contenu | Modèle | Dépend de |
|---|---|---|---|
| V3.1-93 | Règles : le sommaire dans la fenêtre | Sonnet | 20, 25 |
| V3.1-94 | Règles : la règle au centre, renvois, onglets, ⋮, variante | Sonnet | 93, 20 ; « Modifier » : 2 |
| V3.1-95 | Règles : fenêtre étroite et page du joueur | Sonnet | 94, 27 |
| V3.1-96 | Chronologie : portée, événements directs, naissances et morts (données) | **Opus** | 74 |
| V3.1-97 | Chronologie : le noyau pur (échelle, niveaux de détail, rangement) | Sonnet | 96 (forme) |
| V3.1-98 | Chronologie : la frise du MJ | Sonnet | 96, 97, 20, 64 |
| V3.1-99 | Chronologie : la page des joueurs | Sonnet | 98, 27 |

**Ordre conseillé** : 93 → 94 → 95 ; en parallèle 96 (Opus) → 97 → 98 → 99.

---

### ☐ V3.1-93 — Règles : le sommaire passe dans la fenêtre · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Regles-Ordi-Decide.dc.html`, vue MJ. **Départ** :
`components/rules/RulesSidebar.tsx` (la barre de 280 px hors fenêtre),
`src/server/services/rules.ts` (liste lue à la demande, V2-G1).
**Dépend de** : 20 (fenêtres à volets), 25 (pilule).

**Ce qui est décidé**
- La barre hors fenêtre disparaît : **le sommaire vit dans la fenêtre
  Règles**, colonne de **250 px** à gauche.
- De haut en bas : **recherche** (filtre la liste en direct) ;
  **« Récemment »** (les dernières règles ouvertes, dans le navigateur,
  comme au téléphone V3.1-30 — même clé de stockage, `try/catch` autour) ;
  **catégories repliables** avec leur nombre de fiches ; sous-classes sous
  leur classe et sous-espèces sous leur espèce (comme aujourd'hui).
- En pied : **« + Ajouter une règle ▾ »** (arme, historique, don,
  sous-classe, sort maison — les formulaires existants) et **« Bacs à sable
  ▾ »** (formules, déclencheurs — les outils existants).
- La règle ouverte est surlignée dans le sommaire.

**Critères d'acceptation**
- [ ] Plus aucune barre de règles hors de la fenêtre.
- [ ] La recherche et « Récemment » fonctionnent sans rechargement.
- [ ] Les formulaires d'ajout et les bacs à sable s'ouvrent comme
  aujourd'hui (aucun geste perdu).

---

### ☐ V3.1-94 — Règles : la règle au centre, renvois en volet, onglets · `L` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Regles-Ordi-Decide.dc.html`, vue MJ. **Départ** :
`components/rules/RuleEntryView.tsx`, `RuleRefsPanel.tsx`,
`ModifiedBlockBadge.tsx`. **Dépend de** : 93, 20 ; « Modifier » : V3.1-2.

**Ce qui est décidé**
- **La règle au centre** : titre, type, source ; « Modifiée dans ta
  variante » quand c'est le cas, et sur le bloc modifié la bascule
  **Officiel / Ta variante** (lecture de l'une ou l'autre, rien n'est
  écrit) ; propriétés en encadré ; texte, **renvois soulignés en
  pointillé** ; « Aux niveaux supérieurs » ; en pied **« Cette règle cite /
  Citée par »** (`RuleRefsPanel`, sortants et entrants). **Plus de cadre
  d'illustration vide.**
- **Toucher un renvoi l'ouvre dans le volet de droite** (V3.1-20) sans
  quitter la règle lue ; × ferme le volet. **Chaque règle ouverte devient un
  onglet** de la fenêtre (pilule, × par onglet).
- **⋮** : épingler au Bloc-notes ; copier le lien pour le wiki ; créer une
  version maison (copie dans la variante, éditable) ; **Modifier** —
  fiches maison seulement (V3.1-2). Une règle officielle ne se modifie
  jamais (règle 18) : l'entrée n'existe pas pour elle.

**Critères d'acceptation**
- [ ] Ouvrir un renvoi ne change pas la règle du volet principal.
- [ ] La bascule Officiel / Ta variante n'écrit rien en base.
- [ ] « Modifier » est absent sur une règle `is_official_base`.

---

### ☐ V3.1-95 — Règles : fenêtre étroite et page du joueur · `S` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Regles-Ordi-Decide.dc.html`, vues « fenêtre étroite » et
« joueur ». **Départ** : la page joueur des règles
(`app/m/[worldSlug]/joueur/regles/page.tsx`, `PlayerRulesSidebar.tsx`).
**Dépend de** : 94, 27. Le téléphone reste V3.1-30.

**Ce qui est décidé**
- **Fenêtre étroite** (tablette, volet partagé ; requête de conteneur, pas
  de largeur d'écran) : le sommaire passe en **tiroir ☰** ; un renvoi
  s'ouvre en **panneau opaque de 340 px** par-dessus la page (jamais
  translucide).
- **Joueur** (page pleine, sans fenêtre) : la même page ; sommaire sans
  « Ajouter » ni bacs à sable ; **pas de ⋮** ; pas de bascule Officiel /
  Variante : il lit les règles de sa table, badge **« Règle de la table »** ;
  pas de données brutes.

**Critères d'acceptation**
- [ ] Fenêtre de 560 px : tiroir ☰ et panneau de renvoi opaque.
- [ ] Le joueur ne reçoit ni les gestes du MJ ni les données brutes (vérifié
  dans la réponse serveur, pas seulement à l'écran).

---

### ☐ V3.1-96 — Chronologie : portée, événements directs, naissances et morts (données, ADR) · `M` — **prêt (Opus) — conçu le 9 octobre, ADR 0048 (fiche système `world_timeline`)**

**Modèle conseillé : Opus** — forme d'une donnée de bloc, une fiche
système, une agrégation filtrée côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/schemas/blocks/timeline.ts`,
`src/server/services/timeline.ts` (`getWorldTimeline`), la route
`timeline-promote`. **Dépend de** : V3.1-74 (dates de naissance et de mort).

**À trancher, ADR à l'appui** (les trois points de la décision du 9 octobre)
1. **La portée** d'une entrée de chronologie : champ `scope` parmi `major`
   (Monde), `notable` (Région), `detail` (Détail), **optionnel** — absent =
   défaut selon le genre : guerre, catastrophe, fondation → `major` ;
   bataille, découverte, serment, trahison → `notable` ; naissance, mort,
   rencontre → `detail`. Naissances et morts des fiches personnage →
   `detail`. Nouvelle version du schéma de bloc (`__v`), migration des
   données lue par le schéma, pas de réécriture en base.
2. **Où vit un événement ajouté directement** dans la frise générale.
   Proposé : le bloc Chronologie d'une **fiche système « Chronologie du
   monde »**, une par monde, hors des listes du wiki (comme le Livre de
   sessions), plutôt qu'une table nouvelle. À confirmer ou remplacer.
3. **L'agrégation** : `getWorldTimeline` lit aussi les naissances et morts
   des blocs personnage (V3.1-74), **en une requête groupée** (pas de N+1),
   et filtre chaque date par sa visibilité **côté serveur** (règle 5) : une
   date MJ ou privée n'est jamais envoyée à une joueuse.
- Chaque entrée renvoyée dit d'où elle vient (`source` : fiche et bloc, ou
  frise générale, ou naissance / mort d'un personnage) pour « Depuis la
  fiche de… ». Les séances n'y entrent pas.
- Une action serveur pour **changer la portée** d'une entrée (MJ) et pour
  **ajouter un événement** dans la frise générale ou dans une fiche ; Zod.

**Critères d'acceptation**
- [ ] ADR ; schéma de bloc versionné ; `docs/SCHEMA.md` à jour si une table
  ou une fiche système naît.
- [ ] Une joueuse ne reçoit aucune date qu'elle ne peut pas voir (test).
- [ ] Une seule requête pour les naissances et morts d'un monde (test).

---

### ☐ V3.1-97 — Chronologie : le noyau pur · `S` — **prêt**

**Modèle conseillé : Sonnet** — logique pure, **tests d'abord**.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Fichier** : `src/core/timeline/view.ts` (+ tests). Rien de `react`,
`next`, `@supabase`. **Dépend de** : la forme des entrées de V3.1-96.

**Ce qui est décidé** (constantes reprises de la planche)
- **Échelle proportionnelle au temps** : une vue = un centre `c` et une
  étendue `S` (en années) ; `x(année) = marge + (année − (c − S/2)) / S ×
  (largeur − 2 × marge)`, marge 110 px. `S` borné entre 20 ans et l'étendue
  du monde.
- **Niveau de détail selon `S`** : au-dessus de **400 ans**, seulement
  `major` ; de 130 à 400 ans, `major` et `notable` ; au-dessous de **130
  ans**, tout. Renvoie aussi le **nombre de dates cachées** dans la vue
  (« 12 de plus en zoomant ») et le libellé (« Vue : 120 ans · tout,
  jusqu'aux naissances »).
- **Graduations** selon `S` : 250 ans au-dessus de 800, 100 au-dessus de
  300, 50 au-dessus de 120, 10 au-dessus de 50, sinon 5.
- **Rangement des cartes** (largeur de carte 186 px) : alternées au-dessus
  puis au-dessous de l'axe ; si les deux côtés sont pris à cet endroit, la
  date rejoint un **« + n autour »** sur la carte voisine, avec la plage à
  viser pour zoomer dessus.
- **Ères en bandeaux** : de `startYear` à la `startYear` suivante (la
  dernière jusqu'à aujourd'hui), coupées aux bords de la vue ; le nom suit
  la partie visible.
- **Gestes** en fonctions pures : défiler (molette : ±12 % de `S`),
  zoomer autour d'un point (Ctrl + molette : ×1,25 / ×0,8 ; − / + : ×1,6),
  ‹ › (±30 %), préréglages **Le monde**, **Une ère** (400 ans), **Un
  siècle** (130), **Une vie** (60), **Centrer sur aujourd'hui** (même `S`,
  aujourd'hui au quart gauche de la vue).

**Critères d'acceptation**
- [ ] Tests : bornes de zoom, seuils 400 / 130 exacts, rangement avec
  chevauchement, ère coupée au bord, aucune date perdue (montrée, cachée ou
  dans un « + n »).

---

### ☐ V3.1-98 — Chronologie : la frise du MJ · `L` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Chrono-B-Horizontale.dc.html`, vue MJ. **Départ** :
`app/m/[worldSlug]/(monde)/chronologie/page.tsx`,
`components/shell/WorldTimelineView.tsx` (la liste de cartes, remplacée).
**Dépend de** : 96, 97, 20, 64 (pastille de visibilité).

**Ce qui est décidé**
- **Le fleuve à l'horizontale** (V3.1-97 pour tout le calcul) : axe
  horizontal ; **ères en bandeaux colorés** sur l'axe ; graduations ;
  **« aujourd'hui » en trait doré** (date du calendrier du monde) ; une
  carte par date, alternée au-dessus / au-dessous, reliée à son point par
  une tige, pastille de la couleur du **genre** ; point plus petit pour une
  date `detail`.
- **Carte** : genre, date, titre (lien si l'entrée est une fiche), d'où
  vient la date (« Depuis la fiche de Sildar », « Frise générale »,
  « Naissance »), et pour le MJ la **pastille de visibilité** (V3.1-64) et
  la **pastille de portée** au toucher (Monde → Région → Détail →
  Monde, V3.1-96). Toucher la carte ouvre son détail (résumé, « → en faire
  une fiche » par `timeline-promote`).
- **Barre du haut** : « Vue : … » et « n de plus en zoomant » ; − / + ;
  préréglages ; **« ◎ Centrer sur aujourd'hui »** ; ‹ ›. **Molette haut /
  bas = défiler de gauche à droite**, **Ctrl + molette ou pincer =
  zoomer** autour du point visé, glisser = défiler (la molette ne fait pas
  défiler la page tant que le pointeur est sur la frise).
- **Filtres** par genre et par fiche, **recherche** ; **« Voir comme les
  joueurs »** (même vue que V3.1-99, servie par le serveur).
- **« + Événement »** : formulaire (date au calendrier du monde, genre,
  titre, résumé, visibilité, portée) et « dans : la frise générale » ou une
  fiche (V3.1-96).
- **« Ères… »** : panneau à droite — une ligne par ère (nom, année de
  début ; « de l'an 1302 à l'an 1479 » calculé), ×, « + Ajouter une ère »,
  « Enregistrer » (« Modifications non enregistrées » tant qu'on n'a pas
  enregistré). Écrit `CalendarConfig.eras` — le même réglage que l'outil
  Calendrier (V3.1-55) ; rien de neuf en base.
- Fenêtre étroite : la barre passe sur deux lignes ; le panneau « Ères… »
  en tiroir.

**Critères d'acceptation**
- [ ] Molette, Ctrl + molette, pincer, glisser, ‹ ›, préréglages et
  « Centrer sur aujourd'hui » fonctionnent.
- [ ] À 120 ans de vue, les naissances paraissent ; à 500, seulement les
  grands événements ; le compteur des dates cachées est juste.
- [ ] Changer une ère se voit dans la frise et dans l'outil Calendrier.

---

### ☐ V3.1-99 — Chronologie : la page des joueurs · `S` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Chrono-B-Horizontale.dc.html`, vue joueur. **Dépend de** :
98, 27 (rail du joueur).

**Ce qui est décidé**
- **Une page du Wiki du joueur** (rail du joueur ; téléphone : Wiki ›
  Chronologie) : la même frise, **seulement les dates qu'il peut voir**
  (filtrées côté serveur par V3.1-96, jamais cachées au CSS) ; mêmes gestes,
  mêmes niveaux de détail, « Centrer sur aujourd'hui ».
- **Ni** « Ères… », **ni** « + Événement », **ni** pastilles de visibilité
  ou de portée, ni « → en faire une fiche ».
- Téléphone : la frise en pleine largeur, gestes au doigt (glisser,
  pincer), préréglages en pilule sous la frise.

**Critères d'acceptation**
- [ ] La réponse serveur de la page joueur ne contient aucune date MJ ou
  privée (test).
- [ ] Téléphone 390 px : pincer zoome, glisser défile, aucun défilement
  horizontal de la page.
