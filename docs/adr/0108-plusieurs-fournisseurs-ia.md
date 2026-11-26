# 0108 — Plusieurs fournisseurs d'IA par compte, un seul qui sert

**Date :** 2026-11-25
**Statut :** acceptée (complète l'ADR 0103)

## Contexte

L'ADR 0103 donnait à chaque compte **un** fournisseur et **un** modèle. En branchant OpenRouter, l'auteur a voulu comparer des modèles (un rapide et bon marché, un meilleur conteur) et garder Venice ou sa machine à côté, sans retaper adresse et clé à chaque essai. Il a demandé de pouvoir passer d'un modèle à l'autre depuis le solo, à côté du voyant d'état.

## Options

- A — Un seul fournisseur, plusieurs modèles. Ne couvre pas « OpenRouter et mon PC ».
- B — Plusieurs fournisseurs, un modèle chacun. Oblige à dupliquer la clé pour chaque modèle d'OpenRouter.
- **C — Plusieurs fournisseurs (dix au plus), chacun avec 1 à 12 modèles, et une ligne de choix par compte** qui désigne le couple qui sert.

## Décision

C. `ai_providers` prend un `id` et une colonne `models text[]` ; `ai_provider_choices` garde le couple choisi (migration `20261125120000_plusieurs_fournisseurs_ia`, `docs/SCHEMA.md` §27). Le choix suit le compte, pas la campagne : c'est la clé et la facture du compte qui changent.

Un choix peut devenir caduc (modèle retiré de la liste). Plutôt qu'un déclencheur SQL, une fonction pure, `choixEffectif` (`src/core/ai/providerChoice.ts`), dit ce qui sert, avec la même règle pour l'écran et pour l'appel.

## Conséquences

- La résolution reste à **une** requête par appel d'IA : le choix est embarqué dans la lecture des fournisseurs.
- L'écran du solo lit la liste **une fois** à l'ouverture (une requête, docs/QUOTAS.md) ; changer de modèle coûte une écriture.
- La RLS du choix vérifie que le fournisseur désigné est au compte (`docs/SECURITE.md`, registre du 25 nov.).
- La migration supprime la colonne `model` : elle doit être appliquée **avant** de déployer le code qui lit `models`.
