# 0080 — Ce que voit un joueur : les tables brutes au MJ, une projection par PJ

**Date :** 2026-10-22
**Statut :** proposée (V4-H1)

## Contexte

Les tables de simulation contiennent la vérité, les mensonges, les rêves secrets. La RLS actuelle des tables de psyché laisse lire tout membre du monde. Un joueur peut interroger la base directement avec son jeton : la RLS est la seule vraie barrière (règles 3 et 5).

## Options envisagées

- **A.** RLS fine par colonne et par réglage — illisible, et les réglages vivent dans du `jsonb`.
- **B.** Des fonctions `security definer` qui filtrent à la lecture — de la logique de visibilité dupliquée en SQL.
- **C.** Tables brutes réservées à l'admin du monde ; le moteur écrit pour chaque PJ une **projection** déjà filtrée, lisible par son seul joueur.

## Décision

**C.** `sim_pc_views`, réécrite à la fin de chaque lot et à chaque changement de réglage. En campagne avec MJ, seuls les gestes du MJ écrivent la simulation ; en solo, le joueur est l'admin. Détail : `specs/simulation-monde.md` §1 et §14.

## Conséquences

- Aucune donnée « MJ seul » ne peut atteindre un joueur, même par une requête directe.
- Une projection peut retarder d'un lot sur l'état : c'est assumé.
