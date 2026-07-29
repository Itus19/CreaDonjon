# Spécification — Couche règles

**Version :** 0.1 — 29 juillet 2026
**Statut :** Conception arrêtée, à implémenter en V1 (les tables sont à créer dès la Phase 0)
**Amende :** `Phase0_Schema_Technique_v0_3.md` §9 · `Project_Design_Document_v0_2.md` §8, §9, §29

---

## 0. Pourquoi ce document existe

Le PDD affirme trois choses que ni lui ni le schéma technique ne spécifiaient :

1. « Les règles doivent être personnalisables » — sans dire **comment une variante surcharge sa base**, ni ce qui se passe quand on modifie une règle pendant une campagne en cours.
2. « L'IA doit utiliser le minimum de contexte » — sans définir **le contrat entre le moteur de règles et l'IA**, qui est pourtant l'endroit où se joue l'essentiel du gain.
3. « Les règles peuvent être des entités interconnectées » — sans **aucune table pour les relier**, ni format de fiche.

`human_readable jsonb` et `structured_data jsonb` étaient des cases vides. Ce document les remplit.

---

## 1. Anatomie d'une fiche de règle

Une fiche a **quatre faces**, pas deux. La quatrième est celle qu'on oublie toujours et qui détermine le coût du mode solo.

| Face | Colonne | Lecteur | Contrainte |
|---|---|---|---|
| Lisible | `human_readable` | l'humain à la table | jamais interprétée par le moteur |
| Structurée | `structured_data` | le moteur de règles | exécutable, validée par Zod |
| Renvois | table `ruleset_entry_refs` | navigation, IA, moteur | en grande partie déduite |
| Résumé IA | `ai_digest` | le modèle | ≤ 120 tokens, généré, révisable |

### 1.1 Face lisible

```json
{
  "name": "Boule de feu",
  "flavor": "Un trait lumineux jaillit de votre doigt tendu…",
  "summary": "8d6 dégâts de feu dans une sphère de 6 m, moitié si sauvegarde réussie.",
  "description": [
    { "id": "d1", "text": "Chaque créature dans la zone…", "visibility": { "level": "public" } }
  ],
  "usage_notes": "Les objets inflammables non portés s'enflamment.",
  "examples": ["Trois gobelins dans un couloir de 3 m : tous sont dans la zone."]
}
```

Le `flavor` est séparé du `summary` volontairement : le premier est de l'ambiance, le second est ce qu'on lit au milieu d'un combat. Les confondre produit des fiches qu'on n'arrive pas à consulter vite.

`description` réutilise la structure en segments du wiki. Une règle peut donc contenir un passage visible du seul MJ — ce qui est exactement ce qu'il faut pour une variante maison à surprise.

### 1.2 Face structurée

```json
{
  "schema_version": 1,
  "params": {
    "level": 3,
    "school": "evocation",
    "casting_time": { "type": "action", "count": 1 },
    "range": { "type": "point", "distance": { "value": 45, "unit": "m" } },
    "area": { "shape": "sphere", "radius": { "value": 6, "unit": "m" } },
    "components": ["v", "s", "m"],
    "duration": { "type": "instantaneous" }
  },
  "effects": [
    {
      "id": "e1",
      "trigger": "on_cast",
      "targets": "creatures_in_area",
      "save": {
        "ability": "dex",
        "dc": { "op": "ref", "name": "spell_save_dc" },
        "on_success": "half_damage"
      },
      "damage": {
        "formula": { "op": "dice", "count": 8, "faces": 6 },
        "type": "fire"
      }
    }
  ],
  "scaling": {
    "by_slot_level": {
      "e1.damage.formula": { "op": "dice", "count": 1, "faces": 6 }
    }
  }
}
```

Points de conception qui comptent :

- **Les formules sont des AST**, jamais des chaînes. Cohérent avec la section 20 du schéma technique.
- **Chaque effet a un `id`.** Sans lui, la montée en niveau ne peut pas désigner ce qu'elle modifie, et une surcharge ne peut pas viser un effet précis.
- **`schema_version`** permet de faire évoluer la forme sans deviner à la lecture.
- **Les unités sont explicites.** Le SRD est en pieds, l'interface est en mètres : stocker un nombre nu garantit une erreur de conversion un jour.

### 1.3 Face renvois

Chaque référence sortante est une ligne, avec une provenance :

