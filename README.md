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
| `docs/CHARTE-UI.md` | Charte d'interface **normative**, extraite du code — a lire avant tout code d'interface |
| `docs/BACKLOG.md` | Tickets Phase 0 et V0 (termine, valeur historique) |
| `docs/BACKLOG_V1.md` | Tickets V1, le compagnon jouable |
| `docs/BACKLOG_V2.md` | Tickets V2 — l'essentiel de ce qui existe aujourd'hui |
| `docs/BACKLOG_V3.md` | Tickets V3, le mode solo (aucun commence) |
| `docs/audit/` | Rapports d'audit du 2026-09-06 : backend, interface, synthese |
| `ROADMAP.md` | Etat d'avancement par module (tableau de bord, pas une liste de tickets) |
| `docs/adr/` | Decisions d'architecture et leurs raisons |
| `specs/` | Specifications detaillees (regles, wiki, personnages, moteur de jeu) |
| `src/core/**` | Noyau pur : formules, des, visibilite. Aucun import de `next`, `react` ou `@supabase/*` (verifie par ESLint) |
| `src/server/services/**` | Logique metier |
| `src/server/repos/**` | Seul endroit du code qui interroge Supabase |
| `lib/**` | Les schemas Zod partages entre client et serveur, et les fabriques de client Supabase. Rien d'autre — voir ci-dessous |
| `src/i18n/fr.ts` | Libelles francais de l'interface (les identifiants techniques restent en anglais) |
| `supabase/migrations/` | Migrations SQL, appliquees et jamais modifiees une fois en place |

### `lib/` ou `src/` ?

La question se pose parce que sept dossiers portent le meme nom des deux
cotes (`formula`, `visibility`, `relations`, `ruleset`, `generators`,
`shareLinks`, `campaignInvites`). La regle, constatee sur les 32 fichiers
de `lib/` :

- **`lib/<domaine>/schemas.ts`** — le schema Zod d'une entree de route ou de
  server action. Il est importe des deux cotes : par la route qui valide, et
  par le formulaire client qui envoie. C'est sa seule raison d'etre a la
  racine plutot que dans `src/`.
- **`lib/supabase/*`** — les cinq fabriques de client : navigateur, serveur,
  middleware, et les deux clients service-role confines
  (`service.ts` pour le partage public, `serviceAccountProvisioning.ts` pour
  les comptes invites, chacun avec sa portee etroite et sa regle ESLint).
  Aucun de ces fichiers ne contient de requete : elles vivent toutes dans
  `src/server/repos/**`.
- **Tout le reste va dans `src/`.** Une regle metier, un calcul, une formule :
  `src/core/**` si c'est pur, `src/server/services/**` sinon. Un fichier de
  `lib/` qui se met a decider quelque chose est au mauvais endroit.

## Architecture en une phrase

Le wiki et le moteur de regles ne sont pas deux systemes : chaque entite
possede une facette narrative et une facette mecanique dans un modele de
donnees unique. Voir `docs/PDD.md` §28 pour le detail des couches
(composants serveur -> server actions -> services -> repos -> PostgreSQL/RLS).
