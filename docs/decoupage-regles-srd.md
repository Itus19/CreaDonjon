# Relevé de découpage des règles du SRD

**Version :** 0.2 — 9 septembre 2026
**Ticket :** V3-N7 (`docs/BACKLOG_V3.md`)
**Statut :** document de travail. Il sert à décider, puis il devient obsolète.

---

## 0. Ce que c'est

Le relevé structurel des **33 sections de règles** du SRD, produit par `splitRuleSection`
(`src/core/ruleset/splitRuleSection.ts`) sur les données réelles. Il n'a pas été écrit à la main :
il est généré par la fonction testée, donc il ne peut pas diverger de ce que le découpage fera
réellement.

**Il vaut aussi pour le 5.2.1**, qui est la cible. Le fichier `data/srd/srd-2024.json` ne contient
ni `Rule-Sections` ni `Rules` — l'import construit le ruleset 2024 comme « base 2014 plus
surcharges » (`mergeWithBaseFile`, `scripts/ingest-srd.ts`). Les sections de règles du 5.2.1 sont
donc exactement celles relevées ici.

| | |
|---|---|
| Sections | 33, pour ~190 000 caractères |
| Restent entières | **9** |
| Se découpent | **24**, pour **93 fiches** au niveau 3 |
| Demandaient une décision | **17** (catégorie C) — **tranchée**, voir §3 — plus **1** cas à trancher (catégorie D) |
| Total après la décision | **93** fiches au niveau 3, **106** au niveau 4, **4** au niveau 5 |

## 1. Comment le lire

Quatre catégories, de la plus sûre à la moins sûre :

| | Ce que ça veut dire | À faire |
|---|---|---|
| **A** | aucun titre de niveau 3 — c'est déjà une règle unique | rien |
| **B** | des titres de niveau 3, aucun sous-titre | découper, rien à décider |
| **C** | des titres de niveau 3 qui portent des sous-titres | **une décision par chapitre** |
| **D** | plusieurs titres de niveau 2 dans la même section | à regarder au cas par cas |

**La question de la catégorie C a été tranchée le 9 septembre** — voir §3. Les sous-titres sont
des règles filles, rattachées à leur règle mère par `part_of`. Les tableaux de la catégorie C se
lisent donc comme un état de la première passe, pas comme une question ouverte.

## 2. Ce que ce relevé ne décide pas

**Les noms français.** Chaque fiche fille en aura besoin. Ils ne s'inventent pas : le texte
officiel français est dans `data/srd/fr-source/srd-5.2.1-fr.txt`. C'est la suite immédiate du
découpage, et c'est aussi pourquoi le moment est le bon — la prose française des règles n'est pas
encore écrite, donc rien n'est à refaire.

**La longueur des clés.** Une fiche de seconde passe hérite de toute la chaîne :
`between-adventures-downtime-activities-crafting`. La forme courte (`downtime-activities-crafting`)
se lit mieux mais ne garantit plus rien : « Attack Rolls and Damage » existe sous Force *et* sous
Dextérité, « Spellcasting Ability » sous Intelligence, Sagesse et Charisme, « Difficult Terrain »
sous deux chapitres différents. La chaîne complète est unique par construction — c'est déjà ce que
fait `splitRuleSection`, et une clé n'est jamais lue par un humain : c'est le **nom** qui s'affiche
et qui se cherche. **Proposition retenue par défaut : la chaîne complète**, à confirmer en phase A.

**Rien en base.** Ce document est une lecture des fichiers source. Aucune écriture, aucune
migration — c'est le travail des phases A à C, qui demandent une session avec Supabase.

## 3. La décision de la catégorie C — prise le 9 septembre

> « Il y a donc une règle mère avec des règles filles. Il faudrait donc des fiches à part mais en
> `part_of` de ma règle mère. »

**Un sous-titre est une règle fille, pas un détail.** Il devient une fiche à part entière,
rattachée à sa mère par `ruleset_entry_refs`, `ref_kind: 'part_of'`, `origin: 'declared'` — le même
mécanisme qu'entre une règle et son chapitre. Le découpage est donc **récursif** : chapitre → règle
→ règle fille, et la parenté est la même à chaque étage.

