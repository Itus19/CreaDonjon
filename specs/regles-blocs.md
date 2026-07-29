# Spécification — Blocs de règles

**Version :** 0.1 — 29 juillet 2026
**Statut :** Conception arrêtée. Remplace le modèle `structured_data` monolithique
**Amende :** `Spec_Couche_Regles_v0_1.md` §1.2 et §3 · `Phase0_Schema_Technique_v0_5.md` §9

---

## 0. Ce qui ne va pas dans le modèle précédent

`Spec_Couche_Regles_v0_1.md` définissait `structured_data` comme un objet unique dont la forme dépend de `entry_type`. Quinze types d'entrées, quinze formes sans structure commune.

Trois défauts concrets :

1. **Une classe n'entre pas dedans.** Sa table de progression, ses maîtrises, sa progression d'incantation et ses aptitudes par niveau n'ont pas la même nature. Les empiler dans un objet plat produit un objet illisible et impossible à afficher proprement.
2. **Aucune extensibilité.** Un système maison introduisant une notion inconnue (une jauge de corruption, un rang de guilde) n'a nulle part où la mettre. Il faudrait modifier le schéma du type d'entrée — c'est-à-dire modifier le code de l'application pour ajouter une règle.
3. **L'oubli est silencieux.** Rien ne signale qu'une classe n'a pas de table de progression. Un objet incomplet reste un objet valide.

Le modèle proposé ci-dessous — **une fiche de règle est un conteneur de blocs typés** — corrige les trois. C'est le même principe que les entités du wiki, et c'est ce qui rend l'affirmation « le wiki et le moteur de règles ne sont pas deux systèmes » vraie dans le code, pas seulement dans le document.

---

## 1. Une question à trancher d'abord : une règle est-elle une entité ?

La version la plus radicale de l'idée serait de supprimer `ruleset_entries` et de faire des règles des lignes de `entities`. Tentant : une seule table, un seul éditeur, un seul système de révisions.

**Recommandation : non.** Même motif, tables distinctes.

| Raison | Détail |
|---|---|
| Cycle de vie | Une entité est modifiée en place avec un historique. Une règle appartient à un ruleset versionné, figé à la publication, avec un mécanisme de surcharge. Deux modèles incompatibles. |
| Portée | Une entité appartient à un monde (`world_id not null`). Une règle est partagée entre tous les mondes. Fusionner imposerait `world_id` nullable — ce qui affaiblit **toutes** les politiques RLS, la brique la plus sensible du projet. |
| Protection | `is_official_base` verrouille les règles officielles. Les entités n'ont rien de tel et n'en ont pas besoin. |
| Volume | Deux mille entrées SRD dans la table qui porte aussi la recherche narrative de chaque monde. |

**Ce qui est partagé, en revanche, c'est le code :** l'éditeur de blocs, le rendu, le registre de schémas Zod, le détecteur de liens. C'est là que se trouve le vrai bénéfice de l'unification — pas dans la table.

---

## 2. L'enveloppe commune

Tout bloc de règle, quel que soit son type, a la même enveloppe. C'est elle qui produit la standardisation.

```json
{
  "block_type": "spell_casting",
  "schema_version": 1,
  "display": { "label": "Incantation", "layout": "key_values", "collapsed": false },
  "data": { }
}
```

| Champ | Rôle |
|---|---|
| `block_type` | détermine le schéma Zod de `data` — contrat pour le moteur |
| `schema_version` | permet de faire évoluer la forme sans deviner à la lecture |
| `display.label` | titre affiché, traduisible |
| `display.layout` | l'une des six mises en page (§4) |
| `data` | typé, validé, jamais libre |

**Le point non négociable : `data` est typé.** Un bloc de wiki peut contenir n'importe quoi, un humain le lit. Un bloc de règle est exécuté : le moteur demande le bloc `weapon` d'une entrée et doit recevoir une forme garantie. Sans typage, `resolveAction` devient une exploration hasardeuse et le moteur cesse d'être déterministe.

---

## 3. Le vocabulaire de primitives

