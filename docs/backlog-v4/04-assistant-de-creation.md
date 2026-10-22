# Lot D — L'assistant de création

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). ADR : [`0082`](../adr/0082-le-questionnaire.md).*

Un **questionnaire** de dilemmes remplit la psyché, à la manière d'Ultima IV. Un seul mécanisme, trois usagers : le joueur pour son PJ, le MJ pour un PNJ, le moteur pour une personne qu'il crée. Conçu le 22 octobre 2026.

---

### ☐ V4-D1 — Le format et le questionnaire par défaut · `L` · sans modèle IA — **prêt après B1**

**Modèle conseillé : Opus** — écriture des dilemmes et de leurs effets ; c'est du contenu, il se relit avec l'auteur.

**Sous-tâches Haiku** : reporter les textes dans `messages/` ; vérifier que chaque clé d'effet existe.

**À faire**
- `src/core/psyche/questionnaire/schema.ts` : `zQuestion` (`id`, `family`, `answers`, `condition?`), `zAnswer` (`id`, `effects`: 2 à 4 deltas sur facettes ou valeurs, chacun de 5 à 30 en valeur absolue, ou une éthique déplacée d'un cran), `zPath` (`short` : 12 questions, `long` : 40).
- `defaults.ts` : 40 dilemmes **sans bonne réponse**, 3 ou 4 réponses chacun. Le parcours court touche chaque famille de facettes au moins deux fois et au moins 8 valeurs. Textes dans `messages/`.
- Relecture des 40 dilemmes avec l'auteur avant de clore.

**Critères d'acceptation**
- [ ] Couverture du parcours court vérifiée par un test (familles, valeurs).
- [ ] Aucun effet ne vise l'identité ou les orientations (test).
- [ ] L'auteur a relu les dilemmes.

---

### ☐ V4-D2 — Appliquer des réponses · `S` · sans modèle IA — **prêt après D1, B2**

**Modèle conseillé : Opus** — noyau.

**Sous-tâches Haiku** : lancer `npm run test:core`.

- `applyAnswers(seed, questions, answers): Seed` (pur) ; chaque effet passe par `applyDelta`.

**Critères d'acceptation**
- [ ] Mêmes réponses → même psyché.
- [ ] Aucune facette ne sort de ±80 au départ, quel que soit le parcours (test exhaustif sur le parcours court).

---

### ☐ V4-D3 — Le moteur répond lui-même · `S` · sans modèle IA — **prêt après D2, A1, B6**

**Modèle conseillé : Opus** — tirage déterministe ; sert la génération.

**Sous-tâches Haiku** : lancer `npm run test:core`.

- `fillSeed(partial, culture, archetype?, rng): Seed` : les facettes et valeurs non renseignées sont tirées en cloche autour des tendances de la culture (`bellInt`, écarts-types de la spec §1.2) ; éthiques de la culture ; rêves de départ (B6). **Aucun appel de modèle.**
- `answerAtRandom(questions, culture, rng)` : pour le bouton « compléter au hasard » du questionnaire.

**Critères d'acceptation**
- [ ] Même graine → même personne.
- [ ] Sur 1 000 personnes, environ 40 % des facettes et 55 % des valeurs dans la bande neutre (tolérance ±8 points).
- [ ] Deux cultures aux valeurs opposées donnent des populations distinctes (test statistique).

---

### ☐ V4-D4 — Le questionnaire du joueur · `M` · sans modèle IA — **prêt après D2 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Proposé à la création d'un PJ, après l'identité (V3-Z1), et rejouable depuis la fiche.
- Une question par écran sur téléphone, retour arrière possible ; à la fin, la psyché obtenue en bandes nommées, **réglable à la main** avant de valider.

**Critères d'acceptation**
- [ ] Parcours court en moins de cinq minutes (mesuré par l'auteur).
- [ ] Tient à 375 px ; planche à jour.

---

### ☐ V4-D5 — Le questionnaire du MJ · `M` · sans modèle IA — **prêt après D3 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Depuis une fiche de PNJ : un archétype de départ (`archetype.ts`), le parcours court ou long, puis « compléter au hasard » pour le reste.

**Critères d'acceptation**
- [ ] Un PNJ complet en moins de deux minutes (mesuré par l'auteur).

---

### ☐ V4-D6 — Écrire ses propres questions · `M` · sans modèle IA — **après D4, si le besoin se confirme (Sonnet)**

**Modèle conseillé : Sonnet**, sur le formulaire engendré par les schémas Zod (comme V3-A5).

**Sous-tâches Haiku** : libellés.

- Un bloc `questionnaire` sur la fiche `world_lists` (A5) : questions d'un monde, mêlées aux parcours de ce monde seulement.

**Critères d'acceptation**
- [ ] Une question d'un monde n'apparaît jamais dans un autre.
