# Lot A — Les fondations de la simulation

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Ce lot ne simule encore rien. Il pose ce sur quoi tout le reste s'appuie : où vit l'état d'une personne, comment le hasard se dérive, comment le temps fait avancer le monde, où s'écrit ce qui arrive. **Tout le lot est sans modèle IA.**

---

### ☐ V4-A1 — La psyché vit dans la partie · `M` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — schéma, RLS, renverse une décision de `specs/psyche-pnj.md` §6.

**Sous-tâches Haiku** : aucune avant l'ADR ; ensuite, recenser les lectures de `personality`/`worldview` hors `src/server/services/psyche.ts`.

Aujourd'hui, `personality` et `worldview` appartiennent à l'entité, tous mondes confondus. Une personne que la simulation transforme doit être transformée **dans cette partie**, pas partout.

**À décider dans l'ADR**
- Le bloc (`personality`, `worldview`, puis les blocs du lot B) devient **la graine** : l'état de départ, saisi par le MJ, le joueur ou le questionnaire.
- **L'état courant** vit dans une table de campagne (nom à fixer, par exemple `psyche_states`), une ligne par (campagne, entité). C'est un cache : il se reconstruit en rejouant le journal depuis la graine (critère transverse 8).
- Par campagne ou par monde ? Recommandation : par campagne (`00-cadre.md` §6).
- Sans simulation active (lot F), l'état courant **est** la graine, sans copie : rien ne change pour un MJ qui n'active rien.
- Ce que voit l'écran de la fiche : la graine (onglet « au départ ») et l'état courant (« aujourd'hui »), avec l'écart.

**Critères d'acceptation**
- [ ] ADR écrit ; `docs/SCHEMA.md` et `specs/psyche-pnj.md` §6 annotés.
- [ ] Le ticket est découpé en tickets prêts (migration, repo, service, écran), écrits ici.

---

### ☐ V4-A2 — Le hasard dérivé · `S` · sans modèle IA — **prêt**

**Modèle conseillé : Opus** — noyau du moteur ; c'est lui qui rend l'effet papillon lisible.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

Un flux aléatoire global consommé dans l'ordre fait qu'un seul tirage de plus décale tous les suivants : le monde entier change d'un coup. Il faut que chaque tirage soit une fonction de son **motif**.

- `deriveRng(seed, ...keys: (string | number)[]): Rng` dans `src/core/sim/random.ts`. Les clés sont, par exemple, la date de jeu, l'identifiant stable de l'entité, et un motif (`"need_decay"`, `"dream_pick"`).
- Hachage écrit à la main (une fonction de mélange 32 bits documentée, par exemple de la famille SplitMix ou MurmurHash3 finaliseur), **sans dépendance**. Le choix et sa source sont notés en commentaire.
- `Rng` reste l'interface de `src/core/dice/rng.ts` : tout ce qui sait lancer des dés sait consommer un flux dérivé.

**Critères d'acceptation**
- [ ] Mêmes clés → même suite, sur 10 000 tirages (test).
- [ ] Changer une seule clé change la suite ; changer l'ordre des clés aussi.
- [ ] Ajouter un tirage sous un motif ne change **aucun** tirage d'un autre motif (le test qui définit l'effet papillon).
- [ ] Distribution : un test du χ² grossier sur 100 000 tirages d'un d20 reste dans la tolérance.
- [ ] Aucun import hors `src/core`.

---

### ☐ V4-A3 — Le temps qui passe est un événement · `M` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — renverse `specs/psyche-pnj.md` §1 ; quotas.

**Sous-tâches Haiku** : aucune avant l'ADR.

Remplace « pas de dérive de fond, pas de tâche périodique » par : **le monde est rattrapé quand le temps avance en jeu**. Toujours aucune tâche de fond, aucun minuteur : rien ne tourne quand personne ne joue.

**À décider dans l'ADR**
- **Qui fait avancer le temps** : un tour solo (`advanceSceneTime`), un repos, un voyage, le simulateur du MJ (F3), la génération (lot G). Une seule porte d'entrée dans le noyau : `advanceWorld(state, from, to, budget)`.
- **Le rattrapage paresseux** : chaque entité simulée porte la date de jeu de sa dernière mise à jour. Une entité lointaine n'est rattrapée que lorsqu'elle redevient pertinente (le joueur s'en approche, le MJ l'ouvre, un événement la touche).
- **Le pas selon la distance** (la « lunette ») : figure complète proche du joueur, à l'heure ou au jour ; figure légère, à la semaine ou au mois. La définition de la « distance » (même lieu, relation directe avec un PJ, découverte, marquée importante par le MJ) est fixée ici.
- **Ce qui a été observé est figé** : la simulation ne contredit jamais un fait déjà découvert par un joueur ; elle ne peut que lui donner une suite.
- Les bornes par appel (entités, événements, durée de calcul) et ce qui se passe quand elles sont atteintes : on s'arrête proprement et on reprend au prochain appel.

