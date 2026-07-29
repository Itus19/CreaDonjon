# Spécification — Liens du wiki et modèle de personnage

**Version :** 0.1 — 29 juillet 2026
**Statut :** Conception arrêtée. Partie A à implémenter en V0, partie B en V1 (tables créées en Phase 0)
**Amende :** `Phase0_Schema_Technique_v0_4.md` §6, §7, §18 · `Spec_Couche_Regles_v0_1.md`

---

## 0. Ce que ce document comble

Audit des documents existants sur les deux briques que le mode solo suppose acquises.

| Brique | État avant ce document | Manque |
|---|---|---|
| Wiki — structure, visibilité, historique, recherche, découvertes | complet | — |
| Wiki — **encodage des liens dans le texte** | absent | bloquant, change le schéma des segments |
| Wiki — **mentions et rétroliens** | absent | les règles avaient un graphe, le wiki non |
| Wiki — modèles de fiche, images attachées, hiérarchie des lieux | absent | non bloquant, mais bon marché |
| Règles — consultation, fiches, renvois, surcharge, formules | complet | — |
| Règles — **choix, progression, empilement des modificateurs** | absent | bloquant pour la création de personnage (V1) |
| Règles — prérequis, effets actifs | absent | forme à figer maintenant, usage en V2 |

---

# Partie A — Le wiki

## A1. Encodage des liens dans le texte narratif

### Le problème

La v0.3 définit un segment ainsi :

```json
{ "id": "s1", "text": "Le tavernier de L'Ancre Rouillée semble jovial.", "visibility": {...} }
```

Rien ne dit comment « L'Ancre Rouillée » devient un lien vers sa fiche. Trois options se présentent, et le choix conditionne le rendu, les rétroliens, le renommage et la suppression.

| Option | Principe | Verdict |
|---|---|---|
| **A. Balisage dans le texte** | `[[ent_9b1c\|L'Ancre Rouillée]]` | Il faut parser à chaque affichage, et renommer devient une réécriture de chaîne. Fragile |
| **B. Décalages** | tableau `{start, end, targetId}` à côté du texte | Chaque édition du texte invalide tous les décalages. Source de bugs inépuisable |
| **C. Contenu en nœuds** | le segment porte une petite liste de nœuds typés | **Retenue** |

### Le modèle retenu

```json
{
  "id": "s1",
  "visibility": { "level": "public", "scopeId": null },
  "content": [
    { "t": "text", "v": "Le tavernier de " },
    { "t": "ref", "kind": "entity", "id": "ent_9b1c", "label": "L'Ancre Rouillée" },
    { "t": "text", "v": " semble jovial. " },
    { "t": "em", "v": "Trop jovial." },
    { "t": "ref", "kind": "rule", "key": "persuasion", "label": "Persuasion" }
  ]
}
```

Types de nœuds, volontairement peu nombreux : `text`, `em`, `strong`, `code`, `ref`.

Cibles possibles d'un `ref` : `entity` (par identifiant), `rule` (par clé, pour survivre à la surcharge), `asset`.

**Pourquoi c'est le bon choix :**

- Aucun décalage à maintenir. Éditer un nœud de texte ne touche pas les autres.
- Aucun parsing à l'affichage. On rend une liste, c'est tout.
- L'extraction des mentions (§A2) est triviale : on filtre les nœuds `ref`.
- C'est ce que font les éditeurs de texte riche modernes. L'éditeur produira cette structure nativement, sans couche de conversion.

**Ce que ça change dans la v0.3 :** la clé `text` d'un segment devient `content`, une liste. Cinq minutes aujourd'hui, une migration de données pénible dans six mois.

### Renommage et suppression

**Renommage.** Le `label` stocké est ce que l'auteur a écrit — il a pu écrire « le tavernier » en visant Bram, volontairement. On ne réécrit **jamais** le texte automatiquement. On propose une action groupée « mettre à jour les libellés » qui liste les écarts et laisse choisir.

**Suppression.** Une fiche supprimée laisse ses `ref` en place. Ils se résolvent sur rien et s'affichent comme liens brisés, avec une vue de maintenance qui les recense. Ne jamais retirer le nœud silencieusement : un lien brisé visible est un problème qu'on répare, un lien disparu est une information perdue.

