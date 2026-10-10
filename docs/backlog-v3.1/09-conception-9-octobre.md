# Backlog V3.1 — Conception du 9 octobre : les tickets Opus découpés

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Les neuf tickets « à concevoir » ont été conçus le 9 octobre ; chaque
décision a son ADR (0040 à 0049). Ce qui suit les découpe en tickets prêts.
V3.1-104 n'est plus bloqué : option B de l'ADR 0041, choisie le 10 octobre.

| Conçu | ADR | Découpé en |
|---|---|---|
| V3.1-37 initiative côté joueurs | 0040 | 101, 102, 103 (puis 38) |
| — écritures du moteur au nom d'un joueur | 0041 (option B) | 104 |
| V3.1-21 cibler et résoudre | 0042 | 105, 106, 107 |
| V3.1-23 droits des joueurs | 0043 | 108, 109 (puis 57) |
| V3.1-39 sauvegardes demandées | 0044 | 110, 111, 112 |
| V3.1-40 ressources de classe | 0045 | 113, 114 |
| V3.1-47 (+ 3, 6, 7) règles de personnage, choix | 0046 | 115, 116, 117, 118, 119 |
| V3.1-59 fond par défaut du wiki | 0047 | 59 lui-même, désormais prêt |
| V3.1-96 données de la chronologie | 0048 | 96 lui-même, désormais prêt |
| V3.1-100 rejoindre sans PJ, lien nominatif | 0049 | 100 lui-même, désormais prêt |

---

### ☐ V3.1-101 — Initiative : la base et les routes réservées au MJ · `S` — **codé le 10 octobre ; reste à appliquer la migration et à vérifier en direct**

**Modèle conseillé : Opus** — RLS et sécurité. **ADR 0040.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration nouvelle : `combats` lisible des membres, écrit par
  `app.is_world_admin(app.campaign_world_id(campaign_id))` ;
  `combat_participants` lu et écrit par `app.is_world_admin(app.combat_world_id(combat_id))`.
- **Chaque route** de `app/api/campaigns/[campaignId]/combats/**` vérifie
  `isWorldAdmin` (`src/server/services/permissions.ts`) et répond 403 avant
  toute lecture de participants ou écriture.
- Vérifier que rien d'autre ne lisait les participants pour un joueur en
  multijoueur (lu le 9 octobre : `turnIntent`, `turnLoop`, `combatTriggers`,
  `soloScene` — solo, où le joueur est propriétaire) ; le solo ne change pas.

**Critères d'acceptation**
- [ ] Test d'intégration RLS : un joueur ne lit aucune ligne de
  `combat_participants` et n'écrit ni `combats` ni `combat_participants`.
- [ ] Chaque route de combat répond 403 à un joueur (test de route).
- [ ] Le solo et l'outil Initiative du MJ marchent comme avant.
- [ ] À faire par l'auteur : appliquer la migration `20261010120000_combats_gm_only` (`supabase db push`), puis relancer les tests d'intégration avec `NEXT_PUBLIC_SUPABASE_ANON_KEY` défini.

**Codé le 10 octobre.**
- **Base** : migration `20261010120000_combats_gm_only`. `combats` reste lisible des membres et n'est plus écrit que par un administrateur du monde ; `combat_participants` est lu et écrit par l'administrateur seulement.
- **Routes** : les dix routes de `app/api/campaigns/[campaignId]/combats/**` passent par une porte commune, `guardCombatRoute` (`lib/combats/routeGuard.ts`). Elle valide l'adresse par Zod (règle 4, ce qui manquait partout), exige une session (trois lectures n'en demandaient pas) et le droit MJ, puis vérifie que le combat appartient à la campagne de l'adresse et le participant au combat. Elle répond 400, 401, 403 ou 404 avant toute lecture ou écriture.
- **Décision** : la règle pure `decideCombatAccess` (`src/core/permissions/combatAccess.ts`, 6 tests) refuse un joueur avant de lui dire si un combat existe. Les faits sont rassemblés par `checkCombatAccess` (`services/combats.ts`).
- **Solo** : inchangé. Le joueur y est propriétaire du monde, donc administrateur ; `turnLoop`, `turnIntent`, `soloScene` et `combatTriggers` ne sont pas touchés.
- **Tests** : `combatsRls.integration.test.ts`. Un joueur voit le combat mais aucun participant, et n'écrit rien ; le MJ lit et écrit ; la porte rend le même verdict. Ce test n'a pas tourné ici : la base n'est pas joignable avec la clé publique, et la migration n'est pas encore appliquée.
- Typecheck et lint verts. `npm run test` : 1405 tests passent ; 3 échecs et 14 fichiers en erreur **préexistants**, identiques sans ce ticket. Cette session voit l'URL et la clé service de Supabase mais pas la clé publique : des tests d'intégration démarrent puis échouent à connecter leurs comptes.

