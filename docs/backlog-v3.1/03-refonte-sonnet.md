# Backlog V3.1 — Tickets de la refonte « verre minéral » prêts pour Sonnet (4 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage de V3.1-19, sur la base de l'ADR 0036 (données) et de l'esquisse
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm (planches citées par leur
titre). Ordre conseillé : 24, puis 25 à 36 dans l'ordre des dépendances ;
V3.1-20 (lot g) peut partir dès que 25 est fait.

**Règles communes à ces tickets** — à relire avant d'en prendre un :
- Lire `docs/CHARTE-UI.md` et la planche du catalogue concernée **avant**
  d'écrire ; réutiliser ce qui existe ; mettre la planche à jour avec le code.
- Un écran n'est fini que s'il marche à **390 px**, à 820 px (tablette) et
  sur ordinateur, dans les quatre modes et en contraste élevé.
- Mouvement : chaque animation est sautée sous `prefers-reduced-motion`.
- Aucun calcul de règle côté client ; aucune donnée cachée envoyée au client.
- Ce qui n'est pas dans le ticket n'est pas fait : un manque trouvé en
  route s'écrit dans ce backlog, il ne s'ajoute pas au ticket.
- Fini quand `npm run typecheck && npm run lint && npm run test` passent.

---

### ☐ V3.1-24 — Les services de jeu sous la refonte · `M` — **prêt**

**Modèle conseillé : Sonnet** — décisions toutes prises dans l'ADR 0036 ; noyau pur, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

Fondation des tickets 32, 33 et 34. Aucune interface.

