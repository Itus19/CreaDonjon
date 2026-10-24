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

### ☐ V3.1-104 — Écritures du moteur au nom d'un joueur : changements signés · `M` · sans modèle IA — **prêt (Opus) — ADR 0041, option B**

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

### ☐ V3.1-106 — Cibler côté MJ : outil de dés, Table, Initiative · `M` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 105, 33 (outil de dés), 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- « Cibler » s'allume dans l'outil de dés **pour le MJ** quand une
  initiative est `running` : liste des participants (alliés pour un soin),
  cible retenue affichée ; grisé hors initiative ou pour un jet sans cible.
- « Lancer » appelle `resolveTargetedRoll` ; une touche fait apparaître la
  bande « Lancer les dégâts » (même cible) ; verdict et changements affichés.
- Même chemin depuis l'outil Table (action d'un PNJ) et l'outil Initiative.
- *Repris de V3.1-33 (17 octobre)* : les boutons d'attaque, de sort et de
  dégâts de la fiche ouvrent l'outil pré-rempli (`openDiceTool`) ; la bande
  du pied (place déjà réservée dans `OutilDes.tsx`) devient « Lancer les
  dégâts » sur une touche, et « Valider · dégâts » / « Faire échouer » quand
  un monstre touche un joueur (critères de V3.1-33 restés ouverts).

*Déjà fait le 24 octobre, depuis l'outil Initiative (suite de V3.1-38)* :
« Cibler » et la liste des participants, les dés du jet ciblé affichés,
l'avantage au choix, la bande « Lancer les dégâts » après une touche (même
cible, critique compris). Reste : l'outil de dés **ouvert seul** par le MJ
pendant une initiative, l'outil Table, les boutons de la fiche, et
« Valider · dégâts » / « Faire échouer ». *Relevé le 24 octobre* : après
« Lancer les dégâts », la grille de l'outil garde le d20 de l'attaque (le
préréglage n'est pas remplacé par celui des dégâts) — à régler ici.

**Critères d'acceptation**
- [ ] Au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS, À terre
  appliqués (planche de la Table).
- [ ] Hors initiative, les jets restent de simples jets.

---

### ☐ V3.1-107 — Cibler côté joueur · `M` · sans modèle IA — **dépend de V3.1-104**

**Modèle conseillé : Sonnet.** Comme V3.1-106, pour le joueur avec son PJ,
une fois l'écriture au nom du joueur tranchée et faite (V3.1-104). D'ici là,
le joueur voit le verdict, sans application sur une cible qu'il ne contrôle
pas.

### ☐ V3.1-112 — Sauvegardes : les écrans · `M` · sans modèle IA — **prêt**

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

### ☐ V3.1-114 — Ressources : repos et égaliseur · `S` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 113, 24, 26.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `takeShortRest` rend les emplacements de pacte et une utilisation des
  `short_rest_one` ; `takeLongRest` rend tout.
- L'égaliseur (planche « Décidé · emplacements et ressources de classe »)
  montre la réserve de pacte à part ; une ressource de plus de six
  utilisations en compteur.

**Reçu de V3.1-113** (13 octobre) : les deux repos rendent déjà la réserve de pacte et une utilisation des `short_rest_one` (`rechargeTrackers`). Il reste l'écran :
- montrer `sheet.spellcasting.pactSlots` et `pact_slots_used`, à part ;
- d'ici là, un occultiste ne voit pas ses emplacements de pacte, mais `castSpell` les dépense déjà.

**Critères d'acceptation**
- [ ] Les trois cas de V3.1-40 se voient sur la fiche.

---

### ☐ V3.1-118 — Les choix dans l'assistant de création et de montée de niveau · `L` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 116, 117, 49, 50, 51.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Chaque `RemainingChoice` s'affiche à l'étape de sa source (Origines,
  Historique, Classe, montée de niveau), avec le sélecteur de son genre :
  compétences, langues, outils, maîtrises d'armes, dons (filtrés), sorts
  (le sélecteur unique de V3.1-50), types de dégâts, caractéristiques, et
  **options nommées** (cartes, chacune avec ses effets).
- La caractéristique d'incantation d'un lignage se choisit une fois, dans
  l'option.

**Reçu de V3.1-116** (13 octobre) :
- proposer les choix imbriqués que rend `resolveChoices` (`open`), au-delà des compétences et langues de premier niveau ;
- afficher les sorts accordés (`sheet.grantedSpells`) dans l'onglet Magie ;
- faire passer les améliorations de caractéristiques et les dons de progression en choix `ability` / `feat`.

**Critères d'acceptation**
- [ ] Les trois critères de V3.1-3 et de V3.1-6 passent dans l'assistant.

---

### ☐ V3.1-119 — Les choix rouverts au repos · `M` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet.** **Dépend de** : 116, 117, 24 (repos), V3.1-5.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Un repos qui rouvre un choix (`refresh`) émet son événement ; la fiche
  propose « Choisir à nouveau : Résilience fiélonne » (feuille du bas au
  téléphone) ; sans réponse, le choix d'avant reste.

**Critères d'acceptation**
- [ ] Cercle de la Terre : après un repos long, le terrain se rechoisit et
  la liste de sorts suit (test de service + écran).
