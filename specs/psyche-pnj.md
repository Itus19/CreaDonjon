# Spécification — Psyché des personnages

**Version :** 0.1 — 12 août 2026
**Cible :** V2 pour la saisie humaine, V3 pour la lecture et l'écriture par l'IA
**Remplace :** `specs/wiki-blocs.md` partie D, dont ce document reprend et précise le contenu

---

## 0. Ce que ces blocs servent à faire

Deux blocs, une table, un objectif : qu'un PNJ soit **le même d'une séance à l'autre**, qu'il soit joué par vous ou par un modèle.

Le critère de succès de la V3 dans le PDD — « aucun PNJ inventé deux fois avec des traits contradictoires » — se joue entièrement ici.

| Bloc / table | Question à laquelle il répond |
|---|---|
| `personality` | Comment cette personne décide, en général ? |
| `relationship` | Que pense-t-elle de *vous*, maintenant, et pourquoi ? |
| `entity_attitudes` | La valeur courante, propre à une campagne |

---

## 1. La leçon de Dwarf Fortress, et sa limite

Vous citez son modèle. L'intuition est juste ; la transposition demande une correction.

Dwarf Fortress simule des milliers de nains parce qu'un état émotionnel y coûte quelques octets et un calcul. Le nain n° 3000 est gratuit.

Ici, chaque mouvement de pôle vient d'une action de l'IA — qui coûte des tokens — ou d'une saisie du MJ — qui coûte de l'attention. Une simulation continue serait ruineuse des deux côtés.

**La règle qui rend le système tenable : les pôles ne bougent que sur événement explicite.** Pas de dérive de fond, pas de tâche périodique. Un PNJ dont personne ne s'est occupé depuis six séances a exactement les valeurs de la sixième.

Ce qui reste de Dwarf Fortress, et qui est l'essentiel : **chaque valeur porte la trace de ce qui l'a produite.** Un nain malheureux dans DF sait *pourquoi*. C'est ce qui rend ses réactions crédibles, et c'est reproductible ici pour un coût nul.

---

## 1.5 L'échelle : fine en base, nommée à l'écran

L'échelle à sept crans était trop grossière — vous avez raison. Elle rend impossible de distinguer une remarque déplaisante d'une trahison : les deux valent « un cran ».

**Décision : stocker sur −100 à +100, afficher et transmettre en bandes nommées.**

Le signe porte le pôle, la valeur absolue l'intensité, 0 reste le centre neutre. C'est ce qui préserve la sémantique « ne s'en soucie pas » — une échelle 0-100 la perdrait, puisque 0 y voudrait dire « hostilité maximale ».

| Valeur | Bande | Exemple sur `trust` |
|---|---|---|
| ≤ −67 | extrême | convaincu de sa duplicité |
| −66 … −34 | forte | méfiant |
| −33 … −12 | légère | réservé |
| −11 … +11 | **neutre** | neutre |
| +12 … +33 | légère | ouvert |
| +34 … +66 | forte | confiant |
| ≥ +67 | extrême | aveugle |

**Le nombre ne sort jamais du moteur.** L'écran affiche « méfiant » avec un curseur ; le contexte IA reçoit « méfiant ». Envoyer `trust: -47` à un modèle ne dit rien d'actionnable, et deux modèles interpréteront ce nombre différemment. C'était le vrai argument derrière mes sept crans, et il tient toujours — il se satisfait très bien d'un stockage fin.

Le MJ voit la valeur exacte au survol, et peut la saisir directement. C'est utile pour régler finement, jamais pour lire.

### Poids des événements

C'est ce que l'échelle fine débloque, et c'est son intérêt principal.

| Ampleur | Delta | Exemple |
|---|---|---|
| Broutille | 1 – 3 | une plaisanterie de mauvais goût |
| Notable | 5 – 10 | rendre un service, insulter un proche |
| Marquant | 15 – 25 | sauver la vie, voler une somme importante |
| Bouleversement | 40 + | trahison, révélation d'identité — **confirmation explicite requise** |

Trente broutilles ne valent pas une trahison, et c'est exactement ce qu'on ne pouvait pas exprimer avant.

### Rendements décroissants — la précaution indispensable

Sans elle, l'échelle fine sature comme l'ancienne, juste plus lentement : au bout de trente séances, tous les axes de tous les PNJ sont collés aux extrêmes et le système cesse de discriminer.

**Règle : s'éloigner du centre est de plus en plus difficile ; y revenir ne l'est pas.**

```ts
// src/core/psyche/apply.ts — fonction pure
function applyDelta(current: number, delta: number): number {
  const movingAway = Math.sign(delta) === Math.sign(current) || current === 0;
  const effective = movingAway
    ? delta * (1 - Math.abs(current) / 100)   // amorti vers les extrêmes
    : delta;                                   // plein effet vers le centre
  return clamp(Math.round(current + effective), -100, 100);
}
```

