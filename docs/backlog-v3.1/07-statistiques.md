# Backlog V3.1 — Tickets du volet « Je joue » de l'accueil : les statistiques (9 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Décision du 9 octobre (V3.1-19, section « Accueil, volet « Je joue » :
statistiques ») ; planche **`Stats-Decide.dc.html`** (canevas
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm, sous l'Administration).
Les règles de lecture des tickets du 9 octobre (plus haut) valent ici.

**Ce qui existe déjà — à reprendre, pas à refaire en double**
- `components/shell/DiceStatsPanel.tsx`, monté par `HomeScreen.tsx` sur une
  carte de monde où l'on est joueur : moyenne des **totaux**, réussites et
  échecs, 20 et 1 naturels, argent gagné et dépensé — mais sur les 200
  derniers jets de **toute la campagne** (tous les joueurs, jets du MJ
  compris), et l'argent de **tous les PJ du monde**. **Ces tickets le
  remplacent** par des statistiques **du personnage de la joueuse**.
- `src/core/dice/rollStats.ts` (`computeDiceStats`) et
  `src/core/dice/parseRollDetail.ts` (`extractDiceGroups`).
- `src/core/rules/economyStats.ts` (`computeEconomyStats`) et
  `src/server/services/campaignEconomy.ts` : l'argent gagné et dépensé est
  **déjà calculé** en comparant les révisions successives du bloc
  `inventory` (rien à stocker en plus).
- Chaque jet écrit dans `dice_rolls.detail` un `who` (le **nom affiché**
  de l'entité ou de la personne, pas un identifiant), un `what` (« Attaque —
  Rapière », « Jet libre », le nom du test) et la `trace` des dés. Quatre
  chemins d'écriture : `characterActions.ts`, `checkRolls.ts` (tests et jet
  libre), `turnIntent.ts` (solo).
- Le backlog V2 notait deux idées « pas un ticket » (« stats de jets
  amusantes », « journal des jets ») : ces tickets reprennent la première.

