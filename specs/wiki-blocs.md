# Spécification — Blocs de wiki

**Version :** 0.1 — 29 juillet 2026
**Statut :** Conception arrêtée. `description`, `gallery`, `infobox` en V0 ; le reste en V1 et V2
**Amende :** `Phase0_Schema_Technique_v0_6.md` §7 · `Spec_Wiki_Liens_et_Personnages_v0_1.md` partie B

---

## 0. Le principe qui commande tout le reste

Les captures de référence montrent une fiche de personnage complète. **Environ 90 % de ce qui y figure ne doit pas être stocké.**

| Ce qu'on voit | D'où ça vient |
|---|---|
| FOR +3 | dérivé de la valeur 16 |
| SAU +5 | dérivé de la maîtrise et de FOR |
| Les 18 lignes de compétences | intégralement dérivées |
| Attaque +5, dégâts 1d6+3 | dérivés de l'arme équipée et du personnage |
| CA 14 · 12 (cuir clouté) + 2 (Dex) | dérivé, **avec sa provenance** |
| 21,4 / 108 kg | dérivé du poids des objets et de FOR |
| PV 12/12, Second souffle 2 usages | **stocké** — état de jeu |
| Espèce, classe, niveau, choix, inventaire | **stocké** — le « build » |

Trois natures de données, à ne jamais confondre :

1. **Le build** — stable, stocké dans des blocs. Petit.
2. **La vue dérivée** — calculée par le moteur à chaque affichage. Jamais stockée.
3. **L'état de jeu** — volatile, propre à une campagne, stocké à part.

C'est pourquoi la « fiche de personnage » n'est pas un bloc mais **une composition de cinq blocs plus une vue de rendu**. Un bloc monolithique contenant tous ces champs produirait exactement la divergence qu'on cherche à éviter : une CA enregistrée qui ne bouge pas quand on change d'armure.

---

## 1. Le catalogue

Même enveloppe que les blocs de règles (`block_type`, `schema_version`, `display`, `data`), même vocabulaire de primitives, mêmes mises en page. Un bloc de wiki peut en plus porter une **visibilité propre** — ce que les blocs de règles n'ont pas.

### V0 — indispensables

| Bloc | Layout | Contenu |
|---|---|---|
| `description` | `prose` | segments narratifs avec liens et visibilité par segment |
| `infobox` | `key_values` | l'encadré classique : population, fondation, dirigeant, climat |
| `gallery` | `gallery` | images avec légendes, une en portrait |
| `custom_table` | `table` | l'échappatoire, dès le premier jour |

### V1 — le cœur

| Bloc | Layout | Contenu |
|---|---|---|
| `character` | composite | le build : espèce, classe, niveau, caractéristiques, choix |
| `inventory` | `inventory` | objets, équipement, conteneurs, bourse |
| `spellcasting` | `chips` | sorts connus et préparés, par référence |
| `resources` | `trackers` | compteurs, y compris personnalisés |
| `statblock` | `key_values` | bloc de stats direct, pour créature ou PNJ sans build |
| `timeline` | `timeline` | frise chronologique (§3) |
| `relationships` | `chips` | liste simple des relations, version légère de la généalogie |

### V2 — utiles, à ne pas construire avant

| Bloc | Pourquoi il vaut le coup |
|---|---|
| `genealogy` | arbre généalogique interactif (§2) — plus lourd que `relationships` |
| `random_table` | générateurs de MJ (noms, rencontres, butin). Fonction phare de dd2024.fr, très réutilisable |
| `quest` | objectifs, états, récompenses, avancement |
| `encounter` | rencontre préparée : créatures, difficulté calculée, initiative |
| `loot` | table de trésor, avec références vers les objets |
| `map_pins` | localisation sur une carte |
| `quote` | citations et exergues |
| `session_log` | compte rendu de séance, relié aux `session_events` |

**Ne pas construire les vingt.** Quatre en V0, sept en V1. Le reste quand un besoin concret le réclame — c'est la même règle des trois que pour les blocs de règles.

---

## 2. Le bloc `genealogy`

### La décision de conception

**Le bloc ne stocke aucun lien de parenté.** Les liens vivent dans la table `relations`, qui existe déjà. Le bloc ne stocke que la façon de les regarder.

