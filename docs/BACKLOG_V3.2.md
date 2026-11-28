# Backlog V3.2 — Le solo à l'usage

**Version :** 1.0 — 18 novembre 2026
**Ouvert après la première séance solo réellement jouée.**

Même esprit que la V3.1, et même discipline : **pas de lots planifiés à l'avance**. Ce backlog recueille ce que le mode solo montre **quand on y joue vraiment**, séance après séance. Un ticket s'y ajoute quand quelque chose a gêné à l'écran, pas quand il a été imaginé. Taille attendue : `S` ou `M` ; un ticket plus gros se découpe.

La différence avec la V3.1 : celle-ci recueillait les rugosités de l'outil (le wiki, les règles, les écrans du MJ) ; celle-là recueille ce qui gêne **en jouant**. C'est la matière que les lots E et F du backlog V3 attendent (`docs/BACKLOG_V3.md`, étape 1 : jouer) — mais ces tickets-ci se corrigent sans attendre, ils ne demandent pas trois séances.

**Lire les titres.** ☑ : terminé. ☐ : il reste du travail. Sous chaque titre, le **modèle conseillé** et s'il faut un **modèle d'IA joignable** pour coder ou vérifier (même convention que V3 et V3.1).

---

## Déjà ouverts ailleurs, même séance

Trois défauts de la même séance vivent dans la V3.1, parce qu'ils y ont été relevés avant l'ouverture de ce backlog. Ils font partie du même chantier et ne sont pas renumérotés :

| Ticket | Titre |
|---|---|
| [V3.1-225](backlog-v3.1/01-rugosites.md) | Le solo ne peut pas faire apparaître un figurant (le tirage est inerte) |
| [V3.1-226](backlog-v3.1/01-rugosites.md) | Une question posée dans la fiction n'est pas une question au MJ |
| [V3.1-227](backlog-v3.1/01-rugosites.md) | « Présents » doit montrer les inconnus, avec ce qu'on en voit |
| [V3.1-223](backlog-v3.1/01-rugosites.md) | Un tour sans narration doit le dire |

---

## Ordre recommandé

