# Phase 0 — Schéma technique de données

**Version :** 0.6 (consolidée)
**Statut :** Prêt à implémenter
**Cible :** Supabase (PostgreSQL 15+, pgvector, RLS)
**Dernière mise à jour :** 29 juillet 2026

**Documents complémentaires :**
`Project_Design_Document_v0_2.md` · `Spec_Couche_Regles_v0_1.md` · `Spec_Blocs_de_Regles_v0_1.md` · `Spec_Wiki_Liens_et_Personnages_v0_1.md` · `Spec_Blocs_de_Wiki_v0_1.md` · `CLAUDE.md` · `Backlog_Phase0_V0.md`

---

## 0. Comment lire ce document

Ce document traduit les décisions du PDD en tables concrètes et en SQL exécutable. Il est conçu pour être donné à Claude Code comme première tâche d'implémentation.

Rien ici ne concerne l'interface. Aucune page, aucun composant ne doit être écrit avant que ces tables existent, soient couvertes par des politiques RLS et validées par les tests d'acceptation de la section 24.

### 0.1 Historique

| Version | Changements |
|---|---|
| 0.1 | Première version : tables descriptives |
| 0.2 | Visibilité en deux colonnes ; identifiants en anglais ; SQL réel ; 11 tables manquantes ajoutées ; correction de la règle « l'IA voit tout » |
| 0.3 | Graphe de renvois entre règles ; surcharge des règles ; versions figées ; résumé IA |
| 0.4 | Segments narratifs en nœuds typés ; mentions du wiki ; modèles de fiche ; images attachées ; effets actifs |
| 0.5 | Les fiches de règles deviennent des conteneurs de blocs typés ; surcharge au niveau du bloc |
| 0.6 | État de jeu séparé ; vocabulaire fermé des relations ; calendrier du monde |

### 0.2 Les décisions structurantes, en un coup d'œil

| Décision | Raison |
|---|---|
| Visibilité = `visibility_level` + `visibility_scope_id`, jamais une chaîne encodée | Indexable, jointable, vérifiable par contrainte |
| Identifiants techniques en anglais, libellés français dans l'interface | Les données SRD sont en anglais ; une traduction future coûte zéro migration |
| Toute donnée mécanique modifiable est versionnée par révision immuable | Une vieille sauvegarde ne change pas quand on modifie une règle |
| Une fiche — de wiki comme de règle — est un conteneur de blocs typés | Modulaire et standardisé ; on ajoute des types, jamais des tables |
| Les valeurs dérivées ne sont jamais stockées | Une valeur stockée diverge de sa cause ; une valeur dérivée ne peut pas |
| Les formules sont des arbres syntaxiques, jamais du texte re-parsé | Aucun `eval()`, exécution bornée, résultats reproductibles |
| Le journal d'événements est en ajout seul | C'est lui, la sauvegarde |

---

## 1. Conventions générales

1. **Clés primaires** : `uuid` généré par `gen_random_uuid()`. Jamais de `serial` exposé publiquement.
2. **Identifiants techniques en anglais**, `snake_case`. Les libellés français vivent dans `src/i18n/fr.ts`, jamais en base.
3. **`text` + `CHECK`** plutôt que `ENUM` Postgres. Ajouter une valeur à un enum est irréversible et bloquant en transaction ; un `CHECK` se modifie par migration ordinaire.
4. **Horodatage systématique** : `created_at`, `updated_at` (par trigger), et `deleted_at` pour la suppression logique de tout ce qui est éditable.
5. **`on delete cascade`** depuis `worlds` vers tout ce qui appartient au monde.
6. **RLS activée sur toutes les tables sans exception.** Une table sans RLS dans Supabase est lisible par n'importe quel porteur de la clé anonyme.
7. **Concurrence optimiste** : les tables éditables portent `version int`. L'API refuse une écriture dont la version ne correspond pas (`409 Conflict`).
8. **JSONB validé côté application** par des schémas Zod, source de vérité de la forme des `data`.

---

## 2. Extensions et fonctions utilitaires

```sql
-- migration 001_extensions.sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists vector;

create schema if not exists app;

create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

> Appliquer ce trigger sur **chaque** table possédant `updated_at`. Une date de modification fausse rend l'invalidation du cache d'embeddings et l'historique inutilisables.

---

## 3. Comptes, mondes, appartenance

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  locale       text not null default 'fr',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table worlds (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null,
  owner_id            uuid not null references auth.users(id),
  default_ruleset_id  uuid,                                -- FK en migration 004
  calendar            jsonb not null default '{}'::jsonb,  -- mois, jours, ères ; un seul par monde en V1
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (owner_id, slug)
);

create table world_members (
  world_id  uuid not null references worlds(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner','editor','viewer')),
  added_at  timestamptz not null default now(),
  primary key (world_id, user_id)
);
```

`profiles` est créé par trigger sur `auth.users`. Ne jamais lire `auth.users` directement depuis l'application.

`world_members` prépare le multi-MJ sans le construire. Coût aujourd'hui : une table. Coût plus tard : réécriture de toutes les politiques RLS.

---

## 4. Visibilité — le modèle

Traité en premier parce que six tables en dépendent.

### 4.1 Le modèle

```sql
-- Fragment réutilisé dans blocks, relations, assets, chunks, entity_mentions
visibility_level    text not null default 'public'
  check (visibility_level in ('public','players','gm','campaign','user','private')),
visibility_scope_id uuid,

constraint <table>_visibility_scope_ck check (
  (visibility_level in ('campaign','user') and visibility_scope_id is not null)
  or
  (visibility_level not in ('campaign','user') and visibility_scope_id is null)
)
```

| Niveau | Qui voit | `visibility_scope_id` |
|---|---|---|
| `public` | tout le monde, y compris un lien de partage anonyme | `null` |
| `players` | tout membre d'une campagne du monde | `null` |
| `gm` | MJ et propriétaires/éditeurs du monde | `null` |
| `campaign` | membres de cette campagne précise | `campaigns.id` |
| `user` | cet utilisateur précis | `auth.users.id` |
| `private` | l'auteur seul | `null` (implicitement `created_by`) |

