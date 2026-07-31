# Backlog — Phase 0 et V0

**Version :** 1.0 — 29 juillet 2026
**Documents liés :** `Project_Design_Document_v0_2.md`, `Phase0_Schema_Technique_v0_2.md`, `CLAUDE.md`

---

## Comment utiliser ce document

Un ticket = une session Claude Code. On donne **un seul ticket à la fois**, on vérifie les critères d'acceptation, on committe, on passe au suivant.

La tentation sera forte de donner trois tickets d'un coup parce qu'ils se ressemblent. Ne pas y céder : un lot de code trop gros ne se relit pas, et du code non relu dans un projet où l'on apprend est du code qu'on ne comprendra plus dans un mois.

**Légende :** `S` ≈ une session courte · `M` ≈ une session · `L` ≈ deux sessions ou plus (à découper si ça dépasse).

**Règle de blocage :** un ticket dont les critères ne passent pas n'est pas terminé. On ne passe pas au suivant « en revenant dessus plus tard ».

---

# Phase 0 — Fondations de données

Aucune interface. Aucun composant. La validation se fait dans l'éditeur de tables Supabase et par les tests.

## P0-01 — Initialisation du projet · `M`

Créer le projet Next.js (App Router, TypeScript strict, Tailwind), initialiser Supabase en local, configurer Vitest et ESLint.

**Livrables**
- Arborescence conforme à la section 28 du PDD (`src/core`, `src/server/services`, `src/server/repos`, `src/i18n`, `docs/adr`).
- Règle ESLint `no-restricted-imports` interdisant `next`, `react`, `@supabase/*` dans `src/core/**`.
- `.env.example` documentant chaque variable et sa portée (client ou serveur).
- `README.md` : installation, commandes, où trouver quoi.
- `CLAUDE.md` et `docs/` en place.

