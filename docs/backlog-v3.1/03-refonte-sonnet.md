# Backlog V3.1 — Tickets de la refonte « verre minéral » prêts pour Sonnet (4 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage de V3.1-19, sur la base de l'ADR 0036 (données) et de l'esquisse
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm (planches citées par leur
titre). Ordre conseillé : 24, puis 25 à 36 dans l'ordre des dépendances ;
V3.1-20 (lot g) peut partir dès que 25 est fait.

**Règles communes à ces tickets** — à relire avant d'en prendre un :
- Lire `docs/CHARTE-UI.md` et la planche du catalogue concernée **avant**
  d'écrire ; réutiliser ce qui existe ; mettre la planche à jour avec le code.
- Un écran n'est fini que s'il marche à **390 px**, à 820 px (tablette) et
  sur ordinateur, dans les quatre modes et en contraste élevé.
- Mouvement : chaque animation est sautée sous `prefers-reduced-motion`.
- Aucun calcul de règle côté client ; aucune donnée cachée envoyée au client.
- Ce qui n'est pas dans le ticket n'est pas fait : un manque trouvé en
  route s'écrit dans ce backlog, il ne s'ajoute pas au ticket.
- Fini quand `npm run typecheck && npm run lint && npm run test` passent.

---

### ☐ V3.1-34 — L'outil Table du MJ · `L` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet** — tout est esquissé ; données et règles fournies par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » (Table) et « —
feuilles ouvertes » (Toute la table). **Départ** : `mjToolWindows.ts`,
`MjToolWindowContent.tsx` (un outil de plus dans la liste). **Dépend de** :
24, 26 (commande E), 29, 33.

- Une ligne par PJ de la campagne : nom + niveau ; dessous « joueur · CA ·
  PV » puis la ligne des états ; à droite classe et sous-classe. Toucher
  déplie.