```json
{
  "block_type": "genealogy",
  "display": { "label": "Généalogie", "layout": "graph" },
  "data": {
    "root_entity_id": "ent_7f3a",
    "depth_up": 2,
    "depth_down": 2,
    "primary_relations": ["parent_of", "married_to", "sibling_of", "adopted_by"],
    "secondary_relations": ["mentor_of", "rival_of", "sworn_to"],
    "orientation": "vertical",
    "manual_positions": [ { "entity_id": "ent_9b1c", "x": 120, "y": 40 } ]
  }
}
```

C'est la même leçon que la hiérarchie des lieux : une seule source de vérité pour le graphe. Ajouter un père se fait en créant une relation, et **tous** les arbres généalogiques qui incluent cette personne se mettent à jour. Si le bloc stockait l'arbre, il faudrait le saisir autant de fois qu'il apparaît.

### Vocabulaire des relations

À figer, sinon chacun inventera `pere_de`, `parent`, `father_of` et le graphe deviendra inexploitable.

| Famille | Social | Spatial | Possession | Narratif |
|---|---|---|---|---|
| `parent_of` | `friend_of` | `part_of` | `owns` | `knows` |
| `sibling_of` | `rival_of` | `located_in` | `created` | `loves` |
| `married_to` | `mentor_of` | `origin_of` | `carries` | `hates` |
| `adopted_by` | `serves` | | | `participated_in` |
| `ancestor_of` | `member_of` | | | `witnessed` |
| | `leads` | | | |

Chaque type déclare son inverse dans une table applicative : `parent_of` ↔ `child_of`, `owns` ↔ `owned_by`, `married_to` ↔ lui-même. Une seule ligne stockée, deux sens navigables.

### Le point sensible : les secrets de famille

Une relation porte sa propre visibilité — c'était déjà dans le schéma. C'est ce qui permet à « Bram est le fils du duc » d'être en `gm` alors que Bram et le duc sont tous deux des fiches publiques.

**Conséquence obligatoire : le graphe est construit côté serveur, après filtrage.** Si le client reçoit le graphe complet pour le dessiner, la parenté secrète est dans la réponse HTTP, quelle que soit la façon dont on la masque à l'écran. Même règle que partout ailleurs, mais elle est particulièrement facile à oublier ici parce qu'un graphe « se dessine côté client ».

Corollaire d'affichage : un nœud dont la relation est cachée disparaît, il ne s'affiche pas grisé. Un trou visible dans un arbre est une information.

---

## 3. Le bloc `timeline`

```json
{
  "block_type": "timeline",
  "display": { "label": "Chronologie", "layout": "timeline" },
  "data": {
    "calendar": "default",
    "scope": {
      "entries": true,
      "query": { "entity_kind": "event", "related_to": "ent_7f3a", "tags": ["guerre-des-cendres"] }
    },
    "entries": [
      { "id": "t1",
        "date": { "year": 1247, "month": 3, "day": 12, "precision": "day" },
        "kind": "birth",
        "title": "Naissance de Bram",
        "summary": "Dans une ferme du nord.",
        "refs": [ { "kind": "entity", "id": "ent_7f3a" } ],
        "visibility": { "level": "public" } },
      { "id": "t2", "entity_id": "ent_evt_22" }
    ],
    "group_by": "era",
    "orientation": "vertical"
  }
}
```

### Deux sources, et il faut les deux

- **Entrées en ligne** — « naissance de Bram » ne mérite pas une fiche à elle seule.
- **Entités de type `event`** — « la Guerre des Cendres » mérite une fiche, avec sa description, ses participants, ses conséquences.

