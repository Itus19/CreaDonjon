# V3.2 — L'écran central du solo

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

Tous relevés par l'auteur le 18 novembre, pendant la première séance jouée.

---

### ☐ V3.2-1 — Qui parle, et quand : les bulles du fil · `M` · sans modèle IA — **dessin posé le 18 novembre ; reste le pied et la planche**

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
- [x] Six tours d'affilée se relisent sans hésiter sur qui parle.
- [ ] Heure et date en jeu sur chaque tour.
- [ ] Tient à 390 px ; planche du catalogue à jour.

*Fait le 18 novembre (les voix).* `Fil.tsx` : le joueur en bulle à droite bordée de `players`, la narration en pleine largeur au liseré `gm` et en `text-base` (c'est ce qui se lit vraiment, charte §4), la réplique d'un PNJ en bulle à gauche sur `panel-raised`. Le MJ hors-jeu garde son liseré d'accent. Vérifié au navigateur sur six tours : les trois voix se distinguent d'un coup d'œil.

*Reste, et c'est du serveur, pas du dessin.* Le pied de bulle attend deux choses que `FilItem` ne porte pas aujourd'hui :
- **l'heure et la date en jeu** : le fil n'a que `createdAt`, l'heure réelle. Le temps de jeu vit dans la scène, et le tour est journalisé AVANT que l'horloge avance (`journalTurn` puis `applyResolvedTurn`). Il faut le poser à l'écriture — jamais le rattraper après coup, le journal est en ajout seul.
- **le nom du PNJ qui parle** : `npcReaction` ne porte qu'un `npcId`. Le nom se résout dans `turnFil.ts`, pour que la bulle le nomme et le lie à sa fiche.
- La planche `docs/catalogue/Solo.dc.html` et le passage à 390 px.

---

### ☑ V3.2-2 — Le contour de « Que fais-tu ? » · `S` · sans modèle IA — **fait le 18 novembre**

**Constaté** : « il y a une petite erreur de design, le contour de la partie "que fais-tu ?" est mal fait. » Sur la capture du 18 novembre, le cadre de la zone d'intention et celui du bloc d'interprétation (« Action libre — aucune mécanique reconnue ») se superposent : deux bordures se touchent, et l'ensemble ne forme plus un bloc franc.

**À faire** : un seul cadre pour la zone d'intention, l'interprétation et les boutons — ou deux cadres franchement séparés, jamais deux filets accolés. Vérifier le repli du téléphone, où la zone est collée au bas de l'écran.

**Critères d'acceptation**
- [x] Un seul filet visible autour de la zone, ordinateur et 390 px.
- [x] Les états (saisie vide, interprétation mécanique, erreur) gardent le même cadre.

*Fait le 18 novembre.* C'était bien trois bordures emboîtées : le panneau, le champ, et un troisième cadre autour de l'interprétation. Ce dernier devient un simple **filet de séparation** (`border-t border-edge pt-3`), sans fond ni rayon — le motif que le bloc « ce n'est pas ça » employait déjà dix lignes plus bas. Vérifié dans le DOM : le bloc n'a plus qu'une bordure haute, fond transparent.

---

### ☑ V3.2-3 — On ne sait pas si c'est parti, ni si l'IA répond · `S` · sans modèle IA — **fait le 18 novembre**

**Constaté** : « on ne sait pas trop si le message est bien parti ou non et si l'IA est en train de réfléchir ». Avec un modèle local, la narration prend **10 à 20 secondes** (mesuré : 11,4 s et 18,1 s) : l'écran reste muet tout ce temps.

**Proposition.**
- **Le tour part tout de suite** : la bulle du joueur s'inscrit au fil dès l'envoi (le serveur a déjà journalisé les faits), suivie d'une **bulle fantôme** côté narration avec **trois points qui respirent** (opacité en boucle, 1,2 s, `prefers-reduced-motion` respecté : les points restent fixes). Jamais un écran gelé.
- **Un voyant du fournisseur**, discret, près de l'en-tête d'état : vert quand le dernier appel a abouti, rouge quand il a échoué, gris quand aucun n'a encore eu lieu. **Lu du dernier appel, jamais d'un sondage** : un ping périodique coûterait une requête par tic pour rien (docs/QUOTAS.md, Q5). Son infobulle dit quoi : « fournisseur local · dernier appel réussi à 10h01 ».
- Un échec se dit (c'est V3.1-223) ; ce ticket-ci ne traite que l'attente.

**Critères d'acceptation**
- [x] Entre l'envoi et la narration, l'écran montre que quelque chose se passe.
- [x] Le voyant ne déclenche aucune requête de plus.
- [x] Mouvement coupé si le système demande moins d'animation.

*Fait le 18 novembre.* La barre d'intention remonte deux choses à l'écran, sans rien demander au serveur : « ça travaille » (son `busy`, pour les trois chemins — jouer, encaisser, MJ) et « le modèle a répondu ou non » (la narration du tour revenu). Le fil montre une bulle fantôme à trois points pendant l'attente ; le voyant au-dessus de la barre est vert quand le dernier tour a été raconté, rouge quand il est resté muet, éteint tant qu'aucun tour n'a été joué. `prefers-reduced-motion` est déjà traité globalement dans `tokens.css` : rien n'a été réimplémenté (charte §4).

Vérifié au navigateur : trois points animés pendant les 11 s du modèle local, puis « Fournisseur d'IA : le dernier tour a été raconté ».

---

### ☑ V3.2-4 — La zone de texte se vide à l'envoi · `S` · sans modèle IA — **fait le 18 novembre**

**Constaté** : « quand on envoie un message dans l'interface, la zone de texte doit se vider ». Aujourd'hui la phrase reste, et au tour suivant on écrit par-dessus — ou on renvoie deux fois la même sans s'en apercevoir.

**À faire** : vider la zone dès que le serveur a accepté le tour (jamais avant : un refus doit rendre sa phrase au joueur), et lui rendre le focus. Le chemin « demande posée » (un jet attendu) garde sa logique propre : là, la zone sert à annoncer un dé.

**Critères d'acceptation**
- [x] Un tour accepté laisse la zone vide et prête.
- [x] Un tour refusé garde le texte, et le dit.

*Fait le 18 novembre.* La question au MJ vidait déjà la zone (`changeText("")`) ; le tour joué et le dé annoncé l'avaient oublié. Même appel, au même endroit : **après** la réponse du serveur, jamais avant — un refus sort plus haut et rend sa phrase au joueur. Vérifié au navigateur : la zone est vide après le tour.
