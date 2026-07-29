# 0001 — Nouveau projet Supabase dedie a la refonte

**Date :** 2026-07-29
**Statut :** acceptee

## Contexte

Le nouveau schema (`docs/SCHEMA.md`) redefinit des tables qui existaient
deja sous le meme nom dans le projet Supabase lie a l'ancienne app
(`worlds`, `entities`, `blocks`, `relations`, `campaigns`...), avec des
colonnes differentes (visibilite a deux colonnes, `slug`, `search_fr`,
etc.). Appliquer les nouvelles migrations sur ce projet aurait echoue
immediatement (tables deja existantes) ou aurait exige de detruire les
donnees et le schema de l'ancienne app.

## Options envisagees

- **A. Reutiliser le projet existant**, en supprimant l'ancien schema
  d'abord — risque de casser l'app sur `master` si on veut y revenir,
  pour un gain nul (tres peu de donnees reelles a l'epoque : 2 mondes,
  5 entites).
- **B. Nouveau schema Postgres separe** dans le meme projet — evite la
  collision de noms, mais PostgREST n'expose par defaut que le schema
  `public` ; complexite de configuration disproportionnee par rapport
  au besoin.
- **C. Nouveau projet Supabase dedie**, projet existant intact.

## Décision

Option C. Nouveau projet `creadonjon-v2` (ref `fivakjqzqgfvfpaqvqex`),
lie en local, `.env.local` reconfigure (jamais commite). L'ancien projet
reste inchange et reutilisable pour l'app sur `master`.

## Conséquences

- L'app sur `master` continue de fonctionner sans aucun changement.
- `.env.local` pointe desormais vers le nouveau projet : revenir
  travailler sur `master` demandera de relier l'ancien projet et de
  restaurer l'ancienne cle (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`), a
  ne pas oublier.
- Aucune donnee de l'ancien projet n'est migree vers le nouveau ; le
  peu de contenu de demonstration existant est recree via le seed de
  P0-09 plutot que porte.