## A2. Mentions et rétroliens

Les règles ont reçu `ruleset_entry_refs`. Le wiki mérite le même traitement, et pour la même raison : un graphe maintenu à la main diverge.

```sql
create table entity_mentions (
  id               uuid primary key default gen_random_uuid(),
  world_id         uuid not null references worlds(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  source_path      text not null,   -- 'narrative.s1' | 'block.<uuid>.description'
  target_kind      text not null check (target_kind in ('entity','rule','asset')),
  target_entity_id uuid references entities(id) on delete set null,
  target_rule_key  text,
  origin           text not null check (origin in ('link','alias_detected')),

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_at timestamptz not null default now()
);

create index mentions_target_idx on entity_mentions (target_entity_id);
create index mentions_source_idx on entity_mentions (source_entity_id);
create index mentions_rule_idx   on entity_mentions (target_rule_key);
```

Recalculé à chaque écriture d'entité : on remplace toutes les lignes de cette source. Extraction dans `src/core/linker/mentions.ts`, fonction pure.

### Le piège à ne pas rater

**Une mention hérite de la visibilité du segment dont elle provient.**

Sans cette colonne, le panneau « mentionné dans » de la fiche d'un PNJ affiche « L'assassinat du duc » à un joueur qui n'a jamais dû entendre parler de ce complot. Le rétrolien devient un canal de fuite parfaitement invisible pendant les tests, parce que la fiche cible, elle, est bien filtrée.

C'est exactement le même piège que sur les chunks du RAG (§17 du schéma). Même cause, même parade.

### Mentions et relations : deux choses distinctes

| | `relations` | `entity_mentions` |
|---|---|---|
| Nature | sémantique, voulue | mécanique, dérivée |
| Exemple | Bram `works_at` L'Ancre | le mot « L'Ancre » apparaît dans le paragraphe 3 |
| Saisie | par l'auteur | jamais |
| Usage | graphe de connaissances, simulation, IA | navigation, analyse d'impact |

Ne pas les fusionner. La tentation existe — elles se ressemblent — mais mélanger du voulu et du dérivé rend les deux inutilisables.

## A3. Modèles de fiche

Manque bon marché à combler. Le PDD §6 prévoit « choisir un modèle/bloc » à la création rapide ; rien ne le portait.

```sql
create table entity_templates (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid references worlds(id) on delete cascade,  -- null = modèle fourni
  name        text not null,
  entity_kind text not null,
  icon        text,
  blocks      jsonb not null default '[]'::jsonb,
  -- [{ block_type, visibility_level, display_order, data_defaults }]
  is_builtin  boolean not null default false,
  created_at  timestamptz not null default now()
);
```

Créer un PNJ attache alors d'un clic un bloc `character` en `public` et un bloc `notes` en `gm`. Sans ça, chaque fiche demande six clics de configuration et l'utilisateur cesse d'en créer.

Modèles fournis à prévoir : PNJ, créature, lieu, faction, objet, quête, événement.

## A4. Images attachées

`assets` existait, mais rien ne le reliait à une entité.

```sql
create table entity_assets (
  entity_id     uuid not null references entities(id) on delete cascade,
  asset_id      uuid not null references assets(id) on delete cascade,
  role          text not null check (role in ('portrait','banner','gallery','map')),
  display_order numeric not null default 1000,
  primary key (entity_id, asset_id)
);
```

## A5. Hiérarchie des lieux

