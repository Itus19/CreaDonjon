# Backlog V3.1 — Tickets de la fiche du wiki et de ses blocs (8 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage des décisions du 8 octobre : la fiche du wiki sur ordinateur, puis
les trois familles de blocs — Récit, Psyché et liens, Outils de jeu (dont la
Fiche de créature). Les décisions détaillées vivent dans V3.1-19 (sections
« la fiche du wiki sur ordinateur » et « Les blocs de la fiche du wiki — 1,
2, 3 ») ; chaque ticket ci-dessous les reprend **en entier**, pour qu'on
puisse le coder sans relire la conversation.

**Déjà couverts ailleurs** (pas de ticket en double) : l'éditeur de la fiche
sur téléphone (V3.1-30, V3.1-31) ; les blocs de personnage (Personnage,
Inventaire, Incantation, Ressources : V3.1-26, 28, 32) ; le Générateur
(outil du MJ, V3.1-45) ; la naissance d'un personnage au calendrier du monde
(V3.1-48) ; « Voir comme » côté serveur (V3.1-12).

### Comment lire ces tickets (à faire lire à Sonnet avant chaque ticket)

Tout ce qui est écrit dans « Comment lire ces tickets » du lot i (plus haut)
vaut ici à l'identique : planches qui font foi pour l'apparence et les
comportements, exemples qui ne sont que des exemples, jetons et recettes de
la charte au lieu des couleurs en dur des planches, règles communes 1 à 8
(MJ en fenêtre, tablette = fenêtre étroite par requête de conteneur,
téléphone en feuilles du bas, ascenseurs globaux, quatre recettes de
boutons, rapidité, libellés en français dans les fichiers de libellés,
typecheck + lint + test + planche du catalogue). En plus :

**Les planches** sont sur le canevas
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm, rangée « fiche du wiki »
(y = 27000 et dessous) :

| Fichier de planche | Contenu |
|---|---|
| `Wiki-Fiche-Decide.dc.html` | La fiche du wiki sur ordinateur (en-tête, cartes de verre, palette) |
| `Blocs-Recit-Decide.dc.html` | Texte, Encadré, Image (B), Tableau, Chronologie ; pastille de visibilité au toucher |
| `Psy-Decide.dc.html` | Personnalité, Convictions, Réseau, Généalogie, Relation — ordinateur et téléphone |
| `Outils-Decide.dc.html` | Table aléatoire, Quête, Musique, Carte — ordinateur et téléphone |
| `Creature-Decide.dc.html` | Fiche de créature — ordinateur et téléphone |

Une planche est **vivante** : sa logique (balise `<script type="text/x-dc">`)
montre exactement ce que fait chaque bouton ; la lire quand un comportement
semble ambigu. Les planches sont des maquettes : les données (Sildar,
Gundren, Venomfang, « 7 oct. 1492 »…) sont des exemples, les tirages et
jets y sont simulés par `Math.random` — **dans l'application, seul le
serveur tire et lance** (règle 8).

**Règles propres à ces tickets**
1. **Une carte de verre par bloc, partout** : chaque bloc garde l'en-tête
   de carte de V3.1-63 (⠿, ▾, titre, type, « Enregistré », pastille de
   visibilité, ⋮). Les tickets de blocs ne décrivent que **l'intérieur** de
   la carte.
2. **Lecture et édition dans le même dessin.** Le wiki public et la page du
   joueur affichent le même intérieur, sans les commandes d'édition
   (`canEditEntity`, règle 22) ; ce qui est caché à un lecteur ne lui est
   jamais envoyé (règle 5) — pas de champ masqué en CSS.
3. **Bandes nommées, jamais le nombre** (specs/psyche-pnj.md §1.5) : un
   lecteur voit « Altruisme fort », jamais « 45 » ; la valeur exacte
   n'apparaît qu'au survol, pour le MJ.
4. **Psyché : les valeurs bougent par le journal ou par le réglage du MJ,
   rien d'autre.** Glisser un curseur est le réglage fin du MJ (comme
   aujourd'hui) ; un souvenir passe par les routes `personality-event` /
   `attitude_events` existantes (ADR 0013).
5. **Tests d'abord pour le noyau** (`src/core/**`) : chaque fonction pure
   nouvelle a ses tests avant son code.

**Choisir le modèle** : Opus pour 74 (donnée nouvelle, ADR), Sonnet pour
tout le reste. Si Sonnet bute sur une décision que le ticket ne tranche pas,
il s'arrête et la note ici.

**Ordre conseillé** : 63 → 64 (tout le reste s'appuie sur la carte de verre
et sa pastille) ; puis Récit (65 à 68) ; puis 69 (noyau psyché) → 70, 71,
72, 73 ; puis Outils de jeu (75 à 78) ; 79 après V3.1-26 et 33 ; 74 après
V3.1-48.

| Ticket | Contenu | Taille | Modèle | Dépend de |
|---|---|---|---|---|
| V3.1-63 | Fiche du wiki sur ordinateur : en-tête, cartes de verre, palette en familles | L | Sonnet | 20, 25 |
| V3.1-64 | La pastille de visibilité au toucher, avec « Annuler » | S | Sonnet | 63 |
| V3.1-65 | Bloc Texte : lettrine, bulle du paragraphe, assistance IA en encart | M | Sonnet | 63 |
| V3.1-66 | Blocs Encadré et Tableau | M | Sonnet | 63 |
| V3.1-67 | Bloc Image : la barre flottante et l'aperçu dans le texte (B) | M | Sonnet | 63 |
| V3.1-68 | Bloc Chronologie : l'axe en bande et une ligne par événement | M | Sonnet | 63, 64 |
| V3.1-69 | Noyau psyché : libellés uniques, bandes des pôles, tension, résumé | S | Sonnet | — |
| V3.1-70 | Personnalité (A) et Convictions (même dessin, comparer avec une faction) | L | Sonnet | 63, 69 |
| V3.1-71 | Relation (A) : deux portraits, le résumé, les fils à perle | L | Sonnet | 63, 69 |
| V3.1-72 | Réseau (B) : vignettes, filtres, survol qui allume | M | Sonnet | 63 |
| V3.1-73 | Généalogie (B) : les grands portraits | M | Sonnet | 63 ; dates : 74 |
| V3.1-74 | Dates de naissance et de mort (données) | M | **Opus** | 48 |
| V3.1-75 | Table aléatoire (A) et le dé animé | M | Sonnet | 63, 33 |
| V3.1-76 | Quête (C) : une ligne, dépliable | S | Sonnet | 63 |
| V3.1-77 | Musique (A) : la platine, les bornes, la durée des fondus | M | Sonnet | 63 |
| V3.1-78 | Carte (C) : la carte et sa liste par couches | M | Sonnet | 63, 64 ; « Voir comme » : 12 |
| V3.1-79 | Fiche de créature (A) : la fiche de personnage, pour une créature | L | Sonnet | 25, 26, 33, 63 |

---