Une entrée en ligne doit pouvoir être **promue en entité** d'un clic quand elle prend de l'importance : l'entrée devient une référence, le contenu part dans la nouvelle fiche, rien n'est perdu. Ce motif de promotion resservira ailleurs (un objet d'inventaire qui devient un artefact avec une histoire).

Genres d'entrée, pour l'iconographie et le filtrage : `birth`, `death`, `war`, `battle`, `founding`, `discovery`, `meeting`, `oath`, `betrayal`, `trauma`, `disaster`, `custom`.

### Les dates — le sujet piégeux

Un monde de fiction a son propre calendrier. Le traiter à moitié coûte cher, le traiter à fond est un projet en soi. La position raisonnable :

```json
{
  "calendar": "default",
  "year": 1247, "month": 3, "day": 12,
  "precision": "day",
  "end": null,
  "sort_key": 455891,
  "label": null
}
```

Quatre décisions :

1. **`sort_key` est un entier calculé, stocké à côté.** C'est l'astuce qui fait tout marcher : le tri, les filtres de période et les regroupements fonctionnent sans que le code de la frise connaisse quoi que ce soit au calendrier. Un calendrier à treize mois de vingt-huit jours ne casse rien.
2. **`precision`** gère l'imprécision : `day`, `month`, `season`, `year`, `decade`, `era`. « Vers 1200 » est une date valide.
3. **`end`** permet les périodes. Une guerre dure.
4. **`label`** prime à l'affichage quand il est renseigné : « le Troisième Hiver Noir » plutôt qu'une date.

En V1, un seul calendrier par monde, stocké en JSON dans les réglages du monde : nom des mois, jours par mois, jours par semaine, ères. Une table de calendriers seulement si le besoin de plusieurs calendriers concurrents apparaît vraiment — il n'apparaîtra probablement jamais.

---

## 4. La fiche de personnage

### 4.1 Ce qui est stocké

**Bloc `character` — le build.** Petit, c'est voulu.

```json
{
  "species": { "kind": "rule", "key": "orc" },
  "background": { "kind": "rule", "key": "soldier" },
  "classes": [ { "class": { "kind": "rule", "key": "fighter" }, "level": 1, "subclass": null } ],
  "abilities": { "method": "standard_array",
                 "base": { "str": 15, "dex": 14, "con": 15, "int": 12, "wis": 10, "cha": 8 } },
  "choices": {
    "orc.traits": [],
    "fighter.l1.skills": ["athletics", "intimidation", "perception", "survival"],
    "fighter.l1.fighting_style": ["great_weapon_fighting"],
    "fighter.l1.weapon_mastery": ["greatsword", "greataxe", "spear"],
    "soldier.feat": ["savage_attacker"]
  },
  "hp_method": "fixed",
  "portrait_asset_id": "ast_1f2e"
}
```

**Bloc `inventory`.** Trois natures d'objet, et il faut les trois :

```json
{
  "items": [
    { "id": "i1", "ref": { "kind": "rule", "key": "scimitar" },
      "qty": 1, "equipped": true, "slot": "main_hand" },
    { "id": "i2", "ref": { "kind": "entity", "id": "ent_excalibur" },
      "qty": 1, "attuned": true, "equipped": true },
    { "id": "i3", "label": "Fiole de sable noir", "qty": 3,
      "weight": { "value": 0.2, "unit": "kg" }, "notes": "Trouvée dans la crypte." }
  ],
  "containers": [ { "id": "c1", "label": "Sac", "contains": ["i3"] } ],
  "currency": { "pp": 0, "gp": 61, "ep": 0, "sp": 0, "cp": 0 }
}
```

| Nature | Usage |
|---|---|
| Référence à une **règle** | un cimeterre standard — poids, dégâts, propriétés viennent de la fiche de règle |
| Référence à une **entité** | Excalibur — a une histoire, un ancien propriétaire, une fiche de wiki, et une facette mécanique |
| Objet **en ligne** | une babiole sans importance ; promouvable en entité si elle en prend |

C'est ici que l'unification wiki/règles devient concrète : le même inventaire pointe vers les deux mondes, et l'affichage est identique.

**Bloc `spellcasting`.**

```json
{
  "sources": [ { "class": "wizard", "ability": "int" } ],
  "known": [ { "ref": { "kind": "rule", "key": "fireball" }, "origin": "spellbook" } ],
  "prepared": ["fireball", "shield"],
  "slot_override": null
}
```

Les emplacements de sort sont **dérivés** de la table de progression de la classe. On ne les stocke pas ; on stocke leur consommation, dans l'état de jeu.

**Bloc `resources`.**

```json
{
  "trackers": [
    { "id": "r1", "label": "Second souffle",
      "source": { "kind": "rule", "key": "second_wind" },
      "max": { "formula": { "op": "num", "v": 2 } }, "recharge": "short_rest" },
    { "id": "r2", "label": "Points de fureur", "max": { "formula": { "op": "num", "v": 5 } },
      "recharge": "long_rest", "custom": true }
  ]
}
```

`custom: true` couvre les « compteurs personnalisés » : jauge d'objet, ressource de sous-classe, aptitude maison. Le maximum est une formule, donc il peut dépendre du niveau.

**Bloc `statblock`** — pour une créature ou un PNJ sans build. Un gobelin n'a pas fait de choix de classe : il a des valeurs plates. Le forcer à passer par le moteur de build serait absurde. Bloc distinct, chemin distinct.

### 4.2 L'état de jeu

Ni build, ni dérivé. Il change à chaque tour de jeu et dépend de la campagne.

```sql
create table entity_runtime_state (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,  -- null = état hors partie
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create unique index runtime_state_uniq on entity_runtime_state
  (entity_id, coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid));
```

```json
{
  "hp": { "current": 12, "temp": 0 },
  "hit_dice": { "d10": 1 },
  "exhaustion": 0,
  "xp": 0,
  "resources": { "r1": 2, "r2": 5 },
  "spell_slots_used": { "1": 0 },
  "conditions": ["prone"],
  "death_saves": { "success": 0, "fail": 0 },
  "attuned": ["ent_excalibur"]
}
```

**Séparer cette table est ce qui permet au même personnage d'exister dans deux campagnes** sans que ses points de vie se mélangent. Et cela garde le build propre : une fiche de wiki ne devrait pas être modifiée quarante fois par séance parce qu'un PNJ perd des points de vie.

### 4.3 La vue dérivée

Tout le reste. Produit par `characterSheet()` (spécifié en §B7 de `Spec_Wiki_Liens_et_Personnages_v0_1.md`), à chaque affichage, jamais enregistré.

Deux exigences qui font la différence entre un outil et un tableur :

**Chaque valeur porte sa provenance.** Pas « CA 14 » mais « 14 = 12 cuir clouté + 2 Dex ». Les captures de référence le font déjà — c'est exactement le bon réflexe. Sans cela, l'utilisateur qui trouve un chiffre bizarre n'a aucun moyen de savoir si c'est lui ou le moteur qui se trompe, et cesse de faire confiance à l'ensemble.

**Chaque référence porte son lien.** Une capacité affichée montre son résumé et mène à sa fiche de règle. Une arme affiche ses propriétés et mène à la sienne. Un sort affiche sa ligne de résumé et mène à la sienne. C'est le mécanisme demandé pour les sorts, et il vaut pour **tout** : maîtrises d'armes, dons, traits d'espèce, styles de combat, objets.

Ce mécanisme est déjà entièrement disponible : la primitive `Reference`, le résumé `ai_digest` d'une entrée de règle, et la table `ruleset_entry_refs`. Rien de nouveau à construire — juste un composant d'affichage, `<RuleChip>`, utilisé partout.

### 4.4 Composition d'une fiche

```
Entité « Tharnok Oorvash »  (entity_kind = 'character')
├── bloc description      visibilité public
├── bloc gallery          portrait
├── bloc character        le build
├── bloc inventory
├── bloc resources
├── bloc relationships
├── bloc description      visibilité gm — ses véritables intentions
└── état runtime          par campagne

Vue « fiche de jeu » = ces blocs + characterSheet() + le ruleset épinglé
```

La même entité affiche donc **deux visages** : sa page de wiki (narratif, relations, histoire) et sa fiche de jeu (mécanique, jouable). Mêmes données, deux rendus. C'était le principe fondateur du projet — le voici concret.

Conséquence pratique : un PNJ et un PJ ne sont pas de natures différentes. Un PNJ est une entité avec un bloc `statblock` ; s'il devient jouable, on lui ajoute un bloc `character`. Rien à migrer.

---

### 4.5 Ce qui se passe quand on joue

La fiche est vivante : on retire son armure, on dépense de l'or, on ramasse du butin. Trois règles régissent ces mutations.

**Une bascule écrit le plus petit fait possible.** Décocher « équipé » sur l'armure écrit un booléen dans le bloc `inventory`. Rien d'autre n'est enregistré. La classe d'armure, la vitesse, le désavantage à la discrétion, l'encombrement se recalculent tous à partir de ce booléen. Même chose pour un bouclier, un anneau, une arme à deux mains.

**Le recalcul est instantané parce que le moteur est du code pur.** `characterSheet()` n'a aucune dépendance au réseau ni à la base : elle tourne donc **aussi dans le navigateur**. La CA change à la milliseconde, sans aller-retour serveur. Le serveur reste l'autorité pour ce qui engage la partie — les jets, l'application des règles en jeu — mais l'affichage se recalcule côté client avec **exactement la même fonction**. Aucune divergence possible entre les deux, puisque c'est le même code.

C'est le bénéfice concret de la contrainte « `src/core` n'importe rien de `next`, `react` ou `@supabase` ». Elle avait l'air d'une discipline abstraite ; elle sert précisément ici.

**Les mutations de jeu ne créent pas de révision de wiki.** Sinon dépenser trois pièces d'or produirait trois entrées dans l'historique de la fiche, et cet historique deviendrait illisible en une séance.

| Type de modification | Ce qui est écrit |
|---|---|
| Édition rédactionnelle (texte, relations, blocs) | mutation + `entity_revision` |
| Mutation de jeu (équiper, dépenser, ramasser, perdre des PV) | mutation + `session_event` |
| Fin de séance | un `entity_revision` unique, instantané de la fiche |

Le journal de session est déjà en ajout seul et enregistre déjà « Bram trouve 30 po ». Il n'y a rien à construire : il suffit de ne pas écrire au mauvais endroit. On obtient un historique de wiki lisible (les modifications voulues) **et** une traçabilité de jeu complète (le journal), avec un point de restauration par séance.

---

## 5. Les blocs auxquels vous n'avez pas pensé

Par ordre de valeur décroissante.

**`random_table`** — le générateur de MJ. Tables de noms, de rencontres, de butin, de rumeurs, de météo. Techniquement trivial (une table pondérée plus un jet), fonctionnellement énorme : c'est ce que les MJ utilisent le plus souvent dans un compagnon. Une entrée de table peut référencer une entité ou une règle, donc « jeter sur la table des rencontres » peut produire un lien vers une créature réelle du monde. Et le résultat d'un jet peut être promu en entité.

**`statblock`** — déjà cité, mais il mérite d'être souligné : sans lui, chaque PNJ exige un build complet de personnage. Personne ne construira un gobelin niveau par niveau.

**`quest`** — objectifs, état (`non commencée`, `en cours`, `réussie`, `échouée`, `abandonnée`), récompenses, PNJ commanditaire, prérequis. C'est le squelette narratif d'une campagne, et le mode solo en aura besoin pour savoir où en est le joueur.

**`encounter`** — une rencontre préparée : liste de créatures avec leur nombre, difficulté calculée, environnement, tactiques en visibilité MJ. Se transforme en suivi d'initiative d'un clic quand la rencontre démarre.

**`relationships`** — la version légère de la généalogie : une simple liste des relations d'une entité, groupée par type. Presque gratuit à construire puisque les données existent, et suffisant dans 80 % des cas. **À construire avant `genealogy`, pas après** : vous découvrirez peut-être que l'arbre visuel n'est pas nécessaire.

**`loot`** — trésor, avec références et quantités aléatoires. Se distribue dans les inventaires.

**`map_pins`** — localisation sur une carte, quand les cartes existeront.

**`quote`** — citations, exergues, dictons. Trivial, et c'est ce qui donne de l'âme à une page de wiki.

**`session_log`** — compte rendu de séance, relié aux `session_events`. En mode solo, c'est ce que l'IA remplit automatiquement.

---

## 6. Ce qui change dans le schéma

| Ajout | Migration |
|---|---|
| `entity_runtime_state` | 007 `sessions.sql` |
| Vocabulaire des types de relation, contrainte `CHECK` sur `relations.relation_type` | 003 `entities.sql` |
| Calendrier par défaut du monde, en JSON sur `worlds` | 002 `accounts.sql` |
| Table applicative des relations inverses (code, pas base) | `src/core/relations/inverses.ts` |

Aucune autre modification : la table `blocks` accueille tous ces types tels quels. C'était l'intérêt du modèle unifié — on ajoute des types de blocs, jamais des tables.

## 7. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Plusieurs calendriers concurrents dans un monde | Non en V1. Un seul, en JSON. La complexité ne se justifie presque jamais |
| Un même bloc peut-il apparaître deux fois ? | Oui pour `description`, `custom_table`, `gallery`, `timeline`. Une seule fois pour `character`, `inventory`, `spellcasting` |
| Les blocs de personnage sont-ils modifiables par le joueur ou par le MJ ? | Le joueur possède son build, le MJ possède l'état de jeu. À trancher au moment des permissions fines |
| Multiclassage dans l'interface de création | Prévu par le modèle, à ne pas exposer dans l'interface avant que le cas simple fonctionne |
| Promotion d'une entrée en entité | Motif générique à écrire une fois, réutilisé par `timeline`, `inventory`, `random_table` |
