# Ce que les autres jeux nous apprennent — recherche pour la V4

**Date :** 22 octobre 2026 · **Pour :** `docs/BACKLOG_V4.md`, `specs/psyche-v4.md`, `specs/simulation-monde.md`

Ce document dit **d'où viennent** les décisions de la V4. On s'inspire, on ne copie rien : aucun texte, nom propre, table ou code de ces jeux n'entre dans le dépôt. Les listes de CreaDonjon sont les nôtres, réorganisées, renommées, complétées ou réduites.

---

## 1. Dwarf Fortress — la référence

**Sources :** les définitions de structures de DFHack (`DFHack/df-structures`, open source : `df.personality.xml`, `df.history_figure.xml`, `df.history_event.xml`) et le wiki de Dwarf Fortress (pages *Memory (thought)*, *Personality facet*, *Personality value*, *Personality need*, *Stress*, *Rumor*, *Intrigue*, *World generation*). Aucune décompilation : DFHack documente déjà les structures.

### Ce que contient la psyché d'une créature

| Couche | Dans Dwarf Fortress | Mesuré dans DFHack |
|---|---|---|
| **Facettes** | 50 traits de tempérament, 0 à 100, centre à 50 ; la plage 40-60 n'est même pas affichée | `personality_facet_type`, 50 entrées |
| **Valeurs** | 33 convictions, −50 à +50 ; 78 % des tirages tombent dans la zone neutre ; chaque civilisation a ses valeurs par défaut, et l'individu s'en écarte | `value_type`, 33 entrées |
| **Éthiques** | 22 actes (tuer un innocent, torturer, trahir, rompre un serment, mentir, voler…) et, pour chacun, une réponse graduée sur 18 niveaux (« requis », « acceptable », « justifié si bonne raison », « honteux », « impensable »…). C'est **culturel** | `ethic_type`, `ethic_response` |
| **Besoins** | 30 besoins (compagnie, prière, créer, apprendre, se battre, flâner…). Chacun a un **poids** tiré des facettes et des valeurs, et un **niveau** qui remonte au maximum quand on le satisfait puis redescend avec le temps | `need_type`, `personality_needst` (`focus_level`, `need_level`) |
| **Rêves** | 13 buts de vie (fonder une famille, gouverner le monde, créer un chef-d'œuvre, devenir un guerrier légendaire, tomber amoureux, faire une grande découverte…) | `goal_type` |
| **Émotions** | environ 170 émotions nommées, chacune avec une intensité et la **circonstance** qui l'a causée (plus de 550 types de pensées) | `emotion_type`, `unit_thought_type` |
| **Préférences** | goûts : matériaux, aliments, créatures, couleurs, formes… | `personality_preference_type` |
| **Stress** | deux jauges : **court terme** (l'humeur) et **long terme** (accumulée lentement, plusieurs années pour monter ou redescendre). Une crise n'éclate que si **les deux** sont hautes. Trois facettes règlent la vulnérabilité : bravoure (vitesse d'accumulation), vulnérabilité au stress (seuil), anxiété (vitesse de récupération) | `stress`, `longterm_stress` |
| **Mémoire** | **8 emplacements à court terme**, **8 à long terme**, et des **souvenirs fondateurs** sans limite | `personality_memory_handlerst` |

### La mémoire, en détail (le mécanisme le plus réussi)

- Chaque souvenir appartient à un **groupe**. À court terme, un seul souvenir par groupe : le plus fort des deux est gardé. Ça empêche qu'une bataille remplisse les 8 emplacements avec la même horreur.
- Un souvenir qui tient **un an** à court terme tente d'entrer en mémoire longue. Il n'y entre que s'il est plus fort que ce qu'il remplacerait.
- Un souvenir long est **revécu** régulièrement, et l'émotion revient.
- À chaque fois qu'il est revécu, un souvenir de certains groupes a **une chance sur trois** de devenir **fondateur** : il quitte la mémoire longue et **modifie une facette ou une valeur**, définitivement. Le changement est affiché avec sa cause et sa date (« tombe amoureuse facilement, depuis la naissance de sa sœur en 351 »).
- Les souvenirs qui deviennent fondateurs sont surtout négatifs (voir mourir, perdre un proche, un traumatisme), avec quelques positifs (se marier, devenir parent).

### Les relations

Une relation historique porte cinq valeurs : **amour, confiance, loyauté, respect, peur** (−100 à +100), plus la **familiarité** (nombre de rencontres, date de la dernière) et un **lien nommé** (ami d'enfance, compagnon d'armes, amant, ex, rancune, rival en affaires, maître, apprenti…). On distingue **connaître quelqu'un de vue** et **le connaître de réputation**. La réputation est une liste d'étiquettes (héros, meurtrier, voleur, conteur, protecteur des faibles…), chacune avec une intensité.

Certaines facettes contribuent à la compatibilité : deux personnes très éloignées sur ces facettes ont tendance à se détester.

### Les rumeurs et l'intrigue

- Une rumeur porte sur un **événement historique** précis. Elle part des témoins et se propage de personne en personne. Six niveaux de connaissance de la position d'un objet, de « je l'ai » à « aucune idée ». **La connaissance s'efface** en semaines et en années ; la réputation dure plus longtemps.
- **Limite constatée** : dans Dwarf Fortress, une rumeur n'est **jamais fausse**, sauf sur l'identité réelle des personnes. **CreaDonjon fait mieux** sur ce point (§5, Talk of the Town).
- L'intrigue : des figures historiques forment des réseaux (persuasion, chantage, corruption), et les autorités enquêtent à partir de preuves (témoins, interrogatoires, surveillance).

### Le moteur d'histoire

- La génération simule l'histoire au pas grossier. Les **figures historiques** sont des individus ; les populations sont des nombres.
- Paramètres de départ : taille du monde, **longueur de l'histoire** (très courte à très longue), nombre de civilisations, de sites, de bêtes légendaires, sauvagerie, minerais…
- La génération peut être interrompue : l'année d'arrêt fixe le monde de départ.
- Le journal d'histoire a un vocabulaire fermé d'environ 140 genres d'événements (mort, fondation de site, bataille, création d'artefact, mariage par ajout de lien, secret appris, insurrection, alliance…). Le mode **Légendes** le rend consultable.

---

## 2. RimWorld — l'humeur lisible

**Sources :** wiki de RimWorld (*Mood*, *Thought*, *Mental break*, *Need*).

- **L'humeur est une somme de « pensées »** affichées une par une, chacune avec sa valeur et sa durée (« a mangé sans table −3, 1 jour »). C'est le modèle le plus **lisible** qui existe : le joueur comprend toujours pourquoi.
- Trois **seuils de crise** (mineure, majeure, extrême), déplacés par les traits. Après une crise, une **catharsis** temporaire.
- Une humeur très haute peut déclencher une **inspiration** (un bonus temporaire). C'est le symétrique positif de la crise.

**Ce qu'on prend :** l'humeur **calculée**, jamais stockée (règle 16), comme somme lisible des émotions actives. Les crises et leur symétrique positif, l'« élan ».

## 3. Crusader Kings III — le stress comme coût d'agir contre sa nature

**Sources :** journal de développement Paradox n° 31 « A Stressful Situation » ; guides communautaires.

- On gagne du stress surtout quand on **agit contre ses traits** (un personnage compatissant qui fait exécuter un prisonnier).
- Trois niveaux de stress, avec des pénalités croissantes. Les **mécanismes d'adaptation** (boire, chasser, festoyer) réduisent le stress mais laissent des traits.
- Les opinions sont des **modificateurs datés** qui s'additionnent et expirent.

**Ce qu'on prend :** une action contraire à une facette forte ou à une éthique coûte du stress ; une crise peut laisser une trace durable (souvenir fondateur). Les **limites** (« fera, mais à contrecœur ») deviennent mécaniques.

## 4. Les Sims — les objets font de la publicité

**Sources :** propos de Will Wright rapportés (Game Maker's Toolkit, Gamesradar).

- Les Sims ne sont pas intelligents : **les objets annoncent ce qu'ils satisfont** (« si tu as faim, viens à moi »). Le Sim pondère chaque annonce par l'urgence de ses besoins et choisit.
- Ajouter un objet ne demande pas de modifier les Sims.

**Ce qu'on prend :** chaque **action de vie** annonce les besoins qu'elle comble. Le choix d'action se calcule en pondérant les annonces par les besoins. Ajouter une action ne touche pas aux personnes.

## 5. Talk of the Town — des personnages qui se trompent et qui mentent

**Source :** les travaux de James Ryan et du laboratoire Expressive Intelligence Studio (UC Santa Cruz), notamment l'article « Toward Characters Who Observe, Tell, Misremember, and Lie » (2015). *Recherche en ligne non concluante le 22 octobre : ce résumé vient de la connaissance du domaine et reste à vérifier sur la publication.*

- Chaque personnage tient un **modèle mental** des autres : ce qu'il croit de leur apparence, de leur métier, de leur domicile. Chaque croyance a une **source** : observation, ce qu'on m'a dit, conversation surprise, déduction, mensonge reçu…
- Les croyances **se dégradent** (oubli), **mutent** (une erreur de transmission) et peuvent être **inventées** (confabulation).
- Le jeu repose entièrement sur l'écart entre ce que les gens croient et la vérité.

**Ce qu'on prend :** les croyances avec leur source et leur certitude, la mutation à chaque transmission, le mensonge motivé. C'est **là où l'on dépasse Dwarf Fortress**, dont les rumeurs sont toujours exactes.

## 6. Shadow of Mordor — le système Nemesis

**Sources :** analyses et entretiens rapportés (Michael de Plater, Bob Roberts).

- Les issues de combat sont **de la matière narrative** : un orc qui tue le joueur est promu, un orc qui fuit revient avec une cicatrice et s'en souvient dans ses répliques.

**Ce qu'on prend :** des emplacements de mémoire **réservés au joueur**, que le quotidien ne chasse pas, et des rêves qui naissent d'une défaite, d'une humiliation ou d'une dette envers un PJ.

## 7. Wildermyth — la transformation par les événements

**Sources :** wiki de Wildermyth, critiques.

- Les héros **changent** au fil des événements (apparence, traits, liens). Trois types de liens (amitié, romance, rivalité), chacun sur **cinq niveaux** nommés, avec un effet mécanique.
- Les héros morts entrent dans l'**héritage** et peuvent revenir dans une autre partie.

**Ce qu'on prend :** des liens nommés à paliers. La psyché d'un PJ qui change est **proposée au joueur**, comme un moment d'histoire.

## 8. Ultima IV — le questionnaire moral

**Sources :** Wikipédia, *The Digital Antiquarian* (filfre.net).

- Une diseuse de bonne aventure pose sept dilemmes entre deux vertus ; les réponses fixent la classe. Garriott voulait que le joueur **s'identifie** au personnage, d'où le refus des dés. Il admettait qu'il n'existe pas de façon parfaite de poser ces questions.

**Ce qu'on prend :** le questionnaire par **dilemmes**, sans bonne réponse ; chaque réponse pousse quelques facettes et valeurs.

## 9. Caves of Qud — une histoire générée qui se découvre

**Sources :** wiki de Caves of Qud (*Sultan*), notes des développeurs.

- Cinq sultans sur six sont générés à chaque partie, avec leurs reliques et leurs lieux. Le joueur **reconstitue** cette histoire par les statues, les objets gravés et les sites.

**Ce qu'on prend :** l'histoire générée n'est **pas donnée** au joueur : il la découvre par fragments, et chaque fragment peut être déformé (§5).

## 10. L'IA par utilité — choisir sans arbre de décision

**Sources :** Dave Mark et Mike Lewis, *Infinite Axis Utility System*, GDC AI Summit 2015 ; *Behavioral Mathematics for Game AI* (Dave Mark).

- Une action est notée par le **produit** de plusieurs **considérations**, chacune transformée par une **courbe de réponse** (linéaire, quadratique, logistique, seuil), avec une compensation pour que le nombre de considérations ne pénalise pas l'action. Tout est **en données** : on règle sans programmer.

**Ce qu'on prend :** le choix d'action de la V4 est une IAUS réduite, à courbes et entrées fermées, sans aucun code fourni par l'utilisateur.

## 11. La psychologie, pour ne pas inventer

- **Le modèle OCC** (Ortony, Clore, Collins, *The Cognitive Structure of Emotions*, 1988) : on ressent une émotion en évaluant **un événement** (bon ou mauvais pour moi, pour un autre), **l'acte d'un agent** (louable ou blâmable selon mes valeurs) ou **un objet** (que j'aime ou non). C'est la grille de l'évaluation (E1).
- **Big Five et HEXACO** : les facettes se rangent en familles ; HEXACO ajoute **honnêteté-humilité**, que Dwarf Fortress n'a pas (il n'a ni sincérité ni manipulation comme facette). On l'ajoute : les mensonges du §5 en ont besoin.

---

## 12. Ce que CreaDonjon fait mieux, en résumé

| Point | Le meilleur ailleurs | Ce que la V4 ajoute |
|---|---|---|
| Rumeurs | Dwarf Fortress : jamais fausses | croyances qui mutent, mensonges motivés, réputation par lieu (Talk of the Town) |
| Lisibilité de l'humeur | RimWorld | chaque valeur qui bouge dit pourquoi, jusque dans les traits (souvenir fondateur, Dwarf Fortress) |
| Mémoire du joueur | Nemesis, pour des ennemis | emplacements réservés au joueur pour **toute** personne |
| Lignes rouges | texte libre (V2) ; éthiques culturelles (Dwarf Fortress) | éthiques typées, culturelles **et** individuelles, que le moteur respecte |
| Psyché d'un PJ | Dwarf Fortress : le joueur ne la contrôle pas | réglages de table complets, transformation proposée au joueur |
| Le MJ humain | aucun de ces jeux | le simulateur : accepter ou rejeter élément par élément |
| Identité | rarement modélisée | identité et orientations affichées ; un filtre, jamais un trait |
