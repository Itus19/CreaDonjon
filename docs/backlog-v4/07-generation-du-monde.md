# Lot G — La génération du monde

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/simulation-monde.md`](../../specs/simulation-monde.md) §13.*

En solo, un monde **naît avec une histoire**. En mode MJ, c'est une option. On fait tourner la vie des figures légères pendant des décennies ou des siècles ; une **graine** régénère le même monde de départ. Conçu le 22 octobre 2026 (ADR 0081). Pas de cartes en V4.

---

### ☐ V4-G1 — Graine et paramètres · `S` · sans modèle IA — **prêt après A1**

**Modèle conseillé : Opus** — migration, déterminisme. **ADR :** 0081. **Spec :** §13.1, §13.4.

**Sous-tâches Haiku** : régénérer les types ; reporter le volume par âge dans `docs/QUOTAS.md`.

- Migration `world_generations` (RLS : propriétaire du monde).
- `src/core/sim/generation/params.ts` : `zWorldGenParams`, les quatre préréglages, `GENERATOR_VERSION`, `tablesFingerprint(tables)` (hachage stable du contenu des tables utilisées).

**Critères d'acceptation**
- [ ] Une même table donne la même empreinte ; une cellule changée, une autre.
- [ ] Paramètres hors bornes refusés.

---

### ☐ V4-G2 — Peuples, cultures et lieux · `L` · sans modèle IA — **prêt après G1, B2, D3**

**Modèle conseillé : Opus** — noyau de la génération. **Spec :** §13.2.

**Sous-tâches Haiku** : lancer `npm run test:core`.

- `src/core/sim/generation/peoples.ts` : un peuple par espèce jouable du ruleset (ou tirée parmi elles), avec culture (valeurs, éthiques, tendances de facettes, norme relationnelle, noms par le générateur Noms) ; lieux rattachés et dimensionnés ; figures fondatrices légères (D3) ; identifiants par `hash128`.

**Critères d'acceptation**
- [ ] Même graine et mêmes paramètres → mêmes peuples, lieux et figures.
- [ ] Deux peuples aux cultures opposées ont des populations distinctes (test statistique).

---

### ☐ V4-G3 — La boucle d'histoire · `L` · sans modèle IA — **prêt après G2, E8**

**Modèle conseillé : Opus** — noyau, bornes, performance. **Spec :** §13.3.

**Sous-tâches Haiku** : lancer les tests ; reporter les temps mesurés.

- `src/core/sim/generation/history.ts` : un pas par mois (vie légère E8, monstres, querelles et raids, migrations, fondations, successions), événements `origin = 'generation'`, puis promotion des figures qui comptent au départ (au plus 60).
- Rend des **morceaux** de dix années (figures, événements, lieux) pour l'envoi (G4).

**Critères d'acceptation**
- [ ] Même graine → même histoire, octet pour octet.
- [ ] Aucun peuple ne s'éteint ni n'explose sans cause lisible (gardes de E8).
- [ ] Temps mesuré pour chaque âge de monde dans un navigateur de bureau et un téléphone récent.

---

### ☐ V4-G4 — Le Web Worker et l'envoi par morceaux · `L` · sans modèle IA — **prêt après G3, A3**

**Modèle conseillé : Opus** — route, validation, sécurité, idempotence. **Spec :** §13.4.

**Sous-tâches Haiku** : remplir la liste de contrôle de `docs/SECURITE.md` pour la route ; lancer les tests.

- Un *Web Worker* qui charge le noyau et fait tourner G3, avec annulation et progression.
- `POST /api/worlds/[id]/generation/chunks` : Zod (règle 4), propriétaire du monde seulement, idempotent par numéro de morceau, écritures groupées par `src/server/repos/`. `world_generations.progress` tient les morceaux reçus.
- Reprise : un morceau déjà reçu est ignoré ; une génération annulée se nettoie.

**Critères d'acceptation**
- [ ] Envoyer deux fois le même morceau n'écrit rien la seconde fois (test d'intégration).
- [ ] Un non-propriétaire est refusé ; un morceau mal formé est refusé sans rien écrire.

---

### ☐ V4-G5 — L'écran de génération · `M` · sans modèle IA — **prêt après G4 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- À la création d'un monde solo (obligatoire) ou depuis les réglages du monde (MJ, facultatif) : préréglages, paramètres, graine (tirée ou saisie), progression, puis choix du lieu de départ en solo.

**Critères d'acceptation**
- [ ] Esquisse validée ; tient à 375 px.

---

### ☐ V4-G6 — La chronique et les légendes · `M` · sans modèle IA — **prêt après G4, C5 (Sonnet)**

**Modèle conseillé : Sonnet**, après une petite part Opus (source de la Chronologie). **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : planche du catalogue.

- `getWorldTimeline` (ADR 0048) gagne la source `simulation` : les événements `major`, et `notable` pour le MJ ; pour un joueur, ceux qu'il croit (H1).
- Un écran **Légendes** pour le MJ : par figure (vie, actes, liens), par lieu (fondation, chefs successifs), par peuple. Une figure historique peut devenir une fiche (promotion existante), sa biographie tirée de ses actes.

**Critères d'acceptation**
- [ ] Un joueur ne voit jamais un événement qu'il ne croit pas (test côté serveur).
- [ ] Esquisse validée.

---

### ☐ V4-G7 — Réutiliser une graine · `S` · sans modèle IA — **prêt après G5 (Sonnet)**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés.

- La graine d'un monde s'affiche et se copie ; « nouveau monde depuis cette graine » régénère l'état de départ seulement. Avertissement si la version du générateur ou les tables diffèrent.

**Critères d'acceptation**
- [ ] Même version : même monde de départ (test d'intégration).

---

### ☐ V4-G8 — Générer pour un MJ · `S` · sans modèle IA — **prêt après G5, F2 (Sonnet)**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés.

- Dans un monde qui a déjà des fiches, la génération **ajoute autour**, sans toucher aucune fiche existante. Le MJ choisit si les figures générées sont figées.

**Critères d'acceptation**
- [ ] Aucune entité existante modifiée (test).