Un continent contient des royaumes, qui contiennent des villes, qui contiennent des quartiers. Deux tentations à éviter : ajouter une colonne `parent_id` (elle doublonne le graphe et divergera), ou tout laisser en relations libres (impossible de faire un fil d'Ariane).

**Solution retenue :** la relation `part_of` existante fait autorité, et la navigation se construit par requête récursive avec une profondeur bornée.

```sql
create or replace function app.entity_path(p_entity uuid)
returns table (id uuid, name text, depth int)
language sql stable as $$
  with recursive up as (
    select e.id, e.name, 0 as depth
      from entities e where e.id = p_entity
    union all
    select p.id, p.name, up.depth + 1
      from up
      join relations r on r.source_entity_id = up.id and r.relation_type = 'part_of'
      join entities p on p.id = r.target_entity_id
     where up.depth < 10
  )
  select * from up order by depth desc;
$$;
```

Et un déclencheur interdisant les cycles sur `part_of` uniquement — sans lui, une ville qui contient son continent fait tourner la requête jusqu'à la limite à chaque affichage de fil d'Ariane.

---

# Partie B — Le personnage

C'est le vrai trou. Tout ce qui suit est nécessaire pour qu'un utilisateur crée un personnage, ce qui est la fonction la plus attendue de la V1.

## B1. Le principe fondateur

> **Un personnage stocke ses choix, jamais ses résultats.**

Le personnage enregistre : espèce, classe(s), niveau, historique, et les réponses aux questions que les règles lui ont posées. La classe d'armure, le bonus de maîtrise, les modificateurs, les sorts disponibles — tout cela est **recalculé**, jamais stocké.

Conséquences, toutes bonnes :

- Changer une règle dans sa variante met à jour tous les personnages concernés. C'est ce qu'on veut.
- Une valeur stockée diverge dès qu'un objet change de main ; une valeur dérivée ne peut pas.
- Le débogage devient possible : la fiche affiche *pourquoi* la CA vaut 17.

Et cela réconcilie avec les révisions mécaniques immuables : `build` est la source, `entity_mechanical_revisions.mechanical_data` conserve la fiche **dérivée** à un instant donné, pour qu'une vieille sauvegarde reste cohérente. Les deux coexistent sans se contredire.

## B2. Le modèle de choix

Une classe ne dit pas seulement ce qu'elle donne : elle pose des questions. Rien dans les documents ne portait cette notion.

```json
"choices": [
  {
    "id": "c1",
    "prompt": "Choisissez deux compétences",
    "count": 2,
    "from": { "type": "list",
              "options": ["athletics","acrobatics","history","insight","intimidation","perception","survival"] },
    "grants": { "kind": "proficiency", "category": "skill" }
  },
  {
    "id": "c2",
    "prompt": "Choisissez un style de combat",
    "count": 1,
    "from": { "type": "query", "entry_type": "feature", "tag": "fighting_style" }
  }
]
```

Deux formes de `from`, et deux seulement : une liste explicite, ou une requête sur le ruleset. La seconde est ce qui permet à une variante d'**ajouter** un style de combat sans toucher à la classe qui l'offre. Sans elle, chaque ajout maison exige de surcharger la classe entière.

Le personnage stocke les réponses :

```json
"build": {
  "species": "dwarf",
  "background": "soldier",
  "classes": [ { "key": "fighter", "level": 5, "subclass": "champion" } ],
  "abilities": { "method": "standard_array",
                 "assigned": { "str": 15, "dex": 13, "con": 14, "int": 8, "wis": 12, "cha": 10 } },
  "choices": {
    "fighter.l1.c1": ["athletics", "survival"],
    "fighter.l1.c2": ["defense"],
    "fighter.l4.asi": { "kind": "ability", "increase": { "str": 2 } }
  }
}
```

Les clés de `choices` sont **qualifiées par leur origine** (`fighter.l1.c1`). Sans ça, deux classes proposant chacune un `c1` en multiclassage écrasent mutuellement leur réponse.

## B3. Progression par niveau

```json
"progression": [
  { "level": 1, "grants": [ { "feature": "second_wind" }, { "choice": "c1" }, { "choice": "c2" } ] },
  { "level": 2, "grants": [ { "feature": "action_surge" } ] },
  { "level": 3, "grants": [ { "choice": "subclass" } ] },
  { "level": 4, "grants": [ { "choice": "asi" } ] },
  { "level": 5, "grants": [ { "feature": "extra_attack" } ] }
]
```

Le bonus de maîtrise n'est pas une table mais une formule, exprimable dans l'AST existant : `2 + floor((niveau - 1) / 4)`. Une variante qui change la courbe change une formule, pas vingt lignes de table.

## B4. Empilement des modificateurs — la fabrique à bugs

**C'est la première cause de bugs de tout créateur de personnage jamais écrit.** Le traiter explicitement, ou le subir.

Chaque modificateur déclare sa cible, son opération, sa source et sa couche :

```json
{
  "target": "ac",
  "op": "add",
  "value": 2,
  "source": "item:ent_4c8a",
  "layer": 6,
  "stacking": "unique"
}
```

Opérations : `add`, `set`, `min`, `max`, `advantage`, `disadvantage`, `proficiency`, `expertise`.

Couches, appliquées dans cet ordre :

| Couche | Contenu |
|---|---|
| 1 | valeurs de caractéristiques choisies |
| 2 | espèce |
| 3 | aptitudes de classe et de niveau |
| 4 | historique |
| 5 | augmentations de caractéristique et dons |
| 6 | objets équipés (permanent) |
| 7 | effets actifs (sorts, conditions, temporaire) |

Règles de résolution, dans cet ordre :

1. Regrouper par cible.
2. Appliquer couche par couche, de 1 à 7.
3. À l'intérieur d'une couche, appliquer la règle d'empilement : `stack` (tout s'additionne), `highest` (seul le plus fort compte), `unique` (une seule source du même type).
4. `set` écrase tout ce qui précède sur cette cible.
5. `min` et `max` s'appliquent en dernier, comme bornes.
6. `advantage` et `disadvantage` s'annulent mutuellement et ne s'empilent jamais.

