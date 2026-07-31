# Spécification — Outils du maître de jeu

**Version :** 0.1 — 30 juillet 2026
**Statut :** Cible V2. Une seule vérification à faire maintenant (§1).
**Amende :** `PDD.md` §22 (feuille de route V2) · `BACKLOG.md`

---

## 0. Ce que couvre ce document

Quatre outils, tous prévus dans la feuille de route V2 mais jamais spécifiés au-delà d'une ligne :

| Outil | Ce que c'est |
|---|---|
| **Tables aléatoires** | tirer sur une table pondérée : rumeurs, noms, butin, rencontres, ambiances |
| **Générateurs composés** | un PNJ complet, une taverne, une échoppe — plusieurs tables assemblées en un résultat structuré |
| **Générateur de rencontres** | composer un combat dans un budget de difficulté calculé |
| **Suivi d'initiative** | l'ordre du tour, les points de vie, les conditions, la concentration |

Tous les quatre servent **deux fois** : au MJ humain en V2, puis au MJ IA en V3 — sans être réécrits. C'est le point le plus important du document et il est traité en §6.

---

## 1. La seule chose à vérifier maintenant

L'import SRD (ticket P0-08) est déjà passé. Le générateur de rencontres a besoin, pour chaque créature, du **facteur de puissance, de l'expérience, du type et de la taille**. Le suivi d'initiative a besoin de la **classe d'armure et des points de vie**.

Si l'import n'a pas conservé ces champs, il faudra tout réimporter dans un an.

**Parade recommandée, à appliquer aujourd'hui** — une colonne, une migration :

```sql
alter table ruleset_entries add column source_raw jsonb;
```

L'import y dépose l'objet JSON d'origine, intégralement. Tout champ non encore transformé en bloc reste disponible. Remapper plus tard devient un script local au lieu d'un nouvel import.

C'est bon marché, ça ne change rien en amont, et ça supprime définitivement la catégorie de problème « on n'avait pas gardé ce champ ». Si l'import a déjà conservé ces données, la colonne reste utile pour tout ce qu'on n'a pas encore prévu.

---

## 2. Les tables aléatoires

### 2.1 Le modèle

Une table est un **bloc**, `random_table`, avec le même contenant que tous les autres.

```json
{
  "block_type": "random_table",
  "display": { "label": "Rumeurs de taverne", "layout": "table" },
  "data": {
    "die": "d20",
    "entries": [
      { "range": [1, 3],  "weight": 3, "text": "Un enfant a disparu près du vieux moulin.",
        "refs": [{ "kind": "entity", "id": "ent_moulin" }] },
      { "range": [4, 6],  "weight": 3, "text": "Les gardes ont doublé leur patrouille de nuit." },
      { "range": [7, 7],  "weight": 1, "text": "Une caravane de {table:marchands} cherche une escorte.",
        "rolls": ["marchands"] }
    ],
    "unique_draws": false,
    "attribution": "Orkish Blade"
  }
}
```

Trois mécanismes qui font la différence entre une table utile et une liste :

**Les entrées peuvent référencer des entités et des règles.** « Un enfant a disparu près du vieux moulin » pointe vers la fiche du moulin. Le résultat du tirage est cliquable, pas juste du texte.