Une chaîne encodée du type `campagne:<id>` serait ni indexable, ni vérifiable par clé étrangère, et obligerait tout le code à faire du `split(':')`.

### 4.2 Contrat de résolution

Fonction **pure**, implémentée une seule fois dans `src/core/visibility/`, testée par une table de vérité exhaustive (6 niveaux × 5 profils de lecteur, minimum 30 cas).

```ts
type Viewer =
  | { kind: 'anonymous' }
  | { kind: 'user'; userId: string; worldRole: 'owner'|'editor'|'viewer'|null;
      campaignRoles: Record<string, 'gm'|'player'> };

function canSee(v: { level: VisibilityLevel; scopeId: string|null; createdBy: string|null },
                viewer: Viewer, ctx: { campaignId?: string }): boolean;
```

**Règle absolue :** la résolution s'effectue côté serveur avant l'envoi au client. Le texte caché ne transite jamais vers un navigateur qui n'a pas le droit de le voir, même masqué par CSS, même dans une propriété inutilisée d'un objet JSON. La RLS Postgres est le **dernier filet**, pas la seule défense.

---

## 5. `entities` — le cœur du modèle unifié

```sql
create table entities (
  id            uuid primary key default gen_random_uuid(),
  world_id      uuid not null references worlds(id) on delete cascade,
  slug          text not null,
  name          text not null,
  aliases       text[] not null default '{}',
  summary       text not null default '',
  narrative_content jsonb not null default '[]'::jsonb,   -- voir §6
  tags          text[] not null default '{}',
  entity_kind   text not null default 'other',
  current_mechanical_revision_id uuid,                     -- FK en migration 006
  version       int not null default 1,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  search_fr tsvector generated always as (
    to_tsvector('french',
      coalesce(name,'') || ' ' || coalesce(summary,'') || ' ' ||
      array_to_string(aliases, ' '))
  ) stored,

  unique (world_id, slug)
);

create index entities_world_idx     on entities (world_id) where deleted_at is null;
create index entities_search_idx    on entities using gin (search_fr);
create index entities_tags_idx      on entities using gin (tags);
create index entities_aliases_idx   on entities using gin (aliases);
create index entities_name_trgm_idx on entities using gin (name gin_trgm_ops);
create index entities_kind_idx      on entities (world_id, entity_kind) where deleted_at is null;
```

**Valeurs recommandées pour `entity_kind`** : `character`, `creature`, `location`, `faction`, `item`, `event`, `quest`, `concept`, `other`.

Pas de table `characters`, `npcs`, `locations`. La distinction se fait par les blocs attachés (§7) et `entity_kind` (purement indicatif, pour filtrer et afficher).

**Le `slug`** rend l'URL stable et partageable. Unique par monde, généré depuis le nom, immuable après création.

---

## 6. Structure de `narrative_content`

Un champ de texte n'est jamais stocké comme du markdown brut dès lors qu'un caviardage ou un lien est possible.

```json
[
  { "id": "s1",
    "visibility": { "level": "public", "scopeId": null },
    "content": [
      { "t": "text", "v": "Le tavernier de " },
      { "t": "ref", "kind": "entity", "id": "ent_9b1c", "label": "L'Ancre Rouillée" },
      { "t": "text", "v": " semble jovial et accueillant. " }
    ] },
  { "id": "s2",
    "visibility": { "level": "gm", "scopeId": null },
    "content": [
      { "t": "text", "v": "En réalité, il travaille pour " },
      { "t": "ref", "kind": "entity", "id": "ent_3d7f", "label": "la Main Silencieuse" },
      { "t": "text", "v": "." }
    ] }
]
```

Types de nœuds : `text`, `em`, `strong`, `code`, `ref`. Un `ref` cible une entité (par identifiant), une règle (par clé, pour survivre à la surcharge) ou un asset.

**Le contenu est une liste de nœuds**, pas une chaîne balisée ni un texte accompagné de décalages de caractères. Aucun décalage à maintenir, aucun parsing à l'affichage, extraction des mentions triviale — et c'est nativement ce que produit un éditeur de texte riche. Justification complète en §A1 de `Spec_Wiki_Liens_et_Personnages_v0_1.md`.

**Contraintes :**
- Le `summary` n'est jamais caviardé. Si un résumé doit contenir un secret, l'information n'a rien à faire dans un résumé.
- Le `id` par segment est indispensable : sans lui, pas de diff propre entre deux révisions, ni de modification ciblée proposée par l'IA.
- Un segment supprimé laisse ses `ref` en place ailleurs ; ils deviennent des liens brisés visibles, jamais retirés en silence.

---

## 7. `blocks`

```sql
create table blocks (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references entities(id) on delete cascade,
  block_type    text not null,
  data          jsonb not null default '{}'::jsonb,
  display_order numeric not null default 1000,
  version       int not null default 1,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint blocks_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  )
);

create index blocks_entity_idx on blocks (entity_id, display_order);
create index blocks_type_idx   on blocks (block_type);
```

**`display_order` est un `numeric`.** Insérer entre le 3ᵉ et le 4ᵉ s'écrit `3.5` — une seule ligne modifiée. Avec des entiers, il faut réécrire toute la liste à chaque déplacement.

**Types de blocs.** V0 : `description`, `infobox`, `gallery`, `custom_table`. V1 : `character`, `inventory`, `spellcasting`, `resources`, `statblock`, `timeline`, `relationships`. V2 : `genealogy`, `random_table`, `quest`, `loot`, `map_pins`, `quote`, `session_log`. Le générateur de rencontres (V1-E3) n'est **pas** un bloc de wiki : refonte en outil MJ autonome (table `campaign_encounters`), décision explicite de l'utilisateur — voir `docs/BACKLOG_V1.md` §V1-E3.