C'est cohérent avec ce que la phase A construit déjà : `part_of` ne connaît pas la profondeur, et
la barre latérale niche une sous-classe sous sa classe sans savoir combien d'étages existent.

**Ce que ça donne, recompté sur les données réelles** (les chiffres de la catégorie C ci-dessous ne
montraient que les sous-titres au nombre de trois ou plus ; ceux-ci comptent tout) :

| Étage | Fiches |
|---|---:|
| Chapitres (niveau 2) | 33 |
| Règles (niveau 3) | 93 |
| Règles filles (niveau 4) | 106 |
| Petites-filles (niveau 5) | 4 |

**Six motifs où la récursion produit une fiche qui n'est pas une règle.** Ce sont des conteneurs ou des
tableaux, pas des choses vers lesquelles on veut pointer. La règle de granularité de V3-N7 — *une
entrée par chose vers laquelle on veut pouvoir pointer, surcharger ou renvoyer* — les écarte, mais
elle demande un œil, chapitre par chapitre, au moment de la phase C :

| Fiche produite | Ce que c'est réellement |
|---|---|
| `fantasy-historical-pantheons-*-{celtic,greek,egyptian,norse}-deities` | un tableau de divinités, un par panthéon — le panthéon est la règle, la table est son contenu |
| `movement-speed-travel-pace` (niveau 5) | le tableau « Travel Pace » sous la règle du même nom, qui se dédoublerait |
| `traps-traps-in-play-trap-effects-*` (niveau 5) | deux tableaux de valeurs (DD de sauvegarde, sévérité des dégâts) |
| `using-each-ability-strength-lifting-and-carrying-variant-encumbrance` (niveau 5) | une variante optionnelle — c'est bien une règle, mais elle ne s'applique que si la table l'adopte ; à traiter comme les autres « Variant » du SRD, pas comme une règle de base |
| `ability-checks-skills-{strength,dexterity,…}` | le regroupement des compétences par caractéristique, pas six règles |
| `objects-statistics-for-objects-object-{armor-class,hit-points}` | à regarder : deux valeurs d'une même règle, ou deux règles |

Aucun de ces cas ne remet en cause la décision : ils disent seulement que le découpage récursif
propose, et qu'un humain valide chapitre par chapitre. C'est exactement ce que la phase C prévoit.

---

## En un coup d'œil

| Section | Taille | Structure | Verdict | Fiches produites |
|---|---:|---|---|---:|
| `traps` | 17487 | ##×1 ###×2 ####×12 #####×2 | coupe, sous-titres à examiner | 2 |
| `using-each-ability` | 15993 | ##×1 ###×6 ####×16 #####×1 | coupe, sous-titres à examiner | 6 |
| `casting-a-spell` | 13319 | ##×1 ###×10 ####×15 | coupe, sous-titres à examiner | 10 |
| `fantasy-historical-pantheons` | 12543 | ##×1 ###×4 ####×4 | coupe, sous-titres à examiner | 4 |
| `damage-and-healing` | 10746 | ##×1 ###×7 ####×7 | coupe, sous-titres à examiner | 7 |
| `the-planes-of-existence` | 9506 | ##×3 ###×4 ####×2 | **à trancher** | — |
| `madness` | 9215 | ##×1 ###×3 ####×3 | coupe, sous-titres à examiner | 3 |
| `making-an-attack` | 8719 | ##×1 ###×4 ####×9 | coupe, sous-titres à examiner | 4 |
| `ability-checks` | 8454 | ##×1 ###×5 ####×7 | coupe, sous-titres à examiner | 5 |
| `sentient-magic-items` | 7100 | ##×1 ###×2 ####×5 | coupe, sous-titres à examiner | 2 |
| `movement-and-position` | 6676 | ##×1 ###×7 ####×5 | coupe, sous-titres à examiner | 7 |
| `poisons` | 6458 | ##×1 ###×2 | coupe nette | 2 |
| `the-environment` | 6380 | ##×1 ###×5 ####×5 | coupe, sous-titres à examiner | 5 |
| `movement` | 6209 | ##×1 ###×2 ####×4 #####×1 | coupe, sous-titres à examiner | 2 |
| `the-order-of-combat` | 6102 | ##×1 ###×5 ####×2 | coupe, sous-titres à examiner | 5 |
| `between-adventures` | 5901 | ##×1 ###×2 ####×5 | coupe, sous-titres à examiner | 2 |
| `what-is-a-spell` | 5351 | ##×1 ###×5 ####×2 | coupe, sous-titres à examiner | 5 |
| `diseases` | 5181 | ##×1 ###×1 ####×3 | coupe, sous-titres à examiner | 1 |
| `actions-in-combat` | 5000 | ##×1 ###×10 | coupe nette | 10 |
| `objects` | 3996 | ##×1 ###×1 ####×2 | coupe, sous-titres à examiner | 1 |
| `activating-an-item` | 2315 | ##×1 ###×4 | coupe nette | 4 |
| `attunement` | 2233 | ##×1 | reste entière | — |
| `mounted-combat` | 2209 | ##×1 ###×2 | coupe nette | 2 |
| `resting` | 2005 | ##×1 ###×2 | coupe nette | 2 |
| `wearing-and-wielding-items` | 1830 | ##×1 ###×2 | coupe nette | 2 |
| `advantage-and-disadvantage` | 1686 | ##×1 | reste entière | — |
| `proficiency-bonus` | 1547 | ##×1 | reste entière | — |
| `cover` | 1356 | ##×1 | reste entière | — |
| `saving-throws` | 1332 | ##×1 | reste entière | — |
| `time` | 1028 | ##×1 | reste entière | — |
| `underwater-combat` | 863 | ##×1 | reste entière | — |
| `ability-scores-and-modifiers` | 723 | ##×1 | reste entière | — |
| `standard-exchange-rates` | 432 | ##×1 | reste entière | — |

