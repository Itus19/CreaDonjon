# V3.2 — L'écran central du solo

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

Tous relevés par l'auteur le 18 novembre, pendant la première séance jouée.

---

### ☐ V3.2-1 — Qui parle, et quand : les bulles du fil · `M` · sans modèle IA — **à décider (dessin), puis Sonnet**

**Constaté.** « Dans l'écran central le texte manque de clarté sur qui parle et quand. » Aujourd'hui le fil empile des paragraphes : l'action du joueur alignée à droite en petit, la narration en pleine largeur, et rien ne distingue une précision du MJ d'une réplique de PNJ. À six tours d'affilée, on ne relit plus rien.

**Demandé** : des bulles, avec une couleur par voix — joueur, MJ (l'IA qui précise), PNJ — et dedans, au minimum l'heure et la date en jeu.

**Proposition (à trancher par l'auteur avant de coder).**

*Trois voix, trois traitements — et surtout pas trois bulles.* Une bulle par paragraphe rendrait le récit illisible : c'est du texte long, pas du clavardage.

- **Le joueur** : bulle alignée à **droite**, fond `--players` très atténué, coin inférieur droit rompu. C'est son geste, il se lit d'un coup d'œil. (Le jeton `--players` existe déjà et porte exactement ce sens.)
- **La narration** : **pas de bulle**. Pleine largeur, texte de récit, avec un **liseré terracotta** (`--gm`) à gauche — la même marque que les passages du MJ dans le wiki. C'est le corps du texte, pas un message.
- **Un PNJ qui parle** : bulle alignée à **gauche**, fond `--panel-raised`, un filet `--link-entity` et le **nom du PNJ en tête**, cliquable vers sa fiche. Une voix nommée mérite d'être nommée.
- **Le MJ hors-jeu** (bouton « MJ », `askSoloGm`) : encadré distinct, sans bulle, marqué « hors du temps de jeu » — il ne doit jamais se confondre avec le récit.

*Ce que porte le pied d'une bulle*, en petit et discret :
- **l'heure et la date en jeu** (demandé) — « jour 1, 10h01 » ;
- **le genre du tour** quand il y en a un : « action libre », ou le jet et son issue (« Test de Force 14 · raté ») ;
- rien d'autre. Les conséquences gardent leur tiroir, les PV leur bandeau.

*À prévoir* : une planche de catalogue (`docs/catalogue/Solo.dc.html`), le téléphone à 390 px (les bulles ne doivent pas rogner le texte), et le contraste des fonds atténués vérifié en clair comme en sombre.

**Critères d'acceptation**
- [ ] Six tours d'affilée se relisent sans hésiter sur qui parle.
- [ ] Heure et date en jeu sur chaque tour.
- [ ] Tient à 390 px ; planche du catalogue à jour.

---

### ☐ V3.2-2 — Le contour de « Que fais-tu ? » · `S` · sans modèle IA — **prêt (Sonnet)**

**Constaté** : « il y a une petite erreur de design, le contour de la partie "que fais-tu ?" est mal fait. » Sur la capture du 18 novembre, le cadre de la zone d'intention et celui du bloc d'interprétation (« Action libre — aucune mécanique reconnue ») se superposent : deux bordures se touchent, et l'ensemble ne forme plus un bloc franc.

**À faire** : un seul cadre pour la zone d'intention, l'interprétation et les boutons — ou deux cadres franchement séparés, jamais deux filets accolés. Vérifier le repli du téléphone, où la zone est collée au bas de l'écran.

**Critères d'acceptation**
- [ ] Un seul filet visible autour de la zone, ordinateur et 390 px.
- [ ] Les états (saisie vide, interprétation mécanique, erreur) gardent le même cadre.

---

### ☐ V3.2-3 — On ne sait pas si c'est parti, ni si l'IA répond · `S` · sans modèle IA — **prêt (Sonnet)**

**Constaté** : « on ne sait pas trop si le message est bien parti ou non et si l'IA est en train de réfléchir ». Avec un modèle local, la narration prend **10 à 20 secondes** (mesuré : 11,4 s et 18,1 s) : l'écran reste muet tout ce temps.

**Proposition.**
- **Le tour part tout de suite** : la bulle du joueur s'inscrit au fil dès l'envoi (le serveur a déjà journalisé les faits), suivie d'une **bulle fantôme** côté narration avec **trois points qui respirent** (opacité en boucle, 1,2 s, `prefers-reduced-motion` respecté : les points restent fixes). Jamais un écran gelé.
- **Un voyant du fournisseur**, discret, près de l'en-tête d'état : vert quand le dernier appel a abouti, rouge quand il a échoué, gris quand aucun n'a encore eu lieu. **Lu du dernier appel, jamais d'un sondage** : un ping périodique coûterait une requête par tic pour rien (docs/QUOTAS.md, Q5). Son infobulle dit quoi : « fournisseur local · dernier appel réussi à 10h01 ».
- Un échec se dit (c'est V3.1-223) ; ce ticket-ci ne traite que l'attente.

**Critères d'acceptation**
- [ ] Entre l'envoi et la narration, l'écran montre que quelque chose se passe.
- [ ] Le voyant ne déclenche aucune requête de plus.
- [ ] Mouvement coupé si le système demande moins d'animation.

---

### ☐ V3.2-4 — La zone de texte se vide à l'envoi · `S` · sans modèle IA — **prêt (Sonnet)**

**Constaté** : « quand on envoie un message dans l'interface, la zone de texte doit se vider ». Aujourd'hui la phrase reste, et au tour suivant on écrit par-dessus — ou on renvoie deux fois la même sans s'en apercevoir.

**À faire** : vider la zone dès que le serveur a accepté le tour (jamais avant : un refus doit rendre sa phrase au joueur), et lui rendre le focus. Le chemin « demande posée » (un jet attendu) garde sa logique propre : là, la zone sert à annoncer un dé.

**Critères d'acceptation**
- [ ] Un tour accepté laisse la zone vide et prête.
- [ ] Un tour refusé garde le texte, et le dit.
