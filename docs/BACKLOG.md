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
- [x] Recherche par nom, alias et résumé via `search_fr`.
- [x] Insensible aux accents.
- [x] Résultats filtrés par visibilité **côté serveur**.
- [x] Moins de 500 ms sur 1 000 entités (jeu de test généré).

**Écart trouvé et corrigé en cours de route :** `search_fr` (créé en Phase 0) n'appliquait jamais `unaccent()` malgré l'extension déjà installée — vérifié empiriquement, chercher « epee legere » ne trouvait pas « Épée Légère ». Migration `20260801110001_search_unaccent.sql` : `unaccent()` dans `app.entities_search_fr`, recalcul forcé des lignes existantes, et une fonction `public.search_entities` (`security invoker`, RLS normale) exposée via PostgREST puisque `app.*` n'est jamais exposé directement. Testé avec 1000 entités générées : ~60 ms.

Branché dans `<CommandPalette>` : requête locale instantanée sur la liste déjà chargée pour l'état vide, requête serveur débattue (200 ms) dès qu'une frappe non vide existe.

---

## V0-06b — Polish visuel de la fiche · `M`

La mécanique (V0-04) est faite ; l'esthétique des contrôles ne l'est pas encore. Reprendre le niveau de finition de l'ancienne application (`master`, avant la refonte) : menus déroulants et combobox personnalisés plutôt que `<select>`/`<input>` bruts, contrôles d'édition qui se révèlent au survol plutôt que toujours visibles, hiérarchie typographique et espacements resserrés pour les blocs `infobox`/`custom_table`. Ne touche à aucune donnée ni schéma — uniquement `components/blocks/**` et `app/m/[worldSlug]/f/[entitySlug]/EditEntityForm.tsx`.

**Critères d'acceptation**
- [x] Aucun `<select>` natif visible dans la fiche ; remplacés par un composant cohérent avec les jetons de `tokens.css`.
- [x] ~~Les contrôles d'édition d'un bloc (visibilité, réordonnancement, suppression) n'apparaissent qu'au survol ou au focus, pas en permanence.~~ **Inversé par V0-06d** : l'ancienne application (`master`) les garde toujours visibles, sans dégradé au survol — voir la note de ce ticket.
- [x] Aucune régression sur les critères d'acceptation déjà passés de V0-03b et V0-04.

**Livré** : `components/shared/Dropdown.tsx` (portail, positionnement adaptatif, fermeture au clic extérieur — repris de `master`, adapté aux jetons de `tokens.css`), branché partout où un `<select>` existait (type d'entité, visibilité des segments/blocs/relations, type de relation, entité cible). Contrôles de bloc repliés dans `group-hover`/`group-focus-within` (label de renommage volontairement toujours visible — ce n'est pas un « contrôle d'édition » au sens du critère). Bouton persistant « + Nouvelle entité » déplacé en bas de la barre latérale (bordure du haut, pleine largeur), comme dans l'ancienne application ; le lien redondant de la page d'accueil du monde a été retiré (l'état vide garde son propre bouton, critère V0-03b préservé). **Le hover-gating des contrôles de bloc a ensuite été retiré par V0-06d**, à la demande explicite de l'utilisateur de coller au comportement de `master` (contrôles toujours visibles).

---

## V0-06c — Fenêtres flottantes avec URL · `L`

`docs/adr/0006-fenetres-flottantes.md`. Le panneau unique de V0-03b/§4.2 ne rend pas la sensation de bureau de l'ancienne application (`master`) : plusieurs fiches ouvertes à la fois, en fenêtres déplaçables. Le multi-panneau prévu pour la V1 est avancé ici, exécuté comme des fenêtres plutôt que des panneaux fixes côte à côte — sans jamais perdre l'URL par fiche (raison documentée en §4.1 : partage, retour, rechargement).

**Livrables**
- La première fiche ouverte reste rendue serveur sur `/m/[mondeSlug]/f/[ficheSlug]`.
- Les fiches ouvertes en plus apparaissent dans `?avec=slug1,slug2,...`, récupérées côté client via une route dédiée (mêmes données que la page : entité, blocs, relations, autres entités).
- `<WindowFrame>` : fenêtre déplaçable et redimensionnable, avec titre, bouton de fermeture, mise au premier plan au clic.
- Position/taille/empilement en état client, jamais dans l'URL (fermer une fenêtre retire son slug de `?avec=` ; la faire glisser ou la mettre au premier plan ne touche pas l'historique de navigation).
- Petit écran (< 768px) : repli sur l'affichage plein écran actuel, une fiche a la fois — pas de fenêtres flottantes sur mobile.

