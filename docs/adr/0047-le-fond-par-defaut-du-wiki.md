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

## Précisé en codant (V3.1-59, 13 octobre 2026)

- **Forme stockée** (`zWorldWikiBackground`, `src/core/theme/worldWikiBackground.ts`) :
  - `{ source: "builtin", key, mode, blur }` ;
  - `{ source: "world_asset", assetId, mode, blur, hue, chroma, availableModes }`.

  Pour une copie, la teinte, la saturation et les modes permis sont relevés sur l'image de la bibliothèque au moment de la copie. La page publique ne peut pas lire la bibliothèque, et l'image copiée ne change plus.
- **La copie** est un asset du monde en visibilité `players` (`copyAssetToWorld`, option `visibilityLevel`).
  - Les membres la lisent par `/api/worlds/[slug]/wiki-background/image` (client de l'appelant, RLS).
  - Les visiteurs du wiki public la lisent par `/partage/[token]/fond-du-wiki` : même porte que les pages du lien (jeton, mot de passe), et `publicShare.ts` ne signe que cette copie.
  - L'identifiant de la copie versionne l'adresse.
- **Comptée comme référence** (ADR 0057) : `app.asset_reference_count` et le recensement des orphelines lisent `worlds.wiki_background` (migration `20261013140000`). Sinon la copie, désignée par le seul monde, passerait pour abandonnée.
- **Affichage** : le layout de chaque wiki (public, aperçu du MJ, onglet Wiki des joueuses) résout le fond du monde une fois, et le donne au `WikiBackgroundProvider` comme **fond de repli**.
  - Une page qui déclare « pas de fond » (fiche sans fond propre, sommaire) retombe dessus.
  - Une fiche qui a son propre fond le garde (`chooseWikiBackground`).
- **Écriture** : `PUT /api/worlds/[slug]/wiki-background`, entrée `zWikiBackgroundInput` (`builtin`, `library` ou `none`), MJ seul (`isWorldAdmin`). Le mode doit être permis par le fond.
- **Complément du 24 octobre (V3.1-60)** : quatrième entrée `keep` — même fond, autre mode ou autre flou (`retuneWorldWikiBackground`). Sans elle, régler le mode d'une copie était impossible (l'entrée ne désigne pas une copie), et chaque geste sur le flou d'une image de la bibliothèque l'aurait recopiée. `keep` ne copie rien et ne supprime pas la copie en place ; le mode reste contrôlé contre ceux du fond. L'écran Publication l'envoie pour le mode et le flou, et réserve `builtin`/`library` au choix d'une vignette.

