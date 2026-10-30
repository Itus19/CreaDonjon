# Spécification — Le moteur de simulation

**Version :** 1.1 — 24 octobre 2026 (sexualité, accords, identité perçue, thèmes de table, récit, faits marquants, choix du jet, combat, possessions, tests de génération : ADR 0085 à 0093)
**Tickets :** lots A, C, E, F, G, H de `docs/BACKLOG_V4.md`
**ADR :** 0067 à 0093 · **Psyché :** `specs/psyche-v4.md` · **Sources :** `docs/recherche/simulation-inspirations.md`

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

`personality_events.campaign_id` nul = une retouche de l'**état de départ** (le MJ édite le bloc) ; renseigné = un changement **dans la partie**.

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
  unions: UnionRef[],                                // unions et leur accord (§8.5)
  group_attitudes: Partial<Record<GroupKey, number>>,// écarts à sa culture (§8.6)
  disclosure: Partial<Record<HiddenTrait, { public: Disclosure, trusted: Disclosure }>>, // §8.7
  disguise: Disguise | null,                         // §8.6
}
// Figure légère
{
  __v: 1,
  facets, values, ethics,                            // mêmes cartes, souvent partielles
  dream: Dream | null,
  stress: number,
  links: Link[],
  unions: UnionRef[],
  group_attitudes: Partial<Record<GroupKey, number>>,
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
| `scene` | présente dans `scene_states` | le tour | besoins, émotions, souvenirs de ce qui arrive en scène. Ses **réactions** au tour sont choisies par le moteur dans le vocabulaire de scène (§10.7), jamais par le récit |
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

### 5.2 Le vocabulaire (65 genres)

Chaque genre a un schéma Zod pour `data`, une portée par défaut, une **ampleur** (`harm` ou `benefit`, 0…100, pour l'évaluation §6), l'acte éthique qu'il constitue (psyché §3.2) et ses étiquettes de réputation (§9.5).

| Famille | Genres |
|---|---|
| Vie | `birth`, `death`, `union_formed`, `union_ended`, `romance_began`, `romance_ended`, `migrated`, `came_of_age` |
| Liens | `friendship_formed`, `friendship_ended`, `grudge_formed`, `rivalry_formed`, `reconciliation`, `mentorship_began` |
| Actes envers autrui | `help_given`, `gift_given`, `rescue`, `insult`, `humiliation`, `assault`, `murder`, `kill_in_fight`, `theft`, `betrayal`, `oath_sworn`, `oath_broken`, `lie_told`, `secret_revealed`, `confession`, `infidelity` |
| Accomplissements | `masterwork_created`, `discovery_made`, `skill_mastered`, `position_gained`, `position_lost`, `site_founded` |
| Conflits | `feud_started`, `raid`, `battle`, `duel`, `punished`, `exiled`, `imprisoned`, `freed` |
| Vie intérieure | `dream_born`, `dream_achieved`, `dream_abandoned`, `crisis`, `elan`, `transformation` |
| Intimité | `advance_rejected`, `affair_began`, `affair_discovered`, `scandal`, `vow_broken` |
| Identité et société | `outed` (une appartenance cachée devient connue), `discriminated`, `persecuted`, `disguise_pierced` |
| Thèmes de table (§11.3) | `sexual_assault`, `abducted`, `enslaved`, `tortured` |
| Faits marquants (§5.5, §5.7) | `threatened`, `blackmail`, `loss_noticed` |
| Monde | `monster_attack`, `conversion`, `pilgrimage` |

Ajouter un genre : un ADR, comme pour les événements des déclencheurs (ADR 0070).

### 5.3 Cause et portée

- `cause_id` : l'événement qui a provoqué celui-ci (une insulte → une rancune → un duel). C'est ce qui permet de **rejeter une chaîne** (§12) et de raconter le pourquoi.
- `scope` : `major` entre dans la Chronologie du monde (ADR 0048) sans condition ; `notable` y entre pour le MJ, et pour un joueur s'il le connaît (§9) ; `detail` n'y entre jamais.

### 5.4 Les faits marquants : comment ce que font les PJ entre dans le monde (ADR 0089)

Ce que font les PJ doit entrer dans le monde, sinon personne ne s'en souvient. Quatre sources :

| Source | Chemin |
|---|---|
| **1. La mécanique** | les `session_events` sont traduits au début de chaque lot, par une table pure : une attaque d'un PJ sur une figure → `assault` ; une figure tuée par un PJ → `kill_in_fight` si elle était hostile ou avait attaqué, `murder` sinon ; un soin → `help_given` |
| **2. L'acte déclaré** | la **puce d'acte** de la barre d'intention (§5.5) |
| **3. Les PNJ en scène** | leurs réactions sont **choisies par le moteur** (§10.7) ; en campagne, **suggérées** au MJ |
| **4. Hors de l'application** | la **saisie rapide** du MJ pendant la séance (qui, quoi, sur qui) ; le **journal de séance** après coup, dont le modèle propose des faits que le MJ coche (§5.8) |

Le fait marquant saisi à la main (tiroir de conséquences en solo, outils du MJ en campagne) reste possible pour tout le reste.

### 5.5 La puce d'acte

La barre d'intention (V3-B1) gagne une puce facultative : un **acte** de la liste fermée et une **cible** parmi les figures présentes. Chaque acte correspond à un genre du journal du monde :

| Acte | Genre | Jet demandé (V3-B5), si l'issue est incertaine |
|---|---|---|
| aider, consoler | `help_given` | — |
| offrir | `gift_given` | — |
| sauver | `rescue` | selon la situation |
| promettre | `oath_sworn` | — |
| séduire | `seduce` (action, §8.5) ; `advance_rejected` si refus | Persuasion, puis le consentement de la cible |
| mentir à | `lie_told` | Tromperie contre la Perspicacité passive de la cible |
| menacer | `threatened` | Intimidation |
| insulter | `insult` | — |
| humilier | `humiliation` | selon la situation |
| trahir | `betrayal` | — |
| voler | `theft` | Escamotage contre la Perception passive de chaque présent (§5.6) |
| frapper | `assault` | le jet d'attaque |
| avouer | `confession` | — |
| révéler un secret | `secret_revealed` | — |

- **Le modèle peut pré-remplir la puce** depuis la phrase du joueur (une sortie structurée : un acte de la liste, une cible parmi les présents, jamais un identifiant inventé). Le joueur **confirme d'un geste ou corrige** ; rien n'entre dans le monde sans sa confirmation. Sans modèle, la puce reste vide et le joueur la choisit (règles 8 et 9 : le modèle propose une étiquette, il ne décide rien).
- L'acte entre dans le monde **avec son issue** : un mensonge raté est un `lie_told` découvert.
- Un tour sans puce confirmée n'est pas un fait marquant ; ses effets du quotidien restent possibles (§8.2).
- Les actes d'un thème de table suivent ce thème (§11.3).

### 5.6 Les témoins

Un fait n'a de suite que pour ceux qui le connaissent.

- **Un acte discret** (voler, mentir, révéler un secret à l'oreille) se joue contre la **Perception passive** de chaque figure présente, qui sert de **DD** au jet du PJ (Escamotage, Discrétion, Tromperie). Règle du livre, confirmée par l'auteur le 30 octobre : le PJ réussit s'il fait **égal ou plus** ; un résultat de 15 passe inaperçu devant une Perception passive de 15. La Perception passive vaut 10 + le bonus de Perception (fiche mécanique ou bloc de créature). Une figure sans fiche mécanique prend 10, ajusté par `curiosity` (±2) et `anxiety_propensity` (+1 si forte).
- **Un acte ouvert** est vu de tous les présents.
- Ceux qui perçoivent sont les **témoins** (§6.1, rôle `witness`) ; les autres n'en savent rien.

### 5.7 Les indices, et la découverte après coup

Un acte sans témoin n'est pas perdu :

- **Le constat** : au premier pas où la victime en a l'occasion (elle rentre, elle compte sa bourse, elle cherche l'objet), le moteur produit `loss_noticed` et une croyance « quelqu'un m'a volé » (`zBeliefClaim` avec un acteur **inconnu**, certitude 100 sur l'acte, 0 sur le coupable).
- **La suite** passe par les mécanismes existants : la victime parle (§9.2), les rumeurs courent, un témoin finit par parler ou mentir (§9.4), une enquête (`seek`, `deep_talk`), un aveu (`confess`), une dénonciation (`denounce`). Une croyance qui désigne un coupable peut être fausse.
- **Déduction** : une figure qui croit « on m'a volé » et qui croit aussi « Max était là » peut soupçonner Max (croyance `deduced`, certitude faible), selon sa méfiance et ses préjugés (§8.6).

### 5.8 Le journal de séance

En campagne autour d'une vraie table, le MJ écrit après la séance un résumé en prose. Le modèle en propose une liste de faits : un acte du vocabulaire, des acteurs et des cibles **parmi les figures connues**, une portée, et **la phrase d'où il vient**. Le MJ coche ceux qui sont vrais ; seuls ceux-là entrent dans le monde, par les propositions relues (règle 9). Le texte du journal est encadré comme donnée dans le prompt (règle 10).


### 5.9 Choisir le jet : l'acte, la manière, la cible (ADR 0090)

**L'acte et sa manière, partout.** Un acte dit *quoi* ; la manière dit *comment*, et c'est elle qui choisit la compétence. La puce d'acte (§5.5) pose une deuxième question, « comment ? », dès qu'un acte a plusieurs manières. Table fermée, en données (`ACT_APPROACHES`) :

| Acte | Manières → compétence |
|---|---|
| séduire, convaincre, calmer, obtenir une faveur | sincère, intérêts communs → Persuasion · en feignant, en cachant ses intentions → Tromperie · avec panache, danse, éloquence → Représentation · par la peur → Intimidation |
| obtenir une information | en interrogeant aimablement → Persuasion · en menaçant → Intimidation · en mentant sur son but → Tromperie · en écoutant aux portes → Discrétion, puis Perception |
| ouvrir un passage fermé | en force → Athlétisme · en crochetant → Escamotage, avec outils de voleur · par ruse (clé, prétexte) → Tromperie |
| franchir un obstacle | en escaladant ou sautant → Athlétisme · en souplesse → Acrobaties |
| se cacher, filer quelqu'un | Discrétion |
| calmer un animal | Dressage |
| chercher | du regard, à l'écoute → Perception · en fouillant, en raisonnant → Investigation |

Le modèle peut pré-remplir la manière depuis la phrase (« je lui fais croire que… » → en feignant) ; le joueur confirme ou corrige, comme pour l'acte. **La manière entre dans le fait marquant** : une séduction feinte qui réussit puis est découverte devient une trahison dans la mémoire de la cible ; une séduction sincère, non.

**Faut-il lancer ?** La règle d'influence du Guide du maître 2024, confirmée par l'auteur le 30 octobre (à relire dans le livre en écrivant le ticket), d'après l'état de la cible :

| La cible est… | Comment le moteur le sait | Jet |
|---|---|---|
| **consentante** | la demande sert ses besoins, ses rêves ou ses valeurs, et ne coûte rien à ses éthiques | aucun : c'est accordé |
| **hésitante** | la demande lui coûte, sans heurter une éthique forte | un jet, DD 15 ou son Intelligence si elle est plus haute |
| **réfractaire** | la demande heurte une éthique `shameful` ou `only_extreme`, ou ses intérêts vitaux | impossible sans **levier** (un pot-de-vin, une menace crédible, une aide reçue, une preuve) qui la rend hésitante — ou un **20 naturel** si la table l'a activé |

**Le 20 naturel** (`natural_20_auto_success`, activé par défaut, décision de l'auteur) fait céder une cible réfractaire, **sauf deux limites absolues** : jamais pour un **consentement intime** (§8.5 : le dé ne force jamais un consentement), jamais pour un acte **`unthinkable`** pour la cible (une ligne rouge ne cède pas). Le 1 naturel (`natural_1_auto_failure`) est un réglage séparé.

**Contre quoi.** Un mensonge se joue contre la **Perspicacité passive** de la cible, qui sert de DD (même règle que la Perception passive, §5.6 : égal ou plus réussit). Sinon, le DD de l'influence ci-dessus, ou le DD du ruleset pour l'exploration.

**Avantage et désavantage** (ils s'annulent, sans cumul, selon la règle du livre) : l'attitude de la cible envers le PJ (amicale : avantage ; hostile : désavantage), son émotion du moment (en colère, effrayée), ses besoins (seule : avantage pour la séduction et la compagnie), la manière face à son caractère (qui chérit l'éloquence est sensible au panache ; une figure très méfiante résiste à la Tromperie), ses préjugés envers le PJ (§8.6), la réputation du PJ dans ce lieu (§9.5), l'**aide** d'un allié (action Aider).

**Les tentatives répétées.** La cible se souvient d'avoir été sollicitée : après un échec, la même demande avant le lendemain se fait avec désavantage ; après un deuxième, la cible devient réfractaire pour cette demande. (Dwarf Fortress compte de même les tentatives de persuasion ratées.)

**Les raisons, en trois niveaux.** Le joueur voit pourquoi un jet est facile ou dur, sans qu'on lui révèle un secret : ce qui se **perçoit** s'affiche toujours (« elle semble en colère ») ; ce que le PJ **croit savoir** s'affiche avec sa certitude (« elle te connaît comme voleur ») ; le reste n'apparaît que si la **Perspicacité passive** du PJ le perce.

**Les jets de groupe et l'aide.** Une action menée à plusieurs (une infiltration) est un jet de groupe : la moitié des participants doit réussir. Un allié qui aide donne l'avantage.

**Changer de caractéristique.** Une compétence peut s'associer à une autre caractéristique quand la manière le dit (intimider par la Force, `skill_ability_swap`) : le moteur le propose, le joueur ou le MJ confirme.

**Le succès à un prix** (`success_at_cost`, réglage de table) : un échec de 1 ou 2 peut devenir une réussite avec une complication, tirée d'une liste fermée selon le contexte : du temps perdu, une ressource dépensée, l'attention attirée, un témoin de plus, une cible qui en gardera un mauvais souvenir. Le joueur accepte le prix ou garde l'échec.

**Un PNJ qui tente quelque chose sur un PJ.** Même mécanisme dans l'autre sens : un marchand qui ment joue sa Tromperie contre la Perspicacité passive du PJ. Mais **un jet ne décide jamais à la place d'un joueur** : une Persuasion réussie sur un PJ donne une impression, une information ou une raison (le PJ croit le mensonge, sent la menace) ; elle ne dicte pas ce que le PJ fait. Ce que le PJ croit à tort entre dans ses croyances (`lied_to`), sans la vérité.

**Les rôles.**

| Qui | Ce qu'il fait |
|---|---|
| Le modèle d'IA | propose l'acte, la manière et la cible ; jamais le DD, l'avantage ni le résultat (règle 8) |
| Le moteur, en solo | dit s'il faut lancer, fixe le DD et l'avantage, avec leurs raisons |
| Le MJ, en campagne | décide ; le moteur lui **suggère** compétence, DD et avantage, comme pour les réactions (§10.7) |
| Le joueur | confirme ou corrige avant de lancer, et lance lui-même (V3-B5) |

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
| **Longue** | 8 | un souvenir court y entre au bout de **90 jours** de jeu (réglable de 30 à 365 jours au jour près, §11.1 ; 365 pendant la génération), ou **aussitôt** si son intensité est ≥ 80. Il n'y entre que s'il est plus fort que celui qu'il remplacerait |
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

### 7.5 Le trauma, et la guérison

Un souvenir d'intensité ≥ 80 dans les familles peur, honte, désespoir ou horreur est **traumatique** : il entre aussitôt en mémoire longue, revient à chaque rencontre de l'agresseur ou au retour sur le lieu, et ses groupes sont formateurs (confiance, `hopefulness`, `bravery`, et pour une violence sexuelle `sex_attitude` peut passer à `averse`).

**La guérison**, absente de Dwarf Fortress : chaque fois qu'un souvenir traumatique revient pendant qu'une figure de confiance (confiance ≥ 34) est présente et réconforte (`comfort`, `deep_talk`), ou dans un lieu sûr (§8.7), son intensité baisse de 5. Il ne descend jamais sous 30 : le trauma s'apaise, il ne s'efface pas. Le besoin `tenderness` comblé accélère la baisse. Aider quelqu'un à se reconstruire devient une histoire.

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

### 8.5 L'intime (E7, ADR 0087, 0088)

**Deux règles absolues**, au-dessus de tout réglage :
- aucune attirance, aucune action intime, aucun récit intime, aucun contenu sexuel ne concerne jamais une personne mineure, sous aucune forme, même saisi à la main. L'âge adulte est un paramètre du monde (18 par défaut), vérifié avant tout le reste ;
- **le consentement est une condition du moteur** : une action intime n'aboutit que si l'autre personne l'accepte, selon son propre état (attirance, `intimacy`, `sex_attitude`, accord de ses unions, éthiques). Un refus est un événement (`advance_rejected`). Le seul acte sans consentement du vocabulaire est `sexual_assault`, qui relève des thèmes de table (§11.3).

**L'attirance** : seulement si `romance_simulation` (romantique) ou `sexuality_simulation` (sexuelle) est actif, et si le groupe de genre **perçu** de la cible (§8.6) est dans l'ensemble d'attirance de la personne, séparément pour le romantique et le sexuel. Croissance pendant les interactions selon `love_propensity` (romantique) ou `lust_propensity` (sexuelle), la compatibilité, l'amitié et les préférences `attraction`. Les nuances demi et gris exigent une familiarité ≥ 60.

**La romance** : attirance romantique ≥ 34 des deux côtés, puis `court` accepté. **L'intimité** : attirance sexuelle ≥ 34 et `seduce` accepté, ou `share_intimacy` entre partenaires dont l'accord le permet ; elle comble `intimacy` (et `tenderness`) et donne `fulfillment`. Une intimité entre partenaires ne s'écrit pas au journal du monde : elle comble un besoin, comme un repas.

**Les unions** ont une **structure** et un **accord** :

| Structure | Forme |
|---|---|
| `pair` | deux personnes |
| `centered` | une personne au centre, plusieurs partenaires qui ne sont pas partenaires entre eux : polygynie, polyandrie, **harem** d'hommes ou de femmes |
| `group` | plusieurs personnes toutes liées entre elles (trouple, polyfidélité) |

Une structure non acceptée par la norme du lieu (`culture.norms`) est jugée (§8.7). Un membre **contraint** d'une union relève de la traite (§11.3) ; sa dimension sexuelle, des violences sexuelles, toujours voilées.

```ts
accord = { romantic_exclusive: boolean, sexual_exclusive: boolean, sexual_shared: boolean, primary_ids: uuid[] }
```

L'accord se fixe à l'union depuis les orientations relationnelles (la plus exigeante des deux l'emporte, sauf `polyaccepting`) et se renégocie par un événement :

| Orientation | Accord par défaut | Rupture de l'accord (`infidelity`) | Réaction quand un partenaire noue une autre relation **dans** l'accord |
|---|---|---|---|
| `monogamous` | romantique et sexuel exclusifs | toute autre relation | — (hors accord : jalousie 60 × (1 + `envy_propensity`/100), confiance −25, rupture possible) |
| `polyaccepting` | exclusif pour soi, libre pour l'autre | une relation cachée | jalousie 10 |
| `open_relationship` | romantique exclusif, sexuel libre | tomber amoureux ailleurs ; enfreindre les règles convenues (secret, personnes exclues) | jalousie 10 si sexuelle ; 50 si elle devient romantique |
| `libertine` | romantique exclusif, sexualité **partagée ensemble** | une relation sexuelle hors du cadre partagé, en cachette | aucune si partagée ; petite joie |
| `poly_hierarchical` | non exclusif, `primary_ids` | ce qui menace le lien principal sans le dire | jalousie 15 ; 50 si le lien principal est menacé |
| `poly_non_hierarchical` | non exclusif | une relation cachée | jalousie 5 × (1 + `envy_propensity`/100), et compersion |
| `solo_poly` | non exclusif, ni foyer commun ni lien principal | une relation cachée | jalousie 5 ; refuse une union `pair` avec cohabitation |
| `relationship_anarchy` | aucun accord par défaut | ce qui a été convenu explicitement, s'il y en a | seule `envy_propensity` joue, à 5 |
| absente | la norme de sa culture, sinon `monogamous` | | |

Une incompatibilité d'orientations entre partenaires ajoute un peu de stress chaque mois tant qu'elle n'est pas renégociée.

### 8.6 Ce qui se voit, et les préjugés (ADR 0086)

**Percevoir.** À la première rencontre, une figure reçoit des croyances `witnessed` (certitude 90) sur les **traits perceptibles** de l'autre (psyché §9.6) : espèce, âge apparent, expression de genre, marques visibles, marques culturelles. Un **déguisement** (`disguise`, d'une trousse ou d'un sort) remplace ces traits par d'autres, pour une durée. Le percer est un événement `disguise_pierced`, tranché par un jet du moteur selon le ruleset (règle 8), quand une figure a une raison de douter (proximité, familiarité, incohérence). Le **groupe de genre perçu** sert à l'attirance (§8.5) : on est attiré par ce qu'on perçoit.

**Les attitudes envers les groupes.** Un groupe (`GroupKey`) est une espèce, un peuple, une faction, une religion, ou une appartenance cachée (une orientation, une identité de genre). Chaque figure a une attitude −100…+100 envers chaque groupe :
- **héritée de sa culture** (`culture.group_attitudes`), elle-même nourrie par l'histoire : chaque guerre, raid ou persécution entre deux peuples pendant la génération déplace leurs attitudes mutuelles (§13.3). Deux peuples qui se sont battus un siècle se méfient l'un de l'autre au début de la partie, sans qu'on l'ait écrit ;
- **modulée par l'individu** : × (1 − `tolerance`/200) × (1 − `open_mindedness`/200) ;
- **nourrie par l'expérience** : un tort subi de la part d'un membre déplace l'attitude envers tout son groupe de −(intensité/10) × (1 − `open_mindedness`/100) (la généralisation abusive) ; un bon contact répété la remonte de +1 par semaine d'amitié (l'hypothèse du contact d'Allport).

**Effets** : la première impression (confiance et amitié de départ + attitude/4), les actions `discriminate` (refuser de servir, exclure, insulter) et `denounce`, la façon dont les normes sont appliquées (§8.7). Une figure n'agit jamais sur une appartenance qu'elle **ne croit pas** : on ne discrimine que ce qu'on perçoit ou croit savoir.

### 8.7 Les normes, ce qu'on montre, et les vies cachées (ADR 0086)

**Les normes** (`culture.norms`, avec un écart individuel par les valeurs et `tolerance`) jugent des **conduites connues**, jamais des personnes : `same_sex_relations`, `gender_nonconformity`, `non_monogamy` (et les structures `centered` et `group`), `sex_outside_union`, `sex_work`, plus les groupes visibles (`foreign_species`, `foreign_people`). Réponse par norme : `accepted`, `tolerated`, `disapproved`, `repressed` (punition), `persecuted`. Le réglage `identity_norms` (§11.1) peut les désactiver pour tout un monde.

**Ce qu'on montre.** Chaque appartenance cachée a un **degré d'ouverture** par contexte, public et cercle de confiance : `hidden`, `discreet`, `open`. La figure le choisit par utilité : risque local (la norme et les attitudes des présents), besoins (`romance`, `intimacy`), `confidence`, `bravery`, `privacy`, valeur `truth`. **Vivre caché coûte du stress** (le stress minoritaire) : +1 par semaine pour chaque appartenance `hidden` contre un besoin pressant qu'elle concerne.

**Les croyances sur les appartenances cachées** naissent d'une conduite vue (une romance surprise), d'une confidence, d'une rumeur, ou d'une **fausse accusation** (§9.4). Quand une telle croyance se répand dans un lieu qui réprime : `outed`, puis `scandal`, `discriminated`, `punished`, `exiled` ou `persecuted` selon la norme ; et des alliés qui protègent (rêve `protect`).

**Les lieux sûrs.** Un lieu peut être `safe_for: GroupKey[]` et **secret** : connu seulement de ceux qui en ont la croyance. On y est `open` sans risque, on s'y rencontre, on y guérit (§7.5). Une figure qui en a besoin le cherche (`seek_safe_place`), comme on cherche un temple ; la génération peut en faire naître dans les lieux répressifs.

**L'union de façade.** `union_formed` avec `data.arranged = true` et un motif (`facade`, `politics`, `wealth`) : un vrai mariage pour tout le monde, sauf pour ceux qui savent.

**Les PJ** suivent les mêmes règles si `pcs_concerned.identity` est vrai (défaut). Sinon, le monde reste le même pour les PNJ, mais aucune norme ni aucun préjugé ne vise un PJ.

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

Chaque genre d'événement porte des étiquettes : `hero`, `protector_of_weak`, `generous`, `murderer`, `thief`, `liar`, `oathbreaker`, `coward`, `brawler`, `monster_slayer`, `healer`, `traitor`, `seducer`, `libertine`, `faithful`. Comment un lieu juge chaque étiquette dépend de ses valeurs et de ses normes. La réputation d'une figure dans un lieu = somme, sur les croyances de ce lieu dont elle est actrice, de (poids de l'étiquette × certitude). Elle s'affiche en bandes (« à Port-Gris, on te connaît comme voleur — fort »). **C'est la mémoire collective du joueur.**

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

Intimité et société : `seduce`, `share_intimacy`, `seek_encounter` (taverne, maison close si l'éthique `sex_work` le permet), `refuse_advance`, `confide_desire`, `discriminate`, `denounce`, `seek_safe_place`, `don_disguise`.

Thèmes de table, **seulement** si le thème est en position `veiled_generated` ou `shown` (§11.3) : `sexual_assault` (jamais au-delà de `veiled_generated`), `abduct`, `torture`. Comme toute action, elles sont retirées par une éthique `unthinkable` : seule une figure dont la psyché le rend possible (compassion très basse, violence haute, éthique personnelle qui ne l'exclut pas) les choisit.

Un **rêve** a un petit plan en données : `avenge(X)` = trouver où est X (`seek`, ou demander : `deep_talk`) → s'y rendre (`travel`) → `confront` ou `attack`. L'étape courante reçoit la considération « rêve ».

### 10.5 Le vocabulaire des figures légères (pas mensuel)

`seek_union`, `arranged_union`, `have_child`, `migrate`, `take_position`, `found_site`, `feud`, `raid`, `persecute`, `commit_crime`, `create_masterwork`, `make_discovery`, `convert`, `betray`, `reconcile` ; et, selon les thèmes, `abduct` et `enslave`. La mort n'est pas une action : c'est un tirage de mortalité selon l'âge (courbe par espèce, du ruleset ou du monde) et la violence subie.

### 10.6 Ce que la simulation ne fait jamais

- **Faire agir un PJ.** Un PJ est cible, témoin, sujet de rumeurs ; jamais acteur d'une action simulée.
- Faire agir une figure **figée** (§11.2).
- Faire agir une figure en classe `scene` hors du vocabulaire de scène (§10.7).
- Générer un acte d'un thème absent, ou au-delà de sa position (§11.3).
- Faire d'un PJ la victime d'un acte de thème de table **généré** : seul le MJ peut l'enregistrer, et seulement si `pcs_concerned` l'accepte pour ce thème.
- Quoi que ce soit de sexuel impliquant un mineur.
- Dépasser les bornes (§16).


### 10.7 Réagir en scène (ADR 0089)

Quand le tour produit un fait (un acte du joueur, un jet, un événement mécanique), chaque figure présente **concernée** (cible, témoin, liée à la cible ou à l'acteur) choisit une réaction, par le même score d'utilité (§10.3) que les autres actions, dans un vocabulaire réduit :

| Famille | Réactions |
|---|---|
| Face à un acte qui la vise | accueillir, aider, accepter, refuser, se méfier, céder, menacer, insulter, riposter, fuir, attaquer |
| Témoin d'un acte | dénoncer à voix haute, prévenir la victime en secret (`warn_secretly` : une croyance transmise), se taire, faire chanter l'acteur plus tard (`blackmail` : un événement et un rêve qui le vise), s'en mêler, proposer de s'associer |

- Le score lit sa psyché, ses éthiques (une réaction `unthinkable` est retirée), ses liens avec l'acteur et la victime, son état du moment, ses préjugés (§8.6).
- **En solo**, la réaction est appliquée et entre au journal du monde ; le modèle la **raconte**, il ne la choisit pas.
- **En campagne avec un MJ**, la réaction est une **suggestion** dans ses outils (« Aude préviendrait probablement Bram en secret ; puis : dénoncer, se taire »), avec ses raisons. Le MJ la retient, en choisit une autre, ou joue librement ; ce qu'il retient entre au journal du monde.
- Bornes : une réaction par figure et par fait ; au plus six figures réagissent à un même fait (les plus concernées).


### 10.8 Combattre (ADR 0092)

En solo, l'action d'un PNJ en combat est choisie par le moteur, avec le même score d'utilité, dans un vocabulaire de combat : attaquer (qui), se défendre, protéger un allié, se replier, fuir, se rendre, parlementer, achever ou épargner un adversaire à terre, utiliser un objet ou un sort de sa fiche.

- **La morale** : une jauge de combat, calculée (jamais stockée), qui part de `bravery` et baisse avec les PV perdus, les alliés tombés, la peur ressentie, et remonte avec un chef présent ou un rêve en jeu (protéger quelqu'un, garder un butin). Sous un seuil, fuir ou se rendre l'emportent : un PNJ trouillard fuit à mi-PV, un fanatique se bat jusqu'au bout, un mercenaire se rend quand la paie ne vaut plus le risque.
- **Les cibles** : la menace, la rancune envers un PJ (§7), les préjugés (§8.6), la protection d'un proche.
- **Les éthiques** : un PNJ pour qui `kill_in_fight` d'un adversaire à terre est `shameful` l'épargne ; `unthinkable` retire l'action.
- Les règles (attaques, sorts, économie d'action) restent celles du moteur de combat existant ; le score ne fait que choisir parmi ce que la fiche permet.
- Ces choix laissent des souvenirs : l'ennemi épargné peut revenir reconnaissant ou rancunier.
- **En campagne**, comme les réactions (§10.7), c'est une **suggestion** au MJ.

### 10.9 Posséder (ADR 0092)

Un vol, un cadeau, un achat, un butin **déplacent un vrai objet**.

- **Figure complète** : son bloc `inventory` réel. Le moteur y écrit lui-même les transferts (comme il écrit les effets d'un tour), dans la même transaction que l'événement du monde (`theft`, `gift_given`…), avec `world_event_id` en trace.
- **Figure légère** : une jauge `wealth` (0…100) et une liste d'**objets notables** (un artefact, une relique, une arme connue), qui deviennent de vrais objets d'inventaire à la promotion (§4.1).
- Le besoin `acquisition`, le rêve `acquire`, la réputation `thief` et les indices (§5.7 : la victime constate une absence) lisent ces possessions.

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
  memory_promotion_days: number,             // 30 à 365, au jour près ; défaut : 90
  adult_age: number,                         // défaut : 18
  sexuality_simulation: boolean,             // défaut : true
  identity_norms: boolean,                   // défaut : true (normes et préjugés, §8.6-8.7)
  pcs_concerned: {
    identity: boolean,                       // défaut : true
    sexual_violence: boolean,                // défaut : false
    trafficking: boolean,                    // défaut : true
    torture: boolean,                        // défaut : true
  },
  pc_layers_intimacy: "player" | "gm" | "off",   // la couche intimité des PJ ; défaut : "player"
  themes: {
    sexual_violence:      "absent" | "veiled" | "veiled_generated",            // défaut : "absent"
    trafficking:          "absent" | "veiled" | "veiled_generated" | "shown",  // défaut : "veiled"
    torture:              "absent" | "veiled" | "veiled_generated" | "shown",  // défaut : "veiled"
    violence_to_children: "absent" | "veiled" | "veiled_generated",            // défaut : "absent"
  },
  rolls: {
    natural_20_auto_success: boolean,        // défaut : true (décision de l'auteur) ; limites : §5.9
    natural_1_auto_failure: boolean,         // défaut : false
    success_at_cost: boolean,                // défaut : true
    skill_ability_swap: "off" | "gm" | "everyone",  // défaut : "everyone"
  },
  gm_suggestions: boolean,                   // campagne : le moteur suggère réactions, combat, jets ; défaut : true
  narration: {
    violence_detail: "sober" | "descriptive" | "graphic",   // défaut : "descriptive"
    tone: "heroic" | "grim" | "horror" | "cosmic_horror" | "light",  // défaut : "heroic"
  },
}
```

- `off` pour une couche de PJ : la couche n'est **pas simulée** pour les PJ et n'a aucune conséquence. Les PNJ la gardent.
- `gm` : simulée, visible du MJ seul, absente de `sim_pc_views`.

### 11.2 Figée par le MJ

`sim_figures.frozen` : jamais actrice, jamais transformée. `frozen_can_remember` : elle peut encore être témoin et se souvenir. Par défaut, une figure créée à la main par le MJ **avant** l'activation de la simulation est figée si le MJ coche « garder mes PNJ tels quels » à l'activation.

### 11.3 Les thèmes de table et le récit (ADR 0085)

Les outils de sécurité du jeu de rôle, appliqués au moteur : une **ligne** n'existe jamais, un **voile** existe hors champ.

| Position | Existe dans le monde | Qui le produit | Le récit |
|---|---|---|---|
| `absent` | non | personne : ni généré, ni saisissable | — |
| `veiled` | oui | le MJ seul (fait marquant) | les conséquences seulement, jamais l'acte |
| `veiled_generated` | oui | le MJ et la simulation | les conséquences seulement |
| `shown` | oui | le MJ et la simulation | selon `violence_detail` |

- **Violences sexuelles** et **violence envers les enfants** plafonnent à `veiled_generated` : jamais racontées, même avec un récit intime explicite ou une violence crue. Aucun contenu sexuel impliquant un mineur, sous aucune forme.
- Ce qu'on en perçoit passe par les conséquences : souvenirs et trauma (§7.5), récits indirects, rumeurs, silences et mensonges (§9), réputation, justice ou impunité.
- **La violence ordinaire** (un combat, la mort d'un adversaire) n'est pas un thème : elle se raconte selon `violence_detail` (`sober` : l'issue ; `descriptive` : le geste et ses effets ; `graphic` : sans détour). Le `tone` donne la couleur du récit ; `horror` et `cosmic_horror` s'appuient sur la psyché (terreur, stress, crises, souvenirs fondateurs : c'est déjà la santé mentale).
- **Un fournisseur d'IA distant** peut refuser un récit cru que la table a choisi ; un modèle local, non. L'écran le dit quand c'est le cas, et le tour continue avec un récit plus sobre.

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

- Un **peuple** est une entité `faction` avec un bloc `worldview` (valeurs, éthiques de la culture) et un bloc nouveau `culture` : espèce (une entrée d'espèce du ruleset), tendances de facettes, norme relationnelle, structures d'union acceptées, normes (§8.7), attitudes envers les autres groupes (§8.6), table de noms (le générateur Noms existant), âge adulte et longévité.
- Un **lieu** est une entité de lieu, rattachée à un peuple, avec une taille. Les détails (taverne, échoppe) se génèrent à la visite, avec les générateurs existants.

### 13.3 La boucle d'histoire

Un pas par mois de jeu sur `history_years` : mortalité, unions et naissances, actions légères (§10.5), attaques de monstres, querelles entre chefs de lieux (querelle → raid → bataille), migrations quand un lieu va mal, fondations quand il déborde, successions à la mort d'un chef. Chaque événement s'écrit avec `origin = 'generation'`. Les guerres, raids et persécutions entre peuples déplacent leurs `group_attitudes` mutuelles ; les normes se durcissent ou s'adoucissent avec les crises et les conversions. La mémoire longue utilise un délai de 365 jours. Les thèmes de table s'appliquent aussi à la génération.

À la fin : les figures vivantes qui comptent au départ (chefs des lieux de départ, auteurs d'actes notables des 30 dernières années, au plus 60) sont promues complètes (§4.1). En solo, le joueur choisit son lieu de départ parmi les lieux générés.

### 13.4 Où elle tourne, et comment elle arrive en base

- **Dans le navigateur**, dans un *Web Worker* (API du navigateur, aucune dépendance). Un monde établi se génère en quelques dizaines de secondes, avec une barre de progression ; le serveur ne ferait pas tenir ce calcul dans une fonction du plan gratuit.
- **Identifiants déterministes** : `hash128(seed, "figure", n)` mis en forme d'UUID ; même chose pour les lieux et les peuples.
- **Envoi par morceaux** de dix années : `POST /api/worlds/[id]/generation/chunks`, corps validé par Zod (règle 4), réservé au propriétaire du monde, **idempotent** par numéro de morceau. Les écritures passent par `src/server/repos/` sous la RLS ordinaire.
- **La graine** : `world_generations` garde graine, paramètres, `GENERATOR_VERSION` (constante du noyau) et l'empreinte des tables utilisées. Régénérer depuis une graine sur une autre version ou d'autres tables : l'écran prévient que le monde différera.

### 13.5 Le volume

Estimation pour un monde établi, densité moyenne : environ 4 000 figures (0,6 Ko chacune, 2,4 Mo) et 30 000 événements (0,35 Ko, 10 Mo). Un monde très ancien : environ 25 Mo. C'est compatible avec les 500 Mo du plan gratuit pour quelques mondes, pas pour des dizaines : `docs/QUOTAS.md` reçoit la règle (G1).


### 13.6 Tester un monde (ADR 0093)

Comme Dwarf Fortress, qui **rejette** un monde qui ne respecte pas ses seuils et recommence, et qu'on juge à l'œil dans le mode Légendes.

1. **Contrôles de cohérence** (`checkWorldConsistency`, pur), à la fin de chaque génération et dans les tests : personne n'agit après sa mort ; aucun parent n'est plus jeune que son enfant ; aucune union ni aucun contenu intime avec un mineur ; aucun lieu dirigé par un mort ; toute chaîne `cause_id` remonte à un événement existant ; aucun événement d'un thème absent. **Un échec est un bogue** : le test échoue, la génération s'arrête avec une erreur, jamais en silence.
2. **Le rejet** (`isWorldAlive`) : au moins deux peuples vivants, une population finale entre ×0,3 et ×5 de celle de départ, un minimum de figures et de chaînes notables. Un monde raté est **régénéré automatiquement et en silence** avec la graine dérivée suivante (`hash(seed, "retry", n)`, au plus 5 essais), décision de l'auteur ; la graine retenue est celle qui est enregistrée, pour que la régénérer redonne ce monde.
3. **Le banc de 100 mondes** (tests du noyau, sans base) : des distributions (populations, guerres, durées de vie, liens, profondeur des chaînes) qui doivent rester dans des fourchettes. Une modification du code qui casse l'équilibre se voit tout de suite.
4. **Le rapport de génération** : la page des Légendes (G6) gagne des courbes (population par peuple, conflits par siècle), les figures marquantes et les plus longues chaînes de causes, pour juger à l'œil.
5. **L'indice d'intérêt** : la profondeur moyenne des chaînes de causes et le nombre de fils qui traversent plusieurs générations. Un monde vivant mais plat se mesure, et le banc le surveille.

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

*Le contrat complet du contexte assemblé, la captation de ce que la narration invente, les fils ouverts, le contrôle après coup et la reprise : `specs/memoire-du-recit.md`.*

- Depuis le dernier récit : les événements que le PJ **croit**, dans leur version crue, et les changements visibles chez les figures présentes. Le modèle les raconte en deux à quatre phrases, comme un tour (règle 8).
- Les figures présentes entrent avec leur résumé (psyché §10).
- Les consignes de récit : `violence_detail`, `tone`, `intimate_narration`, et pour chaque thème voilé, l'interdiction de décrire l'acte.
- **Le modèle peut proposer le passé d'un méchant** (une esquisse de PNJ, V3-C2, relue comme toute proposition), y compris un passé lié à un thème en position `veiled_generated` ou `shown`, toujours voilé. Il ne décide jamais d'un tel acte dans la partie en cours.
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
| Mémoire courte → longue | curseur de 30 à 365 jours, 90 par défaut ; 365 en génération | **validé le 22 octobre** |
| Plafond de figures complètes | 150 | à mesurer (A5) |
| Conséquences du corps quand la couche est « MJ seul » | appliquées, visibles comme une condition | laissées au MJ (`body_consequences: "gm"`) |
| Défaire un lot | seulement le dernier | n'importe lequel, au prix d'une reconstruction complète |
| Génération | dans le navigateur | script local, ou serveur par tranches |
| L'IA propose des faits marquants | oui, sous forme de propositions confirmées : la puce d'acte pré-remplie, le journal de séance (§5.5, §5.8) | **validé le 30 octobre** |
| Le 20 naturel face à un PNJ réfractaire | le fait céder, sauf consentement intime et acte `unthinkable` (§5.9) | **à confirmer par l'auteur** |
| Réactions des PNJ en scène, en campagne | suggérées au MJ, qui décide (§10.7) | **validé le 30 octobre** |
