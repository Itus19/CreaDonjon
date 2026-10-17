

---

### ☑ V3.1-27 — Rail repliable et dalle Outils (lots a, b) · `M` · sans modèle IA — **fait le 17 octobre**

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
- [x] Déplier / replier à la souris et au clavier ; état gardé au rechargement.
- [x] Radio et dé utilisables rail replié.
- [x] Planches « Pastille chrome », « Bouton de dés », « Rail du joueur » mises à jour ; planche « Rail repliable » créée.

**Clôture** : `components/shell/Rail.tsx` (rail, lignes, menu flottant en portail, dalle Outils) sert les quatre rails (Monde, Règles, MJ, joueur) ; un seul arbre DOM par barre, sous 768 px tiroir et barre du bas inchangés. État replié dans `localStorage` (`creadonjon:rail:replie`, `lib/ui/rail.ts`) lu par `useSyncExternalStore` : changer de section ne rejoue pas l'animation. Le dé de la dalle ouvre le volet existant (`ouvrirVolet`) ; le bouton flottant ne se cache que tant qu'une dalle est montée (une page sans rail garde son dé). Radio du rail : point vert en lecture, rouge à l'arrêt ; `ChromePill` retirée en vue ordinateur, horloge non reprise. Vérifié dans le navigateur (MJ Monde/MJ/Règles, joueur, 390 px). Écarts : les menus repliés lisent l'arbre du chargement de la page (un duplicata n'y paraît qu'à la navigation suivante) ; Règles repliées : une ligne pointillée regroupe « Ajouter une règle » et les bacs à sable.

---

### ☑ V3.1-28 — Tablette : la fiche s'adapte à sa fenêtre (lot f) · `S` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — règle simple, planche à trois largeurs.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · fiche sur tablette : elle suit la largeur de sa
fenêtre (piste B) » (zone « Fiche de personnage » ; la fiche y prend, sous
~640 px, la disposition du téléphone). **Dépend de** : 26.