**Chaque valeur dérivée conserve sa provenance.** La fiche n'affiche pas « CA 17 » mais :

```
CA 17 = 14 (cotte de mailles) + 2 (bouclier) + 1 (anneau de protection)
```

Même philosophie que la trace des formules (§20.3 du schéma technique). Pour un compagnon de règles, l'explication a autant de valeur que le nombre — c'est ce qui permet à l'utilisateur de repérer que le moteur se trompe, et donc de faire confiance au reste.

## B5. Prérequis et légalité

```json
"prerequisites": [
  { "kind": "ability", "ability": "str", "min": 13 },
  { "kind": "has_feature", "key": "extra_attack" },
  { "kind": "level", "min": 4 }
]
```

`checkRequirements(entityId, entryKey, ruleset)` retourne la liste des prérequis non satisfaits.

**Décision produit : avertir, ne pas interdire.** Un personnage illégal reste enregistrable, avec un bandeau explicite. Les tables de jeu réelles dérogent en permanence, et un outil qui bloque devient un outil qu'on contourne en repassant au papier. La validation stricte n'a de sens que là où l'utilisateur l'a demandée.

## B6. Effets actifs

Forme à figer maintenant, usage en V2 avec le combat. `characterSheet()` doit pouvoir les accepter dès sa signature, sinon il faudra la refaire.

```sql
create table entity_active_effects (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  source_kind text not null check (source_kind in ('spell','condition','item','custom')),
  source_key  text,
  label       text not null,
  modifiers   jsonb not null default '[]'::jsonb,
  duration    jsonb not null default '{}'::jsonb,   -- { type: 'rounds'|'minutes'|'until_rest'|'permanent', value }
  applied_at_event uuid references session_events(id),
  expires_at_event uuid references session_events(id),
  created_at  timestamptz not null default now()
);

create index active_effects_entity_idx on entity_active_effects (entity_id, campaign_id);
```

La durée est ancrée sur des **événements de session**, pas sur des horodatages. « Trois rounds » n'a aucun sens en temps réel, et une partie qui reprend trois semaines plus tard doit retrouver ses effets intacts.

## B7. La fiche dérivée

Contrat à écrire dans `src/core/rules/sheet.ts` :

```ts
function characterSheet(
  build: CharacterBuild,
  ruleset: ResolvedRuleset,
  equipment: EquippedItem[],
  activeEffects: ActiveEffect[]
): DerivedSheet;

interface DerivedSheet {
  abilities: Record<Ability, { score: number; mod: number; sources: Source[] }>;
  proficiencyBonus: number;
  ac: { value: number; sources: Source[] };
  savingThrows: Record<Ability, { mod: number; proficient: boolean; sources: Source[] }>;
  skills: Record<string, { mod: number; proficiency: 'none'|'proficient'|'expertise'; sources: Source[] }>;
  hitPoints: { max: number; hitDice: string; sources: Source[] };
  speed: { value: number; sources: Source[] };
  features: ResolvedFeature[];
  spellcasting?: { ability: Ability; saveDc: number; attackBonus: number; slots: Record<number, number> };
  warnings: Warning[];          // prérequis non satisfaits, choix non faits
}
```