Ce n'est pas d'avoir les mêmes champs qui rend les blocs semblables — c'est d'être bâtis avec les mêmes briques. Toutes les valeurs de tous les blocs se composent à partir de ce vocabulaire, et de lui seul.

| Primitive | Forme | Exemple |
|---|---|---|
| `Quantity` | `{ value, unit }` | `{ "value": 45, "unit": "m" }` |
| `Formula` | AST (§20 du schéma) | `{ "op":"dice","count":8,"faces":6 }` |
| `Reference` | `{ kind, key }` | `{ "kind":"rule","key":"saving_throw" }` |
| `Duration` | `{ type, value?, concentration? }` | `{ "type":"minutes","value":10 }` |
| `Range` | `{ type, distance? }` | `{ "type":"point","distance":{...} }` |
| `Area` | `{ shape, size }` | `{ "shape":"sphere","size":{...} }` |
| `Choice` | `{ id, prompt, count, from, grants }` | voir §B2 de la spec personnage |
| `Modifier` | `{ target, op, value, layer, stacking }` | voir §B4 de la spec personnage |
| `Grant` | `{ feature? , choice?, resource? }` | `{ "feature":"rage" }` |
| `Localized` | `{ [locale]: string }` | `{ "fr":"Rage","en":"Rage" }` |

Ajouter une primitive est une décision d'architecture, à consigner en ADR. Dix primitives suffisent à décrire la 5e entière ; si la liste dérive vers trente, c'est qu'on modélise mal.

**Bénéfice direct :** les unités sont toujours explicites. Le SRD est en pieds, l'interface en mètres. Stocker `45` sans unité garantit une erreur de conversion un jour ; stocker `Quantity` la rend impossible.

---

## 4. Les six mises en page

Un bloc déclare comment il veut être affiché. Le rendu comporte six composants, pas un par type de bloc.

| Layout | Usage | Exemple |
|---|---|---|
| `key_values` | paires étiquette/valeur en cartes courtes | portée, zone, dé de vie |
| `progression_table` | table à colonnes déclarées | montée de niveau d'une classe |
| `formula_list` | effets avec formule et trace | dégâts, sauvegardes |
| `prose` | segments narratifs avec visibilité | description, précisions |
| `chips` | liste courte d'éléments cliquables | maîtrises, renvois, mots-clés |
| `table` | table générique | équipement de départ, tableau maison |

C'est ce qui garantit que toutes les fiches se ressemblent sans avoir à dessiner chacune. Un nouveau type de bloc réutilise une mise en page existante ; s'il en réclame une septième, la question à poser est d'abord « pourquoi ».

---

## 5. Le catalogue de blocs

**Ne pas définir les vingt d'un coup.** Cinq blocs plus l'échappatoire couvrent 90 % du SRD. Le reste vient quand un cas concret le réclame — règle des trois.

### V1 — à construire

| Bloc | Layout | Contenu |
|---|---|---|
| `description` | `prose` | segments narratifs, visibilité par segment |
| `spell_casting` | `key_values` | niveau, école, temps, portée, zone, composantes, durée, concentration, rituel |
| `effects` | `formula_list` | liste d'effets : déclencheur, cibles, sauvegarde, dégâts, conditions |
| `scaling` | `progression_table` | montée en puissance (§6) |
| `class_progression` | `progression_table` | table de niveaux (§7) |
| `custom_table` | `table` | **l'échappatoire** — colonnes et lignes libres |

`custom_table` doit exister **dès le premier jour**. C'est ce qui permet à quelqu'un de saisir une notion que personne n'avait prévue sans attendre qu'on définisse un type de bloc. Sans échappatoire, la modularité est théorique.

### V2 et au-delà — à ne pas construire maintenant

`class_basics`, `weapon`, `armor`, `item_properties`, `charges`, `stat_block`, `actions`, `traits`, `prerequisites`, `spellcasting_progression`, `subclass_slot`.

### Blocs requis par type d'entrée

C'est ce qui répond à « n'oublier aucune information ». Chaque `entry_type` déclare les blocs qu'il doit posséder :

