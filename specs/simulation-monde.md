# Spécification — Le moteur de simulation

**Version :** 1.0 — 22 octobre 2026
**Tickets :** lots A, C, E, F, G, H de `docs/BACKLOG_V4.md`
**ADR :** 0067 à 0084 · **Psyché :** `specs/psyche-v4.md` · **Sources :** `docs/recherche/simulation-inspirations.md`

Ce document dit comment le monde vit : le temps, le hasard, les figures, ce qui arrive, comment on le ressent, s'en souvient, le raconte et agit. Les listes (facettes, valeurs, besoins, émotions, rêves) sont dans `specs/psyche-v4.md`.

---

## 0. Cinq principes

1. **Du code pur.** Toute la simulation vit dans `src/core/sim/`, sans dépendance (règle 19). Les services ne font que lire l'état, appeler le noyau et écrire le résultat.
2. **Déterministe.** Même état, même graine, même durée → même résultat.
3. **Rien ne tourne en tâche de fond.** Le monde avance quand le temps de jeu avance, dans la requête qui le fait avancer (§2).
4. **Des données, pas des scripts.** Événements, actions, règles d'évaluation, transformations : des tables fermées dans `src/core/sim/`, jamais du code fourni par l'utilisateur ou par un modèle.
5. **L'IA raconte.** Elle reçoit ce qui s'est passé, jamais la main sur ce qui se passe (règle 8).

---

## 1. Le modèle de données

**Un monde = une campagne** (index unique `campaigns_world_id_unique`). Tout l'état de simulation est donc indexé par `campaign_id`, comme `entity_attitudes` et `scene_states` (ADR 0067).

```sql
-- Une personne simulée : légère ou complète (§4). Une figure complète a
-- toujours une entité (une fiche du wiki) ; une figure légère n'en a une
-- que si elle a été promue ou saisie à la main.
create table sim_figures (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references campaigns(id) on delete cascade,
  entity_id           uuid references entities(id) on delete set null,
  tier                text not null check (tier in ('full','light')),
  name                text not null,
  people_id           uuid references entities(id) on delete set null,  -- faction-peuple (§13.2)
  location_id         uuid references entities(id) on delete set null,
  born_at             bigint,                -- minute absolue du monde (§2.1)
  died_at             bigint,
  is_pc               boolean not null default false,
  frozen              boolean not null default false,   -- figée par le MJ (§11.2)
  frozen_can_remember boolean not null default true,
  pinned              boolean not null default false,   -- gardée complète par le MJ
  state               jsonb not null,        -- zSimFigureState (src/core/sim/state.ts)
  simulated_until     bigint not null,
  last_relevant_at    bigint not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (tier = 'light' or entity_id is not null),
  unique (campaign_id, entity_id)
);
create index sim_figures_alive_idx on sim_figures (campaign_id, tier) where died_at is null;

-- Ce qui arrive. Ajout seul ; une annulation est une compensation (§12).
create table world_events (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  occurred_at      bigint not null,
  kind             text not null,          -- vocabulaire fermé (§5), vérifié par Zod
  actor_ids        uuid[] not null default '{}',   -- sim_figures (intégrité applicative)
  target_ids       uuid[] not null default '{}',
  location_id      uuid references entities(id) on delete set null,
  data             jsonb not null default '{}'::jsonb,
  scope            text not null check (scope in ('major','notable','detail')),
  origin           text not null check (origin in ('simulation','generation','gm','player')),
  cause_id         uuid references world_events(id) on delete set null,
  compensates_id   uuid references world_events(id) on delete set null,
  batch_id         uuid references sim_batches(id) on delete set null,
  session_event_id uuid references session_events(id) on delete set null,
  rng_key          text,
  created_at       timestamptz not null default now()
);
create index world_events_time_idx   on world_events (campaign_id, occurred_at desc);
create index world_events_actors_idx on world_events using gin (actor_ids);
create index world_events_targets_idx on world_events using gin (target_ids);
create index world_events_cause_idx  on world_events (cause_id);

-- Ce que quelqu'un (ou un lieu) croit d'un événement ou d'une personne (§9).
create table sim_beliefs (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references campaigns(id) on delete cascade,
  holder_figure_id   uuid references sim_figures(id) on delete cascade,
  holder_location_id uuid references entities(id) on delete cascade,
  event_id           uuid references world_events(id) on delete cascade,
  subject_figure_id  uuid references sim_figures(id) on delete cascade,
  claim              jsonb not null,       -- zBeliefClaim : la version crue
  source             text not null check (source in
                       ('witnessed','told','overheard','rumor','deduced','lied_to','gm')),
  source_figure_id   uuid references sim_figures(id) on delete set null,
  certainty          smallint not null check (certainty between 0 and 100),
  is_accurate        boolean not null,     -- pour le MJ ; jamais projeté vers un joueur
  hops               smallint not null default 0,
  learned_at         bigint not null,
  created_at         timestamptz not null default now(),
  check ((holder_figure_id is null) <> (holder_location_id is null)),
  check (event_id is not null or subject_figure_id is not null)
);
create index sim_beliefs_holder_idx on sim_beliefs (campaign_id, holder_figure_id);
create index sim_beliefs_place_idx  on sim_beliefs (campaign_id, holder_location_id);

-- Un passage de simulation, proposé ou appliqué (§12).
create table sim_batches (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  from_time   bigint not null,
  to_time     bigint not null,
  trigger     text not null check (trigger in ('turn','rest','travel','gm_simulator','time_skip')),
  mode        text not null check (mode in ('propose','auto')),
  status      text not null check (status in
                ('running','pending_review','applied','partially_applied','rejected','failed')),
  cursor      jsonb,          -- reprise quand le budget d'un appel est atteint (§16)
  scope       jsonb,          -- portée choisie par le MJ (lieu, faction, figures)
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create table sim_batch_items (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references sim_batches(id) on delete cascade,
  element_kind text not null check (element_kind in ('figure','relation','place','faction')),
  element_id   uuid not null,
  payload      jsonb not null,       -- zSimItemPayload : événements, effets, résumé
  before       jsonb not null,       -- état des figures et attitudes touchées, pour défaire
  depends_on   uuid[] not null default '{}',
  status       text not null default 'pending'
                 check (status in ('pending','applied','rejected')),
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz
);

-- Ce qu'un joueur a le droit de voir de son PJ (§14). Écrit par le moteur.
create table sim_pc_views (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,
  view        jsonb not null,        -- zPcView
  updated_at  timestamptz not null default now(),
  primary key (campaign_id, entity_id)
);

-- La graine et l'état d'une génération de monde (§13).
create table world_generations (
  world_id           uuid primary key references worlds(id) on delete cascade,
  seed               text not null,
  params             jsonb not null,
  generator_version  integer not null,
  tables_fingerprint text not null,
  status             text not null check (status in ('running','uploading','done','failed','cancelled')),
  progress           jsonb not null default '{}'::jsonb,
  started_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  finished_at        timestamptz
);
```