### ☐ V3.1-63 — Fiche du wiki sur ordinateur : en-tête, cartes de verre, palette en familles · `L` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive, aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Wiki-Fiche-Decide.dc.html`. **Départ** :
`app/m/[worldSlug]/(monde)/f/[entitySlug]/page.tsx` et `EditEntityForm.tsx`,
`components/blocks/EntityBlocks.tsx` (`BLOCK_TYPE_LABELS`,
`BlockDataEditor`, l'ajout de bloc), `components/shared/ActionsMenu.tsx`,
`components/shared/visibilityOptions.ts`, `components/entities/RelationsChips.tsx`,
`components/entities/PortraitUpload.tsx`, `components/entities/EntityHistoryPanel.tsx`.
**Dépend de** : 20 (fenêtres à volets), 25 (pilule).

**Ce qui est décidé**
- La fiche **s'édite directement**, au verre minéral, dans la fenêtre à
  volets du MJ (V3.1-20). C'est l'écran le plus utilisé du MJ. Le téléphone
  garde l'éditeur de V3.1-30 et 31 (rien à changer ici sur téléphone).
- **En-tête** :
  - le titre, éditable sur place ; sur une fiche neuve, le nom par défaut
    est **sélectionné** (on tape directement par-dessus) ;
  - le **type ▾** (PJ, PNJ, Lieu… et « + Créer une catégorie » en bas du
    menu — même service que la création de catégorie d'aujourd'hui) ;
  - l'**historique** (ouvre `EntityHistoryPanel`) et l'**œil du wiki
    public** (même lien qu'aujourd'hui) ;
  - l'**adresse** (slug) dessous, en petit ;
  - **Alias** et **Relations** en pastilles, × pour retirer, « + » pour
    ajouter (relations : `RelationsChips`, même route qu'aujourd'hui) ;
  - le **portrait à droite** (`PortraitUpload`).
- **Une carte de verre par bloc.** En-tête de la carte, de gauche à droite :
  - ⠿ pour glisser (réordonner), **aussi au clavier** (focus sur ⠿, puis
    flèches haut/bas, Entrée pour poser, Échap pour annuler) ;
  - ▾ / ▸ pour replier / déplier (l'état replié est une préférence locale
    de l'éditeur, pas une donnée du bloc) ;
  - le titre du bloc, **éditable sur place** (`display.label`) ;
  - le type en pastille (« Texte », « Relation »…, `BLOCK_TYPE_LABELS`) ;
  - « Enregistré », annoncé poliment (`aria-live="polite"`) après chaque
    sauvegarde réussie ;
  - **la visibilité en pastille de couleur** : vert Public, bleu Joueurs,
    orange MJ, gris Privé (jetons de la charte ; « campagne » et
    « utilisateur » gardent leur libellé actuel). Son comportement au
    toucher est V3.1-64 ; ici elle ouvre seulement l'infobulle qui dit qui
    la voit (« le MJ seul — jamais envoyé aux joueurs ») ;
  - ⋮ (`ActionsMenu`) : Monter, Descendre, Dupliquer, Choisir la
    visibilité…, Supprimer…. **Les ▲▼ d'aujourd'hui passent dans ⋮.** La
    suppression est confirmée (`ConfirmDialog`) et rappelle que
    l'historique la garde.
- **« + Ajouter un bloc »** en bas ouvre la palette **en familles**, dans
  cet ordre :
  - Récit : Texte, Encadré, Image, Tableau, Chronologie ;
  - Personnage : Personnage, Inventaire, Incantation, Ressources, Fiche de
    créature ;
  - Psyché et liens : Personnalité, Relation, Convictions, Réseau,
    Généalogie ;
  - Outils de jeu : Table aléatoire, Quête, Musique, Carte.
  - `generator`, `note_tree` et `session_journal_meta` **n'apparaissent
    pas** dans la palette (comme aujourd'hui pour le dernier).
- **Fenêtre étroite** (tablette, volet partagé — requête de conteneur, pas
  `window.innerWidth`) : portrait réduit, blocs Personnalité et Convictions
  sur une colonne, pastille de type masquée dans l'en-tête de carte.
- **Données** : rien de neuf.

**À faire**
1. Extraire l'en-tête de carte en un composant partagé `BlockCard`
   (`components/blocks/BlockCard.tsx`) : il porte ⠿, ▾, titre, type,
   « Enregistré », pastille, ⋮, et reçoit l'intérieur en `children`. Tous
   les blocs passent par lui ; les tickets 65 à 79 n'y touchent pas.
2. Refaire l'en-tête de fiche dans `EditEntityForm.tsx`.
3. Palette en familles (constante ordonnée dans `EntityBlocks.tsx`, libellés
   des familles dans le fichier de libellés).
4. Planche du catalogue : en-tête de fiche, `BlockCard`, palette.

**Ne pas faire** : toucher l'intérieur des blocs (tickets suivants) ;
changer le téléphone ; ajouter un type de bloc.

**Critères d'acceptation**
- [ ] Une fiche neuve s'ouvre le nom sélectionné ; taper le remplace.
- [ ] Réordonner un bloc au clavier (⠿ + flèches + Entrée) fonctionne et s'annonce.
- [ ] Les ▲▼ ont disparu des cartes ; Monter / Descendre sont dans ⋮.
- [ ] La palette montre quatre familles, dans l'ordre ci-dessus, sans `generator`, `note_tree`, `session_journal_meta`.
- [ ] En fenêtre étroite (volet partagé), la pastille de type disparaît et le portrait se réduit (test visuel à 820 px de volet).
- [ ] Aucun changement côté téléphone (390 px).

---

### ☐ V3.1-64 — La pastille de visibilité au toucher, avec « Annuler » · `S` — **prêt**

**Modèle conseillé : Sonnet** — comportement entièrement décrit ; route existante.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html` (toutes les cartes ; essayer la
pastille). **Départ** : `BlockCard` (V3.1-63),
`components/shared/visibilityOptions.ts`, la route de mise à jour de
visibilité d'un bloc utilisée aujourd'hui par `EntityBlocks.tsx`.
**Dépend de** : 63.

**Ce qui est décidé (demande de l'auteur)**
- Un toucher sur la pastille fait passer à la visibilité **suivante** :
  Public → Joueurs → MJ → Privé → Public. Couleur et libellé suivent
  aussitôt (mise à jour optimiste, remise en place si le serveur refuse).
- Chaque changement **s'annonce** dans une annonce discrète en bas de la
  fiche : « « Rumeurs de Phandaline » : visible par le MJ seul. » avec un
  bouton **« Annuler »** (remet la valeur précédente). Quand le bloc devient
  **plus visible** qu'avant (MJ → Privé → Public…), l'annonce ajoute
  « Attention : il redevient visible. ».
- Phrases exactes : Public = « tout le monde, wiki public compris » ;
  Joueurs = « la table, pas le wiki public » ; MJ = « le MJ seul » ; Privé =
  « son auteur seul ».
- Le choix direct reste dans ⋮ « Choisir la visibilité… » (tous les
  niveaux, y compris campagne et utilisateur, qui **ne font pas partie du
  cycle** : un bloc à l'un de ces niveaux passe à Public au premier
  toucher, avec l'annonce).
- Valable pour **tous les blocs**, et pour la pastille de chaque événement
  de la Chronologie (V3.1-68), chaque aspiration (V3.1-70), chaque punaise
  et couche de la Carte (V3.1-78) — un seul composant `VisibilityPill`.
- **Limite assumée** : l'écriture est immédiate, d'où l'annonce et
  « Annuler ». La visibilité reste filtrée côté serveur (règle 5).

**À faire** : composant `VisibilityPill` (props : niveau, `onChange`,
libellé de l'objet pour l'annonce) ; annonce avec « Annuler » (réutiliser le
composant d'annonce existant s'il y en a un, sinon le créer une fois) ;
planche du catalogue.

**Critères d'acceptation**
- [ ] Quatre touchers ramènent à la visibilité de départ ; chaque étape est enregistrée (test de composant + route).
- [ ] « Annuler » rétablit la valeur précédente côté serveur.
- [ ] L'annonce dit « Attention : il redevient visible. » quand on va vers plus visible.
- [ ] Lecteur d'écran : la pastille annonce sa valeur et l'action (« Visibilité : MJ. Toucher pour passer à Privé »).
- [ ] Un refus du serveur remet l'ancienne pastille et l'annonce le dit.

---

### ☐ V3.1-65 — Bloc Texte : lettrine, bulle du paragraphe, assistance IA en encart · `M` — **prêt**

**Modèle conseillé : Sonnet** — tout existe ; c'est un rangement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Texte ». **Départ** :
`components/blocks/TextBlockEditor.tsx`,
`components/entities/richtext/RichTextEditor.tsx`,
`src/core/schemas/blocks/text.ts`, `src/server/services/aiProposals.ts`.
**Dépend de** : 63.

**Ce qui est décidé**
- La **lettrine** devient un **interrupteur dans l'en-tête de la carte**
  (passé par `BlockCard` en action d'en-tête), au lieu d'un réglage dans le
  corps. Même champ qu'aujourd'hui.
- Toucher un paragraphe ouvre **la bulle de l'éditeur riche** : niveau de
  titre, G / I / S, Lier à une fiche, Créer une fiche, Spoiler, et la
  **visibilité du paragraphe** (Public, Joueurs, MJ). Un passage MJ est
  bordé à gauche d'orange (`--gm`) et marqué « MJ » ; un passage Joueurs
  bordé de bleu. Rappel : Spoiler est de la mise en forme, jamais de la
  sécurité (règle 6) ; le secret passe par la visibilité du paragraphe.
- **L'assistance IA** (MJ seulement, jamais dans la coquille joueur) en
  **encart violet sous le texte** : la consigne, le budget visible (ce
  qu'il reste), « Proposer ». La proposition apparaît **en pointillé à sa
  place** dans le texte ; **rien n'est écrit avant « Accepter »** (règle 9 :
  `ai_proposals` → validation → application) ; « Refuser » l'efface.

**Critères d'acceptation**
- [ ] Lettrine activée depuis l'en-tête : le rendu public la montre.
- [ ] Un paragraphe MJ n'est jamais envoyé à un joueur ni au wiki public (test serveur existant étendu au nouveau rendu).
- [ ] Une proposition de l'IA ne modifie pas le bloc tant qu'elle n'est pas acceptée (test).
- [ ] L'encart IA n'existe pas dans la coquille joueur.

---

### ☐ V3.1-66 — Blocs Encadré et Tableau · `M` — **prêt**

**Modèle conseillé : Sonnet** — décisions prises ; une seule à trancher dans le ticket (tranchée ci-dessous).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, cartes « Encadré » et
« Tableau ». **Départ** : `components/blocks/InfoboxBlockEditor.tsx`,
`components/blocks/CustomTableBlockEditor.tsx`,
`src/core/schemas/blocks/infobox.ts`, `customTable.ts`. **Dépend de** : 63.

**Encadré — ce qui est décidé**
- Les lignes se **lisent comme dans le wiki** (intitulé à gauche, valeur à
  droite) et **s'éditent sur place** (toucher l'intitulé ou la valeur) ;
  ⠿ pour réordonner ; × au survol pour retirer ; « + ligne ».
- **« @ » dans une valeur cite une fiche** (même mention que dans le texte).
- **Intitulés suggérés selon le type de fiche** : en tapant un intitulé, une
  liste propose ceux du type (PNJ : Race, Âge, Rôle, Allégeance… ; Lieu :
  Région, Population, Dirigeant… ; Faction : Siège, Chef, Fondation…).
  **Tranché ici : une constante dans le fichier de libellés**, clé = genre
  d'entité (`entityKind`), pas une table en base (rien à migrer ; à revoir
  au troisième besoin de personnalisation). Pour un genre sans liste : pas
  de suggestion.

**Tableau — ce qui est décidé**
- Un **vrai tableau** (`<table>` accessible) éditable en cellules.
- × de colonne (dans l'en-tête) et × de ligne (au bout) **au survol** ;
  « + » au bout des en-têtes pour une colonne, « + Ligne » dessous.

**Critères d'acceptation**
- [ ] Encadré : réordonner, éditer sur place, « @ » qui crée une vraie mention (même test que le texte).
- [ ] Les suggestions dépendent du genre de la fiche (test de la fonction de suggestion).
- [ ] Tableau : ajouter et retirer lignes et colonnes ; navigation au clavier entre cellules (Tab).

---

### ☐ V3.1-67 — Bloc Image : la barre flottante et l'aperçu dans le texte (B) · `M` — **prêt**

**Modèle conseillé : Sonnet** — tous les champs existent déjà ; c'est l'interface.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Image ». **Départ** :
`components/blocks/ImageBlockEditor.tsx`, `src/core/schemas/blocks/image.ts`
(lire son commentaire en entier), `src/core/images/blockAnchor.ts`.
**Dépend de** : 63.

**Ce qui est décidé (B)**
- Aujourd'hui : neuf réglages en liste sous l'image. Demain :
- **Toucher l'image fait paraître une barre flottante** sur elle :
  Gauche / Centre / Droite (`align`), « − taille + » (`sizePct`, 50–200 %,
  pas de 10), « Le texte contourne » (interrupteur : `anchorFlow` `float`
  quand activé, `break` sinon).
- **L'aperçu** montre l'image **dans le texte**, telle qu'elle sera dans le
  wiki, avec sa légende dessous (éditable sur place).
- **À part, dans un encart sous l'aperçu** :
  - Emplacement : « Bloc autonome » (`placement: "flow"`) ou « Dans un bloc
    de texte » (`placement: "anchored"` + choix du bloc et du paragraphe,
    curseur à N + 1 crans comme aujourd'hui) ;
  - Parallaxe (`parallaxPct`, 0–40) ;
  - Fond de la page du wiki, trois choix : « Non » (`useAsWikiBackground:
    false`), « En fond et dans la fiche » (`true` + `alsoShowInFlow: true`),
    « Seulement en fond » (`true` + `alsoShowInFlow: false`) ; avec flou
    (`backgroundBlurPx`) et fondu (`fadeMs`) **seulement si** un fond est
    choisi.
- `wrapMode` n'apparaît pas (lu seulement, comme aujourd'hui).

**Critères d'acceptation**
- [ ] Chaque contrôle de la barre écrit le bon champ (test de la correspondance contrôle → champ).
- [ ] Les trois choix de fond donnent les bonnes paires de valeurs (test).
- [ ] Flou et fondu n'apparaissent qu'avec un fond.
- [ ] Un bloc enregistré avant ce ticket s'affiche à l'identique (pas de réécriture en base).

---

### ☐ V3.1-68 — Bloc Chronologie : l'axe en bande et une ligne par événement · `M` — **prêt**

**Modèle conseillé : Sonnet** — dessin décidé, schéma inchangé.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Chronologie ».
**Départ** : `components/blocks/TimelineBlockEditor.tsx`,
`components/entities/timeline/`, `src/core/schemas/blocks/timeline.ts`,
`components/shared/useWorldCalendar.ts`. **Dépend de** : 63, 64.

**Ce qui est décidé**
- En tête, **l'axe en bande** : les périodes (ères) en segments nommés, les
  événements en points, **le jour actuel en trait doré** (date du jour du
  calendrier du monde ; pas de trait si le MJ ne l'a pas réglée).
- Dessous, **une ligne par événement** : date, titre, **genre en pastille**
  (`kind`), **visibilité en pastille** (`VisibilityPill` de V3.1-64, un
  événement MJ n'est jamais envoyé à un joueur), et « → en faire une
  fiche » (crée une entité liée, même service que « Créer une fiche » du
  texte).

**Critères d'acceptation**
- [ ] Le trait doré tombe sur la date du jour du monde ; absent sans date.
- [ ] La pastille d'un événement suit le cycle de V3.1-64 ; un événement MJ n'arrive pas au joueur (test serveur).
- [ ] « → en faire une fiche » crée l'entité et lie l'événement.

---

### ☐ V3.1-69 — Noyau psyché : libellés uniques, bandes des pôles, tension, résumé · `S` — **prêt**

**Modèle conseillé : Sonnet** — fonctions pures, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/psyche/` (`keys.ts`, `bands.ts`), et les libellés
aujourd'hui **dupliqués** dans `components/entities/psyche/`
(`PersonalityPoleSliders.tsx`, `WorldviewPoleSliders.tsx`,
`WorldviewRadar.tsx`, `WorldviewEventTable.tsx`, `PersonalityRadar.tsx`).
**Dépend de** : —.

**Ce qui est décidé**
1. **Une seule source pour les libellés des pôles** (personnalité,
   convictions) dans `src/i18n/fr.ts`, à côté des descriptions existantes
   (`PERSONALITY_POLE_DESCRIPTIONS_FR`, `WORLDVIEW_POLE_DESCRIPTIONS_FR`).
   Les composants ne gardent plus leurs propres tables.
2. **Deux renommages, libellés seulement** (clés et valeurs inchangées,
   aucune migration) :
   - `curiosity_caution` : « Circonspection ↔ Curiosité » (fin du doublon
     « Prudence » avec `impulse_prudence`) — mettre aussi à jour la
     description (« Circonspection : préfère le connu… ») ;
   - `wealth_honor` : « Profit ↔ Honneur » (description : « Profit : … »).
3. **Bandes nommées des pôles** : `poleBandLabel(ends, value)` → « neutre —
   ne s'en soucie pas » (bande 0) ou « <pôle> <léger|fort|extrême> », le pôle
   étant celui du côté de la valeur, l'adjectif **accordé** au genre du
   pôle (Altruisme fort, Dureté légère, Circonspection extrême). Seuils :
   `bandTierFor` existant (≤ −67, −34, −12, 11, 33, 66).
4. **Tension faction** : `worldviewTension(entity, faction)` → l'axe au plus
   grand écart en **crans** (différence des bandes), et l'écart ; tension
   quand l'écart ≥ 3 (specs/psyche-pnj.md §2).
5. **Résumé d'une relation** : `relationshipSummary(axes)` → les mots des
   axes dont la bande vaut ±2 ou ±3, dans l'ordre des axes
   (« aveugle, amical, admiratif et obligé ») ; « rien de marquant » s'il
   n'y en a aucun. Mots : `RELATIONSHIP_AXIS_BAND_LABELS_FR` existant.

**Critères d'acceptation**
- [ ] Tests : les sept bandes de deux pôles (accord masculin et féminin), les bornes exactes des seuils.
- [ ] Tests : tension à 2 crans (non), à 3 (oui), choix de l'axe le plus écarté.
- [ ] Tests : résumé vide, un mot, plusieurs mots (« a, b et c »).
- [ ] `grep` : plus aucune table de libellés de pôles dans `components/`.

---

### ☐ V3.1-70 — Personnalité (A) et Convictions (même dessin, comparer avec une faction) · `L` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; une règle de liste tranchée ci-dessous.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Psy-Decide.dc.html`, sections « Personnalité — A » et
« Convictions ». **Départ** : `components/blocks/PersonalityBlockEditor.tsx`,
`components/blocks/WorldviewBlockEditor.tsx`,
`components/entities/psyche/` (radars, curseurs, tables de souvenirs),
`components/entities/public/PublicPersonalityBlock.tsx`,
`PublicWorldviewBlock.tsx`. **Dépend de** : 63, 69.

**Personnalité — ce qui est décidé (A)**
- **En tête, côte à côte** : le **radar** (garder les radars d'aujourd'hui,
  demande de l'auteur) avec **la bande nommée à chaque sommet**, et les
  **six barres bipolaires** pour régler (pôle gauche, barre, pôle droit, mot
  de la bande). **Aucun nombre affiché** (corrige l'écart d'aujourd'hui
  avec la spec §1.5) ; valeur exacte au survol, MJ seulement.
- **★** devant chaque barre : les **deux pôles prioritaires**, dans l'ordre
  (un troisième ★ retire le plus ancien) ; l'annonce dit « Pôles
  prioritaires : Autorité puis Prudence. ».
- **Aspirations en trois colonnes** : Une vie, En ce moment, Ce soir
  (`horizon` : life, arc, session) ; chaque aspiration : texte, intensité en
  trois points (toucher = suivante), **visibilité en pastille** (V3.1-64) ;
  « + aspiration » au pied de chaque colonne.
- « **Ne fera jamais** » et « **Fera, à contrecœur** » côte à côte (`lines`,
  `limits`), « + ligne ».
- **Façon de parler** en pastilles (registre, tics ; × pour retirer,
  « + tic »).
- **Souvenirs** repliables (table existante) avec la saisie en une ligne :
  texte, axe en pastilles, écart (− / + par 10), « Ajouter » ; **au-delà de
  40, confirmation** (« Un écart de plus de 40 est un moment rare :
  confirmer ? ») ; chaque ligne montre le brut et l'appliqué (« Prudence +20
  (appliqué +14) »).
- Téléphone : radar au-dessus ; chaque barre sur trois lignes (les deux
  pôles, la barre, le mot) ; colonnes empilées. Fenêtre étroite : une
  colonne (V3.1-63).

**Convictions — ce qui est décidé**
- **Deux blocs, même dessin** que la Personnalité A (pas de fusion : une
  faction a des convictions sans tempérament, chaque bloc garde sa
  visibilité). Pas de ★, pas d'aspirations.
- **« Comparer avec »** en pastilles au-dessus : « Personne » puis les
  factions. **Tranché ici, la liste** : les entités qui ont un bloc
  Convictions **et** auxquelles la fiche est reliée par `member_of`,
  `serves` ou `leads` (dans les deux sens via les inverses), triées par nom ;
  puis « Autre… » qui ouvre la recherche parmi les fiches **visibles du
  lecteur** ayant un bloc Convictions. Le choix est un état d'affichage
  (non enregistré).
- La faction choisie se pose **en pointillé bleu sur le radar** et **en trait
  bleu sur chaque barre** ; quand `worldviewTension` (V3.1-69) trouve ≥ 3
  crans, une phrase s'écrit dessous en orange : « Sildar sert l'Alliance
  des Lords, mais leurs convictions divergent de 3 crans sur ordre ↔
  liberté — une tension à jouer. ». Les valeurs de la faction ne sont
  envoyées que si son bloc Convictions est visible du lecteur (règle 5).

**Critères d'acceptation**
- [ ] Aucun nombre à l'écran pour un joueur (test de rendu public) ; le MJ voit la valeur au survol seulement.
- [ ] ★ : deux au plus, ordre conservé (test).
- [ ] Souvenir > 40 : confirmation demandée ; refuser n'écrit rien (test).
- [ ] « Comparer avec » ne propose que les factions liées, puis « Autre… » ; une faction au bloc Convictions MJ n'est pas proposée à un joueur (test serveur).
- [ ] La phrase de tension apparaît à 3 crans, pas à 2.

---

### ☐ V3.1-71 — Relation (A) : deux portraits, le résumé, les fils à perle · `L` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; lecture du sens inverse décrite.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Psy-Decide.dc.html`, section « Relation — A (perles et résumé
central) » (ordinateur et téléphone). **Départ** :
`components/blocks/RelationshipBlockEditor.tsx`,
`components/entities/psyche/RelationshipAxisSliders.tsx`,
`RelationshipRadar.tsx` (n'est plus utilisé par ce bloc), 
`RelationshipEventTable.tsx`, `components/entities/public/PublicRelationshipBlock.tsx`,
`src/core/schemas/blocks/relationship.ts`, `src/server/repos/entityPortraits.ts`.
**Dépend de** : 63, 69.

**Ce qui est décidé**
- **Ligne du haut** : « Envers [cible ▾] » (n'importe quelle fiche :
  personnage, faction, créature, lieu… — recherche parmi les fiches
  visibles) et « Le connaît comme » (`known_as`, champ texte).
- **Le face-à-face** : deux portraits **au gabarit de la Généalogie B**
  (portrait de la fiche, nom en pastille à cheval sur le bas), dans des
  **colonnes de 184 px pour que les noms tiennent dans le bloc** (nom trop
  long : points de suspension, nom complet au survol). À gauche la fiche
  (« ressent »), à droite la cible (« envers »). Portrait : `entity_assets`
  rôle `portrait`, sinon l'icône du genre de la fiche (silhouette pour une
  personne, bouclier pour une faction, griffes pour une créature, montagne
  pour un lieu).
- **Au milieu, le résumé** : « Sildar envers Gundren », puis
  `relationshipSummary` (V3.1-69) en grand, puis « 5 souvenirs au journal ·
  le dernier le 7 oct. 1492 » (compté depuis `attitude_events` de la paire,
  jamais stocké — règle 16). Le résumé **suit la perle en direct** pendant
  qu'on la glisse.
- **« ⇄ Voir l'autre sens »** : échange les portraits et montre le bloc
  Relation **de la cible envers la fiche** s'il existe et s'il est visible
  du lecteur (requête serveur ; sa visibilité à lui) ; sinon une case
  pointillée : « Gundren n'a pas de bloc « Envers Sildar ». Une relation est
  à sens unique : chacun la sienne. » et « Créer ce bloc » — **seulement si**
  `canEditEntity` sur la cible.
- **Dessous, sur toute la largeur, un fil par axe** (sept) : le pôle
  négatif sous le bout gauche, le positif sous le bout droit, un trait au
  milieu (neutre), la portion entre le milieu et la perle colorée (vert si
  positif, rouge si négatif), **la perle avec le mot de la bande dedans**.
  Glisser la perle règle au point près (−100…+100) ; vers l'autre portrait
  = le sentiment le vise. **Survol de la perle** (toucher au téléphone) :
  « pourquoi » — les deux derniers souvenirs de cet axe (« 7 oct. : Gundren
  a payé sa rançon (+35) »), ou « aucun souvenir : réglage du MJ ».
- « **MJ** » en petit sur le fil Attirance (visibilité `gm` par défaut,
  spec §3) ; **Attirance masquée** quand la cible n'est pas une personne.
- Souvenirs de la paire repliables dessous (table existante, même saisie et
  même confirmation au-delà de 40 que V3.1-70).
- **Téléphone** : portraits plus petits (70 × 92), prénoms seuls, mêmes
  fils, toucher au lieu du survol.
- **Le radar n'est plus utilisé par ce bloc** (il reste pour Personnalité et
  Convictions).

**Critères d'acceptation**
- [ ] Les noms longs tiennent dans le bloc (points de suspension, test visuel à 920 px et 390 px).
- [ ] Le résumé change pendant le glissé, avant même l'enregistrement.
- [ ] « Voir l'autre sens » ne montre jamais un bloc inverse invisible du lecteur (test serveur) ; « Créer ce bloc » absent sans droit d'écriture sur la cible.
- [ ] Une cible faction ne montre pas Attirance.
- [ ] Le nombre de souvenirs est calculé, jamais stocké.

---

### ☐ V3.1-72 — Réseau (B) : vignettes, filtres, survol qui allume · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; un champ ajouté côté service.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Psy-Decide.dc.html`, section « Réseau — B » (ordinateur et
téléphone). **Départ** : `components/entities/psyche/RelationsGraphCanvas.tsx`
(d3-force, à garder), `RelationsGraphNodeCard.tsx`,
`src/server/services/relationsGraph.ts`,
`src/core/relationsGraph/buildRelationsGraph.ts`,
`components/entities/public/PublicRelationsGraphBlock.tsx`. **Dépend de** : 63.