**Critères d'acceptation**
- [ ] ADR écrit ; `specs/psyche-pnj.md` §1 reçoit un bandeau qui pointe vers lui.
- [ ] Découpage en tickets prêts (horloge par entité, `advanceWorld`, branchements).

---

### ☐ V4-A4 — Le journal du monde · `M` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — schéma, RLS, visibilité.

**Sous-tâches Haiku** : aucune avant l'ADR ; ensuite, vérifications et résumé des échecs.

Tout ce que la simulation fait arriver s'écrit dans **un journal en ajout seul**, distinct de `session_events` (le journal de la table) : c'est la matière des souvenirs (lot C), de la chronique (G5) et de ce que l'IA raconte.

**À décider dans l'ADR**
- Table (nom à fixer, par exemple `world_events`) : campagne, date de jeu, genre d'événement (vocabulaire fermé), acteurs, cibles, lieu, données typées par genre, **cause** (l'événement qui l'a provoqué, pour rejeter une chaîne entière en F4), origine (`simulation`, `generation`, `gm`, `player`), visibilité, graine du tirage.
- Le vocabulaire fermé de départ, minimal, et la règle pour l'étendre (comme les événements des déclencheurs : un ADR par ajout).
- Le lien avec la frise (ADR 0048) : un événement d'une portée suffisante apparaît dans la Chronologie du monde, avec sa portée résolue.
- Le lien avec les découvertes : un joueur ne voit un événement que s'il l'a vécu, appris ou découvert.
- Le volume : estimation pour un monde de 200 ans (lot G), et purge éventuelle des événements `detail` jamais référencés.

**Critères d'acceptation**
- [ ] ADR écrit, `docs/SCHEMA.md` mis à jour, découpage en tickets prêts.

---

### ☐ V4-A5 — Le budget de la simulation · `S` · sans modèle IA — **prêt après A3 et A4**

**Modèle conseillé : Opus** — quotas.

**Sous-tâches Haiku** : reporter les chiffres mesurés dans `docs/QUOTAS.md`.

- Un banc de mesure dans le noyau : un monde factice de 50, 500 et 5 000 figures avancé d'un jour, d'un mois, d'un an. Temps de calcul, nombre d'événements et de lignes produits.
- Les plafonds par appel (A3) sont fixés **d'après ces mesures**, pas devinés.
- `docs/QUOTAS.md` reçoit une section « Simulation » : ce que coûte un tour, un repos long, une semaine avancée par le MJ, une génération de monde.

**Critères d'acceptation**
- [ ] Les trois tailles sont mesurées et notées.
- [ ] Un tour solo ordinaire reste sous le budget de temps de fonction fixé dans `docs/QUOTAS.md`, rattrapage compris.

---

### ☐ V4-A6 — Les listes du monde · `M` · sans modèle IA — **à concevoir**

**Modèle conseillé : Opus** — mécanisme commun à quatre usages (règle des trois atteinte).

**Sous-tâches Haiku** : aucune avant la conception.

Facettes, valeurs, besoins, rêves, émotions, liens nommés, identités, orientations : des **listes fermées que le moteur sait lire**, livrées par défaut, et **extensibles par monde** (`specs/psyche-pnj.md` §8 l'annonçait déjà pour les pôles : « un univers de cour ajoutera loyauté ↔ ambition »).

**À décider**
- Où vit l'extension d'un monde (un bloc sur une fiche système du monde, comme `world_timeline` ; ou les réglages du monde).
- Ce qu'une entrée ajoutée doit déclarer pour que le moteur s'en serve (une facette nouvelle sans effet sur aucune action est permise : elle n'est alors que descriptive, et l'écran le dit).
- Retirer une entrée par défaut : interdit, on la **masque**. Les données existantes restent lisibles.
- Un libellé libre en plus de la valeur choisie, pour les listes d'identité (B4).

**Critères d'acceptation**
- [ ] Décision écrite (ADR ou section de `specs/psyche-v4.md`), découpage en tickets prêts.
