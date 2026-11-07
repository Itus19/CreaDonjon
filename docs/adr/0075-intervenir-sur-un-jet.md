# 0075 — Intervenir sur un jet : réactions, jet suspendu, une fois par tour

**Date :** 2026-11-07
**Statut :** acceptée (V3.1-135 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

L'étude des règles jouables range treize règles derrière trois manques, regroupés dans le chantier « intervenir sur un jet » :

- **M1, réagir** : une activation ouverte par un jet, pas par un clic. Elle peut viser son propre jet (Indomptable, Coup de chance, Inspiration bardique reçue), une attaque qui vous vise (Bouclier, Esquive instinctive) ou le jet d'un autre (Mots cinglants).
- **M2, agir sur le jet en cours** : ajouter ou retirer un dé, relancer, fixer le d20 à 20, ajouter à la CA contre ce jet, diviser les dégâts.
- **M7, une fois par tour** : Attaque sournoise, Tacticien.

Aujourd'hui un jet se résout et s'applique d'un seul tenant (`resolveTargetedRoll`, `answerSaveRequest`, `rollAbilityCheck`, la boucle du solo). Personne ne peut s'interposer entre le dé et ses conséquences. À la table, le budget d'action (dont la réaction) n'est tenu nulle part ; le solo le tient dans sa scène (`scene.budgets`).

Règles visées : 3, 5, 9, 10, 19, 20, 27, 28, 33, 37, 39 de l'étude.

## Options envisagées

1. **La fenêtre** (choix de l'auteur). A : **jet suspendu**. Si quelqu'un peut réagir, le serveur fige le jet, demande, attend les réponses, puis applique. B : correction après coup. Le jet s'applique, et une réaction le défait et le refait. Les déclencheurs ont alors déjà tiré, et le journal garde un aller-retour. C : réglages automatiques posés d'avance. Personne n'attend, mais le joueur ne choisit plus sur le moment.
2. **Le compte de la réaction et du « une fois par tour »** (choix de l'auteur). A : le moteur compte en combat, sur le participant. B : à l'honneur.
3. **Où vivent les opérations sur le jet.** A : de nouveaux nœuds dans le vocabulaire des effets (`zEffect`). B : une liste à part, `roll_operations`, portée par l'activation. Ces opérations n'ont de sens qu'au milieu d'un jet. Les mêler aux effets laisserait écrire « relancer » dans un déclencheur de fin de tour.

## Décision

**1-A, 2-A, 3-B.**

### Le déclencheur d'une activation (champ `trigger`, réservé par l'ADR 0060)

Absent, il vaut « au clic », comme aujourd'hui. Présent :

```
trigger: {
  on: "roll",
  roll: "attack" | "save" | "check" | "d20" | "damage",   // d20 = attaque, sauvegarde ou test
  subject: "self" | "attack_against_self" | "ally" | "enemy" | "any",
  when: "rolled" | "hit" | "failed" | "natural",          // natural : avec `natural: 1`
  natural?: number,
  range?: { value, unit: "m" },
  automatic?: boolean                                     // Chance : sans fenêtre
}
```

- `rolled` : le dé est connu, l'issue pas encore (Mots cinglants, Inspiration bardique). `hit` et `failed` : l'issue est connue, rien n'est appliqué (Bouclier, Esquive instinctive, Indomptable, Coup de chance).
- Le coût reste celui de l'activation (`cost.action: "reaction"`, ressources). Ses `effects` s'appliquent comme au clic. Bouclier pose ainsi son effet de +5 CA jusqu'au début du prochain tour, quand il deviendra un sort jouable (136).

### Les opérations sur le jet en cours (`roll_operations`, sur l'activation ou une variante)

| Opération | Sens | Règles |
|---|---|---|
| `add_die { count, faces, sign }` | ajoute ou retire un dé (formules permises, ADR 0074) | Inspiration bardique, Mots cinglants, Vaillance |
| `reroll { bonus? }` | relance le d20 ; le nouveau résultat s'impose | Chance, Indomptable (+ niveau de guerrier) |
| `set_natural { value }` | le d20 devient cette valeur | Coup de chance |
| `ac_bonus { value }` | la CA de la cible, contre ce jet seulement | Bouclier, Cuirasse réactive |
| `damage_multiplier { factor }` | les dégâts de ce jet | Esquive instinctive (½) |
| `add_damage { formula, type? }` | dégâts en plus sur une touche | Attaque sournoise |

Les dés sont lancés par le serveur (règle 8). Le verdict est refait par les fonctions existantes (`attackVerdict`, comparaison au DD), jamais deviné.

### Une fois par tour (`limit`, sur l'activation)

`limit: { per: "turn" | "round" }`. Hors combat, rien n'est compté : il n'y a pas de tour.

### Le jet suspendu

1. Au point de décision (après le d20 ; après le verdict ; après les dégâts, avant l'écriture), le serveur applique d'abord les réactions **automatiques** (Chance). Il calcule ensuite, par une fonction pure (`eligibleReactions`, `src/core/rules/rollWindow.ts`), qui **peut** réagir : une activation au bon déclencheur, sa condition `requires` tenue, ses ressources disponibles, sa réaction libre, sa limite non atteinte.
2. **Personne : rien ne change.** Le jet s'applique d'un tenant, comme aujourd'hui. C'est le cas courant, et il ne coûte rien de plus.
3. **Quelqu'un** : une ligne `roll_windows` fige le jet (dés, modificateurs, verdict, ce qu'il restera à appliquer) et la liste des réactions possibles, avec qui répond (le joueur de la fiche ; le MJ pour un participant). La fenêtre dit aussi, quand le moteur le sait, si la réaction **changerait l'issue** (« la touche devient un échec »).
4. Chacun répond « utiliser » ou « passer » (une fonction `app.answer_roll_window`, qui n'écrit que sa propre réponse). Le MJ peut **« Continuer »** : les réponses manquantes valent « passer ». Il n'y a pas de minuterie (aucun sondage, `docs/QUOTAS.md`).
5. Quand tout le monde a répondu, le serveur reprend. Il applique les opérations dans un ordre fixe : celles de l'auteur du jet, puis celles de la cible, puis les autres. Il refait le verdict, dépense coûts et réactions, puis applique la suite. Chaque réaction écrit son `rule_application`. **Une fenêtre par point de décision** : le résultat d'une réaction n'en rouvre pas une seconde, et chacun réagit au plus une fois par fenêtre.
6. **Sécurité.** L'état figé est **signé par le serveur** (HMAC, la clé de l'ADR 0041). À la reprise, une signature invalide arrête tout : une joueuse ne peut ni fabriquer ni retoucher un jet suspendu. La suite s'applique par les **changements signés** de l'ADR 0041, quel que soit le dernier à répondre. Une joueuse ne voit jamais la CA ni le DD d'un adversaire (ADR 0040) : seulement le total, l'issue et l'indication « changerait l'issue ».
7. **Le solo** prend la même fenêtre par sa demande en attente (`pending_request`, genre `reaction`), et compte la réaction dans `scene.budgets`.

### Le compte (combat, à la table)

Une colonne `combat_participants.turn_usage jsonb` contient `{ reaction_spent: boolean, once: { "<règle>:<activation>": "<round>:<turn_index>" } }`. La réaction revient au début du tour du participant : le passage de tour la remet à zéro. Un usage « une fois par tour » compte jusqu'au changement de tour. Les joueurs ne l'écrivent pas : le serveur l'écrit par le changement signé, étendu à ce champ.

## Conséquences

- **Portée** : jusqu'aux distances réelles (137), une portée n'est vérifiée que là où des zones existent (le solo). Ailleurs, la fenêtre propose la réaction, et la fiche reste « Partielle » sur ce point.
- **Réactions des monstres** : leurs réactions de bloc de stats sont du texte. Hors chantier, elles restent visibles comme texte au MJ.
- **Temps réel** : `roll_windows` est publiée, et écoutée sur le canal unique de la page qui écoute déjà les sauvegardes demandées (`SauvegardesProvider`). Pas de connexion de plus.
- **Bouclier** est un sort : il attend que lancer un sort soit une activation (136). La brique `ac_bonus` est faite ici.
- **Découpé** en V3.1-159 (noyau), 160 (migration et service), 161 (écrans et éditeur), 162 (données du SRD).