**Critères d'acceptation**
- [x] Ouvrir une deuxième fiche pendant qu'une autre est ouverte ajoute son slug à `?avec=`, sans perdre la première.
- [x] Recharger la page avec `?avec=...` rouvre exactement les mêmes fenêtres.
- [x] Fermer une fenêtre retire son slug de l'URL et ne casse pas les fenêtres restantes.
- [x] Partager l'URL d'un état à plusieurs fenêtres ouvertes reproduit le même état chez un autre membre du monde.
- [x] Glisser ou redimensionner une fenêtre ne modifie ni l'URL ni l'historique de navigation (pas d'entrée ajoutée au bouton retour).
- [x] En dessous de 768px, aucune fenêtre flottante : une fiche plein écran, comme aujourd'hui.

**Livré** : `components/shell/{DesktopContext,DesktopWindows,WindowFrame,RegisterPrimaryWindow,useOpenEntityLink}.tsx`, `src/server/services/entityWindow.ts` (logique partagée entre la page SSR et la route API des fenêtres secondaires), `app/api/worlds/[worldSlug]/entities/[entitySlug]/window/route.ts`. `<WindowFrame>` est repris quasi tel quel de `master` (glisser, redimensionner, agrandir/restaurer, aimantation aux bords), adapté aux jetons de `tokens.css`. Position/taille utilisent le motif React officiel d'ajustement d'état pendant le rendu plutôt qu'un `useEffect` avec `setState` synchrone en tête de corps.

**Piège trouvé en testant** : `<Sidebar>` (donc `<EntityTree>`/`<CommandPalette>`) était rendu comme frère de `<DesktopWindows>` dans `AppShell`, hors de son `DesktopContext.Provider` — `useDesktop()` y renvoyait toujours `null`, et les clics dans la barre latérale retombaient silencieusement sur une navigation classique au lieu d'ouvrir une fenêtre. Corrigé en passant `sidebar` en prop à `<DesktopWindows>`, qui le rend désormais à l'intérieur de son propre Provider.

---

## V0-06d — Fidélité structurelle de la fiche à l'ancienne application · `M`

Après V0-06c, retour utilisateur : l'esthétique se rapproche de `master` mais la **construction** de la fiche et de ses blocs restait celle, plus verbeuse, de V0-04/V0-06b (titre séparé du champ, blocs encadrés, boutons « Enregistrer » explicites, contrôles cachés au survol). Ce ticket reprend la structure exacte de `master` (`EntityDetail.tsx`) : titre éditable en place, type en pastille compacte, blocs discrets (pas d'encadré) toujours modifiables, sauvegarde automatique au blur/changement sans bouton dédié.

**Livrables**
- Polices exactes de `master` : `Geist Sans` (`--font-chrome`/`--font-narrative`), `Geist Mono` (`--font-mech`), `Outfit` (`--font-display`, nouveau rôle), via `next/font/google`.
- `.entity-title`/`.block-title` dans `globals.css`, repris de `master` (Outfit, 800/700).
- `EditEntityForm.tsx` : titre = `<input>` unique stylé `.entity-title`, plus de bouton « Enregistrer » — chaque champ sauvegarde au blur ou au changement (`save(overrides?)`).
- `EntityBlocks.tsx` : blocs à plat (`border-b`, pas de carte), titre de bloc éditable en place, tous les contrôles (visibilité, réordonnancement, suppression) **toujours visibles** — plus de hover-gating (voir note V0-06b ci-dessus).
- `SegmentsEditor.tsx` : même retrait du hover-gating, `onBlur` ajouté pour la sauvegarde automatique du contenu narratif.