Chaque type a un schéma Zod dans `src/core/schemas/blocks/<type>.ts` et une version stockée dans `data.__v`. Catalogue et spécification détaillée dans `Spec_Blocs_de_Wiki_v0_1.md`.

### 7.1 Mentions, modèles, images attachées

```sql
-- Rétroliens dérivés du contenu. Recalculés à chaque écriture, jamais saisis.
create table entity_mentions (
  id               uuid primary key default gen_random_uuid(),
  world_id         uuid not null references worlds(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  source_path      text not null,      -- 'narrative.s1' | 'block.<uuid>.description'
  target_kind      text not null check (target_kind in ('entity','rule','asset')),
  target_entity_id uuid references entities(id) on delete set null,
  target_rule_key  text,
  origin           text not null check (origin in ('link','alias_detected')),
  visibility_level text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,
  created_at       timestamptz not null default now()
);

create index mentions_target_idx on entity_mentions (target_entity_id);
create index mentions_source_idx on entity_mentions (source_entity_id);
create index mentions_rule_idx   on entity_mentions (target_rule_key);

create table entity_templates (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid references worlds(id) on delete cascade,  -- null = modèle fourni
  name        text not null,
  entity_kind text not null,
  icon        text,
  blocks      jsonb not null default '[]'::jsonb,
  is_builtin  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table entity_assets (
  entity_id     uuid not null references entities(id) on delete cascade,
  asset_id      uuid not null references assets(id) on delete cascade,
  role          text not null check (role in ('portrait','banner','gallery','map')),
  display_order numeric not null default 1000,
  primary key (entity_id, asset_id)
);
```

**Une mention hérite de la visibilité du segment dont elle provient.** Sans cette colonne, le panneau « mentionné dans » affiche à un joueur le titre d'une fiche secrète — fuite invisible pendant les tests, puisque la fiche cible, elle, est correctement filtrée. Même piège que sur les chunks du RAG (§17), même parade.

**Mentions et relations sont deux choses distinctes.** Une relation est sémantique et voulue (« Bram travaille à L'Ancre ») ; une mention est mécanique et dérivée (« le mot apparaît au paragraphe 3 »). Ne pas les fusionner.

---

## 8. `relations` — le graphe de connaissances

```sql
create table relations (
  id                uuid primary key default gen_random_uuid(),
  world_id          uuid not null references worlds(id) on delete cascade,
  source_entity_id  uuid not null references entities(id) on delete cascade,
  target_entity_id  uuid not null references entities(id) on delete cascade,
  relation_type     text not null check (relation_type in (
                      -- famille
                      'parent_of','sibling_of','married_to','adopted_by','ancestor_of',
                      -- social
                      'friend_of','rival_of','mentor_of','serves','member_of','leads',
                      -- spatial
                      'part_of','located_in','origin_of',
                      -- possession
                      'owns','created','carries',
                      -- narratif
                      'knows','loves','hates','participated_in','witnessed')),
  metadata          jsonb not null default '{}'::jsonb,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  constraint relations_no_self check (source_entity_id <> target_entity_id),
  constraint relations_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  ),
  unique (source_entity_id, target_entity_id, relation_type)
);

create index relations_source_idx on relations (source_entity_id);
create index relations_target_idx on relations (target_entity_id);
create index relations_world_idx  on relations (world_id, relation_type);
```

**Vocabulaire fermé.** Sans contrainte, chacun écrira `pere_de`, `parent` et `father_of` — et le bloc `genealogy`, qui lit ce graphe, deviendra inexploitable. Ajouter un type est une migration d'une ligne ; c'est le bon niveau de friction.

Chaque type déclare son inverse dans `src/core/relations/inverses.ts` (`parent_of` ↔ `child_of`, `owns` ↔ `owned_by`, `married_to` ↔ lui-même) : une seule ligne stockée, deux sens navigables. Stocker les deux sens en base crée un problème de synchronisation sans bénéfice.

**Une relation porte sa propre visibilité**, ce qui permet à « Bram est le fils du duc » d'être en `gm` alors que les deux fiches sont publiques. Conséquence obligatoire : **le graphe généalogique est construit côté serveur, après filtrage.** Un graphe « dessiné côté client » à partir de données complètes met la parenté secrète dans la réponse HTTP, quelle que soit la façon dont on la masque à l'écran.

**`world_id` est dupliqué ici volontairement.** Seule dénormalisation du schéma : sans elle, chaque politique RLS sur `relations` ferait une double jointure vers `entities` puis `worlds`, à chaque ligne. Un trigger vérifie que les deux entités appartiennent bien à ce monde.

### 8.1 Hiérarchie des lieux

La relation `part_of` fait autorité ; la navigation se construit par requête récursive bornée. Pas de colonne `parent_id` — elle doublonnerait le graphe et divergerait.

```sql
create or replace function app.entity_path(p_entity uuid)
returns table (id uuid, name text, depth int)
language sql stable as $$
  with recursive up as (
    select e.id, e.name, 0 as depth from entities e where e.id = p_entity
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

Un déclencheur interdit les cycles sur `part_of` uniquement : sans lui, une ville qui contient son continent fait tourner la requête jusqu'à la limite à chaque affichage de fil d'Ariane.

---

## 9. Règles

```sql
create table rulesets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  base_system        text not null check (base_system in ('dnd_srd_51','dnd_srd_52','custom')),
  parent_ruleset_id  uuid references rulesets(id),
  version            int not null default 1,
  is_official_base   boolean not null default false,
  lineage_id         uuid not null default gen_random_uuid(),  -- identité stable d'une variante
  published_at       timestamptz,                              -- non nul = figé, toute édition crée v+1
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  check (is_official_base = false or created_by is null)
);

create index rulesets_lineage_idx on rulesets (lineage_id, version desc);

