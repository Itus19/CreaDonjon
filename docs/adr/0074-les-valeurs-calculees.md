# 0074 — Les valeurs calculées : modificateurs en formule et en dé, dés en formule, nouvelles cibles

**Date :** 2026-11-07
**Statut :** acceptée (V3.1-134 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

L'étude des règles jouables (`docs/etude-regles-jouables.md`) range dix règles derrière trois manques, regroupés dans le chantier « valeurs calculées » :

- **M3** — un modificateur ne porte qu'un nombre fixe. Or l'Aura de protection donne « + mod. CHA (minimum 1) », la Rage un bonus de dégâts lu dans la table du Barbare, la Défense sans armure une CA de « 10 + DEX + CON », et la Bénédiction « + 1d4 », un **dé**, pas un nombre.
- **M27** — le nombre et la taille des dés sont fixes dans l'arbre des formules : `⌈niveau / 2⌉d6` (Attaque sournoise), `1d(dé d'inspiration)` (Inspiration bardique), `(maîtrise)d10` ne s'écrivent pas.
- **Cibles** — aucun jet d'attaque ni de dégâts ne lit de modificateur aujourd'hui (seuls la CA, la vitesse, les PV, les caractéristiques, les sauvegardes et les compétences en reçoivent). Il manque aussi la plage de critique, les vitesses spéciales, les sens et les maîtrises accordées.

Règles visées : 2, 3, 5, 11, 12, 13, 23, 24, 25, 32 de l'étude, et le bonus de dégâts de l'Affinité élémentaire (reçu de V3.1-117).

## Options envisagées

1. **La valeur d'un modificateur.** A : `value` accepte une formule (le même arbre fermé que partout, règle absolue 7). B : une liste de valeurs nommées (« mod. CHA », « niveau ») sans formule. B ne dit ni « minimum 1 » ni « 10 + DEX + CON ».
2. **Les dés d'un modificateur.** A : un dé n'est jamais réduit à un nombre sur la fiche ; il est lancé par le serveur à chaque jet qui le concerne (règle 8). B : la fiche affiche la moyenne. B ment : Bénédiction ne donne pas +2,5.
3. **Les dés en formule.** A : le nœud `dice` accepte une formule pour son nombre et sa taille. B : un nœud de plus par cas (« dés par niveau »). A suffit à tous les cas de l'étude.
4. **Défense sans armure** (choix de l'auteur). A : une cible de CA dédiée, que la fiche n'applique que sans armure, dès ce chantier. B : attendre les conditions d'équipement générales du chantier 137.
5. **La lumière émise** (choix de l'auteur). A : la reporter au modèle du monde (138), où elle aura un effet. B : l'afficher dès ce chantier, sans effet.

## Décision

**1-A, 2-A, 3-A, 4-A, 5-A.**

### Valeur en formule

- `value` d'un modificateur déclaré devient `number | formule`. Un nombre reste un nombre (rien ne change pour les données existantes).
- La formule est évaluée par `characterSheet()` avec les références de la règle qui la porte, **les mêmes que pour les maximums de ressources** (ADR 0060 §1) : `ability.*`, `level`, `class.level` (`grantingClassLevel`, V3.1-133), `proficiency`, `column.*` (progression de la classe qui accorde la règle), `spell_save_dc`. Rien n'est stocké (règle 16).
- Une formule incalculable n'arrête pas la fiche : elle compte 0 et lève un avertissement, comme un maximum de ressource incalculable.

### Les dés de bonus

- Une formule qui contient un dé est un **dé de bonus**. Il n'est permis que sur une cible **de jet** (attaque, dégâts, sauvegarde, test de caractéristique, compétence). Sur une cible fixe (CA, vitesse, PV, caractéristique, sens), Zod le refuse.
- La fiche porte, à côté du nombre de chaque jet, ses dés de bonus avec leur source : « Sauvegarde de Sagesse +3 + 1d4 (Bénédiction) ».
- Le serveur lance ces dés à chaque jet concerné et les inscrit dans le détail du jet. Les fonctions du noyau qui résolvent un jet (`resolveAttackRoll`, `resolveCheckRoll`, `resolveDamageRoll`) reçoivent la liste des dés de bonus ; les services la lisent sur la fiche, jamais sur le client.
- L'empilement reste celui de la pile (`stack`, `highest`, `unique`) : deux Bénédictions ne se cumulent pas si la règle dit `unique`.

### Les dés en formule

- Le nœud `dice` accepte, pour `count` et `faces`, un nombre **ou** une formule. Écriture : `ceil({class.level} / 2)d6`, `{proficiency}d10`, `1d{column.class_specific_bardic_inspiration_die}`.
- À l'évaluation, nombre et taille sont arrondis vers le bas et bornés par les limites existantes (`src/core/formula/limits.ts`) ; une taille hors bornes est une erreur, pas un dé silencieusement corrigé.
- Le parseur, le formateur (aller-retour exact) et le schéma Zod suivent ; l'éditeur de briques (V3.1-132) en profite sans changement d'écran.

### Les nouvelles cibles (catalogue fermé, `modifierTargets.ts`)

| Cible | Lue par | Effets permis |
|---|---|---|
| `attack`, `attack.weapon`, `attack.spell` | jets d'attaque | `add` (nombre ou dé), `advantage`, `disadvantage` |
| `damage`, `damage.weapon`, `damage.spell`, `damage.weapon.<car>`, `damage.spell.<type>` | jets de dégâts | `add` (nombre ou dé) |
| `save` (toutes les sauvegardes) | sauvegardes | comme `save.<car>`, dés compris |
| `crit_range`, `crit_range.weapon` | jets d'attaque | `set`, `min` (le plus petit d20 naturel qui fait un critique : 19 pour le Critique amélioré) |
| `speed.fly`, `speed.swim`, `speed.climb`, `speed.burrow` | fiche | `add`, `set`, `max` ; la référence `speed` (vitesse au sol) est disponible (« vitesse de vol égale à votre vitesse ») |
| `sense.darkvision`, `sense.blindsight`, `sense.tremorsense`, `sense.truesight` | fiche | `set`, `max` (en mètres) |
| `prof.weapon.<clé ou catégorie>`, `prof.armor.<catégorie>`, `prof.tool.<clé>` | fiche (maîtrises) | `proficiency` |
| `ac.unarmored`, `ac.unarmored_no_shield` | fiche (CA) | `set` (formule) |

- **`damage.weapon.<car>`** dit « attaque faite avec cette caractéristique » (la Rage : Force). **`damage.spell.<type>`** dit « sort qui inflige ce type » ; pour un type choisi par le joueur (Affinité élémentaire), la cible s'écrit `damage.spell.{choice:<clé du choix>}` et `characterSheet()` la résout depuis les choix du personnage (le type est déjà enregistré par V3.1-117).
- **Défense sans armure** : `ac.unarmored` remplace la base de CA quand le personnage ne porte **pas d'armure** (le bouclier s'ajoute toujours : Barbare) ; `ac.unarmored_no_shield`, quand il ne porte **ni armure ni bouclier** (Moine). Plusieurs bases possibles : la fiche garde la meilleure (règle 2024 : une seule base de CA à la fois). Le chantier 137 généralisera les conditions d'équipement ; ces deux cibles resteront comme raccourcis.
- **Sens et vitesses** s'affichent sur la fiche et sont lus par le moteur ; leur effet sur la perception attend le modèle du monde (138).
- **La lumière émise** part au chantier 138.

### `apply_modifier` dans une activation

L'éditeur de briques écrit aujourd'hui « Modificateur temporaire » et « Avantage / désavantage » en `apply_modifier`, que le tour du moteur ignore. Un modificateur n'existe pas sans durée : ces deux briques écrivent désormais, comme « Appliquer un état », un **effet qui dure** porteur de modificateurs (couche 7, déjà lu par la fiche, V3.1-131). `apply_modifier` reste au vocabulaire des déclencheurs.

## Conséquences

- Dix règles de l'étude deviennent jouables sur ce chantier, sous réserve des conditions qu'il ne couvre pas : Arme sacrée (« si on lâche l'arme », 137), Attaque sournoise (« une fois par tour », 135 ; « arme de finesse », 137), Souffle (zone, 137).
- Tout jet d'un personnage passe par la liste de dés de bonus de sa fiche : un point de câblage par service de jet (armes, sorts, tests, sauvegardes demandées, sauvegardes des cibles d'une activation, jets ciblés). Le détail du jet montre chaque dé de bonus.
- La fiche du navigateur (`useCharacterSheetContext`) et celle du serveur restent un seul calcul (`characterSheet()`).
- `docs/SCHEMA.md` n'a rien à changer : les formules vivent dans le JSON des blocs, déjà validé par Zod.
- L'éditeur de briques gagne les nouvelles cibles dans ses listes, et une formule (avec dés) dans le champ « valeur ».