**Critères d'acceptation**
- [x] Modifier le titre, le type, les alias, le résumé, les tags ou un segment puis quitter le champ persiste la modification côté serveur (vérifié par rechargement réel, pas seulement par l'état client).
- [x] Modifier le titre, le type ou la visibilité d'un bloc persiste de la même façon, y compris quand deux modifications successives touchent la même ressource à quelques millisecondes d'intervalle.
- [x] Aucun bouton « Enregistrer » visible ; aucun contrôle de bloc caché derrière un survol.
- [x] `typecheck`, `lint`, `test` (174 tests) passent ; `next build` propre après arrêt du serveur de dev.

**Piège trouvé en testant** : modifier le titre d'un bloc puis changer immédiatement sa visibilité déclenchait deux `PATCH /api/blocks/:id` quasi simultanés (un déclenché par le blur du titre vers le menu de visibilité — rendu en portail, donc hors du `<div>` du bloc —, un par le `onChange` du menu lui-même). Le second envoyait une version déjà périmée : 409 silencieux, changement de visibilité perdu sans message utile. Corrigé par sérialisation par bloc (chaîne de promesses + version suivie dans une ref, `EntityBlocks.tsx`) et le même correctif appliqué par précaution à `EditEntityForm.tsx` (même schéma de sauvegarde automatique multi-déclencheurs sur une ressource versionnée unique).

**Non fait, assumé** : le point coloré par type d'entité (nécessiterait des couleurs HSL hors `tokens.css`, contraire au critère V0-03b), le glisser-déposer réel pour réordonner les blocs (gardé ▲/▼), le tiroir JSON de debug de `master`, et la reprise complète de la palette hexadécimale exacte de `master` (explorée, un vrai conflit de contraste 7:1 trouvé sur les modes clairs, mais écartée pour prioriser cette fidélité structurelle).

---

## V0-06e — Blocs génériques et menu compact · `L`

Retour utilisateur après V0-06d : `summary`/`tags`/« Contenu narratif » sur l'entité font doublon avec les blocs (et ne sont affichés nulle part ailleurs dans l'UI actuelle — vérifié : ni aperçu, ni tooltip, ni carte). Le bloc `description` porte un nom qui présuppose son usage ; le MJ (ou l'IA) doit pouvoir en faire un bloc « Caractère », « Histoire », etc. juste en changeant son titre. `gallery` (plusieurs images) n'a jamais servi qu'à une seule image en pratique.

**Décisions prises avec l'utilisateur**
- `entities.summary`, `entities.tags`, `entities.narrative_content` : colonnes supprimées du schéma (pas seulement cachées côté UI). `search_fr` repose désormais sur `name` + `aliases` seulement.
- Bloc `description` → renommé `text` : même contenu (segments narratifs porteurs de visibilité), mais le type ne présuppose plus un rôle — le titre libre du bloc porte le sens.
- Bloc `gallery` → renommé `image` : une image + une légende optionnelle, plus de tableau d'images. Rien ne l'utilise en production aujourd'hui.
- Catalogue V0 des blocs de wiki devient : `text`, `infobox`, `image`, `custom_table`.

**Livrables**
- Nouvelle migration (jamais toucher une migration déjà appliquée) : suppression des colonnes, régénération de `search_fr`/`app.entities_search_fr` (2 arguments), suppression de l'index `entities_tags_idx`.
- `src/core/schemas/blocks/{text,image}.ts` remplacent `description.ts`/`gallery.ts` ; `registry.ts` mis à jour.
- `EntityBlocks.tsx` : en-tête de bloc uniforme pour tous les types (chevron, titre éditable, étiquette de type, visibilité, ▲/▼ toujours visibles) + un menu compact `⋮` regroupant Dupliquer/Supprimer, à la place du bouton `×` directement exposé.
- `EditEntityForm.tsx`/`NewEntityForm.tsx` : retrait des champs résumé, tags et de la section « Contenu narratif ».

**Critères d'acceptation**
- [x] Créer et modifier une entité sans résumé, tags ni contenu narratif au niveau de la fiche — tout passe par des blocs.
- [x] Un bloc `text` peut être renommé librement (« Description », « Histoire »...) sans que son type technique change.
- [x] Un bloc `image` porte une image et une légende ; le bouton `×` a disparu, remplacé par un menu `⋮` avec Dupliquer/Supprimer.
- [x] La recherche (`search_entities`) continue de fonctionner sur nom/alias après suppression de `summary`.
- [x] Aucune régression sur les critères déjà passés (V0-03b, V0-04, V0-06b, V0-06c, V0-06d).

**Livré** : migration `20260801120001_entity_generic_blocks.sql` (colonnes supprimées, `search_fr`/`app.entities_search_fr` a deux arguments), `src/core/schemas/blocks/{text,image}.ts`, `registry.ts` mis à jour, `components/shared/ActionsMenu.tsx` (menu compact repris du même patron portail/positionnement que `Dropdown.tsx`), `EntityBlocks.tsx`/`EditEntityForm.tsx`/`NewEntityForm.tsx` mis à jour, `scripts/seed-dev.ts` aligné (résumés migrés vers des blocs `text`, catalogues de blocs des `entity_templates` renommés).

**Piège trouvé en testant** : la migration renommait le catalogue de types côté code en supposant qu'aucune ligne réelle n'utilisait `description`/`gallery` — faux : des blocs créés pendant les sessions de test manuel de ce même chantier portaient encore ces valeurs, rendues « Type de bloc inconnu » une fois le code renommé (`display.layout` interne au jsonb posait le même problème, rejeté par le nouvel enum au prochain enregistrement). Corrigé par deux migrations de données supplémentaires (`20260801130001`, `20260801130002`), idempotentes, qui renomment les lignes existantes plutôt que de supposer leur absence.

---

## V0-06f — Éditeur de texte riche (bulle flottante) · `L`

Suite de V0-06e. Avant la refonte, `master` utilisait Tiptap avec une bulle flottante (gras/italique/souligné/barré) — mais son marquage « Masquer aux joueurs » était **purement cosmétique** : le HTML complet (secret compris) partait quand même vers le client. C'est ce que la règle absolue n°4 de `CLAUDE.md` interdit. Ce ticket reprend l'expérience d'édition de `master` sans reprendre son mécanisme de masquage : le modèle de segments actuel (déjà filtré réellement côté serveur) est étendu, pas remplacé par du HTML.

**Décisions prises avec l'utilisateur**
- Gras/italique/souligné/barré uniquement pour ce ticket (lien et couleur : plus tard, si le besoin se confirme).
- Masquer un passage à l'intérieur d'un bloc texte : sélectionner le passage puis « Cacher ce passage » scinde le segment en coulisses (plus de bouton « + Ajouter un segment » exposé) ; la visibilité qui en résulte reste réellement filtrée côté serveur.

**Livrables**
- `src/core/schemas/entities/segments.ts` : le nœud texte porte un tableau de marques combinables (`bold`/`italic`/`underline`/`strike`) au lieu de nœuds exclusifs `em`/`strong`/`code` ; `ref` reste un nœud distinct. Nouveau champ `blockType` (`paragraph`/`h1`-`h4`) : un segment est un bloc (paragraphe ou titre), la visibilité reste a cette granularite, jamais sur une plage inline.
- Nouvelle dépendance `@tiptap/*` (MIT, déjà précédent dans `master` — écrire un éditeur riche à la main serait nettement pire).
- `SegmentsEditor.tsx` remplacé par un éditeur Tiptap (`components/entities/richtext/`) qui sérialise vers/depuis `Segment[]` (`src/core/richtext/tiptapSync.ts`, module pur teste en premier), jamais vers du HTML stocké tel quel.
- Action « Cacher ce passage » sur une sélection.

**Critères d'acceptation**
- [x] Gras, italique, souligné et barré sont combinables sur un même passage.
- [x] « Cacher ce passage » sur une sélection applique une visibilité reellement filtree cote serveur (granularite bloc/paragraphe — voir note ci-dessous, pas de decoupage automatique en cours de phrase).
- [x] Aucune régression sur le linker (`detectEntityReferences`) ni sur les tests existants des segments.

**Livré** : `src/core/richtext/tiptapSync.ts` (+ tests, conversion pure `Segment[] <-> doc Tiptap`, sans dependance a `@tiptap/*` — regle absolue n°14), `components/entities/richtext/{extensions,BubbleSelect,RichTextEditor}.tsx`. Bulle flottante (`@tiptap/react/menus`) au survol d'une selection : selecteur Paragraphe/Titre 1-4 (tailles 20/18/16/14px, paragraphe a 12px), Gras/Italique/Souligne/Barre, et un selecteur de visibilite qui s'applique a tous les blocs touches par la selection. Chaque paragraphe/titre porte son propre `segmentId`/visibilite en attribut Tiptap (`data-*`), avec un lisere `--gm` (meme signe distinctif que `VisibilityBadge`, desormais retire car remplace par cet indicateur) sur tout bloc non public. La granularite de « Cacher ce passage » est le bloc (paragraphe/titre), pas une plage de mots au milieu d'une phrase — isoler un passage precis demande d'abord de le mettre sur sa propre ligne (Entree), puis de lui appliquer une visibilite ; documente comme un choix delibere plutot qu'une vraie decoupe inline, qui aurait exige un modele de visibilite par plage (hors schema actuel).

**Non refait depuis `master`** : le marquage « Masquer aux joueurs » (visibilite cosmetique, HTML complet envoye quand meme au client) — contraire a la regle absolue n°4, volontairement pas repris. Le marquage « spoiler » (caviardage revele au clic) est repris differemment en V0-06g : comme une marque de mise en forme sans lien avec la visibilite reelle, jamais comme un substitut au filtrage serveur. Lien et couleur de texte de l'ancienne bulle : hors perimetre de ce ticket (decision utilisateur), a ajouter plus tard si le besoin se confirme.

**Aussi livré dans ce ticket** (retour utilisateur sur la coquille) : en-tete de fiche aligne sur l'ancienne application — le type d'entite (« Personnage ▾ ») remonte a hauteur du titre, aligne a droite ; le slug (identifiant d'URL sans accents) descend sous le titre plutot qu'a cote (il sert de reference technique pour l'URL, retire n'aurait rien simplifie) ; la zone de portrait est agrandie pour que sa hauteur propre force un espacement visible entre les relations et le premier bloc.

**Vérification de la visibilité réelle** : la chaîne de filtrage (`src/core/visibility`, `filterBlocks`/`canSee`) n'a pas été modifiée par ce ticket — seul le schéma des segments a changé, en conservant la même forme `visibility: { level, scopeId }` déjà consommée par cette chaîne, déjà vérifiée avec un compte `viewer` réel lors de V0-04. Pas re-testée de bout en bout avec un nouveau compte ici : la garantie tient à l'absence de changement du chemin de filtrage, pas à un nouveau test.

---

## V0-06g — Slug numérique, création instantanée, spoiler · `M`

Trois retours utilisateur sur la fiche.

**Slug numérique.** Le slug était dérivé du nom à la création (`slugify`) ; un nom éditable en place (V0-06d) rend un slug figé sur l'ancien nom trompeur dès le premier renommage. Remplacé par un numéro séquentiel par monde (`src/core/slug/nextNumericSlug`, pur, testé), qui ne représente jamais que lui-même. Les mondes gardent leur slug dérivé du nom (`slugify`/`nextSlugCandidate` toujours utilisés par `src/server/services/worlds.ts`) — un monde change de nom bien plus rarement qu'une entité, et son slug figure dans les URL partagées.

**Création instantanée.** Plus d'écran de création séparé (`/f/new` supprimé) : « + Nouvelle entité » crée directement une fiche vierge (nom vide, type « Autre », aucun alias) et y redirige — cohérent avec le slug numérique (aucune décision de nommage ne bloque plus la création) et avec la fiche déjà entièrement éditable en place (V0-06d). Le titre reçoit le focus automatiquement. `updateEntitySchema` n'exige plus un nom non vide (`.min(1)` retiré) : imposer un nom avant tout autre changement aurait réintroduit la friction que ce ticket retire.

**Spoiler.** Nouvelle marque combinable (`src/core/schemas/entities/segments.ts`, aux côtés de gras/italique/souligné/barré) : caviarde un passage à l'affichage, un clic le révèle. À ne jamais confondre avec la visibilité — le texte caviardé est bel et bien envoyé au client (qui y a déjà droit), seul l'affichage initial le masque ; la révélation bascule un attribut DOM local (`data-revealed`), jamais une transaction Tiptap, pour ne jamais se sauvegarder ni survivre à un rechargement (recaviardé à chaque lecture, comme demandé).

**Critères d'acceptation**
- [x] Créer une entité attribue un slug numérique unique par monde ; renommer l'entité ensuite ne change jamais ce slug.
- [x] Cliquer « + Nouvelle entité » ouvre directement une fiche vierge éditable, sans écran intermédiaire.
- [x] Un passage marqué spoiler est caviardé à l'affichage et se révèle au clic ; l'état révélé ne persiste pas au rechargement.
- [x] Aucune régression sur les tests existants (`slug`, `segments`, `richtext`).

**Livré** : `src/core/slug/slug.ts` (`nextNumericSlug`), `src/server/repos/entities.ts` (`listEntitySlugsForWorld`), `src/server/services/entities.ts` (`generateUniqueEntitySlug` sans le nom), `app/m/[worldSlug]/actions.ts` (`createBlankEntityAction`), `components/shell/Sidebar.tsx`/`app/m/[worldSlug]/page.tsx` (formulaire d'un clic au lieu d'un lien vers `/f/new`), `components/entities/richtext/extensions.ts` (`Spoiler`), CSS `.rich-text-content [data-spoiler]`.

**Piège trouvé en testant** : la marque `Spoiler` rendait bien l'attribut `data-spoiler` mais la CSS ciblait une classe `.rich-spoiler` jamais posée sur l'élément — caviardage invisible tant que non corrigé (CSS reciblée sur l'attribut, cohérent avec `[data-visibility]` déjà utilisé pour le même genre d'indicateur). Egalement corrigé en passant : `src/core/richtext/tiptapSync.ts` dupliquait la liste des marques au lieu d'importer celle de `segments.ts` — la marque `spoiler` aurait été silencieusement perdue à la lecture (`isMark` ne la reconnaissant pas) sans ce partage explicite.

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