Fonction **pure**. Ni base, ni réseau. C'est ce qui la rend testable par cas dorés, et c'est indispensable : c'est la fonction la plus dense du projet.

Cas dorés minimaux à figer, tirés du SRD :

| Cas | Vérifie |
|---|---|
| Guerrier nain niveau 1, cotte de mailles + bouclier | couches 1 à 6, empilement de CA |
| Roublard niveau 5 avec expertise | maîtrise, expertise, bonus de maîtrise |
| Magicien niveau 3 | DD de sort, emplacements, caractéristique d'incantation |
| Guerrier 5 / roublard 2 | multiclassage, clés de choix qualifiées |
| Personnage sous *bénédiction* et *entravé* | couche 7, avantage et désavantage qui s'annulent |
| Personnage à prérequis non satisfait | avertissement présent, enregistrement autorisé |

## B8. Le parcours de création

```
1. Espèce            → applique la couche 2, pose ses choix éventuels
2. Classe niveau 1   → couche 3, pose ses choix
3. Caractéristiques  → couche 1 (tableau standard, achat de points, ou tirage)
4. Historique        → couche 4
5. Équipement de départ
6. Choix restants    → la liste des `choices` non répondus, affichée d'un bloc
7. Aperçu            → fiche dérivée avec provenance, avertissements visibles
```

Point de conception : **l'étape 6 est une liste, pas un tunnel.** Les créateurs de personnage qui imposent un ordre strict sont pénibles dès qu'on veut revenir sur un choix. La liste des questions ouvertes reste visible et modifiable jusqu'au bout, et la fiche se recalcule à chaque changement.

L'assistance IA vient en surcouche, jamais à la place : « décris ton personnage en une phrase » propose un pré-remplissage de tous les choix, que l'utilisateur voit et modifie. Le modèle propose, il ne valide pas.

---

# Partie C — SQL à intégrer et impact

## C1. Migrations

| Migration | Ajout |
|---|---|
| 003 `entities.sql` | `entity_mentions`, `entity_templates`, déclencheur anti-cycle sur `part_of`, fonction `app.entity_path` |
| 004 `rules.sql` | rien de nouveau — `choices`, `progression`, `prerequisites` vivent dans `structured_data` |
| 007 `sessions.sql` | `entity_active_effects` |
| 011 `storage.sql` | `entity_assets` |
| 013 `seed_dev.sql` | modèles fournis, un personnage complet de démonstration |

## C2. Changement de forme des segments

Le passage de `text` à `content` dans `narrative_content` (§A1) touche : le schéma Zod, l'éditeur, le rendu, l'extraction des chunks RAG, et la résolution de visibilité.

Aucun de ces éléments n'est encore écrit. **Coût aujourd'hui : réécrire un schéma Zod de quinze lignes.** Coût dans six mois : une migration de données sur du texte narratif, c'est-à-dire précisément le type de migration qu'on rate.

## C3. Ce qui reste hors périmètre

| Sujet | Statut |
|---|---|
| Calendriers de campagne personnalisés | V2 — les dates fictives sont un sujet en soi, ne pas le traiter en passant |
| Import/export de mondes | V2, mais la forme JSON est déjà celle des tables |
| Notes privées d'un joueur sur la fiche d'autrui | couvert partiellement par `visibility='user'` ; à revoir si le besoin se confirme |
| Commentaires et révisions collaboratives | V4, conforme au PDD §16 |
| Déclencheurs (« quand X, alors Y ») | toujours ouvert — voir §8 de `Spec_Couche_Regles_v0_1.md` |

---

# Verdict

Avec ce document, le wiki et les règles sont **complets pour la V1** : on peut créer des fiches, les relier dans les deux sens, consulter et personnaliser des règles, et créer un personnage jouable.

Reste un seul sujet vraiment difficile et volontairement repoussé : **les déclencheurs**. Un modèle de déclencheurs mal conçu contamine l'ensemble du moteur, et on ne peut le concevoir correctement qu'avec des cas réels en main. À traiter après la V1, jamais avant.