**Colonnes ajoutées aux tables de la V2** (migration nouvelle, règle 14) :

```sql
alter table personality_events add column campaign_id    uuid references campaigns(id) on delete cascade;
alter table personality_events add column world_event_id uuid references world_events(id) on delete set null;
alter table personality_events add column kind text not null default 'seed_edit'
  check (kind in ('seed_edit','core_memory','persuasion','gm_adjustment'));
alter table attitude_events    add column world_event_id uuid references world_events(id) on delete set null;
```

`personality_events.campaign_id` nul = une retouche de la **graine** (le MJ édite le bloc) ; renseigné = un changement **dans la partie**.

**RLS** (ADR 0080) :

| Table | Lecture | Écriture |
|---|---|---|
| `sim_figures`, `world_events`, `sim_beliefs`, `sim_batches`, `sim_batch_items`, `world_generations` | `app.is_world_admin(...)` : le MJ, ou le propriétaire en solo | idem |
| `sim_pc_views` | l'admin du monde, **et** le joueur à qui le PJ est attribué (`campaign_characters.user_id = auth.uid()`) | l'admin du monde |

Un joueur ne lit **jamais** les tables brutes : elles contiennent la vérité, les croyances fausses, les rêves secrets. Il lit sa projection, déjà filtrée (règle 5).

**`state` n'est pas un cache.** Les besoins et le stress évoluent à chaque pas sans être journalisés un par un : c'est un état, comme `scene_states` ou les PV. Ce qui reste **jamais stocké** (règle 16) : l'humeur, les bandes, les poids des besoins, les liens nommés (tous recalculés).

### 1.1 `zSimFigureState`

```ts
// Figure complète
{
  __v: 1,
  facets: Partial<Record<FacetKey, number>>,
  values: Partial<Record<ValueKey, number>>,
  ethics: Partial<Record<EthicKey, EthicResponse>>,
  dreams: Dream[],
  needs: Partial<Record<MindNeedKey, number>>,       // satisfaction 0…100
  body: { last_meal: bigint, last_drink: bigint, last_long_rest: bigint },
  stress: number,                                    // 0…100
  memories: { short: Memory[], long: Memory[], pc: Memory[] },   // 8, 8, 4 (§7)
  links: Link[],                                     // liens de la figure (§8.4), y compris partenaires
}
// Figure légère
{
  __v: 1,
  facets, values, ethics,                            // mêmes cartes, souvent partielles
  dream: Dream | null,
  stress: number,
  links: Link[],
}
```

---

## 2. Le temps

### 2.1 L'horloge absolue

`world_time` : un entier de **minutes depuis l'an 0 du calendrier du monde**, `computeSortKey(date) × 1440 + minutes` (`src/core/calendar/sortKey.ts`). Une fonction pure convertit l'heure de scène (`GameTime`, jour compté depuis le début de la partie) en `world_time`, à partir de la date de départ de la campagne. Sans calendrier réglé : le calendrier par défaut (`defaultCalendar.ts`).

### 2.2 La lunette : quatre classes de distance

Recalculée pour chaque figure vivante au début de chaque pas.

| Classe | Qui | Pas | Ce qui est simulé |
|---|---|---|---|
| `scene` | présente dans `scene_states` | le tour | besoins, émotions, souvenirs de ce qui arrive en scène. **Aucune action choisie par la simulation** : la scène appartient au moteur de tour et au récit |
| `near` | complète, au même lieu que le groupe, ou dans son lieu parent ou ses lieux enfants (`src/core/entity-tree`) | 1 heure | tout |
| `far` | complète, ailleurs | 1 jour | tout |
| `light` | légère | 1 mois | la vie en grandes lignes (§10.5) |

### 2.3 Avancer le monde

```ts
advanceWorld(world: SimWorld, from: bigint, to: bigint, budget: SimBudget, seed: string): SimStepResult
```

- Les pas sont **alignés sur des frontières absolues** : chaque heure pleine, chaque minuit, chaque premier du mois. Avancer de 10 h à 14 h, puis de 14 h à 20 h, donne **exactement** le même résultat qu'avancer de 10 h à 20 h d'un coup.
- Entre `from` et `to`, les frontières sont traitées **dans l'ordre chronologique**. À une même frontière : les pas `near` (horaires), puis `far` (quotidiens), puis `light` (mensuels). Dans une classe : les figures dans l'ordre de leur identifiant.
- Pas de rattrapage paresseux par figure : tout le monde avance ensemble. C'est ce qui garantit le déterminisme quand deux figures interagissent (ADR 0069).
- **Budget** (§16) : atteint au milieu, `advanceWorld` s'arrête à la dernière frontière complète et rend un `cursor`. L'appel suivant reprend de là. L'écran dit « le monde rattrape son retard ».

### 2.4 Qui fait avancer le temps