Un PNJ à +80 de confiance gagne 2 points sur un service qui en vaudrait 10 : il vous fait déjà confiance, un service de plus ne change plus grand-chose. Le même PNJ qui se fait trahir perd les 25 points pleins.

C'est psychologiquement juste, et c'est surtout ce qui garde le système lisible sur la durée : les extrêmes restent rares, donc ils gardent du sens.

**Conséquence :** ±100 n'est jamais atteint exactement. Sans importance — au-delà de 67 la bande affichée est la même.

---

## 2. Le bloc `personality`

Attaché à toute entité qui décide : personnage, créature nommée, et — pour ce qui est des convictions — faction ou institution.

```json
{
  "block_type": "personality",
  "display": { "label": "Personnalité", "layout": "poles" },
  "data": {
    "poles": [
      { "key": "curiosity_caution",    "value": 2,  "note": "Ouvre toujours la porte fermée." },
      { "key": "altruism_selfishness", "value": -1 },
      { "key": "empathy_hardness",     "value": 1 },
      { "key": "impulse_prudence",     "value": -2 },
      { "key": "extraversion_reserve", "value": 0 },
      { "key": "authority_independence","value": -3 }
    ],
    "priority": ["authority_independence", "impulse_prudence"],
    "aspirations": [
      { "text": "Devenir la plus grande magicienne de sa génération",
        "horizon": "life", "intensity": 3, "visibility": { "level": "public" } },
      { "text": "Retrouver qui a brûlé sa maison",
        "horizon": "arc", "intensity": 3, "visibility": { "level": "gm" } },
      { "text": "Dormir dans un vrai lit cette semaine",
        "horizon": "session", "intensity": 1 }
    ],
    "lines":  ["ne trahira jamais un serment prêté à voix haute"],
    "limits": ["mentira, mais mal et à contrecœur"],
    "baseline": { "trust": -1, "affinity": 0, "respect": 0, "fear": 0 },
    "speech": { "register": "familier", "tics": ["appelle tout le monde « petit »"] }
  }
}
```

### Vos six pôles, retenus tels quels

`curiosité ↔ conservatisme` · `altruisme ↔ égoïsme` · `empathie ↔ dureté` · `impulsivité ↔ prudence` · `extraversion ↔ réserve` · `autorité ↔ indépendance`

**Échelle de −100 à +100** (voir §1.5), 0 signifiant « ne s'en soucie pas » — une information, pas une absence de donnée.

### Trois champs qui font la différence

**`priority`.** Une liste de traits sans hiérarchie ne dit rien à l'IA. Quand la curiosité et la prudence s'opposent, `priority` tranche. C'est le champ le plus utile du bloc.

**`aspirations`, avec un horizon.** Vous demandez des désirs profonds ; l'ajout qui les rend jouables est de distinguer trois échelles : `life` (le but d'une vie), `arc` (ce qu'il ou elle poursuit en ce moment), `session` (ce qu'il ou elle veut ce soir). Sans le troisième, un PNJ croisé dans une taverne n'a rien à vouloir dans la scène en cours — et l'IA lui invente un motif.

Une aspiration porte une visibilité : le PNJ affiche son ambition, il cache sa vengeance.

**`lines` et `limits`.** Ce qu'il ne fera jamais, ce qu'il fera à contrecœur. Deux phrases qui contraignent l'IA bien plus efficacement que six curseurs.

### `worldview` : convictions séparées

Les pôles moraux et politiques — `ordre ↔ liberté`, `miséricorde ↔ justice`, `sacré ↔ profane`, `tradition ↔ progrès`, `individu ↔ collectif`, `richesse ↔ honneur`, `paix ↔ force` — restent dans un bloc distinct, attachable aussi à une **faction**.

Une guilde a des convictions ; elle n'a pas de tempérament. Séparer permet de comparer un PNJ à sa faction, et de faire tomber une tension narrative sans qu'on l'ait saisie : *« Bram sert la Main Silencieuse, mais leurs convictions divergent de 4 crans sur miséricorde ↔ justice — son pôle prioritaire. »*

---

## 3. Le bloc `relationship`

**Un bloc par relation**, comme vous le demandez. Le bloc décrit *ce que A ressent envers B* ; les valeurs courantes vivent dans `entity_attitudes`, portée campagne.