**Ce qui est décidé**
- Rappel : ce bloc montre les **liens du wiki** (table `relations` : membre
  de, originaire de, porte…), pas les blocs Relation.
- **Chaque fiche en vignette** (40 px, coins 11 px ; la fiche au centre
  56 px, bord accent) : son portrait, sinon l'icône de son genre ; **le nom
  dessous**. **Liseré de couleur par genre** (personnes, lieux, factions,
  objets — quatre teintes de la charte, pas de nouvelles couleurs en dur).
- **Survol d'une vignette** : ses liens et ses voisins s'allument, tout le
  reste s'éteint (opacité 0,2), et **le type de chaque lien allumé s'écrit**
  à mi-chemin en petite pastille (`RELATION_LABELS_FR`).
- **Toucher** une vignette : la carte de la fiche (nom, genre, trois liens)
  avec « Ouvrir la fiche » (`RelationsGraphNodeCard`).
- Au-dessus : « Jusqu'à 1 degré / 2 degrés » (existant, recalcul local),
  **filtres par genre avec leur nombre** (« Lieux · 4 », un toucher masque
  ce genre — la fiche du centre ne se masque jamais) et **« Trouver… »**
  qui fait briller les fiches dont le nom contient le texte.
- **Téléphone** : pas de survol — **un toucher** allume la vignette et fait
  paraître les noms de ses voisins, **un second** ouvre la fiche ; seuls
  les noms utiles s'affichent (la fiche du centre, la sélection, ses
  voisins) ; « Tout montrer » ; filtres en bande qui défile.
