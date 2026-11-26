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

---

## Où trouver un ticket

| Fichier | Contenu |
|---|---|
| [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) | L'écran central : bulles, contour, chargement, envoi, jet dans le fil, faux jets (V3.2-1 à 4, 20, 21) |
| [`02-recit-et-liens.md`](backlog-v3.2/02-recit-et-liens.md) | Le texte : la personne du récit, les liens vers les fiches (V3.2-5, 6) |
| [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) | Les colonnes : l'onglet Wiki, les volets, les présents (V3.2-7, 12 à 16, 25) |
| [`04-commerce.md`](backlog-v3.2/04-commerce.md) | Acheter, vendre, échanger : le moteur règle, le PNJ réagit (V3.2-8 à 11) |
| [`05-narration.md`](backlog-v3.2/05-narration.md) | La narration qui fait avancer l'histoire : consigne, horloge, déplacement (V3.2-17 à 19) |
| [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) | Faut-il un jet ? L'IA classe, le moteur fixe le DD (V3.2-22 à 24, ADR 0113) |

| Ticket | État | Modèle IA | Titre | Fichier |
|---|---|---|---|---|
| V3.2-1 | ☐ | sans | Qui parle, et quand : les bulles du fil | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-2 | ☑ | sans | Le contour de « Que fais-tu ? » | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-3 | ☑ | sans | On ne sait pas si c'est parti, ni si l'IA répond | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-4 | ☑ | sans | La zone de texte se vide à l'envoi | [`01-ecran-du-solo.md`](backlog-v3.2/01-ecran-du-solo.md) |
| V3.2-5 | ☐ | **avec** | Le récit s'adresse au joueur : tu, ou vous | [`02-recit-et-liens.md`](backlog-v3.2/02-recit-et-liens.md) |
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
| V3.2-22 | ☐ | sans | Du palier au DD, et la réussite automatique | [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) |
| V3.2-23 | ☐ | **avec** | Le classifieur, son prompt et son corpus | [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) |
| V3.2-24 | ☐ | sans | Le classement joue le tour, la pastille propose | [`06-jet-ou-pas.md`](backlog-v3.2/06-jet-ou-pas.md) |
| V3.2-25 | ☑ | sans | Deux bandes de même largeur | [`03-colonnes.md`](backlog-v3.2/03-colonnes.md) |

---

## Méthode

Mêmes règles qu'ailleurs : `docs/CHARTE-UI.md` avant tout code d'interface, une planche du catalogue par élément nouveau ou modifié (`docs/catalogue/`), `docs/CABLAGE.md` avant tout nouveau chargement, `docs/QUOTAS.md` pour ce que ça consomme. Jamais d'émoji.