## A. Restent entières — aucun découpage

Aucun titre de niveau 3 : ce sont déjà des règles uniques. Les toucher n'apporterait rien.

### `cover` — Cover

1356 caractères, aucun titre de niveau 3.

### `underwater-combat` — Underwater Combat

863 caractères, aucun titre de niveau 3.

### `ability-scores-and-modifiers` — Ability Scores and Modifiers

723 caractères, aucun titre de niveau 3.

### `advantage-and-disadvantage` — Advantage and Disadvantage

1686 caractères, aucun titre de niveau 3.

### `proficiency-bonus` — Proficiency Bonus

1547 caractères, aucun titre de niveau 3.

### `saving-throws` — Saving Throws

1332 caractères, aucun titre de niveau 3.

### `time` — Time

1028 caractères, aucun titre de niveau 3.

### `standard-exchange-rates` — Standard Exchange Rates

432 caractères, aucun titre de niveau 3.

### `attunement` — Attunement

2233 caractères, aucun titre de niveau 3.


## B. Coupe nette au niveau 3

Aucun sous-titre sous les titres de niveau 3 : chacun est une règle, une seule passe suffit. Rien à décider.

### `actions-in-combat` — Actions in Combat

Coupe au niveau 3 → 10 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Attack | `actions-in-combat-attack` | 418 | — |
| Cast a Spell | `actions-in-combat-cast-a-spell` | 477 | — |
| Dash | `actions-in-combat-dash` | 446 | — |
| Disengage | `actions-in-combat-disengage` | 126 | — |
| Dodge | `actions-in-combat-dodge` | 359 | — |
| Help | `actions-in-combat-help` | 595 | — |
| Hide | `actions-in-combat-hide` | 259 | — |
| Ready | `actions-in-combat-ready` | 1308 | — |
| Search | `actions-in-combat-search` | 231 | — |
| Use an Object | `actions-in-combat-use-an-object` | 313 | — |

### `mounted-combat` — Mounted Combat

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Mounting and Dismounting | `mounted-combat-mounting-and-dismounting` | 819 | — |
| Controlling a Mount | `mounted-combat-controlling-a-mount` | 1006 | — |

### `resting` — Resting

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Short Rest | `resting-short-rest` | 674 | — |
| Long Rest | `resting-long-rest` | 930 | — |

### `poisons` — Poisons

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Poisons | `poisons-poisons` | 830 | — |
| Sample Poisons | `poisons-sample-poisons` | 4251 | — |