```ts
const REQUIRED_BLOCKS: Record<EntryType, BlockType[]> = {
  spell: ['spell_casting', 'effects'],
  class: ['class_progression'],
  weapon: ['weapon'],
  monster: ['stat_block'],
};
```

Une entrée à laquelle il manque un bloc requis est **valide mais signalée** : bandeau sur la fiche, et liste dans une vue « règles incomplètes » du ruleset. On avertit, on n'interdit pas — mais on ne laisse rien passer en silence.

C'est la différence décisive avec le modèle monolithique : un champ absent d'un objet JSON est invisible ; un bloc absent d'une fiche se voit, et le bouton « ajouter un bloc » est juste à côté.

---

## 6. Le bloc `scaling`

La montée en puissance selon le niveau d'emplacement — le cas explicitement demandé.

```json
{
  "block_type": "scaling",
  "display": { "label": "Montée en puissance", "layout": "progression_table" },
  "data": {
    "axis": "slot_level",
    "base": 3,
    "rule": {
      "kind": "delta_per_step",
      "target": "effects.e1.damage.formula",
      "per_step": { "op": "dice", "count": 1, "faces": 6 }
    },
    "table": null
  }
}
```

Axes possibles : `slot_level` (sorts), `character_level` (sorts mineurs), `uses`, `custom`.

**Deux formes, et il faut les deux :**

- `rule` — la progression est régulière. La boule de feu gagne `1d6` par niveau : trois lignes de JSON pour dix-sept niveaux.
- `table` — la progression est irrégulière. Un sort mineur qui progresse aux niveaux 5, 11 et 17 n'a pas de règle simple ; on énumère.

Quand `table` est présente, elle prime.

**Le point de conception qui compte :** le moteur consomme `rule`, l'affichage consomme **la table engendrée par `rule`**. Une seule source, deux vues. La fiche montre donc toujours la ventilation complète — niveau 3 : 8d6, niveau 4 : 9d6, niveau 5 : 10d6… — sans que personne ait eu à la saisir, et sans risque de divergence entre ce qui est affiché et ce qui est calculé.

C'était le défaut du modèle précédent, qui plaçait la montée en puissance dans un chemin opaque (`"e1.damage.formula"`) : correct pour le moteur, inaffichable pour l'humain.

---

## 7. Le bloc `class_progression`

```json
{
  "block_type": "class_progression",
  "display": { "label": "Progression", "layout": "progression_table" },
  "data": {
    "max_level": 20,
    "columns": [
      { "key": "level",    "label": {"fr":"Niveau"}, "kind": "level" },
      { "key": "pb",       "label": {"fr":"Bonus de maîtrise"}, "kind": "formula",
        "formula": { "op":"add", "args":[ {"op":"num","v":2},
                     {"op":"floor","args":[{"op":"div","args":[
                       {"op":"sub","args":[{"op":"ref","name":"level"},{"op":"num","v":1}]},
                       {"op":"num","v":4}]}]} ] } },
      { "key": "features", "label": {"fr":"Aptitudes"}, "kind": "grants" },
      { "key": "rages",    "label": {"fr":"Rages"}, "kind": "value" },
      { "key": "rage_dmg", "label": {"fr":"Dégâts de rage"}, "kind": "value" }
    ],
    "rows": [
      { "level": 1, "features": [{"feature":"rage"},{"feature":"unarmored_defense"}],
        "rages": 2, "rage_dmg": 2 },
      { "level": 2, "features": [{"feature":"reckless_attack"},{"feature":"danger_sense"}],
        "rages": 2, "rage_dmg": 2 },
      { "level": 4, "features": [{"choice":"asi"}], "rages": 3, "rage_dmg": 2 }
    ]
  }
}
```

**Colonnes déclarées, lignes en données.** C'est la propriété qui rend le bloc à la fois modulaire et standardisé :

