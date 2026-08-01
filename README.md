# CreaDonjon

Plateforme web de creation, gestion et jeu de mondes narratifs : un wiki
structure, un moteur de regles multi-systemes, et un mode solo ou une IA
joue le maitre du jeu.

## Installation

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs (voir .env.example)
```

`supabase link --project-ref <ref>` pour relier le CLI au projet Supabase
utilise en developpement (voir `docs/adr/0001-nouveau-projet-supabase.md`).

## Commandes

```bash
npm run dev              # serveur de developpement
npm run build            # verifie que ca compile pour de vrai
npm run typecheck        # tsc --noEmit
npm run lint              # ESLint (inclut la regle no-restricted-imports sur src/core)
npm run test              # Vitest, tout le projet
npm run test:core         # Vitest, src/core uniquement (rapide, aucune dependance)
npm run test:watch        # Vitest en mode watch
npm run test:coverage     # Vitest avec couverture (src/core)
supabase start            # base locale (necessite Docker)
supabase db reset         # rejoue toutes les migrations + le seed
supabase gen types typescript --local > src/types/database.ts
```

## Ou trouver quoi

| Chemin | Contenu |
|---|---|
| `CLAUDE.md` | Regles absolues du projet (securite, IA, base de donnees, architecture) |
| `docs/PDD.md` | Source de verite fonctionnelle |
| `docs/SCHEMA.md` | Schema de donnees, SQL, RLS, formules |
| `docs/BACKLOG.md` | Tickets Phase 0 et V0, avec criteres d'acceptation (termine, valeur historique) |
| `docs/BACKLOG_V1.md` | Tickets V1, avec criteres d'acceptation (en cours) |
| `ROADMAP.md` | Etat d'avancement par module (tableau de bord, pas une liste de tickets) |
| `docs/adr/` | Decisions d'architecture et leurs raisons |
| `docs/specs/` | Specifications detaillees (regles, wiki, personnages) |
| `src/core/**` | Noyau pur : formules, des, visibilite. Aucun import de `next`, `react` ou `@supabase/*` (verifie par ESLint) |
| `src/server/services/**` | Logique metier |
| `src/server/repos/**` | Seul endroit du code qui interroge Supabase |
| `src/i18n/fr.ts` | Libelles francais de l'interface (les identifiants techniques restent en anglais) |
| `supabase/migrations/` | Migrations SQL, appliquees et jamais modifiees une fois en place |

## Architecture en une phrase

Le wiki et le moteur de regles ne sont pas deux systemes : chaque entite
possede une facette narrative et une facette mecanique dans un modele de
donnees unique. Voir `docs/PDD.md` §28 pour le detail des couches
(composants serveur -> server actions -> services -> repos -> PostgreSQL/RLS).
