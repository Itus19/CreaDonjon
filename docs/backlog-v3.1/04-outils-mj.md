# Backlog V3.1 — Tickets du lot i — les outils du MJ (8 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage du lot i de V3.1-19 : seize outils décidés du 4 au 8 octobre,
planche par planche. Les décisions détaillées vivent dans V3.1-19 (section
« Lot i ») ; chaque ticket ci-dessous les reprend **en entier**, pour qu'on
puisse le coder sans relire la conversation.

**Déjà couverts par des tickets existants** (pas de ticket en double) :
- Initiative → V3.1-37 (données, Opus) puis V3.1-38 (interface) ;
- Table → V3.1-34 ;
- Chat → V3.1-22 (salon, jets, fenêtre B : tout y est) ;
- « Ce que les joueurs modifient eux-mêmes » → V3.1-23 (données et
  serveur) ; son écran est V3.1-57 ;
- « Voir comme » pour le MJ → V3.1-12 (sécurité) ; son entrée de menu est
  V3.1-54.

### Comment lire ces tickets (à faire lire à Sonnet avant chaque ticket)

**Les planches font foi pour l'apparence et les comportements**, le code
fait foi pour les jetons, les composants partagés et la charte. Canevas :
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm, rangée « Lot i — outils
du MJ » (y = 14660). Chaque ticket cite sa planche par son **nom de
fichier** (`Notes-Decide.dc.html`…) : le titre affiché sur le canevas est
tronqué. Une planche est **vivante** : sa logique (dans la balise
`<script type="text/x-dc">` de la planche) montre exactement ce que fait
chaque bouton ; la lire quand un comportement semble ambigu.

**Ce que les planches ne disent pas, et qu'il ne faut pas inventer** :
- Les noms, dates et nombres des planches sont des exemples (Inès, Sakaburin,
  « 14 Brumaire 1492 »…). Les vraies données viennent du serveur.
- Le rail des planches est une copie : **la référence du rail reste
  V3.1-27**, jamais une planche d'outil.
- Les planches dessinent des couleurs en `oklch(...)` en dur : dans le code,
  **uniquement les jetons** (`--accent`, `--edge`, `--panel-*`, `--ink-*`,
  `--danger`, `--success`, `--link-entity`) et les recettes de
  `docs/CHARTE-UI.md`.

**Règles communes au lot i** (en plus de celles des tickets de la refonte,
plus haut : charte et catalogue d'abord, 390 px / 820 px / ordinateur,
quatre modes et contraste élevé, mouvement réduit, rien de caché envoyé au
client, ce qui n'est pas dans le ticket n'est pas fait) :
1. **MJ en fenêtre, joueuse en page pleine.** Un outil du MJ s'ouvre dans
   les fenêtres à volets (V3.1-20) avec le rail, « MJ » allumé ; une
   joueuse n'a jamais de fenêtre : son écran est une page pleine dans sa
   coquille (rail du joueur sur ordinateur et tablette, barre du joueur au
   téléphone).
2. **Tablette = la fenêtre étroite.** La disposition de tablette se
   déclenche sur la **largeur de la fenêtre** (requête de conteneur CSS,
   comme V3.1-28), pas sur `window.innerWidth` : un volet partagé sur
   ordinateur prend la même disposition.
3. **Téléphone** : Outils › <outil> (grille de V3.1-29), feuilles du bas
   pour tout ce qui s'ouvre (composant unique de V3.1-29).
4. **Ascenseurs** : la règle globale de `app/globals.css` (6 px, piste
   transparente, curseur `--edge`, `--edge-strong` au survol). Aucun
   ascenseur natif, aucun style d'ascenseur local.
5. **Boutons** : les quatre recettes de la charte (plein accent,
   secondaire, fantôme accent, danger fantôme) ; interrupteurs et pilules
   des composants partagés (`Checkbox`/interrupteur, pilule de V3.1-25).
   Icônes au trait, aucun émoji (charte §10).
6. **Rapidité (voir V3.1-62)** : la première vue d'un outil arrive **avec la
   page ou la fenêtre** (données lues côté serveur et passées en props), pas
   par un `fetch` dans un `useEffect` après l'affichage ; une action met
   l'écran à jour **aussitôt** (état local optimiste, remis en place si le
   serveur refuse) plutôt que par `router.refresh()` ; jamais
   `window.location.reload()` ; requêtes indépendantes en `Promise.all`,
   jamais une requête par ligne (N+1).
7. **Libellés en français dans `messages/fr.json`** (ou `src/i18n/fr.ts`
   selon le fichier qui porte déjà ceux de l'outil), identifiants en
   anglais.
8. Fin : `npm run typecheck && npm run lint && npm run test`, et la planche
   du catalogue (`docs/catalogue/`) de chaque élément nouveau ou modifié.

**Choisir le modèle** : chaque ticket porte sa ligne « Modèle conseillé ».
**Opus** quand il faut décider ou toucher à la sécurité — migration, RLS,
ADR, structure de données de règles, état partagé délicat (41, 47, 49, 59,
62 étapes 1-2) ; **Sonnet** quand tout est décidé et esquissé et qu'il
s'agit de le construire fidèlement (les autres). Si Sonnet bute sur une
décision que le ticket ne tranche pas, il s'arrête et la note ici : il ne
la prend pas seul.

**Ordre conseillé** : 62 (mesures) d'abord, puis les petits outils sans
donnée nouvelle (46, 55, 61, 54, 56, 44, 45, 43), puis les tickets à
données (41 → 42, 59 → 60, 23 → 57, 58), enfin la Création (47 → 48 → 49 →
50, 51, 52, 53).

| Ticket | Outil | Taille | Modèle | Dépend de |
|---|---|---|---|---|
| V3.1-41 | Bloc-notes : la page partagée (données) | M | Opus | — |
| V3.1-42 | Bloc-notes : le cahier refait | L | Sonnet | 41, 20, 25, 29 |
| V3.1-43 | Livre de sessions : le registre | M | Sonnet | 20, 29 ; « Relancer » : 22 |
| V3.1-44 | Rencontres : l'atelier en trois colonnes | M | Sonnet | 20, 29 |
| V3.1-45 | Générateurs : tirages et fiche | M | Sonnet | 20, 25, 29 |
| V3.1-46 | Probabilités : la matrice | M | Sonnet | 20, 29 |
| V3.1-47 | Création : les règles de personnage en données | L | Opus | V3.1-3, 6, 7 (conception) |
| V3.1-48 | Création : identité, prénom, nom, naissance | M | Sonnet | — |
| V3.1-49 | Création : le chemin qui se ramifie | L | **Opus** | 47, 48, 25, 26, 29 |
| V3.1-50 | Création : Origines, Historique, Sorts | L | Sonnet | 49 |
| V3.1-51 | Création : Classe et Monter de niveau | L | Sonnet (Opus si 49 n'a pas fixé l'écriture « avant → après ») | 47, 49 |
| V3.1-52 | Création : Caractéristiques | M | Sonnet | 47, 49 |
| V3.1-53 | Création : Équipement | L | Sonnet | 24, 47, 49 |
| V3.1-54 | Gestion de campagne au verre minéral | S | Sonnet | 20, 29 ; « Voir comme » : 12 |
| V3.1-55 | Calendrier ingame : l'année d'un coup d'œil | M | Sonnet | 20, 29 |
| V3.1-56 | Calendrier réel au verre minéral | M | Sonnet | 20, 27, 29 |
| V3.1-57 | Règles actives : deux volets | M | Sonnet | 23, 26 |
| V3.1-58 | Personnalisation : le fond d'abord, et pour les joueuses | M | Sonnet | 27, 35 |
| V3.1-59 | Publication : le fond par défaut du wiki (données) | M | Opus | — |
| V3.1-60 | Publication : réglages et ce que voit un visiteur | M | Sonnet | 58, 59 |
| V3.1-61 | Journal historique : par fiche ou chronologique | M | Sonnet | 20, 29 |
| V3.1-62 | Rapidité : mesurer, puis recâbler | M | Opus puis Sonnet | — |

---

### ☐ V3.1-41 — Bloc-notes : la page partagée devient une entité (données) · `M` — **prêt**

**Modèle conseillé : Opus** — migration, RLS et octrois d'écriture ; principe déjà tranché.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision** : ADR 0037 (`docs/adr/0037-une-page-partagee-devient-une-entite.md`,
accepté le 5 octobre). Une page du cahier marquée « La table » devient sa
propre **entité** (genre `shared_note`, visibilité de la table), son
autrice reçoit l'octroi d'écriture (`entity_grants`, que le MJ peut
reprendre), et le cahier garde un lien vers elle. Modèle : le Livre de
sessions (`session_journal`).