**Les entrées peuvent déclencher d'autres tirages.** `{table:marchands}` tire sur la table « marchands » et insère le résultat. C'est ce qui produit de la profondeur sans multiplier les tables — et la référence montre exactement ce motif (« Besoin d'une rumeur ? Tirez sur la table Rumeurs de Taverne »).

**Profondeur bornée à 3, cycles détectés.** Une table qui s'appelle elle-même doit échouer proprement, pas geler le serveur. Même discipline que les formules et la chaîne d'héritage des rulesets.

### 2.2 Où vit une table

Le bloc `random_table` peut s'attacher aux **deux** côtés du modèle :

| Attaché à | Portée | Exemple |
|---|---|---|
| Une **entité de wiki** | propre au monde | « Rumeurs de Valdoria », « Butin des Steppes » |
| Une **entrée de ruleset** | bibliothèque partagée | « Rencontres de forêt », « Noms elfiques » |

C'est le bénéfice direct d'avoir donné la même enveloppe de blocs aux fiches de règles et aux fiches de wiki : **un seul schéma, un seul moteur de tirage, un seul composant d'affichage**, deux emplacements. Rien à dupliquer.

### 2.3 Attribution

Les captures de référence créditent les auteurs des tables (« Par Orkish Blade »). C'est la bonne pratique et ça doit être un champ, pas une convention. Le jour où des tables se partagent entre utilisateurs, l'attribution est déjà là.

---

## 3. Les générateurs composés

Un générateur de PNJ n'est pas une table : c'est une **recette** qui tire sur plusieurs tables et assemble un résultat structuré. La distinction compte, parce qu'elle évite de créer trente tables « PNJ complet ».

```json
{
  "block_type": "generator",
  "display": { "label": "PNJ", "layout": "prose" },
  "data": {
    "inputs": [
      { "key": "species", "label": "Espèce", "source": { "kind": "rule_query", "entry_type": "species" },
        "allow_random": true }
    ],
    "slots": [
      { "key": "name",       "table": "noms.{species}.{gender}" },
      { "key": "occupation", "table": "metiers" },
      { "key": "appearance", "table": "details_apparence" },
      { "key": "trait",      "table": "traits" },
      { "key": "voice",      "table": "voix" },
      { "key": "desire",     "table": "desirs" },
      { "key": "secret",     "table": "secrets", "visibility": "gm" },
      { "key": "combat",     "table": "profils_combat" }
    ],
    "template": "**{name}**\n{species} · {occupation}\nApparence : {appearance}\nTrait : {trait}\nVoix : {voice}\nDésir : {desire}\nSecret : {secret}\nEn combat : {combat}"
  }
}
```

Trois points de conception.

**Les emplacements peuvent porter une visibilité.** Le secret d'un PNJ généré naît en `gm`. Il ne s'affichera jamais dans un partage joueur, et le liseré terracotta le signale dès le tirage. C'est gratuit : le mécanisme de visibilité existe déjà partout.

**Un emplacement peut interroger le ruleset plutôt qu'une table.** `{ kind: "rule_query", entry_type: "species" }` liste les espèces du ruleset actif. Une variante maison qui ajoute une espèce l'obtient dans le générateur sans qu'on touche au générateur.

**Le résultat est promouvable en entité.** C'est le point qui transforme un gadget en outil : « Générer un PNJ » puis « Créer la fiche » produit une entité avec un bloc `description`, un bloc `personality` pré-rempli, le secret en visibilité MJ, et les références déjà liées.

Ce motif de **promotion** apparaît maintenant pour la troisième fois — entrée de chronologie, objet d'inventaire, résultat de générateur. Il doit être écrit **une seule fois**, comme mécanisme générique, et réutilisé. C'était déjà noté comme question ouverte ; c'est maintenant tranché.

---

## 4. Le générateur de rencontres

### 4.1 Le budget de difficulté est de la donnée de ruleset, pas du code

C'est la décision structurante de cet outil.

Les seuils d'expérience par niveau et par palier de difficulté **diffèrent entre les deux SRD** : la version 2014 emploie quatre paliers avec un multiplicateur selon le nombre de créatures, la 2024 a simplifié en budgets par personnage sans multiplicateur. Coder l'un des deux en dur rendrait l'autre impossible, et interdirait toute variante maison.

Donc : une entrée de ruleset, de type `encounter_budget`.

```json
{
  "entry_key": "encounter_budget",
  "entry_type": "rule",
  "blocks": [{
    "block_type": "custom_table",
    "data": {
      "bands": ["trivial", "low", "moderate", "high", "deadly"],
      "columns": ["level", "trivial", "low", "moderate", "high", "deadly"],
      "rows": [ { "level": 1, "trivial": 25, "low": 50, "moderate": 75, "high": 100, "deadly": 150 } ],
      "multiplier_by_count": null
    }
  }]
}
```

Le moteur expose alors :

```ts
encounterBudget(partyLevels: number[], band: Band, ruleset): number
encounterCost(participants: { cr: number; count: number }[], ruleset): number
```

Deux fonctions **pures**, dans `src/core/rules/`. Testables par cas dorés tirés du SRD, sans base ni réseau. Le générateur aléatoire n'est alors qu'un solveur : tirer des créatures jusqu'à remplir le budget, sous contraintes de type et d'environnement.

### 4.2 La barre de budget

La référence affiche une barre qui se remplit et se colore selon le palier atteint. C'est la bonne interface : **le MJ voit la difficulté bouger pendant qu'il compose**, plutôt que d'apprendre après coup qu'il a construit un massacre. À reprendre tel quel.

### 4.3 Composition

Une rencontre composée devient un bloc `encounter` sur une entité — typiquement un lieu ou une quête. Elle est donc partageable, versionnée, caviardable, et retrouvable par la recherche, comme le reste. Pas de silo séparé.

---

## 5. Le suivi d'initiative

### 5.1 Pourquoi ce n'est pas de l'état d'entité

Trois gobelins dans un combat ont chacun leurs points de vie. Ils ne méritent pas trois fiches de wiki, et n'en auront jamais. Il faut donc des **instances de combat**, distinctes des entités.

```sql
create table combats (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  session_id  uuid references sessions(id) on delete set null,
  name        text,
  round       int not null default 0,
  turn_index  int not null default 0,
  status      text not null default 'draft'
                check (status in ('draft','running','ended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table combat_participants (
  id           uuid primary key default gen_random_uuid(),
  combat_id    uuid not null references combats(id) on delete cascade,
  source_kind  text not null check (source_kind in ('entity','statblock','custom')),
  entity_id    uuid references entities(id) on delete set null,  -- un PJ, un PNJ nommé
  rule_key     text,                                             -- une créature du bestiaire
  label        text not null,                                    -- « Gobelin 2 »
  initiative   int,
  ac           int,
  hp_max       int,
  hp_current   int,
  temp_hp      int not null default 0,
  conditions   jsonb not null default '[]'::jsonb,
  concentration jsonb,
  is_ally      boolean not null default false,
  display_order numeric not null default 1000,
  created_at   timestamptz not null default now()
);

create index combat_participants_idx on combat_participants (combat_id, display_order);
```

**Trois provenances, et il faut les trois** — exactement comme pour l'inventaire : une entité du monde (un PJ, un PNJ qui compte), une entrée de bestiaire (un gobelin quelconque), ou une saisie libre (le piège qui agit à l'initiative 20).