---

### ☐ V3.1-102 — Initiative : la vue filtrée des joueurs · `M` — **prêt (Opus)**

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
- [ ] La vue ne contient ni PV, ni CA, ni nom d'origine d'un adversaire (test).
- [ ] Un non-membre reçoit un refus.

---

### ☐ V3.1-103 — Initiative : les jets d'initiative des joueurs · `M` — **prêt (Opus)**

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
- [ ] Un joueur ne peut écrire que l'initiative de son PJ, et seulement en
  `rolling` (test).
- [ ] Invitation, jet, saisie du MJ, fin : journalisés.

---

### ☐ V3.1-104 — Écritures du moteur au nom d'un joueur : changements signés · `M` — **prêt (Opus) — ADR 0041, option B**

**Modèle conseillé : Opus** — sécurité, base, cryptographie. **Dépend de** : 105.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**À faire**
1. **Migration.**
   - Schéma `app_private` (s'il n'existe pas), tables `engine_signing_keys (id text primary key, secret bytea not null, active boolean not null default true)` et `engine_change_nonces (nonce uuid primary key, seen_at timestamptz not null default now())`, sans droit pour `anon` ni `authenticated`.
   - Fonction `app.apply_engine_change(payload jsonb, signature text)`, `security definer`, `search_path` fixé. Elle refuse :
     - une clé inconnue ou inactive ;
     - une signature fausse : HMAC-SHA256 par `pgcrypto`, sur le texte canonique reçu dans `payload` ;
     - un `issued_at` de plus de 60 s ;
     - un `nonce` déjà vu ;
     - une ligne hors de `campaign_id` ;
     - un champ hors de la liste (`hp`, `temp_hp`, `conditions`).

     Elle écrit dans une transaction, puis purge les `nonce` de plus d'une heure.
   - `SCHEMA.md` mis à jour dans le même ticket.
2. **Serveur.** `src/server/services/engineSigning.ts` signe en HMAC-SHA256 (`node:crypto`), avec `ENGINE_SIGNING_KEY` et `ENGINE_SIGNING_KEY_ID`, sur la forme canonique (clés triées, une fonction pure testée dans `src/core`). Son appel au repo passe par `src/server/repos/`. Clé absente : erreur explicite au démarrage du service, jamais un repli silencieux.
3. **Branchement.** `resolveTargetedRoll` (105) passe par ce chemin quand l'acteur est un joueur et que la cible n'est pas à lui. Le MJ garde l'écriture directe.
4. **Documentation.** Poser et faire tourner la clé, en hébergé et en cible locale : une section de `docs/` et `.env.example`.

**Critères d'acceptation**
- [ ] Un changement signé s'applique ; le même, rejoué, est refusé (test d'intégration).
- [ ] Une signature fausse, une clé inactive, un `issued_at` trop vieux, un champ hors liste : chacun refusé, sans rien écrire.
- [ ] Un joueur qui appelle la fonction avec un objet de sa main est refusé.
- [ ] Deux clés actives : un changement signé par l'une ou l'autre passe (rotation).
- [ ] Aucun import du service role hors `publicShare.ts` (la règle ESLint reste verte).

---

### ☐ V3.1-105 — Cibler : le cœur commun de résolution · `L` — **prêt (Opus)**

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
- [ ] Touche, dégâts, états, soins résolus par le moteur et appliqués,
  journalisés (tests de service).
