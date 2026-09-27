# Backlog V3.1 — Rugosités trouvées en jouant

**Version :** 1.0 — 27 septembre 2026

Différent de V2 et V3 : pas de lots planifiés à l'avance, pas de découpage en
phases. Ce backlog recueille les petites corrections trouvées **au fil de
l'utilisation réelle** de l'outil — un formulaire qui coince sur un cas
concret, un avertissement qui ment, un détail qui gêne à la table. Un ticket
s'y ajoute quand quelque chose de ce genre est constaté, pas quand il est
planifié. Taille attendue : `S` ou `M` presque toujours — si un ticket ici
grossit au point de devenir un vrai chantier, il migre vers V2 ou V3.

---

### V3.1-1 — `REQUIRED_BLOCKS` trop strict sur les sorts sans effet chiffré · `S`

Constaté le 27 septembre en créant la sous-classe « Serment de vengeance »
(Paladin) et en relisant le ticket V2-N2 : sur les 339 sorts de la base SRD
5.2.1 (2024), seuls 66 portent un bloc `effects`/`scaling` — la grande
majorité des sorts (buffs, utilitaires, mise en scène pure) n'ont
légitimement **aucun** effet chiffré structuré. Le formulaire manuel « Créer
un sort » (`CreateHomebrewSpellForm.tsx`, V2-N2) le sait déjà et n'écrit pas
de bloc `effects` quand la section reste vide — mais `REQUIRED_BLOCKS`
(`src/core/rules/requiredBlocks.ts`), qui liste les blocs attendus par type
d'entrée (`entry-types.ts`), exige `effects` pour **tout** sort sans
distinction. Résultat : une fiche de sort sans effet chiffré affiche à tort
l'avertissement « bloc manquant » — déjà visible aujourd'hui sur Détection de
la magie, et ça vaudrait pour n'importe quel sort maison créé sans effet.

Le ticket V2-N2 l'avait déjà noté en passant, sans ouvrir de ticket dédié :
*« c'est plutôt `REQUIRED_BLOCKS` qui est trop strict pour les sorts, à revoir
à part »*.

**Critères**
- [ ] Un sort sans effet chiffré légitime (buff, utilitaire, mise en scène)
  n'affiche plus d'avertissement de bloc manquant.
- [ ] Un sort qui devrait porter un effet chiffré (jet d'attaque ou de
  sauvegarde décrit en prose) continue de le signaler s'il n'en a pas —
  la relecture ne doit pas juste supprimer `effects` de la liste sans
  y réfléchir, sous peine de perdre le signal utile sur les 66 sorts qui en
  ont besoin.
- [ ] Aucune régression sur les autres types d'entrée qui utilisent
  `REQUIRED_BLOCKS` (sous-classe, don, historique…).

---

### V3.1-2 — Aucun moyen d'éditer une fiche maison déjà créée · `M`

Constaté le 27 septembre en corrigeant le don « Chanceux » : son texte,
recopié depuis une mauvaise source, s'est révélé faux une fois la bonne page
du manuel sous les yeux. Chaque fiche de règle (`RuleEntryView.tsx`) ne
propose qu'un bouton « Supprimer » (`disable_entry`, via `/api/worlds/[slug]/
regles/[cle]/disable`) — aucun « Modifier ». La seule façon de corriger un
texte a été de supprimer la fiche puis de la recréer entièrement avec le
formulaire d'origine, en resaisissant tous les champs déjà justes. Ça marche
(la clé se libère : `disable_entry` retire la fiche de `existingKeys`, la
recréation reprend le même slug), mais c'est un détour pour ce qui devrait
être une simple correction de coquille ou de texte mal recopié.

Vaut pour les cinq formulaires de la famille « Créer un/une… » (arme,
historique, don/aptitude, sous-classe, sort) : aucun n'a d'équivalent en
édition, contrairement aux entités du wiki (`EditEntityForm`).

**Critères**
- [ ] Une fiche maison (`content_origin` `user_created` ou
  `personal_reference`) propose un bouton « Modifier » qui rouvre son
  formulaire de création, pré-rempli avec les valeurs actuelles.
- [ ] Valider le formulaire modifie la fiche en place (même `entry_key`,
  mêmes blocs mis à jour) — jamais une nouvelle fiche à côté de l'ancienne.
- [ ] Un renvoi existant vers cette fiche (`ruleset_entry_refs`, une classe
  qui la référence comme sous-classe, un personnage qui la porte comme don)
  continue de pointer dessus après modification.
- [ ] Une base officielle reste inéditable — même verrou que la création.