1. **Ce qui coûte peu et gêne à chaque tour** : V3.2-4 (la zone qui ne se vide pas), V3.2-3 (on ne sait pas si c'est parti), V3.2-2 (le contour).
2. **Ce qui change le texte lui-même** : V3.2-5 (la deuxième personne) — une ligne de consigne, un réglage de partie.
3. **Ce qui demande du dessin** : V3.2-1 (les bulles), V3.2-12 (les volets), puis V3.2-7 (l'onglet Wiki).
4. **Ce qui demande de la conception** : V3.2-6 (les liens automatiques), le plus risqué ; V3.2-13 (l'attitude perçue), puis V3.2-14 qui en dépend.
5. **Ce qui casse le jeu à chaque auberge** : V3.2-8 et 9 (le moteur règle un échange, au prix des règles), puis 10 (l'écran), puis 11 (le PNJ sait ce que tu as et ce que tu dois). Décision : ADR 0110.
6. **La vie du monde** (`07-vie-du-monde.md`, ADR 0115) : après la fusion de la PR #17, V3.2-29 à 40.
7. **La fiche allégée des PNJ** (`08-fiche-pnj.md`, ADR 0118) : V3.2-46 à 52.
8. **L'écran de jeu** (`09-ecran-de-jeu.md`, ADR 0120) : lot 1 (V3.2-55 à 58) et la date (V3.2-59), les petits correctifs (69 à 71), puis le volet d'une personne (60 à 65) et le combat (66 à 68, 73, 74 ; ADR 0121).

---

## Où trouver un ticket

| Fichier | Contenu |
|---|---|
| [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) | L'écran central : bulles, contour, chargement, envoi, jet dans le fil, faux jets (V3.2-1 à 4, 20, 21) |
| [`02-recit-et-liens.md`](backlog-v3.2/02-recit-et-liens.md) | Le texte : la personne du récit, les liens vers les fiches (V3.2-5, 6) |
| [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) | Les colonnes : l'onglet Wiki, les volets, les présents (V3.2-7, 12 à 16, 25) |
| [`04-commerce.md`](backlog-v3.2/04-commerce.md) | Acheter, vendre, échanger : le moteur règle, le PNJ réagit (V3.2-8 à 11) |
| [`05-narration.md`](backlog-v3.2/05-narration.md) | La narration qui fait avancer l'histoire : consigne, horloge, déplacement, repos long, ligne du tour (V3.2-17 à 19, 26, 27) |
| [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) | Faut-il un jet ? L'IA classe, le moteur fixe le DD (V3.2-22 à 24, ADR 0113) |
| [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) | La vie du monde : routines, régime, événements, psyché (V3.2-29 à 40, ADR 0115) |
| [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) | La fiche allégée des PNJ, les indices, les jets des PNJ (V3.2-46 à 52, 54, ADR 0118) |
| [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) | L'écran de jeu : rail de jeu, volet de consultation, volet d'une personne, date, combat, petits correctifs (V3.2-55 à 72, ADR 0120) |

| Ticket | État | Modèle IA | Titre | Fichier |
|---|---|---|---|---|
| V3.2-1 | ☐ | sans | Qui parle, et quand : les bulles du fil | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-2 | ☑ | sans | Le contour de « Que fais-tu ? » | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-3 | ☑ | sans | On ne sait pas si c'est parti, ni si l'IA répond | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-4 | ☑ | sans | La zone de texte se vide à l'envoi | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-5 | ☑ | **avec** | Le récit s'adresse au joueur : tu, ou vous, son registre et les scènes intimes | [`02-recit-et-liens.md`](backlog-v3.2/02-recit-et-liens.md) |
| V3.2-6 | ☐ | **avec** | Les fiches citées par le récit deviennent des liens | [`02-recit-et-liens.md`](backlog-v3.2/02-recit-et-liens.md) |
| V3.2-7 | ☐ | sans | L'onglet Wiki : chercher et lire sur place | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-8 | ☑ | sans | Le moteur règle un échange | [`04-commerce.md`](backlog-v3.2/04-commerce.md) |
| V3.2-9 | ☑ | sans | Le prix vient des règles et du wiki | [`04-commerce.md`](backlog-v3.2/04-commerce.md) |
| V3.2-10 | ☑ | sans | Acheter, vendre, échanger depuis « Que fais-tu ? » | [`04-commerce.md`](backlog-v3.2/04-commerce.md) |
| V3.2-11 | ☑ | **avec** | Le PNJ sait ce que tu as et ce que tu dois | [`04-commerce.md`](backlog-v3.2/04-commerce.md) |
| V3.2-12 | ☐ | sans | Les volets : le fil s'étale, un onglet au bord de chaque volet | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-13 | ☑ | sans | L'attitude perçue des présents arrive à l'écran (ADR 0111) | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-14 | ☐ | sans | Les présents dans la bande du Monde fermé | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-15 | ☐ | **avec** | Écrire la façade d'un PNJ, et la faire jouer au narrateur | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-16 | ☐ | sans | La fiche repliée montre des jauges circulaires | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-21 | ☑ | sans | Un nom de compétence ou d'arme au milieu d'une phrase ne lance plus de jet | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-17 | ☐ | **avec** | Une consigne de MJ, et le contexte pour la suivre | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-18 | ☐ | sans | L'horloge suit l'histoire | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-19 | ☐ | **avec** | L'IA t'emmène ailleurs : lieux et pièces | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-20 | ☑ | sans | Le jet demandé se lance depuis le récit, DD et issue masqués au choix | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-22 | ☑ | sans | Du palier au DD, et la réussite automatique | [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) |
| V3.2-23 | ☐ | **avec** | Le classifieur, son prompt et son corpus | [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) |
| V3.2-24 | ☐ | sans | Le classement joue le tour, la pastille propose | [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) |
| V3.2-25 | ☑ | sans | Deux bandes de même largeur | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |
| V3.2-26 | ☑ | sans | Dormir dans le récit fait un repos long | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-27 | ☑ | sans | La ligne du tour, les notes du monde d'office, le temps du combat | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-28 | ☑ | sans | Les présents suivent la pièce | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-29 | ☑ | sans | Archétypes de vie et `position()` | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-30 | ☑ | sans | Les gens attachés à un lieu | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-31 | ☑ | sans | La présence calculée dans le solo | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-32 | ☐ | avec | L'agenda : exceptions datées | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-33 | ☐ | sans | Le régime d'une ville | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-34 | ☐ | sans | Les événements à l'heure autour du personnage | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-35 | ☐ | sans | Le rattrapage et les nouvelles qui voyagent | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-36 | ☐ | sans | Le questionnaire de psyché à la Ultima IV | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-37 | ☐ | sans | L'archétype de vie sur la fiche, déduit du métier | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-38 | ☐ | avec | Les absents : témoignages et personnalités publiques | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-39 | ☐ | sans | Un événement non remarqué se découvre plus tard | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-40 | ☐ | sans | Franchise, centres d'intérêt, normes et façades | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-45 | ☑ | sans | Le nom d'une personne calculée, au premier contact | [`07-vie-du-monde.md`](backlog-v3.2/07-vie-du-monde.md) |
| V3.2-41 | ☑ | sans | Les PNJ restent dans leur rôle, les prix se disent, la pluie reste dehors | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-42 | ☑ | sans | La carte se tire dès qu'on la demande | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-43 | ☑ | sans | En solo, l'IA sait ce que sait le MJ (ADR 0117) | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-44 | ☑ | sans | Une esquisse servie ou nommée par son prénom devient une fiche | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-53 | ☑ | sans | Ceux qui partagent la pièce entrent au Wiki | [`05-narration.md`](backlog-v3.2/05-narration.md) |
| V3.2-46 | ☐ | sans | Jauger quelqu'un n'est pas l'attaquer | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-47 | ☐ | sans | La fiche de base d'un PNJ, tirée du SRD | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-48 | ☐ | sans | Équipement probable et bourse | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-49 | ☐ | sans | La table des indices découverts et la vue joueur (ADR 0118) | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-50 | ☑ | sans | Un jet réussi révèle des indices | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-51 | ☐ | sans | En solo, le wiki se lit en vue joueur | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-52 | ☐ | **avec** | Le moteur fait les jets des PNJ | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-54 | ☐ | **avec** | Le récit nourrit la fiche du PNJ | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-80 | ☐ | **avec** | Ce que les PNJ savent du personnage | [`08-fiche-pnj.md`](backlog-v3.2/08-fiche-pnj.md) |
| V3.2-55 | ☐ | sans | En jeu, le rail devient le rail de jeu | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-56 | ☐ | sans | Le volet de consultation | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-57 | ☐ | sans | Les fiches et les règles se lisent en entier dans le volet | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-58 | ☐ | sans | Les notes dans le volet | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-59 | ☑ | sans | La date et la saison, dans le bandeau et pour l'IA | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-60 | ☐ | sans | Le volet d'une personne : portrait, état, humeur | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-61 | ☐ | sans | « Envers toi » : barres continues avec zone floue | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-62 | ☐ | sans | Fiche, inventaire et magie découverts | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-63 | ☐ | sans | La psyché découverte | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-64 | ☐ | **avec** | Ce que l'IA observe, le moteur l'enregistre | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-65 | ☐ | sans | L'orientation dans la personnalité | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-66 | ☐ | sans | ADR : le moteur ouvre un combat en solo | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-67 | ☐ | sans | Le combat dans le rail | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-68 | ☐ | sans | L'initiative dans le fil | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-69 | ☑ | sans | « Demande honorée » ne sort plus dans la ligne du tour | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-70 | ☑ | sans | Une attaque demande sa cible ; l'attaque à mains nues existe | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-71 | ☑ | sans | L'outil de dés ne s'ouvre plus après le résultat | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-72 | ☐ | sans | La page wiki d'un PJ montre sa fiche, pas des titres vides | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-73 | ☐ | **avec** | Le tour d'un PNJ en combat | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-74 | ☑ | sans | Moral et fin du combat | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-75 | ☑ | sans | Le personnage à terre : jets contre la mort, un allié qui stabilise | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |
| V3.2-76 | ☑ | sans | Le sort de qui tombe, et la fin de la partie solo | [`09-ecran-de-jeu.md`](backlog-v3.2/09-ecran-de-jeu.md) |

---

## Méthode

Mêmes règles qu'ailleurs : `docs/CHARTE-UI.md` avant tout code d'interface, une planche du catalogue par élément nouveau ou modifié (`docs/catalogue/`), `docs/CABLAGE.md` avant tout nouveau chargement, `docs/QUOTAS.md` pour ce que ça consomme. Jamais d'émoji.
