# Spécification — La psyché V4

**Version :** 1.0 — 22 octobre 2026
**Ticket :** V4-B1 · **ADR :** 0072 (couches), 0073 (identité), 0067 (graine et état)
**Remplace :** `specs/psyche-pnj.md` §1, §2 et §6 sur tout ce qui suit. Les §3 à §5 (relation, journal, prudence de l'IA) restent valables, amendés au §8.
**Sources :** `docs/recherche/simulation-inspirations.md`

Ce document fixe **les listes, les échelles et la forme des blocs**. Le moteur qui les fait vivre est dans `specs/simulation-monde.md`.

---

## 0. Les couches, en un tableau

| Couche | Échelle | Stockée où | Bouge comment |
|---|---|---|---|
| **Facettes** (50) | −100…+100 | graine : bloc `personality` ; état : `sim_figures` | rarement : souvenir fondateur (simulation §7) |
| **Valeurs** (35) | −100…+100 | graine : bloc `worldview` ; état : `sim_figures` | rarement : souvenir fondateur, persuasion |
| **Éthiques** (15) | une réponse sur 7 | bloc `worldview` (personne ou culture) | presque jamais |
| **Besoins** (3 du corps + 25 de l'esprit) | corps : heures écoulées ; esprit : 0…100 | `sim_figures` seulement | sans cesse |
| **Rêves** (19 types) | statut, intensité 1…3 | graine : `personality` ; état : `sim_figures` | atteints, abandonnés, nés d'un événement |
| **Émotions** (22 familles) | intensité 0…100 | dans les souvenirs, `sim_figures` | à chaque événement |
| **Humeur** | −100…+100 | **jamais stockée** (règle 16) | calculée depuis émotions et besoins |
| **Stress** | 0…100 | `sim_figures` | accumulé jour par jour |
| **Préférences** | aime / déteste | bloc `personality` | jamais par la simulation |
| **Identité et orientations** | listes du monde | bloc `character` | jamais par la simulation |

**Sans simulation active** (`simulation: off`, `specs/simulation-monde.md` §11), seules les graines existent : la fiche affiche facettes, valeurs, éthiques, rêves, préférences et identité ; besoins, émotions, humeur et stress n'apparaissent pas.

---

## 1. Échelles et bandes

### 1.1 Bipolaire (facettes, valeurs, axes de relation)

Stockage −100…+100, inchangé depuis la V2 (`src/core/psyche/bands.ts`). Sept bandes, mêmes seuils :

| Valeur | Bande | Facette (exemple `friendliness`) | Valeur (exemple `loyalty`) |
|---|---|---|---|
| ≤ −67 | extrême − | extrêmement querelleur | abhorre la loyauté |
| −66…−34 | forte − | très querelleur | rejette la loyauté |
| −33…−12 | légère − | plutôt querelleur | se méfie de la loyauté |
| −11…+11 | neutre | *(rien n'est affiché)* | *(rien n'est affiché)* |
| +12…+33 | légère + | plutôt chaleureux | apprécie la loyauté |
| +34…+66 | forte + | très chaleureux | chérit la loyauté |
| ≥ +67 | extrême + | extrêmement chaleureux | sacralise la loyauté |

- **Facettes** : la bande se dit avec le libellé du pôle (« très chaleureux »).
- **Valeurs** : un verbe par bande (abhorre, rejette, se méfie de, —, apprécie, chérit, sacralise) suivi du nom de la valeur. Sept verbes au lieu de 35 × 7 phrases.
- **Accord** : les libellés de facette s'accordent selon les pronoms (§9.2). `messages/` porte trois formes : masculin, féminin, neutre. Le neutre prend une forme épicène quand elle existe (« sincère »), sinon le point médian (« chaleureux·se »).
- **Le neutre n'est jamais affiché ni transmis** : comme dans Dwarf Fortress, ne rien dire d'une facette neutre est ce qui rend les autres lisibles.

### 1.2 Distribution des tirages

À la création par le moteur (questionnaire complété au hasard, génération) : valeur = tendance culturelle + écart tiré dans une loi en cloche, écart-type 22 pour les facettes et 18 pour les valeurs, bornée à ±80 au départ. Résultat attendu : environ 40 % des facettes et 55 % des valeurs dans la bande neutre. Dwarf Fortress met 78 % des valeurs au neutre ; on en garde moins, parce qu'une fiche de jeu de rôle doit dire quelque chose.

La loi en cloche se fait **sans dépendance** : somme de trois tirages uniformes (approximation suffisante, testée).

### 1.3 Unipolaire (besoins, émotions, stress, familiarité)

0…100. Bandes propres à chaque couche (§4, §6, simulation §6).

---

## 2. Les facettes — 50, en six familles

Clés anglaises (`snake_case`), libellés français des deux pôles (forme masculine ici ; les trois formes vivent dans `messages/`). Valeur positive = premier pôle.

### Émotivité (`emotion`) — 11

| Clé | + | − |
|---|---|---|
| `love_propensity` | s'attache vite | lent à s'attacher |
| `hate_propensity` | prompt à haïr | lent à haïr |
| `envy_propensity` | envieux | sans envie |
| `cheerfulness` | enjoué | morose |
| `gloom_propensity` | enclin à la mélancolie | résilient |
| `anger_propensity` | colérique | placide |
| `anxiety_propensity` | anxieux | serein |
| `lust_propensity` | sensuel | peu porté sur le désir |
| `stress_vulnerability` | fragile sous la pression | imperturbable |
| `emotional_attachment` | s'attache passionnément | détaché |
| `emotionality` | guidé par ses émotions | maître de ses émotions |

### Sociabilité (`social`) — 9

| Clé | + | − |
|---|---|---|
| `gregariousness` | grégaire | solitaire |
| `assertiveness` | s'impose | s'efface |
| `friendliness` | chaleureux | querelleur |
| `politeness` | courtois | grossier |
| `trust` | confiant | méfiant |
| `bashfulness` | timide | effronté |
| `privacy` | secret | expansif |
| `humor` | facétieux | sérieux |
| `harmony` | conciliant | chercheur de querelles |

### Morale et honnêteté (`morality`) — 9

| Clé | + | − |
|---|---|---|
| `altruism` | altruiste | égoïste |
| `compassion` | compatissant | cruel |
| `sincerity` | sincère | manipulateur |
| `vengefulness` | rancunier | prompt à pardonner |
| `gratitude` | reconnaissant | ingrat |
| `tolerance` | tolérant | intolérant |
| `greed` | avide | désintéressé |
| `modesty` | sobre | ostentatoire |
| `pride` | fier | humble |

`sincerity` n'existe pas dans Dwarf Fortress ; elle vient de HEXACO. Les mensonges et les rumeurs déformées (simulation §9) en ont besoin.

### Rigueur (`discipline`) — 9

| Clé | + | − |
|---|---|---|
| `dutifulness` | dévoué au devoir | désinvolte |
| `orderliness` | ordonné | désordonné |
| `perfectionism` | perfectionniste | approximatif |
| `perseverance` | persévérant | inconstant |
| `thrift` | économe | dépensier |
| `deliberation` | réfléchi | irréfléchi |
| `focus` | concentré | dispersé |
| `activity` | énergique | nonchalant |
| `self_indulgence` | immodéré | tempérant |

### Ouverture (`openness`) — 7

| Clé | + | − |
|---|---|---|
| `curiosity` | curieux | incurieux |
| `imagination` | rêveur | terre-à-terre |
| `abstraction` | porté à l'abstraction | concret |
| `art_inclination` | artiste | indifférent à l'art |
| `excitement_seeking` | aventureux | casanier |
| `open_mindedness` | ouvert d'esprit | buté |
| `advice_seeking` | écoute les conseils | n'en fait qu'à sa tête |

### Courage et élan (`drive`) — 5

| Clé | + | − |
|---|---|---|
| `bravery` | brave | craintif |
| `confidence` | sûr de soi | doute de soi |
| `ambition` | ambitieux | sans ambition |
| `hopefulness` | optimiste | pessimiste |
| `violence` | bagarreur | pacifique |

### Facettes de compatibilité

Huit facettes comptent quand deux personnes se fréquentent (simulation §8.3) : `friendliness`, `politeness`, `humor`, `harmony`, `orderliness`, `tolerance`, `cheerfulness`, `activity`. Un écart de plus de 60 points sur l'une d'elles rend la fréquentation irritante. C'est le mécanisme de Dwarf Fortress qui fait naître des rancunes sans raison dramatique.

### Facettes du stress

`bravery` (vitesse d'accumulation), `stress_vulnerability` (seuil de crise), `anxiety_propensity` (vitesse de récupération), `gloom_propensity` (difficulté à remonter). Voir simulation §6.

---

## 3. Les valeurs et les éthiques

### 3.1 Les 35 valeurs

| Clé | Nom | Clé | Nom |
|---|---|---|---|
| `law` | la loi | `independence` | l'indépendance |
| `loyalty` | la loyauté | `stoicism` | le stoïcisme |
| `family` | la famille | `introspection` | l'introspection |
| `friendship` | l'amitié | `self_control` | la maîtrise de soi |
| `power` | le pouvoir | `tranquility` | la tranquillité |
| `truth` | la vérité | `concord` | la concorde |
| `cunning` | la ruse | `merriment` | la fête |
| `eloquence` | l'éloquence | `craftsmanship` | le bel ouvrage |
| `fairness` | l'équité | `martial_prowess` | la prouesse martiale |
| `mercy` | la miséricorde | `hard_work` | le travail |
| `decorum` | les convenances | `sacrifice` | le sacrifice |
| `tradition` | la tradition | `competition` | la compétition |
| `honor` | l'honneur | `leisure` | le loisir |
| `piety` | la piété | `commerce` | le commerce |
| `artwork` | l'art | `wealth` | la richesse |
| `cooperation` | la coopération | `romance` | l'amour |
| | | `nature` | la nature |
| | | `peace` | la paix |
| | | `knowledge` | le savoir |

Les valeurs sont **communes aux personnes et aux factions** : une culture, une guilde, un ordre religieux ont des valeurs, pas de tempérament. Une personne s'écarte des valeurs de sa culture ; l'écart se voit sur la fiche (« chérit l'indépendance, contre la tradition de son peuple »).

`mercy`, `honor`, `piety` et `wealth` n'existent pas dans Dwarf Fortress ; ils reprennent les pôles `mercy_justice`, `wealth_honor` et `sacred_profane` de la V2.

### 3.2 Les éthiques — des lignes rouges typées

Une éthique dit **comment une personne ou une culture juge un acte**. C'est la forme mécanique des `lines` et `limits` de la V2, qui restent en texte libre à côté.

**Actes (15)** : `kill_innocent` (tuer un innocent), `kill_in_fight` (tuer au combat), `kill_animal` (tuer un animal), `torture`, `treason` (trahir les siens), `oath_breaking` (rompre un serment), `lying` (mentir), `theft` (voler), `assault` (frapper), `vandalism` (détruire le bien d'autrui), `trespassing` (entrer sans droit), `slavery` (asservir), `desecration` (profaner), `cannibalism` (manger un être pensant), `infidelity` (rompre une exclusivité **convenue** entre partenaires ; une relation non exclusive acceptée n'est jamais une infidélité, §9.4).

**Réponses (7)**, de la plus permissive à la plus stricte :

| Clé | Libellé | Effet pour l'auteur | Effet sur un témoin qui tient cette réponse |
|---|---|---|---|
| `required` | requis | ne pas le faire quand l'occasion se présente coûte du stress | approuve |
| `acceptable` | acceptable | rien | rien |
| `personal_matter` | affaire personnelle | rien | rien, sauf s'il est la victime |
| `justified_if_reason` | justifié avec une bonne raison | léger malaise sans raison | désapprouve sans raison |
| `only_extreme` | seulement en cas extrême | culpabilité forte hors légitime défense | colère, perte de respect |
| `shameful` | honteux | culpabilité forte | dégoût, réputation, l'évite |
| `unthinkable` | impensable | **l'action n'est jamais choisie** | horreur, rupture du lien |

`unthinkable` est une **ligne rouge** ; `only_extreme` est une **limite** (« fera, mais à contrecœur »). Une éthique absente sur une personne prend la réponse de sa culture, puis `justified_if_reason` à défaut.

---

## 4. Les besoins

### 4.1 Les besoins du corps (3)

| Clé | Libellé | Mesure | Bandes (en heures depuis la dernière satisfaction) |
|---|---|---|---|
| `hunger` | manger | heures depuis le dernier repas | rassasié < 8 · a faim < 24 · affamé < 72 · mourant de faim ≥ 72 |
| `thirst` | boire | heures depuis la dernière boisson | désaltéré < 6 · a soif < 24 · assoiffé ≥ 24 |
| `fatigue` | dormir | heures depuis le dernier repos long | reposé < 16 · fatigué < 24 · épuisé ≥ 24 |

Les seuils sont des **données du monde**, réglables. Leurs **conséquences de règles** (l'épuisement) ne sont pas ici : elles passent par les déclencheurs du ruleset (ADR 0083, ticket H3). Les besoins du corps ne comptent que pour les PJ et les figures en scène ou proches (simulation §4).

### 4.2 Les besoins de l'esprit (25)

Chaque besoin a un **poids** de 0 à 3, calculé depuis les facettes et valeurs sources (somme des sources, puis bande : < 12 → 0, < 34 → 1, < 67 → 2, sinon 3). Un poids 0 veut dire que la personne n'a pas ce besoin. Le MJ peut forcer un poids (`need_overrides`, §7.1).

| Clé | Libellé | Sources |
|---|---|---|
| `socialize` | compagnie | `gregariousness` |
| `family` | famille | valeur `family` |
| `friends` | amis | valeur `friendship` |
| `romance` | vie amoureuse | valeur `romance`, `love_propensity` ; **0 pour une personne aromantique** (§9.4) |
| `faith` | foi | valeur `piety` |
| `occupation` | s'occuper | valeur `hard_work`, `activity` |
| `creativity` | créer | `art_inclination` |
| `excitement` | frissons | `excitement_seeking` |
| `learning` | apprendre | valeur `knowledge`, `curiosity` |
| `eloquence` | beaux discours | valeur `eloquence` |
| `tradition` | traditions | valeur `tradition` |
| `introspection` | introspection | valeur `introspection` |
| `merriment` | faire la fête | valeur `merriment`, `humor` |
| `craft` | bel ouvrage | valeur `craftsmanship` |
| `martial` | s'entraîner | valeur `martial_prowess` |
| `leisure` | prendre son temps | valeur `leisure` |
| `nature` | nature et bêtes | valeur `nature` |
| `acquisition` | acquérir | `greed`, valeur `commerce` |
| `indulgence` | plaisirs de bouche | `self_indulgence` |
| `conflict` | en découdre | `violence`, `harmony` inversée |
| `extravagance` | paraître | `modesty` inversée |
| `wander` | errer | `excitement_seeking`, `curiosity` (moitié chacune) |
| `helping` | aider | `altruism` |
| `abstract_thought` | réfléchir | `abstraction` |
| `admire_art` | admirer l'art | valeur `artwork` |

**Niveau** : satisfaction 0…100. Satisfaire un besoin le remet à 100 ; il redescend ensuite à 0 en **60 jours** (poids 1), **20 jours** (poids 2) ou **7 jours** (poids 3). Bandes : comblé ≥ 80 · satisfait ≥ 50 · ça manque ≥ 25 · en manque ≥ 10 · criant < 10.

Les durées sont plus courtes que dans Dwarf Fortress, qui parle en années : une campagne de jeu de rôle couvre des semaines ou des mois de jeu.

---

## 5. Les rêves

Un rêve est un **but typé** avec des paramètres, un horizon, une intensité et un statut. Le texte libre des aspirations V2 devient son habillage.

| Type | Paramètre | Atteint quand | Impossible quand |
|---|---|---|---|
| `found_family` | — | a un partenaire et un enfant | — |
| `fall_in_love` | — | gagne un lien `lover` ou `partner` | personne aromantique (jamais tiré) |
| `rule` | lieu ou faction | occupe la position de chef | le lieu est détruit |
| `rank` | faction | gagne une position dans la faction | exclu de la faction |
| `masterwork` | domaine (art, ouvrage) | événement `masterwork_created` dont il est l'auteur | — |
| `master_skill` | domaine | événement `skill_mastered` | — |
| `legendary_warrior` | — | réputation `hero` ou `warrior` forte | — |
| `explore` | nombre de lieux | a visité ce nombre de lieux notables | — |
| `discovery` | domaine | événement `discovery_made` | — |
| `peace` | deux factions | événement `peace_made` entre elles | — |
| `acquire` | objet (entité) ou « richesse » | possède l'objet | l'objet est détruit |
| `avenge` | figure | la cible est morte, vaincue ou humiliée par lui | la cible meurt d'autre chose |
| `protect` | figure ou lieu | — (permanent) | le protégé meurt |
| `serve` | figure ou faction | — (permanent) | trahi par elle |
| `redeem` | événement (sa faute) | acte de sacrifice ou d'aide envers les victimes | toutes les victimes sont mortes |
| `find` | figure | la rencontre | la cible est morte |
| `sow_chaos` | — | — (permanent) | — |
| `immortality` | — | — (permanent) | — |
| `custom` | texte | décidé par le MJ ou le joueur | idem |

**Champs** : `id`, `type`, `params`, `horizon` (`life` | `arc`), `intensity` (1…3), `status` (`active` | `achieved` | `abandoned` | `impossible`), `text`, `visibility`, `origin` (`seed` | `simulation` | `gm` | `player`), `born_at` (date de jeu), `cause_event_id`.

- Un rêve `custom` n'est **pas simulé** : il entre dans le contexte du modèle et sur la fiche, rien de plus.
- Un rêve atteint, impossible ou abandonné en fait naître un autre (simulation §7.3).
- **L'horizon `session` de la V2 disparaît.** Ce qu'une personne veut ce soir vient désormais de ses **besoins** les plus pressants. Les anciennes aspirations `session` deviennent des `moment_wants` (texte libre, contexte du modèle seulement), §7.1.

---

## 6. Les émotions

22 familles. Chacune a une **valence** (qui pèse sur l'humeur) et trois libellés selon l'intensité (légère < 34, moyenne < 67, forte ≥ 67).

| Clé | Valence | Légère | Moyenne | Forte |
|---|---|---|---|---|
| `joy` | +1 | contentement | joie | exaltation |
| `pride` | +1 | satisfaction | fierté | triomphe |
| `gratitude` | +1 | reconnaissance | gratitude | dévotion |
| `affection` | +1 | sympathie | affection | adoration |
| `hope` | +1 | attente | espoir | ferveur |
| `relief` | +1 | apaisement | soulagement | délivrance |
| `wonder` | +1 | curiosité | émerveillement | ravissement |
| `desire` | +0,5 | attrait | désir | passion |
| `compassion` | −0,25 | pitié | compassion | déchirement |
| `sadness` | −1 | mélancolie | tristesse | accablement |
| `grief` | −1 | peine | chagrin | deuil |
| `anger` | −1 | agacement | colère | fureur |
| `fear` | −1 | inquiétude | peur | terreur |
| `disgust` | −1 | gêne | dégoût | horreur |
| `shame` | −1 | embarras | honte | humiliation |
| `guilt` | −1 | malaise | culpabilité | remords |
| `jealousy` | −1 | envie | jalousie | jalousie dévorante |
| `despair` | −1 | découragement | désespoir | anéantissement |
| `loneliness` | −1 | ennui des autres | solitude | isolement |
| `boredom` | −0,5 | lassitude | ennui | torpeur |
| `contempt` | −0,5 | dédain | mépris | haine |
| `vengefulness` | −0,5 | rancune | soif de vengeance | haine vengeresse |

Dwarf Fortress en nomme environ 170 ; vingt-deux familles à trois intensités en donnent 66, assez pour que la narration varie, assez peu pour que les règles d'évaluation (simulation §6) restent écrivables. `desire` n'apparaît que si la simulation romantique est active (§9.5).

---

## 7. La forme des blocs de graine

### 7.1 `personality`, version 2

```ts
{
  __v: 2,
  facets: Partial<Record<FacetKey, number>>,   // absente = 0 (neutre)
  facet_notes: Partial<Record<FacetKey, string>>,
  priority: FacetKey[],                        // 0 à 3, départage les conflits
  dreams: Dream[],                             // §5
  moment_wants: string[],                      // texte libre, contexte du modèle
  lines: string[],                             // texte libre, inchangé
  limits: string[],                            // texte libre, inchangé
  preferences: Preference[],                   // §7.3
  need_overrides: Partial<Record<MindNeedKey, 0 | 1 | 2 | 3>>,
  baseline: { trust, affinity, respect, fear },// inchangé
  speech: { register, tics },                  // inchangé
}
```

Une carte plutôt qu'un tableau de 50 objets : une fiche saisie à la main n'a souvent que dix facettes marquées. Le reste est neutre, et l'absence le dit.

### 7.2 `worldview`, version 2

```ts
{
  __v: 2,
  values: Partial<Record<ValueKey, number>>,
  priority: ValueKey[],                        // 0 à 3
  ethics: Partial<Record<EthicKey, EthicResponse>>,
}
```

Attachable à une personne ou à une faction, comme aujourd'hui. Une faction qui est un **peuple** porte en plus un bloc `culture` (simulation §13.2).

### 7.3 Préférences

`{ category, label, like: boolean }`, `category` ∈ `food`, `drink`, `material`, `creature`, `color`, `place`, `art_form`, `weather`. Descriptives : elles colorent le récit et pèsent faiblement dans l'évaluation (un cadeau aimé donne de la joie). Le libellé est libre ; aucune liste n'est imposée.

### 7.4 Lecture des versions 1

Mise à niveau **à la lecture**, jamais par une réécriture forcée en base (même principe que les autres blocs versionnés). La conversion est une fonction pure (`src/core/psyche/upgradeV1.ts`) :

| V2 (`personality`) | V4 |
|---|---|
| `curiosity_caution` v | `curiosity` v ; `excitement_seeking` v/2 |
| `altruism_selfishness` v | `altruism` v ; `greed` −v/2 |
| `empathy_hardness` v | `compassion` v |
| `impulse_prudence` v | `deliberation` −v ; `emotionality` v/2 |
| `extraversion_reserve` v | `gregariousness` v ; `assertiveness` v/2 |
| `authority_independence` v | `dutifulness` v ; `advice_seeking` v/2 |
| `priority` (pôles) | la première facette de chaque ligne ci-dessus |
| `aspirations` `life` / `arc` | rêve `custom`, même horizon, même texte, même visibilité |
| `aspirations` `session` | `moment_wants` |

| V2 (`worldview`) | V4 |
|---|---|
| `order_freedom` v | `law` v ; `independence` −v/2 |
| `mercy_justice` v | `mercy` v ; `fairness` −v/2 |
| `sacred_profane` v | `piety` v |
| `tradition_progress` v | `tradition` v |
| `individual_collective` v | `independence` v ; `cooperation` −v/2 |
| `wealth_honor` v | `wealth` v ; `honor` −v |
| `peace_force` v | `peace` v ; `martial_prowess` −v/2 |

Les contributions à une même clé s'additionnent, puis sont bornées à ±100. Divisions arrondies vers zéro.

**Le journal reste rejouable.** `personality_events.deltas` porte des clés V2 pour les événements anciens : le rejeu convertit chaque delta par la même table. Les conversions sont linéaires, donc rejouer puis convertir revient à convertir puis rejouer (testé).

---

## 8. Les relations — ce qui change

Le bloc `relationship` et `entity_attitudes` restent (`specs/psyche-pnj.md` §3-4). Trois changements :

1. **Deux attirances.** La clé `attraction_repulsion` existante **devient l'attirance romantique** (libellé changé, aucune donnée réécrite). Une clé nouvelle, `sexual_attraction_repulsion`, porte l'attirance sexuelle. Les deux sont en visibilité `gm` par défaut, comme l'axe d'origine.
2. **La familiarité** : `familiarity`, 0…100, à quel point A connaît B (inconnu < 10 · de vue < 30 · connaissance < 60 · familier < 85 · intime). Elle monte à chaque rencontre et redescend lentement sans contact.
3. **Les liens nommés** (simulation §8.4) : ami, ami proche, rival, rancune, ennemi juré, mentor, protégé, amant·e, partenaire, ex, compagnon d'armes, ami d'enfance. La parenté reste le domaine du bloc `genealogy`.

---

## 9. Identité et orientations

### 9.1 Où

Dans le bloc `character`, à côté de `gender` et `pronouns` qui existent. Tous facultatifs. Chaque champ a sa visibilité, par défaut celle du bloc. **Ils sont toujours affichés** selon cette visibilité ; aucun réglage de table ne les masque (ADR 0073).

### 9.2 Pronoms

```ts
pronouns_v2?: { subject: "il" | "elle" | "iel" | "custom", custom?: string, agreement: "m" | "f" | "n" | "mixed" }
```

`agreement` décide de l'accord des adjectifs (§1.1) et entre dans le contexte du modèle (B6). `mixed` alterne selon la phrase ; le modèle reçoit la consigne en clair. Le champ texte `pronouns` existant reste lu et affiché s'il n'y a rien d'autre.

### 9.3 Identité de genre

`gender_identity?: { key, label?, trans?: "trans" | "cis" | "unspecified" }`. Clés : `woman`, `man`, `non_binary`, `agender`, `genderfluid`, `bigender`, `questioning`, `custom`. `label` libre, obligatoire pour `custom`, facultatif sinon (« demi-fille »). Le champ `gender` existant reste lu (B4 dit comment).

### 9.4 Orientations

Chacune a une **étiquette** (ce qui s'affiche) et, pour les deux premières, un **ensemble d'attirance** (ce que le moteur lit).

```ts
sexual_orientation?: { key, label?, attracted_to: GenderGroup[] }
romantic_orientation?: { key, label?, attracted_to: GenderGroup[] }
relational_orientation?: { key, label? }
// GenderGroup = "women" | "men" | "non_binary"
```

| Liste | Clés |
|---|---|
| Sexuelle | `heterosexual`, `homosexual`, `bisexual`, `pansexual`, `asexual`, `demisexual`, `graysexual`, `questioning`, `custom` |
| Romantique | `heteroromantic`, `homoromantic`, `biromantic`, `panromantic`, `aromantic`, `demiromantic`, `grayromantic`, `questioning`, `custom` |
| Relationnelle | `monogamous`, `poly_hierarchical`, `poly_non_hierarchical`, `polyaccepting`, `relationship_anarchy`, `questioning`, `custom` |

- **L'ensemble d'attirance se propose depuis l'étiquette et l'identité** (une femme hétérosexuelle : `men` ; bi ou pan : les trois ; ace ou aro : aucun) puis **se règle à la main**. C'est ce qui rend une étiquette personnalisée lisible par le moteur, et ce qui évite de deviner pour une personne non binaire.
- Les nuances `demi` et `gray` ralentissent la naissance de l'attirance (elle exige une familiarité haute) sans fermer l'ensemble.
- **Un filtre, jamais un trait** : ces champs ne modifient aucune facette, valeur ni besoin, à **une seule exception écrite** : le besoin `romance` vaut 0 pour une personne aromantique. L'orientation relationnelle ne joue qu'en situation de non-exclusivité (simulation §8.5). Un test le vérifie (critère transverse 12).

### 9.5 Ce que décide la table

Deux réglages de campagne (`specs/simulation-monde.md` §11) : `intimate_narration` (`explicit` | `fade`) et `romance_simulation` (booléen). Ils touchent au récit et à la simulation, **jamais à l'affichage** des champs ci-dessus.

---

## 10. Ce que reçoit le modèle

Un résumé par personne présente, en bandes nommées, **jamais un nombre** :

```
Bram (il, accord masculin) — tavernier.
Tempérament : très chaleureux, plutôt colérique, très rancunier, réfléchi.
Convictions : chérit la loyauté, rejette le pouvoir. Ne trahira jamais un serment (impensable).
Rêve : retrouver sa sœur Aude.
En ce moment : en colère (le groupe a cassé sa vaisselle), en manque de compagnie, fatigué.
Envers le groupe : méfiant, se sent redevable ; les connaît comme « des voyageurs du nord ».
Souvenir marquant : la mort de sa femme dans l'incendie (deuil).
Parle familièrement ; appelle tout le monde « petit ».
```

- Les **cinq** facettes et **trois** valeurs les plus marquées, pas toutes : le reste ne change rien à une réplique.
- Le plafond par personne est fixé en B6 après mesure. La V2 visait 80 tokens ; ce résumé en fait environ 110.
- Ce que l'audience n'a pas le droit de savoir n'y entre pas (règle 11) : rêves en visibilité `gm`, couches réglées « MJ seul » quand la sortie est lue par un joueur, croyances fausses présentées comme vraies.

---

## 11. Critères d'acceptation de la spec

- [ ] Chaque liste a ses clés, ses libellés et ses bandes ici ; le code les recopie dans `src/core/psyche/keys.ts` et `messages/`, sans en inventer.
- [ ] La conversion V2 → V4 (§7.4) est une fonction pure, testée sur chaque ligne des deux tables.
- [ ] Le test « un filtre, jamais un trait » (§9.4) existe.