| Source | Quand | Lot créé |
|---|---|---|
| Tour solo | `advanceSceneTime` | `turn` |
| Repos court, repos long | `takeShortRest`, `takeLongRest` | `rest` |
| Voyage, saut de temps | une action de la fiche ou du MJ | `travel`, `time_skip` |
| Le simulateur du MJ | F3 | `gm_simulator` |

**En campagne avec MJ**, seuls les gestes du MJ lancent la simulation (simulateur, temps avancé par le MJ). Un joueur ne déclenche jamais d'écriture de simulation : toutes les écritures se font avec les droits de l'admin du monde (ADR 0080).

---

## 3. Le hasard dérivé

`deriveRng(seed, ...keys)` (`src/core/sim/random.ts`, ADR 0068) : un `Rng` (interface de `src/core/dice/rng.ts`) dont l'état initial est le hachage de la graine et des clés.

- **Graine** : `campaigns.rng_seed` pendant la partie ; `world_generations.seed` pendant la génération.
- **Clés** : toujours `(frontière, identifiant de figure, motif)`, par exemple `(t, figureId, "action")`, `(t, figureId, "revisit", memoryId)`.
- Hachage : MurmurHash3 (finaliseur `fmix32`) sur les octets UTF-8, écrit à la main ; génération : un xorshift32 initialisé par ce hachage. Aucune dépendance.
- **Conséquence voulue** : un tirage de plus pour une figure ne décale aucun tirage d'une autre, ni d'un autre motif de la même. Un choix du joueur ne change que ce qui en découle causalement.

`hash128(seed, ...keys)` (même fichier) donne aussi les **identifiants déterministes** de la génération (§13.4), mis en forme d'UUID.

---

## 4. Figures légères et complètes

| | Légère | Complète |
|---|---|---|
| Combien | jusqu'à 5 000 vivantes | **150** au plus (A5 ajuste) |
| Fiche du wiki | facultative | **obligatoire** (créée à la promotion, visibilité `gm`) |
| Couches | facettes, valeurs, éthiques, un rêve, stress, liens | toutes |
| Souvenirs | aucun : ses actes notables sont dans `world_events` | 8 + 8 + 4 (§7) |
| Attitudes | dans `links` | `entity_attitudes`, comme en V2 |
| Croyances | celles de son lieu | les siennes |

### 4.1 Promotion

Une figure légère devient complète quand elle passe en classe `near`, quand elle devient la cible d'une relation avec un PJ (familiarité ≥ 30), ou quand le MJ l'**épingle**. Au-delà du plafond, la figure complète la moins pertinente est rétrogradée d'abord.

**Reconstitution déterministe** (`promote`, pur) :
- besoins : poids calculés (psyché §4.2), satisfaction tirée par `deriveRng(seed, id, "promote")` entre 40 et 90 ;
- souvenirs : ses actes notables des 30 dernières années (`world_events` où elle est actrice ou cible, `scope` ≠ `detail`) passent par l'évaluation (§6) **sans effet sur l'humeur**, et les plus forts remplissent la mémoire longue ;
- attitudes : ses `links` deviennent des lignes `entity_attitudes` ;
- fiche : `promotion.ts` crée l'entité avec les blocs `character`, `personality` et `worldview` remplis depuis l'état.

### 4.2 Rétrogradation

Une figure complète de classe `far`, ni PJ, ni épinglée, sans contact avec un PJ depuis **90 jours** de jeu, redevient légère. Elle garde ses trois souvenirs longs les plus forts sous forme de résumé dans `links` et ses actes dans `world_events`. Sa fiche du wiki reste.

---

## 5. Le journal du monde

### 5.1 Ce qui s'écrit, ce qui ne s'écrit pas

Seuls les genres du vocabulaire s'écrivent dans `world_events`. Les interactions du quotidien (bavarder, une remarque, un petit service) **ne s'y écrivent pas** : leurs effets vont dans `entity_attitudes`, résumés dans `attitude_events` une fois par semaine de jeu et par paire (§8.2), et dans les souvenirs avec une description en ligne. C'est ce qui tient le volume (§16).

### 5.2 Le vocabulaire (49 genres)

