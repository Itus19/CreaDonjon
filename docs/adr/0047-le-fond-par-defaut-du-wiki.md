# 0047 — Le fond par défaut du wiki

**Date :** 2026-10-09
**Statut :** acceptée (conception de V3.1-59)

## Contexte

Le MJ choisit un fond, un mode et un flou pour tout le wiki du monde (public et onglet Wiki des joueuses). Une image de sa **bibliothèque personnelle** deviendrait visible d'anonymes ; la bibliothèque doit rester privée.

## Options envisagées

- **A.** Lecture publique de la seule image choisie dans la bibliothèque — une politique de stockage à exception, fragile.
- **B.** À l'enregistrement, **copier** l'image choisie dans le stockage du monde, et servir cette copie.

## Décision

B.
- Colonne `worlds.wiki_background jsonb null` : `{ source: "builtin" | "world_asset", key, mode, blur }`, validée par Zod (mode parmi ceux que le fond permet, flou 0–40). Migration et `docs/SCHEMA.md`.
- Choisir une image de la bibliothèque **copie** le fichier dans l'espace du monde (interface de stockage) ; `key` désigne la copie. Changer de fond supprime l'ancienne copie.
- Lecture publique par `publicShare.ts` (seul porteur du service role), qui ne sert **que** la copie référencée par `wiki_background`. L'onglet Wiki des joueuses lit par le client ordinaire (membre du monde).
- `BookSkin` / `WikiBackgroundProvider` : fond de la fiche, sinon fond du monde, sinon rien. Route d'écriture : Zod, `isWorldAdmin`.

## Conséquences

Aucune image de la bibliothèque n'est jamais lue publiquement (test). V3.1-59 passe « prêt (Opus) ».
