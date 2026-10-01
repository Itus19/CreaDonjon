# 0032 — Le tag d'un compte devient visible du MJ de sa campagne

**Date :** 2026-10-01
**Statut :** acceptée — amende l'ADR 0031 §3

## Contexte

L'ADR 0031 a posé que `profiles.handle_tag` (les 4 chiffres d'un compte « tag »)
n'est « jamais visible hors des réglages du compte concerné ». V3.1-15 bute
dessus : la Gestion de campagne liste deux comptes « Tamara » que rien ne
permet de distinguer, alors que c'est exactement le cas que le tag existe
pour trancher (un `handle_name` n'est pas unique).

## Options

1. Garder la règle : une simple étiquette « même nom qu'un autre compte ».
   Signale le doublon sans dire lequel est lequel.
2. Afficher le courriel quand il existe : un compte tag n'en a pas forcément.
3. Afficher le tag au MJ de la campagne seulement.

## Décision

**Option 3** (auteur, 1ᵉʳ octobre). Le tag reste invisible partout ailleurs :
jamais dans la liste de membres vue par une joueuse, jamais dans une
attribution publique, jamais au wiki. Il s'affiche **dans la Gestion de
campagne, au MJ qui gère cette campagne**, à côté du nom (`Tamara#4821`).
Le superadmin le voyait déjà (V3.1-10, panneau d'administration).

## Conséquences

- Le filtrage est **serveur** (règle absolue 5) : `/api/campaigns/[id]` ne
  renvoie les tags que si l'appelant gère la campagne (même garde que
  `canManage`), jamais un champ envoyé à tous puis masqué à l'écran.
- La connexion ne change pas : on tape toujours un nom et un mot de passe,
  jamais le tag.
- Le commentaire de colonne `profiles.handle_tag` (migration
  `20260929130000`, appliquée, donc intouchable — règle absolue 14) décrit
  l'ancienne règle : une nouvelle migration le met à jour.
