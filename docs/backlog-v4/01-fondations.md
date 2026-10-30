# Lot A — Les fondations de la simulation

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/simulation-monde.md`](../../specs/simulation-monde.md).*

Ce lot pose le hasard, l'horloge, les tables, le vocabulaire des événements, les listes du monde, et le pont par lequel ce que font les PJ entre dans le monde. **Tout le lot est sans modèle IA.** Conçu le 22 octobre 2026 (ADR 0067 à 0071).

---

### ☐ V4-A1 — Le hasard dérivé · `S` · sans modèle IA — **prêt**

**Modèle conseillé : Opus** — noyau ; c'est lui qui rend l'effet papillon lisible. **ADR :** 0068. **Spec :** §3.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

**À faire** (tests d'abord)
- `src/core/sim/random.ts` :
  - `murmur3(bytes, seed): number` (finaliseur `fmix32`), écrit à la main, la source citée en commentaire ;
  - `deriveRng(seed: string, ...keys: (string | number | bigint)[]): Rng` : hachage de la graine et des clés séparées par un octet nul, qui initialise un xorshift32 (état nul interdit : remplacé par une constante) ;
  - `hash128(seed, ...keys): string` : quatre hachages à graines différentes, mis en forme d'UUID (version 4 et variante forcées, commentaire : « déterministe, pas aléatoire ») ;
  - `bellInt(rng, mean, sd, min, max)` : somme de trois uniformes, pour les tirages en cloche (`specs/psyche-v4.md` §1.2).
- `Rng` reste l'interface de `src/core/dice/rng.ts` (`nextInt`).

**Critères d'acceptation**
- [ ] Mêmes clés → même suite sur 10 000 tirages ; une clé changée, ou l'ordre des clés changé, change la suite.
- [ ] Tirer 100 fois sous le motif `"a"` ne change aucun tirage du motif `"b"` (le test qui définit l'effet papillon).
- [ ] χ² grossier sur 100 000 tirages d'un d20 dans la tolérance ; `bellInt` : moyenne et écart-type à 5 % près sur 100 000 tirages.
- [ ] `hash128` : deux clés différentes, deux UUID différents ; format valide pour `uuid` en base.

---

### ☐ V4-A2 — L'horloge du monde et la lunette · `M` · sans modèle IA — **prêt après A1**

**Modèle conseillé : Opus** — noyau. **ADR :** 0069. **Spec :** §2.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

**À faire** (tests d'abord)
- `src/core/sim/clock.ts` :
  - `worldTimeOf(date: GameDate, minuteOfDay, calendar): bigint` et l'inverse, sur `computeSortKey` ;
  - `worldTimeOfScene(scene: SceneState, campaignStart: GameDate, calendar): bigint` ;
  - `frontiers(from, to, calendar): Frontier[]` : chaque heure pleine, chaque minuit, chaque premier du mois entre `from` (exclu) et `to` (inclus), triés, avec leur genre.
- `src/core/sim/distance.ts` : `distanceClass(figure, scene, partyLocationId, tree, pcLinks): "scene" | "near" | "far" | "light"` (§2.2).
- `src/core/sim/advance.ts` : le squelette de `advanceWorld(world, from, to, budget, seed, steps)` ; `steps` est un objet de fonctions par genre de frontière (remplies par le lot E), le budget compte les figures traitées et rend un `cursor` (dernière frontière complète).

**Critères d'acceptation**
- [ ] `frontiers(10 h, 20 h)` = `frontiers(10 h, 14 h)` + `frontiers(14 h, 20 h)` (test, avec des pas factices qui comptent).
- [ ] Mois de longueurs différentes (calendrier non grégorien) : les premiers du mois tombent juste.
- [ ] Avancer jusqu'au budget puis reprendre au `cursor` donne le même résultat qu'un seul appel sans budget.

---

### ☐ V4-A3 — Les tables de la simulation · `L` · sans modèle IA — **prêt après B2**

**Modèle conseillé : Opus** — migration, RLS. **ADR :** 0067, 0070, 0079, 0080. **Spec :** §1.

**Sous-tâches Haiku** : régénérer `src/types/database.ts` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**À faire**
- Une migration : `sim_batches`, `sim_figures`, `world_events`, `sim_batch_items` (dans cet ordre, à cause des clés étrangères), les colonnes ajoutées à `personality_events` et `attitude_events`, les index, la RLS (`app.is_world_admin(app.campaign_world_id(campaign_id))` en lecture et en écriture). `sim_beliefs` (C5), `sim_pc_views` (H1) et `world_generations` (G1) viennent avec leurs tickets.
- `src/core/sim/state.ts` : `zSimFigureState` (complète et légère, union discriminée par `tier`), `zMemory`, `zLink`.
- `src/server/repos/simFigures.ts`, `worldEvents.ts`, `simBatches.ts` : lectures et écritures groupées (une requête par lot, jamais par figure, `docs/QUOTAS.md` Q1).
- `docs/SCHEMA.md` : une section 27 « Simulation » ; `docs/SECURITE.md` : la liste de contrôle remplie pour ces tables.

**Critères d'acceptation**
- [ ] Un joueur d'une campagne (pas admin) ne lit ni n'écrit aucune de ces tables, même par une requête directe (test d'intégration RLS, comptes de test de `docs/TESTS.md`).
- [ ] `personality_events` existants restent lisibles ; `kind` vaut `seed_edit` pour eux.
- [ ] `zSimFigureState` refuse un état complet sans `memories`, un état léger avec `needs`.

---

### ☐ V4-A4 — Le vocabulaire du monde · `M` · sans modèle IA — **prêt après B1**

**Modèle conseillé : Opus** — vocabulaire fermé du moteur. **ADR :** 0070. **Spec :** §5.2.

**Sous-tâches Haiku** : reporter les 49 libellés de genres dans `messages/` ; lancer `npm run test:core`.

**À faire**
- `src/core/sim/events.ts` : `WORLD_EVENT_KINDS` (les 65 genres de la spec), chacun rattaché à un thème de table s'il en relève (`sexual_assault`, `abducted`, `enslaved`, `tortured`), et pour chacun une entrée de `WORLD_EVENT_DEFS` : schéma Zod de `data`, portée par défaut, `harm` et `benefit` (0…100), acte éthique (`EthicKey | null`), étiquettes de réputation avec leur poids, formateur ou non (pour C2).
- `zWorldEvent` : un événement complet validé (genre connu, `data` conforme à son genre, au moins un acteur sauf pour `birth`, `death` et `monster_attack`).
- Une phrase de résumé par genre, avec trous (`{actor} a insulté {target}`), dans `messages/`.

**Critères d'acceptation**
- [ ] Chaque genre a une définition complète (test qui parcourt la liste).
- [ ] Un genre inconnu ou un `data` non conforme est refusé.
- [ ] `isKindAllowed(kind, themes, origin)` : un genre d'un thème `absent` est refusé pour toute origine ; un genre d'un thème `veiled` est refusé pour l'origine `simulation` (test).

---

### ☐ V4-A5 — Les listes du monde · `M` · sans modèle IA — **prêt après B1**

**Modèle conseillé : Opus** — migration (genre système), RLS d'insertion. **ADR :** 0071.

**Sous-tâches Haiku** : ajouter `world_lists` à `WIKI_HIDDEN_KINDS` ; planche du catalogue si un écran est touché.

**À faire**
- Genre d'entité système `world_lists` : index unique partiel par monde, création réservée au MJ dans `entities_insert` (même patron que `world_timeline`, migration `20261013160000`).
- Bloc `world_lists` : facettes et valeurs **descriptives** ajoutées (clé, libellés des pôles ou nom), entrées par défaut masquées, préférences et étiquettes d'identité proposées.
- `resolveWorldLists(defaults, block): WorldLists` (pur) : la liste effective d'un monde.
- Un écran simple dans les réglages du monde (formulaire engendré par le schéma Zod).

**Critères d'acceptation**
- [ ] Une facette ajoutée s'affiche et se saisit, et le moteur l'ignore (test : aucune considération ne la lit).
- [ ] Une entrée masquée disparaît des listes de saisie ; les données existantes qui l'utilisent restent lisibles.
- [ ] Un joueur ne peut pas créer la fiche `world_lists`.

---

### ☐ V4-A6 — Le pont du jeu vers le monde · `M` · sans modèle IA — **prêt après A3, A4**

**Modèle conseillé : Opus** — service, autorisation. **ADR :** 0070. **Spec :** §5.4.

**Sous-tâches Haiku** : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**À faire**
- `src/core/sim/bridge.ts` : `translateSessionEvents(events, figuresByEntity, combatContext): WorldEventDraft[]` (pur) : attaque → `assault`, mort par un PJ → `kill_in_fight` ou `murder`, soin → `help_given`. Les PJ et les figures sont reconnus par leur entité.
- `src/server/services/simBridge.ts` : lit les `session_events` depuis la fin du dernier lot (une requête), traduit, rend des brouillons au pas de simulation (E9).
- Action serveur `recordWorldEvent` (fait marquant) : schéma Zod, réservée à l'admin du monde, écrit un `world_events` d'origine `gm` (campagne) ou `player` (solo). Refuse un genre d'un thème `absent`, tout contenu sexuel impliquant un mineur, et un acte de thème visant un PJ si `pcs_concerned` ne l'accepte pas.

**Critères d'acceptation**
- [ ] Une figure tuée par un PJ alors qu'elle n'était pas hostile donne `murder` ; au combat contre elle, `kill_in_fight` (tests).
- [ ] Un joueur de campagne qui appelle `recordWorldEvent` est refusé.
- [ ] Traduire deux fois les mêmes `session_events` ne crée pas de doublon (clé : `session_event_id`).

---

### ☐ V4-A7 — Saisir un fait marquant · `M` · sans modèle IA — **prêt après A6 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche, à montrer à l'auteur.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- **La saisie rapide du MJ** pendant une séance : trois touches (qui, quoi, sur qui), portée et phrase facultatives, depuis les outils de table.
- Dans le tiroir de conséquences (solo) et dans les outils du MJ : « Enregistrer un fait marquant ». Champs : le genre (liste groupée par famille, recherche ; les genres d'un thème `absent` n'y figurent pas), qui agit, sur qui (parmi les figures présentes et connues), où, la portée, une phrase libre.
- Réutiliser les éléments du catalogue (champ de recherche, puces de personnes) ; aucun élément neuf sans planche.

**Critères d'acceptation**
- [ ] L'esquisse est validée ; le formulaire tient à 375 px.
- [ ] Un fait enregistré apparaît dans le prochain lot (souvenirs des témoins).

---

### ☐ V4-A8 — Le budget de la simulation · `S` · sans modèle IA — **prêt après E9**

**Modèle conseillé : Opus** — quotas. **Spec :** §16.

**Sous-tâches Haiku** : reporter les mesures dans `docs/QUOTAS.md`.

- Un banc dans le noyau (`src/core/sim/bench.test.ts`, exclu de `test:core` par défaut) : mondes factices de 50, 150 complètes et 5 000 légères ; avancer d'une heure, d'un jour, d'un mois, d'un an. Temps, événements produits, lignes à écrire.
- Fixer les bornes de la spec §16 **d'après les mesures**.
- `docs/QUOTAS.md` : section « Simulation » (tour, repos long, semaine du MJ, génération par âge de monde).

**Critères d'acceptation**
- [ ] Un tour solo ordinaire (classe `near` : 20 figures, 1 heure) reste sous 300 ms de calcul et 50 lignes écrites.
- [ ] Les bornes de la spec sont mises à jour avec leurs mesures.

---

### ☐ V4-A9 — La puce d'acte : données et tour · `M` · sans modèle IA — **prêt après A4, A6**

**Modèle conseillé : Opus** — moteur de tour, jets demandés. **ADR :** 0089. **Spec :** §5.5.

**Sous-tâches Haiku** : libellés des actes ; lancer les tests et résumer les échecs.

**À faire** (tests d'abord)
- `src/core/sim/acts.ts` : `SOCIAL_ACTS` (la table de la spec : acte, genre, jet demandé), `actToWorldEvent(act, actor, target, outcome)`.
- La barre d'intention (`src/core/rules/intent.ts`) accepte un `social_act` facultatif `{ act, targetId }` à côté des intentions mécaniques ; quand l'acte demande un jet, le moteur le demande (V3-B5) avant d'écrire.
- Le tour écrit le fait au journal du monde avec son issue (un mensonge raté : `lie_told` découvert).

**Critères d'acceptation**
- [ ] Chaque acte a son genre et, s'il y a lieu, son jet (test qui parcourt la table).
- [ ] Un acte sans cible présente est refusé ; un acte d'un thème absent aussi.
- [ ] Un tour sans acte confirmé n'écrit aucun fait marquant.

---

### ☐ V4-A10 — La puce d'acte : l'écran · `S` · sans modèle IA — **prêt après A9 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** la planche « La barre d'intention et la puce d'acte » de l'esquisse du 28 octobre (artefact « Faits marquants — esquisse »), à faire valider dans l'application.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Sous la saisie libre : « Ce que le monde retiendra », la puce (acte · cible), et les boutons Confirmer, Changer l'acte (liste groupée), Aucun acte. Une proposition du modèle est marquée comme telle.
- Le tiroir de conséquences permet de **corriger l'acte retenu** du dernier tour.

**Critères d'acceptation**
- [ ] Tient à 375 px ; boutons de 44 px au moins ; planche à jour.
- [ ] Sans modèle, la puce est vide et se choisit à la main.

---

### ☐ V4-A11 — Le modèle propose l'acte · `M` · **avec modèle IA** — **prêt après A10**

**Modèle conseillé : Opus** — sortie structurée, garde-fous du modèle. **ADR :** 0089. **Spec :** §5.5.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- Un appel court dans `src/server/ai/` : la phrase du joueur et la liste des présents en entrée ; en sortie, un acte de la liste fermée et une cible parmi les présents (enum fermé, comme le garde-fou de S1), ou « aucun acte ». Validé par Zod ; journalisé dans `ai_usage_log` à chaque appel (règle 13).
- La proposition pré-remplit la puce ; elle n'est **jamais** appliquée sans la confirmation du joueur.

**Critères d'acceptation**
- [ ] Une cible hors des présents ou un acte hors liste est refusé (test).
- [ ] Une panne du modèle laisse la puce vide, le tour continue.
- [ ] Vérifié en direct sur dix phrases : les propositions sont justes ou corrigeables d'un geste.

---

### ☐ V4-A12 — Le journal de séance lu par le modèle · `M` · **avec modèle IA** — **prêt après A6, A7**

**Modèle conseillé : Opus** — propositions, contenu non fiable dans un prompt. **ADR :** 0089. **Spec :** §5.8.

**Sous-tâches Haiku** : libellés ; planche du catalogue ; vérifications.

- Écran du MJ : le résumé en prose à gauche, les faits proposés à droite (acte, acteurs, cible, portée, phrase citée), à cocher ; « Enregistrer les faits cochés ». Esquisse : la planche « Le journal de séance » de l'esquisse du 28 octobre.
- L'appel au modèle : texte encadré comme donnée (règle 10), sortie structurée (actes et figures parmi les connus), passage par `ai_proposals` (règle 9), `ai_usage_log` (règle 13).

**Critères d'acceptation**
- [ ] Chaque fait proposé cite sa phrase ; une figure inconnue n'est jamais proposée (test).
- [ ] Rien n'entre dans le monde sans la coche du MJ.
