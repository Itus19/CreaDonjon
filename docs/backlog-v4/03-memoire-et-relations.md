# Lot C — La mémoire et les relations

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/simulation-monde.md`](../../specs/simulation-monde.md) §7 à §9.*

Se souvenir, être transformé par ses souvenirs, se lier, croire, colporter, mentir, avoir une réputation. Conçu le 22 octobre 2026 (ADR 0074, 0075).

---

### ☐ V4-C1 — Les souvenirs · `M` · sans modèle IA — **prêt après A1, B1**

**Modèle conseillé : Opus** — noyau. **Spec :** §7.1 à §7.3.

**Sous-tâches Haiku** : lancer `npm run test:core`.

**À faire** (tests d'abord), `src/core/sim/memory.ts`
- `memoryGroup(emotion, subjectIds)`.
- `remember(memories, memory)` : règles de la mémoire courte (un par groupe, le plus fort gardé ; sinon place vide ; sinon le plus faible remplacé).
- `consolidate(memories, now, promotionDays)` : courte → longue (ou mémoire du joueur si `involves_pc`) après le délai, ou aussitôt au-dessus de 80 ; échoue si plus faible que le remplacé.
- `revisitDue(memories, now, rng, encounters)` : les souvenirs revécus ce pas, avec l'émotion rendue à 60 %.

**Critères d'acceptation**
- [ ] Jamais plus de 8 / 8 / 4 (tests aux bornes, 10 000 souvenirs aléatoires).
- [ ] Un deuil à 90 est toujours en mémoire longue au bout de 50 ans simulés ; une broutille à 10 est oubliée en quelques semaines.
- [ ] Un souvenir impliquant un PJ ne quitte jamais la mémoire du joueur au profit d'un souvenir du quotidien.
- [ ] Déterministe à graine égale.

---

### ☐ V4-C2 — Les souvenirs fondateurs · `M` · sans modèle IA — **prêt après C1, B3**

**Modèle conseillé : Opus** — touche aux valeurs. **ADR :** 0074. **Spec :** §7.4.

**Sous-tâches Haiku** : libellés des transformations (« est devenu méfiant, après… ») ; lancer les tests.

**À faire** (tests d'abord)
- `src/core/sim/formative.rules.ts` : la table de la spec, en données.
- `formativeShift(memory, figure, rng): Shift | null` : chance d'un tiers, déplacements × intensité, sens choisi selon la règle, puis `applyDelta`.
- Pour un PJ, la sortie est une **proposition** si `pc_trait_evolution = "propose"`, rien si `"never"` (le réglage vient de H1 ; ici, un paramètre).
- Écriture : `personality_events` `kind = 'core_memory'`, avec `campaign_id` et `world_event_id`.

**Critères d'acceptation**
- [ ] Une transformation dit toujours sa cause.
- [ ] Sur 200 ans simulés (banc factice), les facettes d'une population ne convergent pas toutes (écart-type de chaque facette > 15).
- [ ] La culpabilité forte resserre l'éthique de l'acte d'un cran, jamais au-delà de `unthinkable`.

---

### ☐ V4-C3 — Familiarité, quotidien et compatibilité · `M` · sans modèle IA — **prêt après C1, B3**

**Modèle conseillé : Opus** — journal rejouable. **Spec :** §8.1 à §8.3.

**Sous-tâches Haiku** : lancer les tests.

**À faire** (tests d'abord)
- `src/core/sim/social.ts` : `compatibility(a, b)`, `pickInterlocutor(...)`, `dailyInteraction(a, b, rng)` (bavarder, se confier, se froisser, se disputer) et ses deltas ; `familiarityStep`.
- `attitude_events.deltas` accepte une **suite** de deltas bruts par axe (`number | number[]`) ; le rejeu (`src/core/psyche/apply.ts`) les applique dans l'ordre. Le service regroupe les deltas d'une semaine par paire.

**Critères d'acceptation**
- [ ] Rejouer un événement à suite de deltas = appliquer les deltas un par un (test).
- [ ] Deux personnes incompatibles finissent froides au bout de six mois de cohabitation ; deux compatibles, amies (banc, graine fixée).
- [ ] Une semaine d'interactions d'une paire = une seule ligne `attitude_events`.

---

### ☐ V4-C4 — Les liens nommés · `S` · sans modèle IA — **prêt après C3, A4**

**Modèle conseillé : Opus** — noyau. **Spec :** §8.4.

**Sous-tâches Haiku** : libellés des liens (trois formes d'accord quand il le faut : « amant·e »).

- `computeLinks(attitudes, events, ages): Link[]` (pur), les seuils de la spec.
- Le passage d'un seuil produit l'événement correspondant (`friendship_formed`, `grudge_formed`…) : `linkTransitions(before, after)`.

**Critères d'acceptation**
- [ ] Chaque lien a son test d'apparition et de disparition.
- [ ] Les liens d'une figure complète ne sont jamais stockés (règle 16) ; ceux d'une figure légère, oui (`state.links`).

---

### ☐ V4-C5 — Les croyances · `L` · sans modèle IA — **prêt après A3, C3**

**Modèle conseillé : Opus** — migration, RLS, vérité et croyance. **ADR :** 0075. **Spec :** §9.1 à §9.4, §9.6.

**Sous-tâches Haiku** : régénérer les types ; lancer les tests et résumer les échecs.

**À faire**
- Migration `sim_beliefs` (RLS admin du monde) ; `src/server/repos/simBeliefs.ts` (lectures groupées par porteur et par lieu).
- `src/core/sim/beliefs.ts` (tests d'abord) : `witnessBeliefs(event, presentFigures)`, `placeBelief(event)`, `transmit(belief, teller, listener, rng)` (certitude, sauts, mutation), `mutate(claim, rng, candidates)` (les quatre mutations), `lieVersion(event, liar, rival)`, `spreadBetweenPlaces(beliefs, tree, now)`, `decay(beliefs, now)`, plafonds 60 et 200.
- `zBeliefClaim` : la version crue d'un événement (genre, acteurs, cible, lieu, ampleur) ou d'une personne (identité, rôle, lieu).

**Critères d'acceptation**
- [ ] Une croyance qui a sauté cinq fois a une certitude plus basse que la première (test).
- [ ] Une figure à `sincerity` ≥ 34 ne ment jamais ; à ≤ −34 et avec un motif, ment selon le tirage (test sur graine).
- [ ] `is_accurate` est faux dès la première mutation ou le premier mensonge.
- [ ] Un mensonge découvert produit `lie_told` révélé et la perte de confiance.

---

### ☐ V4-C6 — La réputation · `S` · sans modèle IA — **prêt après C5**

**Modèle conseillé : Opus** — noyau. **Spec :** §9.5.

**Sous-tâches Haiku** : libellés des étiquettes.

- `reputationIn(placeBeliefs, figureId): Record<ReputationTag, number>` et ses bandes.

**Critères d'acceptation**
- [ ] Un PJ qui vole deux fois dans un lieu y a la réputation `thief` ; un lieu à trois sauts ne la connaît qu'après la propagation (test sur graine).

---

### ☐ V4-C7 — Souvenirs, croyances et liens sur la fiche · `M` · sans modèle IA — **prêt après C2, C4, C5 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : planche du catalogue.

- Pour le MJ : mémoire longue, mémoire du joueur, souvenirs courts récents, souvenirs fondateurs (avec la transformation), liens nommés, croyances avec la vérité en regard (une croyance fausse est marquée).
- Le fil d'une paire (V2) montre les souvenirs qui l'ont fait bouger.

**Critères d'acceptation**
- [ ] Esquisse validée ; tient à 375 px.
- [ ] La marque « fausse » n'est jamais rendue pour un joueur (elle n'est pas dans sa projection, H1).

---

### ☐ V4-C8 — La mémoire du joueur · `S` · sans modèle IA — **prêt après C1, E5**

**Modèle conseillé : Opus** — la promesse « les entités se souviennent du joueur ». **Spec :** §7.2.

**Sous-tâches Haiku** : lancer les tests.

- Un souvenir fort impliquant un PJ fait naître, selon les facettes, un rêve qui le vise : `avenge` (humilié, vaincu, trahi), `serve` ou `protect` (sauvé), `find` (perdu de vue après un lien fort), `redeem` (a fait du tort au PJ).
- Le journal de personnage (V3-E3) reçoit, côté PJ, ce que le PJ **sait** de ce que les autres retiennent de lui (par ses croyances).

**Critères d'acceptation**
- [ ] Un PNJ vaincu par un PJ et laissé en vie, rancunier, développe `avenge(PJ)` (test sur graine).
- [ ] Ce rêve n'apparaît jamais sans souvenir du PJ.