### 5.2 Les points de vie des personnages joueurs

Cas particulier à ne pas rater : quand un participant est un PJ, **ses points de vie sont ceux de `entity_runtime_state`**, pas une copie locale. Sinon le combat se termine et le personnage retrouve magiquement ses points de vie.

Règle : `hp_current` sur le participant est un cache d'affichage ; l'écriture va vers l'état de jeu quand `source_kind = 'entity'`.

### 5.3 L'annulation

La référence propose « Annuler la dernière action, Ctrl+Z ». On l'obtient sans rien construire : **chaque modification de combat écrit un `session_event`**, le journal est en ajout seul, annuler consiste à appliquer l'événement inverse.

C'était l'intérêt de ce journal depuis le début. C'est ici qu'il se paie.

### 5.4 Les jets d'initiative

Lancés par le serveur, journalisés dans `dice_rolls`, avec la graine de la campagne. Jamais par un modèle. Le bouton « Lancer toutes les initiatives » fait un appel, pas vingt.

---

## 6. Ce que le MJ IA en fait

**Ces quatre outils ne sont pas réécrits pour le mode solo. Ils sont exposés comme outils au modèle.**

| Le modèle veut | Il appelle | Il reçoit |
|---|---|---|
| une rumeur de taverne | `roll_table('rumeurs_valdoria')` | un texte et ses références |
| un PNJ de passage | `run_generator('pnj', { species: 'human' })` | un objet structuré, secret compris |
| un combat équilibré | `build_encounter({ band: 'moderate' })` | une liste de créatures dans le budget |
| l'ordre du tour | `start_combat(participants)` | les initiatives lancées côté serveur |