- **Données** : ajouter l'adresse du portrait à `GraphEntityInput` côté
  service, **en une requête groupée** pour toutes les entités du graphe
  (pas de N+1) ; le genre y est déjà (`entityKind`).

**Critères d'acceptation**
- [ ] Le survol allume exactement les liens et voisins de la vignette (test de la fonction de voisinage).
- [ ] Les portraits arrivent en une seule requête (test du service : nombre d'appels au dépôt).
- [ ] Filtrer un genre ne masque jamais la fiche du centre.
- [ ] Téléphone : premier toucher = sélection, second = ouverture.

---

### ☐ V3.1-73 — Généalogie (B) : les grands portraits · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; les dates attendent V3.1-74.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Psy-Decide.dc.html`, section « Généalogie — B » (ordinateur
et téléphone). **Départ** : `components/blocks/GenealogyBlockEditor.tsx`,
`components/entities/genealogy/FamilyTreeCanvas.tsx`, `FamilyTreeCard.tsx`,
`components/entities/public/PublicGenealogyBlock.tsx`,
`src/server/services/genealogy.ts`. **Dépend de** : 63 ; dates : 74.

**Ce qui est décidé**
- **Grands portraits** (100 × 130 sur ordinateur) : le portrait de la fiche,
  sinon une silhouette ; **le nom en pastille à cheval sur le bas** ; **les
  dates dessous** (voir plus bas).
