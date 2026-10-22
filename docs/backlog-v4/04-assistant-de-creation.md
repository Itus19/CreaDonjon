# Lot D — L'assistant de création

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Une psyché à la richesse de Dwarf Fortress ne se saisit pas curseur par curseur. Un **questionnaire** la remplit : des questions, des réponses possibles, et chaque réponse pousse quelques facettes, valeurs, besoins ou rêves. Son ancêtre est la diseuse de bonne aventure d'*Ultima IV*, qui déterminait la classe par des dilemmes moraux.

**Un seul mécanisme, trois usagers** : le joueur pour son PJ, le MJ pour un PNJ, le moteur quand il crée une personne en solo ou pendant la génération du monde.

---

### ☐ V4-D1 — Le questionnaire, en données · `M` · sans modèle IA — **à concevoir**

**Modèle conseillé : Opus** — format de données, et une question de règle (où vit le contenu).

**Sous-tâches Haiku** : aucune avant la conception.

**À décider**
- **Le format** : une question (texte, famille), ses réponses (texte, effets sur les couches, en deltas bornés), des conditions facultatives (ne poser cette question que si…), des **parcours** (court : une dizaine de questions ; long : plusieurs dizaines).
- **Les effets** passent par le même amortissement que le reste : vingt réponses courageuses ne collent pas une facette à +100.
- **Où vit le questionnaire par défaut** : il est écrit pour CreaDonjon, pas tiré d'un livre. Est-ce un contenu suivi par Git (comme les libellés) ou une donnée importée (comme les règles) ? À trancher au regard de `CLAUDE.md` (« le contenu de règles est de la donnée »). Les questionnaires propres à un monde vivent en base.
- **Ce que le questionnaire ne touche pas** : l'identité et les orientations (B4) se choisissent directement, jamais par déduction.

**Critères d'acceptation**
- [ ] Décision écrite (ADR ou section de `specs/psyche-v4.md`), découpage confirmé.

---

### ☐ V4-D2 — Appliquer des réponses · `M` · sans modèle IA — **prêt après D1 et B2**

**Modèle conseillé : Opus** — noyau, tests d'abord.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

`applyAnswers(seedPsyche, questionnaire, answers): seedPsyche` dans `src/core/psyche`, pur.

**Critères d'acceptation**
- [ ] Mêmes réponses → même psyché.
- [ ] Aucune facette ne sort de ses bornes, quel que soit le parcours (test exhaustif sur un questionnaire factice).
- [ ] Une réponse sans effet sur une couche ne la touche pas.

---

### ☐ V4-D3 — Le questionnaire du joueur · `M` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : D2.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Proposé à la création d'un PJ (après l'identité, V3-Z1), et rejouable plus tard.
- Une question par écran sur téléphone ; on peut revenir en arrière.
- À la fin : la psyché obtenue, en bandes nommées, **réglable à la main** avant de valider. Le questionnaire donne un point de départ, pas un verdict.

**Critères d'acceptation**
- [ ] Parcours court tenu en moins de cinq minutes, mesuré par l'auteur.
- [ ] Utilisable à 375 px.

---

### ☐ V4-D4 — Le questionnaire du MJ · `M` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : D2, D5.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Depuis une fiche de PNJ : parcours court, parcours long, ou **« compléter au hasard »** (D5) pour ce qui n'a pas été répondu.
- Le MJ peut partir d'un archétype (`archetype.ts`) puis affiner par questions.

**Critères d'acceptation**
- [ ] Un PNJ complet en moins de deux minutes avec le parcours court et le complément au hasard.

---

### ☐ V4-D5 — Le moteur répond lui-même · `S` · sans modèle IA — **prêt après D2 et A2**

**Modèle conseillé : Opus** — tirage déterministe ; utilisé par la génération du monde.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

- Le moteur choisit les réponses à partir d'un archétype, d'une culture d'origine (facultative, lot G) et d'un tirage dérivé (A2). **Aucun appel de modèle.**
- Sert au MJ (« compléter au hasard »), au solo (une personne promue, E6) et à la génération (lot G).

**Critères d'acceptation**
- [ ] Même graine et mêmes clés → même personne.
- [ ] Sur 1 000 personnes tirées, la distribution des bandes de chaque facette n'est pas dégénérée (pas de facette toujours neutre, pas d'extrêmes majoritaires).

---

### ☐ V4-D6 — Écrire ses propres questions · `M` · sans modèle IA — **après D3, si le besoin se confirme**

**Modèle conseillé : Sonnet**, sur le formulaire engendré par les schémas Zod (comme l'éditeur de déclencheurs, V3-A5).

**Sous-tâches Haiku** : libellés.

Un MJ ajoute des questions à son monde, ou un questionnaire entier (une culture, un ordre religieux). À ne pas commencer avant que le questionnaire par défaut ait servi.

**Critères d'acceptation**
- [ ] Une question ajoutée par le MJ apparaît dans les parcours de son monde, et seulement de son monde.
