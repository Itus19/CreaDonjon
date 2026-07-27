# Phase 0 — Schéma technique de données

**Statut :** Prêt à implémenter  
**Cible :** Supabase (PostgreSQL)  
**Dernière mise à jour :** 27 juillet 2026

---

## 0. Principe de lecture de ce document

Ce document traduit les décisions du PDD (v0.2) en tables concrètes. Il est pensé pour être donné tel quel à Claude Code comme première tâche d'implémentation : créer les migrations Supabase correspondantes.

Rien ici ne concerne l'interface. Aucune page, aucun composant ne devrait être écrit avant que ces tables existent et soient testées avec des données de démonstration.

---

## 1. `worlds`

Le conteneur racine. Un monde = un espace isolé (lore, règles, campagnes).

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| owner_id | uuid, fk → auth.users | le MJ principal |
| default_ruleset_id | uuid, fk → rulesets | nullable, système par défaut du monde |
| created_at | timestamptz | |

---

## 2. `entities`

Le cœur du modèle unifié. **Un PJ, un PNJ, un lieu, une faction, un objet — tout est une ligne dans cette table.**

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| world_id | uuid, fk → worlds | |
| name | text | |
| aliases | text[] | pour la reconnaissance de liens automatiques |
| summary | text | résumé court, toujours visible (pas de caviardage au niveau du résumé) |
| narrative_content | jsonb | voir section 3 — segments de texte avec visibilité |
| tags | text[] | |
| entity_kind | text | libre : 'personnage', 'lieu', 'faction', 'objet', 'evenement'... indicatif, ne conditionne pas le schéma |
| created_by | uuid, fk → auth.users | |
| created_at / updated_at | timestamptz | |

> Pas de table séparée `characters`, `npcs`, `locations`. La distinction se fait uniquement via les **blocs** attachés (section 4) et le champ `entity_kind` (purement indicatif, pour filtrer/afficher).

---

## 3. Structure de `narrative_content` (et de tout champ de texte riche)

Un champ de texte n'est **jamais** stocké comme du markdown brut si un caviardage est possible. Structure en segments :

```json
[
  { "text": "Le tavernier semble jovial et accueillant. ", "visibility": "public" },
  { "text": "En réalité, il travaille pour la guilde des voleurs.", "visibility": "mj" }
]
```

Valeurs possibles de `visibility` (au niveau segment ET au niveau bloc, section 4) :
`public` | `joueurs` | `mj` | `campagne:<id>` | `utilisateur:<id>` | `prive`

**Règle absolue :** la résolution de visibilité se fait côté serveur (route API / fonction Postgres), avant l'envoi au client. Le texte caché ne doit jamais transiter vers un navigateur qui n'a pas le droit de le voir, même sous forme masquée par CSS.

---

## 4. `blocks`

Chaque bloc spécialisé (personnage, inventaire, biologie, faction...) attaché à une entité.

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| entity_id | uuid, fk → entities | |
| block_type | text | 'personnage', 'inventaire', 'biologie', 'faction', 'geographie', 'statistiques', etc. |
| data | jsonb | contenu structuré du bloc, forme libre selon block_type |
| visibility | text | même valeurs que section 3 ; toggle MJ dans l'UI plus tard |
| display_order | int | ordre d'affichage dans la fiche |
| created_at / updated_at | timestamptz | |

> Le mode solo : l'IA (agissant comme MJ) reçoit toujours tous les blocs sans filtre pour construire son contexte de jeu. Le filtrage par visibilité s'applique uniquement à ce qui est **affiché** au joueur, jamais à ce que l'IA peut lire pour raisonner.

---

## 5. `relations`

Le graphe de connaissances (section 19 du PDD).

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| source_entity_id | uuid, fk → entities | |
| target_entity_id | uuid, fk → entities | |
| relation_type | text | 'habite', 'appartient', 'connait', 'possede', 'deteste', 'a_participe'... libre |
| metadata | jsonb | ex: { "depuis": "10 ans" } |
| visibility | text | une relation peut elle-même être secrète |

---

## 6. `rulesets`

Un système de règles (D&D 2014 SRD, D&D 2024 SRD, une variante homebrew, une dérivée de campagne).

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| base_system | text | 'dnd2014_srd', 'dnd2024_srd', 'homebrew' |
| parent_ruleset_id | uuid, fk → rulesets, nullable | pour l'héritage (section 9 du PDD) |
| version | int | |
| is_official_base | boolean | `true` uniquement pour les deux packs SRD fournis par défaut — **jamais modifiable directement** |
| created_by | uuid, nullable | null pour les packs officiels |
| created_at | timestamptz | |

---

## 7. `ruleset_entries`