### `wearing-and-wielding-items` — Wearing and Wielding Items

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Multiple Items of the Same Kind | `wearing-and-wielding-items-multiple-items-of-the-same-kind` | 429 | — |
| Paired Items | `wearing-and-wielding-items-paired-items` | 302 | — |

### `activating-an-item` — Activating an Item

Coupe au niveau 3 → 4 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Command Word | `activating-an-item-command-word` | 230 | — |
| Consumables | `activating-an-item-consumables` | 236 | — |
| Spells | `activating-an-item-spells` | 1032 | — |
| Charges | `activating-an-item-charges` | 339 | — |


## C. Coupe au niveau 3, sous-titres à examiner

Le découpage au niveau 3 est sûr. Reste une question par chapitre : les sous-titres qu'il contient sont-ils des **détails** de leur règle (ils restent dedans) ou des **règles à part entière** (une seconde passe les sort) ? Le relevé montre les deux, il ne tranche pas.

### `the-order-of-combat` — The Order of Combat

Coupe au niveau 3 → 5 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Combat Step by Step | `the-order-of-combat-combat-step-by-step` | 758 | — |
| Surprise | `the-order-of-combat-surprise` | 881 | — |
| Initiative | `the-order-of-combat-initiative` | 916 | — |
| Your Turn | `the-order-of-combat-your-turn` | 2456 | 2 |
| Reactions | `the-order-of-combat-reactions` | 528 | — |

### `movement-and-position` — Movement and Position

Coupe au niveau 3 → 7 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Breaking Up Your Move | `movement-and-position-breaking-up-your-move` | 1187 | 2 |
| Difficult Terrain | `movement-and-position-difficult-terrain` | 562 | — |
| Being Prone | `movement-and-position-being-prone` | 751 | — |
| Moving Around Other Creatures | `movement-and-position-moving-around-other-creatures` | 511 | — |
| Flying Movement | `movement-and-position-flying-movement` | 359 | — |
| Creature Size | `movement-and-position-creature-size` | 1921 | 3 |
| Interacting with Objects Around You | `movement-and-position-interacting-with-objects-around-you` | 781 | — |

« Creature Size » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`movement-and-position-creature-size-size-categories` · `movement-and-position-creature-size-space` · `movement-and-position-creature-size-squeezing-into-a-smaller-space`

### `making-an-attack` — Making an Attack

Coupe au niveau 3 → 4 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Attack Rolls | `making-an-attack-attack-rolls` | 1613 | 2 |
| Unseen Attackers and Targets | `making-an-attack-unseen-attackers-and-targets` | 748 | — |
| Ranged Attacks | `making-an-attack-ranged-attacks` | 1068 | 2 |
| Melee Attacks | `making-an-attack-melee-attacks` | 4383 | 5 |

« Melee Attacks » porte 5 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`making-an-attack-melee-attacks-opportunity-attacks` · `making-an-attack-melee-attacks-two-weapon-fighting` · `making-an-attack-melee-attacks-contests-in-combat` · `making-an-attack-melee-attacks-grappling` · `making-an-attack-melee-attacks-shoving-a-creature`

### `damage-and-healing` — Damage and Healing

Coupe au niveau 3 → 7 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Hit Points | `damage-and-healing-hit-points` | 622 | — |
| Damage Rolls | `damage-and-healing-damage-rolls` | 3212 | 2 |
| Damage Resistance and Vulnerability | `damage-and-healing-damage-resistance-and-vulnerability` | 1051 | — |
| Healing | `damage-and-healing-healing` | 799 | — |
| Dropping to 0 Hit Points | `damage-and-healing-dropping-to-0-hit-points` | 3046 | 5 |
| Knocking a Creature Out | `damage-and-healing-knocking-a-creature-out` | 341 | — |
| Temporary Hit Points | `damage-and-healing-temporary-hit-points` | 1391 | — |

« Dropping to 0 Hit Points » porte 5 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`damage-and-healing-dropping-to-0-hit-points-instant-death` · `damage-and-healing-dropping-to-0-hit-points-falling-unconscious` · `damage-and-healing-dropping-to-0-hit-points-death-saving-throws` · `damage-and-healing-dropping-to-0-hit-points-stabilizing-a-creature` · `damage-and-healing-dropping-to-0-hit-points-monsters-and-death`

### `ability-checks` — Ability Checks

