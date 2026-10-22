# Lot H — Les PJ et les réglages de table

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Dans Dwarf Fortress, l'esprit des nains échappe au joueur. Dans un jeu de rôle, **l'esprit d'un PJ appartient à son joueur**. Toutes les tables ne veulent pas non plus le même niveau de détail : certaines aiment voir leurs jauges, d'autres trouvent ça lourd, d'autres veulent que seul le MJ les voie pour s'en servir dans son récit. Ce lot donne **des choix complets**, décidés avec l'auteur le 22 octobre 2026.

---

### ☐ V4-H1 — Les réglages de table · `M` · sans modèle IA — **prêt après A1**

**Modèle conseillé : Opus** — visibilité côté serveur (règle 5), schéma.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

Un réglage par campagne, modifiable par le MJ seul.

**Par couche, pour les PJ** : besoins, fatigue, stress, émotions, souvenirs.

| Position | Effet |
|---|---|
| **Visible du joueur** | le joueur voit la couche de son PJ, en bandes nommées ; le MJ aussi, nombres compris |
| **MJ seul** | la couche est simulée ; seul le MJ la voit et choisit de la mentionner dans son récit. **Rien n'est envoyé au joueur** |
| **Désactivée** | la couche n'est pas simulée pour les PJ, et n'a aucune conséquence |

**L'évolution des traits et des valeurs d'un PJ** (E5) :

| Position | Effet |
|---|---|
| **Le moteur propose** (défaut) | « cette trahison t'a endurci ? » : le joueur accepte ou refuse (H4) |
| **Le moteur applique** | la transformation s'applique, comme pour un PNJ ; le joueur la voit selon le réglage ci-dessus |
| **Jamais** | la psyché d'un PJ ne change que de la main du joueur |

**Le récit et la simulation intimes** :

- **Récit intime** : explicite, ou en ellipse (la scène est coupée). Transmis au modèle comme consigne (B6).
- **Simulation romantique** : activée ou désactivée (E7).
- Ces deux réglages **ne masquent jamais** les données d'identité et d'orientation : elles restent affichées sur les fiches, selon la visibilité de chaque champ (B4).

**Critères d'acceptation**
- [ ] « MJ seul » : un test vérifie que la couche n'apparaît dans **aucune** réponse envoyée au joueur (pages, routes, contexte du modèle lu par lui).
- [ ] « Désactivée » : la couche n'évolue pas pour les PJ et ne produit aucune conséquence (test).
- [ ] Seul le MJ change ces réglages (liste de contrôle de `docs/SECURITE.md`).
- [ ] En solo, le joueur est son propre MJ : tous les réglages lui sont ouverts.

---

### ☐ V4-H2 — La psyché du PJ, vue par son joueur · `M` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : H1, B5.

**Sous-tâches Haiku** : planche du catalogue ; libellés.

- Dans la fiche jouable (V3-D5) : ce que les réglages permettent, en bandes nommées (« affamé », « épuisé », « en colère »), jamais en nombres.
- Les traits, valeurs et rêves du PJ sont toujours visibles de son joueur : ils lui appartiennent.
- Les souvenirs visibles rejoignent le journal de personnage (V3-E3).
- Ce que les PNJ pensent du PJ n'y figure que par les découvertes.

**Critères d'acceptation**
- [ ] L'esquisse est validée ; la fiche tient à 375 px.
- [ ] Une couche « MJ seul » ou « désactivée » n'y laisse aucune trace, pas même un emplacement vide.

---

### ☐ V4-H3 — Des besoins qui ont des conséquences de règles · `M` · sans modèle IA — **à concevoir, puis prêt**

**Modèle conseillé : Opus** — moteur de règles, déclencheurs.

**Sous-tâches Haiku** : vérifications et résumé des échecs.

Le MJ ne devrait pas avoir à dire « ajoute un point de fatigue » : le moteur traduit l'état en règles.

- Faim, soif, sommeil, fatigue : leurs seuils produisent des effets **par les règles du ruleset** (l'épuisement de D&D 2024, par exemple), au moyen des déclencheurs existants. Jamais une pénalité improvisée.
- Une couche **désactivée** ne produit aucune conséquence.
- Une couche **MJ seul** : **à décider**. Recommandation : la conséquence de règle (l'épuisement) est un état mécanique et reste visible du joueur, comme une condition ; seule la jauge qui l'a produite reste cachée. Le MJ peut aussi choisir de ne pas l'appliquer automatiquement.
- Stress et émotions n'ont **pas** de conséquence mécanique par défaut : ils se jouent (H5). Un monde peut en ajouter par ses déclencheurs.

**Critères d'acceptation**
- [ ] Un PJ qui ne dort pas atteint l'épuisement selon la règle de son ruleset, appliquée par le moteur (test).
- [ ] Le cas « MJ seul » est tranché avec l'auteur et noté.

---

### ☐ V4-H4 — Proposer une transformation au joueur · `S` · sans modèle IA — **prêt après E5 et H1**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés ; planche du catalogue.

- Quand la simulation transformerait un PJ, et que le réglage est « le moteur propose » : une proposition au joueur, avec sa cause (« depuis la mort de ta sœur… »), le changement en bandes nommées, accepter ou refuser.
- Refuser laisse le souvenir intact : le PJ a vécu la chose, il n'en a pas été changé.

**Critères d'acceptation**
- [ ] Refuser ne change aucune valeur et n'efface aucun souvenir (test).

---

### ☐ V4-H5 — Jouer sa psyché rapporte l'Inspiration · `M` · sans modèle IA — **à concevoir**

**Modèle conseillé : Opus** — qui juge qu'un joueur a « joué sa psyché » ?

**Sous-tâches Haiku** : aucune avant la conception.

Une **récompense plutôt qu'une contrainte**, à la manière de *Burning Wheel* ou *Fate* : céder à son émotion, honorer une valeur au prix d'un risque, poursuivre son rêve contre son intérêt donne l'Inspiration héroïque (effet `grant_inspiration`, ADR 0050).

**À décider**
- **Avec un MJ humain** : le MJ l'accorde ; l'écran lui suggère les occasions (le PJ en colère vient de choisir de frapper).
- **En solo** : le moteur ne lit pas la prose. Il peut reconnaître une intention de la barre d'intention (V3-B1) qui correspond à une émotion, une valeur ou un rêve du PJ. Jamais un jugement du modèle (règle 8).

**Critères d'acceptation**
- [ ] Conception écrite et découpée.

---

### ☐ V4-H6 — Ce que le MJ voit pour raconter · `S` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : H1.

**Sous-tâches Haiku** : planche du catalogue.

Quand une couche est « MJ seul », le MJ a besoin de la voir **sans ouvrir chaque fiche** : un panneau dans ses outils de table qui résume l'état des PJ (« Max : affamé, inquiet ; se souvient encore de la trahison d'Aude »), pour qu'il choisisse de le glisser dans son récit.

**Critères d'acceptation**
- [ ] L'esquisse est validée ; le panneau ne fait qu'un chargement (`docs/CABLAGE.md`).
