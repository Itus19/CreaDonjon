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

### ☐ V3.1-73 — Généalogie (B) : les grands portraits · `M` · sans modèle IA — **prêt**

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

**Reçu de V3.1-74** (13 octobre) : chaque nœud de `getFamilyTree` porte `birth` et `death` (`GameDate`), seulement quand le lecteur voit le bloc `character`. La ligne de dates et le gris du défunt s'appuient dessus (`death` renseigné = défunt). Format : `formatGameDate` ; âge : `ageWithDeath`.

**Critères d'acceptation**
- [ ] Conforme à la planche à 920 px et 390 px.
- [ ] « Centrer l'arbre ici » change la racine sans rien enregistrer.
- [ ] Ajouter un lien depuis la barre crée la relation (test existant étendu).
- [ ] Sans données de dates, aucune ligne vide sous les noms.

---

### ☐ V3.1-75 — Table aléatoire (A) et le dé animé · `M` · sans modèle IA — **prêt**

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

### ☐ V3.1-76 — Quête (C) : une ligne, dépliable · `S` · sans modèle IA — **prêt**

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

### ☐ V3.1-77 — Musique (A) : la platine, les bornes, la durée des fondus · `M` · sans modèle IA — **prêt**

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

### ☐ V3.1-78 — Carte (C) : la carte et sa liste par couches · `M` · sans modèle IA — **prêt**

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

### ☐ V3.1-79 — Fiche de créature (A) : la fiche de personnage, pour une créature · `L` · sans modèle IA — **prêt**

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
