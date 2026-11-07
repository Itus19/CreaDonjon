# 0076 — Les actions modifiées : sorts jouables, économie d'action comptée, options de lancement

**Date :** 2026-11-07
**Statut :** acceptée (V3.1-136 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

L'étude des règles jouables range dix règles derrière deux manques, regroupés dans le chantier « actions modifiées » :

- **M8, modifier une action** :
  - plusieurs attaques par action Attaque (Attaque supplémentaire) ;
  - une action disponible en action bonus (Action rusée) ;
  - un temps d'incantation changé (Sort accéléré) ;
  - une attaque remplacée (Souffle) ;
  - un budget réservé (Sursaut d'action, « pas l'action Magie »).
- **M20, accorder ou lancer un sort comme effet** : Compagnon sauvage lance Appel de familier.

Deux reports y arrivent : **Bénédiction** et **Arme sacrée** (du 158), et **Bouclier** (du 162). Un sort se lance aujourd'hui par son propre chemin (attaque, sauvegarde, soin : `castSpell`, `resolveTargetedRoll`), sans activation, sans effet qui dure, sans réaction.

À la table, le budget d'action n'est tenu nulle part ; le solo le tient dans sa scène.

Règles visées : 7, 13, 14, 16, 21, 24, 32, 33, 35, 39 de l'étude, plus Bénédiction et Bouclier.

## Options envisagées

1. **Un sort jouable** (choix de l'auteur). A : un sort peut porter le **même bloc `activation`** qu'une aptitude, avec un coût en emplacement. B : déduire l'activation des blocs existants du sort. B se tromperait, et aucun bloc existant ne dit ce qui dure (Bénédiction).
2. **L'économie d'action à la table** (choix de l'auteur). A : le moteur la compte en combat, comme la réaction (ADR 0075). B : l'afficher seulement.
3. **Sort accéléré**. A : une **option de lancement**, déclarée par une aptitude et choisie au moment de lancer. B : une activation à part qui « prépare » le prochain sort. B laisse un état entre deux gestes.

## Décision

**1-A, 2-A, 3-A.**

### Un sort porte une activation

- Le bloc `activation` s'attache aussi à une fiche de sort. Son coût gagne `slot: { level }`, le niveau de base (0 pour un sort mineur). Les formules lisent `slot.level`, le niveau de l'emplacement dépensé : Bénédiction vise `3 + slot.level − 1` cibles.
- **Lancer** : on vérifie que le sort est connu ou préparé (comme `castSpell`). On choisit un emplacement de niveau suffisant, ordinaire puis de pacte (ADR 0045), et on le dépense. On joue ensuite l'activation par le même noyau qu'une aptitude (`planActivation`), avec ses effets qui durent, sa concentration et son journal.
- Un sort **sans** ce bloc garde le chemin d'aujourd'hui. Rien ne change pour les sorts déjà jouables par `resolveTargetedRoll`.
- **Réaction** : un sort à déclencheur (Bouclier) devient candidat aux fenêtres de l'ADR 0075 s'il est préparé et qu'un emplacement reste. Le jouer dépense l'emplacement.

### L'économie d'action, comptée en combat

- Le compte de tour du participant (`turn_usage`, ADR 0075) gagne `budget: { at, action, bonus, attacks }`. `at` est la date du **dernier tour du participant** où il a dépensé ; si son tour a changé depuis, le budget repart neuf. C'est calculé, sans écriture au passage de tour.
- **L'action Attaque** :
  - la première attaque d'arme du tour dépense l'action et ouvre `attacks = attacksPerAction − 1` ;
  - les suivantes consomment `attacks` avant toute autre chose ;
  - `attacksPerAction` est une valeur calculée de la fiche, cible de modificateur `attacks_per_action`, que l'Attaque supplémentaire pose à 2.
- **Coût `attack`** (nouvelle valeur de `cost.action`) : l'activation remplace une attaque de l'action Attaque (Souffle).
- **Action bonus permise** : la cible `action_as_bonus.<dash|disengage|hide|…>` (Action rusée) dit quelles actions la fiche peut prendre en action bonus. Leurs effets propres (se cacher, se désengager) relèvent des chantiers 137 et 138.
- **Jamais bloquant** (ADR 0029) : le dépassement s'affiche et se journalise, le MJ tranche. Le Sursaut d'action accorde une action (`grant_budget`, existant) ; « pas l'action Magie » est vérifié au lancer.
- Le solo garde `scene.budgets`. Les mêmes fonctions pures servent aux deux.

### Les options de lancement

Une aptitude peut déclarer `cast_options: [{ id, label, cost, changes: { action?: "bonus" } }]`. Au lancer d'un sort, la fiche propose ces options, et le service applique le changement (le temps d'incantation pour Sort accéléré) et dépense le coût (2 points de sorcellerie). Une seule option à la fois, sauf si les données disent le contraire.

### Lancer un sort comme effet

Un nœud `cast_spell { spell, free }` rejoint le vocabulaire des effets. Il joue l'activation du sort nommé, sans emplacement si `free` (Compagnon sauvage : Appel de familier). Un sort sans activation ne se lance pas ainsi : on le dit, on ne devine pas.

## Conséquences

- **Migration** : `apply_engine_change` accepte la clé `budget` dans `turn_usage`. Le reste est en données.
- **Bouclier** : la réaction est un sort (Bénédiction suit le même chemin), ce qui rend jouable `ac_bonus` (ADR 0075).
- **Arme sacrée** s'ouvre « en prenant l'action Attaque » : ce sera une option de l'action Attaque, ou une activation au coût `none` limitée à une fois tant que l'action Attaque est en cours. Ce point est tranché dans le ticket de données.
- **Découpé** en V3.1-164 (noyau), 165 (migration et service), 166 (écrans et éditeur), 167 (données du SRD).