Trois conséquences, toutes bonnes :

**C'est moins cher qu'inventer.** Un tirage de table coûte une requête SQL. Faire inventer une rumeur à un modèle coûte des tokens à chaque fois, et produit des rumeurs qui ne parlent de rien de connu.

**C'est cohérent avec le monde.** La table « rumeurs de Valdoria » a été écrite par le MJ, elle renvoie vers de vraies fiches. Un modèle qui invente produit un moulin qui n'existe pas.

**Et surtout : les tables personnalisées deviennent le moyen de piloter l'IA sans écrire de prompt.** Un MJ qui veut que son monde solo ait une certaine saveur n'a pas à négocier avec un modèle : il écrit ses tables, et le MJ IA y puise. C'est la forme de contrôle la plus directe qu'on puisse lui donner, et elle ne demande aucune compétence technique.

C'est la troisième application du principe **« l'IA narre, le code arbitre »** — après les dés et la résolution des règles. À chaque fois, la même logique : ce qui peut être déterministe le devient, et le modèle se concentre sur ce que lui seul sait faire.

---

## 7. Avertissement juridique — les illustrations

Une capture de référence affiche, sous l'image d'une créature : *« © Wizards of the Coast — Fan Content Policy »*.

**Ce chemin vous est fermé.** La politique de contenu de fan interdit l'usage commercial, et le projet a une intention commerciale déclarée.

La distinction à garder nette :

| Contenu | Statut |
|---|---|
| Le **texte** du SRD 5.1 et 5.2 — statistiques, descriptions, règles | CC-BY-4.0, usage commercial autorisé avec l'attribution exacte |
| Les **illustrations** de créatures, de personnages, de couvertures | **Non couvertes.** Tous droits réservés |

Options praticables : illustrations originales, banques d'images sous licence permissive, images générées, ou aucune illustration avec une iconographie par type de créature. La dernière option est parfaitement acceptable et coûte zéro — un bestiaire sans images reste utilisable.

À trancher avant toute ouverture publique, pas après. Ce sujet rejoint la section 34 du PDD.

---

## 8. Placement dans la feuille de route

| Quoi | Version | Dépend de |
|---|---|---|
| `source_raw` sur `ruleset_entries` | **maintenant** | rien |
| Blocs `random_table`, tirage, références et tirages en cascade | V2 | rien |
| Mécanisme générique de promotion en entité | V2 | à écrire une fois pour trois usages |
| Blocs `generator`, générateurs fournis (PNJ, noms, taverne, échoppe) | V2 | tables |
| `encounter_budget` en ruleset, moteur de budget, générateur de rencontres | V2 | bloc `statblock` (V1) |
| `combats` et `combat_participants`, suivi d'initiative | V2 | `entity_runtime_state` (déjà là) |
| Exposition des quatre outils au MJ IA | V3 | le contrat d'outils du §29 du PDD |

**Aucune de ces tables n'entre dans les migrations de la Phase 0.** Elles ne changent rien en amont : elles seront créées quand on les implémentera, par des migrations ordinaires. Seul `source_raw` mérite d'être ajouté tout de suite, parce que son absence coûterait un réimport.

---

## 9. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Les tables sont-elles partageables entre utilisateurs ? | pas en V2 ; le champ d'attribution est déjà là pour le jour où |
| Un générateur peut-il appeler un modèle plutôt qu'une table ? | possible, mais alors marqué comme tel et facturé au quota. Le tirage reste le défaut |
| Le suivi d'initiative est-il visible des joueurs en direct ? | V3, avec le temps réel. En V2, écran de MJ uniquement |
| Combien de tables et de générateurs fournis au départ ? | cinq générateurs, quinze tables. Assez pour que l'outil serve dès le premier jour, assez peu pour rester maintenable |
| Les créatures d'un combat consomment-elles des ressources ? | non en V2 ; le suivi se limite aux points de vie, conditions et concentration |
