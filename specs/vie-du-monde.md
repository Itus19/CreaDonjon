# Spécification — La vie du monde : routines, événements, psyché

**Statut :** proposition du 26 novembre 2026, à relire par l'auteur. Décisions de départ dans l'[ADR 0115](../docs/adr/0115-la-vie-du-monde-se-calcule.md).
**Lien :** prolonge `specs/generation-du-monde.md` (PR #17, ville en agrégat et `materializeOccupants`) et `specs/psyche-pnj.md` (bloc `personality`). Respecte l'[ADR 0104](../docs/adr/0104-le-cap-du-mode-solo.md).

---

## 0. Pourquoi

Séance du 26 novembre : le personnage dort dix heures dans sa chambre de l'auberge, se réveille, et retrouve dans le hall exactement les mêmes personnes. V3.2-28 a réglé « qui est dans ma pièce » ; reste « qui est là à cette heure-ci, et pourquoi ».

L'auteur veut une approche **organique** : la plupart des gens ont une routine et des aspirations ; certains sont des piliers de bar, d'autres sont de passage ; la ville vit sans le personnage, plus ou moins selon sa taille, son régime et sa stabilité ; un régime répressif étouffe ce qui se voit et pousse le reste dans l'ombre.

Cette spec dit **comment rendre tout cela réel et cohérent sans simuler chaque habitant minute par minute**.

## 1. Principes

1. **Une routine se calcule, elle ne se simule pas.** Où se trouve une personne à une heure donnée est le résultat d'une fonction pure : `position(personne, jour, heure)`. Rien n'est stocké tant que rien ne s'écarte de la routine. Revenir jeudi à 22 h redonne les mêmes gens.
2. **Déterministe, à graine fixe.** Toute part de hasard vient d'une graine dérivée (`deriveSeed`, PR #17) : de la ville, du lieu, de la personne, du jour, de l'heure ou de la semaine. Même graine, même monde (règle absolue 8 : les tirages sont ceux du serveur, jamais d'un modèle).
3. **Deux niveaux de détail.** Fin (l'heure) là où se trouve le personnage, grossier (la semaine) ailleurs. C'est l'arbitrage entre la simulation générale et la simulation autour du joueur.
4. **Le rattrapage paresseux.** Une ville que personne ne regarde ne coûte rien. Quand le personnage y arrive, le moteur tire d'un coup les semaines écoulées depuis sa dernière visite, avec les mêmes graines : la ville a vécu sans lui.
5. **L'histoire l'emporte sur la routine, le wiki l'emporte sur tout.** Une exception écrite (rendez-vous, prison, blessure) écrase la routine ; une personne écrite dans le wiki remplace l'occupant tiré (PR #17, §4.2).
6. **L'IA propose, le moteur décide.** L'IA peut proposer un rendez-vous ou un départ ; le moteur le valide et l'inscrit. Elle ne crée jamais une personne, un événement ou un nombre.
7. **Les plans gratuits sont une contrainte de conception** (`docs/QUOTAS.md`). Aucun tic de fond, aucune tâche planifiée : tout se calcule au moment d'une lecture que le jeu fait déjà (un tour, une arrivée dans un lieu).

## 2. Vocabulaire

| Terme | Sens | Identifiant |
|---|---|---|
| **attache** | Le lien d'une personne à un lieu : personnel, habitué, logé, de passage | `tie` |
| **archétype** | Un profil de vie dans une liste fermée (pilier de bar, artisan, garde, voyageur…) | `archetype` |
| **routine** | Les créneaux d'un archétype : où l'on est, de quelle heure à quelle heure, quels jours, avec quelle probabilité | `routine` |
| **agenda** | Les exceptions datées d'une personne, qui écrasent sa routine | `agenda` |
| **état** | Ce qui empêche la routine pour un temps : en prison, blessé, en fuite, en deuil, mort | `condition` (hors règles de jeu : `life_state`) |
| **régime** | Les agrégats sociopolitiques d'une ville (§6) | `regime` |
| **événement** | Un fait tiré d'un catalogue fermé : une bagarre, une arrestation, une émeute, une foire | `world_event` |
| **visibilité d'un événement** | Ce qu'en perçoit la rue : visible, étouffé, caché | `exposure` |
| **rattrapage** | Le tirage, à l'arrivée, des semaines écoulées hors de vue | `catch_up` |

« Zone » est déjà pris (les trois zones de la scène) ; « espace » désigne les lieux découpés (PR #17, §5).

## 3. Qui fréquente un lieu

Un lieu de la ville (l'auberge, le marché, la caserne) a ses **gens attachés**, tirés à graine fixe depuis les agrégats de la ville (population, peuples, métiers, richesse). Quatre attaches :

| Attache | Exemple | Combien | Ce qui varie |
|---|---|---|---|
| **personnel** | l'aubergiste, la servante, le palefrenier | 1 à 3, selon la richesse (PR #17) | rien : ce sont les mêmes |
| **habitué** | le pilier de bar, le joueur de cartes du jeudi | selon la taille de la ville et le type de lieu | qui vient ce jour-là, selon sa routine |
| **logé** | les clients des chambres | selon les chambres du lieu | séjour : jour d'arrivée, durée |
| **de passage** | le marchand ambulant, la messagère, les pèlerins | selon la position de la ville (route, port, frontière) | arrivée, durée, départ |

Une personne de passage a une **arrivée** et une **durée de séjour** tirées par semaine : elle repart vraiment, et une autre prend sa place. Les clients d'un soir qui ne reviendront pas restent ce que PR #17 tire déjà (graine du jour et de l'heure).

Une personne attachée n'est **pas** écrite en base : elle n'existe que comme graine et archétype, jusqu'à ce qu'on interagisse avec elle (ancrage, `promoteSketch`).

## 4. Archétypes et routines

### 4.1 Le format

Un archétype est une donnée, pas du code. Il porte une routine en créneaux :

```json
{
  "key": "pilier_de_bar",
  "label": "Pilier de bar",
  "routine": [
    { "where": "home",   "from": 0,  "to": 10, "days": "all", "chance": 1 },
    { "where": "tavern", "from": 11, "to": 24, "days": "all", "chance": 0.8 },
    { "where": "market", "from": 10, "to": 11, "days": "all", "chance": 0.3 }
  ],
  "jitter_minutes": 45,
  "absence_days_per_10": 2
}
```

- `where` est un **type de lieu** (domicile, travail, taverne, temple, marché, caserne, rue), jamais un lieu précis. La personne a ses lieux à elle (sa taverne, son atelier), tirés une fois avec elle.
- La **gigue** décale ses heures selon sa graine : personne n'est une horloge. Les **jours d'absence** la font manquer à l'appel de temps en temps.
- Les créneaux sont **à l'heure** (décision de l'auteur, 26 novembre).

### 4.2 Une liste de départ

Personnel de lieu (aubergiste, servante), artisan, journalier, marchand établi, garde (tours de garde sur trois jours), prêtre, pilier de bar, joueur, enfant, vieillard, voyageur, marchand ambulant, messager, pèlerin, malfrat (actif la nuit), noble. Une quinzaine suffit à démarrer ; un monde peut en ajouter, comme les pôles de psyché (`specs/psyche-pnj.md` §8).

### 4.3 La psyché teinte la routine

Les pôles du bloc `personality` modulent les probabilités, sans changer l'archétype : un extraverti reste plus longtemps à la taverne, un prudent rentre avant la nuit, un curieux passe au marché. Une aspiration peut ajouter un créneau (celle qui « cherche un mari pour sa fille » va au temple le jour de la fête). L'effet est borné, pour qu'un archétype reste reconnaissable.

### 4.4 L'archétype d'un PNJ écrit à la main

**Déduit, corrigeable** (décision de l'auteur, 26 novembre). Le moteur propose l'archétype depuis le métier du PNJ (« aubergiste » → personnel de lieu, attaché à l'auberge où il est décrit) ; la fiche l'affiche dans le bloc `personality` (champ `routine`) et l'auteur le change à la main. Sans métier lisible : « reste où il est », ce qui garde le comportement d'aujourd'hui.

## 5. Où est une personne : l'ordre de priorité

`position(personne, jour, heure)` :

1. **Mort** : nulle part.
2. **Agenda** : un rendez-vous daté pour ce créneau l'emporte.
3. **État** : en prison (à la prison de la ville), blessé (chez lui ou au temple), en fuite (hors de la ville).
4. **Séjour** : une personne de passage hors de son séjour n'est pas en ville.
5. **Routine** : le créneau de l'archétype, la gigue et les absences, teintés par la psyché.

La présence d'un lieu à une heure, c'est la liste des gens attachés dont la position est ce lieu, plus les clients d'un soir. Dans le lieu, chacun a sa pièce (V3.2-28) : le personnel au comptoir ou en cuisine, les logés dans leur chambre la nuit.

### 5.1 L'agenda

Une exception datée : `{ who, from, to, where, reason }`. Elle vient :
- d'une **proposition de l'IA** dans la narration (« Mabelle dit qu'elle ira au marché demain à l'aube »), validée par le moteur : la personne existe, le lieu existe, le créneau est dans le futur et borné ;
- d'un **événement** (§7 : une arrestation inscrit « en prison » pour une durée tirée) ;
- d'une **saisie à la main** par le MJ.

C'est la seule chose de cette spec qui s'écrit pour une personne non ancrée, avec les états. Une ligne par exception, effacée quand elle est passée.

## 6. Le régime d'une ville

Le bloc `settlement` (PR #17) gagne des agrégats sociopolitiques, chacun de −100 à +100 comme les pôles de psyché (`specs/psyche-pnj.md` §1.5) :

| Agrégat | Question | Haut | Bas |
|---|---|---|---|
| **stabilité** | Le pouvoir tient-il ? | succession assurée, institutions solides | crise, vacance, guerre civile |
| **emprise** | Comment le pouvoir se maintient-il ? | répression : gardes partout, arrestations, couvre-feu | laisser-faire : peu de gardes, justice lente |
| **légitimité** | Le pouvoir est-il accepté ? | adhésion | ressentiment, complots |
| **cohésion** | Les gens s'entendent-ils ? | communautés soudées | tensions entre peuples, guildes, quartiers |
| **prospérité** | Y a-t-il de quoi vivre ? | abondance | disette, chômage |

La richesse et la population existent déjà (PR #17). La liste est fermée mais extensible par monde, comme les pôles.

## 7. Les événements

### 7.1 Le catalogue

Un catalogue fermé, écrit comme des données. Chaque type dit : son échelle (`hour` ou `week`), le lieu où il se produit (type de lieu), qui il touche (archétypes, attaches), son poids selon les agrégats, sa visibilité selon l'emprise, et ses effets.

Exemples : à l'heure, une rixe, un vol à la tire, une arrestation, une dispute de couple, un marchand qui arrive, un ivrogne expulsé, un prêche de rue. À la semaine, une émeute, un incendie, une épidémie, une foire, une exécution publique, un mariage notable, une mort notable, une disette, un complot découvert.

### 7.2 La fréquence

Le taux d'un type d'événement dans une ville est **le produit de sa taille et de ses agrégats** : il monte avec la population, et chaque type a ses propres sensibilités. La rixe monte quand la cohésion baisse ; l'émeute quand la légitimité et la prospérité baissent ; la foire quand la prospérité monte. Un hameau paisible a peut-être un incident par semaine ; un port agité en a plusieurs par jour.

### 7.3 La visibilité

Chaque événement tiré reçoit une visibilité, selon l'**emprise** et le type :

- **visible** : la rue le voit, on en parle ;
- **étouffé** : il a lieu, mais vite réglé (les gardes interviennent, on embarque) ; on le voit à peine, on en parle bas ;
- **caché** : il a lieu dans l'ombre (un enlèvement, un complot, un marché noir) ; il laisse des traces que l'on peut découvrir.

Un régime répressif a **moins d'événements visibles** (la répression les étouffe), **plus d'événements cachés** (ce qui ne peut pas se faire en plein jour se fait la nuit), et ses propres événements visibles (arrestations, patrouilles, exécutions). Un régime de laisser-faire a l'inverse : beaucoup de désordre visible, peu de secrets. La répression fait aussi baisser la légitimité avec le temps.

Un événement caché passe par les **découvertes** existantes (`discovery`) : un indice, une rumeur, une enquête le révèlent. Jamais par un texte masqué au client (règles absolues 5 et 6).

### 7.4 Les effets et les boucles

Un événement touche les agrégats (une émeute fait baisser la stabilité) et les personnes (un état, une entrée d'agenda, un changement d'attitude). Une stabilité basse rend les émeutes plus probables : c'est voulu, c'est ce qui fait qu'une ville glisse. Chaque effet est **borné** et **amorti** (rendements décroissants, comme `specs/psyche-pnj.md` §1.5), et les agrégats reviennent lentement vers leur point d'équilibre : sans cela, une ville s'effondre ou se fige en quelques semaines.

## 8. Les deux niveaux de détail

| | Autour du personnage | Ailleurs |
|---|---|---|
| **Où** | La ville où se trouve le personnage | Les autres villes |
| **Pas** | L'heure | La semaine |
| **Quand on tire** | À chaque tour qui fait passer du temps, pour les heures écoulées | Au rattrapage, à l'arrivée dans la ville, ou quand une nouvelle voyage |
| **Ce qu'on tire** | Les événements `hour` et `week` | Les événements `week` seulement |
| **Ce qu'on garde** | Les événements qui ont touché quelqu'un ou que le personnage a vus | Les événements `week` et leurs effets sur les agrégats |

**Le rattrapage** se borne : au-delà d'un an d'absence, on tire par mois. On garde, pour chaque ville, la date de la dernière semaine tirée.

**Les nouvelles voyagent** : un événement `week` d'une grande portée (une émeute dans la capitale) peut arriver comme rumeur dans une autre ville, avec un délai selon la distance. C'est le seul cas où l'on tire une ville sans y être, et seulement ses événements `week` déjà dus.

## 9. Ce que voient le joueur et l'IA

- **Le volet Monde** montre la présence calculée, dans la pièce du personnage (V3.2-28).
- **À chaque tour**, le moteur compare la présence avant et après le temps écoulé. Les arrivées et les départs partent à l'IA comme **faits établis** (« le sergent sort », « un marchand entre, trempé ») ; elle les raconte, elle ne les invente pas.
- **Les événements visibles** de la pièce ou du lieu partent aussi comme faits ; les événements étouffés, comme indices discrets ; les événements cachés, jamais, tant qu'ils ne sont pas découverts (règle absolue 11 : le contexte est borné par l'audience).
- **Les rumeurs** d'ailleurs arrivent par les PNJ : une personne de passage les porte.

## 10. La psyché : le questionnaire à la Ultima IV

À la création d'un personnage joué, ou d'un PNJ par le MJ, **au choix** de la personne qui le crée, un questionnaire remplit le bloc `personality`. Le modèle est celui d'Ultima IV : une suite de dilemmes, chacun opposant deux valeurs, dont les réponses placent les pôles.

- **Une dizaine de dilemmes**, tirés d'une banque, chacun lié à deux pôles du bloc (« Un ami te demande de mentir pour lui devant le juge… » : autorité ↔ indépendance, altruisme ↔ égoïsme). La réponse déplace ces deux pôles d'un cran.
- **Puis les aspirations** : trois questions ouvertes ou à choix (ce que tu veux de ta vie, ce que tu poursuis en ce moment, ce que tu veux ce soir), qui remplissent les trois horizons (`life`, `arc`, `session`) déjà prévus.
- **Pour un PNJ**, l'archétype de routine se propose à la fin, déduit du métier (§4.4).
- **Rien n'est figé** : le résultat se corrige à la main, comme toute la fiche. Le questionnaire est une aide à la création, pas une vérité.
- **Les PNJ de fond** ne passent pas de questionnaire : leurs pôles et leur aspiration du soir se tirent à graine fixe selon l'archétype et la culture, et se corrigent quand l'un d'eux entre dans le wiki.

Le questionnaire est le même pour le MJ humain et pour le solo. L'IA n'y répond jamais à la place de quelqu'un.

## 11. Ce qui est stocké, et ce qui ne l'est jamais

| Stocké | Où (à préciser dans `docs/SCHEMA.md`) |
|---|---|
| Les agrégats de la ville, régime compris | bloc `settlement` |
| La date de la dernière semaine tirée, par ville | bloc `settlement` |
| L'agenda et les états des personnes, ancrées ou non | une table dédiée, une ligne par exception (migration à écrire) |
| Les événements gardés (§8) | `session_events` pour ce que le personnage a vu ; la chronologie du monde (ADR 0048) pour les événements `week` |
| L'archétype corrigé d'un PNJ du wiki | bloc `personality`, champ `routine` |

**Jamais stocké** : la position d'une personne, la présence d'un lieu, les clients d'un soir, les événements à l'heure qui n'ont touché personne. Tout cela se recalcule.

Coût par tour : un calcul pur sur les gens attachés au lieu (quelques dizaines), une lecture de l'agenda du lieu (une requête). Coût d'un rattrapage : un calcul pur par semaine écoulée, et l'écriture des seuls événements gardés.

## 12. La chronique figée et le monde qui vit

L'ADR 0104 fige la chronique d'avant la partie (l'histoire générée à la Dwarf Fortress). Cette spec ne la touche pas : elle fait vivre **le présent**, à partir du point où la chronique s'arrête. Les agrégats de départ de chaque ville sortent de la génération de l'histoire ; ensuite, seuls les événements de cette spec les font bouger.

## 13. Ce qui existe déjà (inventaire du 26 novembre)

| Brique | Où | Sert à |
|---|---|---|
| Ville en agrégat, `deriveSeed`, `materializeOccupants` (auberge : aubergiste, personnel, clients par moment) | PR #17, `src/core/worldgen/` (pas encore fusionnée) | Graines (§1), personnel (§3) ; les clients « par moment » deviennent des gens attachés à l'heure |
| `SeededRng` | `src/core/dice/rng` | Tous les tirages |
| Tirage `pnj` et esquisses, ancrage à l'interaction, `promoteToEntity` | `sceneSketches.ts`, `promotion.ts` | Nommer un occupant, l'écrire dans le wiki (§3) |
| Axes `wealth` et `zone` lus sur le lieu et ses parents | `src/core/generators/sceneVariant.ts` | Lire la richesse et la taille de la ville |
| Bloc `personality` : six pôles, `priority`, aspirations sur trois horizons | `src/core/schemas/blocks/personality.ts` | Psyché (§4.3, §10) ; il manque le champ `routine` |
| Pôles tirés au hasard bornés à ±60, `priorityFromPoles` | `src/core/psyche/random.ts` | Psyché des PNJ de fond (§10) |
| Archétype visuel (deux pôles dominants) | `src/core/psyche/archetype.ts` | Affichage seulement ; ce n'est **pas** l'archétype de routine |
| Amortissement `applyDelta` (rendements décroissants) | `src/core/psyche/apply.ts` | Effets bornés des événements sur les agrégats (§7.4) |
| Bloc `worldview` et `worldviewTension` (écart PNJ ↔ faction) | `src/core/psyche/tension.ts` | Convictions d'une faction au pouvoir, tensions (§6) |
| Relations `member_of`, `leads`, `serves`, `located_in`, `part_of` | `src/core/relations/inverses.ts` | Qui gouverne, qui habite où ; pas de « travaille à » (à décider : `serves` ou un type nouveau, par migration) |
| Horloge, jours de la semaine, ellipses | `scene.ts`, `calendar/weekday.ts`, `elapsed.ts` | Le jour et l'heure de `position()` ; les jours de routine |
| Pièce par personne | `scenePresence.ts` (V3.2-28) | Où chacun se tient dans le lieu (§5) |
| Découvertes `mentioned` / `known` / `detailed` | `src/core/rules/discovery.ts` | Événements cachés, rumeurs (§7.3, §9) |
| Chronologie du monde, genres `war`, `disaster`, `battle`, `betrayal`… | `src/core/timeline/worldTimeline.ts` (ADR 0048) | Garder les événements `week` (§11) |
| Journal de séance | `session_events` | Garder ce que le personnage a vu (§11) |

Rien n'existe encore pour les archétypes de routine, l'agenda, le régime d'une ville, le catalogue d'événements, le rattrapage ni le questionnaire.

## 14. Découpage

| Ticket | Contenu | Modèle conseillé | Dépend de |
|---|---|---|---|
| VM-1 | Noyau : format d'archétype, liste de départ, `position()`, gigue, absences, tests | Opus | PR #17 (graines) |
| VM-2 | Noyau : gens attachés à un lieu (personnel, habitués, logés, de passage), séjours, tests | Opus | VM-1 |
| VM-3 | La présence calculée remplace la liste manuelle du solo ; arrivées et départs comme faits du tour | Opus | VM-2, G-4 |
| VM-4 | L'agenda : table, proposition de l'IA validée par le moteur, saisie du MJ | Opus (migration) | VM-3 |
| VM-5 | Régime : agrégats du bloc `settlement`, retour à l'équilibre | Opus | G-3 |
| VM-6 | Événements : catalogue, fréquence, visibilité, effets bornés, tirage à l'heure autour du personnage | Opus | VM-4, VM-5 |
| VM-7 | Rattrapage et nouvelles qui voyagent | Opus | VM-6 |
| VM-8 | Questionnaire de psyché à la création, banque de dilemmes, aspirations | Sonnet (interface), Opus (banque) | — |
| VM-9 | Archétype déduit du métier, corrigeable dans la fiche ; pôles qui teintent la routine | Sonnet | VM-1 |

VM-8 ne dépend de rien et peut se faire à tout moment. VM-1 et VM-2 sont du noyau pur, testables en millisecondes.

## 15. Questions ouvertes

| Question | Recommandation |
|---|---|
| Faut-il un catalogue d'événements par culture ou par biome ? | un catalogue commun, avec des poids par culture plus tard (règle des trois) |
| Que devient une personne de passage qu'on a ancrée dans le wiki ? | elle repart quand même à la fin de son séjour ; on peut la retrouver ailleurs, sa ville suivante est tirée |
| Le MJ humain voit-il les événements cachés ? | oui, filtrés par `visibility_level` côté serveur, comme tout secret de MJ |
| Les agrégats du régime sont-ils visibles des joueurs ? | non ; ils perçoivent des signes (gardes, rumeurs, prix), jamais les nombres |
| Un événement peut-il viser le personnage joué (un vol à la tire) ? | oui, mais il passe par les règles (jet du moteur), jamais par la narration seule |
