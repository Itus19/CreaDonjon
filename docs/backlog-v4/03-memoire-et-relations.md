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
- `consolidate(memories, now, promotionDays)` (30 à 365, réglage `memory_promotion_days`) : courte → longue (ou mémoire du joueur si `involves_pc`) après le délai, ou aussitôt au-dessus de 80 ; échoue si plus faible que le remplacé.
- `revisitDue(memories, now, rng, encounters)` : les souvenirs revécus ce pas, avec l'émotion rendue à 60 %.

**Critères d'acceptation**
- [ ] Jamais plus de 8 / 8 / 4 (tests aux bornes, 10 000 souvenirs aléatoires).
- [ ] Un deuil à 90 est toujours en mémoire longue au bout de 50 ans simulés ; une broutille à 10 est oubliée en quelques semaines.
- [ ] Un souvenir impliquant un PJ ne quitte jamais la mémoire du joueur au profit d'un souvenir du quotidien.
- [ ] Déterministe à graine égale.
- [ ] Avec 30 jours, la mémoire longue se remplit plus vite qu'avec 365 sur la même suite d'événements (test comparatif).

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

---

### ☐ V4-C9 — Ce qui se voit, les déguisements et les préjugés · `L` · sans modèle IA — **prêt après C5, B4**

**Modèle conseillé : Opus** — règle d'identité, jets du moteur. **ADR :** 0086. **Spec :** §8.6.

**Sous-tâches Haiku** : libellés des groupes ; lancer les tests.

**À faire** (tests d'abord)
- `src/core/sim/perception.ts` : `perceiveOnMeeting(observer, target)` (croyances `witnessed` sur les traits perceptibles, ou sur le déguisement), `doubtsDisguise(observer, target, context)`, et le jet de démasquage par le moteur de règles existant (compétence et difficulté selon le ruleset), qui écrit `disguise_pierced`.
- `src/core/sim/groups.ts` : `GroupKey`, `groupAttitude(figure, group, culture)`, `experienceShift(attitude, memory, openMindedness)` (généralisation abusive), `contactShift` (Allport), `firstImpression(observer, perceivedGroups)`.
- Actions `discriminate`, `denounce`, `don_disguise` (dans `actions.full.ts`, E4).
- Le test de la règle d'identité (B4) est étendu : une figure n'agit jamais sur une appartenance qu'elle ne croit pas ; un déguisement non percé protège.

**Critères d'acceptation**
- [ ] Une figure hostile à un peuple discrimine un membre perçu, pas le même membre déguisé (test sur graine).
- [ ] Un tort subi déplace l'attitude envers tout le groupe, moins chez une figure ouverte d'esprit ; de bons contacts répétés la remontent (tests).
- [ ] `pcs_concerned.identity = false` : aucune figure ne discrimine un PJ (test).

---

### ☐ V4-C10 — Les normes, ce qu'on montre, et les vies cachées · `L` · sans modèle IA — **prêt après C9, B2**

**Modèle conseillé : Opus** — règle d'identité, sujet sensible. **ADR :** 0086. **Spec :** §8.7.

**Sous-tâches Haiku** : libellés des normes et des réponses ; lancer les tests.

**À faire** (tests d'abord)
- `culture.norms` (bloc `culture`, B2) et l'écart individuel ; `normResponse(figure, norm, culture)`.
- `src/core/sim/disclosure.ts` : `chooseDisclosure(figure, trait, context)` (par utilité : risque local, besoins, `confidence`, `bravery`, `privacy`, valeur `truth`), le stress minoritaire, `outed` quand une croyance se répand dans un lieu qui réprime, puis les suites selon la norme.
- Lieux sûrs : `safe_for` et le secret sur les entités de lieu (un champ de bloc de lieu), action `seek_safe_place`, croyances sur l'existence du lieu.
- Unions de façade : `union_formed` `data.arranged` et son motif ; la vérité n'est connue que par les croyances.
- Le réglage `identity_norms = false` neutralise les normes d'un monde.

**Critères d'acceptation**
- [ ] Dans un lieu qui réprime, une figure cache son orientation en public et l'ouvre dans un lieu sûr (test sur graine).
- [ ] Une fausse accusation peut provoquer `outed` sans que la figure soit concernée ; la vérité reste visible du MJ (test).
- [ ] Vivre caché contre un besoin pressant fait monter le stress (test).
- [ ] Le test de la règle d'identité couvre les normes : elles jugent des conduites connues, jamais une appartenance non crue.