- **Traits arrondis** : le couple relié à l'horizontale, les enfants
  descendent du milieu du couple par des coudes arrondis.
  **Ex-partenaire en pointillé orange**, **défunt en gris** (portrait
  désaturé).
- Fond pointé ; **zoom en bas à droite** (+, −, recadrer).
- **Toucher un portrait** : une barre sous l'arbre — nom, dates, « Ouvrir
  la fiche », « Centrer l'arbre ici » (change la racine affichée, état
  d'affichage), « Ajouter » et les neuf liens (Parent, Enfant, Partenaire,
  Ex-partenaire, Frère/sœur, Demi-frère/sœur, Beau-parent, Beau-enfant,
  Adopté(e)) — même route qu'aujourd'hui (création de relation). Une case
  pointillée « + enfant » attend sous un couple sans enfant.
- **Téléphone** : cartes plus petites (66 × 88), **prénoms seuls**, l'arbre
  se parcourt du doigt (glisser, pincer) et **s'ouvre centré sur la
  fiche**.
- **Dates** : **tant que V3.1-74 n'est pas livré**, la ligne de dates
  n'apparaît pas et « défunt » n'existe pas ; le composant prévoit déjà la
  ligne (prop optionnelle), pour que 74 n'ait qu'à la remplir.
- Inchangé : un lien caché n'est jamais envoyé à un lecteur qui n'y a pas
  droit (service existant).

