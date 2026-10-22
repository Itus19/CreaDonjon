# Lot C — La mémoire et les relations

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Chaque entité se souvient de ce qu'elle a vécu avec les autres, et surtout avec le joueur. Ses relations ne sont plus saisies : elles **naissent** de ces souvenirs. Ce qu'elle croit savoir peut différer de la vérité.

Point de départ : `attitude_events` est déjà une mémoire par paire, en ajout seul et rejouable. Ce lot la généralise, sans la jeter.

---

### ☐ V4-C1 — Le souvenir · `L` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — schéma, volume, cœur de la mémoire.

**Sous-tâches Haiku** : aucune avant l'ADR.

**À décider dans l'ADR**
- **Ce qu'est un souvenir** : son porteur, l'événement du monde dont il vient (A4), les autres entités en jeu, la date de jeu, l'émotion ressentie et son intensité, la **valence**, la **saillance**, et **ce que le porteur croit** s'être passé (qui peut différer de l'événement réel, C4).
- **Deux mémoires** : un petit nombre d'emplacements à court terme ; un nombre limité d'emplacements à long terme. Le nombre exact est à fixer (Dwarf Fortress en a quelques-uns de chaque).
- **Consolidation et oubli** : un souvenir court assez saillant passe en mémoire longue ; les autres s'effacent. Un souvenir long peut **se raviver** (revoir la personne, revenir au lieu) et provoquer de nouveau l'émotion.
- **Un oubli qui ne perd rien** : un souvenir effacé quitte la mémoire de la personne, pas le journal du monde. On le retrouve pour l'audit.
- **Le joueur pèse plus lourd** : les souvenirs qui impliquent un PJ ont une saillance majorée (C6).
- **Le lien avec `attitude_events`** : un souvenir produit ses effets d'attitude, journalisés comme aujourd'hui. L'ancien chemin d'écriture (le MJ déplace un curseur) devient un souvenir d'origine `gm`.
- **Le volume** : seules les figures complètes (E6) ont des souvenirs individuels ; les figures légères n'ont que leurs actes notables.

**Critères d'acceptation**
- [ ] ADR écrit, `docs/SCHEMA.md` mis à jour, découpage en tickets prêts.

---

### ☐ V4-C2 — Consolider, oublier, raviver · `M` · sans modèle IA — **prêt après C1**

**Modèle conseillé : Opus** — noyau, tests d'abord.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

Fonctions pures dans `src/core/sim/memory.ts` : ajouter un souvenir, consolider, oublier, raviver.

**Critères d'acceptation**
- [ ] Les emplacements ne débordent jamais (test aux bornes).
- [ ] Un événement « bouleversement » reste en mémoire longue après 50 ans simulés ; une broutille est oubliée en quelques semaines.
- [ ] Même graine, même suite d'événements → mêmes souvenirs (déterminisme).

---

### ☐ V4-C3 — Des relations qui naissent des souvenirs · `L` · sans modèle IA — **à concevoir, puis prêt**

**Modèle conseillé : Opus** — redéfinit la relation existante.

**Sous-tâches Haiku** : libellés des liens nommés ; planche du catalogue.

- Les **axes** de la relation (`specs/psyche-pnj.md` §3) restent ; `attraction_repulsion` se scinde en **attirance romantique** et **attirance sexuelle** (B3). Leurs valeurs viennent de la somme des souvenirs partagés, amortie (`applyDelta`).
- Des **liens nommés** apparaissent à des seuils et selon des souvenirs précis : ami, ami proche, rancune, rival, mentor, protégé, amant, partenaire, ex. La parenté reste le domaine du bloc `genealogy`.
- L'attirance ne peut naître que si l'orientation des deux personnes le permet (B4, filtre) et si la table n'a pas désactivé la simulation romantique (H1).
- Le MJ peut toujours imposer un lien ou une valeur : c'est un souvenir d'origine `gm`, visible comme tel.

**Critères d'acceptation**
- [ ] Un lien nommé apparaît et disparaît selon les seuils (tests).
- [ ] Aucune attirance ne naît entre deux personnes dont les orientations l'excluent (test).
- [ ] Une relation saisie avant la V4 se lit inchangée (conversion B3).

---

### ☐ V4-C4 — Croyances et rumeurs · `L` · sans modèle IA — **à concevoir (ADR)**

**Modèle conseillé : Opus** — vérité et croyance, fuite par le contexte (`specs/psyche-pnj.md` §3, `known_as`).

**Sous-tâches Haiku** : aucune avant l'ADR.

`known_as` (ce que A croit savoir de B) généralisé : chaque personne a des **croyances** sur les faits du monde, avec leur source et leur degré de certitude.

**À décider dans l'ADR**
- Ce qu'est une croyance : le fait (un événement du monde, l'identité d'une personne, un secret), ce que la personne en croit, d'où elle le tient, sa certitude.
- **La rumeur** : un fait se propage le long des relations et des lieux, pas à pas, et **se déforme** (acteur confondu, ampleur exagérée) selon des règles fermées et un tirage dérivé (A2). Le joueur trahit quelqu'un à un endroit, et un autre lieu l'apprend des semaines plus tard, déformé.
- **Les secrets** : un fait que son auteur veut cacher se propage moins, et le révéler est un événement.
- **Le contexte du modèle** ne reçoit que ce que la personne croit, jamais la vérité qu'elle ignore (la fuite que `known_as` évitait déjà).
- Le volume : les rumeurs ne circulent qu'entre figures complètes et lieux proches ; au loin, une rumeur est un fait agrégé (« la capitale sait »).

**Critères d'acceptation**
- [ ] ADR écrit, découpage en tickets prêts.

---

### ☐ V4-C5 — Souvenirs et croyances sur la fiche · `M` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : C2, C3.

**Sous-tâches Haiku** : planche du catalogue.

- Pour le MJ : la mémoire longue d'une personne, ses souvenirs courts récents, ses croyances (avec la vérité en regard, et l'écart signalé).
- Le fil d'une paire (`attitude_events`, déjà à l'écran) s'enrichit des souvenirs qui l'ont fait bouger.
- Ce que voit un joueur suit les réglages de table (lot H) et les découvertes.

**Critères d'acceptation**
- [ ] L'esquisse est validée par l'auteur.
- [ ] Une croyance fausse est visiblement distinguée de la vérité, pour le MJ seul.

---

### ☐ V4-C6 — La mémoire du joueur · `M` · sans modèle IA — **prêt après C2**

**Modèle conseillé : Opus** — c'est la promesse « les entités se souviennent du joueur ».

**Sous-tâches Haiku** : vérifications et résumé des échecs.

- Les souvenirs qui impliquent un PJ ont une saillance majorée, et ne s'oublient pas tant que la personne vit et que le PJ reste dans la partie.
- **Le retour** : une personne marquée par un PJ (vaincue, humiliée, sauvée, trahie) peut en faire un rêve (`avenge`, `repay`, `follow`), et revenir. C'est l'esprit du système Nemesis, sans scénario écrit d'avance.
- Le journal de personnage (V3-E3) reçoit, côté PJ, ce que le PJ sait de ce que les autres retiennent de lui, selon ses découvertes.

**Critères d'acceptation**
- [ ] Un PNJ vaincu par un PJ et laissé en vie peut développer un rêve qui le concerne (test sur graine fixée).
- [ ] Ce rêve n'apparaît jamais si le PNJ n'a aucun souvenir du PJ.