Coupe au niveau 3 → 5 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Typical Difficulty Classes | `ability-checks-typical-difficulty-classes` | 696 | — |
| Contests | `ability-checks-contests` | 1339 | — |
| Skills | `ability-checks-skills` | 3257 | 6 |
| Passive Checks | `ability-checks-passive-checks` | 906 | — |
| Working Together | `ability-checks-working-together` | 1646 | 1 |

« Skills » porte 6 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`ability-checks-skills-strength` · `ability-checks-skills-dexterity` · `ability-checks-skills-intelligence` · `ability-checks-skills-wisdom` · `ability-checks-skills-charisma` · `ability-checks-skills-variant-skills-with-different-abilities`

### `using-each-ability` — Using Each Ability

Coupe au niveau 3 → 6 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Strength | `using-each-ability-strength` | 3249 | 3 |
| Dexterity | `using-each-ability-dexterity` | 4093 | 5 |
| Constitution | `using-each-ability-constitution` | 1444 | 2 |
| Intelligence | `using-each-ability-intelligence` | 2095 | 2 |
| Wisdom | `using-each-ability-wisdom` | 2366 | 2 |
| Charisma | `using-each-ability-charisma` | 2514 | 2 |

« Strength » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`using-each-ability-strength-strength-checks` · `using-each-ability-strength-attack-rolls-and-damage` · `using-each-ability-strength-lifting-and-carrying`

« Dexterity » porte 5 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`using-each-ability-dexterity-dexterity-checks` · `using-each-ability-dexterity-attack-rolls-and-damage` · `using-each-ability-dexterity-armor-class` · `using-each-ability-dexterity-initiative` · `using-each-ability-dexterity-hiding`

### `movement` — Movement

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Speed | `movement-speed` | 3123 | 2 |
| Special Types of Movement | `movement-special-types-of-movement` | 2094 | 2 |

### `the-environment` — The Environment

Coupe au niveau 3 → 5 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Falling | `the-environment-falling` | 280 | — |
| Suffocating | `the-environment-suffocating` | 603 | — |
| Vision and Light | `the-environment-vision-and-light` | 2633 | 3 |
| Food and Water | `the-environment-food-and-water` | 1190 | 2 |
| Interacting with Objects | `the-environment-interacting-with-objects` | 1402 | — |

« Vision and Light » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`the-environment-vision-and-light-blindsight` · `the-environment-vision-and-light-darkvision` · `the-environment-vision-and-light-truesight`

### `between-adventures` — Between Adventures

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Lifestyle Expenses | `between-adventures-lifestyle-expenses` | 437 | — |
| Downtime Activities | `between-adventures-downtime-activities` | 4742 | 5 |

« Downtime Activities » porte 5 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`between-adventures-downtime-activities-crafting` · `between-adventures-downtime-activities-practicing-a-profession` · `between-adventures-downtime-activities-recuperating` · `between-adventures-downtime-activities-researching` · `between-adventures-downtime-activities-training`

### `what-is-a-spell` — What Is a Spell?

Coupe au niveau 3 → 5 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Spell Level | `what-is-a-spell-spell-level` | 552 | — |
| Known and Prepared Spells | `what-is-a-spell-known-and-prepared-spells` | 640 | — |
| Spell Slots | `what-is-a-spell-spell-slots` | 2189 | 2 |
| Cantrips | `what-is-a-spell-cantrips` | 299 | — |
| Rituals | `what-is-a-spell-rituals` | 674 | — |

### `casting-a-spell` — Casting a Spell

Coupe au niveau 3 → 10 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Casting Time | `casting-a-spell-casting-time` | 1200 | 3 |
| Spell Range | `casting-a-spell-spell-range` | 761 | — |
| Components | `casting-a-spell-components` | 1645 | 3 |
| Duration | `casting-a-spell-duration` | 1843 | 2 |
| Targets | `casting-a-spell-targets` | 1114 | 2 |
| Areas of Effect | `casting-a-spell-areas-of-effect` | 2504 | 5 |
| Spell Saving Throws | `casting-a-spell-spell-saving-throws` | 368 | — |
| Spell Attack Rolls | `casting-a-spell-spell-attack-rolls` | 466 | — |
| Combining Magical Effects | `casting-a-spell-combining-magical-effects` | 473 | — |
| The Schools of Magic | `casting-a-spell-the-schools-of-magic` | 2580 | — |