- [ ] Les tests du solo passent tels quels.
- [ ] « Annuler » rend l'état d'avant par une écriture inverse.

---

### ☐ V3.1-106 — Cibler côté MJ : outil de dés, Table, Initiative · `M` — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 105, 33 (outil de dés), 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- « Cibler » s'allume dans l'outil de dés **pour le MJ** quand une
  initiative est `running` : liste des participants (alliés pour un soin),
  cible retenue affichée ; grisé hors initiative ou pour un jet sans cible.
- « Lancer » appelle `resolveTargetedRoll` ; une touche fait apparaître la
  bande « Lancer les dégâts » (même cible) ; verdict et changements affichés.
- Même chemin depuis l'outil Table (action d'un PNJ) et l'outil Initiative.

**Critères d'acceptation**
- [ ] Au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS, À terre
  appliqués (planche de la Table).
- [ ] Hors initiative, les jets restent de simples jets.

---

### ☐ V3.1-107 — Cibler côté joueur · `M` — **dépend de V3.1-104**

**Modèle conseillé : Sonnet.** Comme V3.1-106, pour le joueur avec son PJ,
une fois l'écriture au nom du joueur tranchée et faite (V3.1-104). D'ici là,
le joueur voit le verdict, sans application sur une cible qu'il ne contrôle
pas.

---

### ☐ V3.1-108 — Droits des joueurs : la base ferme, le serveur règle · `M` — **prêt (Opus)**

**Modèle conseillé : Opus** — RLS et schéma. **ADR 0043.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : `campaigns.table_settings jsonb not null default '{}'` ;
  `docs/SCHEMA.md` ; `zCampaignTableSettings` (défauts : `inspiration_max`
  1 ; `player_can_edit` : `conditions` et `inspiration` faux, `hp`,
  `currency`, `spell_slots`, `hit_dice` vrais).
- Migration : écriture de `entity_runtime_state` et `entity_active_effects`
  par `app.can_edit_entity(entity_id)` (au lieu de tout membre du monde).