**Critères d'acceptation**
- [ ] Conforme à la planche à 920 px et 390 px.
- [ ] « Centrer l'arbre ici » change la racine sans rien enregistrer.
- [ ] Ajouter un lien depuis la barre crée la relation (test existant étendu).
- [ ] Sans données de dates, aucune ligne vide sous les noms.

---

### ☐ V3.1-74 — Dates de naissance et de mort (données) · `M` — **prêt (Opus) — proposition validée par l'auteur le 8 octobre**

**Modèle conseillé : Opus** — donnée nouvelle, ADR, `SCHEMA.md`.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : V3.1-48 (la naissance d'un personnage devient une `GameDate`
dans le bloc `character`), `src/core/schemas/blocks/character.ts`,
`src/core/calendar/`, `src/server/services/genealogy.ts`. **Dépend de** :
48.

**La question (ouverte)** : la Généalogie B montre « 1420 – 1478 † » et
« née en 1424 ». La naissance existera avec V3.1-48 (bloc `character`) ;
**la mort n'existe nulle part**, et une fiche sans bloc `character` (un
PNJ décrit en texte) n'a pas de naissance.

**Décidé (auteur, 8 octobre) — la proposition ci-dessous est acceptée**
- Naissance : celle de V3.1-48 (`character`).
- Mort : un champ optionnel `death` (`GameDate`) dans le même bloc ;
  « défunt » = `death` renseigné (pas de booléen à part, règle 16).
- Une fiche sans bloc `character` : pas de dates dans l'arbre (rien
  d'inventé).
- L'âge affiché s'arrête à la mort.

**À faire** : ADR (décision ci-dessus, dix lignes), `SCHEMA.md`, schéma Zod (lecture
tolérante), service de la généalogie qui lit naissance et mort en **une
requête groupée**, remplissage de la ligne prévue en V3.1-73.

---

### ☐ V3.1-75 — Table aléatoire (A) et le dé animé · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; route de tirage existante.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Outils-Decide.dc.html`, section « Table aléatoire — A ».
**Départ** : `components/blocks/RandomTableBlockEditor.tsx`,
`app/api/blocks/[blockId]/draw/route.ts`, `src/core/tables/`,
`src/core/schemas/blocks/randomTable.ts`, et **l'animation de l'outil de
dés de V3.1-33**. **Dépend de** : 63, 33.

**Ce qui est décidé (A)**
- La table **telle qu'on la lit** (plage à gauche, texte, prix et palier en
  petites pastilles à droite), « **Tirer · d20** » au-dessus (le dé de la
  table : `die`), « **Sans répétition** » en interrupteur (`unique_draws` ;
  les entrées sorties sont barrées et pâlies), « Remettre à zéro ».
- **Le résultat en carte** sous les boutons : les dés à gauche, le texte à
  droite **avec ses liens cliquables** vers les fiches (`refs`), et le
  sous-tirage écrit dessous : « ↳ tiré sur la table « Marchands » : nains
  de Mirabar ».
