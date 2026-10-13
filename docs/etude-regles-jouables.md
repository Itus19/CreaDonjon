# Étude — des fiches de règles qui se jouent

**Statut :** échantillon fixé et découpé le 13 octobre 2026 · ADR à écrire
**Esquisse visuelle :** planches « Esquisse · Règle jouable » (fiche terminée, éditeur de briques, onglet Actions en jeu) sur le canevas de la refonte https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm, sous le titre « Règles jouables »

## Objet

Savoir si **un petit jeu de briques génériques** (coût, cibles, effets, durée, fin, recharge) suffit à rendre jouables les règles du SRD 2024 et nos règles maison, et lesquelles manquent.

On ne conçoit **pas** un formulaire par règle ni un bloc par type de règle : chaque règle doit s'écrire comme une combinaison de briques. Le moteur ne connaît que les briques.

Rien n'est construit tant que l'étude n'est pas finie. Sa sortie est un ADR.

## Ce qu'on part de

| Existe déjà | Où |
|---|---|
| Effets permanents d'une aptitude | bloc `modifiers` → `characterSheet()` |
| « Quand X arrive, fais Y » | bloc `triggers` → `src/core/rules/triggers.ts` (vocabulaire fermé d'événements et d'effets) |
| Compteurs et recharge aux repos | bloc `resources` du **personnage**, saisi à la main |
| Budget d'action, ciblage | ADR 0029, ADR 0042 |
| Compte des manques du vocabulaire | `src/core/rules/srdTriggers.test.ts` (quatre manques connus) |

Manques déjà identifiés, à confirmer ou infirmer par l'étude :

1. **Activation** : rien ne dit « cette règle se déclenche quand le joueur clique ».
2. **Ressources déclarées par les règles** : un compteur comme Conduit divin n'est déclaré par aucune fiche.
3. **Effets qui durent** : durée, fin sur événement, consommation au prochain jet (`entity_active_effects` jamais écrite).

## L'échantillon

Choisi pour que **chaque règle apporte une mécanique différente**. Une règle complexe qui répète des mécaniques déjà vues n'apprend rien. Toutes figurent dans l'import SRD 2024, vérifié par leurs traductions dans `scripts/data/`.

### A. Le quotidien — mesurer la couverture réelle

| # | Règle | Source | Ce qu'elle teste |
|---|---|---|---|
| 1 | Second souffle | Guerrier 1 | Action bonus, soin en formule (`1d10 + niveau`), recharge partielle (1 au repos court) |
| 2 | Rage | Barbare 1 | Effet qui dure avec plusieurs modificateurs (résistance, bonus de dégâts, avantage), fins multiples |
| 3 | Attaque sournoise | Roublard 1 | Dégâts en plus, conditionnels, une fois par tour, sans bouton propre |
| 4 | Imposition des mains | Paladin 1 | Réserve de points, montant choisi à l'usage, option alternative (guérir l'empoisonnement) |
| 5 | Inspiration bardique | Barde 1 | Donner un dé à un allié, qu'il dépense plus tard ; utilisations = mod. CHA |
| 6 | Sursaut d'action | Guerrier 2 | Accorder une action de plus (budget) |
| 7 | Action rusée | Roublard 2 | Rendre une action disponible en action bonus |
| 8 | Abjuration d'ennemis | Paladin 9 | Ressource partagée, cibles en formule, sauvegarde, état avec fin sur dégâts, restriction de tour |

### B. Les familles difficiles — trouver les briques manquantes

