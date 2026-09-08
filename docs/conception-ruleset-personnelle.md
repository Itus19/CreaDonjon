# Conception du ruleset personnel

**Version :** 0.1 — 8 septembre 2026
**Statut :** document de travail, à remplir à deux. Rien ici n'est un ticket.

---

## 0. Ce que ce document est, et ce qu'il n'est pas

**Ce n'est pas un backlog.** Aucun ticket, aucun critère d'acceptation, aucune taille. Le travail de développement lié au ruleset vit dans `docs/BACKLOG_V3.md` lot Q, et il ne parle que de rendre le moteur capable — jamais du contenu.

**Ce n'est pas le contenu non plus.** Les valeurs, tables et fiches finales vont dans `data/personnel/` (ignoré par Git) puis en base, comme tout contenu de règles (`CLAUDE.md`, « Saisir des règles »). Ce document ne contient que **les questions ouvertes et les décisions**, ce qui le rend versionnable sans contredire cette règle.

**C'est un plan de travail de conception.** Le système décrit dans le document d'origine est cohérent sur ses deux tiers et troué sur le reste. Ce fichier liste les trous, les contradictions entre les deux versions du document, et pour chacun une proposition — pour qu'on les remplisse dans l'ordre plutôt qu'au fil des envies.

**Une note de statut** : ce système est une création de l'auteur, pas une saisie depuis un ouvrage possédé. Il relève donc de `user_created`, pas de `personal_reference` — il lui appartient, il est partageable, et il n'est pas concerné par les verrous de `specs/ruleset-personnel.md`. Si des entrées SRD lui servent de base, l'attribution CC-BY s'applique à celles-là seulement.

---

## 1. Ce qui tient déjà

À ne pas rouvrir sans raison : c'est la matière solide sur laquelle le reste s'appuie.

| Domaine | État |
|---|---|
| Résolution : dés physiques, jet avant narration, quand demander un jet | complet et cohérent |
| Combat : initiative, action principale et bonus, résolution d'attaque, critiques | complet |
| Encombrement : FOR × 2,5 kg, paliers 100 % / 120 % | complet |
| Monnaie : 1 po = 100 pa = 10 000 pb | complet |
| Magie composable : intention × vecteur × élément, coût calculé, génération de noms | complet et original — le meilleur morceau du système |
| Progression : XP exponentiel base 15, paliers 4/7/10, niveaux Aventurier et Métier | complet |
| Apprentissage : 24 h + 24 h par PM, réductions cumulables | complet |
| Origines sociales : 10 origines, bonus, richesse initiale | complet |
| Les 12 archétypes : bonus, équipement, compétences suggérées | complet |
| Relations PNJ : 4 jauges, initialisation, plafond à 50 % | complet |

---

## 2. Les contradictions — à trancher en premier

Le document existe en deux versions (onglet 1, plus ancien ; onglet 3, plus mûr) qui divergent sur cinq points. Tant qu'elles ne sont pas tranchées, toute saisie risque d'être à refaire.

### 2.1 La formule de PV et de mana produit des valeurs décroissantes

**C'est le point le plus grave, et le document ne le signale pas.**

L'onglet 3 pose `PV Max = base raciale + (Mod CON × Niv Aventurier / 10)`. Or le tableau de synthèse donne à toutes les races des caractéristiques de base entre 7 et 10 — donc des **modificateurs négatifs ou nuls** (−2 à 0). Le document en tire lui-même l'exemple :

> Humain Magicien niv 10 : Mana Max = 5 + (−1 × 10/10) = **4 Mana**

Un personnage perd donc des PV et du mana en montant de niveau. Ce n'est certainement pas l'intention.

**Proposition** : soit les caractéristiques raciales de base montent au-dessus de 10 (et les modificateurs redeviennent positifs), soit la formule utilise la caractéristique *courante* du personnage — qui monte avec les compétences — plutôt que la base raciale figée. La seconde est plus cohérente avec l'esprit du système : c'est la pratique qui fait progresser.

### 2.2 Deux échelles de qualité d'objet

| Onglet 1 | Commun · Rare · Ancien · Maudit-Sacré · Légendaire · Unique |
|---|---|
| Onglet 3 | Commun · **Supérieur** · Rare · Légendaire · Unique · Maudit-Sacré |

« Ancien » disparaît, « Supérieur » apparaît, et **la table de risque d'identification ne correspond exactement à aucune des deux**. À unifier avant toute saisie d'objet.

### 2.3 La visée ciblée : bonus ou malus ?

Onglet 1 : « Tête (+5 au jet) ». Onglet 3 : « Tête (−5 au jet) », avec la précision explicite qu'il s'agit d'une pénalité. L'onglet 3 a raison mécaniquement — viser la tête doit être plus dur. **Proposition : retenir l'onglet 3**, la contradiction est probablement déjà résolue dans ton esprit.

### 2.4 Six races ou huit ?

L'onglet 1 en décrit six (Humains, Elfes, Nains, Orcs, Drakéides, Goliaths) avec leurs **pourcentages d'habitabilité par biome**. L'onglet 3 en décrit huit (+ Halflings, Gnomes) avec leurs traits raciaux détaillés — mais **sans habitabilité**.

Les deux moitiés sont complémentaires, aucune n'est complète. **Proposition : huit races, et compléter l'habitabilité des deux nouvelles.** C'est de la saisie, pas une décision.

### 2.5 Les cantrips coûtent-ils du mana ?

