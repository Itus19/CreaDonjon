# Backlog VM — 1. Les gens

Spécification : `specs/vie-du-monde.md` §3 à §5, §9. Dépend de la PR #17.

### ☐ VM-1 — Archétypes de vie et `position()` · `M` · sans modèle IA

**Modèle conseillé : Opus** (noyau pur, tests d'abord).

- Format d'archétype (§4.1) en données, Zod ; liste de départ d'une quinzaine (§4.2) dans `src/core/worldgen/archetypes.ts`.
- `position(personne, jour, heure)` (§5) : mort, agenda, état, séjour, routine ; gigue et jours d'absence à graine fixe (`deriveSeed`) ; créneaux à l'heure (décision 2) ; jours de la semaine du calendrier du monde.
- Les pôles et les centres d'intérêt teintent les probabilités, bornés (§4.3) : branché quand VM-12 existe, neutre sinon.

**Critères d'acceptation**
- [ ] Même graine, même jour, même heure : même position, toujours.
- [ ] Un pilier de bar est à la taverne environ 8 soirs sur 10 sur un an simulé ; un garde suit ses tours ; un voyageur hors séjour n'est pas en ville.
- [ ] Un agenda l'emporte sur la routine, un état sur l'agenda, la mort sur tout.

**Sous-tâches Haiku** : recenser les usages de `dayPeriod` (PR #17) à remplacer par l'heure.

### ☐ VM-2 — Les gens attachés à un lieu · `M` · sans modèle IA

**Modèle conseillé : Opus.**

- Gabarits de peuplement par type de lieu et taille de ville (§3, décision 6) : de l'ermite seul à douze personnes attachées au plus.
- Quatre attaches : personnel, habitués, logés, de passage (arrivée et durée de séjour tirées par semaine).
- Étend `materializeOccupants` (PR #17) : les clients « par moment » deviennent des gens attachés à l'heure, plus les clients d'un soir.
- Une entité du wiki reliée au lieu par `works_at` remplace l'occupant de même rôle (décision 4) : migration qui ajoute `works_at` à la contrainte de `relations` et à `RELATION_TYPES`.

**Critères d'acceptation**
- [ ] Revenir dans la même auberge redonne le même personnel et les mêmes habitués ; une personne de passage repart à la fin de son séjour.
- [ ] Un PNJ relié par `works_at` apparaît à la place de l'occupant tiré.
- [ ] Migration appliquée sur une copie locale, `docs/SCHEMA.md` §8 à jour.

### ☐ VM-3 — La présence calculée dans le solo · `M` · sans modèle IA

**Modèle conseillé : Opus.**

- Le service de scène calcule les présents d'un lieu à l'heure courante (VM-2 + `position()`) au lieu de la liste posée à la main ; chacun dans sa pièce (V3.2-28 : le personnel au comptoir, les logés dans leur chambre la nuit).
- À chaque tour qui fait passer du temps : différence avant / après ; arrivées et départs envoyés à l'IA comme **faits établis** (§9).
- Le panneau de scène garde la main : ajouter quelqu'un à la main reste possible (une entrée d'agenda « ici jusqu'à… »).
- Lieux faits main sans bloc ville : population et richesse déduites de l'infobox (décision 2).

**Critères d'acceptation**
- [ ] Rejoué : dormir dix heures à l'auberge, le hall du matin n'a pas les mêmes gens que celui du soir.
- [ ] Une ligne de tour dit « le sergent sort », et la narration le raconte sans l'inventer.
- [ ] Coût mesuré : une requête de plus par tour au plus (`docs/QUOTAS.md`).

### ☐ VM-4 — L'agenda : exceptions datées · `M` · avec modèle IA (pour vérifier)

**Modèle conseillé : Opus** (migration, RLS, sortie de l'IA).

- Table des exceptions datées et des états (§5.1, §11) : `who` (entité ou graine d'occupant), `from`, `to`, `where`, `reason`, `kind` (agenda ou état) ; RLS par monde, refus par défaut.
- L'IA propose un rendez-vous dans la narration (`schedule`) ; le moteur valide (personne et lieu existants, créneau futur et borné) et l'inscrit (règle absolue 9 : passe par `ai_proposals`).
- Saisie à la main par le MJ ; une exception passée s'efface.

**Critères d'acceptation**
- [ ] « Mabelle ira au marché demain à l'aube » : le lendemain à 6 h, elle n'est pas au comptoir.
- [ ] Un rendez-vous proposé pour une personne ou un lieu inconnus est refusé et consigné.
- [ ] Liste de contrôle `docs/SECURITE.md` passée pour la table et la route.

### ☐ VM-9 — L'archétype de vie sur la fiche, déduit du métier · `S` · sans modèle IA

**Modèle conseillé : Sonnet**, une fois VM-1 fait.

- L'archétype visuel actuel (`src/core/psyche/archetype.ts`, deux pôles dominants) est **remplacé** par l'archétype de vie, à la même place et avec la même structure (nom, couleur de jeton) (décision 3).
- Champ `routine` du bloc `personality` ; proposé depuis le métier, corrigeable à la main ; sans métier lisible : « reste où il est ».

**Critères d'acceptation**
- [ ] Une fiche « aubergiste » montre « Personnel de lieu » ; le changer à la main est gardé.
- [ ] Planche du catalogue à jour.

**Sous-tâches Haiku** : libellés dans `messages/`, planche du catalogue.

### ☐ VM-10 — Les absents : témoignages et personnalités publiques · `M` · avec modèle IA

**Modèle conseillé : Opus.**

- Personnalités publiques (§3.1) : découverte `mentioned` d'avance pour quiconque vit dans leur domaine.
- Un PNJ qui parle d'un absent : le moteur le retrouve ou le matérialise par sa graine, crée sa page (`mentioned`) et y note un **témoignage attribué** (« selon Mabelle… »), jamais un fait. Un détail qui contredit la simulation est refusé, ou marqué rumeur fausse si l'informateur a une raison de mentir (franchise, VM-12).

**Critères d'acceptation**
- [ ] Demander « où trouver le forgeron ? » crée sa page avec le témoignage, et aller voir confirme ou dément.
- [ ] La vérité ne quitte jamais le serveur (règle absolue 5).