| Ticket | Contenu | Modèle | Dépend de |
|---|---|---|---|
| V3.1-89 | Données : qui lance, pour quel personnage, quel d20 est gardé | **Opus** | ADR 0038 (colonne partagée avec 22) |
| V3.1-90 | Noyau pur : histogramme, compteurs, titres (tests d'abord) | Sonnet | 89 (forme des données) |
| V3.1-91 | Service et volet : histogramme et titres sur l'accueil | Sonnet | 35, 89, 90 |
| V3.1-92 | Administration › Titres des joueurs : l'éditeur | Sonnet | 87, 89, 90 |

---

### ☐ V3.1-89 — Statistiques : attribuer chaque jet (données, ADR) · `M` — **prêt (Opus)**

**Modèle conseillé : Opus** — changement de schéma, quatre chemins
d'écriture, RLS d'une table temps réel.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Le problème** : `dice_rolls` ne dit pas **qui** a lancé (seulement
`rolled_by` : player, gm, ai, system) ni **pour quel personnage** ; `who`
est un nom affiché, instable (renommage, homonymes). Et avec avantage ou
désavantage, la trace porte les deux d20 sans dire lequel est gardé.

**Proposé (à trancher, ADR à l'appui)**
- **Qui a lancé** : `dice_rolls.rolled_by_user_id`, **déjà décidé par
  l'ADR 0038** (salon et jets secrets, V3.1-22) et posé par le serveur.
  Ne pas créer de seconde colonne : si V3.1-22 n'est pas encore fait, ce
  ticket ajoute cette colonne-là, sous ce nom, et V3.1-22 la réutilise.
- Migration nouvelle : `dice_rolls.entity_id uuid null references
  entities(id) on delete set null` ; index `(campaign_id, entity_id,
  created_at desc)`. Rempli par les quatre chemins d'écriture : l'entité du
  jet quand il y en a une — jet libre : l'entité réclamée par l'appelant
  dans la campagne, sinon null.
- `detail.naturalD20` (entier 1 à 20, ou absent sans d20) : **le d20
  gardé**, écrit au moment du jet par le serveur (règle 8). `detail.kind` :
  `attack`, `damage`, `check`, `save`, `spell`, `heal`, `free` — pour
  regrouper « l'action la plus utilisée » sans analyser du texte.
- **Jets anciens** (sans ces champs) : `entity_id` reste null ; on ne
  devine pas par le nom (homonymes). Ils sont **exclus** des statistiques
  personnelles (**confirmé par l'auteur le 9 octobre** : pas de rattrapage),
  et le volet le dit (« Statistiques depuis le … », date de la migration).
- **Les jets secrets ne comptent jamais** (décision de l'auteur, 9
  octobre) : `listRollsForStats` ne lit que les jets `visibility_level =
  'public'` — ni les jets cachés du MJ (`gm`), ni les jets secrets d'un
  joueur (`roller`, ADR 0038), **pas même pour leur auteur**. Même règle pour
  la moyenne de la table.
- RLS : inchangée en lecture. Les nouvelles colonnes ne s'écrivent que côté
  serveur.
- **Monnaie** : vérifier que les mouvements de monnaie (services de jeu,
  V3.1-24) créent encore une révision du bloc `inventory` ; si la monnaie a
  migré vers `entity_runtime_state`, `campaignEconomy.ts` ne la voit plus et
  il faut une autre source (journal de mouvements ou `session_events`).
  Trancher, et documenter dans l'ADR.
- **Les titres sont des données** (le superadmin les change, V3.1-92) :
  proposé, une table `player_title_tiers` (`family` parmi `luck`, `bad_luck`,
  `purse`, `favorite_action` ; `position` ; `range_from numeric`,
  `range_to numeric null` (null = sans borne) pour les trois premières ;
  `action_kind` pour la quatrième ; `name` ; `template` (petit texte à
  variables) ; `icon_key` parmi douze icônes **du code** ; `color_token`
  parmi `success`, `danger`, `accent`, `link_entity`, `link_rule`),
  globale à la plateforme. RLS : lecture pour tout compte connecté,
  écriture superadmin. Valeurs par défaut insérées par la migration
  **comme réglages**, pas comme contenu de règles. Zod valide `icon_key`,
  `color_token` et les variables du `template`.
- Contrat pour V3.1-90/91 : `listRollsForStats(campaignId, entityId,
  sinceSessionId?)` renvoie `{ naturalD20, kind, what, result, sessionId,
  createdAt }[]` (repo) ; `getPlayerEconomy(entityId, sinceSessionId?)`.

**Critères d'acceptation**
- [ ] ADR ; migration ; `docs/SCHEMA.md` ; types régénérés.
- [ ] Les quatre chemins écrivent `rolled_by_user_id`, `entity_id`,
  `naturalD20`, `kind` (tests d'intégration).
- [ ] Avantage : `naturalD20` = le plus haut des deux ; désavantage : le
  plus bas (test).
- [ ] Aucun jet `gm` ni `roller` n'apparaît dans `listRollsForStats`, même
  lu par son auteur (test).

---

### ☐ V3.1-90 — Statistiques : le noyau pur · `S` — **prêt**

**Modèle conseillé : Sonnet** — logique pure, **tests d'abord**
(`npm run test:core`).

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Fichier** : `src/core/stats/playerStats.ts` (+ `playerStats.test.ts`).
Rien de `next`, `react`, `@supabase` (règle 19). **Dépend de** : la forme
des données de V3.1-89.

**Ce qui est décidé**
- `d20Histogram(rolls)` : 20 compteurs, faces 1 à 20, sur `naturalD20`
  (le d20 **gardé**). Les nombres de 1 et de 20 affichés au-dessus des
  colonnes **sont** les colonnes 1 et 20 : un seul calcul. (Différence
  voulue avec `computeDiceStats`, qui compte un 20 dès qu'un des deux dés
  d'un avantage l'affiche : ici, les chiffres doivent égaler leurs barres —
  **règle validée par l'auteur le 9 octobre**.)
- `d20Average(rolls)` : moyenne des d20 gardés, arrondie au dixième ;
  `null` sans jet. `rollCount` : nombre de jets à d20.
- `longestStreak(rolls, face)` : la plus longue suite de jets consécutifs
  (ordre chronologique) donnant `face` — pour « dont 3 d'affilée ».
- `favoriteAction(rolls)` : le `kind` le plus fréquent (hors `damage` et
  `free`), avec son `what` le plus fréquent et le nombre ; égalité : le plus
  récent. `biggestHit(rolls)` : le plus grand `result` d'un jet `damage`.
- `familyMeasures(stats, tableStats)` → les trois mesures :
  **luck** = 20 de la joueuse ÷ moyenne des 20 des joueurs de la table ;
  **bad_luck** = même chose pour les 1 ; **purse** = dépensé ÷ gagné (en
  po ; gagné nul → mesure infinie). **favorite_action** = le `kind`
  favori (avec l'attaque sournoise distinguée de l'attaque d'arme).
- `pickTitle(tiers, measure)` : le palier dont `range_from ≤ mesure <
  range_to` (`range_to` null = sans borne) ; aucun palier → `null` (la case
  reste vide). Pour l'action favorite : le palier de son `action_kind`.
- `renderTemplate(template, values)` : remplace `{n20}`, `{table20}`,
  `{n1}`, `{suite}`, `{depense}`, `{gagne}`, `{action}`, `{fois}`,
  `{record}` ; une variable inconnue reste telle quelle. Pas d'`eval`, pas
  de HTML (texte brut).
- `checkTiers(tiers)` : chevauchements et trous de plages, pour
  l'avertissement de l'éditeur (V3.1-92).
- **Paliers par défaut** (insérés par V3.1-89) :
  - Chance : 0–0,8 « En attente d'un miracle » (étoile, ambre) ; 0,8–1,2
    « Bonne étoile » (trèfle, sarcelle) ; 1,2+ « Béni des dés » (d20,
    vert). Texte : « {n20} × 20 naturels — plus que toute la table »…
  - Malchance : 0–0,8 « Pied ferme » (bouclier, sarcelle) ; 0,8–1,2 « Ça
    arrive » (d20, ambre) ; 1,2+ « Chat noir » (chat, rouge), « {n1} × 1
    naturels, dont {suite} d'affilée ».
  - Bourse : 0–0,5 « Écureuil » (bourse, vert) ; 0,5–1 « Bon
    gestionnaire » (pièce, ambre) ; 1+ « Bourse percée » (bourse, rouge),
    « −{depense} po dépensées pour +{gagne} gagnées ».
  - Action favorite : attaque sournoise « Lame de l'ombre » (dague,
    violet), attaque d'arme « Bretteur » (épée), sort « Arcaniste »
    (baguette), soin « Main secourable » (cœur), test ou sauvegarde
    « Prudent » (bouclier) ; « {action}, ×{fois} ; record : {record}
    dégâts ».
- Moins de 5 jets à d20 : `playerTitles` renvoie `[]` et l'histogramme est
  marqué `tooFew` (le volet affiche un état vide).

**Critères d'acceptation**
- [ ] Tests écrits avant le code ; cas : aucun jet, avantage, désavantage,
  égalités, suite de 1, table d'une seule joueuse (moyenne = elle-même →
  `patient`, `steady`).
- [ ] Aucune valeur stockée : tout se recalcule (règle 16).

---

### ☐ V3.1-91 — Statistiques : le service et le volet de l'accueil · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Stats-Decide.dc.html` (ordinateur et téléphone).
**Départ** : `components/shell/DiceStatsPanel.tsx`, `HomeScreen.tsx`, le
volet de droite de l'accueil (`Accueil-3-Tableau.dc.html`, V3.1-35).
**Dépend de** : 35, 89, 90.

**Ce qui est décidé**
- **Service** `getPlayerStats({ campaignId, entityId, scope })` (`scope` :
  `campaign` ou `last_session`) : lit `listRollsForStats` et l'économie
  (V3.1-89), calcule la moyenne de la table (mêmes compteurs pour chaque PJ
  réclamé de la campagne, en une requête groupée), appelle le noyau
  (V3.1-90). Route `GET /api/campaigns/[campaignId]/player-stats?scope=…`,
  entrée validée par Zod ; la joueuse ne lit que **son** PJ réclamé.
- **Le volet** (remplace `DiceStatsPanel`), sous « Mon personnage » et
  « Prochaine séance » :
  - En-tête de section « Tes dés et tes titres » et, à droite, la pilule
    **« Cette campagne / Dernière séance »** (défaut : Cette campagne ; au
    téléphone, la pilule passe sous le titre, sans couper ses libellés).
  - **Carte de l'histogramme** : au-dessus des barres, **au centre** la
    moyenne en grand (« 11,4 », Outfit 800, ~26 px) et « 214 jets » en
    petit (12 px) à côté ; **au-dessus de la colonne du 1**, le nombre de 1
    en rouge (`--danger`), **au-dessus de la colonne du 20**, le nombre de
    20 en vert (`--success`), en taille intermédiaire (~17 px, Outfit 800) —
    une grille de 20 colonnes partagée par l'en-tête et les barres, pour que
    les chiffres tombent pile au-dessus de leur colonne. Barres : hauteur
    proportionnelle au compteur (hauteur max = hauteur de la zone : jamais
    une barre qui déborde sur son chiffre), colonne 1 rouge, colonne 20
    verte, les autres accent atténué ; graduations 1, 5, 10, 15, 20 dessous ;
    survol d'une barre : « 14 : 13 fois ».
  - **Quatre titres en 2 × 2** : pastille d'icône au trait teintée (vert
    pour la chance, rouge pour la malchance, accent pour la bourse, violet
    pour l'action), titre en gras, petit texte (V3.1-90).
  - « Rejoindre la partie » reste en bas du volet.
- **Sans défiler** : le volet tient dans la hauteur de l'accueil sur
  ordinateur (vérifier à 860 px de haut).
- **États** : moins de 5 jets → « Lance quelques dés : tes statistiques
  apparaîtront ici. » à la place de l'histogramme et des titres ; jets
  anciens non attribués → mention « Statistiques depuis le 9 octobre »
  (V3.1-89) ; erreur de chargement → message, jamais un `catch` muet.
- **Téléphone** : le même volet en feuille (Accueil › le monde) ;
  histogramme de 74 px de haut, titres resserrés, bouton sur toute la
  largeur.

**Critères d'acceptation**
- [ ] Les nombres de 1 et de 20 égalent la hauteur relative de leurs
  colonnes (même source).
- [ ] « Dernière séance » ne compte que les jets et mouvements de la
  dernière séance de la campagne.
- [ ] Aucun jet secret (MJ ou joueur, même les siens) n'entre dans les
  chiffres ; une joueuse ne voit jamais les statistiques d'un autre PJ.
- [ ] Ordinateur 1400 × 860 : volet sans défilement ; téléphone 390 px :
  aucun chiffre recouvert.
- [ ] `DiceStatsPanel` retiré (et ses routes si plus rien ne les lit).

---

### ☐ V3.1-92 — Administration › Titres des joueurs : l'éditeur · `M` — **prêt**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Admin-Decide.dc.html`, cinquième tuile « Titres des
joueurs » (vivante : familles, paliers, icônes, couleurs, valeur d'essai).
**Dépend de** : 87 (le tableau de bord), 89 (table `player_title_tiers`),
90 (`pickTitle`, `renderTemplate`, `checkTiers`).

**Ce qui est décidé**
- La tuile « Titres des joueurs » (icône d20, nombre de titres) ouvre le
  panneau : note « Les quatre cases du volet « Je joue ». Chaque case lit
  une mesure et affiche le titre du palier où elle tombe. Les changements
  valent pour tous les mondes, aussitôt enregistrés. »
- **Quatre familles** en boutons (Chance · les 20 naturels ; Malchance ·
  les 1 naturels ; Bourse · dépensé ÷ gagné ; Action favorite · ce qu'on
  fait le plus), puis « Mesure : » et sa phrase.
- **Une ligne par palier** : la pastille d'icône teintée (toucher ouvre un
  sélecteur : les douze icônes au trait en 6 × 2 et les cinq couleurs
  dessous) ; le **nom** ; la **plage** « de [0,8] à [1,2] » (vide = ∞,
  virgule décimale) — ou, pour l'action favorite, la sorte d'action ; le
  **petit texte** ; × pour retirer (jamais le dernier palier). Le palier où
  tombe la valeur d'essai est bordé d'accent.
- « + Ajouter un palier » (la nouvelle plage part de la fin de la
  précédente) ou « + Ajouter une action » ; les **variables** de la famille
  en étiquettes à côté.
- **Avertissement** (`checkTiers`) sous la liste quand des plages se
  chevauchent ou laissent un trou : « Plages à revoir : … Enregistrer reste
  possible ; une valeur hors plage n'affiche pas de titre. »
- **Aperçu** à droite : une **valeur d'essai** en curseur (« 1,4 × la
  table ») — l'action favorite s'essaie en touchant un palier — et la carte
  du titre telle que la joueuse la verra, avec des chiffres d'exemple.
  **Enregistrer** (« Enregistré ✓ ») et **« Rétablir les titres par
  défaut »** (confirmé).
- Écriture par une action serveur Zod, superadmin vérifié.
- Tablette et téléphone : les familles passent à la ligne ; chaque palier
  sur trois lignes (nom ; plage ; petit texte), l'aperçu sous la liste.

**Critères d'acceptation**
- [ ] Un changement enregistré se voit dans le volet « Je joue » de toutes
  les joueuses au rechargement.
- [ ] Une icône ou une couleur hors liste est refusée par le serveur.
- [ ] Le petit texte ne peut pas injecter de HTML (affiché en texte brut).
- [ ] Rétablir remet les paliers par défaut de V3.1-90.
