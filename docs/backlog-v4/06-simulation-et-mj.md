# Lot F — La simulation au service du MJ

*Partie du backlog V4. L'index : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md). Le cadre commun : [`00-cadre.md`](00-cadre.md).*

Un seul moteur, deux usages. En solo, il fait vivre le monde de lui-même. Pour un MJ humain, c'est un **outil** : il l'active ou non, il le laisse proposer, et il garde la main sur ce qu'il a écrit. Un MJ peut commencer avec un monde vide et le remplir lui-même, ou demander une génération comme en solo (lot G).

---

### ☐ V4-F1 — Activer la simulation · `M` · sans modèle IA — **prêt après A1 et A3**

**Modèle conseillé : Opus** — réglage de campagne, schéma.

**Sous-tâches Haiku** : libellés ; planche du catalogue.

Un réglage par campagne, à trois positions :

| Position | Effet |
|---|---|
| **Désactivée** | rien ne bouge seul ; la psyché est un outil de description. Défaut d'une campagne avec MJ |
| **Proposer** | le temps qui passe produit des **propositions**, rien ne s'écrit sans le MJ (F3) |
| **Automatique** | le temps qui passe applique la simulation ; le MJ voit ce qui a bougé et peut rejeter (F4). Défaut du solo |

**Critères d'acceptation**
- [ ] Désactivée : avancer le temps ne produit aucune écriture de simulation (test).
- [ ] Le changement de position est réservé au MJ (RLS ou garde serveur, liste de contrôle de `docs/SECURITE.md`).

---

### ☐ V4-F2 — Une entité figée par le MJ · `S` · sans modèle IA — **prêt après F1**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** : libellés.

- Un verrou par entité : « figée ». La simulation ne la fait jamais agir et ne transforme jamais sa psyché. Elle peut encore être **témoin** et se souvenir, si le MJ le permet (deuxième case).
- Le MJ qui écrit son monde à la main protège ainsi ce qui compte pour son histoire.

**Critères d'acceptation**
- [ ] Une entité figée n'est jamais actrice d'un événement simulé (test).

---

### ☐ V4-F3 — Le simulateur · `L` · sans modèle IA — **à concevoir, puis à esquisser**

**Modèle conseillé : Opus** pour la conception (table des propositions du moteur) ; **Sonnet** pour l'écran, après esquisse.

**Sous-tâches Haiku** : planche du catalogue ; libellés.

L'outil que l'auteur a demandé : **avancer le monde d'une durée choisie et accepter ou non la simulation, élément par élément.**

- Le MJ choisit une durée (un jour, une semaine, une saison) et, s'il le veut, une portée (ce lieu, cette faction, ces personnes).
- Le résultat est **regroupé par élément** : telle personne (ce qu'elle a fait, ressenti, ce qui a changé en elle), telle relation, tel lieu.
- Pour chaque élément : **accepter**, **modifier**, **rejeter**. Rejeter un élément rejette aussi ce qui en découlait (F4).
- **À décider** : la table des propositions du moteur. Recommandation : une table sœur d'`ai_proposals`, même cycle de vie, mais distincte (une proposition du moteur n'est pas une sortie de modèle et ne passe pas par la même validation). `00-cadre.md` §6.
- Le tiroir de conséquences du solo (V3-C5) montre la même chose, en version courte.

**Critères d'acceptation**
- [ ] Conception écrite, `docs/SCHEMA.md` mis à jour, esquisse validée par l'auteur.
- [ ] Une proposition acceptée produit exactement l'état qu'aurait produit le mode automatique (test).

---

### ☐ V4-F4 — Rejeter une chaîne de conséquences · `M` · sans modèle IA — **prêt après A4 et F3**

**Modèle conseillé : Opus** — causalité, journal en ajout seul.

**Sous-tâches Haiku** : lancer `npm run test:core` et résumer les échecs.

Avec l'effet papillon, un événement en entraîne d'autres. Rejeter le premier sans rejeter ses suites laisserait des conséquences sans cause.

- Chaque événement du monde connaît sa **cause** (A4). Rejeter un événement rejette sa descendance.
- En mode automatique, « rejeter » écrit des **compensations** (critère transverse 8) ; il ne réécrit jamais l'historique.
- L'écran dit ce qui partira avec : « rejeter ceci rejette aussi 3 événements qui en découlent ».

**Critères d'acceptation**
- [ ] Rejeter un événement rejette toute sa descendance, et rien d'autre (test).
- [ ] Rejouer le journal après un rejet redonne un état cohérent (test).

---

### ☐ V4-F5 — Ce qui bouge dans le monde · `M` · sans modèle IA — **à esquisser, puis prêt (Sonnet)**

**Modèle conseillé : Sonnet**, après esquisse. **Dépend de** : E8.

**Sous-tâches Haiku** : planche du catalogue.

Un tableau pour le MJ, utile même simulation désactivée (il lit la psyché saisie) :

- les rêves en cours et ce qui les rapproche de leur but ;
- les tensions (deux personnes proches de la rupture, une personne contre sa faction : l'écart de valeurs que la spec V2 annonçait) ;
- les besoins et le stress critiques ;
- les PNJ qui se souviennent le plus des PJ.

**Critères d'acceptation**
- [ ] L'esquisse est validée par l'auteur ; le chargement est mesuré (`docs/CABLAGE.md`, `docs/QUOTAS.md`).