create table ruleset_entries (
  id           uuid primary key default gen_random_uuid(),
  ruleset_id   uuid not null references rulesets(id) on delete cascade,
  entry_key    text not null,        -- clé canonique anglaise stable : 'fireball'
  entry_type   text not null check (entry_type in
                 ('spell','item','weapon','armor','class','subclass','feature',
                  'monster','condition','rule','background','species')),
  ai_digest    text,                 -- forme compressée pour le contexte IA, <= 120 tokens
  ai_digest_generated_at timestamptz,
  source_attribution text,           -- 'SRD 5.1' | 'SRD 5.2.1' | null
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (ruleset_id, entry_key)
);

create index ruleset_entries_type_idx on ruleset_entries (ruleset_id, entry_type);
```

### 9.1 Blocs de règles

Une fiche de règle est un conteneur de blocs typés, comme une entité du wiki. `data` est validé par un schéma Zod déterminé par `block_type` : le moteur demande un bloc et reçoit une forme garantie. **Jamais de contenu libre ici** — sans typage, `resolveAction` devient une exploration hasardeuse et le moteur cesse d'être déterministe.

```sql
create table ruleset_entry_blocks (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references ruleset_entries(id) on delete cascade,
  block_type     text not null,
  schema_version int not null default 1,
  display        jsonb not null default '{}'::jsonb,  -- { label, layout, collapsed }
  data           jsonb not null default '{}'::jsonb,
  display_order  numeric not null default 1000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (entry_id, block_type, display_order)
);

create index entry_blocks_entry_idx on ruleset_entry_blocks (entry_id, display_order);
create index entry_blocks_type_idx  on ruleset_entry_blocks (block_type);
```

Blocs V1 : `description`, `spell_casting`, `effects`, `scaling`, `class_progression`, `custom_table`. Détail complet dans `Spec_Blocs_de_Regles_v0_1.md`.

### 9.2 Traductions

```sql
create table ruleset_entry_translations (
  entry_id uuid not null references ruleset_entries(id) on delete cascade,
  locale   text not null,
  name     text not null,
  blocks   jsonb not null default '{}'::jsonb,   -- surcharges de libellés par bloc
  source   text not null check (source in ('official_srd','community','machine','user')),
  primary key (entry_id, locale)
);
```

Indispensable : les données `5e-bits` sont en anglais. Des versions françaises officielles du SRD existent sous la même licence CC-BY-4.0 (voir PDD §33).

### 9.3 Graphe entre règles

Les renvois sont pour l'essentiel **déduits** de la structure des blocs, jamais saisis à la main : un graphe maintenu manuellement diverge en trois semaines.

```sql
create table ruleset_entry_refs (
  id              uuid primary key default gen_random_uuid(),
  source_entry_id uuid not null references ruleset_entries(id) on delete cascade,
  target_key      text not null,     -- clé, pas id : stable à travers la chaîne d'héritage
  target_entry_id uuid references ruleset_entries(id) on delete set null,  -- cache de résolution
  ref_kind        text not null check (ref_kind in
                    ('uses_rule','applies_condition','damage_type','requires',
                     'replaces','see_also','part_of','grants')),
  origin          text not null check (origin in ('derived','declared')),
  path            text,              -- 'blocks.effects.e1.save.dc', pour surligner dans la fiche
  note            text,
  created_at      timestamptz not null default now(),
  unique (source_entry_id, target_key, ref_kind, coalesce(path,''))
);

create index refs_source_idx on ruleset_entry_refs (source_entry_id);
create index refs_target_idx on ruleset_entry_refs (target_key, ref_kind);
```

`target_key` plutôt que `target_entry_id` comme référence principale : si une variante surcharge `saving_throw`, le renvoi doit pointer vers la version résolue dans le ruleset courant. La clé traverse la chaîne d'héritage ; l'identifiant non.

### 9.4 Surcharge — personnalisation des règles

Une variante ne duplique pas sa base : elle stocke uniquement ce qu'elle change, bloc par bloc. Une variante maison typique tient en quinze lignes.

```sql
create table ruleset_overrides (
  id          uuid primary key default gen_random_uuid(),
  ruleset_id  uuid not null references rulesets(id) on delete cascade,
  entry_key   text not null,
  block_type  text,          -- null = l'action porte sur l'entrée entière
  action      text not null check (action in
                ('add_entry','disable_entry','replace_entry',
                 'add_block','patch_block','replace_block','remove_block')),
  payload     jsonb,
  patch       jsonb,         -- JSON Merge Patch (RFC 7386) si action = 'patch_block'
  note        text,          -- « pourquoi j'ai changé ça », affiché dans la fiche
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint overrides_block_required check (
    (action in ('add_entry','disable_entry','replace_entry') and block_type is null)
    or (action in ('add_block','patch_block','replace_block','remove_block') and block_type is not null)
  )
);

create unique index overrides_target_uniq
  on ruleset_overrides (ruleset_id, entry_key, coalesce(block_type,''));
```

L'algorithme de résolution (remontée de la chaîne, empilement des patchs, détection de cycles, profondeur maximale 8) est une fonction pure de `src/core/rules/resolve.ts`, appliquée bloc par bloc. Spécification en §3.3 de `Spec_Couche_Regles_v0_1.md`, révisée par §8 de `Spec_Blocs_de_Regles_v0_1.md`.

### 9.5 Protection des bases officielles

Le principe PDD 3.6 doit être appliqué par la base, pas seulement par convention :

```sql
create or replace function app.forbid_official_ruleset_write()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    if old.is_official_base then raise exception 'Ruleset officiel non modifiable'; end if;
    return old;
  end if;
  if old.is_official_base and new.is_official_base then
    raise exception 'Ruleset officiel non modifiable';
  end if;
  return new;