Chaque genre a un schéma Zod pour `data`, une portée par défaut, une **ampleur** (`harm` ou `benefit`, 0…100, pour l'évaluation §6), l'acte éthique qu'il constitue (psyché §3.2) et ses étiquettes de réputation (§9.5).

| Famille | Genres |
|---|---|
| Vie | `birth`, `death`, `union_formed`, `union_ended`, `romance_began`, `romance_ended`, `migrated`, `came_of_age` |
| Liens | `friendship_formed`, `friendship_ended`, `grudge_formed`, `rivalry_formed`, `reconciliation`, `mentorship_began` |
| Actes envers autrui | `help_given`, `gift_given`, `rescue`, `insult`, `humiliation`, `assault`, `murder`, `kill_in_fight`, `theft`, `betrayal`, `oath_sworn`, `oath_broken`, `lie_told`, `secret_revealed`, `confession`, `infidelity` |
| Accomplissements | `masterwork_created`, `discovery_made`, `skill_mastered`, `position_gained`, `position_lost`, `site_founded` |
| Conflits | `feud_started`, `raid`, `battle`, `duel`, `punished`, `exiled`, `imprisoned`, `freed` |
| Vie intérieure | `dream_born`, `dream_achieved`, `dream_abandoned`, `crisis`, `elan`, `transformation` |
| Monde | `monster_attack`, `conversion`, `pilgrimage` |

Ajouter un genre : un ADR, comme pour les événements des déclencheurs (ADR 0070).

### 5.3 Cause et portée

- `cause_id` : l'événement qui a provoqué celui-ci (une insulte → une rancune → un duel). C'est ce qui permet de **rejeter une chaîne** (§12) et de raconter le pourquoi.
- `scope` : `major` entre dans la Chronologie du monde (ADR 0048) sans condition ; `notable` y entre pour le MJ, et pour un joueur s'il le connaît (§9) ; `detail` n'y entre jamais.

### 5.4 Le pont du jeu vers le monde (A7)

Ce que font les PJ doit entrer dans le monde, sinon personne ne s'en souvient.

1. **Les événements mécaniques** (`session_events`) sont traduits au début de chaque lot, par une table pure : une attaque d'un PJ sur une figure → `assault` ; une figure tuée par un PJ → `kill_in_fight` si la figure était hostile ou avait attaqué, `murder` sinon ; un soin donné à une figure → `help_given`.
2. **Le fait marquant** : depuis le tiroir de conséquences (solo) ou les outils du MJ, on enregistre un événement du vocabulaire à la main (« Max a humilié Bram devant la taverne »), avec ses acteurs, sa cible, sa portée. Origine `player` en solo, `gm` en campagne.
3. **L'IA ne crée pas d'événement du monde** en V4. Elle peut suggérer un fait marquant dans sa narration ; l'humain l'enregistre ou non.

---

## 6. Ressentir : l'évaluation

### 6.1 La grille (OCC, ADR 0076)

Pour chaque événement, chaque figure concernée reçoit un **rôle** : `actor`, `target`, `related` (familiarité ≥ 30 avec la cible ou l'acteur), `witness` (présente au lieu), `hearer` (l'apprend par une croyance, §9). Puis quatre questions, dans l'ordre :

1. **Bon ou mauvais pour moi ?** (cible) `harm` → colère si l'acteur est blâmable, peur si la menace dure, tristesse sinon ; `benefit` → joie, et gratitude envers l'acteur.
2. **Bon ou mauvais pour quelqu'un à qui je tiens ?** (`related`, `witness`) `harm` à quelqu'un qu'on aime (amitié > 11) → compassion, deuil si c'est une mort et l'affection forte ; `harm` à quelqu'un qu'on déteste (amitié < −11) → joie mauvaise, réduite par `compassion` ; `benefit` à quelqu'un qu'on déteste → jalousie, selon `envy_propensity`.
3. **L'acte est-il louable ou blâmable ?** (tous sauf l'acteur) selon la réponse éthique du témoin (psyché §3.2) : blâmable → dégoût, mépris ou colère contre l'acteur ; un acte qui honore une de ses valeurs fortes → admiration (respect envers l'acteur).
4. **Et moi, qui ai agi ?** (acteur) un acte contraire à ses éthiques → culpabilité ou honte, et stress ; un accomplissement → fierté ; un pas vers un rêve → espoir.

### 6.2 L'intensité

```
intensité = ampleur(genre) × facteur(rôle) × (1 + Σ modulateurs) × proximité
facteur(rôle) : actor 1 · target 1 · related 0,7 · witness 0,5 · hearer 0,3 × certitude/100
modulateurs   : facettes de l'émotion (anger_propensity pour la colère, anxiety_propensity
                pour la peur, gloom_propensity pour la tristesse…), ±0,5 au plus
proximité     : 1 + amitié/200 envers la personne touchée (bornée 0,5…1,5)
```

