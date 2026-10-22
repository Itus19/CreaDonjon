# Lot E — La boucle de vie

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/simulation-monde.md`](../../specs/simulation-monde.md) §4, §6, §8.5, §10.*

Ce qui fait qu'une personne **vit** : ressentir, avoir des besoins, agir, rêver, et se transformer. Conçu le 22 octobre 2026 (ADR 0076 à 0078).

```
événement → évaluation → émotion → souvenir → attitudes, stress
besoins + rêves + émotions + valeurs + relations → action → événement
```

---

### ☐ V4-E1 — L'évaluation · `L` · sans modèle IA — **prêt après A4, B1**

**Modèle conseillé : Opus** — règles d'évaluation, en données. **ADR :** 0076. **Spec :** §6.1 à §6.3.

**Sous-tâches Haiku** : lancer `npm run test:core`.

**À faire** (tests d'abord)
- `src/core/sim/appraisal.ts` : `rolesFor(event, figures)`, `appraise(event, figure, role, context): Emotion[]` selon les quatre questions OCC ; `emotionToDeltas(emotion, towardId)`.
- `appraisal.rules.ts` : les règles propres à un genre (mort d'un partenaire, d'un enfant, d'un parent ; naissance ; union ; trahison).

**Critères d'acceptation**
- [ ] Deux témoins aux facettes opposées ressentent des émotions différentes du même événement.
- [ ] La mort d'un ennemi donne une joie mauvaise réduite par `compassion` ; celle d'un ami, de la compassion ou un deuil.
- [ ] Un témoin pour qui l'acte est `unthinkable` ressent de l'horreur et perd le respect de l'acteur.
- [ ] Intensités toujours dans 0…100.

---

### ☐ V4-E2 — Humeur, stress, crises et élan · `M` · sans modèle IA — **prêt après E1, C1, E3**

**Modèle conseillé : Opus** — noyau. **Spec :** §6.4, §6.5.

**Sous-tâches Haiku** : libellés des bandes d'humeur et des crises.

**À faire** (tests d'abord), `src/core/sim/mood.ts`
- `mood(figure, now): { value, terms: { label, value, cause }[] }` : calculée, jamais stockée.
- `stressStep(figure, mood, ethicsViolations)` ; `crisisCheck(figure, mood, rng)` (type selon la facette dominante) ; `elanCheck(figure, mood, rng)`.

**Critères d'acceptation**
- [ ] Une figure laissée en paix voit son stress redescendre en un an (banc).
- [ ] Une crise exige stress haut **et** humeur basse (tests aux bornes).
- [ ] Une crise de rage ne choisit jamais un acte `unthinkable`.

---

### ☐ V4-E3 — Les besoins · `M` · sans modèle IA — **prêt après B6, A2**

**Modèle conseillé : Opus** — noyau. **Spec :** psyché §4.

**Sous-tâches Haiku** : lancer `npm run test:core`.

- `src/core/sim/needs.ts` : `decayNeeds(needs, weights, hours)`, `satisfy(needs, advertised)`, `bodyNeedHours(body, now)`.

**Critères d'acceptation**
- [ ] Un besoin de poids 3 passe de 100 à 0 en 7 jours ; poids 1 en 60 (tests).
- [ ] Décroître 30 jours d'un coup = décroître jour par jour (test).

---

### ☐ V4-E4 — Les actions et le score d'utilité · `L` · sans modèle IA — **prêt après E3, B4**

**Modèle conseillé : Opus** — moteur de décision. **ADR :** 0077. **Spec :** §10.1 à §10.4, §10.6.

**Sous-tâches Haiku** : libellés des actions ; lancer les tests.

**À faire** (tests d'abord)
- `src/core/sim/utility.ts` : entrées fermées, courbes (`linear`, `inverse_linear`, `power`, `logistic`, `step`), compensation IAUS, `scoreAction`, `chooseAction(figure, candidates, rng)` (trois meilleures au-dessus de 0,05, tirage pondéré).
- `src/core/sim/actions.full.ts` : les 30 actions des figures complètes, en données, avec annonces de besoins, considérations, éthique, genre d'événement produit.
- `src/core/sim/dreamPlans.ts` : les plans des rêves (trouver, rejoindre, agir).
- Les exclusions : PJ jamais acteur ; figure figée jamais actrice ; classe `scene` jamais actrice ; `unthinkable` retirée.

**Critères d'acceptation**
- [ ] Une action `unthinkable` n'est jamais choisie sur 10 000 tirages.
- [ ] Deux personnes opposées dans la même situation choisissent différemment (test).
- [ ] Aucun PJ n'est jamais acteur (test).
- [ ] Le test « un filtre, jamais un trait » (B4) est étendu : identité et orientations ne changent le score d'aucune action hors `court`.

---

### ☐ V4-E5 — Les rêves qui naissent et qui meurent · `M` · sans modèle IA — **prêt après E4, A4**

**Modèle conseillé : Opus** — noyau. **Spec :** psyché §5.

**Sous-tâches Haiku** : lancer les tests.

- `src/core/sim/dreams.ts` : `checkDream(dream, events, state)` → `achieved`, `impossible` ou inchangé, selon la table de la spec ; `dreamsFromEmotion(emotion, figure, rng)` (vengeance, service, rédemption, retrouver) ; un rêve clos en fait naître un autre (`initialDreams`, B6). Écrit `dream_born`, `dream_achieved`, `dream_abandoned`.

**Critères d'acceptation**
- [ ] Chaque type a ses tests d'atteinte et d'impossibilité.
- [ ] Un rêve `custom` n'est jamais clos par le moteur.

---

### ☐ V4-E6 — Figures légères et complètes · `L` · sans modèle IA — **prêt après A3, C1, D3**

**Modèle conseillé : Opus** — volume, cohérence, création de fiches. **ADR :** 0078. **Spec :** §4.

**Sous-tâches Haiku** : lancer les tests et résumer les échecs.

**À faire**
- `src/core/sim/tiers.ts` (tests d'abord) : `shouldPromote`, `shouldDemote`, `promote(light, events, seed)` (reconstitution déterministe), `demote(full)` (trois souvenirs longs résumés dans `links`), le plafond et l'ordre de rétrogradation.
- Service : la promotion crée la fiche par `promotion.ts` (visibilité `gm`) et les lignes `entity_attitudes`.

**Critères d'acceptation**
- [ ] Promouvoir deux fois la même figure légère au même instant donne deux états identiques.
- [ ] Le plafond n'est jamais dépassé ; la figure rétrogradée est la moins pertinente.
- [ ] Une figure rétrogradée garde sa fiche et ses actes.

---

### ☐ V4-E7 — L'intime · `M` · sans modèle IA — **prêt après C3, B4, H1**

**Modèle conseillé : Opus** — données sensibles, règle absolue des mineurs. **ADR :** 0073. **Spec :** §8.5.

**Sous-tâches Haiku** : lancer les tests.

- `src/core/sim/intimacy.ts` : croissance des attirances (filtre `canBeAttracted`, réglage `romance_simulation`, âge adulte), actions `court`, `romance_began`, union et accord d'exclusivité, réactions selon l'orientation relationnelle (table de la spec), stress d'incompatibilité.

**Critères d'acceptation**
- [ ] **Aucune** attirance ni action intime ne concerne jamais une personne sous l'âge adulte, quels que soient les réglages (test exhaustif sur un banc de 1 000 figures).
- [ ] Aucune attirance contre une orientation, ni quand la table l'a désactivée.
- [ ] `infidelity` n'apparaît que si l'exclusivité a été convenue.
- [ ] Chaque orientation relationnelle a son test de réaction.

---

### ☐ V4-E8 — La vie des figures légères · `M` · sans modèle IA — **prêt après E4, C4**

**Modèle conseillé : Opus** — noyau ; sert aussi la génération. **Spec :** §10.5.

**Sous-tâches Haiku** : lancer les tests.

- `src/core/sim/actions.light.ts` : les 13 actions mensuelles ; `mortality(age, culture, violence, rng)`.

**Critères d'acceptation**
- [ ] Sur 300 ans, une population de départ de 500 ne s'éteint ni n'explose sans cause (garde : entre ×0,3 et ×5, paramètres moyens).
- [ ] Une succession suit chaque mort de chef.

---

### ☐ V4-E9 — Le pas de simulation · `L` · sans modèle IA — **prêt après E1 à E8, A6, C5, H1**

**Modèle conseillé : Opus** — l'orchestration de tout ; quotas ; transactions.

**Sous-tâches Haiku** : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**À faire**
- `src/core/sim/steps.ts` : les fonctions de pas branchées dans `advanceWorld` (A2). Pas horaire et quotidien : besoins, choix d'action, événements, évaluation des témoins, souvenirs, consolidation, revécus, fondateurs, interactions, croyances, liens, rêves, stress, crises. Pas mensuel : vie légère. Puis promotions et rétrogradations.
- Sortie : un lot d'**éléments** (figure, relation, lieu) avec leurs dépendances et l'état `before` (ADR 0079).
- `src/server/services/simulation.ts` : lit l'état (lectures groupées), ajoute les brouillons du pont (A6), appelle le noyau, écrit en **une transaction** en mode `auto` ; reprend au `cursor`. Branché sur `advanceSceneTime`, les repos et les voyages. Rafraîchit les projections des PJ (H1).

**Critères d'acceptation**
- [ ] Même état, même graine, même durée → même lot (test d'intégration sur un monde factice).
- [ ] Une erreur au milieu ne laisse aucun état à moitié écrit.
- [ ] Simulation `off` : avancer le temps n'écrit rien.

---

### ☐ V4-E10 — Raconter ce que le monde a fait · `M` · **avec modèle IA** — **prêt après E9, B9**

**Modèle conseillé : Opus** — contexte du modèle, audience. **Spec :** §15.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- Le contexte du tour reçoit les événements que le PJ **croit** depuis le dernier récit (dans leur version crue) et les changements visibles chez les figures présentes. Encadrés comme donnée (règle 10).

**Critères d'acceptation**
- [ ] Un événement inconnu du PJ n'entre jamais dans un contexte lu par le joueur (test).
- [ ] Vérifié en direct : un PNJ revu après une semaine de jeu se comporte selon ce qui lui est arrivé entre-temps.