end;
$$;
```

Le même verrou s'applique à `ruleset_entries` et `ruleset_entry_blocks` dont le ruleset est officiel. Les migrations d'import SRD contournent le trigger explicitement, et c'est le seul endroit autorisé à le faire.

**Un ruleset publié est figé.** Toute modification crée une nouvelle ligne, même `lineage_id`, `version + 1`. Une campagne épingle un `rulesets.id` précis. Sans ce mécanisme, corriger une coquille dans sa variante change rétroactivement les règles de trois campagnes en cours.

---

## 10. `entity_mechanical_revisions`

```sql
create table entity_mechanical_revisions (
  id                        uuid primary key default gen_random_uuid(),
  entity_id                 uuid not null references entities(id) on delete cascade,
  revision_number           int not null,
  mechanical_data           jsonb not null,     -- snapshot immuable de la fiche dérivée
  based_on_ruleset_entry_id uuid references ruleset_entries(id),
  change_note               text,
  created_by                uuid references auth.users(id),
  created_at                timestamptz not null default now(),
  unique (entity_id, revision_number)
);

-- migration 006 : FK circulaire, posée après création des deux tables
alter table entities
  add constraint entities_current_revision_fk
  foreign key (current_mechanical_revision_id)
  references entity_mechanical_revisions(id)
  deferrable initially deferred;