| Renvoi | Provenance |
|---|---|
| `uses_rule → saving_throw` | déduit (présence d'un `save`) |
| `uses_rule → spell_save_dc` | déduit (référence `{spell_save_dc}` dans un AST) |
| `damage_type → fire` | déduit (champ `damage.type`) |
| `see_also → burning_hands` | déclaré par l'auteur |

**La règle de conception :** tout ce qui est déductible de la structure **est déduit**. L'auteur ne déclare que ce que la structure ne peut pas savoir : les renvois d'usage, les analogies, les précisions.

C'est ce qui fait qu'un graphe de règles reste juste. Un graphe maintenu à la main diverge de la réalité en trois semaines.

### 1.4 Face résumé IA

```
Boule de feu (sort niv. 3, action, 45 m). Sphère r=6 m. Sauvegarde DEX
contre DD de sort ; échec = 8d6 feu, réussite = moitié. +1d6 par niveau
d'emplacement au-dessus du 3.
```

Généré à la création ou à la modification, révisable par l'utilisateur, jamais envoyé aux joueurs. Il ne sert qu'à une chose : quand le modèle a réellement besoin de **raisonner** sur une règle (un cas limite, une interaction inhabituelle), on lui envoie 71 tokens plutôt que 890.

Dans le fonctionnement normal, il n'est pas envoyé du tout — voir §4.

---

## 2. Le graphe de règles

### 2.1 Table

```sql
create table ruleset_entry_refs (
  id            uuid primary key default gen_random_uuid(),
  source_entry_id uuid not null references ruleset_entries(id) on delete cascade,
  target_key    text not null,        -- clé, pas id : survit à la surcharge
  target_entry_id uuid references ruleset_entries(id) on delete set null,
  ref_kind      text not null check (ref_kind in
                  ('uses_rule','applies_condition','damage_type','requires',
                   'replaces','see_also','part_of','grants')),
  origin        text not null check (origin in ('derived','declared')),
  path          text,                 -- 'effects.e1.save.dc', pour surligner dans la fiche
  note          text,
  created_at    timestamptz not null default now(),
  unique (source_entry_id, target_key, ref_kind, coalesce(path,''))
);

create index refs_source_idx on ruleset_entry_refs (source_entry_id);
create index refs_target_idx on ruleset_entry_refs (target_key, ref_kind);
```

**`target_key` plutôt que `target_entry_id` comme référence principale.** C'est le point subtil : si une variante surcharge `saving_throw`, tous les renvois doivent pointer vers la version résolue dans le ruleset courant, pas vers la ligne d'origine. La clé est stable à travers la chaîne d'héritage ; l'identifiant ne l'est pas. `target_entry_id` n'est qu'un cache de résolution.

### 2.2 Recalcul des renvois déduits

À chaque écriture d'une entrée : parcourir `structured_data`, extraire toute référence (`{ref}` dans un AST, `damage.type`, `condition_id`, `requires`), remplacer l'ensemble des lignes `origin='derived'` de cette entrée. Les lignes `declared` ne sont jamais touchées.

L'extracteur vit dans `src/core/rules/refs.ts` — fonction pure, testable sans base.

### 2.3 Ce que le graphe donne gratuitement

- **Renvois sortants** dans la fiche, avec le chemin surligné dans la structure.
- **Renvois entrants** (« 6 règles appellent celle-ci »), recalculés, jamais saisis.
- **Analyse d'impact avant modification** : « vous modifiez `saving_throw`, 47 règles en dépendent ».
- **Détection de règle orpheline** : aucune entrée entrante, aucune sortante — probablement inutilisée ou mal saisie.
- **Fermeture bornée pour l'IA** : voir §4.3.
- **Continuité avec le wiki** : le même module `linker` détecte les noms de règles dans un texte narratif. Une fiche de PNJ mentionnant « boule de feu » propose le lien vers la règle. C'est là que le wiki et le moteur cessent d'être deux systèmes.

---

## 3. Règles personnalisables : le modèle de surcharge

### 3.1 Trois options, et pourquoi la troisième

| Option | Description | Verdict |
|---|---|---|
| **A. Copie complète** | La variante duplique les ~2 000 entrées de sa base | Simple, mais un erratum de la base ne remonte jamais, et 2 000 lignes par variante |
| **B. Différentiel intégral** | La variante ne stocke que des patchs, résolus à la lecture | Compact, mais résolution complexe pour *tout*, y compris ce qui n'a pas bougé |
| **C. Surcouche** | La variante stocke uniquement ce qu'elle change : remplacements, patchs, désactivations, ajouts | **Retenue** |

La surcouche donne la propriété qu'on veut vraiment : **une variante maison typique tient en quinze lignes**, et reste connectée à sa base.

### 3.2 Table

```sql
create table ruleset_overrides (
  id             uuid primary key default gen_random_uuid(),
  ruleset_id     uuid not null references rulesets(id) on delete cascade,
  entry_key      text not null,
  action         text not null check (action in ('replace','patch','disable','add')),
  human_readable jsonb,
  structured_data jsonb,
  patch          jsonb,          -- JSON Merge Patch (RFC 7386) si action = 'patch'
  note           text,           -- « pourquoi j'ai changé ça » — affiché dans la fiche
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (ruleset_id, entry_key)
);
```

| Action | Usage |
|---|---|
| `patch` | « la boule de feu fait 6d6 chez moi » → `{"effects":{"e1":{"damage":{"formula":{...}}}}}` |
| `replace` | la règle est réécrite entièrement |
| `disable` | la règle n'existe pas dans ce monde (pas de multiclassage, pas de résurrection) |
| `add` | une règle qui n'existe dans aucune base |

### 3.3 Algorithme de résolution

```
resolve(rulesetId, entryKey):
    chaine = [rulesetId, parent, grand-parent, …, base]      # max 8, cycles détectés
    patchs = []
    pour r dans chaine, du plus spécifique au plus général :
        o = override(r, entryKey)
        si o est absent            → continuer
        si o.action = 'disable'    → retourner null
        si o.action ∈ {replace, add} → base = o ; sortir de la boucle
        si o.action = 'patch'      → empiler o.patch ; continuer
    si base absent → retourner null
    appliquer les patchs empilés, du plus général au plus spécifique
    retourner l'entrée résolue
```

Fonction pure, dans `src/core/rules/resolve.ts`. Testable sans base : on lui passe la chaîne et les surcharges.

**Performance.** Résoudre 2 000 entrées à chaque affichage serait absurde. Une vue matérialisée par ruleset, invalidée à toute écriture de surcharge, suffit largement. À faire quand la lenteur est mesurée, pas avant.

### 3.4 Le point que tout le monde rate : figer une variante en cours de partie

Vous jouez une campagne. Trois mois plus tard, vous modifiez votre variante « boule de feu à 6d6 ». Que se passe-t-il pour la campagne ?

**Réponse : rien.** C'est le même principe d'immuabilité que les révisions mécaniques.

```sql
alter table rulesets
  add column lineage_id uuid not null default gen_random_uuid(),
  add column published_at timestamptz;
```

- Un ruleset **publié** (`published_at` non nul) est figé. Toute modification crée une **nouvelle ligne**, même `lineage_id`, `version + 1`.
- Une campagne épingle un `rulesets.id` précis, donc une version précise.
- Le MJ voit « votre variante a évolué (v3 disponible) » et **choisit** de mettre à jour sa campagne.
- Un ruleset non publié est un brouillon, librement modifiable.

Sans ce mécanisme, corriger une coquille dans sa variante change rétroactivement les règles de trois campagnes en cours. C'est exactement le problème que le PDD §9 décrivait sans le résoudre.

---

## 4. Alléger le MJ IA : le contrat moteur ↔ IA

### 4.1 Le principe

> **Chaque question que le moteur sait résoudre est une question que l'IA n'a pas à se poser.**

Le PDD posait le principe « l'IA narre, le code arbitre » (3.8). Voici sa traduction opérationnelle : maximiser la surface de ce que le moteur répond de façon déterministe, pour que le modèle ne reçoive plus que ce qui est narratif.

### 4.2 Le contrat

Le modèle ne demande pas « quelles sont les règles de la boule de feu ». Il déclare une **intention**, et reçoit un **résultat**.

```
IA → outil resolve_action
{
  "actor": "ent_7f3a",
  "action": "cast_spell",
  "rule": "fireball",
  "slot_level": 3,
  "targets": ["ent_9b1c", "ent_9b1d", "ent_9b1e"],
  "origin_point": "centre du couloir"
}

moteur → tool_result
{
  "ok": true,
  "rolls": [ { "expression": "8d6", "result": 27, "detail": [4,6,2,5,1,3,3,3] } ],
  "outcomes": [
    { "target": "ent_9b1c", "save": { "roll": 8, "dc": 15, "passed": false },
      "damage": 27, "hp_before": 12, "hp_after": 0, "state": "dead" },
    { "target": "ent_9b1d", "save": { "roll": 17, "dc": 15, "passed": true },
      "damage": 13, "hp_before": 11, "hp_after": 0, "state": "dead" },
    { "target": "ent_9b1e", "save": { "roll": 19, "dc": 15, "passed": true },
      "damage": 13, "hp_before": 34, "hp_after": 21, "state": "wounded" }
  ],
  "resource_spent": { "spell_slot_3": 1 },
  "narrative_hints": [
    "deux gobelins meurent, le troisième est brûlé mais debout",
    "le baril d'huile signalé dans la salle est dans la zone d'effet"
  ]
}
```

L'IA ne fait plus qu'une chose : raconter ça. Elle n'a jamais vu le texte de la règle, ni la fiche des gobelins, ni les points de vie.

### 4.3 Le gain, chiffré

| Approche | Ce qu'on envoie au modèle | Ordre de grandeur |
|---|---|---|
| Naïve | texte du sort + fiche du personnage + 3 fiches de monstres + règles de sauvegarde | ~2 800 tokens |
| Avec contrat | l'intention et son résultat structuré | ~140 tokens |

Ce n'est pas seulement vingt fois moins cher. C'est surtout **plus juste** : un modèle qui additionne 8d6 dans sa tête au milieu d'un long contexte se trompe, et se trompe silencieusement.

### 4.4 Quand le modèle a quand même besoin de lire une règle

Cas limite, question du joueur, situation non prévue par le moteur. Alors :

1. On identifie la ou les règles concernées (recherche par clé, jamais du texte libre).
2. On envoie leur **`ai_digest`**, pas leur fiche complète.
3. On étend au **voisinage à profondeur 1** dans le graphe de renvois : `fireball` → `saving_throw`, `spell_save_dc`. Pas au-delà.
4. Plafond dur : 5 règles, 800 tokens. Au-delà, le moteur répond « je ne sais pas trancher » et l'IA le dit au joueur au lieu d'inventer.

Le point 4 est important : **l'IA doit avoir le droit de dire qu'elle ne sait pas**. Une règle absente du moteur donne une réponse honnête, pas une hallucination plausible.

### 4.5 Ce que le moteur doit exposer

Interfaces à écrire dans `src/core/rules/` — c'est la surface entière du contrat :

```ts
resolveEntry(rulesetId, entryKey): ResolvedEntry | null
evaluateFormula(ast, ctx, rng, mode): { value, trace }
resolveAction(intent, world, ruleset, rng): ActionOutcome
characterSheet(entityId, revisionId, ruleset): DerivedSheet   // CA, DD, modificateurs, calculés
checkRequirements(entityId, entryKey, ruleset): Requirement[]
digest(entryKey, ruleset): string
```

`characterSheet` mérite une insistance : la classe d'armure, le DD de sauvegarde et les modificateurs sont **toujours calculés**, jamais stockés. Une valeur stockée diverge dès qu'un objet change.

---

## 5. L'éditeur de règles assisté

C'est le « codeur accompagnant » demandé. Le PDD §8 en décrivait le principe en six lignes ; voici le flux.

### 5.1 Le parcours

```
1. L'utilisateur écrit en français :
   « Une épée longue inflige 1d8 tranchant, 1d10 si maniée à deux mains. »

2. Le modèle propose un structured_data
   — appel d'outil, jamais du JSON extrait de prose
   — le schéma Zod du type d'entrée lui est fourni comme contrat

3. Validation Zod
   — en cas d'échec, les erreurs repartent au modèle (2 tentatives maximum,
     puis on rend la main à l'utilisateur avec le formulaire vide)

4. Formulaire pré-rempli, éditable
   — généré depuis le schéma Zod, jamais du JSON brut à l'écran
   — chaque champ que le modèle a rempli est signalé comme tel

5. Bac à sable
   — tester sur un personnage fictif, voir la trace du calcul :
     « 1d8 (6) + FOR (+3) = 9 dégâts tranchants »
   — c'est ici que quelqu'un qui ne code pas vérifie que la règle est juste

6. Publication
   — crée une surcharge action='add' dans son ruleset
   — les renvois déduits sont recalculés
   — le résumé IA est généré
```

### 5.2 Les deux étapes qui font la différence

**L'étape 4.** L'utilisateur ne voit jamais de JSON. Le formulaire est engendré par le schéma, ce qui garantit qu'il ne peut produire qu'une structure valide. Un éditeur JSON brut réserve l'outil aux gens qui savent déjà coder — c'est-à-dire exactement ceux qui n'en ont pas besoin.

**L'étape 5.** Le bac à sable avec trace est ce qui rend l'outil vérifiable par un non-programmeur. Sans lui, l'utilisateur doit *croire* que la structure correspond à sa phrase. Avec lui, il *voit* le résultat sur un cas concret et corrige.

### 5.3 Garde-fous

- Le modèle propose ; il n'écrit jamais directement (principe 3.9).
- Une règle générée est marquée `origin='ai'` jusqu'à validation explicite.
- Aucune règle générée ne peut modifier une base officielle — seulement créer une surcharge dans une variante.
- Les limites de l'AST (§20.4 du schéma technique) s'appliquent : un modèle qui produit `9999d6` voit sa proposition rejetée.
- Le bac à sable s'exécute avec le même moteur que le jeu réel. Deux chemins de code, c'est deux comportements.

---

## 6. Mise en page de la fiche

Conseils issus de la maquette proposée en conversation.

**Hiérarchie de lecture.** L'ordre est imposé par l'usage réel : on consulte une règle au milieu d'une partie, sous pression. Nom → résumé en une ligne → paramètres → effet → tout le reste. L'ambiance vient après l'utile, jamais avant.

**Le résumé doit tenir sur une ligne.** S'il en fait trois, la fiche est illisible en jeu. Contrainte de saisie, pas suggestion.

**Distinguer visuellement le lisible du structuré.** Dans la maquette : le narratif en serif, la structure en monospace pour tout ce qui est symbole (`8d6`, `{spell_save_dc}`). Le lecteur doit savoir sans réfléchir ce qui est du texte et ce qui est une valeur que le moteur manipule.

**Les renvois vont dans les deux sens, et se ressemblent.** Sortants et entrants sont deux colonnes de même forme. Les entrants sont plus discrets — c'est de la navigation, pas du contenu.

**Signaler la provenance.** Trois badges suffisent : le type, la source (`SRD 5.1`), et l'état de surcharge (`modifiée dans ta variante`). Ce troisième badge doit ouvrir une comparaison avec l'original — c'est la question qu'on se pose immanquablement.

**Ne pas cacher derrière des onglets.** Une règle se lit d'un coup d'œil. Trois onglets « Description / Statistiques / Liens » obligent à chercher. Empiler verticalement, dans le bon ordre.

**Densité.** Les paramètres en cartes courtes (portée, zone, incantation) ; les effets en blocs à filet latéral. L'œil doit distinguer les deux natures sans lire.

---

## 7. SQL à intégrer

À ajouter à la migration `004_rules.sql`.

```sql
alter table ruleset_entries
  add column ai_digest text,
  add column ai_digest_generated_at timestamptz;

alter table rulesets
  add column lineage_id uuid not null default gen_random_uuid(),
  add column published_at timestamptz;

create index rulesets_lineage_idx on rulesets (lineage_id, version desc);

-- + tables ruleset_entry_refs (§2.1) et ruleset_overrides (§3.2)
```

Aucune de ces tables n'est utilisée avant la V1. Elles sont créées en Phase 0 parce que les ajouter après coup imposerait de reprendre l'import SRD et les politiques RLS.

---

## 8. Ce qui reste ouvert

| Question | Échéance |
|---|---|
| Les déclencheurs (« quand X, alors Y ») — le sujet le plus difficile du moteur | Après la V1. Un modèle de déclencheurs mal conçu contamine tout le reste |
| Les conflits entre deux surcharges de même niveau | Après le deuxième système de règles |
| L'`ai_digest` : généré à l'écriture ou à la demande avec cache ? | À mesurer — l'écriture est plus simple, la demande moins coûteuse |
| Vue matérialisée de résolution : dès la V1 ou quand la lenteur se mesure ? | Recommandation : quand elle se mesure |
| Les renvois vers des entités du wiki (une règle citant un lieu) | V2, quand le linker existera des deux côtés |