**À faire**
1. Relire l'ADR 0037 et `docs/SCHEMA.md` ; la migration ajoute ce que l'ADR
   demande (nouvelle migration, aucune migration appliquée modifiée) ;
   `docs/SCHEMA.md` à jour dans le même commit.
2. Services : `shareNotebookPage(pageId)` (crée l'entité, l'octroi, le lien ;
   idempotent) et `unshareNotebookPage(pageId)` (retire la visibilité de la
   table ; l'entité n'est plus lue que par l'autrice ; aucune donnée perdue).
   Routes Zod.
3. Lecture : « Partagées à la table » = les entités `shared_note` visibles
   du lecteur, avec le nom de l'autrice. Un nom cité que le lecteur n'a pas
   découvert s'affiche **sans lien** — filtré côté serveur (règle 5).
4. Ces entités **ne rejoignent pas** les listes du wiki (arborescence,
   recherche, sommaire public), comme `session_journal`.

**Critères d'acceptation**
- [ ] Test d'intégration RLS : une page privée n'est lue par personne d'autre que son autrice, MJ compris.
- [ ] Partagée : MJ et joueuses la lisent, seule l'autrice l'écrit ; le MJ peut retirer l'octroi.
- [ ] Repasser en privée : plus personne d'autre ne la lit ; le texte est intact.
- [ ] Une `shared_note` n'apparaît ni dans l'arborescence, ni dans la recherche, ni dans le wiki public (tests).
- [ ] Un nom non découvert arrive au joueur sans identifiant de fiche (test serveur).

---

### ☐ V3.1-42 — Bloc-notes : le cahier refait, MJ et joueuse · `L` — **prêt après V3.1-41**

**Modèle conseillé : Sonnet** — planche définitive ; données fournies par 41.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Notes-Decide.dc.html` (« Décidé · bloc-notes (A) avec le
partage à la table »). **Départ** :
`components/shell/notebook/NotebookWorkspace.tsx`,
`components/shell/notebook/FicheCompanion.tsx`,
`app/m/[worldSlug]/joueur/notes/page.tsx`, cas `notes` de
`components/shell/MjToolWindowContent.tsx`. **Dépend de** : 41, 20, 25, 29.

**Ce qui est décidé**
- **Ordinateur** : sommaire arborescent à gauche — « Mon cahier » (pages,
  fiches ◆ et règles § épinglées), puis « Partagées à la table » (chaque
  page avec son autrice) ; la page au centre ; la fiche citée ou épinglée
  dans le panneau de droite (`FicheCompanion`). En bas du sommaire :
  « + Nouvelle page », « + Préparation de séance » (MJ seul), « ◆ Épingler
  une fiche ou une règle ».
- **Partage** : chaque page de **son** cahier porte un sélecteur « Privée |
  La table » (services de 41). Partagée, elle reste à sa place, marquée
  « partagée ». Une page partagée par quelqu'un d'autre s'ouvre en lecture
  seule, « <autrice> · lecture seule ».
- **MJ** : en fenêtre (V3.1-20), rail présent. **Joueuse** : « Notes » de
  son rail, en page pleine, même disposition, sommaire « Mes notes » puis
  « Partagées à la table » (pas de « Préparation de séance »).
- **Tablette** (fenêtre ≈ 556 px) : sommaire en tiroir ☰, fiche en panneau
  par-dessus la page ; au-dessus de ~640 px de fenêtre, la disposition
  d'ordinateur.
- **Téléphone du MJ** : Outils › Bloc-notes — épinglées en puces, « Mon
  cahier » puis « Partagées à la table » en liste, page en plein écran,
  fiche citée en feuille du bas. **Téléphone de la joueuse** : Notes, pilule
  « Les miennes / Partagées à la table ».

**Critères d'acceptation**
- [ ] Les quatre écrans de la planche (MJ fenêtre, joueuse page pleine, tablette, deux téléphones).
- [ ] Partager puis repasser en privée depuis la page ; l'autre compte voit la page apparaître puis disparaître.
- [ ] Une page partagée par une autre personne n'offre aucune commande d'écriture.
- [ ] Première vue sans écran « Chargement… » (données en props, règle commune 6).

---

### ☐ V3.1-43 — Livre de sessions : le registre et ses trois ajouts · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Livre-Decide.dc.html`. **Départ** :
`components/shell/sessionJournal/SessionJournalMjPanel.tsx`,
`components/shell/sessionJournal/SessionJournalBanner.tsx`, cas
`livre-de-sessions` de `MjToolWindowContent.tsx`. **Dépend de** : 20, 29 ;
l'ajout (2) « Relancer » dépend de V3.1-22 (fils du chat).

**Ce qui est décidé**
- **MJ, ordinateur** : une ligne par séance — date en jeu, titre, autrice,
  séance réelle, état (« Rédigée », « En attente », « Pas de devoir »). En
  tête : la prochaine séance et « Assigner le devoir » (feuille : séance
  réelle et date en jeu proposées d'office, « Qui l'écrit »). Une entrée —
  ou un devoir en attente, avec « Relancer » et « Annuler le devoir » —
  s'ouvre en lecture dans la colonne de droite.
- **Tablette** : registre réduit (date · titre · état), lecture en panneau
  par-dessus. **Téléphone du MJ** : Outils › Livre de sessions, prochaine
  séance puis registre en liste, entrée en plein écran.
- **Joueuse** (page pleine et téléphone) : le bandeau du devoir, puis le
  Livre en **premier chapitre du sommaire** de son wiki.
- **Ajouts** : (1) « à qui le tour » — la feuille propose la personne qui
  n'a pas écrit depuis le plus longtemps (ou jamais) ; (2) « Relancer » —
  un rappel posé dans le fil privé du chat de l'autrice (V3.1-22),
  journalisé ; tant que 22 n'est pas livré, le bouton n'apparaît pas ;
  (3) le Livre en chapitre de tête du sommaire du wiki de la joueuse.

**Critères d'acceptation**
- [ ] Assigner, relancer, annuler un devoir ; chaque geste journalisé une fois.
- [ ] « À qui le tour » : test du choix (jamais écrit > plus ancien > égalité par nom).
- [ ] La joueuse voit le Livre en tête de son sommaire, jamais une entrée réservée au MJ.

---

### ☐ V3.1-44 — Rencontres : l'atelier en trois colonnes · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; budget et solveur inchangés.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Rencontres-Decide.dc.html`. **Départ** :
`components/shell/EncounterBuilder.tsx`, cas `rencontres` de
`MjToolWindowContent.tsx` et de la route
`app/api/worlds/[worldSlug]/mj/[tool]/window/route.ts`. **Dépend de** : 20, 29.

**Ce qui est décidé**
- **Ordinateur, trois colonnes** : à gauche le groupe (PJ de la campagne
  avec leurs vrais niveaux ; un absent se décoche et le budget suit), la
  difficulté visée, « Mes rencontres » (une rencontre sauvegardée se
  rouvre) ; au centre le catalogue du ruleset (recherche, filtres par type) ;
  à droite la barre de budget (les trois paliers 2024 et la difficulté
  visée), la rencontre en cours (± nombre, ×), « Génération aléatoire »,
  « Sauvegarder », « Lancer le combat » (vers l'Initiative).
- **Tablette** : les colonnes s'empilent. **Téléphone du MJ** : le groupe en
  pastilles (prénom · niveau ; toucher un absent le retire, le budget
  suit), la difficulté et la barre, la rencontre en cours, le catalogue en
  feuille du bas, « Lancer le combat ».
- **Inchangé** : le budget est une donnée du ruleset (`encounter_budget`),
  le solveur reste celui du code, la table `campaign_encounters` reste.
- Jauge : pendant un combat, la « menace restante » remplace le budget
  (décidé avec l'Initiative, V3.1-38) — ce ticket n'affiche que le budget.

**Critères d'acceptation**
- [ ] Décocher un PJ change le budget (même calcul que le serveur, aucun calcul de règle côté client : le budget vient de la réponse).
- [ ] Sauvegarder, rouvrir, lancer le combat : la rencontre arrive dans l'Initiative.
- [ ] Le catalogue cherche dans le ruleset actif, sans requête par monstre.

---

### ☐ V3.1-45 — Générateurs : les tirages à gauche, la fiche à droite · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; tables et IA inchangées.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Generateurs-Decide.dc.html`. **Départ** :
`components/shell/GeneratorToolPanel.tsx`, cas `generateurs`. **Dépend de** :
20, 25 (pilule), 29.

**Ce qui est décidé**
- **En haut** : la pilule des outils (Taverne, Échoppe, PNJ…) et les
  variantes **en puces** (dont « Aléatoire ») — elles remplacent les listes
  déroulantes.
- **À gauche, les tirages** : chaque section et ses emplacements (dé,
  résultat, ↻ par emplacement, ↻ par section). « Éditer les tables » prend
  la place des tirages dans cette colonne (retour par ×).
- **À droite, l'aperçu de la fiche assemblée** : chaque morceau tiré est
  souligné en pointillé et se relance d'un toucher (↻) ; la prose écrite
  par l'IA est marquée « IA », longueur 40 / 80 / 120 mots ; menu de taverne
  en deux colonnes (plats par palier, boissons) ; « Tout relancer » ;
  « Copier le texte » ; « Créer la fiche » promeut le résultat en entité
  visible du MJ seul.
- **Tablette** : l'aperçu d'abord, les tirages dessous. **Téléphone** :
  pilule des outils, variantes et « Les tirages » en feuilles du bas,
  aperçu (↻ par morceau, menu en une colonne), « Créer la fiche ».
- **Inchangé** : les tables restent des fiches de règles pondérées du
  ruleset ; la prose de l'IA reste de la donnée, revue avant création
  (règle 10), passée par `src/server/ai/` ; aucun tirage côté client (le
  serveur tire).

**Critères d'acceptation**
- [ ] Relancer un emplacement ne relance que lui (test de la route : un seul emplacement change).
- [ ] « Créer la fiche » crée une entité visible du MJ seul (test).
- [ ] Les variantes n'utilisent plus aucune liste déroulante.

---

### ☐ V3.1-46 — Probabilités : la matrice, caractéristiques et compétences · `M` — **prêt**

**Modèle conseillé : Sonnet** — calcul pur à étendre, tests d'abord ; planche définitive.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Probabilites-Decide.dc.html`. **Départ** :
`src/core/rules/probability.ts` (+ `probability.test.ts`),
`components/shell/PartyProbabilityTable.tsx`, cas `probabilites`.
**Dépend de** : 20, 29.

**Ce qui est décidé**
- **Noyau, tests d'abord** : `probability.ts` gagne les **jets de
  caractéristique** (Force, Dextérité, Constitution, Intelligence, Sagesse,
  Charisme) — même formule que les compétences, touche-à-tout compris,
  avantage / désavantage de la fiche compris. Rien en base (règle 16).
- **Ordinateur** : une seule grille ; les PJ de la campagne en colonnes ;
  en lignes **les six caractéristiques**, puis les dix-huit compétences.
  Le pourcentage au DD choisi (5 à 30, pas à pas ou puces 10 / 15 / 20 /
  25). Le meilleur de chaque ligne est encadré ; une case touchée explique
  son calcul (caractéristique, maîtrise ou expertise, touche-à-tout,
  avantage ou désavantage). Campagne en sélecteur compact.
- **Couleurs** : un **spectre continu** du rouge (peu de chances) au vert
  (presque sûr), fond et chiffre teintés selon le pourcentage — pas trois
  paliers. Interpolation dans l'espace OKLCH entre deux jetons de la charte
  (`--danger` et `--success`), contraste du chiffre vérifié dans les quatre
  modes.
- **Tablette** : la même grille, qui défile. **Téléphone** : le DD (pas à pas
  et puces), le détail de la case touchée, la grille compacte (noms
  abrégés, sans la colonne de caractéristique).
- Libellé : Insight = **Intuition** (`src/i18n/fr.ts`).

**Critères d'acceptation**
- [ ] Tests du noyau : jet de Force sans maîtrise avec touche-à-tout ; avec avantage ; DD 5 et DD 30 aux bornes.
- [ ] La grille montre 6 + 18 lignes, le meilleur de chaque ligne encadré.
- [ ] Teinte continue : 50 % et 51 % ont deux teintes différentes ; contraste AA du chiffre dans les quatre modes.

---

### ☐ V3.1-48 — Création : identité, prénom, nom, naissance au calendrier du monde · `M` — **prêt**

**Modèle conseillé : Sonnet** — décision prise ; ADR à écrire d'après elle, noyau pur, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Creation-Decide.dc.html` (étape Identité). **Départ** :
`src/core/schemas/blocks/character.ts` (+ test),
`components/blocks/characterCreatorSteps/IdentityStep.tsx`,
`src/core/calendar/` (types, `formatDate.ts`).

**Ce qui est décidé (auteur, 5 octobre)**
- Deux champs **Prénom** et **Nom** (`given_name`, `family_name` dans le bloc
  `character`), puis genre et pronoms. Le nom de l'entité (wiki, mentions,
  recherche) reste « Prénom Nom », composé à la création et **recomposé
  automatiquement** quand on édite le prénom ou le nom.
- **Naissance** : on saisit l'âge (± ou au clavier) et on choisit jour et
  mois (les mois du calendrier du monde). L'année se calcule depuis
  `calendar.currentDate` : année du jour − âge, moins un si l'anniversaire
  n'est pas encore passé cette année (121 ans au 14 Germinal 1492, né un
  3 Messidor → 1370). Une phrase résume : « Née le 3 Messidor 1370 ·
  121 ans au 14 Germinal 1492 ». Sans date du jour réglée par le MJ,
  l'année se saisit à la main et l'âge attend la date du jour.
- **Règle 16** : la fiche stocke la **date de naissance** (`GameDate`), plus
  l'âge ; l'âge est **dérivé** de la date du jour en jeu et vieillit avec la
  campagne.
- **Reprise** : un `age` existant devient une date de naissance au 1er du
  premier mois, à corriger à la main (lecture tolérante dans Zod, test de
  relecture d'une fiche ancienne).

**À faire** : écrire l'ADR (décision ci-dessus, dix lignes) ; fonctions
pures `birthYearFromAge` et `ageAt` dans `src/core/calendar` (tests
d'abord, mois de longueurs différentes, anniversaire le jour même) ;
schéma Zod ; recomposition du nom côté serveur.

**Critères d'acceptation**
- [ ] Le cas « 121 ans au 14 Germinal 1492, né un 3 Messidor → 1370 », et le cas « anniversaire aujourd'hui », en tests.
- [ ] Une fiche enregistrée avec `age` se relit (test) ; l'âge affiché est calculé, jamais stocké.
- [ ] Éditer le prénom renomme l'entité ; les mentions suivent (test serveur).

---

### ☐ V3.1-49 — Création : le chemin qui se ramifie (structure, aperçu, joueuse) · `L` — **prêt après 47 et 48**

**Modèle conseillé : Opus** — l'écran est décidé, mais le cœur est un état de choix en cascade (un choix naît de sa source, disparaît si elle change, attend un autre choix) partagé par toutes les étapes, l'aperçu en direct et la création finale ; une erreur y casse les quatre tickets suivants. **Sonnet** pour 50 à 53, qui se branchent dessus.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Creation-Decide.dc.html` (MJ, joueuse, tablette, téléphone).
**Départ** : `components/blocks/CharacterCreatorWizard.tsx` et
`components/blocks/characterCreatorSteps/*`,
`app/m/[worldSlug]/joueur/nouveau-personnage/page.tsx`, cas
`creation-personnage`. **Dépend de** : 47, 48, 25, 26 (fiche), 29.

**Ce qui est décidé**
- **Étapes à gauche** : Identité, Espèce, Classe, Caractéristiques, Points
  de vie (seulement au-delà du niveau 1), Historique, Équipement, Sorts
  (seulement pour un incantateur), Aperçu. **L'onglet Compétences
  disparaît** ; ses contenus sont redistribués :
  - chaque choix de compétence et de maîtrise d'armes vit sous l'étape qui
    l'accorde ;
  - **les langues (le Commun, plus deux au choix) vivent sous Identité**
    (en 2024 elles appartiennent au personnage ; le code les rattache déjà
    à « Personnage », `resolvedRuleset.ts`) ; une langue donnée par une
    classe (Roublard : Argot des voleurs acquis, plus une au choix) sous
    Classe ; une langue fixe (druidique) affichée comme acquise ; une espèce
    ou un historique maison qui en donne les fait naître sous son étape ;
  - la grille des dix-huit compétences et de leurs modificateurs passe dans
    l'aperçu.
- **Sous-étapes** : sous chaque étape, les choix qu'elle fait naître
  (point doré à faire, vert fait ; « n à faire » sur l'étape). Un choix naît
  là où sa source est choisie et **disparaît si elle change**. Exemples :
  lignage ou legs et sa caractéristique d'incantation, Sens aiguisés,
  Compétent, Polyvalent → don → sorts en cascade, taille (Espèce) ; Ordre
  divin, Style de combat, compétences de classe, Expertise (qui attend les
  compétences), maîtrise d'armes, équipement A/B, sous-classe à son niveau
  (Classe) ; +2/+1 ou +1/+1/+1, don d'origine et ses choix, jeu ou outil,
  équipement (Historique) ; sorts mineurs et préparés (Sorts).
- L'écran au centre ; **Précédent / Suivant** parcourent étapes et
  sous-étapes dans l'ordre ; l'**aperçu en direct à droite** (le vrai moteur
  de la fiche).
- **Étape Aperçu** : la fiche décidée elle-même (V3.1-26, 28, 32 ; même
  composant, comme `PreviewStep.tsx` aujourd'hui). Actions de jeu (jets,
  repos, PV) inactives, inventaire modifiable. Les choix encore ouverts
  (un toucher ramène à leur sous-étape) et « Créer le personnage ». **Un
  choix ouvert n'empêche pas de créer** (la fiche le rappellera).
- **MJ** : en fenêtre. **Joueuse** : en page pleine, **mêmes droits que le
  MJ** — niveau de départ et multiclassage (décidé le 6 octobre) :
  `playerRestricted` (dans `CharacterCreatorWizard`) et `hideAddClass`
  (dans `LevelClassesStep`) disparaissent.
- **Tablette** : sans la colonne d'aperçu (l'étape Aperçu reste).
  **Téléphone** : une étape par écran, barre de progression.

**Critères d'acceptation**
- [ ] Humain → Polyvalent → Initié à la magie → liste de sorts : la cascade naît, et disparaît si on change d'espèce.
- [ ] Roublard : l'Expertise attend les compétences ; l'Argot des voleurs est acquis sous Classe.
- [ ] Plus d'étape Compétences ; les langues sous Identité.
- [ ] Une joueuse crée un personnage de niveau 5 multiclassé.
- [ ] Un personnage avec des choix ouverts se crée, et la fiche les signale.

---

### ☐ V3.1-50 — Création : Origines, Historique et un seul sélecteur de sorts · `L` — **prêt après 49**

**Modèle conseillé : Sonnet** — planches définitives.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : `Origines-Decide.dc.html`, `Historique-Decide.dc.html`.
**Départ** : `SpeciesStep.tsx`, `BackgroundStep.tsx`,
`SpellSelectionStep.tsx`, `RemainingChoicesStep.tsx`. **Dépend de** : 49.

**Ce qui est décidé**
- **Espèce et Historique** : les options en petites cartes (trois par
  ligne, deux sur tablette et téléphone), dessous la fiche de la sélection —
  traits en une ligne chacun, « Ce qui en naît » en pastilles qui mènent
  aux sous-étapes.
- **Lignage, legs, lignage gnomique** : tableau comparatif, une colonne par
  option, niveaux 1, 3 et 5 (une carte par option au téléphone).
- **Valeurs de caractéristique de l'historique** : jetons « +2 et +1 » ou
  « +1 à chacune », le total s'affiche.
- **Choix expliqués** : la caractéristique d'incantation dit à quoi elle
  sert (DD et attaque des sorts **du trait**, rien d'autre) et chaque option
  montre son effet chiffré pour ce personnage (« mod. +2 → DD 12,
  attaque +4 »), en signalant celle de la classe ou la meilleure. Sens
  aiguisés : ce que couvre chaque compétence, le total qu'elle donnerait, et
  « déjà maîtrisée (Acolyte) : ce choix ne donnerait rien de plus ». Les
  chiffres viennent du moteur, jamais d'un calcul dans le composant.
- **Historique, le don** : une seule sous-étape « Don : Initié à la magie
  (Clerc) · n/3 » ; son écran regroupe les choix du don en sections
  (caractéristique d'incantation avec son effet chiffré, deux sorts
  mineurs, un sort de niveau 1), chacune avec son compte ; à côté, la fiche
  du sort touché (école, temps, portée, durée, effet).
- **Un seul sélecteur de sorts** (cartes + fiche du sort) : celui de l'étape
  Sorts et de **tout** choix de sorts né d'un trait, d'un don ou d'une
  sous-classe. L'étape Sorts : budget de la classe (sorts mineurs, sorts
  préparés) lu dans la progression d'incantation du ruleset.
- **Équipement de l'historique A ou B** : deux cartes, la liste des objets de
  A face aux pièces de B ; l'outil à choisir (le jeu du Soldat) en cartes.
- Tablette et téléphone : la fiche du sort passe sous les sections ; les
  cartes d'équipement s'empilent.

**Critères d'acceptation**
- [ ] Un seul composant de sélection de sorts, utilisé par l'étape Sorts et par Initié à la magie (aucun doublon).
- [ ] Sens aiguisés sur une compétence déjà maîtrisée affiche « ce choix ne donnerait rien de plus ».
- [ ] L'effet chiffré de la caractéristique d'incantation suit les valeurs de caractéristiques en direct.

---

### ☐ V3.1-51 — Création : la Classe, et le même écran pour monter de niveau · `L` — **prêt après 47 et 49**

**Modèle conseillé : Sonnet** — planche définitive ; règles fournies par 47.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Classe-Decide.dc.html`. **Départ** : `LevelClassesStep.tsx`,
`HpRollStep.tsx`, `CreationHpRollStep.tsx`, `AsiStep.tsx`,
`components/blocks/LevelUpWizard.tsx` (remplacé). **Dépend de** : 47, 49.

**Ce qui est décidé**
- **En tête, les classes du personnage en emplacements**, « + Ajouter une
  classe » avec le contrôle des prérequis de 47 (le MJ peut passer outre).
  L'emplacement choisi ouvre sa grille et sa fiche ; le niveau de cette
  classe se règle par − / + ou d'un toucher (1, 5, 10, 15, plafond) ; le
  niveau de personnage, somme des classes, ne dépasse pas le plafond du
  ruleset.
- **La progression porte les choix** : tous les niveaux de la classe, une
  ligne chacun (acquis en vert, niveau atteint en doré, la suite estompée
  avec ce qui viendra). Chaque choix d'un niveau atteint (sous-classe,
  améliorations, don épique, Expertise…) est une **pastille sur sa ligne**
  qui ouvre le choix. L'étape Classe, à gauche, ne liste que les choix du
  niveau 1, plus « Choix de niveau · n à faire ».
- **Points de vie** : une ligne par niveau au-delà du premier (classe, dé,
  moyenne ou jet du serveur, à basculer), « Moyenne pour tous » ou
  « Lancer tous ». Les jets sont faits par le serveur (règle 8).
- **Monter de niveau** : le même écran, ouvert par « monter de niveau ▸ » sur
  la fiche. On choisit la classe qui gagne le niveau (existante ou
  nouvelle) et combien de niveaux (plusieurs d'un coup) ; les niveaux
  acquis sont verrouillés, les nouveaux en doré ; les étapes se réduisent à
  ce qui change (points de vie, choix des nouveaux niveaux, sorts), puis un
  aperçu avant → après. **Remplace `LevelUpWizard.tsx`** (supprimé).
- **Joueuse** : niveau de départ et multiclassage libres (voir 49).

**Critères d'acceptation**
- [ ] Clerc 3 / Guerrier 2 : deux emplacements, niveau de personnage 5, choix de chaque ligne atteinte en pastilles.
- [ ] Monter de 3 niveaux d'un coup en ajoutant une classe ; aperçu avant → après ; une seule écriture.
- [ ] `LevelUpWizard.tsx` n'existe plus ; aucun import restant.
- [ ] « Lancer tous » : les valeurs viennent du serveur (test de la route : le client n'envoie aucun résultat).

---

### ☐ V3.1-52 — Création : les Caractéristiques, la suggestion puis l'échange · `M` — **prêt après 47 et 49**

**Modèle conseillé : Sonnet** — planche définitive ; constantes déplacées par 47.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Carac-Decide.dc.html`. **Départ** : `AbilityScoreStep.tsx`,
`src/core/rules/abilityGeneration.ts`. **Dépend de** : 47, 49.

**Ce qui est décidé**
- **Tableau standard** : « Répartir pour un clerc » place les valeurs selon
  la classe (ordre lu dans le ruleset, 47) ; puis on **touche deux cases
  pour échanger** leurs valeurs.
- **Six grandes cases** : total, modificateur, et d'où vient le total (base,
  historique, améliorations).
- **Achat de points** : − / + par case, jauge du budget qui **refuse** de
  dépasser (budget et coûts lus du ruleset).
- **Tirage** : fait par le serveur (formule du ruleset), puis suggestion et
  échange.
- Le bonus d'historique se répartit dans **sa** sous-étape (50), les
  améliorations de niveau dans la leur (51) : cette étape les montre, ne
  les règle pas.

**Critères d'acceptation**
- [ ] Suggestion puis échange de deux cases ; les totaux suivent.
- [ ] Achat de points : impossible de dépasser le budget (le + se grise).
- [ ] Tirage : aucun résultat calculé côté client (test de la route).

---

### ☐ V3.1-53 — Création : l'Équipement (bande d'équipement, boutique, départ à haut niveau) · `L` — **prêt après 24, 47 et 49**

**Modèle conseillé : Sonnet** — planche définitive, très détaillée ; services de 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Equipement-Decide.dc.html`. **Départ** : étape
« Équipement » de `CharacterCreatorWizard.tsx`, services `changeCurrency` et
`setItemEquipped` (V3.1-24). **Dépend de** : 24, 47, 49.

**Ce qui est décidé**
- **En tête** : bourse et charge — l'or des options de départ (A/B de la
  classe et de l'historique), dépensé aux prix du ruleset ; charge selon la
  Force (multiplicateur du ruleset, 47).
- **Trois tuiles sans boutons** : Armure, Main principale, Main secondaire,
  avec la fiche chiffrée de l'objet porté ; la CA et l'attaque qui en
  découlent viennent du moteur (règle 16). Au remplacement, la tuile
  **scintille comme les dés** (nom et fiche défilent flous parmi les objets
  du même type, puis se figent) et la CA **compte** jusqu'à sa nouvelle
  valeur — même animation que l'outil de dés (V3.1-33) ; mouvement réduit :
  changement direct.
- **La bande d'équipement** : à gauche de chaque objet qui se porte, une
  bande-bouton sur toute la hauteur de la ligne, avec **le symbole du
  type** (armure, arme = petite épée au trait — lame, garde, poignée,
  pommeau —, bouclier), éteinte rangé, dorée porté. Allumer un objet éteint
  éteint **en fondu** celui qui occupait l'emplacement, qui revient au sac.
  Un objet qui ne se porte pas garde la place de la bande, vide. Icônes
  dessinées au trait (aucune bibliothèque, charte §10).
- **Inventaire par ordre alphabétique**, objets portés compris.
- **Colonnes communes à l'inventaire et à la boutique** : bande (ou symbole
  du type en boutique), nom et fiche, **poids, prix**, action (« rendre »,
  « acheter ») — poids et prix exactement au même endroit, pour **toutes**
  les entrées.
- **Rendre ou vendre** : pendant la création, × **rend** l'objet et le
  **rembourse en entier** ; une fois en jeu, sur la fiche, × **vend** à la
  moitié du prix (ratio du ruleset, 47) — ce ticket fait la création ; la
  vente sur la fiche suit le même composant.
- **Boutique cherchable** : une zone de recherche (nom, type, propriété —
  « épée », « armure », « perforants ») ; **sous chaque objet, sa fiche
  chiffrée** (dés de dégâts et propriétés, botte d'arme, CA et limite de
  Dextérité, Force requise, discrétion, poids). « Acheter » grisé si la
  bourse ne suffit pas.
- **Départ à haut niveau** : d'après la table du ruleset (47), au-delà du
  niveau 4 de l'or en plus (somme fixe + jet du serveur) et, aux niveaux
  élevés, des objets magiques à choisir — une sous-étape d'Équipement.
- **Tablette et téléphone** : la ligne passe sur deux rangées (« rendre » ou
  « acheter » dessous), **la bande couvre toute la hauteur de la carte**,
  marge à droite pour que le prix ne touche pas le bord ; les tuiles sur
  deux colonnes.

**Critères d'acceptation**
- [ ] Acheter puis rendre : la bourse revient exactement à sa valeur.
- [ ] Allumer une armure éteint l'ancienne en fondu ; la tuile scintille ; la CA compte jusqu'à la valeur du moteur.
- [ ] Recherche « perforants » : seuls les objets qui ont cette propriété.
- [ ] Poids et prix alignés en colonnes à 390 px, 820 px et sur ordinateur.
- [ ] Mouvement réduit : aucune animation.

---

### ☐ V3.1-54 — Gestion de campagne au verre minéral, avec « Voir comme » · `S` — **prêt**

**Modèle conseillé : Sonnet** — disposition déjà codée (V3.1-15) ; transposition seulement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Campagne-Gestion.dc.html`. **Départ** :
`components/shell/CampaignsPanel.tsx`, `components/shell/CampaignDetail.tsx`,
`InviteLinkPanel.tsx`. **Dépend de** : 20, 29 ; l'entrée « Voir comme »
dépend de **V3.1-12** (autorisation et garde-fous).

**Ce qui est décidé** : la disposition de V3.1-15 (piste A) **ne change
pas** — invitations en haut, « À la table » avec les MJ sur une ligne, une
carte par compte joueur, les PNJ sans joueur en bas. Le verre minéral :
panneaux en verre (coins 18 px), carte en verre sombre avec le PJ en ambre,
menus ⋮ et confirmations en **surfaces flottantes** (elles nomment
`Nom#0000`), boutons de la charte. Tablette : deux cartes par rangée.
Téléphone : cartes l'une sous l'autre, ligne de lien réduite au rôle,
Copier et ⋮.
- **« Voir comme Inès#4821 »** en tête du menu ⋮ de chaque carte, avant
  « Forcer une réinitialisation » et « Retirer de la campagne ». Tant que
  V3.1-12 n'est pas livré, l'entrée n'apparaît pas.

**Critères d'acceptation**
- [ ] Les gestes existants inchangés (tests de V3.1-15 verts).
- [ ] Menus et confirmations en surfaces flottantes, au clavier (Échap ferme).
- [ ] « Voir comme » visible seulement si V3.1-12 l'autorise côté serveur.

---

### ☐ V3.1-55 — Calendrier ingame : l'année d'un coup d'œil · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Calendrier-Decide.dc.html`. **Départ** :
`components/shell/CalendarSettingsPanel.tsx`, `src/core/calendar/*`
(`weekday.ts`, `formatDate.ts`), cas `calendrier`. **Dépend de** : 20, 29.

**Ce qui est décidé**
- **En haut, la frise des ères** : une bande, chaque ère de largeur
  proportionnelle à sa durée (la dernière court jusqu'à « an actuel +
  300 »), le jour actuel marqué d'un trait accent et de son année. Toucher
  une ère ouvre le réglage des ères.
- **À côté, le jour actuel** : son jour de la semaine, la date, son ère et
  « an N de l'ère », « jour 44 sur 360 ». Pas : « ‹ Veille »,
  « Lendemain › », « + une semaine » (libellé « + une décade » pour une
  semaine de 10 jours, sinon « + N jours ») ; « Changer la date » ouvre
  jour, mois (‹ ›) et an.
- **Dessous, les douze mois en vignettes** (nom, durée, mini-grille, le
  jour actuel allumé ; le mois actuel bordé d'accent). **La semaine en
  puces** : › décale d'un rang, × supprime, « + jour » ; « Le 1er jour de
  l'an 0 était un ‹ Primidi › ».
- **Réglage contextuel à droite** : toucher un mois ouvre nom, durée en − /
  + (1 à 60), position ↑ ↓, la grille du mois (‹ › pour changer de mois),
  « + Ajouter un mois après », « Supprimer ce mois » ; toucher un jour de
  la grille le sélectionne (« samedi 30 Brumaire 1492 — dans 6 jours ») et
  propose « En faire aujourd'hui ». Toucher une ère ouvre la liste des ères
  (nom, « dès l'an », ×, « + Ajouter une ère »).
- **Raccourcir un mois recale le jour actuel** sur le dernier jour du mois.
- **Rien n'est enregistré avant « Enregistrer »** (le calendrier est
  remplacé en entier, comme aujourd'hui) ; la barre du bas dit
  « Modifications non enregistrées » ou « Tout est enregistré ».
- **Tablette** : la frise puis le jour actuel l'un sous l'autre, trois
  vignettes par rangée, le réglage sous l'année. **Téléphone** : le jour
  actuel, la frise, trois vignettes par rangée, la semaine ; un mois ou une
  ère touché s'ouvre en **feuille du bas** ; « Enregistrer » en haut.
- Calculs (jour de la semaine, jour de l'année, décalage de N jours) dans
  `src/core/calendar`, **tests d'abord** ; le composant n'en fait aucun.

**Critères d'acceptation**
- [ ] Tests du noyau : lendemain du dernier jour de l'an, veille du 1er jour de l'an 0 (année négative), décalage de 10 jours sur deux mois.
- [ ] Raccourcir Brumaire à 10 jours quand on est le 14 : le jour actuel devient le 10.
- [ ] Changer le 1er jour de l'an 0 décale toutes les vignettes.
- [ ] Rien n'est écrit avant « Enregistrer » (test : aucune requête).

---

### ☐ V3.1-56 — Calendrier réel au verre minéral, côté MJ et côté joueuse · `M` — **prêt**

**Modèle conseillé : Sonnet** — disposition déjà codée (V3.1-16) ; transposition seulement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Calendrier-Reel.dc.html`. **Départ** :
`components/shell/scheduling/*` (`SchedulingMjPanel.tsx`,
`NextSessionPanel.tsx`, `AvailabilityGrid.tsx`),
`app/m/[worldSlug]/joueur/prochaine-session/page.tsx`. **Dépend de** : 20,
27, 29.

**Ce qui est décidé** : la disposition de V3.1-16 **ne change pas**
(grille à bascule « Mes disponibilités / Toute la table », géométrie, ligne
« 22:00 », colonne des heures fixe, croix au survol, info-bulle « (toi) »
en tête, dates possibles classées par nombre puis par durée,
enregistrement automatique de la joueuse). Le verre minéral :
- **MJ** : fenêtre à volets ; en-tête — titre, « Créneau proposé · N jours ·
  X réponses sur Y », **durée visée en − / +**, « Annuler la demande » en
  danger fantôme ; la grille et les dates possibles dans des panneaux en
  verre ; « Confirmer » **plein** pour une session complète, contour accent
  sinon ; trois cartes (« Régler une date à la main », « Séances à venir »
  avec « Annuler », « Déjà jouées »). Tablette : les cartes l'une sous
  l'autre. Téléphone (Outils › Calendrier réel) : la même colonne, la
  grille défile à l'horizontale.
- **Joueuse** : page pleine « Prochaine séance » dans sa coquille, sans aucun
  outil MJ — la prochaine séance en grand (pavé de date), la demande ouverte
  et sa grille (« Toute la table » comprise), « Les dates qui se
  dessinent » en lecture seule (« c'est le MJ qui choisit »), « Séances à
  venir » et « Déjà jouées ». Ligne d'état « Enregistrement… » puis
  « Enregistré ✓ ».

**Critères d'acceptation**
- [ ] Tests de V3.1-16 verts, sans modification.
- [ ] Aucun outil MJ dans la page de la joueuse (test de rendu).
- [ ] La grille défile à l'horizontale au téléphone, la colonne des heures reste visible.

---

### ☐ V3.1-57 — Règles actives : le ruleset à gauche, la table à droite · `M` — **prêt après V3.1-23**

**Modèle conseillé : Sonnet** — planche définitive ; données et serveur de V3.1-23.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Regles-Decide.dc.html`. **Départ** :
`components/rules/RulesetSelector.tsx`, `RulesetImportMappingDialog.tsx`,
cas `regles-actives`. **Dépend de** : **23** (interrupteurs,
`campaigns.table_settings`, refus serveur), 26 (fiche).

**Ce qui est décidé**
- **À gauche, le ruleset** :
  - « Ruleset de la campagne » : les variantes **en arbre sous leur base**
    (trait de rattachement) ; pastilles « officiel », « variante »,
    « référence personnelle » ; « ● actif » ou « Choisir » ; « Exporter »
    sur une variante **jamais sur une référence personnelle** ; × sur une
    variante, confirmé en surface flottante (« Supprimer la variante « … » ?
    Ses fiches de règles disparaissent ; la campagne revient à … » si elle
    est active) ;
  - « Créer une variante » : la base en puces, le nom, « Créer » (grisé sans
    nom), l'interrupteur « Référence personnelle » (« Contenu saisi depuis
    un ouvrage que je possède ») et son avertissement
    (`referencePersonnelleAvertissement`, texte inchangé) ;
  - « Importer des règles » : « Ajouter à la variante active » / « Créer un
    nouveau ruleset personnel » en puces, l'aide (textes existants de
    `messages/fr.json`), « Choisir un fichier JSON… », le résultat et les
    erreurs ligne à ligne (correspondance des colonnes inchangée).
- **À droite, la table** :
  - « Ce que les joueurs modifient eux-mêmes » : les six interrupteurs de
    V3.1-23 (états, inspiration, PV, pièces, emplacements, dés de vie), chacun
    avec ce qu'il commande en petit et **qui tient la valeur** (« le MJ » /
    « la joueuse ») ; « Par défaut » remet les six réglages ;
  - « Inspiration au plus » en − / + ;
  - **l'aperçu de la fiche de la joueuse** (une fiche de PJ de la campagne,
    en lecture) qui suit les interrupteurs **en direct** : « + état »
    apparaît, ▲▼ apparaissent, emplacements inertes, « Le MJ dépense tes dés
    de vie ». C'est **la fiche réelle** (composant de V3.1-26) en mode
    lecture, pas un dessin à part.
- **Tablette** : un volet — la table et l'aperçu d'abord, puis le ruleset et
  l'atelier. **Téléphone** : le ruleset, la table, l'aperçu, puis
  « Variantes et import » replié.

**Critères d'acceptation**
- [ ] Choisir un ruleset : fiches, création et règles le suivent sans rechargement (caches clients vidés comme aujourd'hui).
- [ ] « Exporter » absent d'une référence personnelle.
- [ ] Basculer un interrupteur change l'aperçu aussitôt et l'écrit (une requête).

---

### ☐ V3.1-58 — Personnalisation : le fond d'abord, et pour les joueuses · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Perso-Decide.dc.html`. **Départ** :
`components/shell/PersonnalisationPanel.tsx`, `BackgroundPicker.tsx`,
`src/core/theme/builtinBackgrounds.ts`, `HomeProfilePanel.tsx`,
`PlayerShell.tsx`. **Dépend de** : 27 (rail), 35 (Compte sur l'accueil).

**Ce qui est décidé**
- **Barre en tête** : le mode en **pilule à quatre** (Sombre, Demi-sombre,
  Demi-clair, Clair) — un mode que le fond ne permet pas est grisé, raison
  au survol (« Ce fond ne permet pas ce mode de façon lisible ») ; « Flou
  du fond » (0 à 40 px, pas de 2) ; « Contraste élevé » en interrupteur
  (« Palette neutre sombre et traits nets, quel que soit le mode »).
- **Galerie des fonds** en grandes vignettes (les miniatures réelles,
  `thumbDataUrl`), chacune avec **ses modes lisibles en points** (un point
  teinté par mode permis, vide sinon) ; les images personnelles à la suite,
  avec × ; « + Ajouter une image » en dernière vignette (téléversement
  existant). Choisir un fond qui ne permet pas le mode en cours **bascule**
  sur un mode permis et **le dit** (message court).
- Sous la galerie : « Ces réglages sont les tiens, sur cet appareil : ils
  s'appliquent aussitôt, sans enregistrer. Tes images personnelles te
  suivent sur tous tes appareils. »
- **Données** : rien de neuf — cookies `mode`, `contrast`, `background`,
  `bgBlur` et la bibliothèque personnelle (`/api/settings/background`).
- **Tablette** : deux vignettes par rangée. **Téléphone** : la barre en
  colonne, puis la galerie en deux colonnes.
- **Pour tout le monde (accord de l'auteur, 8 octobre)** : le même écran
  dans **« Compte » de l'accueil** (V3.1-35), à côté du profil ; une entrée
  **« Apparence »** en pied du rail du joueur, au-dessus de « Mes mondes »,
  qui l'ouvre en page pleine ; au téléphone, par Accueil › Compte. Le MJ
  garde son outil. Un seul composant pour les trois accès.

**Critères d'acceptation**
- [ ] Un compte joueur sans aucun monde mené règle son mode et son fond depuis Compte.
- [ ] Choisir un fond à deux modes en mode clair bascule en sombre et l'annonce.
- [ ] Un seul composant monté aux trois endroits (aucun doublon).

---

### ☐ V3.1-59 — Publication : le fond par défaut du wiki (données) · `M` — **prêt (Opus) — conçu le 9 octobre, ADR 0047**

**Modèle conseillé : Opus** — donnée nouvelle par monde, lue par la page publique (service role) et par l'onglet Wiki des joueuses.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision de l'auteur (8 octobre)** : le MJ choisit le **fond par défaut du
wiki** — un fond (fourni ou de sa bibliothèque), le **mode des pages**, le
**flou**. C'est un réglage **du monde**, vu de tous : il s'applique au wiki
public (`/partage`) **et à l'onglet Wiki des joueuses** (même `BookSkin`).
Une fiche qui a son propre fond (image « fond de page wiki », V2-G13) **le
garde**.

**À faire**
1. Où stocker : colonne(s) sur `worlds` ou réglage existant — **pas prévu
   dans `docs/SCHEMA.md` : ADR, mise à jour du schéma, nouvelle migration**.
   Valider par Zod (référence de fond, mode parmi les modes permis par le
   fond, flou 0–40).
2. Une image de la bibliothèque **personnelle** du MJ devient visible des
   visiteurs anonymes : décider comment elle est servie (copie dans le
   stockage du monde, ou lecture publique de cette seule image) — la règle 2
   s'applique (`publicShare.ts` seul porte le service role).
3. `BookSkin` / `WikiBackgroundProvider` : fond de la fiche s'il existe,
   sinon fond par défaut du monde, sinon rien (comportement actuel).
4. Route d'écriture (Zod, MJ seul).

**Critères d'acceptation**
- [ ] ADR et `docs/SCHEMA.md` à jour ; nouvelle migration.
- [ ] Un visiteur anonyme voit le fond par défaut ; une fiche avec son propre fond garde le sien (tests).
- [ ] Une joueuse voit le même fond dans son onglet Wiki.
- [ ] Aucune autre image de la bibliothèque du MJ n'est lisible publiquement (test).

---

### ☐ V3.1-60 — Publication : les réglages, et ce que voit un visiteur · `M` — **prêt après 58 et 59**

**Modèle conseillé : Sonnet** — planche définitive ; galerie de 58, données de 59.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Publication-Decide.dc.html`. **Départ** :
`components/shell/PublicationPanel.tsx`, `ShareLinkPanel.tsx`,
`BookSkin.tsx` (pour l'aperçu). **Dépend de** : 58 (galerie), 59.

**Ce qui est décidé**
- **À gauche** :
  - « Partage en lecture seule » : texte d'aide inchangé ; alias
    (« /partage/ » + champ), mot de passe, « Créer un lien » ; « Lien créé : »
    avec « Copier » (« Copié ✓ ») ; la liste (adresse, « Créé le … »,
    « protégé », Copier, Révoquer) ; textes existants de `ShareLinkPanel`.
  - « Message d'accueil » : 500 caractères avec compteur, « Enregistrer »
    (« Enregistré ») ; « Remplace le grand titre de la page d'accueil. Vide :
    le nom de la campagne. »
  - « Fond par défaut du wiki public » : **la galerie de V3.1-58** (même
    composant), « une fiche qui a son propre fond le garde », « Mode des
    pages » en puces (modes non permis grisés), « Flou du fond ».
- **À droite, « Ce que voit un visiteur »** : la page d'accueil du wiki en
  petit — le message en titre (ou le nom de la campagne), le sommaire, le
  fond, le mode, le flou — qui **suit chaque changement** avant
  enregistrement ; « Prévisualiser ↗ » ouvre le vrai (`/m/[slug]/apercu`).
- **Tablette** : un volet — l'aperçu d'abord, puis le message, le fond, les
  liens. **Téléphone** : les liens, le message, le fond, puis l'aperçu ;
  « Prévisualiser ↗ » en haut.

**Critères d'acceptation**
- [ ] L'aperçu suit message, fond, mode et flou sans requête au serveur.
- [ ] Choisir un fond qui ne permet pas le mode des pages bascule sur un mode permis et l'annonce.
- [ ] Liens : créer, copier, révoquer inchangés (tests existants verts).

---

### ☐ V3.1-61 — Journal historique : par fiche, ou chronologique · `M` — **prêt**

**Modèle conseillé : Sonnet** — planche définitive ; un champ de plus côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Journal-Decide.dc.html`. **Départ** :
`components/shell/GmJournalPanel.tsx`, `DeletedEntitiesPanel.tsx`,
`src/server/services/activityJournal.ts`,
`app/m/[worldSlug]/mj/journal-historique/page.tsx`, cas
`journal-historique`. **Dépend de** : 20, 29.

**Demande de l'auteur (8 octobre)** : chercher par personne, trier,
filtrer par objet modifié ou par élément (wiki, fiche de personnage…).

**Ce qui est décidé**
- **Serveur** : `JournalEntry` gagne `entityKind` (le type de la fiche,
  déjà connu du serveur, lu dans la même requête — pas de requête par
  ligne) et le nom du bloc modifié reste `blockLabel`. Accès réservé au MJ,
  inchangé.
- **Bascule en tête** (pilule) :
  - « **Par fiche** » : une carte par objet modifié — nom (lien entité,
    toucher = ne montrer que cette fiche), type en pastille, « n
    modifications » ; dedans, une ligne par changement : quand (« 8 oct.
    10:42 »), qui, et « partie modifiée — détail » (le détail d'inventaire
    existant, ligne par ligne). Les événements de jeu sans fiche se
    regroupent dans « Sans fiche (jeu) ».
  - « **Chronologique** » : la liste groupée selon le tri — plus récent
    (par jour : « Aujourd'hui · mercredi 8 octobre »), plus ancien, par
    personne, par fiche ; chaque ligne : heure, avatar (initiale ; ✦ pour
    « IA / système »), « Inès a modifié Inventaire de Sakaburin », type en
    pastille, première ligne du détail et « révision #14 », pastille
    « wiki » / « jeu » ; toucher la ligne **déplie** le détail complet.
- **Filtres communs** : la recherche (« Chercher une personne, une fiche, un
  mot… » — dans la personne, la fiche, la partie modifiée, le détail,
  l'élément) ; « Qui » en puces (chaque personne avec son nombre, « IA /
  système » compris) ; « Élément » en puces (Fiches de personnage, PNJ,
  Lieux, Factions, Objets, Pages, Jeu (jets, actions, narration)) avec
  leur nombre — **les nombres suivent les autres filtres** ; les filtres
  actifs en étiquettes (× par étiquette, « Tout effacer ») et « n
  modifications sur N ».
- Filtres et tri **côté client**, sur les entrées déjà reçues (pas de
  requête par filtre).
- **Fiches supprimées** à droite (texte « … · PNJ · supprimée le 6 oct. par
  Gabriel », « Rétablir »). Rétablir met à jour l'arborescence **sans
  `window.location.reload()`** (règle commune 6).
- **Tablette** : une colonne, les fiches supprimées en bas. **Téléphone** :
  la bascule et la recherche en tête, « Filtres » (avec le nombre de
  filtres actifs) ouvre une **feuille du bas** — tri, Qui, Élément, Partie
  modifiée (cases à cocher avec nombres), « Voir n résultats » ; les cartes
  l'une sous l'autre.

**Critères d'acceptation**
- [ ] `entityKind` renvoyé sans requête supplémentaire par ligne (test du service).
- [ ] « Inès » + « Fiches de personnage » : seules ses modifications de fiches de PJ ; les nombres des autres puces suivent.
- [ ] Toucher « Sakaburin » ne montre que cette fiche ; l'étiquette se retire d'un ×.
- [ ] Rétablir une fiche : elle revient dans l'arborescence, sans rechargement de la page.

---

### ☐ V3.1-62 — Rapidité : mesurer, puis recâbler · `M` — **à faire en premier**

**Modèle conseillé : Opus** pour la mesure et le plan (étapes 1 et 2), **Sonnet** pour appliquer les corrections listées (étape 3).

**Question de l'auteur (8 octobre)** : faut-il revoir le « câblage » pour
rendre l'application plus rapide ? **Oui, mais en mesurant d'abord.** Ce
qui est déjà bien : `createClient`, `getAuthUser` et `getWorldBySlug` sont
mis en cache par requête (`cache()` de React) ; plusieurs services publics
aussi. Relevé dans le code le 8 octobre, sans mesure :
- **Chargements après affichage** : 56 composants lancent un `fetch` dans un
  `useEffect` — l'écran s'affiche vide (« … ») puis se remplit, souvent en
  cascade (une requête attend la précédente). Les fenêtres du MJ demandent
  leurs données à `/api/worlds/[worldSlug]/mj/[tool]/window` **après**
  l'ouverture.
- **Rafraîchissements complets** : 32 `router.refresh()` — chacun relance
  tout l'arbre serveur de la page (layouts compris : arborescence, entités,
  campagnes) pour un seul changement ; un `window.location.reload()`
  (`DeletedEntitiesPanel`).
- **Attentes en série** dans les layouts et la route des fenêtres : monde →
  utilisateur → droits → campagnes, l'un après l'autre alors que plusieurs
  sont indépendants.
- **Requêtes par ligne** : l'Initiative charge chaque PJ un par un
  (`getEntityById` par participant, route des fenêtres, cas `initiative`).
- **Peu de chargement progressif** : 3 `loading.tsx`, 2 `<Suspense>` — une
  page lente bloque tout l'écran.
- **Deux allers-retours d'authentification par navigation** (le
  middleware et le serveur appellent chacun `auth.getUser()`) — à mesurer
  avant d'y toucher : la vérification réseau est un choix de sécurité
  documenté dans `lib/supabase/middleware.ts`.

**À faire**
1. **Mesurer** (Opus) : temps serveur des pages les plus utilisées (fiche
   du wiki, fiche de personnage, ouverture d'une fenêtre d'outil, accueil,
   page joueur) — en-tête `Server-Timing` ou journal en développement —, et
   nombre de requêtes à la base par page. Écrire les chiffres ici.
2. **Planifier** (Opus) : classer les causes par gain mesuré ; écrire un ADR
   court sur les conventions retenues (données initiales en props,
   mises à jour optimistes, `Promise.all`, `loading.tsx` par zone,
   `revalidatePath` ciblé plutôt que `router.refresh()` global), qui devient
   la règle commune 6 des tickets du lot i.
3. **Recâbler** (Sonnet) : les corrections listées par le plan, une par
   commit, **sans changer aucun comportement** ; les outils refaits par le
   lot i suivent déjà la règle 6.

**Critères d'acceptation**
- [ ] Les mesures avant / après sont écrites dans ce ticket.
- [ ] Aucune régression : `npm run test` vert, aucun test affaibli.
- [ ] Aucun changement de sécurité (RLS, vérification de session) sans décision écrite de l'auteur.
