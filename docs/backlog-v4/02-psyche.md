# Lot B — La psyché

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/psyche-v4.md`](../../specs/psyche-v4.md).*

Passer de « une fiche qui décrit une personne » à « une personne que le moteur peut faire vivre ». Conçu le 22 octobre 2026 : la spec `specs/psyche-v4.md` (V4-B1, ☑) et les ADR 0072 et 0073.

---

### ☐ V4-B1 — Les listes de la psyché dans le noyau · `M` · sans modèle IA — **prêt**

**Modèle conseillé : Opus** — vocabulaire lu par tout le moteur. **Spec :** §2 à §6.

**Sous-tâches Haiku** : reporter les libellés (trois formes d'accord pour les facettes) dans `messages/` ; lancer `npm run test:core`.

**À faire** (tests d'abord)
- `src/core/psyche/keys.ts` : `FACET_KEYS` (50) et `FACET_FAMILIES`, `COMPAT_FACETS`, `VALUE_KEYS` (35), `ETHIC_KEYS` (15), `ETHIC_RESPONSES` (7, ordonnées), `BODY_NEED_KEYS`, `MIND_NEED_KEYS` (25) et leurs sources, `DREAM_TYPES` (19), `EMOTION_KEYS` (22) avec valence. Les clés V2 restent exportées sous `LEGACY_*` pour la conversion (B3).
- `src/core/psyche/bands.ts` étendu : `facetBand`, `valueBand` (verbe de bande), `needBand`, `emotionBand`, `bodyNeedBand(hours, thresholds)`.
- `facetLabel(key, value, agreement)` : la bande dite avec le bon accord.

**Critères d'acceptation**
- [ ] Les comptes sont ceux de la spec (test).
- [ ] Chaque clé a ses libellés dans `messages/`, trois formes pour les facettes (test qui parcourt les listes).
- [ ] Bandes testées aux bornes (−67, −34, −12, 11, 12, 33, 34, 66, 67).

---

### ☐ V4-B2 — Les blocs de graine en version 2 · `M` · sans modèle IA — **prêt après B1**

**Modèle conseillé : Opus** — schémas versionnés. **Spec :** §7.

**Sous-tâches Haiku** : vérifier `publicShare.blockCoverage.test.ts` et le registre des blocs ; lancer les tests.

**À faire**
- `zPersonalityBlockData` et `zWorldviewBlockData` en union `__v: 1 | 2`, lecture toujours rendue en version 2 (conversion de B3). Écriture toujours en version 2.
- Nouveau bloc `culture` (simulation §13.2) : espèce (identifiant d'entrée de ruleset), `facet_tendencies`, `relationship_norm`, table de noms, `adult_age`, `lifespan`. Enregistré au registre (ADR 0023, 0065).
- `zDream`, `zPreference`.

**Critères d'acceptation**
- [ ] Tout bloc `__v: 1` existant se lit sans erreur.
- [ ] Un bloc écrit est toujours en `__v: 2`.
- [ ] Le registre et la couverture du partage public restent verts ; `culture` est couvert.

---

### ☐ V4-B3 — Convertir l'existant · `M` · sans modèle IA — **prêt après B2**

**Modèle conseillé : Opus** — les données réelles de l'auteur. **Spec :** §7.4, §8.

**Sous-tâches Haiku** : compter les blocs `personality`, `worldview` et `relationship` des mondes de l'auteur (compte seulement).

**À faire** (tests d'abord)
- `src/core/psyche/upgradeV1.ts` : `upgradePersonality`, `upgradeWorldview`, `upgradeDeltas` (convertit un `deltas` de `personality_events` aux clés V4), selon les deux tables de la spec.
- Relations : l'axe `attraction_repulsion` garde sa clé et devient « attirance romantique » (libellés) ; ajout de `sexual_attraction_repulsion` et de `familiarity` à `RELATIONSHIP_AXIS_KEYS` ; `zRelationshipBlockData` les accepte, absentes = neutre.
- Le rejeu des `personality_events` (`src/server/services/psyche.ts`) convertit les deltas anciens à la volée.

**Critères d'acceptation**
- [ ] Chaque ligne des deux tables de conversion a son test.
- [ ] Rejouer puis convertir = convertir puis rejouer, sur un journal factice de 50 événements.
- [ ] Une fiche convertie affiche, sur ses facettes correspondantes, la même bande qu'avant.
- [ ] Rien n'est perdu : texte, horizon et visibilité d'une aspiration ; lignes rouges ; notes.

---

### ☐ V4-B4 — Identité et orientations : les données · `M` · sans modèle IA — **prêt après B1**

**Modèle conseillé : Opus** — données sensibles, visibilité, règle « un filtre, jamais un trait ». **ADR :** 0073. **Spec :** §9.

**Sous-tâches Haiku** : libellés des listes dans `messages/`.

**À faire** (tests d'abord)
- Bloc `character` : `gender_identity`, `pronouns_v2`, `sexual_orientation`, `romantic_orientation`, `relational_orientation`, chacun facultatif avec une visibilité (par défaut celle du bloc). Le champ `gender` existant se lit comme `gender_identity` quand celui-ci est absent ; `pronouns` texte reste affiché s'il n'y a pas `pronouns_v2`.
- `src/core/psyche/attraction.ts` : `proposeAttractedTo(orientationKey, identity): GenderGroup[]`, `genderGroupOf(identity): GenderGroup`, `canBeAttracted(subject, target, kind: "romantic" | "sexual"): boolean` (filtre seulement).
- Le test « un filtre, jamais un trait » : pour une même graine, changer identité et orientations ne change ni facettes, ni valeurs, ni poids de besoins (sauf `romance` pour une personne aromantique), ni le score d'aucune action hors `court` (ce dernier point s'ajoute en E4).
- La visibilité de chaque champ est résolue côté serveur (règle 5), comme celle des aspirations.

**Critères d'acceptation**
- [ ] Une fiche sans ces champs s'affiche exactement comme avant.
- [ ] `canBeAttracted` : une personne aromantique, jamais en romantique ; une étiquette personnalisée suit son ensemble réglé à la main.
- [ ] Un champ en visibilité `gm` n'arrive jamais à un joueur (test du service).

---

### ☐ V4-B5 — Identité et orientations : le formulaire · `S` · sans modèle IA — **prêt après B4 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : planche du catalogue.

- Dans l'éditeur du bloc `character` : une section repliée « Identité », avec listes du monde et libellé libre, l'ensemble d'attirance proposé puis modifiable (trois cases), la visibilité de chaque champ.
- Les pronoms : sujet et accord, avec un exemple vivant (« Iel est arrivé·e »).

**Critères d'acceptation**
- [ ] Choisir « bisexuel » coche les trois groupes ; décocher reste possible et s'enregistre.
- [ ] Tient à 375 px ; planche à jour.

---

### ☐ V4-B6 — Poids des besoins et rêves de départ · `S` · sans modèle IA — **prêt après B1**

**Modèle conseillé : Opus** — noyau. **Spec :** §4.2, §5.

**Sous-tâches Haiku** : lancer `npm run test:core`.

**À faire** (tests d'abord)
- `needWeights(facets, values, overrides, romanticOrientation): Record<MindNeedKey, 0|1|2|3>`.
- `initialDreams(facets, values, rng): Dream[]` : la table de naissance des rêves (valeur `power` et `ambition` → `rule` ou `rank` ; `craftsmanship` → `masterwork` ; `martial_prowess` → `legendary_warrior` ; `family` → `found_family` ; `romance` → `fall_in_love` sauf aromantique ; `knowledge` → `discovery` ; `nature` et `curiosity` → `explore` ; `peace` → `peace` ; `wealth` ou `greed` → `acquire`), un ou deux rêves.

**Critères d'acceptation**
- [ ] Les poids suivent la table des sources (test par besoin).
- [ ] Jamais `fall_in_love` pour une personne aromantique.

---

### ☐ V4-B7 — Éditer la graine à la main · `M` · sans modèle IA — **prêt après B2 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Les éditeurs actuels des blocs `personality` et `worldview` passent à la version 2 : facettes par **familles repliées**, un curseur par facette (réutiliser le curseur de pôle existant), valeurs, éthiques (une liste déroulante de réponse par acte), rêves (type, paramètre choisi parmi les fiches, horizon, intensité, texte, visibilité), préférences, poids de besoins forcés.
- En tête : « compléter avec le questionnaire » (lot D) et « compléter au hasard » (D3).

**Critères d'acceptation**
- [ ] Toute la graine se saisit sans quitter la fiche ; tient à 375 px.
- [ ] Une retouche écrit un `personality_events` `seed_edit` (journal V2 conservé).

---

### ☐ V4-B8 — La psyché sur la fiche · `L` · sans modèle IA — **prêt après B2, A3 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche, et c'est la plus importante du lot.

**Sous-tâches Haiku** : planche du catalogue.

- **En tête** : « les cinq qui la définissent » (les facettes les plus marquées), les trois valeurs prioritaires, le rêve actif, l'humeur et sa bande.
- **Deux temps** quand la simulation est active : « au départ » (graine) et « aujourd'hui » (état), l'écart signalé.
- **Pourquoi** : chaque facette ou valeur qui a bougé dit sa cause (le souvenir fondateur et sa date) ; l'humeur se déplie en ses termes (« −12 : en deuil »).
- Besoins et stress en jauges à bandes ; le nombre au survol, pour le MJ seulement.
- Lecture par un service qui fusionne graine et état côté serveur ; un seul chargement (`docs/CABLAGE.md`).

**Critères d'acceptation**
- [ ] Esquisse validée ; tient à 375 px ; planche à jour.
- [ ] Simulation inactive : seule la graine s'affiche, sans emplacement vide.

---

### ☐ V4-B9 — La psyché dans le contexte du modèle · `M` · **avec modèle IA** — **prêt après B1, H1**

**Modèle conseillé : Opus** — contexte du modèle, audience (règle 11). **Spec :** §10.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- `summarizeFigureForPrompt(figure, audience, settings): string` (pur) : le format de la spec §10, cinq facettes, trois valeurs, lignes rouges, rêve, émotion et besoins pressants, attitude envers le groupe, un souvenir marquant, pronoms et accord.
- Branché dans le contexte du tour (V3-B3), encadré comme donnée (règle 10).
- La consigne `intimate_narration` est transmise.

**Critères d'acceptation**
- [ ] Une donnée « MJ seul » ou un rêve `gm` n'entre jamais dans un contexte lu par un joueur (test).
- [ ] Plafond de tokens par figure fixé après mesure, et tenu (test sur la figure la plus chargée du jeu d'essai).
- [ ] Vérifié en direct sur trois tours : pronoms et accords respectés.
