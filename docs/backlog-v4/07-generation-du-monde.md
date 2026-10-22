# Lot G — La génération du monde

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

En solo, un monde **naît avec une histoire**. En mode MJ, c'est une option. L'histoire s'obtient en faisant tourner la simulation des lots C et E pendant des décennies ou des siècles, au pas grossier, sur des figures légères : c'est ce que fait Dwarf Fortress avant chaque partie. Une **graine** permet de régénérer le même monde de départ ; la partie, elle, diverge.

La génération de **cartes** est hors de la V4 (`00-cadre.md` §6) : les lieux sont une liste, sans géographie.

---

### ☐ V4-G1 — Ce qu'est une graine, et où tourne la génération · `M` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — déterminisme, architecture, quotas.

**Sous-tâches Haiku** : aucune avant l'ADR.

**À décider dans l'ADR**
- **Une graine, c'est plus qu'un nombre** : le nombre, les paramètres de départ (G2), la **version du générateur**, et l'empreinte des tables et listes du monde utilisées. Changer le code du générateur change le monde produit par une même graine : on enregistre la version et on prévient (G6).
- **Des identifiants déterministes** pendant la génération (jamais un UUID aléatoire qui fixerait un ordre de parcours), convertis en identifiants de base à l'écriture.
- **Où tourne la génération** : le temps d'une fonction Vercel du plan gratuit ne suffit pas pour des siècles. Recommandation : dans le navigateur de l'auteur, puisque `src/core` n'a aucune dépendance ; le serveur ne reçoit que le résultat, **par lots**, validé par Zod (règle 4) et réécrit sous la RLS ordinaire. À comparer avec un script local pour la cible locale.
- **Le volume** : une estimation pour chaque âge de monde (G2) face aux 500 Mo de Supabase. Ce qui est gardé en entier, ce qui est résumé (les figures légères mortes depuis longtemps), ce qui n'est jamais écrit.
- **La reprise** : une génération interrompue reprend où elle s'était arrêtée, ou s'annule proprement.

**Critères d'acceptation**
- [ ] ADR écrit ; `docs/QUOTAS.md` et `docs/ARCHITECTURE.md` mis à jour ; découpage confirmé.

---

### ☐ V4-G2 — Les paramètres de départ · `M` · sans modèle IA — **prêt après G1**

**Modèle conseillé : Sonnet** pour l'écran, après esquisse ; le schéma Zod relu par Opus.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

Ce que l'auteur a demandé, à la manière de Dwarf Fortress :

- **l'âge du monde** (jeune, quelques décennies ; ancien, plusieurs siècles ; très ancien) ;
- le nombre de **peuples** et de **lieux** ;
- la **densité** de figures historiques ;
- la fréquence des **conflits** ;
- la présence des **monstres** et de la **magie** ;
- la **graine** : tirée au hasard, ou saisie pour régénérer un monde connu.

Des préréglages (« monde jeune et paisible », « vieil empire en déclin ») ; tout réglable ensuite.

**Critères d'acceptation**
- [ ] Les paramètres sont validés par un schéma Zod et enregistrés avec la graine.
- [ ] L'écran tient à 375 px.

---

### ☐ V4-G3 — Les peuples, les lieux et les premières figures · `L` · sans modèle IA — **prêt après G1, D5 et E6**

**Modèle conseillé : Opus** — noyau de la génération.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

- Les **peuples** : une culture par peuple, faite de valeurs (B1) et de préférences, qui oriente la psyché de ses membres (D5).
- Les **lieux** : à partir des générateurs existants (`src/core/generators`) et des tables du monde.
- Les **figures fondatrices** : légères (E6), tirées par le moteur (D5).
- Tout est déterministe (A2, G1).

**Critères d'acceptation**
- [ ] Même graine et mêmes paramètres → mêmes peuples, lieux et figures (test).
- [ ] Deux peuples aux cultures opposées ont des populations aux valeurs distinctes (test statistique).

---

### ☐ V4-G4 — Simuler l'histoire · `L` · sans modèle IA — **prêt après G3 et E8**

**Modèle conseillé : Opus** — noyau, performance, bornes.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs ; reporter les mesures dans `docs/QUOTAS.md`.

- La boucle de vie (lot E), au pas grossier, sur des figures légères : naissances, unions, morts, rivalités, fondations, trahisons, vengeances.
- Les actions propres à l'histoire (fonder un lieu, prendre le pouvoir, déclencher une guerre locale) s'ajoutent au vocabulaire d'actions (E4) comme figures légères seulement. **L'échelle politique fine reste au lot P.**
- Chaque événement s'écrit dans le journal du monde (A4).
- Les figures qui comptent encore au début de la partie (vivantes et liées aux lieux de départ) sont promues complètes (E6).

**Critères d'acceptation**
- [ ] Même graine → même histoire (test).
- [ ] Sur un monde ancien, aucune population ne s'éteint ni n'explose sans cause lisible (test de garde, tolérances fixées en conception).
- [ ] Temps de génération mesuré pour chaque âge de monde.

---

### ☐ V4-G5 — La chronique et les légendes · `M` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : G4, A4.

**Sous-tâches Haiku** : planche du catalogue.

L'émergence n'a de valeur que si elle se lit. C'est le mode Légendes de Dwarf Fortress.

- Les événements d'une portée suffisante entrent dans la **Chronologie du monde** (ADR 0048), avec leur portée `major`, `notable` ou `detail`.
- Un écran **Légendes** pour le MJ : par figure (sa vie, ses actes, ses liens), par lieu (sa fondation, ses maîtres successifs), par peuple.
- Pour le joueur : seulement ce qu'il a découvert (`entity_discoveries`), par les rumeurs (C4), les livres, les récits.
- Une figure historique peut devenir une fiche du wiki (promotion existante), avec sa biographie tirée de ses actes.

**Critères d'acceptation**
- [ ] Un joueur ne voit jamais un événement qu'il n'a pas découvert (test côté serveur).
- [ ] L'esquisse est validée par l'auteur.

---

### ☐ V4-G6 — Réutiliser une graine · `S` · sans modèle IA — **prêt après G1 et G4**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés.

- La graine d'un monde est affichée et copiable. Créer un monde depuis une graine régénère **l'état de départ seulement** : aucune partie, aucune découverte.
- Si la version du générateur ou les tables ont changé depuis, l'écran prévient : « ce monde ne sera pas identique à l'original ».

**Critères d'acceptation**
- [ ] Une graine réutilisée sur la même version redonne le même monde de départ (test d'intégration).
- [ ] L'avertissement apparaît quand la version diffère.

---

### ☐ V4-G7 — Générer pour un MJ · `S` · sans modèle IA — **prêt après G4 et F1**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés.

- Un MJ peut demander une génération pour son monde, comme en solo. Il choisit si les figures générées sont **figées** (F2) ou laissées à la simulation.
- Dans un monde qui contient déjà des fiches, la génération **ne touche à aucune fiche existante** : elle ajoute autour.

**Critères d'acceptation**
- [ ] Une génération dans un monde non vide ne modifie aucune entité existante (test).