| # | Règle | Source | Ce qu'elle teste |
|---|---|---|---|
| 9 | Bouclier | Sort 1 | Réaction quand on est touché, modifie après coup une attaque déjà lancée |
| 10 | Esquive instinctive | Roublard 5 | Réaction, divise les dégâts d'une attaque |
| 11 | Bénédiction | Sort 1 | Concentration, plusieurs cibles, un **dé** ajouté aux jets (pas une valeur fixe) |
| 12 | Aura de protection | Paladin 6 | Aura : alliés à 3 m, + mod. CHA aux sauvegardes, tant qu'on n'est pas neutralisé |
| 13 | Arme sacrée | Paladin (Dévotion) 3 | Modificateur calculé lié à un objet, fin si on lâche l'arme |
| 14 | Métamagie : sort accéléré | Ensorceleur 2 | Modifie une autre action (temps d'incantation), coût en points de sorcellerie |
| 15 | Forme sauvage | Druide 2 | Transformation : profil remplacé, PV temporaires |
| 16 | Compagnon sauvage | Druide 2 | Dépenser une ressource à la place d'un emplacement ; invocation d'un familier |
| 17 | Source d'inspiration | Barde 5 | Règle qui change la recharge d'une autre ; conversion emplacement → usage |
| 18 | Résistance naine | Nain | Résistance à un type de dégâts, avantage à une sauvegarde contre un état |
| 19 | Mots cinglants | Barde (Savoir) 3 | Réaction au jet **d'un autre**, soustrait un dé |
| 20 | Chance | Halfelin | Relance d'un 1 naturel |
| 21 | Attaque supplémentaire | Guerrier 5 | Modifie l'action Attaquer : plusieurs attaques |
| 22 | Restauration magique | Magicien 1 | Récupérer des emplacements dans un budget à répartir (choix sous contrainte de somme) |
| 23 | Critique amélioré | Guerrier (Champion) 3 | Plage de critique 19-20 |
| 24 | Souffle | Drakéide | Zone (cône ou ligne au choix), dégâts croissant avec le niveau, utilisations = bonus de maîtrise |
| 25 | Défense sans armure | Barbare 1 | CA en formule alternative, conditionnée à l'équipement |

### C. Le haut niveau — vérifier que ça tient quand tout se cumule

| # | Règle | Source | Ce qu'elle teste |
|---|---|---|---|
| 26 | Aura étendue | Paladin 18 | Modifie une autre règle (portée de l'aura) |
| 27 | Indomptable | Guerrier 9 | Relancer une sauvegarde ratée avec un bonus, utilisations croissantes |
| 28 | Coup de chance | Roublard 20 | Transformer un échec en 20 |
| 29 | Rage persistante | Barbare 15 | Recharge sur un événement (jet d'initiative) ; fin d'effet supprimée |
| 30 | Paume vibratoire | Moine (Paume) 17 | Effet différé, déclenché plus tard par le joueur |

### D. Le maison — nos règles doivent passer aussi

Le contenu de ces règles est personnel : leur découpage détaillé vit dans `data/personnel/etude-regles-maison.md`, hors de Git. Ce document n'en garde que les résultats.

| # | Règle | Catégorie | Origine |
|---|---|---|---|
| 31 | « Avantage à un jet de votre choix, 1/repos long » | aptitude | l'auteur |
| 32 | Aasimar | espèce, et ses traits | l'auteur (MdJ 2024) |
| 33 | Collège de la Vaillance | sous-classe | l'auteur (MdJ 2024) |
| 34 | Amulette d'antidétection | objet magique | l'auteur |
| 35 | Veilleur | classe | inventée pour l'étude |
| 36 | Fléau à chaîne | arme | inventée pour l'étude |
| 37 | Cuirasse à écailles réactives | armure | inventée pour l'étude |
| 38 | Fiole de poudre aveuglante | objet | inventée pour l'étude |
| 39 | Tacticien | don | inventé pour l'étude |

## Méthode de découpage

Pour chaque règle, une fiche de découpage :

| Champ | Contenu |
|---|---|
| Déclenchement | clic du joueur, réaction (à quoi), événement (lequel), passif |
| Coût | type d'action, ressource et quantité |
| Cibles | qui, combien (formule), portée, zone |
| Effets | suite de briques, avec branches si réussite ou si échec |
| Durée et fin | temps, concentration, fin sur événement |
| Recharge | repos, événement, aucune |
| Passages non exprimables | texte exact, et la brique qui manque |
| Verdict | jouable · partiellement (ce qui reste à la main) · texte seulement |

Chaque brique est notée **existe** (vocabulaire actuel), **proposée** (une des trois pièces ci-dessus) ou **manquante** (nouvelle).

## Ce que l'étude doit produire

1. Le **pourcentage** de règles jouables, partiellement jouables, en texte seulement, avec les briques existantes, puis avec les trois pièces proposées.
2. La **liste des briques manquantes**, classée par nombre de règles qu'elles débloquent. La règle des trois s'applique : une brique utile à une seule règle reste en texte.
3. Un **ADR** qui fixe le bloc d'activation, les ressources déclarées par les règles et les effets qui durent, puis le découpage en tickets.

---

# Résultats

## Le vocabulaire de briques

**E — existe** (dans le code aujourd'hui)

| Code | Brique | Où |
|---|---|---|
| E1 | Modificateur permanent : `add`, `set`, `min`, `max`, `advantage`, `disadvantage`, `proficiency`, `expertise`, par niveau | bloc `modifiers`, `sheet.ts` |
| E2 | Déclencheur sur un des 20 événements | bloc `triggers`, `triggers.ts` |
| E3 | Effets : sauvegarde (si échec / si réussite), appliquer ou retirer un état, dégâts, soins, dépenser une ressource, déplacement, budget d'action, inspiration, jet, indication au narrateur | `triggers.ts` |
| E4 | Formules : dés, références (`level`, `ability.cha`…), `min`, `max`, arrondis | `src/core/formula` |
| E5 | Conditions : `has_condition`, `has_feature`, `event_has`, `in_range` (trois zones abstraites), comparaisons | `triggers.ts` |
| E6 | Compteur de ressource sur le personnage, recharge aux repos | bloc `resources` (saisi à la main) |
| E7 | Ciblage | ADR 0042 |
| E8 | Blocs de structure : `weapon`, `armor`, `item_properties`, `charges`, `class_progression`, `species_traits`, `scaling`, Choice | `rule-blocks/blocks.ts` |

**P — proposées** (les trois pièces de départ)

| Code | Brique |
|---|---|
| P1 | **Activation** : « cette règle se joue » — déclenchement (clic), coût (action, ressource), cibles, liste d'effets |
| P2 | **Ressource déclarée par une règle** : maximum en formule ou en colonne de progression, recharge (dont « une au repos court »), référencée par sa clé, partageable entre aptitudes |
| P3 | **Effet qui dure** : durée, concentration, fin sur un événement ou au choix, modificateurs actifs pendant ce temps |

**M — manquantes** (trouvées par le découpage). **N** : pas une brique, une cible de modificateur que le moteur ne lit pas encore (`crit_range`, `senses.darkvision`, `speed.fly`, lumière émise, maîtrises d'armes et d'armures).

## Découpage — SRD (règles 1 à 30)

Verdicts : **J** jouable · **P** partiel · **T** texte seulement. Trois colonnes : **aujourd'hui** → **avec P1-P3** → **avec P et les M retenues** (voir plus bas).

| # | Règle | Briques | Reste en texte | Verdicts |
|---|---|---|---|---|
| 1 | Second souffle | P1 action bonus · E3 soin `1d10 + niveau` · P2 usages par niveau, une au repos court | — | P → **J** → J |
| 2 | Rage | P1 action bonus · P2 usages (colonne), une au repos court · P3 avantage aux tests et sauvegardes de FOR (E1) · M3 bonus de dégâts lu dans la progression · M4 résistance contondant, perforant, tranchant · M17 fin si armure lourde | prolongation tour par tour (« si vous avez attaqué ce tour ») | P → P → P |
| 3 | Attaque sournoise | E2 `attack_hit` · E5 avantage, ou allié au contact de la cible · M17 arme de finesse ou à distance · M27 `⌈niveau / 2⌉d6` · M7 une fois par tour, au choix du joueur | — | T → T → **J** |
| 4 | Imposition des mains | P1 action bonus · P2 réserve de 5 × niveau · M12 soigner, ou dépenser 5 pour retirer Empoisonné (E3) · M13 montant choisi | montant choisi (M13, 2 cas) | P → P → P |
| 5 | Inspiration bardique | P1 action bonus, un allié à 18 m · P2 usages = mod. CHA · M16 jeton chez l'allié, 1 heure · M27 dé selon le niveau (d6 → d12) · M1 + M2 l'allié l'ajoute à un test d20 raté | — | P → P → **J** |
| 6 | Sursaut d'action | P1 sans action · P2 1/repos court · E3 `grant_budget` (existe) | « pas l'action Magie » (affiché) | P → **J** → J |
| 7 | Action rusée | M8 Foncer, Se désengager, Se cacher en action bonus | — | T → T → **J** |
| 8 | Abjuration d'ennemis | P1 action Magie · P2 Conduit divin partagé · E7 `max(1, mod. CHA)` cibles, 18 m · E3 sauvegarde SAG → Effrayé · P3 1 minute, fin sur dégâts | une seule chose par tour (M15, rappel) | P → P → P |
| 9 | Bouclier (sort) | emplacement (existe) · M1 réaction quand on est touché · M2 +5 à la CA contre ce jet · P3 jusqu'au début du prochain tour | immunité à Projectile magique | P → P → **J** |
| 10 | Esquive instinctive | M1 réaction quand on est touché · M2 moitié des dégâts de cette attaque | — | T → T → **J** |
| 11 | Bénédiction (sort) | emplacement · E7 jusqu'à 3 cibles · P3 concentration, 1 minute · M3 +1d4 aux attaques et sauvegardes (un dé, pas un nombre) | — | P → P → **J** |
| 12 | Aura de protection | M5 alliés à 3 m · M3 + mod. CHA (min. 1) aux sauvegardes · E5 si vous n'êtes pas Neutralisé | — | T → T → **J** |
| 13 | Arme sacrée | P1 en prenant l'action Attaque (M8) · P2 Conduit divin · P3 10 minutes · M3 + mod. CHA aux attaques · M17 fin si on lâche l'arme · N lumière | — | P → P → **J** |
| 14 | Métamagie : sort accéléré | P2 2 points de sorcellerie · M8 temps d'incantation → action bonus, sur le sort qu'on lance | — | P → P → **J** |
| 15 | Forme sauvage | P1 action bonus · P2 usages, une au repos court · M12 forme connue · P3 durée = niveau ÷ 2 heures | M10 profil de bête remplacé, M23 PV temporaires (1 cas chacun) | P → P → P |
| 16 | Compagnon sauvage | P1 action Magie · P2 coût : 1 usage de Forme sauvage · M20 lancer Appel de familier sans composantes | M11 le familier lui-même (1 cas) | P → P → P |
| 17 | Source d'inspiration | M9 l'Inspiration bardique se recharge au repos court · P1 dépenser un emplacement pour récupérer un usage | — | T → P → **J** |
| 18 | Résistance naine | M4 résistance au poison · E1 avantage aux sauvegardes **contre l'état Empoisonné** (cible contextuelle) | — | T → T → **J** |
| 19 | Mots cinglants | M1 réaction au jet **d'une autre créature** à 18 m · P2 Inspiration bardique · M2 soustraire le dé | — | T → T → **J** |
| 20 | Chance (halfelin) | M2 relancer un 1 naturel sur un test d20, automatiquement | — | T → T → **J** |
| 21 | Attaque supplémentaire | M8 deux attaques par action Attaque | — | T → T → **J** |
| 22 | Restauration magique | P1 à la fin d'un repos court (E2 `short_rest`, au choix) · P2 1/repos long · M13 emplacements à répartir, total ≤ niveau ÷ 2 | M13 (2 cas) | P → P → P |
| 23 | Critique amélioré | E1 + N `crit_range` 19 | — | T → T → **J** |
| 24 | Souffle (drakéide) | P1 remplace une attaque (M8) · P2 usages = maîtrise · M12 cône ou ligne · M18 zone · E3 sauvegarde DEX DD 8 + CON + maîtrise · E4 `scaling` selon le niveau · moitié si réussite | — | P → P → **J** |
| 25 | Défense sans armure | M3 CA = 10 + DEX + CON · M17 sans armure (bouclier permis) | — | T → T → **J** |
| 26 | Aura étendue | M9 la portée de l'Aura de protection passe à 9 m · M5 | — | T → T → **J** |
| 27 | Indomptable | P1 quand vous ratez une sauvegarde (M1) · P2 usages selon le niveau · M2 relancer avec + niveau de guerrier | — | P → P → **J** |
| 28 | Coup de chance (roublard 20) | P1 sur un test d20 raté (M1) · P2 1/repos court · M2 le résultat devient 20 | — | P → P → **J** |
| 29 | Rage persistante | M22 récupérer toutes les Rages au jet d'initiative, 1/repos long · M9 la Rage ne demande plus d'être prolongée | M22 (1 cas) | T → T → P |
| 30 | Paume vibratoire | P2 4 points de focalisation · E2 `attack_hit` à mains nues, au choix · M16 jeton « vibrations », durée en jours · P1 l'activer plus tard : sauvegarde CON, 10d12 force ou moitié | — | P → P → **J** |

## Ce qui ressort

### 1. La couverture (39 règles, SRD et maison)

| | Jouable | Partiel | Texte seulement |
|---|---|---|---|
| Aujourd'hui | 0 (0 %) | 23 (59 %) | 16 (41 %) |
| Avec P1-P3 seules | 2 (5 %) | 24 (62 %) | 13 (33 %) |
| Avec P1-P3 et les M retenues | 30 (77 %) | 8 (21 %) | 1 (3 %) |

« Partiel » aujourd'hui veut presque toujours dire : un compteur saisi à la main et un bouton « utiliser » qui ne fait rien d'autre.

**Les trois pièces proposées sont nécessaires mais loin de suffire.** Seules, elles ne rendent jouables que deux règles sur 39. Elles sont la fondation : presque toutes les autres briques s'appuient sur elles.

### 2. Les briques manquantes, classées

| Code | Brique | Règles | Nombre | Décision |
|---|---|---|---|---|
| M1 | **Réagir** : une activation ouverte par un événement, avec une fenêtre où le joueur choisit (sur son jet ou celui d'un autre) | 5, 9, 10, 19, 27, 28, 33, 35, 37, 39 | 10 | retenue |
| M2 | **Agir sur un jet en cours** : ajouter ou soustraire un dé, relancer, fixer à 20, changer la CA contre ce jet, diviser les dégâts | 5, 9, 10, 19, 20, 27, 28, 33, 37, 39 | 10 | retenue |
| M8 | **Modifier une action** : attaques multiples, action disponible en action bonus, temps d'incantation, remplacer une attaque, budget réservé à un usage | 7, 13, 14, 21, 24, 33, 35, 39 | 8 | retenue |
| M3 | **Valeur de modificateur en formule ou en dé** (+ mod. CHA, +1d4, 10 + DEX + CON). Déjà le manque n° 1 de `srdTriggers.test.ts` | 2, 11, 12, 13, 25, 32 | 6 | retenue |
| M12 | **Variantes au choix** à l'activation | 4, 15, 22, 24, 32, 33 | 6 | retenue, **dans P1** |
| M4 | **Résistance, immunité, réduction de dégâts**. Manque n° 3 | 2, 10, 18, 32 | 4 | retenue |
| M9 | **Une règle qui en modifie une autre** (recharge, portée, durée, options) | 17, 26, 29, 33 | 4 | retenue |
| M16 | **Jeton** : un effet qui dure et qui donne à son porteur une activation à usage unique | 5, 30, 31, 33 | 4 | retenue, **dans P3** |
| M17 | **Conditions sur l'équipement** (sans armure, tient l'arme, arme de finesse) | 2, 3, 13, 25 | 4 | retenue |
| M27 | **Nombre et taille des dés en formule** (`⌈niveau / 2⌉d6`, `(maîtrise)d4`) : l'AST n'accepte qu'un nombre fixe | 3, 5, 24, 32 | 4 | retenue |
| M5 | **Aura** : effet sur les alliés dans un rayon, tant qu'une condition tient | 12, 26, 35 | 3 | retenue |
| M7 | **Une fois par tour ou par round** | 3, 32, 39 | 3 | retenue |
| M18 | **Zones géométriques** (cône, ligne, rayon en mètres) face aux trois zones abstraites | 24, 32, 38 | 3 | à trancher dans l'ADR |
| M20 | **Accorder ou lancer un sort** comme effet | 16, 32, 33 | 3 | retenue |
| M13 | Quantité choisie dans une réserve | 4, 22 | 2 | texte (sort au prochain cas) |
| M15 | Restriction d'état ou immunité spéciale | 8, 34 | 2 | texte |
| M30 | Consommer l'objet | 38 | 1 | à réexaminer : le SRD a beaucoup de consommables et les munitions |
| M10, M11, M22, M23, M28, M29 | Transformation, invocation, recharge sur événement, PV temporaires, rediriger une attaque, ressource qui monte | un cas chacun | 1 | texte |

Petit manque hors brique : l'événement `attack_hit` ne porte aucune étiquette d'arme ni de propriété (`gameEvents.ts` n'en pose que sur les tests). Sans ça, une propriété d'arme maison (n° 36) ne peut pas se déclencher. C'est l'extension directe de l'ADR 0028.

### 3. Regroupées, les briques tiennent en cinq chantiers

| Chantier | Contenu | Règles débloquées | Nature |
|---|---|---|---|
| **Fondation** | P1 (avec M12), P2, P3 (avec M16) | toutes | données et noyau ; P3 écrit enfin `entity_active_effects` |
| **Valeurs calculées** | M3, M27, cibles N | 10 | surtout l'AST et `characterSheet()` : le moins cher |
| **Intervenir sur un jet** | M1, M2, M7 | 13 | le plus gros : une fenêtre de réaction dans le déroulé d'un jet, côté serveur |
| **Actions modifiées** | M8, M20 | 10 | le budget d'action et les sorts |
| **Conditions de jeu** | M4, M5, M17, M18, M9 | 13 | dégâts subis, auras, équipement, zones, règles qui en modifient d'autres |

Ce qui existe déjà et marche sans rien ajouter : le soin du Second souffle, le budget du Sursaut d'action, la Radiance intérieure de l'Aasimar (fin de tour, zone `engaged`), la moitié de la Magie de guerre (`spell_cast` → `grant_budget`).

### 4. Ordre recommandé

1. **Fondation**, P3 en tête : tout le reste s'y appuie.
2. **Valeurs calculées** : peu de code, dix règles.
3. **Intervenir sur un jet** : le plus gros gain, mais il touche au déroulé des jets côté serveur. Il demande sa propre conception.
4. **Actions modifiées**, puis **conditions de jeu**.

La conversion assistée par l'IA (texte → briques, validées par Zod et relues) vient après la fondation : avant, elle n'a pas assez de briques pour écrire quoi que ce soit.

## Étape suivante

Un **ADR** qui fixe la fondation (P1, P2, P3, avec les variantes et les jetons), tranche la question des zones (M18) et le découpage en tickets des cinq chantiers. Il relève de la session Opus : il engage le schéma et le noyau.