**À faire**
1. `src/core/rules/deathSaves.ts` (tests d'abord) : les règles 2024 de
   l'ADR 0036 §8 — Inconscient à 0 PV, mort directe si les dégâts restants
   atteignent les PV max, un échec par coup à 0 PV (deux au critique), jet
   (10+ réussit, 1 = deux échecs, 20 = 1 PV), trois réussites stabilisé,
   trois échecs mort, tout soin remet à zéro et retire Inconscient.
   `changeHp` et les dégâts résolus l'appliquent.
2. Concentration (ADR 0036 §3) : champ `concentration` dans `zRuntimeState`
   (`.default(null)`, test de relecture d'une ligne ancienne comme pour
   `inspiration`) ; `castSpell` la pose pour un sort de concentration et
   remplace la précédente ; service `breakConcentration` ; synchronisation
   avec `combat_participants.concentration` comme les états ; l'état
   `concentrating` des déclencheurs est dérivé de ce champ.
3. Monnaie et équipement (ADR 0036 §1) : services `changeCurrency`
   (delta par pièce, `depositCoins` / `spendCoins`, refus si le total ne
   suffit pas) et `setItemEquipped`. **Électrum exclu du regroupement**
   (décision du 4 octobre) : `recompose` ne forme jamais de pe ; l'électrum
   déjà détenu reste tel quel et ne se casse que si le reste ne suffit pas
   — tests d’abord dans `currency.test.ts`. Écriture du bloc `inventory` avec
   contrôle de version ; routes Zod. `InventoryPanel` les utilise à la place
   du renvoi du bloc entier.
4. Repos (ADR 0036 §7) : `takeShortRest` / `takeLongRest` émettent
   `short_rest` / `long_rest` dans `runTriggers` après leurs effets de base.
   **Fait le 9 octobre avec V3.1-5 (ADR 0050).** Reste le test d'intégration
   du critère ci-dessous.
5. **PV temporaires** (vérifié le 4 octobre) : ils sont stockés (`hp.temp`,
   `combat_participants.temp_hp`) et le tour solo les entame d'abord
   (`applyDamage`, `src/core/rules/turn.ts`), mais `changeHp` (fiche) les
   ignore et aucune commande ne permet d'en donner. `changeHp` négatif passe
   par la même règle que `applyDamage` ; nouveau service `changeTempHp`
   (les PV temporaires ne se cumulent pas : en 2024, on choisit de garder
   les anciens ou de prendre les nouveaux — l'interface propose le plus
   grand par défaut).

**Critères d'acceptation**
- [ ] Les cas de jets contre la mort ci-dessus, chacun un test du noyau.
- [ ] Une fiche enregistrée avant ce ticket se relit sans `concentration` (test).
- [ ] Dépenser 3 po avec 1 pp et 0 po rend la monnaie ; dépenser plus que le total est refusé sans rien écrire.
- [ ] Ajouter 5 pa à 0 pa ne forme pas d'électrum ; 2 pe détenues restent 2 pe après un dépôt.
- [ ] Un repos long émet `long_rest` (test d'intégration avec un déclencheur factice).
- [ ] −7 PV sur 15/15 avec 5 temporaires laisse 13/15 et 0 temporaire (test).
- [ ] Aucune migration SQL.

---

### ☐ V3.1-25 — La pilule glissante remplace `BinderTabs` · `S` — **prêt**

**Modèle conseillé : Sonnet** — composant décidé (ADR 0034), usages listés.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; recenser les usages à remplacer avant de coder, puis vérifier qu'il n'en reste aucun ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `components/shared/BinderTabs.tsx`.

Un composant d'onglets unique : fond qui glisse sous l'onglet actif (260 ms,
sauté sous mouvement réduit), clavier (flèches, Début, Fin), rôles ARIA
`tablist` / `tab` / `tabpanel`. Il remplace `BinderTabs` partout : fiche
jouable, fiche solo, colonne Monde et coquille du solo, aperçu du créateur.
Sur téléphone, la pilule défile horizontalement si elle déborde.

**Critères d'acceptation**
- [ ] Plus aucun import de `BinderTabs` ; le fichier est supprimé.
- [ ] Clavier et lecteur d'écran : un test de composant.
- [ ] Charte §3 et planche 3 du catalogue mises à jour.

---

### ☐ V3.1-26 — Fiche d'ordinateur à jauges et commande E · `M` — **prêt**

**Modèle conseillé : Sonnet** — interface esquissée, services existants.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** (zone « Fiche de personnage ») : « Décidé · fiche sur
ordinateur, vivante et déroulée partie par partie », « Décidé · jauge à
commandes (option E) ». **Départ** :
`CharacterSheetHeader.tsx`, `JaugeCirculaire` (`FicheJouableEnTete.tsx`).
**Dépend de** : 25.

- Bouclier de CA ; jauges circulaires PV (temporaires d'abord), niveau / XP,
  épuisement (0 à 6), chacune avec la commande E : ▲, champ d'écart, ▼ —
  champ vide = ±1, champ rempli = ce nombre puis le champ se vide.
- Bornes : PV et épuisement plafonnés ; XP sans plafond.
- Constantes en badges (initiative, vitesse, maîtrise) ; Inspiration au
  gabarit exact d'un badge (72 × 56 px), même taille de chiffre, ▲▼ intégrés.
- Les onglets de la fiche en pilule (25).
- Les commandes appellent les services existants (`changeHp`, `changeXp`,
  `changeExhaustion`, `changeInspiration`) ; aucune valeur posée par le client.

**Critères d'acceptation**
- [ ] Les quatre jauges et l'inspiration conformes à la planche, aux quatre modes.
- [ ] Commande E : ±1 champ vide, ±N champ rempli, champ vidé après usage.
- [ ] Un composant `CommandeE` réutilisable (il resservira en 32 et 34), avec sa planche au catalogue.

---

### ☐ V3.1-27 — Rail repliable et dalle Outils (lots a, b) · `M` — **prêt**

**Modèle conseillé : Sonnet** — mesures et comportements donnés par V3.1-19.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : MJ et joueur, ordinateur et tablette. **Départ** :
`Sidebar.tsx`, `MjSidebar.tsx`, `PlayerShell.tsx`, `RadioWidget.tsx`,
`ChromePill.tsx`, `DiceRollPanel.tsx`.

- Rail flottant, coins arrondis : 204 px déployé ↔ 64 px replié
  (`width 380ms cubic-bezier(.4,0,.2,1)`), libellés qui s'effacent ;
  poignée en onglet 16 × 44 px sur le bord droit ; replié, l'arborescence
  s'ouvre en menu flottant au survol et au clavier. Listes :
  `overflow-y: auto` et `overflow-x: hidden`. État replié mémorisé dans le
  navigateur (`localStorage` protégé).
- Dalle « Outils » en bas du rail : le dé s'y encoche (48 px, anneau de 6 px
  couleur du panneau) et ouvre le panneau de dés existant ; la radio y
  passe, visible rail replié, point vert en lecture / rouge à l'arrêt.
  L'horloge n'est pas reprise.
- Au-dessous de 768 px, le rail n'existe pas (le téléphone est 29).

**Critères d'acceptation**
- [ ] Déplier / replier à la souris et au clavier ; état gardé au rechargement.
- [ ] Radio et dé utilisables rail replié.
- [ ] Planches « Pastille chrome », « Bouton de dés », « Rail du joueur » mises à jour ; planche « Rail repliable » créée.

---

### ☐ V3.1-28 — Tablette : la fiche s'adapte à sa fenêtre (lot f) · `S` — **prêt**

**Modèle conseillé : Sonnet** — règle simple, planche à trois largeurs.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · fiche sur tablette : elle suit la largeur de sa
fenêtre (piste B) » (zone « Fiche de personnage » ; la fiche y prend, sous
~640 px, la disposition du téléphone). **Dépend de** : 26.

La fiche lit la largeur de **sa** fenêtre (requête de conteneur CSS, pas
la largeur de l'écran) : sous ~640 px, les six caractéristiques passent en
ligne au-dessus des onglets.

**Critères d'acceptation**
- [ ] La même fiche à 960, 680 et 540 px de fenêtre, conforme à la planche.
- [ ] Aucune lecture de `window.innerWidth` pour cette règle.

---

### ☐ V3.1-29 — Coquille téléphone : barre flottante et feuilles du bas (lot c) · `L` — **prêt**

**Modèle conseillé : Sonnet** — entrées, gabarits et comportements fixés par les planches.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » et « — feuilles
ouvertes », mêmes planches côté joueur. **Départ** : `PlayerShell.tsx`,
`AppShell.tsx`, `useMatchMedia.ts`. **Dépend de** : 27 (dalle Outils).

- Sous 768 px : barre du bas flottante à six entrées, dé encoché au centre.
  MJ : Monde, Règles, Fiches | Table, Chat, Outils. Joueur : Perso.,
  Édition, Notes | Wiki, Règles, Chat. Toucher de nouveau une entrée active
  ramène à son écran d'accueil.
- Un composant « feuille du bas » unique (poignée, glisser pour fermer,
  piège du focus, Échap) : tout ce qui s'ouvre vient du bas.
- **Fiches** (MJ) : une fiche à la fois, pastille « N fiches » qui ouvre la
  pile en feuille, même adresse `?avec=`.
- **Outils** (MJ) : grille par moment (séance, préparation, campagne),
  radio comprise ; le chat n'y est plus.
- Écrans Table, Wiki, Règles, Édition, dés : des emplacements, remplis par
  30, 31, 33 et 34.

**Critères d'acceptation**
- [ ] Les deux barres conformes aux planches à 390 px ; aucune page à défilement horizontal.
- [ ] Feuille du bas : clavier, lecteur d'écran, glisser pour fermer.
- [ ] Au-dessus de 768 px, rien ne change.
- [ ] Planche « Tiroir » remplacée par « Feuille du bas » ; planche « Barre flottante » créée.

---

### ☐ V3.1-30 — Wiki et Règles sur téléphone : ☰ et consultées récemment · `M` — **prêt**

**Modèle conseillé : Sonnet** — parcours esquissé ; stockage tranché (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : téléphones MJ et joueur, écrans Monde / Wiki / Règles et
leurs feuilles. **Départ** : `BookSkin.tsx`, `TwoPaneReaderLayout.tsx`,
`PlayerRulesSidebar.tsx`. **Dépend de** : 29.

- Toucher Monde / Wiki / Règles ouvre un écran d'accueil : recherche,
  bouton ☰ (sommaire complet, types repliables, PJ déplié par défaut) et
  la liste des fiches consultées récemment.
- Une fiche choisie s'affiche dans la peau actuelle (`BookSkin`), ☰ en
  haut à gauche ; le tiroir commence lui aussi par « Récemment ».
- « Récemment » vit dans le navigateur (identifiants et titres seulement,
  20 au plus, par monde) ; une fiche devenue invisible n'est pas affichée
  (le serveur répond à l'ouverture).
- Côté MJ : « + » nouvelle entité, passages MJ en orange, crayon vers
  l'éditeur (31). Règles : même parcours, la règle en page.

**Critères d'acceptation**
- [ ] Le parcours accueil → fiche → retour, pour le MJ et le joueur.
- [ ] Le joueur ne reçoit jamais un passage MJ (test serveur existant toujours vert).
- [ ] Navigation privée ou stockage bloqué : la liste est vide, rien ne casse.

---

### ☐ V3.1-31 — Éditeur plein écran en accordéon (téléphone) · `M` — **prêt**

**Modèle conseillé : Sonnet** — option A tranchée et esquissée.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · téléphone du MJ — plein écran et infobulles ».
**Dépend de** : 29.

Plein écran, barre flottante masquée, « Annuler » / « Enregistrer » en
haut. Tous les blocs dans la page, repliés en une ligne de résumé, un seul
ouvert à la fois ; poignée ⠿ pour réordonner (aussi au clavier) ; « + bloc »
en bas. Le joueur a le même éditeur, limité à ses droits (`canEditEntity`).
Les éditeurs de blocs existants sont réutilisés tels quels à l'intérieur.

**Critères d'acceptation**
- [ ] Ouvrir, modifier deux blocs, réordonner, enregistrer : une seule écriture, contrôle de version compris.
- [ ] Annuler avec des changements demande confirmation.
- [ ] Un joueur ne voit pas les blocs qu'il ne peut pas modifier.

---

### ☐ V3.1-32 — Fiche sur téléphone : jets, infobulles de règles, sac · `L` — **prêt**

**Modèle conseillé : Sonnet** — fiche entièrement esquissée ; services fournis par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · fiche sur téléphone, vivante et déroulée partie
par partie », « Décidé · fiche en combat », téléphone du joueur (trois
planches). **Dépend de** : 24, 26, 29.

- Ordre de la sous-planche : en-tête, bouclier CA et jauges PV, niveau,
  épuisement (commande E de 26), constantes, perception passive, dés de vie,
  concentration, états, six caractéristiques, compétences repliables, puis
  la pilule des cinq onglets collée en haut au défilement.
- Boutons de jet : chaque case de caractéristique a deux boutons (haut :
  test, bas : sauvegarde) ; une compétence se touche ; initiative, attaque
  de sort, bonus de touche et dégâts sont des boutons. Tous ouvrent l'outil
  de dés pré-rempli (33) — en attendant 33, ils appellent le chemin actuel.
- Infobulles de règles : tout nom d'arme, sort, objet, aptitude, action,
  état, la concentration et l'épuisement ouvrent leur règle en feuille du
  bas (« Ouvrir dans Règles ») — partir de `useOpenRuleLink`. Même contenu
  en fenêtre sur ordinateur.
- Inventaire : « Équipé » / « Au sac » par objet (`setItemEquipped`, 24) ;
  la charge se recalcule.
- À 0 PV, les jauges cèdent la place aux jets contre la mort (24).

**Critères d'acceptation**
- [ ] La fiche de Candide de la sous-planche, reproduite à 390 px.
- [ ] Chaque type de nom ouvre la bonne règle, joueur et MJ.
- [ ] À 0 PV : jets contre la mort, puis stabilisé ou mort selon 24.

---

### ☐ V3.1-33 — L'outil de dés unique (feuille, panneau, scintillement) · `L` — **prêt**

**Modèle conseillé : Sonnet** — ADR 0035, ADR 0036 §6, planches précises ; la cible reste à V3.1-21.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : téléphones (feuille des dés), « Décidé · outil de dés sur
ordinateur et tablette », « Décidé · le jet en animation » (l'outil réel,
issue du d20 forçable : réussite, échec, critique). C'est le même gabarit
sur toutes les planches qui ont un outil de dés (zone « Fiche de
personnage » entière, six téléphones MJ et joueur, trois téléphones solo,
outil de dés sur ordinateur, Initiative).
**Départ** : `DiceRollPanel.tsx`, `POST /api/campaigns/[id]/dice-rolls`.
**Dépend de** : 29.

- Point d'entrée serveur étendu (Zod) : dés, **modificateur**, **avantage /
  désavantage**, **libellé**, secret. Le serveur lance ; avec avantage, il
  renvoie les deux d20 et lequel est retenu.
- Une seule interface : feuille du bas sur téléphone (hauteur de la feuille
  Outils), panneau ancré au dé du rail sur ordinateur et tablette. Dés d4 à
  d100 empilables avec compteur ; modificateur dans la case sous le d10
  (commande E) ; pilule Normal / Avantage / Désavantage ; une ligne
  **Cibler · Lancer · Effacer** — Cibler grisé tant que V3.1-21 n'est pas
  livré.
- Résultat : chaque dé (max en ambre, 1 en rouge) ; avantage : paire
  étiquetée, d20 retenu cerclé d'ambre, l'autre effacé. Derniers jets (30)
  qui défilent avec l'ascenseur fin de `globals.css`.
- Animation scintillement : les chiffres défilent flous puis se figent un
  par un, le total compte jusqu'à sa valeur ; elle couvre l'attente du
  serveur ; chiffres décoratifs seulement ; mouvement réduit → résultat
  immédiat.
- API de pré-remplissage utilisée par la fiche (32), la Table (34) et le
  solo (36) : `openDiceTool({ dice, modifier, label, advantage? })`.
- **Revu le 4 octobre (lot i)** :
  - **Un seul gabarit, toujours le même** : seule la présélection change
    selon le bouton touché ; son nom s'affiche en titre (« Dague — touche »).
    Ouvert depuis le dé, sans bouton : « **Jet libre** ».
  - **Secret** : interrupteur dans l'en-tête de l'outil (il existait dans
    `DiceRollPanel` et manquait à l'esquisse). Un jet secret n'est vu que de
    son auteur et du MJ ; les jets d'un monstre sont secrets par défaut.
  - **DD** (retour de l'auteur, 4 octobre : l'outil en ligne, `DiceRollPanel`,
    l'a déjà et l'esquisse l'avait perdu) : une ligne DD sous la grille —
    ▼ valeur ▲, vide = pas de DD — et, pour le MJ seul, **« DD privé »** :
    le joueur voit « contre DD ? », jamais la valeur. Le « Lancé public » de
    l'outil en ligne devient l'interrupteur Secret.
  - **Verdict, dans la case du résultat** (aucune place en plus) : il ne
    s'affiche que s'il y a quelque chose à battre — une CA (attaque), un DD
    (test, sauvegarde). Réussite en vert, **échec en rouge**, **critique en
    or lumineux**. Animation **tranchée le 4 octobre : B, la case se
    remplit** — la couleur du verdict envahit la case de gauche à droite
    puis se pose en teinte légère derrière le résultat (planche « Décidé ·
    verdict d'un jet ») ; mouvement réduit : la teinte seule. Le même outil
    servant partout, le verdict est le même partout.
  - **Zone de résultat permanente** (4 octobre) : elle est toujours là,
    même avant le premier jet — « — » et **un carré vide par dé** du
    prochain lancer (deux pour un d20 avec avantage), qui se remplissent au
    lancer. Sur téléphone, la feuille des dés monte plus haut pour la
    loger. Sa hauteur ne change jamais.
  - **« Lancer les dégâts » dans la zone de résultat — tranché le 4
    octobre : la bande du bas** (sur quatre propositions, les autres
    retirées de l'esquisse). Une bande fine au pied de la zone, dont la
    place est **toujours réservée** (la hauteur ne bouge jamais) :
    - **invisible** s'il n'y a rien à battre (ni cible, ni DD) ou pas de
      suite ;
    - avant le jet : rien (revu le 4 octobre : la bande n'annonçait la suite
      que pour s'effacer sur un raté — elle n'apparaît plus que sur une
      réussite suivie de dégâts) ;
    - **touché** : toute la bande devient le bouton « Lancer les dégâts » ;
      côté MJ, un monstre qui touche un joueur donne « Valider · dégâts » /
      « Faire échouer » ;
    - **raté** : pas de bande du tout ;
    - **dégâts lancés depuis la bande** : la partie du dessus rejoue le
      scintillement avec les dés de dégâts, **sans remplissage** (un jet de
      dégâts ne réussit ni n'échoue) ; à la place du verdict, l'effet
      (« Worg −3 PV », « Tharnok +7 PV ») ; la bande disparaît.
    Les détails (« contre CA 13 », « JS Force : raté — À terre ») restent
    en lignes sous la zone.
  - **Enchaînement** : « Touché » /
    « Raté » (ou « Résiste » / « Pas résisté ») puis le bouton suivant. Si l'attaque réussit, le bouton « **Lancer les
    dégâts · 1d4 + 2** » apparaît : un toucher lance les bons dés sur la
    même cible et les dégâts s'appliquent seuls.
  - **Critique** : un 20 naturel touche toujours et double les **dés** de
    dégâts, pas le modificateur (1d4+2 → 2d4+2) ; un 1 naturel rate
    toujours. Règle 2024, déjà dans l'outil.
  - **Validation du MJ** : quand un monstre touche un joueur, l'outil du MJ
    s'arrête sur « Valider la touche » / « Faire échouer » avant les dégâts.
  - **Limites relevées, tranchées avec l'auteur, à traiter dans V3.1-21** :
    - **bonus après la touche** : l'outil **lit la fiche du lanceur** et
      propose ce qui est disponible à ce moment (Attaque sournoise si l'arme
      et la situation la permettent et qu'elle n'a pas servi ce tour,
      Châtiment divin s'il reste un emplacement, Inspiration bardique
      reçue…) ; le joueur coche, les dés s'ajoutent avant le lancer ;
    - **réactions** : en 2024, Bouclier est une **réaction prise quand on
      est touché** (+5 CA, y compris contre l'attaque qui la déclenche) —
      elle se joue donc **après** le « Touché », avant les dégâts. Il faut
      une courte fenêtre de réaction côté cible ; si elle fait passer la CA
      au-dessus du jet, la touche devient un raté ;
    - **résistances, immunités, vulnérabilités** de la cible appliquées par
      le moteur, et **JS de concentration** déclenché quand une cible
      concentrée subit des dégâts (DD 10 ou moitié des dégâts, au plus 30) ;
    - **zones** : le lanceur choisit **plusieurs cibles** dans « Cibler » ;
      un jet de sauvegarde par cible, dégâts lancés une fois.

**Critères d'acceptation**
- [ ] Jet avec avantage : deux d20 affichés, seul le retenu dans le total et les derniers jets.
- [ ] Le client n'envoie jamais un résultat (test de la route).
- [ ] Même outil sur téléphone, tablette et ordinateur.
- [ ] Titre : le nom du bouton touché, ou « Jet libre » ; Secret dans l'en-tête ; DD sous la grille, « DD privé » pour le MJ (le joueur lit « contre DD ? »).
- [ ] Zone de résultat toujours visible, hauteur fixe : « — » et un carré vide par dé du prochain jet avant le lancer.
- [ ] Verdict seulement contre une CA ou un DD, en remplissage de la case : vert, rouge, or au 20 naturel ; mouvement réduit : teinte sans mouvement.
- [ ] Bande « Lancer les dégâts » seulement sur une réussite suivie de dégâts ; le jet de dégâts s'applique à la cible et affiche l'effet à la place du verdict, sans remplissage.
- [ ] Monstre qui touche un joueur : « Valider · dégâts » / « Faire échouer » côté MJ.
- [ ] Bande d'après-jet (décision A du 5 octobre, V3.1-19) : sur un d20 raté de son personnage, Relancer (Inspiration héroïque), Avantage (Chanceux), + d6 (Inspiration bardique reçue) selon ce que la fiche possède ; une fois par jet ; le point est retiré côté serveur et le nouveau jet est lancé par le serveur ; rien sur une réussite.

---

### ☐ V3.1-34 — L'outil Table du MJ · `L` — **prêt**

**Modèle conseillé : Sonnet** — tout est esquissé ; données et règles fournies par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » (Table) et « —
feuilles ouvertes » (Toute la table). **Départ** : `mjToolWindows.ts`,
`MjToolWindowContent.tsx` (un outil de plus dans la liste). **Dépend de** :
24, 26 (commande E), 29, 33.

- Une ligne par PJ de la campagne : nom + niveau ; dessous « joueur · CA ·
  PV » puis la ligne des états ; à droite classe et sous-classe. Toucher
  déplie.
- Déplié — **revu le 5 octobre** (alignement sur la fiche et la carte de
  l'ordinateur) : la ligne dépliée **est** le haut de la fiche du téléphone,
  même composant que la carte de l'ordinateur — bouclier de CA ; PV
  (temporaires par-dessus), niveau et XP, épuisement, chacun avec la
  commande E ; initiative, vitesse, maîtrise, inspiration ▲▼ ; Perception
  passive, dés de vie ▲▼, états · concentration (× retire ou rompt, « + »
  ouvre les états du ruleset en feuille), repos court et long du PJ ; « Ce
  qui se dépense » en groupes ; charge et pièces avec commande E
  (`changeCurrency`, un message dit le change fait). Aucune commande sur
  CA, initiative, vitesse, maîtrise, Perception passive. La ligne repliée ne
  change pas.
- À 0 PV, la ligne se transforme : fond rouge, « Contre la mort »,
  trois réussites / trois échecs, « Soigner +1 PV » (règles de 24).
- « Toute la table » : + XP, ± pièces, repos court, repos long — chacun en
  feuille avec « Pour qui » ; XP et pièces à partager ou à chacun, aperçu par
  PJ, qui monte de niveau est signalé ; les repos passent par
  `takeShortRest` / `takeLongRest` pour chaque PJ coché.
- Chaque geste passe par le même service que la fiche (même journal) ; le
  MJ a toutes les commandes. Sur ordinateur : fenêtre d'outil MJ, ascenseur
  fin ; sur téléphone : `no-scrollbar`.
- **Ordinateur et tablette — décidé le 5 octobre** (planche « Décidé ·
  outil Table ») : une carte par PJ, qui **est** le haut de la fiche
  (composant partagé avec V3.1-26 / V3.1-32, en mode MJ), plus la charge et
  les pièces ; ▲▼ sur les dés de vie ; aucune commande sur CA, initiative,
  vitesse, maîtrise, Perception passive (valeurs dérivées). Deux cartes par
  rangée, une seule dans un volet partagé ou sur tablette.

**Critères d'acceptation**
- [ ] Les gestes de la planche, chacun journalisé une fois.
- [ ] Partage de 10 po entre trois PJ : 3 po chacun, le reste affiché.
- [ ] Un repos long sur trois PJ : trois résultats, trois événements `long_rest`.
- [ ] Ordinateur : la carte réutilise le composant du haut de fiche, sans le dupliquer.

---

### ☐ V3.1-35 — Accueil en tableau de bord (lot h) · `M` — **prêt**

**Modèle conseillé : Sonnet** — proposition 3 tranchée ; « Reprendre » rangé dans le navigateur (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `HomeShell.tsx`, `HomeScreen.tsx`,
`CampaignsPanel.tsx`. **Dépend de** : 25, 27.

- Rail du joueur : Mondes, Compte, Administration (superadmin seulement),
  Déconnexion en pied ; dalle Outils avec les dés seuls.
- En haut : prochaines séances de tous les mondes ; « Reprendre » sur la
  dernière visite (mémorisée dans le navigateur).
- Bouton « Nouveau monde » agrandi, à gauche : Mener une partie, Jouer en
  solo, Rejoindre une table (coller un lien d'invitation).
- Colonnes « Je mène » (+ « En solo ») et « Je joue » sur une même ligne de
  titres ; panneau du monde choisi à droite, avec les outils du **rôle tenu
  dans ce monde**.
- Téléphone : pilule Je mène / Je joue / Solo, le monde en feuille,
  « Nouveau monde » en grand bouton.

**Critères d'acceptation**
- [ ] Un compte MJ dans un monde et joueur dans un autre voit les bons outils pour chacun.
- [ ] « Rejoindre une table » accepte un lien d'invitation valide et refuse un lien invalide, sans rien créer.
- [ ] « Reprendre » absent si rien n'est mémorisé.

---

### ☐ V3.1-36 — Le solo : ailes d'ordinateur et téléphone modèle A (lot d) · `L` — **prêt**

**Modèle conseillé : Sonnet** — planches définitives ; le moteur solo ne change pas.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Solo-Desktop » ; « Décidé · solo sur téléphone (modèle A) »
(trois planches). **Départ** : `SoloShell.tsx`, `IntentBar.tsx`,
`ScenePanel`, `ConsequencesDrawer`. **Dépend de** : 29, 32, 33.

- Ordinateur : poignées de repli sur les bords de la fenêtre du Jeu ; Monde
  disparaît replié ; la Fiche repliée devient une bande de 96 px — bouclier
  CA, PV, Niveau, Charge.
- Téléphone : barre Jeu, Monde, Fiche | Quêtes, Règles, Notes, dé encoché.
  Monde = wiki du joueur avec « Présents dans la scène » en tête, puis
  récents (Quêtes et Règles n'y sont plus). Jeu : bandeau lieu / heure,
  bande de jauges, fil, barre d'intention ; ✦ ouvre la feuille des
  conséquences. Fiche : la fiche de 32. Quêtes : pilule En cours /
  Terminées, une quête en feuille avec ses étapes. Notes : Les miennes /
  Journal de partie.
- « Jouer » ouvre l'outil de dés pré-rempli (33) ; « Lancer » confirme, le
  tour suit le chemin actuel de V3-B5.

**Critères d'acceptation**
- [ ] Un tour complet sur téléphone : intention, outil de dés, Lancer, le tour dans le fil.
- [ ] Aucun changement du moteur de tour (tests solo existants verts sans modification).

---

### ☐ V3.1-38 — L'outil Initiative refondu, MJ et joueur · `L` — **prêt après V3.1-37**

**Modèle conseillé : Sonnet** — planche définitive, données fournies par V3.1-37.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · initiative (A retouchée) ». **Départ** :
`components/shell/InitiativeTracker.tsx`, `app/m/[worldSlug]/mj/initiative/page.tsx`.
**Dépend de** : V3.1-37, V3.1-24 (PV temporaires), V3.1-26 (jauges),
V3.1-29 (téléphone), V3.1-33 (outil de dés).

- MJ, ordinateur et téléphone : tout le détail de la décision (V3.1-19,
  lot i) — colonnes CA / PV alignées, score modifiable qui réordonne,
  lignes dépliables avec toutes les actions en deux boutons (touche,
  dégâts), PV temporaires, renommage avec le nom d'origine en petit,
  menace restante, Commencer / Round 1 / fin confirmée.
- Joueur : invitation au premier plan (lancer, ou vrai dé avec
  l'interrupteur « modificateur inclus »), mode combat dans Perso. (ordre,
  économie d'action, Actions · Sorts · Capacités), retour à la fiche
  normale à la fin.

**Critères d'acceptation**
- [ ] Le parcours de la planche, de « Commencer » à la fin confirmée, avec un MJ et deux joueurs (dont un sans l'application).
- [ ] « Quitter le combat » puis « Reprendre tel quel » : ordre, PV et états intacts ; « Recommencer » relance l'initiative et renvoie l'invitation.
- [ ] Côté joueur, le mode combat garde la fiche complète (même composant que hors combat), l'ordre du tour en tête.
- [ ] Un dégât porté depuis la fiche du joueur se voit aussitôt dans l'initiative du MJ, et inversement (même état de jeu).
- [ ] À 390 px et sur ordinateur, côté MJ et côté joueur.
- [ ] Planche du catalogue « Initiative » créée ou mise à jour.