- `src/core/campaigns/tableSettings.ts` : `mayPlayerChange(field, settings)`
  (tests d'abord) ; garde dans chaque service qui écrit un de ces champs
  pour une joueuse (PV, états, inspiration, pièces, emplacements, dés de
  vie) : 403 si l'interrupteur est coupé et que l'appelant n'est pas MJ.
  Les fonctions du moteur (repos, résolution) ne passent pas par la garde.
- Route d'écriture des réglages (Zod, MJ seul).

**Critères d'acceptation**
- [ ] Une joueuse ne peut plus écrire l'état de jeu d'une autre fiche
  (test RLS).
- [ ] Interrupteur coupé : l'écriture d'une joueuse est refusée par le
  serveur ; le MJ et le repos passent (tests de service).

---

### ☐ V3.1-109 — Droits des joueurs : la fiche obéit aux interrupteurs · `M` — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 108, 26, 32. L'écran
Règles actives est V3.1-57.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Partout où la joueuse voit sa fiche (ordinateur, tablette, téléphone) :
  interrupteur coupé → la valeur se voit, sans commande (« + état » absent,
  ▲▼ de l'inspiration, des PV, des pièces absents, colonnes « niv. » de
  l'égaliseur inertes, « Le MJ dépense tes dés de vie » à la place de
  « Dépenser un dé ») — planche « Décidé · fiche vue par le MJ et par le
  joueur ». Le MJ garde toutes les commandes.

**Critères d'acceptation**
- [ ] Les six interrupteurs pilotent la fiche de la joueuse sur les trois
  écrans.

---

### ☐ V3.1-110 — Sauvegardes : la restriction de cible (noyau) · `S` — **prêt**

**Modèle conseillé : Sonnet** — noyau pur, tests d'abord. **ADR 0044.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `zEffectData` gagne `target?: { creature_types?, exclude_creature_types?,
  immune_conditions_block? }` (Zod) ; `isValidTarget(effect, target)` dans
  `src/core/rules/` lit le type de créature (bloc de stats, espèce) et les
  immunités d'état.
- L'import SRD pose la restriction sur les sorts concernés (Charme-personne :
  humanoïde, etc.) — liste à relever dans le SRD, le contenu reste l'import.

**Critères d'acceptation**
- [ ] Charme-personne sur un mort-vivant : refusé (test) ; sur un humanoïde :
  accepté ; un immunisé à Charmé : refusé.

---

### ☐ V3.1-111 — Sauvegardes : la demande et la réponse (données, serveur) · `M` — **prêt (Opus)**

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
- [ ] Une sauvegarde imposée à un PJ n'est lisible que de l'auteur, du
  joueur de la cible et du MJ (test RLS).
- [ ] Réponse → verdict → effet appliqué, journalisé (test de service).

---

### ☐ V3.1-112 — Sauvegardes : les écrans · `M` — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 111, 33, 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- La cible reçoit un **bandeau au premier plan** : « Résiste à Moquerie
  cruelle · JS Sagesse DD 13 » — « Lancer », « J'ai un vrai dé »
  (interrupteur « modificateur inclus »), « Laisser le MJ saisir ».
- Le MJ répond dans l'outil **Initiative** en combat (bandeau), dans
  l'outil **Table** hors combat ; une **pastille sur le dé encoché** compte
  les demandes en attente, où qu'on soit.
- L'outil de dés de l'auteur affiche le verdict revenu, puis enchaîne.

**Critères d'acceptation**
- [ ] Les trois façons de répondre fonctionnent, sur ordinateur et téléphone.

---

### ☐ V3.1-113 — Ressources : pacte, recharge partielle, multiclassage (noyau) · `M` — **prêt (Opus)**

**Modèle conseillé : Opus** — moteur, tests d'abord. **ADR 0045.**
**Dépend de** : 115 (pour la table du multiclassé dans `character_rules`).

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `recharge: "short_rest_one"` (bloc Ressources, version relevée) ;
  `spellcasting.kind` `slots` | `pact` et `pactSlots` ; `casterWeight` ;
  `pact_slots_used` dans l'état de jeu (défaut 0).
- `characterSheet()` : emplacements du multiclassé (niveaux pondérés,
  arrondi inférieur, table du ruleset) ; réserve de pacte séparée.
- Import SRD : poids d'incantation, magie de pacte de l'occultiste, Arcanum
  mystique (ressource `long_rest` par niveau 6 à 9), recharges partielles
  (Rage, Conduit divin, Forme sauvage, Second souffle).

**Critères d'acceptation**
- [ ] Occultiste 20 : 4 emplacements de pacte de niveau 5 ; clerc 3 /
  magicien 2 : emplacements d'un lanceur de niveau 5 ; un multiclassé
  occultiste garde deux réserves (tests).
- [ ] Repos court : une Rage rendue ; repos long : toutes (test).

---

### ☐ V3.1-114 — Ressources : repos et égaliseur · `S` — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 113, 24, 26.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `takeShortRest` rend les emplacements de pacte et une utilisation des
  `short_rest_one` ; `takeLongRest` rend tout.
- L'égaliseur (planche « Décidé · emplacements et ressources de classe »)
  montre la réserve de pacte à part ; une ressource de plus de six
  utilisations en compteur.

**Critères d'acceptation**
- [ ] Les trois cas de V3.1-40 se voient sur la fiche.

---

### ☐ V3.1-115 — Règles de personnage : la fiche `character_rules` · `L` — **prêt (Opus)**

**Modèle conseillé : Opus** — structure de règles, héritage, import.
**ADR 0046.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Bloc typé `zCharacterRules` (champs de l'ADR) ; une fiche
  `character_rules` par ruleset, héritée et surchargée champ par champ comme
  les autres fiches ; sur la fiche de classe : `multiclass_prerequisites`
  structurés, `suggested_abilities`, `casterWeight`.
- Import SRD (base officielle) : les valeurs 2024 (plafond 20, tableau
  standard, achat de points, tirage, charge, revente, table du multiclassé,
  prérequis de multiclassage). **Le départ à haut niveau** : valeurs à
  vérifier par l'auteur dans le MdJ 2024 avant saisie — le contenu va en
  base ou dans `data/personnel/`, jamais en migration.
- `resolvedRuleset` expose ces valeurs ; `abilityGeneration.ts`,
  l'encombrement et la revente les lisent : **plus aucune constante**.

**Critères d'acceptation**
- [ ] Un ruleset de test au plafond 15 limite la création à 15 (test).
- [ ] Un prérequis non rempli est signalé ; le MJ peut passer outre (test).
- [ ] Plus aucune constante de génération dans `abilityGeneration.ts`.

---

### ☐ V3.1-116 — Le mécanisme générique des choix (noyau et résolution) · `L` — **prêt (Opus)**

**Modèle conseillé : Opus** — cœur du moteur. **ADR 0046.**
**Dépend de** : 115.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `zChoiceGrant` (champs de l'ADR), accepté dans la progression d'une
  classe ou sous-classe, un trait d'espèce, un historique, un don.
- `resolvedRuleset` collecte tous les choix accessibles et rend
  `RemainingChoice` généralisé ; `characterSheet()` applique les effets des
  options choisies (`character.choices`, clés qualifiées).
- Les améliorations de caractéristiques et dons de progression deviennent
  des choix `ability` / `feat`.
- Import SRD : Compétent, Polyvalent, Sens aiguisés, lignages elfiques et
  gnomiques, legs infernal, ascendance de géant, Initié à la magie.

**Critères d'acceptation**
- [ ] Initié à la magie : le choix de liste, les sorts mineurs et le sort de
  niveau 1 deviennent des sorts réels de la fiche (test).
- [ ] Lignage elfique Drow : le sort mineur au niveau 1, les sorts aux
  niveaux 3 et 5, la caractéristique d'incantation choisie une fois (test).
- [ ] Un don ou un trait sans choix n'ajoute rien à faire.

---

### ☐ V3.1-117 — La sous-classe résolue et ses choix · `M` — **prêt (Opus)**

**Modèle conseillé : Opus.** **ADR 0046.** **Dépend de** : 116.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `CreationSelection.classes[].subclass` ; la sous-classe rejoint le lot
  résolu ; `zSubclassFeatureEntry` accepte modificateurs, sorts toujours
  préparés et `zChoiceGrant`.
- Import SRD : Affinité élémentaire (type de dégâts, une fois), Cercle de
  la Terre (terrain, au repos long), Résilience fiélonne (au repos),
  Proie du chasseur / Tactiques défensives (au repos), Découvertes
  magiques, Savant en évocation (sorts).

**Critères d'acceptation**
- [ ] Affinité élémentaire Feu : résistance et bonus de dégâts appliqués (test).
- [ ] Une sous-classe purement descriptive ne change rien.

---

### ☐ V3.1-118 — Les choix dans l'assistant de création et de montée de niveau · `L` — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 116, 117, 49, 50, 51.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Chaque `RemainingChoice` s'affiche à l'étape de sa source (Origines,
  Historique, Classe, montée de niveau), avec le sélecteur de son genre :
  compétences, langues, outils, maîtrises d'armes, dons (filtrés), sorts
  (le sélecteur unique de V3.1-50), types de dégâts, caractéristiques, et
  **options nommées** (cartes, chacune avec ses effets).
- La caractéristique d'incantation d'un lignage se choisit une fois, dans
  l'option.

**Critères d'acceptation**
- [ ] Les trois critères de V3.1-3 et de V3.1-6 passent dans l'assistant.

---

### ☐ V3.1-119 — Les choix rouverts au repos · `M` — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 116, 117, 24 (repos), V3.1-5.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Un repos qui rouvre un choix (`refresh`) émet son événement ; la fiche
  propose « Choisir à nouveau : Résilience fiélonne » (feuille du bas au
  téléphone) ; sans réponse, le choix d'avant reste.

**Critères d'acceptation**
- [ ] Cercle de la Terre : après un repos long, le terrain se rechoisit et
  la liste de sorts suit (test de service + écran).