Bornée à 0…100. Des **règles propres à un genre** complètent la grille quand elle ne suffit pas (la mort d'un partenaire donne un deuil à 90). Toutes dans `src/core/sim/appraisal.rules.ts`.

### 6.3 Des émotions aux relations

| Émotion envers quelqu'un | Axes touchés (delta brut) |
|---|---|
| colère | amitié −i/5, confiance −i/8 |
| peur | peur +i/5 |
| gratitude | dette +i/5, amitié +i/8 |
| mépris, dégoût | respect −i/5 |
| admiration (respect) | respect +i/5 |
| affection | amitié +i/5 |
| jalousie | amitié −i/8 |
| soif de vengeance | amitié −i/4 |

Chaque delta passe par `applyDelta` (amortissement de la V2) et s'écrit dans `attitude_events` avec `world_event_id`.

### 6.4 L'humeur — calculée, jamais stockée

```
humeur = Σ(souvenirs courts : valence × intensité) / 4
       + Σ(souvenirs longs revécus ce mois : valence × intensité) / 8
       + Σ(besoins : poids × (satisfaction − 50) / 25)
       + cheerfulness / 5
bornée à −100…+100
```

Bandes : misérable ≤ −67 · malheureux · contrarié · neutre · bien · heureux · radieux ≥ 67. Chaque terme est affichable avec sa cause (« −12 : en deuil de sa femme »), comme les pensées de RimWorld.

### 6.5 Le stress, les crises, l'élan

Chaque jour :

```
humeur < 0 : stress += (−humeur / 20) × (1 − bravery / 200)
humeur > 0 : stress −= (humeur / 25) × (1 − anxiety_propensity / 200) × (1 − gloom_propensity / 400)
agir contre une éthique (§10.3) : +4 (only_extreme), +8 (shameful)
```

- **Crise** quand stress ≥ `70 − stress_vulnerability / 5` **et** humeur ≤ −40 (les deux, comme dans Dwarf Fortress). Son type suit la facette dominante : `anger_propensity` → `rage` (s'en prend à quelqu'un, sans jamais franchir une éthique `unthinkable`), `gloom_propensity` → `prostration`, `anxiety_propensity` → `flight`, `self_indulgence` → `binge`, sinon `breakdown`. Après la crise : soulagement, stress −20.
- **Élan** quand humeur ≥ 60 et stress ≤ 30, une chance sur vingt par jour : l'action suivante qui sert un rêve compte double. Pour un PJ : l'Inspiration héroïque est proposée (ADR 0084).

---

## 7. Se souvenir (ADR 0074)

### 7.1 Un souvenir

```ts
{ id, group: string, event_id?: uuid, description?: string,   // description si pas d'événement (§5.1)
  emotion: EmotionKey, intensity: number, valence: number,
  subject_ids: uuid[],                                          // figures en jeu
  involves_pc: boolean, created_at: bigint, revisited_at?: bigint, formative_checked: number }
```

`group` = famille d'émotion + première figure en jeu (« grief:<figure> »). Deux deuils de deux personnes différentes sont deux groupes ; deux humiliations par la même personne en sont un.

### 7.2 Les trois mémoires

| Mémoire | Emplacements | Règle |
|---|---|---|
| **Courte** | 8 | un groupe par emplacement : le plus fort des deux est gardé. Sinon, une place vide, ou le plus faible est remplacé, même s'il est plus fort que le nouveau (Dwarf Fortress) |
| **Longue** | 8 | un souvenir court y entre au bout de **90 jours** de jeu (réglable par monde), ou **aussitôt** si son intensité est ≥ 80. Il n'y entre que s'il est plus fort que celui qu'il remplacerait |
| **Du joueur** | 4 | les souvenirs qui impliquent un PJ, quand ils montent en mémoire longue, vont ici. Le quotidien ne les chasse pas (Nemesis) |

Oublier n'efface rien du monde : l'événement reste dans `world_events`.

### 7.3 Revivre

Chaque jour, un souvenir long ou du joueur est revécu avec une probabilité `intensité / 3000` (un souvenir à 90 revient environ une fois par mois), et **toujours** quand une figure en jeu est rencontrée ou que la figure revient au lieu. Revivre rend l'émotion à 60 % de son intensité, dans l'humeur seulement.

### 7.4 Les souvenirs fondateurs — se transformer

Quand un souvenir long est revécu et que son groupe est **formateur**, une chance sur trois qu'il devienne fondateur : il quitte la mémoire longue (pas la mémoire du joueur, où il reste) et déplace des facettes ou des valeurs. Table en données (`src/core/sim/formative.rules.ts`) :

| Souvenir | Déplacement (× intensité / 100) |
|---|---|
| deuil d'un proche | `hopefulness` −8, `cheerfulness` −6 |
| peur forte, danger survécu | `bravery` ±8 (signe : + si `confidence` > 0) |
| trahison subie | `trust` −10, `vengefulness` +6 |
| humiliation | `pride` −8 ou `vengefulness` +8 (le plus marqué des deux) |
| sauvé par quelqu'un | `gratitude` +8 ; valeur `loyalty` +6 |
| romance, union | `love_propensity` +6 |
| naissance d'un enfant | valeur `family` +8, `hopefulness` +5 |
| culpabilité forte pour son propre acte | `compassion` +5 ; l'éthique de l'acte se resserre d'un cran |
| horreur devant une atrocité | `compassion` ±6, `tolerance` −5 |
| désespoir | `hopefulness` −10 |

- Chaque déplacement passe par `applyDelta` et s'écrit dans `personality_events` (`kind = 'core_memory'`, `campaign_id`, `world_event_id`). La fiche affiche la cause, comme dans Dwarf Fortress : « est devenu méfiant, après la trahison de Kesh, an 312 ».
- Pour un PJ, selon le réglage de table (§11) : proposé au joueur, appliqué, ou jamais.

---

## 8. Les relations

### 8.1 La familiarité

+5 par jour passé au même lieu avec interaction, +15 par événement notable partagé ; sans contact, −1 tous les 30 jours, jamais sous 10 une fois 30 atteint.

### 8.2 Les interactions du quotidien

Chaque jour, une figure complète dont le besoin `socialize` ou `friends` a un poids non nul choisit un interlocuteur au même lieu (utilité : amitié, intérêt, compatibilité). L'interaction est tirée selon les facettes et la compatibilité (psyché §2) :

| Interaction | Condition | Effet |
|---|---|---|
| bavarder | — | amitié +1…+3, × compatibilité |
| se confier | familiarité ≥ 30 | amitié +3, confiance +2, partage d'une croyance (§9.2) |
| se froisser | incompatibilité, ou `harmony` < −11 | amitié −2…−5, agacement léger |
| se disputer | rancune, ou `conflict` pressant | amitié −5, colère moyenne |

Les deltas d'une semaine s'écrivent **en un seul** `attitude_events` par paire, avec la **suite** des deltas bruts (`deltas: { friendship_hostility: [2, 1, 3] }`) : le rejeu applique `applyDelta` dans l'ordre et retrouve exactement la valeur (critère V2 conservé).

### 8.3 La compatibilité

`compat(A, B)` = 1 − (nombre de facettes de compatibilité où |A − B| > 60) / 4, bornée à 0…1. Deux personnes incompatibles finissent par s'éviter, sans drame : c'est voulu.

### 8.4 Les liens nommés — calculés, jamais stockés pour une figure complète

| Lien | Condition |
|---|---|
| connaissance | familiarité ≥ 30 |
| ami | amitié ≥ 34 et familiarité ≥ 30 |
| ami proche | amitié ≥ 67 et familiarité ≥ 60 |
| rival | respect ≥ 12, amitié ≤ 11, et un événement `rivalry_formed` |
| rancune | amitié ≤ −34 et un souvenir d'offense |
| ennemi juré | amitié ≤ −67, ou un rêve `avenge` le visant |
| mentor, protégé | événement `mentorship_began` |
| amant·e | événement `romance_began` non suivi de `romance_ended` |
| partenaire | événement `union_formed` non suivi de `union_ended` |
| ex | `union_ended` ou `romance_ended` |
| compagnon d'armes | souvenir partagé d'une bataille ou d'un raid |
| ami d'enfance | amitié née avant l'âge adulte des deux |

Le passage d'un seuil écrit l'événement correspondant (`friendship_formed`, `grudge_formed`…). Pour une figure légère, les liens sont stockés dans `state.links`, puisqu'elle n'a pas de lignes d'attitude.

### 8.5 L'intime (E7)

**Règle absolue** : aucune attirance, aucune action intime, aucun récit intime ne concerne jamais une personne mineure, quels que soient les réglages. L'âge adulte est un paramètre du monde (18 par défaut), et le moteur le vérifie avant tout le reste.

- **Naissance de l'attirance** : seulement si `romance_simulation` est actif, si le groupe de genre de la cible est dans l'**ensemble d'attirance** de la personne (psyché §9.4), séparément pour le romantique et le sexuel. Croissance pendant les interactions selon `love_propensity` (romantique) ou `lust_propensity` (sexuelle), la compatibilité et l'amitié. Les nuances demi et gris exigent une familiarité ≥ 60.
- **Romance** : attirance romantique ≥ 34 des deux côtés, puis une action `court` acceptée.
- **Union** et **exclusivité** : à l'union, l'accord d'exclusivité se fixe selon les orientations relationnelles : exclusif si l'une des deux personnes est `monogamous` sans être `polyaccepting`. `infidelity` n'existe que si l'exclusivité a été convenue.
- **Réaction quand un partenaire noue une autre relation** :

| Orientation relationnelle | Réaction |
|---|---|
| `monogamous` | jalousie 60 × (1 + `envy_propensity`/100), confiance −25 envers le partenaire, rupture possible |
| `polyaccepting` | jalousie 10, aucune perte de confiance |
| `poly_hierarchical` | jalousie 15 ; 50 si la nouvelle relation menace le lien principal (proposition d'union) |
| `poly_non_hierarchical` | jalousie 5 × (1 + `envy_propensity`/100), et une petite joie (compersion) |
| `relationship_anarchy` | aucune attente : seule `envy_propensity` joue, à 5 |
| absente | la norme de sa culture (`culture.relationship_norm`), sinon `monogamous` |

Une incompatibilité d'orientations entre partenaires ajoute un peu de stress chaque mois tant qu'elle n'est pas renégociée.

---

## 9. Croire, colporter, mentir (ADR 0075)

### 9.1 Naître d'un témoignage

Les figures complètes présentes au lieu d'un événement en reçoivent une croyance `witnessed`, certitude 90, exacte. Un événement `notable` ou `major` devient aussi une croyance **du lieu** (`holder_location_id`).

### 9.2 Se transmettre

- Entre figures complètes, à chaque « se confier » (§8.2) : la figure partage au plus une croyance, choisie par saillance (portée, émotion liée, fraîcheur). Probabilité réduite par `privacy`. Une croyance sur un **secret** de l'interlocuteur ou de soi n'est partagée que par une figure très sincère qui fait très confiance.
- Entre lieux : une croyance de lieu `notable` atteint les lieux parents et enfants en 7 jours par saut ; une `major` atteint tout le monde en 30 à 60 jours.
- Une figure complète qui arrive dans un lieu reçoit ses croyances comme `rumor`, certitude 40.
- Certitude reçue = certitude du conteur × (0,6 + 0,4 × confiance envers le conteur / 100) ; `hops` + 1.

### 9.3 Se déformer

À chaque transmission, une chance de mutation de `0,1 + imagination/1000 + (1 − certitude/100) × 0,2`. Mutations fermées : **exagérer** (ampleur +1 cran), **confondre l'acteur** (avec une figure du même peuple et du même lieu), **déplacer** (vers le lieu parent), **omettre** la cible. `is_accurate` passe à faux.

### 9.4 Mentir

Une figure dont `sincerity` ≤ −34, qui a un motif, peut raconter une version **fausse** : couvrir son propre acte blâmable (elle s'efface de la version), ou accuser un rival (amitié ≤ −34) à sa place. L'auditeur reçoit `lied_to` (il croit `told`) ; le MJ voit le mensonge. Un mensonge découvert (une croyance exacte et une fausse sur le même événement, chez la même personne) donne `lie_told` révélé, colère, et confiance −20 envers le menteur.

### 9.5 La réputation

Chaque genre d'événement porte des étiquettes : `hero`, `protector_of_weak`, `generous`, `murderer`, `thief`, `liar`, `oathbreaker`, `coward`, `brawler`, `monster_slayer`, `healer`, `traitor`. La réputation d'une figure dans un lieu = somme, sur les croyances de ce lieu dont elle est actrice, de (poids de l'étiquette × certitude). Elle s'affiche en bandes (« à Port-Gris, on te connaît comme voleur — fort »). **C'est la mémoire collective du joueur.**

### 9.6 Oublier

Certitude −1 tous les 10 jours pour une croyance `detail`, tous les 60 jours sinon. Sous 10, la croyance disparaît, sauf celles qui portent sur un PJ. Plafonds : 60 croyances par figure, 200 par lieu (on garde les plus saillantes).

### 9.7 Ce qu'un PJ sait

Un PJ est une figure (`is_pc`). Il sait ce dont il a une croyance : ce qu'il a vécu en scène (pont §5.4), ce qu'on lui a dit, ce qu'il a entendu en « tendant l'oreille » dans un lieu (une intention de la fiche qui lui donne les croyances les plus saillantes du lieu), ce que le MJ lui révèle (`gm`). **Le joueur ne voit le monde qu'à travers ces croyances**, avec leur source et leur certitude, et parfois fausses : c'est ce qui donne du prix à l'enquête.

---

## 10. Agir (ADR 0077)

### 10.1 Une action, en données

```ts
{
  key: "insult",
  tier: "full",                         // ou "light"
  targets: "figure_here",               // self | figure_here | figure_known | place | object
  advertises: { conflict: 40 },         // besoins comblés (Les Sims)
  considerations: [
    { input: { kind: "relation", axis: "friendship_hostility" }, curve: { kind: "inverse_linear" } },
    { input: { kind: "emotion", key: "anger" },                  curve: { kind: "power", exp: 0.5 } },
    { input: { kind: "facet", key: "politeness" },               curve: { kind: "inverse_linear" } },
  ],
  ethic: null,                          // acte éthique, s'il en est un
  emits: "insult",                      // genre de world_events produit
  duration_hours: 0,
}
```

### 10.2 Les entrées et les courbes

**Entrées fermées**, toutes ramenées à 0…1 : besoin (1 − satisfaction/100), facette ((v + 100)/200), valeur, émotion (intensité/100), stress, humeur, axe de relation envers la cible, familiarité, rêve (1 si l'action fait avancer un rêve actif vers sa cible), coût éthique (§10.3), nuit, même lieu.

**Courbes fermées** : `linear(m, b)`, `inverse_linear`, `power(exp)`, `logistic(k, mid)`, `step(threshold)`. Résultat borné à 0…1.

### 10.3 Le score, puis le choix

```
c'_i = c_i + c_i × (1 − c_i) × (1 − 1/n)        // compensation de l'IAUS (n considérations)
score = poids de base × Π c'_i × (1 + annonce des besoins pondérée par leur urgence)
```

- **Coût éthique** : `acceptable` 1 · `personal_matter` 0,9 · `justified_if_reason` 0,6 (1 si la cible a offensé la figure) · `only_extreme` 0,2 (1 en légitime défense) · `shameful` 0,1 · `unthinkable` : **l'action est retirée**, jamais notée.
- **Choix** : on garde les trois meilleures au-dessus de 0,05 et on tire selon leurs scores, par `deriveRng(seed, t, figureId, "action")`. La même personne ne fait donc pas toujours la même chose, mais toujours quelque chose qui lui ressemble.
- **Candidats bornés** : cibles parmi les figures du même lieu, les cibles des rêves actifs, et au plus cinq figures liées.

### 10.4 Le vocabulaire des figures complètes (pas `near` et `far`)

`rest`, `work`, `pray`, `train`, `create`, `study`, `wander`, `travel`, `revel`, `chat`, `deep_talk`, `court`, `argue`, `insult`, `help`, `gift`, `comfort`, `seek`, `confront`, `attack`, `steal`, `spread_rumor`, `lie_about`, `confess`, `scheme`, `visit_family`, `mourn`, `flee`, `celebrate`, `make_amends`.

Un **rêve** a un petit plan en données : `avenge(X)` = trouver où est X (`seek`, ou demander : `deep_talk`) → s'y rendre (`travel`) → `confront` ou `attack`. L'étape courante reçoit la considération « rêve ».

### 10.5 Le vocabulaire des figures légères (pas mensuel)

`seek_union`, `have_child`, `migrate`, `take_position`, `found_site`, `feud`, `raid`, `commit_crime`, `create_masterwork`, `make_discovery`, `convert`, `betray`, `reconcile`. La mort n'est pas une action : c'est un tirage de mortalité selon l'âge (courbe par espèce, du ruleset ou du monde) et la violence subie.

### 10.6 Ce que la simulation ne fait jamais

- **Faire agir un PJ.** Un PJ est cible, témoin, sujet de rumeurs ; jamais acteur d'une action simulée.
- Faire agir une figure **figée** (§11.2).
- Faire agir une figure en classe `scene` : c'est le tour qui décide.
- Dépasser les bornes (§16).

---

## 11. Les réglages

### 11.1 Réglages de campagne

Dans `campaigns.table_settings` (existant, ADR 0043), sous la clé `sim`, validés par `zSimTableSettings` :

```ts
{
  mode: "off" | "propose" | "auto",          // défaut : "off" en campagne, "auto" en solo
  pc_layers: {
    body:     "player" | "gm" | "off",       // faim, soif, fatigue
    needs:    "player" | "gm" | "off",       // besoins de l'esprit
    stress:   "player" | "gm" | "off",
    emotions: "player" | "gm" | "off",       // et l'humeur
    memories: "player" | "gm" | "off",
  },                                         // défaut : "player" partout
  pc_trait_evolution: "propose" | "apply" | "never",   // défaut : "propose"
  body_consequences: "auto" | "gm",          // défaut : "auto" (ADR 0083)
  intimate_narration: "explicit" | "fade",   // défaut : "fade"
  romance_simulation: boolean,               // défaut : true
  memory_promotion_days: number,             // défaut : 90
  adult_age: number,                         // défaut : 18
}
```

- `off` pour une couche de PJ : la couche n'est **pas simulée** pour les PJ et n'a aucune conséquence. Les PNJ la gardent.
- `gm` : simulée, visible du MJ seul, absente de `sim_pc_views`.

### 11.2 Figée par le MJ

`sim_figures.frozen` : jamais actrice, jamais transformée. `frozen_can_remember` : elle peut encore être témoin et se souvenir. Par défaut, une figure créée à la main par le MJ **avant** l'activation de la simulation est figée si le MJ coche « garder mes PNJ tels quels » à l'activation.

---

## 12. Les lots : proposer, appliquer, défaire (ADR 0079)

- Chaque appel de simulation crée un **lot** (`sim_batches`). Le noyau rend une liste d'**éléments** : une figure (ce qu'elle a fait, ressenti, ce qui a changé en elle), une relation, un lieu. Chaque élément porte ses événements, ses effets, un résumé lisible, l'état **avant** de ce qu'il touche, et ses **dépendances**.
- **Dépendance** : un élément dépend de tout élément antérieur du même lot qui a touché une figure qu'il lit. C'est conservateur : rejeter un élément rejette tout ce qui a pu en découler.
- **Mode `auto`** : appliqué aussitôt, en une transaction. **Mode `propose`** : `pending_review` ; le MJ accepte ou rejette élément par élément (F3), puis le lot se ferme. **Tant qu'un lot attend, la simulation ne repart pas** : on relit d'abord.
- **Modifier** un élément : seulement son résumé et sa portée. Changer ce qui s'est passé, c'est le rejeter et saisir un fait marquant (§5.4).
- **Défaire un élément appliqué** : seulement dans le **dernier** lot de la campagne. On restaure l'état `before` des figures et des attitudes touchées, on écrit les compensations (`compensates_id` dans `world_events`, deltas inverses dans `attitude_events` et `personality_events`). Les lots plus anciens sont de l'histoire : on corrige par un fait marquant. C'est aussi ce que V3-F2 (annuler un tour) appelle pour défaire la simulation du tour.

---

## 13. La génération du monde (ADR 0081)

### 13.1 Les paramètres (`zWorldGenParams`)

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `history_years` | jeune 60 · établi 150 · ancien 300 · très ancien 600 | établi |
| `peoples` | 2 à 8 | 4 |
| `settlements` | 4 à 40 | 12 |
| `density` | faible (20 figures par lieu) · moyenne (40) · forte (80) | moyenne |
| `conflict` | 0 à 3 | 1 |
| `monsters` | 0 à 3 | 1 |
| `magic` | 0 à 3 | 1 |
| `seed` | texte | tirée au hasard |

Préréglages : « monde jeune et paisible », « royaumes établis », « vieil empire en déclin », « terres sauvages ».

### 13.2 Les peuples et les lieux

- Un **peuple** est une entité `faction` avec un bloc `worldview` (valeurs, éthiques de la culture) et un bloc nouveau `culture` : espèce (une entrée d'espèce du ruleset), tendances de facettes, norme relationnelle, table de noms (le générateur Noms existant), âge adulte et longévité.
- Un **lieu** est une entité de lieu, rattachée à un peuple, avec une taille. Les détails (taverne, échoppe) se génèrent à la visite, avec les générateurs existants.

### 13.3 La boucle d'histoire

Un pas par mois de jeu sur `history_years` : mortalité, unions et naissances, actions légères (§10.5), attaques de monstres, querelles entre chefs de lieux (querelle → raid → bataille), migrations quand un lieu va mal, fondations quand il déborde, successions à la mort d'un chef. Chaque événement s'écrit avec `origin = 'generation'`.

À la fin : les figures vivantes qui comptent au départ (chefs des lieux de départ, auteurs d'actes notables des 30 dernières années, au plus 60) sont promues complètes (§4.1). En solo, le joueur choisit son lieu de départ parmi les lieux générés.

### 13.4 Où elle tourne, et comment elle arrive en base

- **Dans le navigateur**, dans un *Web Worker* (API du navigateur, aucune dépendance). Un monde établi se génère en quelques dizaines de secondes, avec une barre de progression ; le serveur ne ferait pas tenir ce calcul dans une fonction du plan gratuit.
- **Identifiants déterministes** : `hash128(seed, "figure", n)` mis en forme d'UUID ; même chose pour les lieux et les peuples.
- **Envoi par morceaux** de dix années : `POST /api/worlds/[id]/generation/chunks`, corps validé par Zod (règle 4), réservé au propriétaire du monde, **idempotent** par numéro de morceau. Les écritures passent par `src/server/repos/` sous la RLS ordinaire.
- **La graine** : `world_generations` garde graine, paramètres, `GENERATOR_VERSION` (constante du noyau) et l'empreinte des tables utilisées. Régénérer depuis une graine sur une autre version ou d'autres tables : l'écran prévient que le monde différera.

### 13.5 Le volume

Estimation pour un monde établi, densité moyenne : environ 4 000 figures (0,6 Ko chacune, 2,4 Mo) et 30 000 événements (0,35 Ko, 10 Mo). Un monde très ancien : environ 25 Mo. C'est compatible avec les 500 Mo du plan gratuit pour quelques mondes, pas pour des dizaines : `docs/QUOTAS.md` reçoit la règle (G1).

---

## 14. Ce que voit un joueur (ADR 0080)

`sim_pc_views.view`, écrit par le moteur à la fin de chaque lot et à chaque changement de réglage :

- les couches réglées `player` (§11.1), **en bandes nommées**, jamais en nombres ;
- ses traits, valeurs et rêves (ils lui appartiennent, quels que soient les réglages) ;
- les transformations proposées en attente (H4) ;
- ses croyances : les événements qu'il connaît, **dans la version qu'il croit**, avec la source et la certitude en mots (« vous l'avez vu », « on vous l'a raconté, sans certitude ») ;
- sa réputation par lieu ;
- jamais `is_accurate`, jamais la vérité qu'il ignore.

---

## 15. Ce que l'IA raconte

- Depuis le dernier récit : les événements que le PJ **croit**, dans leur version crue, et les changements visibles chez les figures présentes. Le modèle les raconte en deux à quatre phrases, comme un tour (règle 8).
- Les figures présentes entrent avec leur résumé (psyché §10).
- Rien de ce que le joueur ne peut pas savoir (règle 11). Le MJ humain, lui, reçoit tout.

---

## 16. Les bornes et le budget

| Borne | Valeur de départ | Réglée par |
|---|---|---|
| Figures complètes | 150 | A5 |
| Figures légères vivantes | 5 000 | A5 |
| Événements par pas | 500 | A5 |
| Profondeur de réaction (un événement qui en provoque un autre dans le même pas) | 2 | fixe |
| Actions par figure et par pas | 1, plus une interaction sociale par jour | fixe |
| Temps de calcul par appel serveur | 2 s, puis reprise par `cursor` | A5, `docs/QUOTAS.md` |
| Lignes écrites par tour solo ordinaire | 50 | A5 |

---

## 17. Décisions à valider avec l'auteur

Prises ici pour avancer ; chacune se change sans toucher au reste.

| Décision | Choix fait | Alternative |
|---|---|---|
| Mémoire courte → longue | 90 jours de jeu (réglable) | un an, comme Dwarf Fortress : trop lent pour une campagne |
| Plafond de figures complètes | 150 | à mesurer (A5) |
| Conséquences du corps quand la couche est « MJ seul » | appliquées, visibles comme une condition | laissées au MJ (`body_consequences: "gm"`) |
| Défaire un lot | seulement le dernier | n'importe lequel, au prix d'une reconstruction complète |
| Génération | dans le navigateur | script local, ou serveur par tranches |
| L'IA propose des faits marquants | non en V4 | oui, par `ai_proposals` |