```json
{
  "block_type": "relationship",
  "display": { "label": "Envers Max", "layout": "poles" },
  "data": {
    "target": { "kind": "entity", "id": "ent_max" },
    "axes": [
      { "key": "trust_distrust",        "value": -2 },
      { "key": "friendship_hostility",  "value": -1 },
      { "key": "respect_contempt",      "value": 1 },
      { "key": "attraction_repulsion",  "value": 0 },
      { "key": "debt_independence",     "value": 2 },
      { "key": "fear_assurance",        "value": -1 },
      { "key": "interest_indifference", "value": 2 }
    ],
    "known_as": "un mercenaire de passage",
    "history_visible": 20
  }
}
```

### Vos sept axes, retenus tels quels

`confiance ↔ méfiance` · `amitié ↔ hostilité` · `respect ↔ mépris` · `attirance ↔ répulsion` · `dette ↔ indépendance` · `peur ↔ assurance` · `intérêt ↔ indifférence`

Deux remarques de conception.

**`dette ↔ indépendance` est le plus original et le plus utile.** C'est le seul axe qui produit une *obligation* plutôt qu'un sentiment, et donc des comportements que les six autres ne peuvent pas générer : rendre un service à quelqu'un qu'on n'aime pas.

**`attirance ↔ répulsion` demande une précaution produit.** Un axe romantique sur des fiches partagées avec des joueurs, ce n'est pas neutre. Recommandation : visibilité `gm` par défaut, et l'axe désactivable au niveau du monde. Certaines tables n'en voudront pas.

### Chaque bande est nommée

Sept bandes par axe, seuils de §1.5. Valeurs stockées de −100 à +100.

| Axe | extrême − | forte − | légère − | neutre | légère + | forte + | extrême + |
|---|---|---|---|---|---|---|---|
| `trust` | convaincu de sa duplicité | méfiant | réservé | neutre | ouvert | confiant | aveugle |
| `friendship` | haineux | hostile | froid | indifférent | cordial | amical | dévoué |
| `respect` | méprisant | dédaigneux | sceptique | neutre | estime | admiratif | révérencieux |
| `attraction` | répugné | rebuté | distant | indifférent | intrigué | attiré | épris |
| `debt` | se sent lésé | rancunier | quitte | neutre | redevable | obligé | lié |
| `fear` | le domine | l'intimide | prudent | neutre | mal à l'aise | craintif | terrifié |
| `interest` | l'évite | l'ignore | distrait | neutre | attentif | intéressé | obsédé |

**Le nom compte plus que le nombre.** C'est la bande qui est affichée et transmise ; la valeur exacte reste au moteur et au réglage fin du MJ.

### `known_as` — le champ que j'ajoute

Ce que A croit savoir de B. Un PNJ peut être méfiant envers « un mercenaire de passage » sans savoir qu'il s'agit de l'héritier du duché.

Sans ce champ, l'IA qui lit une relation connaît l'identité réelle de la cible et la trahit dans sa formulation. C'est la même fuite par le contexte que celle traitée au principe 3.10 du PDD, appliquée aux relations.

---

## 4. L'historique d'interaction

Vous décrivez exactement ce qu'il faut : *« Max a insulté un passant : Hostilité +4 »*.

```sql
create table attitude_events (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  target_entity_id uuid not null references entities(id) on delete cascade,
  summary      text not null,                       -- « Max a insulté un passant »
  deltas       jsonb not null default '{}'::jsonb,  -- { "friendship_hostility": -1 }
  origin       text not null check (origin in ('ai','gm','player','system')),
  session_event_id uuid references session_events(id),
  created_at   timestamptz not null default now()
);

create index attitude_events_pair_idx
  on attitude_events (campaign_id, source_entity_id, target_entity_id, created_at desc);
```

**Ajout seul.** Corriger une entrée consiste à en ajouter une compensatoire, jamais à réécrire — même règle que le journal de session.

**La valeur courante est dérivée.** `entity_attitudes.axes` est un cache, reconstructible en rejouant les événements. Si les deux divergent, le journal a raison.

### Trois profondeurs de lecture

C'est le point qui décide de la tenue du système sur trente séances.

| Qui | Reçoit |
|---|---|
| L'écran | les 20 dernières entrées de **cette paire**, le reste replié |
| Le contexte IA | **un résumé** plus les 5 à 10 dernières entrées de cette paire |
| L'audit | tout, conservé indéfiniment |

L'historique est **par paire**, jamais global : un bloc `relationship` par relation, donc un fil par relation. Le résumé aussi est par paire — un PNJ qui connaît six personnages a six résumés courts, pas un long.

Envoyer trois cents lignes d'historique à un modèle à chaque tour est intenable en coût comme en attention. Le résumé est régénéré tous les N événements par un modèle rapide, exactement comme le résumé glissant de session.

### Amplitude des mouvements

Barème et amortissement en §1.5. Deux règles s'y ajoutent :