La fiche lit la largeur de **sa** fenêtre (requête de conteneur CSS, pas
la largeur de l'écran) : sous ~640 px, les six caractéristiques passent en
ligne au-dessus des onglets.

**Critères d'acceptation**
- [x] La même fiche à 960, 680 et 540 px de fenêtre, conforme à la planche.
- [x] Aucune lecture de `window.innerWidth` pour cette règle.

**Clôture** : `@container` sur la fiche entière (`PlayableCharacterSheet.tsx`), variantes `@min-[40rem]:` à la place de `md:` (y compris le filet de l'en-tête). Vérifié dans le navigateur à 960, 680 (colonne de gauche) et 540 px (six tuiles en ligne, aucun défilement horizontal). Fait par Opus, sans délégation : quatre classes.

---

### ☑ V3.1-26 — Fiche d'ordinateur à jauges et commande E · `M` · sans modèle IA — **fait le 17 octobre**

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
- [x] Les quatre jauges et l'inspiration conformes à la planche, aux quatre modes.
- [x] Commande E : ±1 champ vide, ±N champ rempli, champ vidé après usage.
- [x] Un composant `CommandeE` réutilisable (il resservira en 32 et 34), avec sa planche au catalogue.
- [x] Jamais de valeur provisoire fausse (CA 11, PV 0/0) ni de clé technique d'objet pendant le chargement de la fiche ; vitesses au format français, arrondies au mètre (« 9 m ») (vu par la vérification du 11 octobre). Le 13 octobre, la même CA provisoire provoque une erreur d'hydratation de React : le serveur rend 11, le navigateur 16 quand les règles sont déjà en cache.

**Clôture** : `CommandeE` (`components/shared/CommandeE.tsx`, écart seul, règles dans `lib/ui/commandeE.ts`, testées) porte PV, niveau/XP et épuisement ; bouclier de CA, badges, Inspiration 72 × 56 ; squelette sans chiffre tant que les règles et l'état de jeu ne sont pas arrivés (`useResolvedRuleset` part toujours de vide : plus d'erreur d'hydratation) ; vitesse au mètre. Vérifié dans le navigateur (Banc d'essai, chargement froid et chaud, écart 2 puis ±1). Planche « Jauge à commandes » dans `Fiche.dc.html`.

---

### ☑ V3.1-25 — La pilule glissante remplace `BinderTabs` · `S` · sans modèle IA — **fait le 17 octobre (ADR 0034)**

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
- [x] Plus aucun import de `BinderTabs` ; le fichier est supprimé.
- [x] Clavier et lecteur d'écran : un test de composant.
- [x] Charte §3 et planche 3 du catalogue mises à jour.

**Réalisé** (délégué à `dev-sonnet`, planche à `aide-haiku`, relu par Opus)
- `components/shared/Tabs.tsx` : pilule glissante, fond positionné d'après l'onglet actif mesuré (suit le défilement sur téléphone), 260 ms, sauté sous mouvement réduit ; `TabPanel` (`role="tabpanel"`, relié par `idPrefix`). Clavier sorti en fonction pure (`lib/ui/tabsKeyboard.ts`).
- Les 7 usages convertis ; `BinderTabs.tsx` supprimé. Charte §3 et §9, planche `Navigation.dc.html`.
- Tests : `lib/ui/tabsKeyboard.test.ts`, `lib/ui/tabs.test.ts` (balisage ARIA rendu côté serveur, sans dépendance ajoutée).
- Vérifié dans le navigateur (Banc d'essai, Testeur MJ) : fiche de personnage sur ordinateur et téléphone — flèche et Fin changent l'onglet, le focus suit, un seul onglet tabulable, le fond reste aligné, la pilule défile sur téléphone.

*À voir à l'œil* : accueil (onglets d'un monde ouvert), solo, aperçu du créateur.


---

### ☑ V3.1-111 — Sauvegardes : la demande et la réponse (données, serveur) · `M` · sans modèle IA — **fait le 17 octobre (ADR 0044)**

**Modèle conseillé : Opus** — table nouvelle, RLS. **ADR 0044.**
**Dépend de** : 105, 110.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : table `save_requests` (champs de l'ADR), RLS (lecture :
  auteur, cible, MJ ; réponse par `app.answer_save_request`) ;
  `docs/SCHEMA.md`.
- `resolveTargetedRoll` (105) : un effet à sauvegarde vérifie la cible
  (`isValidTarget`), puis crée la demande au lieu d'appliquer ; la réponse
  (lancer côté serveur, vrai dé avec « modificateur inclus », ou saisie du
  MJ) est traitée **au nom de celui qui répond** : verdict, puis dégâts ou
  état appliqués, journal, et le résultat revient au jet de l'auteur.

**Critères d'acceptation**
- [x] Une sauvegarde imposée à un PJ n'est lisible que de l'auteur, du
  joueur de la cible et du MJ (test RLS).
- [x] Réponse → verdict → effet appliqué, journalisé (test de service).

**Réalisé** (détail dans l'ADR 0044, « Réalisation de la demande et de la réponse »)
- Migration `20261017120000_save_requests.sql` (appliquée le 17 octobre, après correction : `natural` est un mot réservé, la colonne s'appelle `natural_roll`) : table, RLS, `answer_save_request`, `set_own_participant_vitals`.
- Noyau : `zSaveRequestEffect`, `saveTotal`, `effectsForSaveOutcome` (`src/core/rules/saveRequest.ts`), tests d'abord.
- « Cibler » avec un sort à sauvegarde : `isValidTarget` avant de lancer (aucun emplacement dépensé sur un refus), puis la demande. Réponse `answerSaveRequest` au nom du répondant ; routes `GET …/save-requests` et `POST …/save-requests/[requestId]/answer`.
- Tests d'intégration : 14/14 (`saveRequests.integration.test.ts`, `targetedRoll.integration.test.ts`) — RLS avec deux comptes joueurs, réponse → verdict → effet → journal, annulation par le MJ.

*Écart* : `set_own_participant_vitals`, écriture étroite du joueur sur la ligne de combat de son PJ (ADR 0040 l'avait fermée).
*Restes* : les écrans (bandeau de la cible, pastille du dé) et la publication temps réel de `save_requests` ; la création par un joueur (V3.1-104).


---

### ☑ V3.1-110 — Sauvegardes : la restriction de cible (noyau) · `S` · sans modèle IA — **fait le 17 octobre (ADR 0044)**

**Modèle conseillé : Sonnet** — noyau pur, tests d'abord. **ADR 0044.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `zEffectData` gagne `target?: { creature_types?, exclude_creature_types?,
  immune_conditions_block? }` (Zod) ; `isValidTarget(effect, target)` dans
  `src/core/rules/` lit le type de créature (bloc de stats, espèce) et les
  immunités d'état.
- L'import SRD pose la restriction sur les sorts concernés (Charme-personne :
  humanoïde, etc.) — liste à relever dans le SRD, le contenu reste l'import.

**Critères d'acceptation**
- [x] Charme-personne sur un mort-vivant : refusé (test) ; sur un humanoïde :
  accepté ; un immunisé à Charmé : refusé.

**Réalisé** (par Opus : noyau du moteur et contexte déjà chargé, skill `deleguer` §1)
- `zEffectData.target` ; `isValidTarget`, `creatureTypeOf` (`src/core/rules/targetRestriction.ts`), tests d'abord.
- `data/srd/spell-targets.json` par édition (15 sorts en 2014, 7 en 2024, relevés dans le texte du SRD), testé (`srdSpellTargetsData.test.ts`) ; `mergeSpellTargets` dans l'import, qui crée le bloc `effects` s'il manque. SRD réimporté le 17 octobre, scripts d'après import rejoués.
- Fiche d'un sort : la restriction s'affiche sous l'effet.

*Écart* : `immune_conditions_block` est une liste d'états, pas un booléen (ADR 0044, « Réalisation »).
*Restes* : Amitié avec les animaux (Intelligence 4 ou plus) n'est pas modélisée ; Domination de bête est laissée sans restriction, son texte SRD dit « créature ».


---

### ☑ V3.1-105 — Cibler : le cœur commun de résolution · `L` · sans modèle IA — **fait le 17 octobre (ADR 0042)**

**Modèle conseillé : Opus** — extraction du tour solo, moteur. **ADR 0042.**
**Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `src/server/services/targetedRoll.ts` : `resolveTargetedRoll` (entrée
  Zod de l'ADR) — lit la cible dans le combat `running`, lance (serveur),
  résout (`resolveAttackRoll`, `resolveDamageRoll`, sauvegarde contre DD
  pour un sort à jet du MJ, `eventsForAttack`, déclencheurs), calcule
  (`applyEffects`) et écrit ; touche → demande de dégâts chaînée (dés
  doublés au critique) ; PJ à 0 PV → jets contre la mort (ADR 0036 §8) ;
  créature à 0 PV → hors de l'initiative ; journal ; « Annuler » = écriture
  inverse journalisée.
- `applyResolvedTurn` (solo) délègue sa partie « appliquer » à ce service ;
  les tests du solo restent verts **sans modification**.
- Autorisation : MJ → tout participant ; joueur → son PJ comme acteur, et
  écriture refusée sur une cible qu'il ne contrôle pas (verdict seulement)
  tant que V3.1-104 n'est pas fait.

**Critères d'acceptation**
- [x] Touche, dégâts, états, soins résolus par le moteur et appliqués,
  journalisés (tests de service).
- [x] Les tests du solo passent tels quels.
- [x] « Annuler » rend l'état d'avant par une écriture inverse.

**Réalisé** (détail dans l'ADR 0042, « Réalisation »)
- Noyau, tests d'abord : `src/core/rules/targeting.ts` (`attackVerdict` 2024, `damageAfterSave`, `monsterSaveBonus`, `isOutOfFight`, `advanceTurnSkipping`/`retreatTurnSkipping`) ; `eventsForDamage` ; un critique sur un PJ à 0 PV coûte deux échecs (`turn.ts`).
- `src/server/services/targetedRoll.ts` : `applyResolvedEffects` (extrait du solo, qui l'appelle) et `resolveTargetedRoll` (attaque, dégâts, sort à attaque, sort à sauvegarde, soin ; acteur personnage ou monstre). Route `POST …/combats/[combatId]/targeted-roll` (MJ).
- `patchCombatParticipant` porte et annule les jets contre la mort ; le passage de tour saute une créature à 0 PV ; `castSpell` peut dépenser l'emplacement sans lancer de dégâts.
- Tests : `targetedRoll.integration.test.ts` 9/9 (dont un tour solo de bout en bout), `targetedRoll.noAi.test.ts` ; tests du solo inchangés et verts (`turnIntent.noAi`, `turnIntent.pendingRequest`, `characterActions`, `ownInitiative`).

*Écart* : un joueur n'a pas encore le « verdict seulement » prévu — il ne lit plus la CA adverse (ADR 0040) ; il viendra avec V3.1-104.
*Restes* : « Cibler » dans l'outil de dés (écran) ; jets secrets d'une fiche (ADR 0038) ; données de sauvegarde et de soins des sorts SRD (rares).


---

### ☑ V3.1-103 — Initiative : les jets d'initiative des joueurs · `M` · sans modèle IA — **fait le 17 octobre (ADR 0040)**

**Modèle conseillé : Opus** — changement de schéma. **ADR 0040.**
**Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : `combats.status` accepte `rolling` (« jets d'initiative »)
  entre `draft` et `running` ; `docs/SCHEMA.md`.
- Fonction `app.set_own_initiative(p_participant uuid, p_value int)` : seul
  le joueur dont le PJ (`campaign_characters.user_id`) est ce participant,
  seulement en `rolling`, valeur −10 à 40.
- Route `POST …/combats/[combatId]/my-initiative` (Zod) : `{ mode: "roll" }`
  (le serveur tire le d20 et ajoute l'initiative de la fiche, règle 8) ou
  `{ mode: "die", natural: 1..20, modifierIncluded: boolean }`.
- Le MJ : « Demander les jets » (draft → rolling), saisir à la place d'un
  joueur, « Commencer » (rolling → running), « Terminer » (confirmé).
- Chaque étape écrit un `session_events` de genre `combat`.

**Critères d'acceptation**
- [x] Un joueur ne peut écrire que l'initiative de son PJ, et seulement en
  `rolling` (test).
- [x] Invitation, jet, saisie du MJ, fin : journalisés.

**Réalisé**
- Migration `20261017090000_combat_rolling_own_initiative.sql` (appliquée le 17 octobre) : statut `rolling`, `public.set_own_initiative` (renvoie avant/après, `null` si refus).
- Noyau : `ownInitiativeFromDie`, `isOwnInitiativeInRange` (`src/core/rules/combat.ts`), tests d'abord ; schéma Zod `myInitiativeSchema` testé.
- Service `setMyInitiative` (`src/server/services/ownInitiative.ts`) : « lancer » par `rollInitiativeCheck` (jet enregistré et attribué, V3.1-89), « vrai dé » plus la Dextérité de la fiche ; journal au nom de la joueuse (`actor: player`), annulable. Route `POST …/combats/[combatId]/my-initiative`.
- Écran du MJ : statut « Jets d'initiative », « Demander les jets », « ▶ Commencer », « ■ Stop » confirmé ; planche `OutilsMJ.dc.html` complétée.
- Tests d'intégration : 3/3 (`ownInitiative.integration.test.ts`).

*Restes* : l'écran des joueuses qui appelle la route vient avec V3.1-38.


---

### ☑ V3.1-102 — Initiative : la vue filtrée des joueurs · `M` · sans modèle IA — **fait le 17 octobre (ADR 0040)**

**Modèle conseillé : Opus.** **ADR 0040.** **Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Fonction `app.combat_player_view(p_combat uuid)` (`security definer`,
  `row_security = off`), vérifie que l'appelant est membre de la campagne ;
  renvoie par participant : `id`, `label`, `initiative`, ordre, `is_current`,
  `side`, états ; allié (PJ ou `is_ally`) : PV courants, max, temporaires ;
  adversaire : `wound` parmi `unhurt` (≥ max), `hurt` (> ½), `bloodied`
  (> 0), `down` (0). Jamais `ac`, `rule_key`, ni le nom d'entité d'un
  adversaire. Plus la ligne `combats` (statut, round, tour).
- Service `getPlayerCombatView`, route `GET
  /api/campaigns/[campaignId]/combats/active/player` (Zod).
- Le MJ touche `combats.updated_at` à chaque changement de participant
  (signal temps réel des joueurs).

**Critères d'acceptation**
- [x] La vue ne contient ni PV, ni CA, ni nom d'origine d'un adversaire (test).
- [x] Un non-membre reçoit un refus.

**Réalisé**
- Migration `20261016120000_combat_player_view.sql` (appliquée le 16 octobre) : `public.combat_player_view` (refus `42501` pour un non-membre) et trois déclencheurs par instruction qui touchent `combats.updated_at`.
- Noyau : `orderPlayerCombatView` (`src/core/rules/combatPlayerView.ts`), tests d'abord — même tri que l'écran du MJ, d'où `display_order` plutôt qu'un rang calculé en SQL.
- Service `getPlayerCombatView` (`src/server/services/playerCombatView.ts`), route `GET /api/campaigns/[campaignId]/combats/active/player`.
- Tests d'intégration : 4/4 (`playerCombatView.integration.test.ts`) — ni PV, ni CA, ni bestiaire, ni fiche d'origine d'un adversaire ; même tour que le MJ ; refus d'un non-membre ; signal du combat.

*Restes* : l'écran des joueuses (V3.1-38) lira cette route et ajoutera `combats` à la publication temps réel.


---

### ☑ V3.1-100 — Rejoindre sans choisir de PJ ; le lien qui vise un PJ précis · `M` · sans modèle IA — **fait le 16 octobre (ADR 0049)**

**Modèle conseillé : Opus** — parcours d'adhésion, une colonne nouvelle,
une réservation à faire respecter côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision de l'auteur (9 octobre)**
- **Rejoindre une table ne demande plus de choisir un PJ.** L'écran
  Rejoindre (V3.1-86) garde rôle, nom et mot de passe ; la joueuse arrive
  ensuite sur le **carrousel** (V3.1-82), ouvert sur « Nouveau personnage ».
  Plus de blocage « Aucun personnage disponible » (V3.1-14).
- **Un lien peut viser un PJ précis** (« ce lien est pour Naivara ») : la
  joueuse qui l'ouvre voit un carrousel réduit à **ce PJ et « Nouveau
  personnage »** (au cas où), **ouvert sur le PJ**.

**Constat (lu le 9 octobre)** : `campaign_invites` n'a pas de colonne de
personnage ; `accountProvisioning.ts` refuse un rôle joueur sans
`entityId` (`missing_entity`) et réclame le PJ au moment de rejoindre.

**À concevoir, ADR à l'appui**
- `campaign_invites.entity_id uuid null` (lien nominatif) ; la génération
  d'un lien joueur dans Gestion de campagne gagne « pour : [PJ ▾]
  (facultatif) » (avec V3.1-54).
- Adhésion sans réclamation : `accountProvisioning` accepte un joueur sans
  `entityId` ; la réclamation se fait ensuite par le carrousel.
- **Réservation** : tant que le lien nominatif est actif et non utilisé, son
  PJ n'apparaît pas dans le carrousel des autres joueuses ; la joueuse
  arrivée par ce lien peut le réclamer même s'il n'est pas « ouvert ». La
  règle est vérifiée par le serveur à la réclamation, pas seulement à
  l'affichage.
- Le serveur dit au carrousel quoi montrer et sur quelle carte s'ouvrir
  (V3.1-82).

**Critères d'acceptation**
- [x] Une joueuse rejoint par un lien ouvert sans aucun PJ disponible, puis
  crée le sien depuis le carrousel.
- [x] Par un lien nominatif : carrousel réduit au PJ visé et à « Nouveau
  personnage », ouvert sur le PJ ; une autre joueuse ne voit pas ce PJ.
- [x] Réclamer le PJ réservé avec un autre compte est refusé par le serveur
  (test).

**Réalisé**
- Migration `20261016090000_nominative_player_invites.sql` (appliquée le 16 octobre) : `campaign_invites.entity_id`, `public.list_claimable_characters`, `public.claim_campaign_character`, `resolve_campaign_invite` renvoie `entity_id`, liste anonyme des PJ par jeton supprimée.
- Rejoindre ne choisit plus de PJ ; une joueuse sans PJ arrive sur `/joueur`. Un lien nominatif sert une fois (`claimed_by_user_id`) ; déjà utilisé par un autre, la page le dit avant le formulaire.
- Noyau : `claimableView` (`src/core/campaigns/claimable.ts`), tests d'abord. L'écran de choix reçoit `characters` et `startOn` du serveur ; le carrousel (V3.1-82) les lira.
- « Nouveau PJ » d'une joueuse : la fiche est réclamée avant l'écriture de ses blocs (`createCharacterFromWizard`, `claimInCampaignId`).
- Gestion de campagne : « pour : [PJ] » à la génération d'un lien joueur.
- Tests d'intégration : 11/11 (`campaignInvites.integration.test.ts`).

*Faille relevée en route, fermée* : `campaign_characters_write` laissait tout compte connecté s'attribuer une fiche, donc en devenir éditeur. Écriture directe réservée au MJ ; inscrite au registre de `SECURITE.md`.


---

### ☑ V3.1-89 — Statistiques : attribuer chaque jet (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0064)**

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
- [x] ADR ; migration ; `docs/SCHEMA.md` ; types régénérés.
- [x] Les quatre chemins écrivent `rolled_by_user_id`, `entity_id`,
  `naturalD20`, `kind` (tests d'intégration).
- [x] Avantage : `naturalD20` = le plus haut des deux ; désavantage : le
  plus bas (test).
- [x] Aucun jet `gm` ni `roller` n'apparaît dans `listRollsForStats`, même
  lu par son auteur (test).

**Réalisé**
- Migration `20261014090000_dice_rolls_attribution.sql` (appliquée le 14 octobre) : `rolled_by_user_id` (posé par la base, `default auth.uid()`) et `entity_id` ; index `(campaign_id, entity_id, created_at desc)` ; `dice_rolls_insert` refuse un autre compte et un personnage que l'auteur ne peut pas modifier ; table `player_title_tiers` et ses quatorze paliers.
- Noyau : `naturalD20FromTrace` et `DICE_ROLL_KINDS` (`src/core/dice/rollAttribution.ts`), `zPlayerTitleTier` et `DEFAULT_TITLE_TIERS` (`src/core/stats/titleTiers.ts`), tests d'abord.
- `DiceRollAttribution` obligatoire dans `insertDiceRoll` : les quatre chemins la fournissent. Contrat pour 90 et 91 : `listRollsForStats` (jets publics seulement) et `listPlayerRolls`, `getPlayerEconomy` (`src/server/services/playerStats.ts`).
- Monnaie : toujours dans le bloc `inventory`, donc dans ses révisions ; `campaignEconomy` reste la source.
- Tests d'intégration : 30/30 sur les trois fichiers des jets.

*Faille relevée en route, fermée* : l'usurpation du compte ou du personnage d'un jet. *Reste ouvert, antérieur* : un membre peut insérer lui-même un jet public au résultat inventé ; il ne fausse que ses propres statistiques. Les deux sont inscrits au registre de `SECURITE.md`.


---

### ☑ V3.1-96 — Chronologie : portée, événements directs, naissances et morts (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0048)**

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
- [x] ADR ; schéma de bloc versionné ; `docs/SCHEMA.md` à jour si une table
  ou une fiche système naît.
- [x] Une joueuse ne reçoit aucune date qu'elle ne peut pas voir (test).
- [x] Une seule requête pour les naissances et morts d'un monde (test).

**Note de clôture (14 octobre, Opus).** Détail dans l'[ADR 0048](../adr/0048-les-donnees-de-la-chronologie.md), section « Réalisé ».

*Fait* :
- portée (`resolveScope`) et entrées de naissance et de mort (10 tests du noyau) ;
- fiche système `world_timeline` (migration `20261013160000`, appliquée par l'auteur le 14 octobre) ;
- `getWorldTimeline` en une requête, filtrée bloc puis entrée (3 tests) ;
- deux actions serveur Zod : ajouter un événement, changer une portée ;
- `WIKI_HIDDEN_KINDS` pour les fiches système.

*Faille relevée en route, fermée* : un joueur pouvait créer la fiche système avant le MJ. Inscrite au registre de `SECURITE.md`. Le test d'intégration échouait avant la migration et passe après (3/3).

*Restes* : l'écran de la frise (portées, filtres, ajout d'un événement) vient avec V3.1-97 et 98, qui lisent `scope` et `source`.