- Déplié — **revu le 5 octobre** (alignement sur la fiche et la carte de
  l'ordinateur) : la ligne dépliée **est** le haut de la fiche du téléphone,
  même composant que la carte de l'ordinateur — bouclier de CA ; PV
  (temporaires par-dessus), niveau et XP, épuisement, chacun avec la
  commande E ; initiative, vitesse, maîtrise, inspiration ▲▼ ; Perception
  passive, dés de vie ▲▼, états · concentration (× retire ou rompt, « + »
  ouvre les états du ruleset en feuille), repos court et long du PJ ; « Ce
  qui se dépense » en groupes ; charge et pièces avec commande E
  (`changeCurrency`, un message dit le change fait). Aucune commande sur
  CA, initiative, vitesse, maîtrise, Perception passive. La ligne repliée ne
  change pas.
- À 0 PV, la ligne se transforme : fond rouge, « Contre la mort »,
  trois réussites / trois échecs, « Soigner +1 PV » (règles de 24).
- « Toute la table » : + XP, ± pièces, repos court, repos long — chacun en
  feuille avec « Pour qui » ; XP et pièces à partager ou à chacun, aperçu par
  PJ, qui monte de niveau est signalé ; les repos passent par
  `takeShortRest` / `takeLongRest` pour chaque PJ coché.
- Chaque geste passe par le même service que la fiche (même journal) ; le
  MJ a toutes les commandes. Sur ordinateur : fenêtre d'outil MJ, ascenseur
  fin ; sur téléphone : `no-scrollbar`.
- **Ordinateur et tablette — décidé le 5 octobre** (planche « Décidé ·
  outil Table ») : une carte par PJ, qui **est** le haut de la fiche
  (composant partagé avec V3.1-26 / V3.1-32, en mode MJ), plus la charge et
  les pièces ; ▲▼ sur les dés de vie ; aucune commande sur CA, initiative,
  vitesse, maîtrise, Perception passive (valeurs dérivées). Deux cartes par
  rangée, une seule dans un volet partagé ou sur tablette.

**Critères d'acceptation**
- [ ] Les gestes de la planche, chacun journalisé une fois.
- [ ] Partage de 10 po entre trois PJ : 3 po chacun, le reste affiché.
- [ ] Un repos long sur trois PJ : trois résultats, trois événements `long_rest`.
- [ ] Ordinateur : la carte réutilise le composant du haut de fiche, sans le dupliquer.

---

### ☐ V3.1-35 — Accueil en tableau de bord (lot h) · `M` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet** — proposition 3 tranchée ; « Reprendre » rangé dans le navigateur (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `HomeShell.tsx`, `HomeScreen.tsx`,
`CampaignsPanel.tsx`. **Dépend de** : 25, 27.

- Rail du joueur : Mondes, Compte, Administration (superadmin seulement),
  Déconnexion en pied ; dalle Outils avec les dés seuls.
- En haut : prochaines séances de tous les mondes ; « Reprendre » sur la
  dernière visite (mémorisée dans le navigateur).
- Bouton « Nouveau monde » agrandi, à gauche : Mener une partie, Jouer en
  solo, Rejoindre une table (coller un lien d'invitation).
- Colonnes « Je mène » (+ « En solo ») et « Je joue » sur une même ligne de
  titres ; panneau du monde choisi à droite, avec les outils du **rôle tenu
  dans ce monde**.
- Téléphone : pilule Je mène / Je joue / Solo, le monde en feuille,
  « Nouveau monde » en grand bouton.

**Critères d'acceptation**
- [ ] Un compte MJ dans un monde et joueur dans un autre voit les bons outils pour chacun.
- [ ] « Rejoindre une table » accepte un lien d'invitation valide et refuse un lien invalide, sans rien créer.
- [ ] « Reprendre » absent si rien n'est mémorisé.

---

### ☐ V3.1-36 — Le solo : ailes d'ordinateur et téléphone modèle A (lot d) · `L` · sans modèle IA — **prêt**

**Modèle conseillé : Sonnet** — planches définitives ; le moteur solo ne change pas.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Solo-Desktop » ; « Décidé · solo sur téléphone (modèle A) »
(trois planches). **Départ** : `SoloShell.tsx`, `IntentBar.tsx`,
`ScenePanel`, `ConsequencesDrawer`. **Dépend de** : 29, 32, 33.

- Ordinateur : poignées de repli sur les bords de la fenêtre du Jeu ; Monde
  disparaît replié ; la Fiche repliée devient une bande de 96 px — bouclier
  CA, PV, Niveau, Charge.
- Téléphone : barre Jeu, Monde, Fiche | Quêtes, Règles, Notes, dé encoché.
  Monde = wiki du joueur avec « Présents dans la scène » en tête, puis
  récents (Quêtes et Règles n'y sont plus). Jeu : bandeau lieu / heure,
  bande de jauges, fil, barre d'intention ; ✦ ouvre la feuille des
  conséquences. Fiche : la fiche de 32. Quêtes : pilule En cours /
  Terminées, une quête en feuille avec ses étapes. Notes : Les miennes /
  Journal de partie.
- « Jouer » ouvre l'outil de dés pré-rempli (33) ; « Lancer » confirme, le
  tour suit le chemin actuel de V3-B5.

**Critères d'acceptation**
- [ ] Un tour complet sur téléphone : intention, outil de dés, Lancer, le tour dans le fil.
- [ ] Aucun changement du moteur de tour (tests solo existants verts sans modification).

---

### ☐ V3.1-38 — L'outil Initiative refondu, MJ et joueur · `L` · sans modèle IA — **prêt après V3.1-37**

**Modèle conseillé : Sonnet** — planche définitive, données fournies par V3.1-37.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · initiative (A retouchée) ». **Départ** :
`components/shell/InitiativeTracker.tsx`, `app/m/[worldSlug]/mj/initiative/page.tsx`.
**Dépend de** : V3.1-37, V3.1-24 (PV temporaires), V3.1-26 (jauges),
V3.1-29 (téléphone), V3.1-33 (outil de dés).

- MJ, ordinateur et téléphone : tout le détail de la décision (V3.1-19,
  lot i) — colonnes CA / PV alignées, score modifiable qui réordonne,
  lignes dépliables avec toutes les actions en deux boutons (touche,
  dégâts), PV temporaires, renommage avec le nom d'origine en petit,
  menace restante, Commencer / Round 1 / fin confirmée.
- Joueur : invitation au premier plan (lancer, ou vrai dé avec
  l'interrupteur « modificateur inclus »), mode combat dans Perso. (ordre,
  économie d'action, Actions · Sorts · Capacités), retour à la fiche
  normale à la fin.

**Critères d'acceptation**
- [ ] Le parcours de la planche, de « Commencer » à la fin confirmée, avec un MJ et deux joueurs (dont un sans l'application).
- [ ] « Quitter le combat » puis « Reprendre tel quel » : ordre, PV et états intacts ; « Recommencer » relance l'initiative et renvoie l'invitation.
- [ ] Côté joueur, le mode combat garde la fiche complète (même composant que hors combat), l'ordre du tour en tête.
- [ ] Un dégât porté depuis la fiche du joueur se voit aussitôt dans l'initiative du MJ, et inversement (même état de jeu).
- [ ] À 390 px et sur ordinateur, côté MJ et côté joueur.
- [ ] Planche du catalogue « Initiative » créée ou mise à jour.
- [ ] Un adversaire saisi à la main reçoit CA et PV dès l'ajout ; la liste des combats suit l'état (commencé, terminé) sans recharger (vu par la vérification du 11 octobre).