Le prompt d'origine distinguait cantrips anecdotiques (0 PM) et cantrips actifs (1-2 PM). JDRSim tranche : **tous les cantrips sont à 0 PM**, avec une progression auto-scalante 1d2 → 1d4 → 1d6. La seconde est plus simple et se tient. **Proposition : retenir JDRSim.**

---

## 3. Les trous explicites

Les quatorze « à définir » du document, groupés par ce qu'ils coûtent.

### 3.1 Petits — une séance à deux suffit

| Trou | Ce qui manque | Proposition |
|---|---|---|
| **Traits raciaux** | quatre exemples donnés, la liste complète manque | en écrire quinze à vingt, et poser la règle d'émergence (un trait peut naître des conditions de vie sur plusieurs générations) |
| **Niveau des objets (iLvl)** | section vide | à quoi sert le niveau si la qualité existe déjà ? Peut-être : la qualité donne les bonus, le niveau donne le prérequis d'utilisation |
| **Distance et coût en mana** | « les vecteurs ont une distance de base, l'augmenter coûte » — sans barème | un palier de PM par tranche de portée, réductible à la montée de niveau |
| **Niveau du sort** | **phrase coupée en plein mot** : « Chaque sort peut monter de niveau ju » | à reprendre entièrement — probablement redondant avec les paliers 4/7/10 |
| **Traits possibles (PNJ)** | titre sans contenu | peut réutiliser les traits raciaux plus des traits de personnalité |
| **Religion** | « bonus de croyance ? juste cosmétique ? » | le plus simple : relationnel et narratif, sans bonus mécanique. On ajoute des effets si le besoin se présente |

### 3.2 Moyens — une vraie décision de conception

| Trou | Ce qui manque | Proposition |
|---|---|---|
| **Métissage** | trois versions incompatibles dans le document lui-même (héritage 30/70, race du parent dominant, races hybrides émergentes) | la plus simple : l'enfant prend la race d'un parent, hérite de traits physiques mineurs de l'autre. Pas de race hybride |
| **Métiers** | « métiers émergents ? une jauge par métier ? » | la catégorie Métier existe déjà dans la progression — un métier *est* une compétence de cette catégorie. Rien à inventer |
| **Guildes d'aventuriers** | existence, adhésion, création de sa propre guilde | reprendre le bloc 4 du prompt d'origine, qui est complet sur ce point |
| **Rangs d'aventurier** | échelle SS→F esquissée, sans conditions de passage | le prompt d'origine donne les paliers (3 quêtes E, 5 quêtes D + validation…). À reprendre tel quel |
| **Cultures** | « émergent de l'histoire du groupe » — sans mécanisme | hors ruleset : c'est du worldgen. À sortir de ce document |
| **Politique** | carrière politique, édicter des lois | hors périmètre décidé (`BACKLOG_V3.md`) — à noter comme volontairement absent |

### 3.3 Gros — à ne pas ouvrir tout de suite

| Trou | Pourquoi c'est gros |
|---|---|
| **Flore** | « liste de plantes, propriétés, alchimie » — c'est un système entier, avec ses effets et son artisanat |
| **Faune** | titre vide. Autant de fiches que de créatures, plus les règles de comportement |
| **Biomes** | deux listes incompatibles (14 biomes détaillés côté onglet 1, une proto-liste émergente côté onglet 3) — **et c'est du worldgen, pas du ruleset** |
| **Génération procédurale en couches** | worldgen. Ne relève pas de ce document |

---

## 4. Ce qui n'est pas exprimable avant le lot Q

À saisir seulement après, sous peine de tout refaire :

| Élément du ruleset | Attend |
|---|---|
| Monnaie centésimale, encombrement FOR × 2,5 | V3-Q2 **phase A** |
| Perception passive `10 + mod + niveau/2`, formules de modificateur | V3-Q2 **phase B** |
| Les ~30 compétences et leur caractéristique | V3-Q2 **phase C** |
| Des caractéristiques différentes des six | V3-Q2 **phase D** |
| Un générateur qui tire dans les races du ruleset | V3-Q3 (`rule_query`) |
| Les tables du ruleset (noms, rumeurs propres au système) | V3-Q4 |

**Ce qui est saisissable dès maintenant**, sans attendre : les 8 races, les 12 archétypes, les 10 origines sociales, les traits raciaux, les objets et leurs qualités, la magie composable. Ce sont des entrées de règles ordinaires.

---

## 5. Ordre de remplissage proposé

1. **Les cinq contradictions du §2.** Rien ne se saisit proprement avant, et la première (PV/mana décroissants) touche l'équilibre de tout le système.
2. **Les six petits trous du §3.1.** Une séance, et le système devient complet sur son périmètre actuel.
3. **Les quatre trous moyens qui restent du §3.2** — métissage, métiers, guildes, rangs. Les deux autres sortent du document.
4. **La saisie de ce qui ne dépend pas du lot Q** : races, archétypes, origines, traits, magie.
5. **Le reste, après le lot Q**, phase par phase.
6. **Flore, faune et biomes** — jamais avant que le reste tourne, et les biomes relèvent du worldgen.

---

## 6. Comment on travaille dessus

**Un trou à la fois**, comme un ticket. On en discute, on tranche, la décision s'écrit ici, et le contenu part dans `data/personnel/`.

**Je propose, tu tranches.** Sur chaque trou j'ai une proposition ci-dessus ; elles valent ce que vaut une lecture, pas une partie jouée. C'est toi qui sais si un système est amusant.

**Ce qui est décidé se raye ici plutôt que de disparaître** — pour qu'on ne retranche pas dans six mois une question déjà réglée, dans l'autre sens.
