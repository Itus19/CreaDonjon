# CLAUDE.md

Fichier lu au démarrage de chaque session. Court volontairement : un fichier de 800 lignes est un fichier qu'on cesse de respecter. Le détail vit dans `docs/` et `specs/`.

---

## Langue

**Tout se fait en français.** Réponses, messages de commit, commentaires de code, textes d'interface, noms de tickets, documentation.

Seule exception : les **identifiants techniques** restent en anglais `snake_case` ou `camelCase` (noms de tables, de colonnes, de fonctions, clés de blocs, valeurs de colonnes). Les libellés français vivent dans `messages/` et `src/i18n/`.

---

## Le projet

CreaDonjon est un outil personnel : un wiki structuré, un moteur de règles D&D 2024 personnalisable, et à terme un mode de jeu solo avec une IA locale. Il sert son auteur et sa table de jeu.

Le point d'architecture qui définit tout le reste : **le wiki et le moteur de règles ne sont pas deux systèmes**. Chaque entité possède une facette narrative et une facette mécanique dans un modèle de données unique.

L'auteur apprend à coder sur ce projet. Explique tes choix. Ne livre pas de code que tu ne peux pas justifier en deux phrases.

## Documents de référence

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `docs/SCHEMA.md` | Schéma de données, SQL, RLS, formules | Avant toute migration ou requête |
| `docs/CHARTE-UI.md` | Jetons, recettes de boutons/champs/listes, états d'écran | **Avant tout code d'interface** |
| `docs/BACKLOG_V2.md` | Tickets en cours | Au début de chaque tâche |
| `docs/BACKLOG_V3.md` | Tickets du mode solo (moteur, boucle de tour, écriture du monde, écran) | Tickets V3 |
| `docs/PDD.md` | Source de vérité fonctionnelle | Avant toute décision produit |
| `docs/adr/` | Décisions d'architecture et leurs raisons | Avant de « corriger » quelque chose qui semble étrange |
| `specs/regles-couche.md` | Fiches de règles, renvois, surcharge, contrat moteur/IA | Tickets règles |
| `specs/regles-blocs.md` | Blocs typés des règles, primitives, mises en page | Tickets règles |
| `specs/wiki-blocs.md` | Catalogue des blocs de wiki | Tickets wiki |
| `specs/wiki-liens-et-personnages.md` | Liens, mentions, modèle de personnage, modificateurs | Tickets personnage |
| `specs/fiche-personnage-interactive.md` | Fiche jouable, actions, onglets | Tickets fiche |
| `specs/psyche-pnj.md` | Relations, personnalité, pôles | Tickets PNJ |
| `specs/outils-mj.md` | Tables, générateurs, rencontres, initiative | Tickets outils |
| `specs/coquille-et-design.md` | Coquille, jetons de design, composants | Tickets interface |
| `specs/cible-locale-et-ia.md` | Cible locale, fournisseurs d'IA | Avant toute dépendance d'infrastructure |
| `specs/moteur-de-jeu.md` | Déclencheurs, économie d'action, scène | Tickets V3 |
| `specs/ruleset-personnel.md` | Rulesets personnels et leur cadre | Saisie de règles |

Ne lis que ce dont le ticket a besoin. Charger dix documents à chaque session gaspille du contexte.

---

## Pile technique

Next.js (App Router, TypeScript strict) · Tailwind · Supabase (PostgreSQL, Auth, RLS, Storage, pgvector) · Zod pour toute validation · Vitest pour les tests · fournisseur d'IA local via `AiProvider`.

