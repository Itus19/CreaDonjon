# Backlog V4 — Le cadre commun

*Partie du backlog V4. L'index, la feuille de route et la table de tous les tickets : [`docs/BACKLOG_V4.md`](../BACKLOG_V4.md).*

À lire avant tout ticket V4 : d'où l'on part, ce que la V4 change dans les décisions antérieures, les principes que **chaque** ticket doit tenir, et les questions encore ouvertes.

---

## 0. L'intention

> **Un monde qui vit sans le joueur, et qui se souvient de lui.**

La V3 a construit un moteur qui arbitre une scène. La V4 construit un **moteur de simulation** : des entités qui ont des traits, des valeurs, des besoins, des rêves, des émotions et des souvenirs, qui agissent selon eux, se transforment, et laissent une histoire. L'inspiration avouée est Dwarf Fortress (sa psyché et son moteur d'histoire), avec Fable, Baldur's Gate 2, et le système Nemesis de *Shadow of Mordor* pour la mémoire du joueur.

Trois exigences de l'auteur, posées le 22 octobre 2026 :

1. **Émergence.** On donne les règles et le cadre. Chaque monde est différent et a sa propre histoire. Chaque choix a des conséquences propres, de proche en proche (« effet papillon »).
2. **Un monde naît avec une histoire.** En solo, toujours. En mode MJ, sur demande. Une **graine** permet de régénérer le même monde de départ.
3. **Des outils hybrides.** Tout ce que la simulation fait sert aussi au MJ humain : il l'active ou non, il accepte ou rejette ce qu'elle propose, il garde la main sur ce qu'il a écrit.

La V4 commence par **l'échelle intime** (les personnes). L'échelle politique (royaumes, flux de population, économie) viendra après, dans un lot P à concevoir (§6).

---

## 1. Le point de départ supposé

**La V4 suppose faits et fonctionnels tous les tickets des backlogs antérieurs**, y compris ceux encore ouverts le 22 octobre 2026. En particulier :

| Supposé fait | Ce que la V4 en attend |
|---|---|
| V3-E1 · Résumé de scène | les événements de simulation se résument comme les scènes |
| V3-E2 · RAG sur le wiki | la mémoire longue du modèle ; les souvenirs n'en dépendent pas |
| V3-E3 · Le journal de personnage | devient la vue joueur des souvenirs d'un PJ (lot H) |
| V3-F1 · Reprendre une partie | la reprise inclut l'état de simulation |
| V3-F2 · Annuler un tour | défaire un tour défait aussi la simulation qu'il a déclenchée |
| V3.1, tous lots | l'interface « verre minéral », les règles jouables, la Chronologie du monde (ADR 0048) |

Un ticket V4 qui découvre qu'un de ces prérequis n'est pas réellement là **s'arrête et le signale**, plutôt que de le reconstruire en passant.

---

## 2. Ce qui existe et que la V4 reprend

| Brique | Où | Devient |
|---|---|---|
| 6 pôles de tempérament, priorité, aspirations à trois horizons, lignes rouges | bloc `personality`, `src/core/psyche` | **état de départ** des facettes, rêves et lignes (lot B) |
| 7 pôles de convictions, attachables à une faction | bloc `worldview` | **état de départ** des valeurs (lot B) |
| 7 axes de relation dirigée, `known_as` | bloc `relationship`, `entity_attitudes` | relations tirées des souvenirs ; `known_as` généralisé en croyances (lot C) |
| Journal des attitudes en ajout seul, rejouable | `attitude_events`, `personality_events` | conservés ; les souvenirs les alimentent (lot C) |
| Amortissement vers les extrêmes | `src/core/psyche/apply.ts` | principe étendu à toutes les jauges |
| Stockage −100…+100, bandes nommées, jamais le nombre au modèle | `src/core/psyche/bands.ts` | règle générale de la V4 |
| Générateur aléatoire à graine | `src/core/dice/rng.ts` | base de l'aléatoire dérivé (A2) |
| Archétypes, tirage aléatoire de psyché | `src/core/psyche/archetype.ts`, `random.ts` | base du remplissage par le moteur (D5) |
| Genre et pronoms du personnage | bloc `character` (`gender`, `pronouns`) | étendus en identité et orientations (B4) |
| Générateurs et promotion en fiche | `src/core/generators`, `promotion.ts` | génération du monde (lot G) |
| Chronologie du monde, portée `major`/`notable`/`detail` | ADR 0048, `world_timeline` | reçoit la chronique simulée (G5) |
| Déclencheurs en données, bornés | `src/core/rules/triggers.ts` | modèle à suivre pour les vocabulaires d'actions (E4) |
| Tiroir de conséquences, accepter / modifier / rejeter | `ConsequencesDrawer.tsx`, `ai_proposals` | le simulateur du MJ s'en inspire (F3) |
| Découvertes par campagne | `entity_discoveries` | le joueur apprend l'histoire du monde par elles |

