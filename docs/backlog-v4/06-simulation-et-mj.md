# Lot F — La simulation au service du MJ

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md). Spec : [`specs/simulation-monde.md`](../../specs/simulation-monde.md) §11, §12.*

Un seul moteur, deux usages. En solo, il fait vivre le monde de lui-même. Pour un MJ humain, c'est un **outil** qu'il active ou non, qui propose, et dont il accepte ou rejette chaque élément. Conçu le 22 octobre 2026 (ADR 0079).

---

### ☐ V4-F1 — Activer la simulation · `M` · sans modèle IA — **prêt après H1, A3, E6**

**Modèle conseillé : Opus** — création de figures en masse, droits.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

**À faire**
- Le réglage `sim.mode` (`off`, `propose`, `auto`) dans les réglages de table (H1), réservé au MJ ; défaut `off` en campagne, `auto` en solo.
- À la première activation : une figure pour chaque entité qui a un bloc `personality` ou `character` (complète si `near` ou liée à un PJ, légère sinon), état courant initial = état de départ (complété par D3 pour ce qui manque, avec l'accord du MJ). Une case « garder mes PNJ tels quels » les crée **figées** (F2).

**Critères d'acceptation**
- [ ] `off` : aucune écriture de simulation (test).
- [ ] L'activation crée les figures en une transaction, par lots groupés (pas une requête par entité).
- [ ] Un joueur ne peut pas changer le mode.

---

### ☐ V4-F2 — Une figure figée · `S` · sans modèle IA — **prêt après F1 (Sonnet)**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés.

- Sur la fiche, pour le MJ : « figer pour la simulation », et « peut encore se souvenir ».

**Critères d'acceptation**
- [ ] Une figure figée n'est jamais actrice ni transformée (test du noyau déjà écrit en E4, vérifié ici de bout en bout).

---

### ☐ V4-F3 — Les lots proposés · `M` · sans modèle IA — **prêt après E9**

**Modèle conseillé : Opus** — dépendances, transactions. **ADR :** 0079. **Spec :** §12.

**Sous-tâches Haiku** : lancer les tests et résumer les échecs.

- Mode `propose` : le service écrit le lot `pending_review` et ses éléments sans rien appliquer.
- `acceptItem`, `rejectItem` (rejette la descendance), `editItemSummary`, `closeBatch` : actions serveur validées par Zod, réservées au MJ.
- Tant qu'un lot attend, `advanceWorld` refuse de repartir et le dit.

**Critères d'acceptation**
- [ ] Tout accepter produit exactement l'état du mode `auto` (test).
- [ ] Rejeter un élément rejette toute sa descendance, et rien d'autre (test).

---

### ☐ V4-F4 — Le simulateur · `L` · sans modèle IA — **prêt après F3 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche, à valider avec l'auteur.

**Sous-tâches Haiku** : planche du catalogue ; libellés.

- Dans les outils du MJ : choisir une durée (un jour, une semaine, une saison, ou jusqu'à une date) et une portée facultative (un lieu, une faction, des figures) ; lancer ; voir la progression (reprise par `cursor`).
- Le résultat **par élément** : ce que la personne a fait, ressenti, ce qui a changé en elle ; accepter, rejeter (« rejeter ceci rejette aussi 3 éléments qui en découlent »), modifier le résumé et la portée.
- Le tiroir de conséquences du solo (V3-C5) montre la même chose, en court.

**Critères d'acceptation**
- [ ] Esquisse validée ; tient à 375 px ; un seul chargement par lot (`docs/CABLAGE.md`).

---

### ☐ V4-F5 — Défaire le dernier lot · `M` · sans modèle IA — **prêt après F3**

**Modèle conseillé : Opus** — journal en ajout seul, compensations. **Spec :** §12.

**Sous-tâches Haiku** : lancer les tests.

- `undoItem(item)` sur un élément appliqué du **dernier** lot : restaure `before`, écrit les compensations (`compensates_id`, deltas inverses dans `attitude_events` et `personality_events`). Refusé sur un lot ancien, avec la raison.
- V3-F2 (annuler un tour) appelle `undoBatch` sur le lot du tour.

**Critères d'acceptation**
- [ ] Défaire puis rejouer le journal donne un état cohérent (test).
- [ ] Un élément d'un lot ancien n'est pas défaisable (test).

---

### ☐ V4-F6 — Ce qui bouge dans le monde · `M` · sans modèle IA — **prêt après E9 (Sonnet)**

**Modèle conseillé : Sonnet.** **Esquisse :** première sous-tâche.

**Sous-tâches Haiku** : planche du catalogue.

- Un tableau pour le MJ : rêves en cours et leur avancée, tensions (paires proches de la rupture, figures en désaccord de valeurs avec leur faction), stress et besoins critiques, figures qui se souviennent le plus des PJ, réputations des PJ par lieu. Utile même simulation désactivée (il lit les états de départ).

**Critères d'acceptation**
- [ ] Esquisse validée ; chargement mesuré (`docs/CABLAGE.md`, `docs/QUOTAS.md`).

---

### ☐ V4-F7 — Le MJ est prioritaire : réconciliation et éléments périmés · `M` · sans modèle IA — **prêt après F3, E9**

**Modèle conseillé : Opus** — cohérence entre la base et l'état simulé. **ADR :** 0094. **Spec :** §11.4.

**Sous-tâches Haiku** : lancer les tests et résumer les échecs.

**À faire** (tests d'abord)
- `reconcile(figures, changedBlocks)` (pur) : lieu, mort, liens, possessions, psyché ; rend les ajustements à écrire.
- Au début de chaque lot, une lecture groupée des blocs modifiés depuis `simulated_until` ; les ajustements écrits comme `gm_adjustment` ou événements `origin = 'gm'`.
- Un fait posé par le MJ n'est jamais réécrit : la simulation le **propose** (élément de lot), même en mode `auto`.
- Les éléments d'un lot en attente qui lisent une figure modifiée depuis le calcul sont marqués périmés, avec leurs dépendants ; `acceptItem` les refuse.

**Critères d'acceptation**
- [ ] Le MJ déclare Bram mort sur sa fiche : au lot suivant, la figure est morte et un événement `origin = 'gm'` l'explique (test d'intégration).
- [ ] La simulation ne déplace jamais un PNJ dont le MJ a fixé le lieu ; elle le propose (test).
- [ ] Un élément périmé ne peut pas être accepté (test).
- [ ] Aucun abonnement temps réel n'est ajouté.