**Critères d'acceptation**
- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test` passent sur un projet vide.
- [ ] Un fichier de test dans `src/core` important `react` fait échouer le lint.
- [ ] `supabase start` fonctionne, `supabase db reset` est reproductible.
- [ ] Aucun secret n'est présent dans un fichier suivi par Git.

---

## P0-02 — Moteur de formules · `L`

Entièrement dans `src/core/formula` et `src/core/dice`. Aucune base, aucun réseau. **Tests d'abord.**

**Livrables**
- Parser : texte → AST, selon la grammaire de la section 20.1 du schéma technique.
- Types d'AST : `num`, `dice`, `ref`, `add`, `sub`, `mul`, `div`, `min`, `max`, `floor`, `ceil`, `round`.
- Évaluateur avec la signature du contrat §20.3, quatre modes (`roll`, `average`, `min`, `max`).
- Interface `Rng` + implémentation à graine déterministe (`SeededRng`).
- Génération de trace lisible pour l'affichage.
- Limites de sécurité de §20.4, avec erreurs typées.

**Critères d'acceptation**
- [ ] `2d6+{STR_MOD}` se parse, s'évalue, et redonne exactement le même résultat avec la même graine.
- [ ] Le mode `average` retourne `7 + STR_MOD` **sans consommer le RNG** (vérifié par l'état du RNG après appel).
- [ ] `4d6kh3` fonctionne (garder les 3 meilleurs).
- [ ] Une référence inconnue lève une erreur typée. Elle ne retourne jamais `0`. Test explicite.
- [ ] `9999999d6` est refusé par la limite, pas exécuté (test avec chronomètre : échec en moins de 10 ms).
- [ ] La trace de `2d6+3` avec tirages 3 et 5 produit une chaîne contenant `3`, `5`, `8` et `11`.
- [ ] Couverture > 90 % sur `src/core/formula` et `src/core/dice`.

**Attention :** ce ticket est le plus technique du lot et le plus autonome. C'est un bon premier vrai ticket : il n'a aucune dépendance et il est entièrement vérifiable.

---

## P0-03 — Résolution de visibilité · `M`

Entièrement dans `src/core/visibility`. Fonction pure, aucune dépendance.

**Livrables**
- Types `VisibilityLevel`, `Viewer`, `VisibilityContext`.
- `canSee(visibility, viewer, ctx): boolean`.
- `filterSegments(segments, viewer, ctx)` et `filterBlocks(blocks, viewer, ctx)`.

**Critères d'acceptation**
- [ ] Table de vérité **exhaustive** : 6 niveaux × 5 profils de lecteur (anonyme, utilisateur sans lien, joueur de la campagne, joueur d'une autre campagne, MJ, propriétaire du monde). Un test par case, pas une boucle.
- [ ] `filterSegments` **retire** les segments interdits ; il ne les marque pas. Test vérifiant que le texte caché est absent de l'objet retourné.
- [ ] `visibility_level = 'campaign'` sans `scopeId` lève une erreur au lieu de deviner.
- [ ] Couverture > 95 %.

**Pourquoi ce ticket est prioritaire :** toute fuite de secret du projet passera par cette fonction. Elle est écrite une fois, testée exhaustivement, et plus jamais réécrite ailleurs.

---

## P0-04 — Migrations 001 à 003 · `M`

Extensions, comptes, mondes, entités, blocs, relations.

**Critères d'acceptation**
- [ ] `supabase db reset` applique tout sans erreur.
- [ ] Créer un utilisateur crée automatiquement son `profiles`.
- [ ] Un bloc avec `visibility_level='campaign'` et `visibility_scope_id=null` est rejeté par la contrainte.
- [ ] Une relation dont les deux entités appartiennent à des mondes différents est rejetée par le trigger.
- [ ] `update` sur une entité met `updated_at` à jour automatiquement.
- [ ] Recherche : `select * from entities where search_fr @@ plainto_tsquery('french','tavernier')` fonctionne.

---

## P0-05 — Migrations 004 à 006 · `M`

Règles, traductions, campagnes, révisions mécaniques.

**Critères d'acceptation**
- [ ] `update` sur un ruleset avec `is_official_base=true` lève une exception.
- [ ] `delete` sur ce même ruleset lève une exception.
- [ ] `update` sur `entity_mechanical_revisions` lève une exception.
- [ ] La FK circulaire `entities.current_mechanical_revision_id` s'applique, et une insertion en transaction avec contrainte différée fonctionne.
- [ ] `campaign_members` et `campaign_entity_snapshots` ont bien une clé primaire.

---

## P0-06 — Migrations 007 à 011 · `M`

Sessions, journal d'événements, découvertes, jets de dés, historique, propositions IA, quotas, chunks, assets, liens de partage.

**Critères d'acceptation**
- [ ] `session_events` refuse deux lignes avec le même `(session_id, seq)`.
- [ ] L'index unique de `entity_discoveries` fonctionne avec `user_id` à `null`.
- [ ] L'index HNSW sur `chunks.embedding` est créé sans erreur.
- [ ] `share_links.token_hash` est unique.
- [ ] Supprimer un monde ne laisse aucune ligne orpheline dans **aucune** des tables (requête de vérification écrite et incluse aux tests).

---

## P0-07 — RLS et politiques · `L`

Migration 012.

**Critères d'acceptation**
- [ ] Requête sur `pg_tables` : **aucune** table de `public` sans `rowsecurity = true`.
- [ ] Test avec deux clients Supabase authentifiés distincts : B ne lit aucune ligne du monde de A. Pas de test avec `service_role`.
- [ ] Le client anonyme ne lit rien.
- [ ] Aucune récursion infinie sur `campaign_members` (test explicite : la requête retourne au lieu de tourner).
- [ ] Les fonctions `security definer` ont un `search_path` figé et un `execute` révoqué pour `public`.

---

## P0-08 — Import du SRD · `L`

Script `scripts/ingest-srd.ts` chargeant `srd-2014.json` et `srd-2024.json` vers `rulesets` + `ruleset_entries`.

**Livrables**
- Import idempotent : rejouer le script ne duplique rien.
- `entry_key` canonique en anglais, stable.
- `source_attribution` renseigné.
- `NOTICE.md` avec le texte d'attribution exact des deux SRD.
- Contournement explicite et localisé du verrou `is_official_base`.

**Critères d'acceptation**
- [ ] Deux rulesets officiels créés, `is_official_base=true`, `created_by=null`.
- [ ] Un nombre d'entrées cohérent par `entry_type`, affiché en fin de script.
- [ ] Rejouer le script deux fois donne exactement le même état.
- [ ] `NOTICE.md` contient le texte d'attribution au mot près.
- [ ] Aucun contenu hors SRD n'a été importé.

---

## P0-09 — Seed de démonstration et validation finale · `S`

Migration 013, contenu détaillé en section 23 du schéma technique.

**Critères d'acceptation**
- [ ] Tous les critères de la section 24 du schéma technique passent.
- [ ] Validation visuelle dans l'éditeur de tables Supabase.
- [ ] Types générés (`supabase gen types`), compilation stricte OK.
- [ ] `docs/adr/` contient au moins les ADR : modèle de visibilité, identifiants en anglais, AST de formules, journal en ajout seul.

> **Fin de la Phase 0.** Ne pas écrire de composant avant ce point. C'est la seule discipline qui empêchera de construire une interface sur des fondations qu'il faudra changer.

---

# V0 — Le squelette

Une seule verticale, de bout en bout. Pas de règles, pas d'IA, pas de campagne, pas de carte.

## V0-01 — Authentification · `M`

Email/mot de passe via Supabase Auth. Inscription, connexion, déconnexion, route protégée, mot de passe oublié.

**Livrables**
- Page "mot de passe oublié" : saisie de l'email, appel a `supabase.auth.resetPasswordForEmail`, message neutre que l'email existe ou non (ne pas reveler si un compte existe).
- Route de callback qui echange le jeton de recuperation contre une session, puis formulaire de saisie du nouveau mot de passe.

**Critères d'acceptation**
- [ ] Un visiteur non connecté sur une route protégée est redirigé.
- [ ] La session survit à un rechargement de page.
- [ ] Aucun jeton en `localStorage` accessible depuis un script tiers (utiliser les cookies via `@supabase/ssr`).
- [ ] Un email de recuperation envoye a une adresse valide permet de definir un nouveau mot de passe et de se reconnecter avec.
- [ ] Demander une recuperation pour une adresse qui n'existe pas ne revele pas cette information (meme reponse que pour une adresse existante).

---

## V0-02 — Créer et lister ses mondes · `M`

**Critères d'acceptation**
- [ ] Créer un monde génère un slug unique, dérivé du nom, sans collision.
- [ ] La liste ne montre que les mondes dont l'utilisateur est membre.
- [ ] La création passe par une *server action* validée par Zod.

---

## V0-03 — Créer et éditer une entité · `L`

Nom, slug, alias, résumé, tags, `entity_kind`, contenu narratif en segments.

**Critères d'acceptation**
- [ ] L'éditeur produit des segments, chacun avec un `id` et une visibilité.
- [ ] Créer une révision dans `entity_revisions` à chaque enregistrement, avec `change_source='user'`.
- [ ] La concurrence optimiste fonctionne : enregistrer avec une `version` périmée retourne `409`.
- [ ] Un slug reste stable après renommage.

---

## V0-03b — Coquille d'application et système visuel · `L`

Spécification complète : `specs/coquille-et-design.md`. À faire **avant** V0-04 : la coquille détermine le routage et la disposition, pas seulement l'apparence. La décider après huit écrans oblige à réécrire les huit.

**Livrables** : jetons de design, trois familles typographiques, `<AppShell>`, routage `/m/[monde]/f/[fiche]`, arborescence dérivée, palette ⌘K, `<Panel>`, `<BlockShell>`, `<EntityChip>`, `<VisibilityBadge>`, `<EmptyState>`, reprise des écrans V0-02 et V0-03.

**Critères d'acceptation** : voir §8 de la spécification.

**À joindre au ticket :** les captures d'écran de référence. Claude Code sait lire les images, et une capture transmet une direction visuelle mieux que trois paragraphes.

---

## V0-04 — Blocs · `M`

Ajouter, éditer, réordonner, supprimer un bloc. Quatre types en V0, conformes à `docs/SCHEMA.md` §7 et `specs/wiki-blocs.md` §1 : `description`, `infobox`, `gallery`, `custom_table`. (`character` est un bloc V1, pas V0 — ne pas le construire ici.)

**Critères d'acceptation**
- [x] Le `data` de chaque type est validé par son schéma Zod, et porte un `__v`.
- [x] Le réordonnancement modifie **une seule ligne** (`display_order` en `numeric`).
- [x] Un bloc en visibilité `gm` est absent de la réponse serveur pour un lecteur non autorisé. **Vérifié dans l'onglet réseau du navigateur, pas seulement à l'écran.**

Livré aussi dans ce ticket : relations affichées en propriétés-chips groupées par `entity_kind` de la cible (table `relations` existante), alias en chips, emplacement portrait sans upload (pas de ticket de stockage/assets en V0). La fonction pure `canSee`/`filterBlocks` (`src/core/visibility/`) et le vocabulaire fermé des relations (`src/core/relations/inverses.ts`) sont désormais du code partagé, réutilisables par les tickets suivants.

**Écart connu, hors scope de ce ticket :** `entities.narrative_content` (les segments narratifs) n'est pas encore filtré côté serveur par visibilité — seuls les blocs le sont. Confirmé en conditions réelles (compte `viewer` de test) : un segment `gm` apparaît dans la réponse HTTP brute pour un lecteur non autorisé. Nécessite une conception séparée (risque de perte de données si on filtre naïvement le tableau qui alimente aussi le formulaire d'édition) — voir tâche de suivi.

---

## V0-05 — Liens automatiques par alias · `L`

Dans `src/core/linker` : détection des noms et alias d'entités dans un texte, proposition de lien.

**Livrables**
- Détection insensible aux accents et à la casse, respectant les frontières de mots.
- Priorité à la correspondance la plus longue (« Les Portes de Baldur » avant « Baldur »).
- Gestion des homonymes : ambiguïté signalée, jamais résolue au hasard.
- Proposition à l'utilisateur ; création de lien jamais silencieuse.

**Critères d'acceptation**
- [x] Fonction pure, testée sans base.
- [x] Un alias inclus dans un mot plus long n'est pas détecté (« Baldur » ne se déclenche pas dans « Baldurien »).
- [x] Deux entités partageant un alias produisent une ambiguïté explicite.
- [x] Un texte de 5 000 mots avec 200 alias se traite en moins de 100 ms.

**Attention :** c'est le ticket avec le plus fort risque de faux positifs, et le PDD (§6) l'identifie déjà. Commencer strict — ne détecter que les correspondances exactes de nom complet — et n'assouplir qu'ensuite, en mesurant.

**Livré** : `src/core/linker/{normalize,detect}.ts` — fonction pure `detectEntityReferences`, ne modifie ni ne crée jamais rien (retourne des propositions, y compris ambiguës). Le branchement dans l'éditeur de segments (proposer un lien à l'utilisateur pendant la saisie) n'est pas fait ici — cette fonction est la brique testée, l'UI de proposition viendra avec l'éditeur de texte riche.

---

## V0-06 — Recherche · `M`

**Critères d'acceptation**
- [ ] Recherche par nom, alias et résumé via `search_fr`.
- [ ] Insensible aux accents.
- [ ] Résultats filtrés par visibilité **côté serveur**.
- [ ] Moins de 500 ms sur 1 000 entités (jeu de test généré).

---

## V0-06b — Polish visuel de la fiche · `M`

La mécanique (V0-04) est faite ; l'esthétique des contrôles ne l'est pas encore. Reprendre le niveau de finition de l'ancienne application (`master`, avant la refonte) : menus déroulants et combobox personnalisés plutôt que `<select>`/`<input>` bruts, contrôles d'édition qui se révèlent au survol plutôt que toujours visibles, hiérarchie typographique et espacements resserrés pour les blocs `infobox`/`custom_table`. Ne touche à aucune donnée ni schéma — uniquement `components/blocks/**` et `app/m/[worldSlug]/f/[entitySlug]/EditEntityForm.tsx`.

**Critères d'acceptation**
- [ ] Aucun `<select>` natif visible dans la fiche ; remplacés par un composant cohérent avec les jetons de `tokens.css`.
- [ ] Les contrôles d'édition d'un bloc (visibilité, réordonnancement, suppression) n'apparaissent qu'au survol ou au focus, pas en permanence.
- [ ] Aucune régression sur les critères d'acceptation déjà passés de V0-03b et V0-04.

---

## V0-07 — Partage en lecture seule · `M`

Génération d'un lien avec jeton, route serveur résolvant la visibilité elle-même.

**Critères d'acceptation**
- [ ] Le jeton en clair n'est **jamais** stocké ; seul son hachage l'est.
- [ ] La page publique affiche uniquement le contenu `public`.
- [ ] Un lien expiré ou révoqué retourne 404, sans distinction entre les deux cas (ne pas révéler qu'un lien a existé).
- [ ] Test explicite : le contenu `gm` est absent de la réponse HTTP brute.

---

## V0-08 — Validation par un tiers · `S`

Faire réaliser le parcours complet par quelqu'un d'autre, sans assistance : créer un compte, un monde, une fiche avec un secret, partager, vérifier que le secret n'apparaît pas.

**Critères d'acceptation**
- [ ] Le parcours aboutit sans aide.
- [ ] Les points de friction sont notés par écrit.
- [ ] Aucune fuite de contenu caché.

> **Fin de la V0.** À ce stade, quelque chose fonctionne vraiment de bout en bout. C'est le meilleur moment pour reprendre le PDD et corriger ce que la réalité aura contredit.

---

# Ce qui vient ensuite — pour mémoire, pas à faire maintenant

**V1 (fondations)** : consultation des règles SRD, fiches de règles, création de personnage, versionnage des rulesets, campagnes, distinction MJ/joueur en RLS, historique du wiki, premières fonctionnalités IA d'assistance à l'écriture.

**V2 (jeu)** : outils de combat, initiative, tables aléatoires, générateurs, rencontres, cartes, simulation. Spécifiés dans `specs/outils-mj.md`.

**V3 (solo)** : MJ IA, RAG, propositions validées, wiki progressif.

**Ne pas ouvrir l'application à des joueurs tiers avant que la V1 ait descendu la visibilité fine dans la RLS.** D'ici là, le filtrage repose sur la couche service, ce qui est suffisant pour un usage personnel et insuffisant pour un usage public.