- Une classe maison avec une jauge de corruption ajoute une colonne. Aucun changement de schéma, aucun composant à écrire, le rendu suit.
- Les colonnes `kind: "formula"` sont calculées, jamais saisies. Le bonus de maîtrise vit dans une formule ; une variante qui change la courbe change une formule, pas vingt lignes.
- Les colonnes `kind: "grants"` sont ce que le moteur consomme pour la progression du personnage. `characterSheet()` lit `rows[level].features`, rien d'autre.
- Les colonnes `kind: "value"` sont des ressources suivies en jeu.

Une ligne omise vaut « inchangé depuis la précédente ». Trois lignes suffisent souvent là où le SRD en imprime vingt.

---

## 8. Effet sur la surcharge — c'est meilleur qu'avant

Les blocs rendent la personnalisation **plus** simple, pas moins. Une surcharge vise un bloc plutôt qu'un objet entier.

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
  note        text,
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

« Chez moi la boule de feu fait 6d6 » devient un `patch_block` sur `effects` : quatre lignes, et le reste de la fiche continue de suivre sa base, erratum compris.

L'algorithme de résolution de `Spec_Couche_Regles_v0_1.md` §3.3 s'applique bloc par bloc au lieu d'entrée par entrée. Même remontée de chaîne, même empilement de patchs, même profondeur maximale.

---

## 9. Effet sur les renvois

L'extraction des renvois déduits (`ruleset_entry_refs`) parcourt désormais les blocs plutôt qu'un objet unique. Le `path` d'un renvoi devient `blocks.effects.e1.save.dc` — plus précis qu'avant, ce qui permet de surligner l'endroit exact dans la fiche quand on suit un lien.

Le vocabulaire de primitives simplifie beaucoup l'extracteur : il cherche des nœuds `Reference` et des `ref` d'AST, partout, sans connaître les types de blocs. Une fonction générique de vingt lignes plutôt qu'un cas par type d'entrée.

---

## 10. SQL

```sql
create table ruleset_entry_blocks (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references ruleset_entries(id) on delete cascade,
  block_type     text not null,
  schema_version int not null default 1,
  display        jsonb not null default '{}'::jsonb,
  data           jsonb not null default '{}'::jsonb,
  display_order  numeric not null default 1000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (entry_id, block_type, display_order)
);

create index entry_blocks_entry_idx on ruleset_entry_blocks (entry_id, display_order);
create index entry_blocks_type_idx  on ruleset_entry_blocks (block_type);

alter table ruleset_entries drop column structured_data;
```

`structured_data` disparaît. `human_readable` disparaît également : le texte devient un bloc `description`, ce qui lui apporte gratuitement la visibilité par segment — une variante maison peut donc avoir un passage visible du seul MJ.

`ruleset_entries` ne conserve que l'identité : clé, type, `ai_digest`, attribution.

---

## 11. Ce qui change dans le plan

| Document | Modification |
|---|---|
| `Spec_Couche_Regles_v0_1.md` §1.2 | `structured_data` monolithique remplacé par des blocs |
| `Spec_Couche_Regles_v0_1.md` §3 | surcharge au niveau du bloc |
| Schéma technique §9 | `ruleset_entry_blocks`, `ruleset_overrides` révisée |
| Import SRD (ticket P0-08) | le convertisseur produit des blocs, pas un objet plat |
| `src/core/schemas/rule-blocks/` | un schéma Zod par type de bloc, plus le registre |

**Coût du changement maintenant :** aucune ligne de code n'existe. Une table à écrire différemment.
**Coût dans trois mois :** réécrire l'import SRD, migrer deux mille entrées, refaire l'éditeur.

## 12. Ce qui reste ouvert

| Question | Recommandation |
|---|---|
| Un bloc peut-il apparaître deux fois dans une fiche ? | Oui pour `custom_table` et `description`, une seule fois pour les autres. À contraindre par type. |
| Les blocs de règles et les blocs de wiki partagent-ils une table ? | Non — mêmes composants, tables distinctes, pour les raisons de §1. |
| Les mises en page sont-elles paramétrables par l'utilisateur ? | Non en V1. Le bloc choisit, l'utilisateur ne fait que replier ou déplier. |
| Une bibliothèque de blocs partagés entre utilisateurs ? | Idée future, cohérente avec la marketplace du PDD §25. |