- **Un delta brut supérieur à 40 exige une confirmation explicite** — ce sont les moments qu'on veut rares.
- **`deltas` stocke le brut, jamais l'effectif.** L'amortissement dépend de la valeur au moment de l'application ; rejouer le journal doit reproduire le même résultat, donc `applyDelta` est réappliqué à chaque rejeu. Stocker l'effectif rendrait la reconstruction fausse.

L'affichage montre les deux : *« Max a insulté un passant — hostilité +10 (appliqué : +6) »*.

---

## 5. Ce que l'IA en fait

### En lecture — environ 60 tokens par PNJ présent

```
Bram le Tavernier — envers le groupe : méfiant, cordial, se sent redevable
(a prêté de l'argent, séance 4). Vous connaît comme « des voyageurs du nord ».
Indépendant avant tout, impulsif. Ne trahira jamais un serment prêté à voix
haute. Veut ce soir : fermer tôt. Parle familièrement, appelle tout le monde
« petit ».
```

C'est peu, et c'est exactement ce qui manque à un MJ IA pour qu'un PNJ soit reconnaissable de séance en séance.

### En écriture — trois niveaux de prudence

| Ce qui change | Comportement |
|---|---|
| Une attitude, 1 cran | appliqué, journalisé, visible |
| Une attitude, 2 crans ou plus | appliqué, **signalé** au joueur |
| Une conviction, une aspiration, une ligne rouge | **proposé, jamais appliqué en silence**, même en solo |

Le troisième niveau est le garde-fou important. Sans lui, un modèle réécrit lentement chaque PNJ jusqu'à ce qu'ils se ressemblent tous — et c'est invisible tant qu'on ne compare pas à l'état initial.

Les valeurs d'un personnage qui changent, c'est un moment d'histoire. Pas une mise à jour de routine.

### Édition humaine

Le MJ déplace les curseurs, écrit une phrase, valide. Cela crée un `attitude_event` d'origine `gm`. Les mêmes données, deux chemins d'écriture, une seule vérité.

---

## 6. Portée et découpage

| Donnée | Portée | Raison |
|---|---|---|
| `personality`, `worldview` | l'entité, tous mondes confondus | Bram est Bram partout |
| `relationship` (le bloc) | l'entité | la relation existe hors partie |
| `entity_attitudes` (les valeurs) | **la campagne** | son opinion du groupe est propre à une partie |
| `attitude_events` | la campagne | idem |

Le groupe de joueurs est une entité de type `faction`, créée avec la campagne. « Attitude envers le groupe » est donc une ligne comme une autre — aucun concept nouveau.

---

## 7. Critères d'acceptation

- [ ] Un bloc `personality` avec pôles, priorité, aspirations à trois horizons, lignes rouges.
- [ ] Un bloc `relationship` par relation, avec les sept axes et `known_as`.
- [ ] Les valeurs sont stockées de −100 à +100 ; l'écran et le contexte IA affichent la **bande nommée**, jamais le nombre nu.
- [ ] `applyDelta` amortit les mouvements vers les extrêmes et applique en plein ceux vers le centre — fonction pure, testée aux bornes.
- [ ] Rejouer le journal d'une paire reproduit exactement la valeur courante, amortissement compris.
- [ ] `attitude_events` est en ajout seul ; corriger crée une compensation.
- [ ] Rejouer les événements reconstruit exactement `entity_attitudes.axes`.
- [ ] Un delta brut supérieur à 40 exige une confirmation explicite.
- [ ] Après 50 événements simulés d'ampleur « notable », aucun axe n'est saturé à l'extrême.
- [ ] L'axe `attraction_repulsion` est en visibilité `gm` par défaut et désactivable au niveau du monde.
- [ ] Le contexte envoyé au modèle pour un PNJ ne dépasse pas 80 tokens : résumé plus 5 dernières entrées.
- [ ] Une proposition IA modifiant une conviction ou une aspiration n'est jamais appliquée sans revue, y compris en solo.
- [ ] `known_as` est respecté : le contexte IA ne révèle pas l'identité réelle d'une cible que le PNJ ne connaît pas.

---

## 8. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Les pôles sont-ils configurables par monde ? | oui, mêmes que les pôles de `worldview` — un univers de cour ajoutera « loyauté ↔ ambition » |
| Une relation implique-t-elle la réciproque ? | non : dirigée, jamais symétrique. A peut se méfier de B qui l'adore, et c'est le cas le plus intéressant |
| Combien de relations avant que la fiche devienne illisible ? | replier au-delà de 5, trier par `interest_indifference` décroissant |
| Faut-il un tableau de bord des relations du monde ? | V3, quand il y aura de la matière — un graphe des attitudes est spectaculaire et inutile sur dix PNJ |