Une règle individuelle (sort, classe, objet, condition...) au sein d'un ruleset.

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| ruleset_id | uuid, fk → rulesets | |
| entry_type | text | 'sort', 'objet', 'classe', 'monstre', 'condition'... |
| human_readable | jsonb | vue lisible (description, fonctionnement, exemples) — voir section 8 du PDD |
| structured_data | jsonb | vue structurée : paramètres, formules, effets, conditions |

---

## 8. `entity_mechanical_revisions`

Résout la tension "référencer plutôt que dupliquer" vs "une sauvegarde reste cohérente dans le temps" (discutée ensemble).

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| entity_id | uuid, fk → entities | ex: la fiche `Dague` |
| revision_number | int | auto-incrémenté par entité |
| mechanical_data | jsonb | snapshot immuable des stats à cette révision |
| based_on_ruleset_entry_id | uuid, fk → ruleset_entries, nullable | si dérivé d'une règle officielle |
| created_by | uuid | |
| created_at | timestamptz | |

> Une entité mécanique n'est **jamais éditée en place** : modifier les stats crée une nouvelle ligne ici, incrémente `revision_number`. L'entité elle-même (`entities`) garde un pointeur `current_mechanical_revision_id` vers la révision "active" par défaut.

---

## 9. `campaigns`

| Champ | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| world_id | uuid, fk → worlds | |
| name | text | |
| ruleset_id | uuid, fk → rulesets | version précise épinglée |
| gm_user_id | uuid, fk → auth.users | |
| mode | text | 'campagne', 'solo' |
| created_at | timestamptz | |

---

## 10. `campaign_members`

| Champ | Type | Notes |
|---|---|---|
| campaign_id | uuid, fk → campaigns | |
| user_id | uuid, fk → auth.users | |
| role | text | 'mj', 'joueur' |

> Table clé pour la résolution des permissions contextuelles (section 16 du PDD) : la visibilité d'un bloc ne dépend pas que de l'utilisateur, mais de son rôle **dans cette campagne précise**.

---

## 11. `campaign_entity_snapshots`

Épingle, pour une campagne donnée, la révision mécanique utilisée pour chaque entité référencée (ex : la dague que porte le PJ).

| Champ | Type | Notes |
|---|---|---|
| campaign_id | uuid, fk → campaigns | |
| entity_id | uuid, fk → entities | |
| mechanical_revision_id | uuid, fk → entity_mechanical_revisions | |

---

## 12. Mini-langage de formules — grammaire

Aucune formule n'est jamais évaluée via `eval()` ou équivalent. Grammaire fermée, stockée en `structured_data` (section 7) :

```
formule       ::= terme (('+' | '-') terme)*
terme         ::= facteur (('*' | '/') facteur)*
facteur       ::= nombre | de | reference | fonction | '(' formule ')'
de            ::= entier 'd' entier            // ex: 2d6
reference     ::= '{' identifiant '}'          // ex: {FOR}, {niveau}
fonction      ::= nom_fonction '(' formule (',' formule)* ')'
nom_fonction  ::= 'min' | 'max' | 'floor' | 'arrondi'
```

Implémentation : un parser dédié (grammaire ci-dessus) produit un arbre syntaxique, évalué contre un contexte de statistiques passé en paramètre. Aucun accès à autre chose que ce contexte.

---

## 13. Résumé des décisions qui découlent de ce schéma

- Personnage = entité + bloc `personnage`. Pas de table séparée.
- Visibilité résolue à trois niveaux : segment de texte → bloc → (implicitement) entité.
- Toute donnée mécanique modifiable est versionnée par révision immuable, jamais éditée en place.
- Les règles officielles (`is_official_base = true`) ne sont jamais modifiées ; toute variante est un nouveau `ruleset` avec `parent_ruleset_id` renseigné.
- Les formules sont des données interprétées par un parser fermé, jamais du code exécuté.

---

## 14. Première tâche concrète pour Claude Code

1. Initialiser le projet Next.js + connexion Supabase.
2. Écrire les migrations SQL pour les tables ci-dessus (sections 1 à 11), avec les foreign keys et index nécessaires (au minimum : `entities.world_id`, `blocks.entity_id`, `relations.source_entity_id`/`target_entity_id`).
3. Ajouter les policies RLS de base sur `entities` et `blocks` (accès filtré par `world_id`/`campaign_id`, sans encore implémenter la logique fine de visibilité par bloc — ça viendra une fois les tables validées).
4. Insérer quelques lignes de test (un monde, deux entités liées par une relation, un bloc caché et un bloc visible) pour vérifier que le schéma tient la route avant d'aller plus loin.

Ne pas commencer l'interface avant que l'étape 4 soit validée manuellement (via l'éditeur de table Supabase, pas via une UI custom).
