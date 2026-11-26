# Backlog VM — 2. La ville

Spécification : `specs/vie-du-monde.md` §6 à §8.

### ☐ VM-5 — Le régime d'une ville · `M` · sans modèle IA

**Modèle conseillé : Opus.**

- Agrégats du bloc `settlement` (§6, §6.1) : stabilité, emprise, légitimité, cohésion, prospérité, criminalité, corruption ; deux à quatre groupes d'intérêt tirés des métiers, avec leur satisfaction.
- Lien à la faction au pouvoir (`leads`) ; ses convictions donnent les normes (VM-12).
- Retour lent vers l'équilibre ; effets amortis (`applyDelta`).
- Réservé au MJ (décision 8) : les joueurs n'en voient que des signes.

**Critères d'acceptation**
- [ ] Une ville sans événement revient vers son équilibre en quelques mois de jeu.
- [ ] Aucun agrégat n'est envoyé à un client joueur.

### ☐ VM-6 — Les événements à l'heure autour du personnage · `L`, à découper · sans modèle IA

**Modèle conseillé : Opus.**

- Catalogue d'une trentaine de types en données (§7.1, décision 10), relu par l'auteur.
- Fréquence = taille × sensibilités aux agrégats (§7.2) ; visibilité visible / étouffé / caché selon l'emprise (§7.3) ; intrigues cachées à plusieurs étapes (§6.1).
- Effets logiques et bornés (§7.4, décision 11) : états avec une cause, pas de résurrection hors magie prévue par les règles ; changement durable d'un PNJ du wiki par l'onglet « Changements ».
- Tirage à chaque tour qui fait passer du temps ; un événement ne se montre que si le personnage s'en aperçoit (décision 13).

**Critères d'acceptation**
- [ ] Sur un an simulé, un hameau paisible a peu d'incidents, un port agité plusieurs par jour.
- [ ] Une ville répressive a moins d'événements visibles et plus de cachés qu'une ville laxiste de même taille.
- [ ] Une arrestation suppose un crime connu ; la peine finit.

### ☐ VM-7 — Le rattrapage et les nouvelles qui voyagent · `M` · sans modèle IA

**Modèle conseillé : Opus.**

- À l'arrivée dans une ville : tirer les semaines écoulées depuis la dernière (§8), au mois au-delà d'un an (décision 14) ; date de la dernière semaine tirée dans le bloc `settlement`.
- Un événement de grande portée arrive comme rumeur ailleurs, avec un délai selon la distance.

**Critères d'acceptation**
- [ ] Revenir après trois semaines tire trois semaines, une seule fois ; rejouer la même arrivée donne le même résultat.
- [ ] Le rattrapage d'un an se fait en moins d'une seconde.

### ☐ VM-11 — Un événement non remarqué se découvre plus tard · `S` · sans modèle IA

**Modèle conseillé : Opus.**

- Un événement qui vise le personnage passe par un jet du moteur (décision 12), par exemple l'Escamotage du voleur contre la Perception passive (§7.5).
- Pas remarqué : l'effet s'applique, rien n'est dit ; une découverte différée annonce le manque à la prochaine utilisation de l'objet ou quelques heures après.
- Le voleur existe et a une routine : on peut le retrouver.

**Critères d'acceptation**
- [ ] Un vol raté en Perception ne laisse aucune trace dans le fil avant la découverte.
- [ ] La découverte arrive comme fait établi, et une seule fois.