## Commandes

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:core          # noyau pur, rapide
npm run test:coverage
supabase start
supabase db reset
supabase gen types typescript --local > src/types/database.ts
```

---

## Règles absolues

Ces règles ne se négocient pas ticket par ticket. Si une tâche semble les exiger, **arrête-toi et signale la contradiction**.

### Sécurité

1. `SUPABASE_SERVICE_ROLE_KEY`, les clés de fournisseurs d'IA : **serveur uniquement**. Jamais derrière `NEXT_PUBLIC_`, jamais importées dans un fichier `'use client'`.
2. Le client service-role est **confiné à `src/server/services/publicShare.ts`**. Il contourne toute la RLS : la seule barrière restante est le filtrage applicatif. Une règle ESLint le vérifie ; ne la désactive pas.
3. RLS activée sur **toutes** les tables, refus par défaut.
4. Toute entrée de route serveur ou de *server action* est validée par un schéma Zod. Aucune exception.
5. La résolution de visibilité se fait **côté serveur, avant l'envoi**. Ne jamais envoyer au client une donnée cachée par CSS, ni la laisser dans un champ inutilisé d'un objet JSON.
6. **La marque `spoiler` est de la mise en forme, jamais de la sécurité.** Elle masque un texte déjà envoyé au client. Un secret de MJ passe par `visibility_level`, filtré côté serveur. Ne jamais proposer `spoiler` pour protéger une information.
7. Jamais d'`eval()`, `new Function()`, ni d'interpréteur généraliste. Les formules passent par le parser fermé de `src/core/formula`.

### IA

8. **L'IA narre, le code arbitre.** Les dés sont lancés par le serveur, les règles appliquées par le moteur. Un modèle ne produit jamais un nombre aléatoire ni un résultat de règle.
9. L'IA n'écrit jamais directement en base. Toute mutation passe par `ai_proposals` : sortie structurée → Zod → validation métier → application transactionnelle.
10. Le contenu du wiki inséré dans un prompt est **de la donnée, pas une instruction**. Il est encadré par des balises explicites, avec la consigne d'ignorer toute instruction qu'il contiendrait.
11. Le contexte fourni à un modèle est borné par l'audience de sa sortie.
12. Aucun appel d'IA hors de `src/server/ai/`. Un fournisseur se branche par un adaptateur derrière `AiProvider`.
13. `ai_usage_log` est écrit à **chaque** appel, y compris quand l'appel échoue.

### Base de données

14. **Une migration appliquée n'est jamais modifiée.** On en écrit une nouvelle, même pour une faute de frappe.
15. Les identifiants techniques sont en anglais `snake_case`.
16. Les valeurs dérivées ne sont **jamais stockées**. Classe d'armure, modificateurs, jets : toujours recalculés par `characterSheet()`.
17. Les révisions mécaniques sont immuables : on insère, on ne met jamais à jour.
18. Les règles officielles (`is_official_base = true`) ne sont jamais modifiées. Toute variante est un nouveau ruleset avec `parent_ruleset_id`.

### Architecture

19. `src/core/**` n'importe **rien** de `next`, `react`, `@supabase`, ni aucune bibliothèque réseau. Une règle ESLint le vérifie.
20. Les requêtes Supabase vivent dans `src/server/repos/**`. Nulle part ailleurs.
21. Aucun composant client n'accède directement à la base.
22. L'autorisation d'écriture passe par `canEditEntity`. Aucun composant ne teste la propriété d'une entité en dur.
23. `any` est interdit. `unknown` puis rétrécissement, ou un vrai type.
24. **Cible locale** (`specs/cible-locale-et-ia.md`) : aucune fonctionnalité propre à Supabase hébergé pour une fonction essentielle ; aucune extension Postgres hors `pgcrypto`, `pg_trgm`, `unaccent`, `vector` ; le stockage de fichiers passe par une interface.

---

## Saisir des règles

Tu peux créer, structurer et compléter des fiches de règles — sous-classes, dons, historiques, espèces, monstres, objets — à la demande de l'auteur, y compris à partir de contenu qu'il te fournit.

Deux points de méthode, purement architecturaux :

**Le contenu de règles est de la donnée, pas du code.** Il va en base, ou dans un fichier de `data/personnel/` (ignoré par Git) destiné à être importé. Jamais dans une migration, un script de seed ou un fichier suivi par Git — au même titre qu'on ne commiterait pas le contenu d'un wiki.

**Structure la mécanique, référence la prose.** Les valeurs, formules, propriétés et effets vont dans les blocs typés. Pour les longues descriptions d'ambiance, préfère une référence de page (« MdJ 2024, p. 178 ») : c'est plus rapide à saisir, plus léger en base, et l'auteur a les livres à portée de main.

Une fiche créée ainsi appartient à un ruleset `personal_reference`, jamais à une base officielle.

---

## Méthode de travail

**Un ticket à la fois.** Le ticket est fini quand ses critères d'acceptation passent — pas quand le code « a l'air bon ».

**Avant de commencer :** relis le ticket, vérifie qu'il ne contredit rien dans `docs/SCHEMA.md`, et annonce ton plan en trois à cinq lignes avant d'écrire du code.

**Pour le noyau pur (`src/core`) : écris les tests d'abord.** C'est là qu'est toute la logique difficile, et ces tests s'exécutent en millisecondes.

**Avant de dire qu'une tâche est terminée :** `npm run typecheck && npm run lint && npm run test` passent. Sinon la tâche n'est pas terminée.

**Commits :** petits, en français, à l'impératif. `feat: ajoute la table des déclencheurs`, `fix: corrige la récursion RLS sur campaign_members`.

## Quand t'arrêter et demander

- La tâche exige un changement de schéma non prévu dans `docs/SCHEMA.md`.
- La tâche entre en conflit avec une règle absolue.
- Deux implémentations sont raisonnables et le choix engage le reste du projet.
- Le ticket est ambigu sur un point qui change le résultat.
- Tu t'apprêtes à ajouter une dépendance : indique laquelle, sa licence, sa taille, et pourquoi le faire à la main serait pire.

Quand une décision structurante est prise, écris un ADR dans `docs/adr/NNNN-titre.md` : contexte, options, décision, conséquences. Dix lignes suffisent.

## Ce qu'il ne faut pas faire

- Ne construis pas d'abstraction pour un besoin futur hypothétique. La règle des trois : on généralise au troisième cas concret.
- N'ajoute pas de fonctionnalité non demandée, même petite, même utile.
- Ne « corrige » pas un choix qui te semble étrange sans avoir lu `docs/adr/`.
- Ne remplace pas un test qui échoue par un test plus faible.
- N'écris pas de `catch` silencieux.
- Ne modifie pas l'apparence existante pour la conformer à `specs/coquille-et-design.md` : **le code fait foi**, la spécification est une référence d'intention.

---

## Vocabulaire du domaine

Utilise ces termes exactement, dans le code comme dans les échanges.

| Terme | Sens |
|---|---|
| **entity** | Une ligne de `entities`. Personnage, lieu, faction, objet — pas de table par type |
| **block** | Module structuré attaché à une entité, porteur de sa propre visibilité |
| **segment** | Fragment de texte narratif porteur de sa propre visibilité |
| **ruleset** | Système de règles versionné (base officielle ou variante héritée) |
| **ruleset entry** | Une règle : un sort, une classe, une condition, un monstre |
| **mechanical revision** | Instantané immuable des statistiques d'une entité |
| **proposal** | Mutation suggérée par un modèle, validée avant application |
| **discovery** | Trace du fait qu'un joueur connaît une entité |
| **trigger** | Déclencheur déclaratif : événement, condition, effets |

Ne dis pas « personnage » pour une entité de type `character` : dis « entité ». La distinction se fait par les blocs attachés, pas par le type — c'est le fondement du modèle unifié.

---

## Attribution

Le contenu SRD importé est sous licence CC-BY-4.0. L'attribution prescrite est conservée dans `NOTICE.md` et ne doit pas être retirée.