---

## 3. Ce que la V4 change dans les décisions antérieures

Ces changements passent **chacun par un ADR** avant toute ligne de code. Ils ne se font jamais en passant.

| Décision antérieure | Où | Ce qui change | ADR |
|---|---|---|---|
| « Les pôles ne bougent que sur événement explicite. Pas de dérive de fond, pas de tâche périodique. » | `specs/psyche-pnj.md` §1 | **Le temps qui passe devient un événement.** Toujours aucune tâche de fond : le monde est rattrapé quand le temps avance en jeu. | 0069 |
| « Bram est Bram partout » : la personnalité appartient à l'entité, tous mondes confondus | `specs/psyche-pnj.md` §6, bloc `personality` | Le bloc garde **l'état de départ** (ce qui a été saisi). **L'état courant vit dans la partie**, comme les attitudes. | 0067 |
| Six pôles, sept convictions, aspirations en texte libre | `src/core/psyche/keys.ts` | Facettes et valeurs à la richesse de Dwarf Fortress, rêves typés, besoins, émotions | 0072 |
| Un axe `attraction_repulsion` | `RELATIONSHIP_AXIS_KEYS` | Deux axes : attirance **romantique** et attirance **sexuelle** | 0073 |
| Une conviction ne change jamais sans revue | `specs/psyche-pnj.md` §5 | **Inchangé pour l'IA.** Le moteur, lui, peut transformer une personne selon des règles ; ce qu'il fait d'un PJ dépend des réglages de table (lot H) | 0074, 0080 |

Ce qui **ne change pas** : les règles absolues de `CLAUDE.md`. L'IA narre et le code arbitre (règle 8). L'IA n'écrit jamais en base (règle 9). Les valeurs dérivées ne sont jamais stockées (règle 16). Une migration appliquée n'est jamais modifiée (règle 14).

---

## 4. Critères transverses — chaque ticket les tient

1. **Le code simule, l'IA raconte.** Aucun appel de modèle dans la simulation, la génération du monde, le questionnaire ou l'évaluation des émotions. Tout le lot se code et se vérifie IA débranchée, sauf les tickets marqués « avec modèle IA » (la narration de ce que la simulation a produit).
2. **Déterminisme.** Même graine, mêmes paramètres, même version du générateur → même résultat, octet pour octet. Chaque fonction de simulation est pure (`src/core/sim`) et reçoit son aléatoire dérivé (A2). Un test le vérifie pour chaque sous-système.
3. **Effet papillon, jamais bruit.** Un tirage de plus quelque part ne décale **aucun** autre tirage. Le hasard se dérive de (graine, date de jeu, entité, motif), jamais d'un flux global consommé dans l'ordre (A2).
4. **Vocabulaires fermés, en données.** Facettes, valeurs, besoins, rêves, émotions, actions, liens nommés : des listes fermées, extensibles **par monde** (A6), jamais du code fourni par l'utilisateur ni par un modèle. Même esprit que les déclencheurs ; pas de Lua (`specs/moteur-de-jeu.md` §3).
5. **Bandes nommées.** Le stockage est fin (−100…+100 ou 0…100). L'écran et le modèle reçoivent la **bande nommée**. Le MJ voit le nombre au survol.
6. **Bornes.** Chaque pas de simulation a des plafonds (entités, événements, profondeur de conséquences) qui rendent toute emballée impossible par construction, comme les quatre bornes des déclencheurs.
7. **Amortissement.** Aucune jauge ne sature avec le temps : s'éloigner du centre coûte de plus en plus (`applyDelta`). Un test sur 200 ans simulés vérifie qu'aucune population n'a toutes ses jauges collées aux extrêmes.
8. **Journal en ajout seul.** Tout ce que la simulation fait s'écrit dans un journal (événements du monde, souvenirs, changements de psyché). L'état courant se reconstruit en rejouant. Corriger, c'est ajouter une compensation.
9. **Visibilité côté serveur.** Ce que les réglages de table cachent au joueur **n'est pas envoyé** au joueur (règle 5). Jamais un champ masqué par CSS.
10. **Quotas.** Tout pas de simulation, toute génération et tout nouveau chargement dit ce qu'il consomme (`docs/QUOTAS.md`) : temps de fonction, lignes écrites, volume en base.
11. **Hybride.** Toute fonctionnalité de simulation a son usage en mode MJ : désactivable, ou en mode « proposer ».
12. **L'identité ne change jamais la personne ; elle change ce que les autres perçoivent, ce qu'ils en pensent, et les risques qu'elle court** (ADR 0086, qui remplace « un filtre, jamais un trait »). Espèce, genre, orientations ne modifient aucune facette, valeur ni besoin, hors les exceptions écrites (`romance`, `intimacy`). Tout effet social passe par les croyances des autres, les normes, et ce que la personne choisit de montrer. On ne discrimine que ce qu'on perçoit ou croit savoir. Un test le vérifie.
13. **Jamais de mineur, toujours le consentement.** Aucun contenu sexuel ne concerne jamais une personne mineure, sous aucune forme, même saisi à la main. Une action intime n'aboutit que si l'autre personne l'accepte ; le seul acte sans consentement (`sexual_assault`) relève des thèmes de table, toujours voilé (ADR 0085, 0087).
14. **Les thèmes de table décident de ce qui existe.** Un thème `absent` n'est ni généré ni saisissable ; un thème voilé ne se raconte que par ses conséquences (`specs/simulation-monde.md` §11.3).