- **Le dé reprend l'animation de l'outil de dés** (scintillement, V3.1-33) :
  au toucher, les chiffres **défilent flous puis se figent un par un** — le
  d20, puis le dé de chaque sous-table (`{table:…}`) dans l'ordre ; le texte
  du résultat reste pâle pendant l'animation ; **la ligne sortie ne
  s'allume qu'à la fin**. L'animation couvre l'attente du serveur (qui seul
  tire) ; les chiffres qui défilent sont décoratifs. **Réutiliser le
  composant ou le crochet d'animation livré par V3.1-33** (s'il est
  enfermé dans l'outil de dés, l'en extraire une fois, sans le dupliquer).
  Mouvement réduit : résultat immédiat.
- Un dé au maximum est bordé d'ambre, un 1 de rouge (comme l'outil de dés).
- Pied : l'attribution en italique (« Par Orkish Blade »), « Modifier les
  entrées » (bascule vers l'édition des lignes : plage, texte, prix, palier ;
  `[[ ]]` lie une fiche ; `{table:clé}` tire sur une autre table, trois
  niveaux au plus).
- Téléphone : même bloc, plages plus étroites.

**Critères d'acceptation**
- [ ] Le tirage vient du serveur (aucun `Math.random` côté client hors des chiffres décoratifs de l'animation).
- [ ] La ligne s'allume après la fin de l'animation, pas avant.
- [ ] Avec sous-tirage : deux dés se figent l'un après l'autre.
- [ ] Mouvement réduit : pas d'animation (test avec la préférence simulée).
- [ ] « Sans répétition » : une entrée sortie ne ressort pas avant « Remettre à zéro » (test de la route).

---

### ☐ V3.1-76 — Quête (C) : une ligne, dépliable · `S` — **prêt**

**Modèle conseillé : Sonnet** — petit, tout décidé.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Outils-Decide.dc.html`, section « Quête — C ». **Départ** :
`components/blocks/QuestBlockEditor.tsx`, `src/core/schemas/blocks/quest.ts`.
**Dépend de** : 63.

**Ce qui est décidé (C)**
- **Repliée**, une seule ligne : un **anneau de progression** (objectifs
  atteints / total, au centre « 2 / 4 »), **l'état** en gras, « · confiée
  par » et le commanditaire (lien de fiche, `giver`), dessous « Prochain : »
  et le premier objectif non atteint (« Tous les objectifs sont atteints »
  sinon), ▾ à droite. Toucher la ligne déplie.
- **Dépliée** : la **pilule d'état à cinq choix** (Non commencée, En cours,
  Réussie, Échouée, Abandonnée ; En cours en ambre, Réussie en vert,
  Échouée en rouge), les **objectifs à cocher** (barrés quand atteints ;
  liens de fiche dans le texte ; « + objectif »), **Récompenses** et
  **Prérequis** côte à côte (l'un sous l'autre au téléphone), « + » dans
  chacun.
- L'état replié / déplié est local (non enregistré).

**Critères d'acceptation**
- [ ] L'anneau et « Prochain » suivent les cases cochées sans rechargement.
- [ ] Les cinq états s'enregistrent (route existante).
- [ ] Téléphone : récompenses et prérequis empilés.

---

### ☐ V3.1-77 — Musique (A) : la platine, les bornes, la durée des fondus · `M` — **prêt**

**Modèle conseillé : Sonnet** — tous les champs existent (ADR 0022).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Outils-Decide.dc.html`, section « Musique — A » (ouvrir
« ⋯ » sur une piste). **Départ** : `components/blocks/MusicBlockEditor.tsx`,
`components/shell/MusicVoice.tsx`, `components/shell/youtubeApi.ts`,
`components/entities/public/PublicMusicToggle.tsx`,
`src/core/schemas/blocks/music.ts`, ADR 0022. **Dépend de** : 63.

**Ce qui est décidé (A, complétée par l'auteur)**
- **La platine en tête** : pochette (glyphe ♪), titre de la piste en cours,
  service en pastille (YouTube, Spotify, SoundCloud), ce que le service
  permet (« fondus 1,5 s » ou « pas de fondu : Spotify ne le permet pas »),
  les bornes en cours (« joue 0:12 → fin ») ; ◂◂, lecture/pause (bouton
  plein accent), ▸▸ ; la progression et les temps.
- **La liste dessous** : une ligne par piste — lecture, ⠿ pour ranger,
  titre et bornes (« 0:12 → fin »), service, durée, **« ⋯ »**.
- **« ⋯ » ouvre sous la piste** : « Commencer à » et « Finir à » (m:ss ;
  vide = piste entière) → `startSeconds` / `endSeconds` — **YouTube
  seulement** ; pour Spotify et SoundCloud, à la place : « Spotify ne sait
  pas commencer ni finir à un point précis : la piste joue en entier. » ;
  et « Retirer la piste ».
- **Réglages** : interrupteurs « Lancer à la visite de la fiche »
  (`autoplayOnVisit`), « En boucle », « Fondus (YouTube) » ; et **deux
  pas-à-pas** « Fondu entrant » et « Fondu sortant » (`fadeInMs`,
  `fadeOutMs`) : 0 à 5 s par pas de 0,5 s, affichés « 1,5 s », avec la
  mention « YouTube seulement ».
- « Lien Spotify, SoundCloud ou YouTube… » + « Ajouter » (validation
  existante : un lien non reconnu est refusé avec son message).
- Rappel sous le bloc (éditeur seulement) : « Sur la page de lecture, le
  bloc ne s'affiche pas » et l'aperçu du ♪ à côté du nom de la fiche
  (comportement existant, inchangé).
- Téléphone : durées et poignées masquées dans la liste ; tout le reste
  identique.

**Critères d'acceptation**
- [ ] « 0:12 » écrit `startSeconds: 12` ; vide l'efface ; fin ≤ début refusé avec le message du schéma.
- [ ] Les champs de bornes n'apparaissent pas pour Spotify / SoundCloud.
- [ ] Pas-à-pas bornés à 0 et 5 s ; la platine applique la nouvelle durée au fondu suivant.
- [ ] Aucun changement du lecteur de la page de lecture.

---

### ☐ V3.1-78 — Carte (C) : la carte et sa liste par couches · `M` — **prêt**

**Modèle conseillé : Sonnet** — modèle et services existants (ADR 0017).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Outils-Decide.dc.html`, section « Carte — C ». **Départ** :
`components/blocks/MapBlockEditor.tsx`, `components/entities/map/`
(`MapCanvas`, `MapPinMarker`, `MapLayersPanel`, `MapRefPanel`),
`components/entities/public/PublicMapBlock.tsx`,
`src/server/services/mapPins.ts`, `mapRegions.ts`, `mapLayers.ts`.
**Dépend de** : 63, 64 ; « Voir comme les joueurs » : 12.

**Ce qui est décidé (C)**
- **La carte à gauche, la liste à droite** (270 px) ; au téléphone, la liste
  passe **sous** la carte.
- **La liste est rangée par couches** : en-tête de couche (nom, sa
  pastille de visibilité), puis ses punaises et zones (point ambre pour une
  punaise, orange si MJ ; carré vert pour une zone), chacune avec **sa
  pastille de visibilité** (V3.1-64).
- **Toucher un nom centre la carte dessus** (et l'agrandit si besoin) et
  l'allume sur la carte.
- Survol d'une punaise sur la carte : son nom, sa couche, sa visibilité.
- Au-dessus : « Voir comme les joueurs » (interrupteur), « + Punaise »,
  « + Zone », « + Couche » ; zoom + / − / recadrer en bas à droite de la
  carte.
- **Rappel ADR 0017** : une punaise n'est vue que si sa couche l'est aussi ;
  l'annonce de la pastille le dit (« … (et seulement si sa couche l'est
  aussi) »).
- **« Voir comme les joueurs »** : recharge la carte **telle que le serveur
  l'envoie à un joueur** (couches et punaises MJ absentes du flux, pas
  masquées en CSS). **Si V3.1-12 n'est pas livré, l'interrupteur
  n'apparaît pas.**
- Mode référent (`ref`) : la liste montre les éléments de la carte source,
  sans « + » (on édite sur la carte source), avec une ligne « Carte de
  <fiche source> ».

**Critères d'acceptation**
- [ ] Toucher un nom centre la carte sur l'élément.
- [ ] Une punaise publique sur une couche MJ n'arrive pas au joueur (test serveur existant, rejoué depuis ce bloc).
- [ ] « Voir comme les joueurs » ne reçoit aucun élément MJ dans la réponse (test).
- [ ] Téléphone : liste sous la carte.

---

### ☐ V3.1-79 — Fiche de créature (A) : la fiche de personnage, pour une créature · `L` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; composants de la fiche réutilisés ; règle de l'état de jeu tranchée ci-dessous.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Creature-Decide.dc.html` (ordinateur et téléphone), et pour
les composants d'origine la zone « Fiche de personnage » (« Décidé · fiche
sur ordinateur… », « Décidé · jauge à commandes (option E) »). **Départ** :
`components/blocks/MonsterStatblockSheet.tsx`,
`src/core/schemas/blocks/statblock.ts`, les composants de la fiche de
V3.1-26 (`CharacterSheetHeader.tsx`, jauges circulaires, `CommandeE`,
badges de constantes, tuiles de caractéristiques), la pilule de V3.1-25,
l'ouverture pré-remplie de l'outil de dés de V3.1-33 (`openDiceTool`).
**Dépend de** : 25, 26, 33, 63.

**Ce qui est décidé (A, la fiche en deux colonnes)** — demande de l'auteur :
**reprendre les éléments et l'apparence de la fiche de personnage**.
Réutiliser les composants, ne pas les recopier.
- **Colonne de gauche** :
  - **en-tête à portrait** : nom ; « Dragon de taille G, loyal mauvais ·
    jeune dragon vert » (taille, type, alignement) ; « FP 8 · 3 900 PX ·
    Thundertree » (le repaire est un lien de fiche s'il est lié) ;
  - **jauges** (panneau de la fiche) : **bouclier de CA** (valeur,
    « CA ») ; **anneau de PV** (« 136/136 », dessous « PV · 16d10 + 48 ») ;
    **anneau de FP** à la place du niveau (violet `--link-entity`, « FP 8 »,
    dessous « 3 900 PX ») ;
  - **constantes en quatre tuiles égales**, libellés **sur une ligne** :
    Initiative (bouton de jet), Vitesse, Maîtrise, Taille ; dessous, en
    petit : « Aussi : vol 24 m · nage 12 m » (les autres vitesses) ;
  - ligne suivante, comme la fiche : **Perception passive** (tuile) et la
    **boîte des états** (pastilles rouges, « + ») ;
  - **« Ce qui se recharge »** (seulement si une capacité a une recharge) :
    point plein = prêt, vide = dépensé ; « Recharge d6 » ;
  - **caractéristiques** : six tuiles à **deux boutons** (haut : test —
    modificateur en grand, valeur dessous ; bas : « JS +6 », le point plein =
    jet maîtrisé), « haut : test · bas : sauvegarde ».
- **Colonne de droite** : la **pilule glissante** Actions / Traits /
  Maîtrises.
  - Actions : sections ambrées (« Attaques », « Capacités », « Réactions »,
    « Actions légendaires » si présentes, « Actions de base ») ; chaque
    attaque en ligne de la fiche : nom (lien de règle souligné en
    pointillé), **pastilles de jet** « +7 » et « 2d6+4 · 2d6 », description
    dessous ; une capacité à recharge a ses pastilles DD et dégâts,
    **estompées une fois dépensée** ; « Actions de base » en puces (mêmes
    que la fiche).
  - Traits : les traits ; le repaire (lien de fiche).
  - Maîtrises : jets de sauvegarde, compétences (pastilles de jet),
    défenses (immunités, résistances), sens et langues.
- **Chaque pastille de jet ouvre l'outil de dés pré-rempli** (`openDiceTool`
  avec la formule et le libellé) ; le serveur lance (règle 8).
- **Tablette** : la fiche suit la largeur de sa fenêtre (piste B, comme la
  fiche de personnage, V3.1-28). **Téléphone** : une colonne, la pilule
  après les caractéristiques.
- **Valeurs plates** (`statblock`) : seuls les modificateurs se calculent
  (règle 16).

**Tranché ici : l'état de jeu (PV courants, états, recharge)**
- Le bloc est un **modèle** de créature : il ne stocke ni PV courants, ni
  états, ni « souffle dépensé » (specs/outils-mj.md §5 : c'est l'état du
  suivi d'initiative).
- **Hors combat** : l'anneau de PV est plein (PV max) et **sans commande
  E** ; la boîte des états est vide et sans « + » ; « Ce qui se recharge »
  montre la capacité et sa règle (« recharge 5–6 ») sans point ni bouton.
- **En combat** (la créature a une instance dans l'initiative en cours,
  V3.1-38) : l'anneau, les états et le point de recharge **lisent et
  écrivent l'instance** par les services de l'initiative ; la commande E
  apparaît. Plusieurs instances (« Gobelin ×4 ») : un sélecteur d'instance
  au-dessus des jauges.
- Si V3.1-38 n'est pas livré : seulement le comportement hors combat.
- La recharge (« 5–6 ») reste écrite dans le texte de la capacité ; on la
  structurera au premier besoin concret (ne pas ajouter de champ ici).

**Critères d'acceptation**
- [ ] Les quatre tuiles de constantes ont la même largeur et leurs libellés tiennent sur une ligne à 920 px et 390 px.
- [ ] Les composants de la fiche sont importés, pas recopiés (revue du diff).
- [ ] Une pastille ouvre l'outil de dés avec la bonne formule (test de l'appel).
- [ ] Hors combat : aucune écriture de PV ou d'état possible depuis le bloc ; aucun champ de jeu ajouté au schéma `statblock`.
- [ ] Les modificateurs sont calculés (FOR 19 → +4), jamais stockés (test).