« Casting Time » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`casting-a-spell-casting-time-bonus-action` · `casting-a-spell-casting-time-reactions` · `casting-a-spell-casting-time-longer-casting-times`

« Components » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`casting-a-spell-components-verbal-v` · `casting-a-spell-components-somatic-s` · `casting-a-spell-components-material-m`

« Areas of Effect » porte 5 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`casting-a-spell-areas-of-effect-cone` · `casting-a-spell-areas-of-effect-cube` · `casting-a-spell-areas-of-effect-cylinder` · `casting-a-spell-areas-of-effect-line` · `casting-a-spell-areas-of-effect-sphere`

### `objects` — Objects

Coupe au niveau 3 → 1 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Statistics for Objects | `objects-statistics-for-objects` | 3370 | 2 |

### `sentient-magic-items` — Sentient Magic Items

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Creating Sentient Magic Items | `sentient-magic-items-creating-sentient-magic-items` | 4740 | 5 |
| Conflict | `sentient-magic-items-conflict` | 1413 | — |

« Creating Sentient Magic Items » porte 5 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`sentient-magic-items-creating-sentient-magic-items-abilities` · `sentient-magic-items-creating-sentient-magic-items-communication` · `sentient-magic-items-creating-sentient-magic-items-senses` · `sentient-magic-items-creating-sentient-magic-items-alignment` · `sentient-magic-items-creating-sentient-magic-items-special-purpose`

### `fantasy-historical-pantheons` — Fantasy-Historical Pantheons

Coupe au niveau 3 → 4 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| The Celtic Pantheon | `fantasy-historical-pantheons-the-celtic-pantheon` | 2708 | 1 |
| The Greek Pantheon | `fantasy-historical-pantheons-the-greek-pantheon` | 3023 | 1 |
| The Egyptian Pantheon | `fantasy-historical-pantheons-the-egyptian-pantheon` | 2786 | 1 |
| The Norse Pantheon | `fantasy-historical-pantheons-the-norse-pantheon` | 3676 | 1 |

### `traps` — Traps

Coupe au niveau 3 → 2 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Traps in Play | `traps-traps-in-play` | 6131 | 4 |
| Sample Traps | `traps-sample-traps` | 10455 | 8 |

« Traps in Play » porte 4 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`traps-traps-in-play-triggering-a-trap` · `traps-traps-in-play-detecting-and-disabling-a-trap` · `traps-traps-in-play-trap-effects` · `traps-traps-in-play-complex-traps`

« Sample Traps » porte 8 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`traps-sample-traps-collapsing-roof` · `traps-sample-traps-falling-net` · `traps-sample-traps-fire-breathing-statue` · `traps-sample-traps-pits` · `traps-sample-traps-poison-darts` · `traps-sample-traps-poison-needle` · `traps-sample-traps-rolling-sphere` · `traps-sample-traps-sphere-of-annihilation`

### `diseases` — Diseases

Coupe au niveau 3 → 1 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Sample Diseases | `diseases-sample-diseases` | 4018 | 3 |

« Sample Diseases » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`diseases-sample-diseases-cackle-fever` · `diseases-sample-diseases-sewer-plague` · `diseases-sample-diseases-sight-rot`

### `madness` — Madness

Coupe au niveau 3 → 3 fiches.

| Titre | Clé | Taille | Sous-titres |
|---|---|---:|---:|
| Going Mad | `madness-going-mad` | 558 | — |
| Madness Effects | `madness-madness-effects` | 7876 | 3 |
| Curing Madness | `madness-curing-madness` | 381 | — |

« Madness Effects » porte 3 sous-titres. Si ce sont des règles et non des détails, une seconde passe donnerait :
`madness-madness-effects-short-term-madness` · `madness-madness-effects-long-term-madness` · `madness-madness-effects-indefinite-madness`


## D. À trancher

Plusieurs titres de niveau 2 dans une même section : la structure ne dit pas d'elle-même où est le chapitre.

### `the-planes-of-existence` — The Planes of Existence

9506 caractères, aucun titre de niveau 3.

