# V3.2 — 7. La vie du monde

**Spécification :** [`specs/vie-du-monde.md`](../../specs/vie-du-monde.md) · **Décision :** [ADR 0115](../adr/0115-la-vie-du-monde-se-calcule.md)

Les gens ont une routine, des goûts et des façades ; la ville vit sans le personnage, selon sa taille et son régime. Tout se calcule à graine fixe, au moment d'une lecture que le jeu fait déjà : aucun tic de fond (`docs/QUOTAS.md`). Demandé le 26 novembre, après la séance où le hall de l'auberge restait le même après dix heures de sommeil.

**Ordre (décision de l'auteur) :** fusionner la PR #17 (ville en agrégat) ; puis V3.2-29 et 30 (noyau pur) ; puis V3.2-31 (la présence calculée dans le solo), V3.2-32 (l'agenda) ; puis la ville (V3.2-33, 34, 35, 39) et les absents (V3.2-38). En parallèle, à tout moment : V3.2-40 (franchise, intérêts, façades), V3.2-36 (le questionnaire), V3.2-37 (l'archétype sur la fiche).

## 1. Les gens

Spécification : `specs/vie-du-monde.md` §3 à §5, §9. Dépend de la PR #17.

### ☑ V3.2-29 — Archétypes de vie et `position()` · `M` · sans modèle IA — **fait le 26 novembre**

**Modèle conseillé : Opus** (noyau pur, tests d'abord).

- Format d'archétype (§4.1) en données, Zod ; liste de départ d'une quinzaine (§4.2) dans `src/core/worldgen/archetypes.ts`.
- `position(personne, jour, heure)` (§5) : mort, état, agenda, séjour, routine ; gigue et jours d'absence à graine fixe (`deriveSeed`) ; créneaux à l'heure (décision 2) ; jours de la semaine du calendrier du monde.
- Les pôles et les centres d'intérêt teintent les probabilités, bornés (§4.3) : branché quand V3.2-40 existe, neutre sinon.

**Critères d'acceptation**
- [x] Même graine, même jour, même heure : même position, toujours.
- [x] Un pilier de bar est à la taverne environ 8 soirs sur 10 sur un an simulé ; un garde suit ses tours ; un voyageur hors séjour n'est pas en ville.
- [x] Un agenda l'emporte sur la routine, un état sur l'agenda, la mort sur tout.

**Sous-tâches Haiku** : recenser les usages de `dayPeriod` (PR #17) à remplacer par l'heure. Fait : un seul usage, `materializeOccupants` (`src/core/worldgen/occupants.ts`), que V3.2-30 remplace.

**Réalisé** : `src/core/worldgen/archetypes.ts` (format Zod, seize archétypes) et `position.ts`. Un créneau peut passer minuit (la nuit de garde) ; ses jours sont `all`, `workdays`, `restday` (le dernier jour de la semaine du calendrier) ou un cycle propre à la personne (`{ cycle: 3, on: [0] }`) ; hors de tout créneau, on est chez soi. Le tirage d'un créneau se fait une fois par jour, pas par heure. La teinte de la psyché est un paramètre borné à ±0,2, neutre tant que V3.2-40 n'existe pas.

### ☑ V3.2-30 — Les gens attachés à un lieu · `M` · sans modèle IA — **fait le 26 novembre**

**Modèle conseillé : Opus.**

- Gabarits de peuplement par type de lieu et taille de ville (§3, décision 6) : de l'ermite seul à douze personnes attachées au plus.
- Quatre attaches : personnel, habitués, logés, de passage (arrivée et durée de séjour tirées par semaine).
- Étend `materializeOccupants` (PR #17) : les clients « par moment » deviennent des gens attachés à l'heure, plus les clients d'un soir.
- Une entité du wiki reliée au lieu par `works_at` remplace l'occupant de même rôle (décision 4) : migration qui ajoute `works_at` à la contrainte de `relations` et à `RELATION_TYPES`.

**Critères d'acceptation**
- [x] Revenir dans la même auberge redonne le même personnel et les mêmes habitués ; une personne de passage repart à la fin de son séjour.
- [x] Un PNJ relié par `works_at` apparaît à la place de l'occupant tiré (dans le noyau : le service qui lit la relation vient avec V3.2-31).
- [x] Migration appliquée sur une copie locale, `docs/SCHEMA.md` §8 à jour.

**Réalisé** : `src/core/worldgen/occupants.ts`. `attachedPeople(ville, lieu, jour, workers)` rend les gens attachés (responsable, personnel, habitués, logés, gens de passage) ; `materializeOccupants(ville, lieu, moment, workers)` garde ceux que `position()` place ici à cette heure, plus les clients d'un soir (arrivée et durée de une à trois heures tirées avec le jour). Sept gabarits : auberge, taverne, temple, marché, caserne, atelier, ermitage. Un séjour de logé ou de passage est tiré par semaine et ne déborde pas sur la suivante, pour qu'une chambre n'ait jamais deux occupants. Le plafond de douze s'applique aux gens tirés ; les PNJ du wiki passent au-dessus. `dayPeriod` disparaît. Migration `20261126160000_relation_works_at.sql`.

### ☑ V3.2-31 — La présence calculée dans le solo · `M` · sans modèle IA — **fait le 26 novembre**

**Modèle conseillé : Opus.**

- Le service de scène calcule les présents d'un lieu à l'heure courante (V3.2-30 + `position()`) au lieu de la liste posée à la main ; chacun dans sa pièce (V3.2-28 : le personnel au comptoir, les logés dans leur chambre la nuit).
- À chaque tour qui fait passer du temps : différence avant / après ; arrivées et départs envoyés à l'IA comme **faits établis** (§9).
- Le panneau de scène garde la main : ajouter quelqu'un à la main reste possible (une entrée d'agenda « ici jusqu'à… »).
- Lieux faits main sans bloc ville : population et richesse déduites de l'infobox (décision 2).

**Critères d'acceptation**
- [ ] Rejoué : dormir dix heures à l'auberge, le hall du matin n'a pas les mêmes gens que celui du soir. (Vérifié par les tests du noyau ; à rejouer dans l'app.)
- [x] Une ligne de tour dit « le sergent sort », et la narration le raconte sans l'inventer : les allées et venues partent dans les « faits établis de ce tour ».
- [x] Coût mesuré : aucune requête de plus par tour. Trois lectures en parallèle au changement de lieu ; une écriture de plus seulement quand une narration a reçu des allées et venues sans faire passer de temps ; une lecture de plus, rare, quand une entité du wiki partie n'est plus parmi les présents.

**Réalisé** : `src/core/worldgen/placePresence.ts` (type du lieu lu dans l'infobox ou le nom, ville déduite des infobox du lieu et de ses parents, pièce et libellé d'une personne calculée), `src/core/rules/sceneLife.ts` (la vie du lieu rangée dans la scène, recalculée par `advanceSceneTime`, nouvelles de ce que le personnage voit changer dans sa pièce), `src/server/services/sceneLife.ts` (lecture au changement de lieu). Les personnes calculées entrent comme esquisses `calc-<graine>` au libellé sans nom (« aubergiste, d'âge mûr »), les PNJ `works_at` comme présents ; le moteur ne fait sortir que ceux qu'il a fait entrer. Une scène posée avant ce ticket se peuple au prochain enregistrement du panneau de scène ou au prochain déplacement.

**Écarts** : l'ajout à la main reste celui du panneau (l'entrée d'agenda « ici jusqu'à… » vient avec V3.2-32) ; les jours de semaine ne sont pas encore passés à `position()` (tous les jours sont ouvrés) ; le nom au premier contact est V3.2-41.

### ☐ V3.2-32 — L'agenda : exceptions datées · `M` · avec modèle IA (pour vérifier)

**Modèle conseillé : Opus** (migration, RLS, sortie de l'IA).

- Table des exceptions datées et des états (§5.1, §11) : `who` (entité ou graine d'occupant), `from`, `to`, `where`, `reason`, `kind` (agenda ou état) ; RLS par monde, refus par défaut.
- L'IA propose un rendez-vous dans la narration (`schedule`) ; le moteur valide (personne et lieu existants, créneau futur et borné) et l'inscrit (règle absolue 9 : passe par `ai_proposals`).
- Saisie à la main par le MJ ; une exception passée s'efface.

**Critères d'acceptation**
- [ ] « Mabelle ira au marché demain à l'aube » : le lendemain à 6 h, elle n'est pas au comptoir.
- [ ] Un rendez-vous proposé pour une personne ou un lieu inconnus est refusé et consigné.
- [ ] Liste de contrôle `docs/SECURITE.md` passée pour la table et la route.

### ☐ V3.2-37 — L'archétype de vie sur la fiche, déduit du métier · `S` · sans modèle IA

**Modèle conseillé : Sonnet**, une fois V3.2-29 fait.

- L'archétype visuel actuel (`src/core/psyche/archetype.ts`, deux pôles dominants) est **remplacé** par l'archétype de vie, à la même place et avec la même structure (nom, couleur de jeton) (décision 3).
- Champ `routine` du bloc `personality` ; proposé depuis le métier, corrigeable à la main ; sans métier lisible : « reste où il est ».

**Critères d'acceptation**
- [ ] Une fiche « aubergiste » montre « Personnel de lieu » ; le changer à la main est gardé.
- [ ] Planche du catalogue à jour.

**Sous-tâches Haiku** : libellés dans `messages/`, planche du catalogue.

### ☐ V3.2-38 — Les absents : témoignages et personnalités publiques · `M` · avec modèle IA

**Modèle conseillé : Opus.**

- Personnalités publiques (§3.1) : découverte `mentioned` d'avance pour quiconque vit dans leur domaine.
- Un PNJ qui parle d'un absent : le moteur le retrouve ou le matérialise par sa graine, crée sa page (`mentioned`) et y note un **témoignage attribué** (« selon Mabelle… »), jamais un fait. Un détail qui contredit la simulation est refusé, ou marqué rumeur fausse si l'informateur a une raison de mentir (franchise, V3.2-40).

**Critères d'acceptation**
- [ ] Demander « où trouver le forgeron ? » crée sa page avec le témoignage, et aller voir confirme ou dément.
- [ ] La vérité ne quitte jamais le serveur (règle absolue 5).

## 2. La ville

Spécification : `specs/vie-du-monde.md` §6 à §8.

### ☐ V3.2-33 — Le régime d'une ville · `M` · sans modèle IA

**Modèle conseillé : Opus.**

- Agrégats du bloc `settlement` (§6, §6.1) : stabilité, emprise, légitimité, cohésion, prospérité, criminalité, corruption ; deux à quatre groupes d'intérêt tirés des métiers, avec leur satisfaction.
- Lien à la faction au pouvoir (`leads`) ; ses convictions donnent les normes (V3.2-40).
- Retour lent vers l'équilibre ; effets amortis (`applyDelta`).
- Réservé au MJ (décision 8) : les joueurs n'en voient que des signes.

**Critères d'acceptation**
- [ ] Une ville sans événement revient vers son équilibre en quelques mois de jeu.
- [ ] Aucun agrégat n'est envoyé à un client joueur.

### ☐ V3.2-34 — Les événements à l'heure autour du personnage · `L`, à découper · sans modèle IA

**Modèle conseillé : Opus.**

- Catalogue d'une trentaine de types en données (§7.1, décision 10), relu par l'auteur.
- Fréquence = taille × sensibilités aux agrégats (§7.2) ; visibilité visible / étouffé / caché selon l'emprise (§7.3) ; intrigues cachées à plusieurs étapes (§6.1).
- Effets logiques et bornés (§7.4, décision 11) : états avec une cause, pas de résurrection hors magie prévue par les règles ; changement durable d'un PNJ du wiki par l'onglet « Changements ».
- Tirage à chaque tour qui fait passer du temps ; un événement ne se montre que si le personnage s'en aperçoit (décision 13).

**Critères d'acceptation**
- [ ] Sur un an simulé, un hameau paisible a peu d'incidents, un port agité plusieurs par jour.
- [ ] Une ville répressive a moins d'événements visibles et plus de cachés qu'une ville laxiste de même taille.
- [ ] Une arrestation suppose un crime connu ; la peine finit.

### ☐ V3.2-35 — Le rattrapage et les nouvelles qui voyagent · `M` · sans modèle IA

**Modèle conseillé : Opus.**

- À l'arrivée dans une ville : tirer les semaines écoulées depuis la dernière (§8), au mois au-delà d'un an (décision 14) ; date de la dernière semaine tirée dans le bloc `settlement`.
- Un événement de grande portée arrive comme rumeur ailleurs, avec un délai selon la distance.

**Critères d'acceptation**
- [ ] Revenir après trois semaines tire trois semaines, une seule fois ; rejouer la même arrivée donne le même résultat.
- [ ] Le rattrapage d'un an se fait en moins d'une seconde.

### ☐ V3.2-39 — Un événement non remarqué se découvre plus tard · `S` · sans modèle IA

**Modèle conseillé : Opus.**

- Un événement qui vise le personnage passe par un jet du moteur (décision 12), par exemple l'Escamotage du voleur contre la Perception passive (§7.5).
- Pas remarqué : l'effet s'applique, rien n'est dit ; une découverte différée annonce le manque à la prochaine utilisation de l'objet ou quelques heures après.
- Le voleur existe et a une routine : on peut le retrouver.

**Critères d'acceptation**
- [ ] Un vol raté en Perception ne laisse aucune trace dans le fil avant la découverte.
- [ ] La découverte arrive comme fait établi, et une seule fois.

## 3. La psyché

Spécification : `specs/vie-du-monde.md` §10. Ne dépend pas de la PR #17.

### ☐ V3.2-41 — Le nom d'une personne calculée, au premier contact · `S` · sans modèle IA

**Modèle conseillé : Opus.** Décision de l'auteur (26 novembre 2026).

- Une personne calculée n'a qu'un libellé (« aubergiste, d'âge mûr ») tant qu'on n'a pas interagi avec elle (V3.2-31).
- Quand elle s'ancre (`promoteSketch` : elle parle trois fois, le joueur la nomme, « garder cette fiche »), son nom officiel est tiré au générateur PNJ et gardé sur sa page.
- Tant que le personnage joué ne connaît pas ce nom, sa page et la narration l'appellent par le libellé : même mécanisme que pour les PNJ à table (nom officiel, et nom connu du joueur dans le journal du PNJ ou `known_as`).

**Critères d'acceptation**
- [ ] Parler trois fois à « aubergiste, d'âge mûr » crée sa page sous un nom tiré ; le volet et la narration disent toujours « aubergiste, d'âge mûr ».
- [ ] Quand le personnage apprend le nom, il remplace le libellé partout pour ce joueur.

### ☐ V3.2-40 — Franchise, centres d'intérêt, normes et façades · `M` · sans modèle IA

**Modèle conseillé : Opus** (schéma du bloc, noyau).

- Septième pôle du bloc `personality` : `franchise ↔ dissimulation` (décision de l'auteur, 26 novembre) ; met à jour `specs/psyche-pnj.md` §2.
- Liste commune d'une trentaine de centres d'intérêt, jauge de −100 (dégoût) à +100 (passion), stockage des seules valeurs non nulles (§10.2). La sexualité est une entrée comme une autre, montrée seulement si les romances sont actives, le réglage « Récit » le permet et le personnage est adulte.
- Facette `intimacy` facultative : attirance (genres, aucun, neutre), situation (§10.1).
- Valeur montrée quand elle diffère de la vécue (§10.3), même mécanique que l'ADR 0111 ; normes par ville ; choix se conformer / cacher / assumer / militer, calculé ; le juste milieu calibré par des tests de répartition.
- L'IA reçoit les trois intérêts montrés les plus forts et le dégoût montré le plus fort de chaque présent.

**Critères d'acceptation**
- [ ] Dans une ville tolérante, presque personne n'a de façade ; dans une ville pieuse et répressive, une minorité cache un goût condamné, quelques-uns militent.
- [ ] La valeur vécue ne quitte jamais le serveur.
- [ ] La fiche montre les quatre ou cinq intérêts les plus marqués, le reste se déroule.

**Sous-tâches Haiku** : libellés des intérêts et des bandes dans `messages/`, planche du catalogue.

### ☐ V3.2-36 — Le questionnaire de psyché à la Ultima IV · `M` · sans modèle IA

**Modèle conseillé : Opus** pour la banque de dilemmes, **Sonnet** pour l'écran.

- Proposé au choix après la création d'un personnage joué ou d'un PNJ, et par un bouton « Passer le questionnaire » sur une fiche existante, avec aperçu avant d'écraser (décision 17).
- Une dizaine de dilemmes tirés d'une banque d'une trentaine (décision 18), chacun lié à deux pôles du tempérament ou des convictions (décision 15).
- Puis les aspirations (listes plus champ libre, décision 16), les centres d'intérêt, et une partie intimité facultative, affichée seulement si les romances sont actives.
- Le résultat se corrige à la main ; l'IA n'y répond jamais à la place de quelqu'un.

**Critères d'acceptation**
- [ ] Un passage complet remplit les pôles, les convictions, trois aspirations et quelques intérêts.
- [ ] La banque de dilemmes est relue par l'auteur avant fusion.
- [ ] Planche du catalogue pour l'écran du questionnaire.

**Sous-tâches Haiku** : libellés, planche du catalogue.
