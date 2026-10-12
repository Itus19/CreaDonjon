# ADR 0058 — Un monde solo se copie, il ne se convertit pas

**Date** : 12 octobre 2026 · **Ticket** : V3-F3 · **Statut** : accepté (décisions de l'auteur)

## Contexte

V3-F3 demandait qu'une campagne `solo` devienne une campagne ordinaire, sans migration (`specs/module-joueur-et-solo.md` §D : « ne pas fermer cette porte »). Une bascule existait déjà : `PATCH /api/campaigns/[id]` (superadmin pour aller vers `solo`). Elle était incomplète : elle changeait `mode` et `gm_user_id` sans toucher aux membres, si bien que la campagne restait sans membre `gm` et que l'onglet Solo (V3.1-11) ne disparaissait pas.

## Décisions de l'auteur (12 octobre)

1. **Une table solo ne devient jamais une vraie table**, et l'inverse non plus. Le mode se choisit à la création et ne change plus : la bascule (route, service, menu de l'écran Campagne) est retirée.
2. **Le seul passage est la copie du wiki.** « Dupliquer » crée un monde neuf à partir du wiki d'un autre : fiches, blocs, relations, révisions mécaniques, **et leurs images**. Rien de la partie elle-même : ni découvertes, ni scène, ni journal, ni membres, ni personnages attribués.
3. **Dupliquer demande, à chaque fois** :
   - le **mode** de la copie (campagne, ou solo pour le superadmin) ;
   - si **les règles suivent**. Oui : une variante est recopiée en variante neuve (comportement de l'export), un ruleset personnel (`personal_reference`) est **repris tel quel**, puisque le propriétaire est le même. Non : la copie part du ruleset officiel de la même base.

## Conséquences

- Les images sont **copiées dans le monde neuf** (fichier et ligne `assets`), jamais partagées : un joueur de la copie n'est pas membre du monde d'origine et ne verrait pas une image qui y vit. Les identifiants d'image sont remplacés dans les données des blocs et des révisions (`remapAssetIds`, noyau pur).
- **Les copies faites avant cette décision partagent leurs images de carte avec l'original.** `app.asset_reference_count` compte donc désormais dans **tous** les mondes (migration `20261012130000`), pour qu'aucune image encore utilisée ailleurs ne soit effacée (ADR 0057).
- L'export en fichier et l'import ne changent pas : un fichier ne transporte toujours pas d'image.