---

## 5. Ce que la V4 emprunte à Dwarf Fortress, et comment

**On s'inspire, on ne copie pas.** Les fichiers de données (« raws ») d'une installation de Dwarf Fortress sont du texte lisible ; le wiki de Dwarf Fortress et les écrits de Tarn et Zach Adams décrivent la conception ; DFHack (open source) documente les structures internes. Ce sont les seules sources à utiliser, **pour décider de nos propres listes**. Aucun nom, texte, table ou code de Dwarf Fortress n'entre dans le dépôt. Aucune décompilation.

Ce qu'on en retient :

| Idée | Où dans la V4 |
|---|---|
| Une psyché en couches : facettes, valeurs, besoins, rêves, émotions, préférences | lot B |
| Les souvenirs courts et longs ; les plus forts se consolident et transforment la personne | lot C, E5 |
| Les relations naissent d'interactions répétées | C3 |
| Pendant la génération, seules les figures historiques sont des individus ; le reste est agrégé | E6, lot G |
| Le monde se génère en simulant son histoire ; le mode Légendes la rend lisible | lot G |
| Les paramètres de départ (âge du monde, nombre de peuples…) | G2 |

Ce qu'on **n'en retient pas** : l'esprit du personnage échappe au joueur dans Dwarf Fortress. Ici, **l'esprit d'un PJ appartient au joueur**, et ce que la simulation peut en faire se règle par table (lot H).

---

## 6. Décisions prises le 22 octobre, et ce qui reste ouvert

**La conception est faite** : `specs/psyche-v4.md`, `specs/simulation-monde.md`, ADR 0067 à 0088, recherche dans `docs/recherche/simulation-inspirations.md`. Tous les tickets des lots A à H sont **prêts** ; les tickets d'interface commencent par une esquisse à faire valider par l'auteur.

| Question | Décision |
|---|---|
| L'état de simulation vit-il par campagne ou par monde ? | Par campagne (un monde n'a qu'une campagne vivante) : `sim_figures` — ADR 0067 |
| Où tourne la génération d'un monde ancien ? | Dans le navigateur, envoi par morceaux validés — ADR 0081 |
| Le questionnaire par défaut est-il suivi par Git ? | Oui : contenu original de l'application, textes dans `messages/` — ADR 0082 |
| Les propositions du moteur réutilisent-elles `ai_proposals` ? | Non : `sim_batches` et `sim_batch_items` — ADR 0079 |
| Comment cacher au joueur ce qui est « MJ seul » ? | Tables brutes réservées à l'admin ; une projection par PJ — ADR 0080 |

**À valider par l'auteur** (choix faits pour avancer, réversibles) : `specs/simulation-monde.md` §17 — délai de la mémoire longue (90 jours), plafond de 150 figures complètes, conséquences du corps quand la couche est « MJ seul », défaire seulement le dernier lot, génération dans le navigateur, pas de faits marquants proposés par l'IA en V4.

**Toujours hors V4** : l'échelle politique (lot P : royaumes en jauges, territoires, flux, caravanes et armées en jetons), et la génération de cartes.

---

## 7. Rappel de méthode

- **Un ticket d'interface commence par son esquisse**, montrée à l'auteur avant le code.
- **Noyau d'abord, tests d'abord** (`src/core/sim`, `src/core/psyche`). La logique difficile de la V4 est presque entièrement pure.
- **Une seule spec par sujet.** `specs/psyche-v4.md` **remplace** `specs/psyche-pnj.md` sur ce qu'il redéfinit ; l'ancienne spec porte un bandeau qui pointe vers la nouvelle.
- **Tester sobrement** (`docs/QUOTAS.md`, T1-T5) : les générations de monde se testent sur le noyau, jamais en boucle contre la vraie base.
