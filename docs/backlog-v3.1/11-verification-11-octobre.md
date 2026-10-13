# V3.1 — Ce qu'a montré la session de vérification du 11 octobre

Source : compte rendu `docs/verifications/2026-10-11-fiches-banc.md` (branche `claude/verif-fiches-banc`). Les fiches des PJ du Banc d'essai ont été remplies par l'assistant de création (Humaine Guerrière 1 Soldat ; Nain Clerc 1 Acolyte), puis les deux PJ sont entrés dans un combat.

**Tri.** Beaucoup de ce qui a été vu touche des écrans ou des règles **pas encore branchés**, que des tickets V3.1 refont déjà. Ce n'est pas un défaut nouveau : le constat est ajouté comme critère au ticket qui s'en charge. Seul ce qu'aucun ticket ne couvre reçoit un ticket ici.

| Constat | Rattaché à |
|---|---|
| Style de combat, Ordre divin, choix de taille absents de l'assistant | V3.1-118 (déjà prévu) |
| Aucune vue joueur du combat | V3.1-102 (déjà prévu) |
| Adversaire saisi à la main sans PV ; liste « Mes combats » figée sur « Pas engagé » | V3.1-38, critère ajouté |
| Fiche jouable : valeurs provisoires fausses et clés d'objet au chargement ; vitesses « 9.1 m » | V3.1-26, critère ajouté |
| Assistant, Compétences : « Lance » en double, outil en anglais, outil du Soldat absent | V3.1-50, critère ajouté |
| « Polyvalente » listé parmi les traits de l'Humain | V3.1-116, critère ajouté |
| Guerrier FOR 17 « Encombré » à 75 kg (constante d'encombrement variante) | V3.1-115, critère ajouté |
| Clés techniques dans les sources de CA | rien : seulement dans le JSON, jamais affiché |

Les numéros V3.1-122 à 124, ouverts puis rattachés le 11 octobre, ne sont pas réutilisés.

---

### ☐ V3.1-121 — Ténacité naine ignorée dans les PV max · `S` · sans modèle IA — **à diagnostiquer (Opus)** — branchement manquant : les effets passifs des traits d'espèce ne sont appliqués nulle part, et aucun ticket ne le prévoit (V3.1-116 ne traite que les traits à choix).

**Modèle conseillé : Opus** — calcul de la fiche (`characterSheet()`, noyau).

Nain Clerc 1, CON 14 : PV max 10 au lieu de 11. Les sources de PV renvoyées par `GET /api/entities/[id]/sheet` ne listent que « Dés de vie (1d8) » 8 et « Constitution » 2 ; le trait est affiché à l'étape Espèce mais ne produit aucun modificateur.

**Critères d'acceptation**
- [x] Test d'abord (noyau) : un Nain niveau 1 gagne +1 PV max, puis +1 par niveau.
- [ ] La fiche du PJ de Testeur B affiche 11 PV max, avec la source « Ténacité naine ». **Réimport fait le 13 octobre** : le bloc `modifiers` de `dwarven-toughness` est en base dans les deux rulesets SRD. Reste à le voir sur la fiche (vérification en direct).

**Codé le 13 octobre (Opus).** Choix de l'auteur : un modificateur « par niveau ».
- **Moteur.** Un modificateur peut porter `per_level` (`zModifier`, `DeclaredModifier`). `characterSheet()` multiplie sa valeur par le niveau total du personnage, avant toute pile ; les sources affichent le total. 5 tests dans `sheet.test.ts`.
- **Branchement.** `resolvedRuleset.ts` lit enfin le bloc `modifiers` des traits d'espèce, validé par Zod, et l'ajoute à la feature de l'espèce en couche 2, avec le nom du trait pour étiquette. Aucune requête de plus : `fetchEntriesBatch` lisait déjà tous les blocs des traits.
- **Donnée.** `data/srd/modifiers-2024.json`, saisi à la main sur le modèle de `triggers-2024.json`, lu par `ingest-srd.ts` et testé par `srdModifiersData.test.ts`. La fiche de règle affiche « +1 par niveau ».
- **Pas fait ici.** La Résilience draconique dépend du *niveau de classe*, et les aptitudes de sous-classe ne sont pas encore résolues : elle attend V3.1-117. Le don Robuste n'est pas dans le SRD 5.2.1 ; une version maison peut porter `per_level`.