```

Une entité mécanique n'est **jamais éditée en place**. Aucun `UPDATE` n'est autorisé — un trigger `before update` lève une exception. Une donnée dite immuable qui peut être modifiée n'est pas immuable.

Articulation avec le build (§B1 de la spec personnage) : le bloc `character` est la **source**, cette table conserve la fiche **dérivée** à un instant donné, pour qu'une vieille sauvegarde reste cohérente.

---

## 11. Campagnes et parties

```sql
create table campaigns (
  id         uuid primary key default gen_random_uuid(),
  world_id   uuid not null references worlds(id) on delete cascade,
  name       text not null,
  ruleset_id uuid not null references rulesets(id),   -- version précise épinglée
  gm_user_id uuid references auth.users(id),          -- null en solo, le MJ est l'IA
  mode       text not null check (mode in ('campaign','solo')),
  rng_seed   text not null default encode(gen_random_bytes(16),'hex'),
  party_entity_id uuid references entities(id) on delete set null,  -- entite `faction` du groupe de joueurs (V1-C1, migration 20260804140001)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table campaign_members (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('gm','player')),
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table campaign_characters (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,
  user_id     uuid references auth.users(id),   -- null = PNJ contrôlé par le MJ
  is_pc       boolean not null default true,
  primary key (campaign_id, entity_id)
);

create table campaign_entity_snapshots (
  campaign_id            uuid not null references campaigns(id) on delete cascade,
  entity_id              uuid not null references entities(id) on delete cascade,
  mechanical_revision_id uuid not null references entity_mechanical_revisions(id),
  pinned_at              timestamptz not null default now(),
  primary key (campaign_id, entity_id)
);
```

`rng_seed` permet de rejouer une partie solo à l'identique et de diagnostiquer un bug de règle.

**`campaign_encounters`** (migration `20260818110001_campaign_encounters.sql`, V1-E3) — rencontres composées par le générateur MJ (outil autonome, jamais un bloc de wiki, voir §7) :

```sql
create table campaign_encounters (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  name         text not null default 'Rencontre',
  party_size   int not null check (party_size > 0),
  party_level  int not null check (party_level between 1 and 20),
  band         text check (band in ('low','moderate','high')),
  participants jsonb not null default '[]'::jsonb,  -- instantané figé : cle/nom/FP/PX au moment de la sauvegarde
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

`participants` n'est jamais recalculé depuis le ruleset à la lecture — une rencontre sauvegardée ne doit pas changer de composition si une traduction ou une entrée de ruleset est modifiée plus tard. RLS : même politique que `dice_rolls`/`entity_discoveries` (`app.is_world_member(app.campaign_world_id(campaign_id))`).

---

## 12. Sessions et journal d'événements

**C'est la sauvegarde.** Le PDD §15 demande de « reprendre une partie à un état cohérent » : c'est ce journal qui le permet.

```sql
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title       text,
  summary     text,              -- résumé glissant, réinjecté dans le contexte IA
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table session_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  seq           int not null,
  kind          text not null check (kind in
                  ('player_action','narration','roll','rule_application',
                   'world_update','note','system')),
  actor         text not null check (actor in ('player','gm','ai','system')),
  actor_user_id uuid references auth.users(id),
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (session_id, seq)
);

create index session_events_session_idx on session_events (session_id, seq desc);
```

Journal en **ajout seul**. Annuler un tour ne supprime rien : on ajoute un événement de compensation. C'est ce qui permet de reconstruire l'état, de déboguer une partie solo, et d'auditer ce que l'IA a réellement fait.

### 12.1 État de jeu

Ni build, ni valeur dérivée : ce qui change à chaque tour et dépend de la campagne.

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

Contenu : points de vie courants et temporaires, dés de vie, épuisement, expérience, usages de ressources, emplacements de sorts consommés, conditions, jets de sauvegarde contre la mort, harmonisation.

Séparer cette table permet au même personnage d'exister dans deux campagnes sans que ses points de vie se mélangent, et évite qu'une fiche de wiki soit modifiée quarante fois par séance.

### 12.2 Effets actifs

```sql
create table entity_active_effects (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references entities(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  source_kind text not null check (source_kind in ('spell','condition','item','custom')),
  source_key  text,
  label       text not null,
  modifiers   jsonb not null default '[]'::jsonb,
  duration    jsonb not null default '{}'::jsonb,
  applied_at_event uuid references session_events(id),
  expires_at_event uuid references session_events(id),
  created_at  timestamptz not null default now()
);

create index active_effects_entity_idx on entity_active_effects (entity_id, campaign_id);
```

La durée est ancrée sur des **événements de session**, pas sur des horodatages. « Trois rounds » n'a aucun sens en temps réel, et une partie qui reprend trois semaines plus tard doit retrouver ses effets intacts.

---

## 13. Découvertes — le wiki progressif

```sql
create table entity_discoveries (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  entity_id     uuid not null references entities(id) on delete cascade,
  user_id       uuid references auth.users(id),   -- null = toute la table le sait
  detail_level  text not null default 'known'
                  check (detail_level in ('mentioned','known','detailed')),
  discovered_at timestamptz not null default now(),
  source_event_id uuid references session_events(id)
);

create unique index entity_discoveries_uniq on entity_discoveries
  (campaign_id, entity_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
```

`detail_level` distingue « le joueur a entendu ce nom » de « le joueur a lu la fiche ». C'est ce qui permet à l'IA de dire « un nom qui ne vous dit rien » plutôt que de tout révéler.

---

## 14. Jets de dés

```sql
create table dice_rolls (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  expression  text not null,          -- '1d20+5', trace lisible
  ast         jsonb not null,
  context     jsonb not null default '{}'::jsonb,
  result      int not null,
  detail      jsonb not null,         -- tirages, avantage, relances
  rolled_by   text not null check (rolled_by in ('player','gm','ai','system')),
  seed_step   bigint,
  created_at  timestamptz not null default now()
);
```

**Aucun dé n'est jamais lancé par un modèle d'IA.** Un LLM ne produit pas de hasard uniforme ; il produit du texte qui y ressemble. Le serveur lance, l'IA raconte le résultat.

---

## 15. Historique du wiki

```sql
create table entity_revisions (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references entities(id) on delete cascade,
  revision_number int not null,
  snapshot        jsonb not null,   -- entité + blocs, en entier
  change_source   text not null check (change_source in ('user','ai','import','system')),
  change_note     text,
  changed_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (entity_id, revision_number)
);
```

Snapshot complet plutôt que diff : simple, robuste, et le volume est négligeable au regard du coût d'une reconstruction de diff bugguée.

---

## 16. IA : propositions, contexte, quotas

### 16.1 Le contexte est borné par l'audience de la sortie

| Destinataire de la sortie | Contexte autorisé |
|---|---|
| MJ humain | tout, sans filtre |
| Joueur en campagne | ce que ce joueur peut voir, rien d'autre |
| Joueur en solo | tout — il est aussi propriétaire du monde |
| Contenu public | `public` uniquement |

En campagne, un modèle qui a lu les blocs `gm` laisse l'intrigue transparaître dans une formulation, sans même « désobéir ».

### 16.2 `ai_proposals` — l'IA n'écrit jamais directement

```sql
create table ai_proposals (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid references campaigns(id) on delete cascade,
  world_id         uuid not null references worlds(id) on delete cascade,
  session_event_id uuid references session_events(id),
  kind             text not null check (kind in
                     ('create_entity','update_entity','create_block','update_block',
                      'create_relation','set_discovery','update_mechanical')),
  target_entity_id uuid references entities(id),
  payload          jsonb not null,
  status           text not null default 'pending'
                     check (status in ('pending','applied','rejected','failed')),
  validation_errors jsonb,
  auto_applied     boolean not null default false,
  reviewed_by      uuid references auth.users(id),
  applied_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index ai_proposals_pending_idx on ai_proposals (world_id, status) where status = 'pending';
```

Chaîne obligatoire : sortie structurée (appel d'outil) → validation Zod → validation métier → `ai_proposals` → application transactionnelle (mutation + `session_event` + `entity_revision`).

**Garde-fou anti-hallucination le plus efficace :** l'IA ne peut référencer que des identifiants explicitement fournis dans le contexte du tour. Tout identifiant inventé fait échouer la validation.

### 16.3 `ai_usage_log`

```sql
create table ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  campaign_id   uuid references campaigns(id) on delete set null,
  purpose       text not null,   -- 'solo_turn','generate_npc','structure_rule','embed','summarize'
  model         text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cached_tokens int not null default 0,
  cost_micros   bigint not null default 0,
  created_at    timestamptz not null default now()
);

create index ai_usage_user_idx on ai_usage_log (user_id, created_at desc);
```

À créer dès le premier appel d'API, pas quand la facture surprend.

---

## 17. RAG : chunks et file d'embeddings

```sql
create table chunks (
  id            uuid primary key default gen_random_uuid(),
  world_id      uuid not null references worlds(id) on delete cascade,
  source_kind   text not null check (source_kind in
                  ('entity_summary','narrative_segment','block','ruleset_entry','session_summary')),
  source_id     uuid not null,
  content       text not null,
  content_hash  text not null,
  token_count   int,
  visibility_level text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,
  embedding       vector(1024),
  embedding_model text,
  embedded_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (source_kind, source_id, content_hash)
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_world_idx     on chunks (world_id, source_kind);
create index chunks_pending_idx   on chunks (world_id) where embedding is null;

create table embedding_queue (
  id          bigserial primary key,
  chunk_id    uuid not null references chunks(id) on delete cascade,
  attempts    int not null default 0,
  last_error  text,
  enqueued_at timestamptz not null default now()
);
```

- **`vector(1024)`** correspond aux modèles Voyage. L'API Claude ne fournit pas d'endpoint d'embeddings. La dimension est figée dans le schéma ; `embedding_model` permet une cohabitation le temps d'une migration.
- **Le chunking est déjà fait par le modèle de données** : un chunk = un segment, un bloc, une entrée de règle. Granularité de sens, et visibilité héritée de la source.
- **La visibilité est recopiée sur le chunk.** Sinon la recherche vectorielle contourne toutes les permissions — faille classique des RAG maison.
- **Jamais d'appel d'embedding dans la transaction d'écriture.** Trigger vers `embedding_queue`, job qui la vide.
- **`content_hash`** évite de re-facturer un texte inchangé.

---

## 18. Fichiers et partage

```sql
create table assets (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references worlds(id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null,
  byte_size    bigint not null,
  width        int,
  height       int,
  alt_text     text,
  visibility_level text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create table share_links (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid not null references worlds(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  token_hash  text not null unique,      -- SHA-256 du jeton ; le jeton en clair n'est jamais stocké
  scope       text not null check (scope in ('public_only','players')),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
```

**Supabase Storage, buckets privés, URLs signées de courte durée.** Un bucket public réduirait à néant tout le travail sur la visibilité — une carte avec les emplacements secrets serait accessible par URL directe.

---

## 19. Row Level Security

### 19.1 Le piège de la récursion

Une politique sur `campaign_members` qui interroge `campaign_members` provoque une récursion infinie. Erreur la plus fréquente sur Supabase. Parade : des fonctions `security definer`.

```sql
create or replace function app.is_world_member(p_world uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from worlds w where w.id = p_world and w.owner_id = auth.uid())
      or exists (select 1 from world_members m where m.world_id = p_world and m.user_id = auth.uid());
$$;

create or replace function app.campaign_role(p_campaign uuid)
returns text
language sql stable security definer set search_path = public, app as $$
  select role from campaign_members where campaign_id = p_campaign and user_id = auth.uid();
$$;

revoke execute on function app.is_world_member(uuid) from public;
grant  execute on function app.is_world_member(uuid) to authenticated;
```

### 19.2 Politiques de base

```sql
alter table worlds   enable row level security;
alter table entities enable row level security;
alter table blocks   enable row level security;
-- ... et toutes les autres, sans exception

create policy worlds_select on worlds for select using (app.is_world_member(id));
create policy worlds_write  on worlds for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy entities_select on entities for select
  using (deleted_at is null and app.is_world_member(world_id));
create policy entities_write on entities for all
  using (app.is_world_member(world_id)) with check (app.is_world_member(world_id));

create policy blocks_select on blocks for select
  using (exists (select 1 from entities e
                 where e.id = blocks.entity_id and app.is_world_member(e.world_id)));
```

> **Périmètre Phase 0, assumé :** la RLS filtre par appartenance au monde. Elle ne distingue **pas encore** MJ et joueur au sein d'une campagne, ni la visibilité fine des blocs. Ce filtrage est fait par la couche service dès la Phase 1, puis descendu en RLS en Phase 2. **Ne pas ouvrir l'application à des joueurs tiers avant la fin de la Phase 2.** C'est un choix de séquencement, pas un oubli.

---

## 20. Mini-langage de formules

### 20.1 Grammaire de surface

```
formule       ::= terme (('+' | '-') terme)*
terme         ::= facteur (('*' | '/') facteur)*
facteur       ::= nombre | de | reference | fonction | '(' formule ')'
de            ::= entier 'd' entier [ ('kh'|'kl') entier ]   // 4d6kh3
reference     ::= '{' identifiant '}'                        // {STR_MOD}, {level}
fonction      ::= nom_fonction '(' formule (',' formule)* ')'
nom_fonction  ::= 'min' | 'max' | 'floor' | 'ceil' | 'round'
```

### 20.2 L'AST, pas la chaîne

Le texte est parsé **une fois, à la saisie** ; c'est l'AST qui est stocké. Re-parser à chaque évaluation, c'est payer le parsing des milliers de fois et risquer une divergence entre deux versions du parser.

```json
{ "op": "add", "args": [
    { "op": "dice", "count": 2, "faces": 6 },
    { "op": "ref", "name": "STR_MOD" } ] }
```

Types de nœuds : `num`, `dice`, `ref`, `add`, `sub`, `mul`, `div`, `min`, `max`, `floor`, `ceil`, `round`.

### 20.3 Contrat d'évaluation

```ts
type EvalMode = 'roll' | 'average' | 'min' | 'max';
interface Rng { nextInt(maxExclusive: number): number; }

function evaluate(ast: FormulaNode, ctx: Readonly<Record<string, number>>,
                  rng: Rng, mode: EvalMode): { value: number; trace: TraceNode[] };
```

- `mode: 'average'` affiche « ~7 dégâts » sans lancer les dés. Indispensable pour une fiche de règles.
- `rng` est **injecté**, jamais `Math.random()` à l'intérieur. C'est ce qui rend les tests déterministes et le rejeu possible.
- `trace` produit l'explication lisible : `2d6 (3, 5) = 8 + STR_MOD (+3) = 11`. Pour un compagnon de règles, l'explication vaut autant que le résultat.

### 20.4 Limites de sécurité

Aucune formule n'est jamais évaluée via `eval()`, `Function()` ou un interpréteur généraliste. Et même un parser fermé doit être borné :

| Limite | Valeur | Raison |
|---|---|---|
| Dés par nœud | 1000 | `999999d6` gèlerait le serveur |
| Faces par dé | 1 000 000 | idem |
| Profondeur de l'AST | 32 | parenthèses imbriquées à l'infini |
| Nœuds au total | 500 | AST généré par IA bugué ou malveillant |
| Référence inconnue | **erreur explicite** | jamais un `0` silencieux — le bug le plus insidieux d'un moteur de règles |

---

## 21. Vue d'ensemble

```
auth.users
   └── profiles
   └── worlds ──────────────────────────────────────────┐
         ├── world_members                              │
         ├── entity_templates                           │
         ├── entities ──┬── blocks                      │
         │              ├── relations                   │
         │              ├── entity_mentions             │
         │              ├── entity_revisions            │
         │              ├── entity_assets               │
         │              └── entity_mechanical_revisions │
         ├── assets                                     │
         ├── share_links                                │
         ├── chunks ── embedding_queue                  │
         └── campaigns ──────────────────────────────── │
               ├── campaign_members                     │
               ├── campaign_characters                  │
               ├── campaign_entity_snapshots ───────────┘
               ├── entity_discoveries
               ├── entity_runtime_state
               ├── entity_active_effects
               ├── dice_rolls
               ├── ai_proposals
               └── sessions ── session_events

rulesets ── ruleset_entries ─┬── ruleset_entry_blocks
   (hiérarchie via           ├── ruleset_entry_translations
    parent_ruleset_id,       └── ruleset_entry_refs
    lignée via lineage_id)
        └── ruleset_overrides
```

---

## 22. Ordre des migrations

| # | Fichier | Contenu |
|---|---|---|
| 001 | `extensions.sql` | extensions, schéma `app`, `touch_updated_at` |
| 002 | `accounts.sql` | `profiles` + trigger, `worlds` (dont `calendar`), `world_members` |
| 003 | `entities.sql` | `entities`, `blocks`, `relations`, `entity_mentions`, `entity_templates`, index, triggers, anti-cycle `part_of`, `app.entity_path` |
| 004 | `rules.sql` | `rulesets`, `ruleset_entries`, `ruleset_entry_blocks`, traductions, `ruleset_entry_refs`, `ruleset_overrides`, verrou officiel, FK `worlds.default_ruleset_id` |
| 005 | `campaigns.sql` | `campaigns`, membres, personnages, snapshots |
| 006 | `mechanical.sql` | `entity_mechanical_revisions`, FK circulaire différée |
| 007 | `sessions.sql` | `sessions`, `session_events`, `dice_rolls`, `entity_discoveries`, `entity_runtime_state`, `entity_active_effects` |
| 008 | `history.sql` | `entity_revisions` |
| 009 | `ai.sql` | `ai_proposals`, `ai_usage_log` |
| 010 | `rag.sql` | `chunks`, `embedding_queue`, index HNSW |
| 011 | `storage.sql` | `assets`, `entity_assets`, `share_links` |
| 012 | `rls.sql` | fonctions `security definer`, activation RLS, politiques |
| 013 | `seed_dev.sql` | modèles fournis et données de démonstration (§23) |

**Règle absolue :** une migration appliquée n'est jamais modifiée. On en écrit une nouvelle. Y compris pendant le développement, y compris « juste pour corriger une faute de frappe ».

---

## 23. Jeu de données de démonstration

En environnement de développement uniquement.

- 1 monde `Valdoria`, avec son calendrier par défaut
- 1 ruleset officiel importé (SRD 5.1) + 1 dérivé `Valdoria — variante maison` avec `parent_ruleset_id` et une surcharge de bloc
- Modèles fournis : PNJ, créature, lieu, faction, objet, quête, événement
- 4 entités : `Bram le Tavernier` (`character`), `L'Ancre Rouillée` (`location`), `La Main Silencieuse` (`faction`), `Dague` (`item`)
- `Bram` porte : un bloc `description` public à deux segments dont un `ref`, un bloc `description` en `gm`, un bloc `character` (build minimal), un bloc `inventory`
- 3 relations : `Bram —member_of→ La Main Silencieuse` en visibilité `gm`, `Bram —owns→ Dague`, `L'Ancre —part_of→ Valdoria`
- `Dague` : 2 révisions mécaniques
- 1 campagne `campaign` (1 MJ + 1 joueur) et 1 campagne `solo`
- 1 état de jeu pour `Bram` dans la campagne solo
- 1 session avec 5 `session_events` couvrant chaque `kind`

---

## 24. Critères d'acceptation de la Phase 0

**Structure**
- [ ] Les 13 migrations s'appliquent sur une base vide ; `supabase db reset` est reproductible.
- [ ] Types TypeScript générés, compilation en mode strict.

**Intégrité**
- [ ] Supprimer un monde supprime en cascade tout ce qui lui appartient, sans laisser d'orphelin (requête de vérification incluse aux tests).
- [ ] Modifier un ruleset `is_official_base = true` lève une exception.
- [ ] `UPDATE` sur `entity_mechanical_revisions` lève une exception.
- [ ] Un bloc `visibility_level='campaign'` avec `visibility_scope_id` nul est rejeté.
- [ ] Une relation entre deux mondes différents est rejetée par le trigger.
- [ ] Un cycle `part_of` est rejeté par le trigger.
- [ ] `relation_type` hors vocabulaire est rejeté par la contrainte.

**Sécurité**
- [ ] Toutes les tables ont `rowsecurity = true` (vérification sur `pg_tables`).
- [ ] Un utilisateur B authentifié ne lit aucune ligne du monde de A (deux clients Supabase distincts, jamais `service_role`).
- [ ] Le client anonyme ne lit rien.
- [ ] Aucune récursion infinie sur `campaign_members`.

**Fonctionnel**
- [ ] `select * from entities where search_fr @@ plainto_tsquery('french','tavernier')` retourne `Bram`.
- [ ] `app.entity_path` retourne le fil d'Ariane attendu.
- [ ] Le jeu de démonstration est cohérent dans l'éditeur de tables Supabase.

**Noyau pur** (`src/core`, sans base ni réseau)
- [ ] `2d6+{STR_MOD}` se parse, s'évalue, et redonne le même résultat avec la même graine.
- [ ] Le mode `average` retourne 7 + `STR_MOD` sans consommer le RNG.
- [ ] Une référence inconnue lève une erreur typée, jamais 0.
- [ ] `9999999d6` est refusé par la limite en moins de 10 ms.
- [ ] Table de vérité de visibilité : 6 niveaux × 5 profils, un test par case.
- [ ] Couverture > 90 % sur `src/core/formula` et `src/core/dice`, > 95 % sur `src/core/visibility`.

**Validation manuelle finale :** ouvrir l'éditeur de tables Supabase. Pas via une interface maison — elle n'existe pas encore, et c'est volontaire.

---

## 25. Décisions restant à trancher

| Sujet | Options | Recommandation |
|---|---|---|
| Fournisseur d'embeddings | Voyage (1024), OpenAI (1536), local | Voyage `voyage-3.5` — la dimension du schéma en dépend, décider avant d'indexer |
| Vue matérialisée de résolution des rulesets | dès la V1 / quand la lenteur se mesure | quand elle se mesure |
| Suppression | logique partout / physique pour les journaux | logique sur les contenus, physique sur les journaux au-delà de N mois |
| Plusieurs calendriers par monde | oui / non | non en V1, un seul en JSON |
| Multi-tenant | par `world_id` / par schéma | par `world_id`, largement suffisant |
