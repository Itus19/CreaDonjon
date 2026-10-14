

---

### ☑ V3.1-96 — Chronologie : portée, événements directs, naissances et morts (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0048)**

**Modèle conseillé : Opus** — forme d'une donnée de bloc, une fiche
système, une agrégation filtrée côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/schemas/blocks/timeline.ts`,
`src/server/services/timeline.ts` (`getWorldTimeline`), la route
`timeline-promote`. **Dépend de** : V3.1-74 (dates de naissance et de mort).

**À trancher, ADR à l'appui** (les trois points de la décision du 9 octobre)
1. **La portée** d'une entrée de chronologie : champ `scope` parmi `major`
   (Monde), `notable` (Région), `detail` (Détail), **optionnel** — absent =
   défaut selon le genre : guerre, catastrophe, fondation → `major` ;
   bataille, découverte, serment, trahison → `notable` ; naissance, mort,
   rencontre → `detail`. Naissances et morts des fiches personnage →
   `detail`. Nouvelle version du schéma de bloc (`__v`), migration des
   données lue par le schéma, pas de réécriture en base.
2. **Où vit un événement ajouté directement** dans la frise générale.
   Proposé : le bloc Chronologie d'une **fiche système « Chronologie du
   monde »**, une par monde, hors des listes du wiki (comme le Livre de
   sessions), plutôt qu'une table nouvelle. À confirmer ou remplacer.
3. **L'agrégation** : `getWorldTimeline` lit aussi les naissances et morts
   des blocs personnage (V3.1-74), **en une requête groupée** (pas de N+1),
   et filtre chaque date par sa visibilité **côté serveur** (règle 5) : une
   date MJ ou privée n'est jamais envoyée à une joueuse.
- Chaque entrée renvoyée dit d'où elle vient (`source` : fiche et bloc, ou
  frise générale, ou naissance / mort d'un personnage) pour « Depuis la
  fiche de… ». Les séances n'y entrent pas.
- Une action serveur pour **changer la portée** d'une entrée (MJ) et pour
  **ajouter un événement** dans la frise générale ou dans une fiche ; Zod.

**Critères d'acceptation**
- [x] ADR ; schéma de bloc versionné ; `docs/SCHEMA.md` à jour si une table
  ou une fiche système naît.
- [x] Une joueuse ne reçoit aucune date qu'elle ne peut pas voir (test).
- [x] Une seule requête pour les naissances et morts d'un monde (test).

**Note de clôture (14 octobre, Opus).** Détail dans l'[ADR 0048](../adr/0048-les-donnees-de-la-chronologie.md), section « Réalisé ».

*Fait* :
- portée (`resolveScope`) et entrées de naissance et de mort (10 tests du noyau) ;
- fiche système `world_timeline` (migration `20261013160000`, appliquée par l'auteur le 14 octobre) ;
- `getWorldTimeline` en une requête, filtrée bloc puis entrée (3 tests) ;
- deux actions serveur Zod : ajouter un événement, changer une portée ;
- `WIKI_HIDDEN_KINDS` pour les fiches système.

*Faille relevée en route, fermée* : un joueur pouvait créer la fiche système avant le MJ. Inscrite au registre de `SECURITE.md`. Le test d'intégration échouait avant la migration et passe après (3/3).

*Restes* : l'écran de la frise (portées, filtres, ajout d'un événement) vient avec V3.1-97 et 98, qui lisent `scope` et `source`.
