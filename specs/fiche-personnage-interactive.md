# Spécification — Fiche de personnage jouable

**Version :** 0.1 — 12 août 2026
**Cible :** V1-B5, après V1-B1 à B4
**Amende :** `specs/wiki-blocs.md` §4 · `BACKLOG_V1.md` lot B

---

## 0. Ce que c'est, et ce que ce n'est pas

La fiche jouable est **une vue**, pas un nouveau bloc de données.

Elle affiche les cinq blocs de personnage déjà spécifiés (`character`, `inventory`, `spellcasting`, `resources`, plus l'état de jeu), la fiche dérivée calculée par `characterSheet()`, et y ajoute des **actions** : lancer une attaque, dépenser un emplacement de sort, prendre un repos.

Créer un bloc unique « fiche de personnage » qui contiendrait tout recréerait exactement la divergence qu'on évite depuis le début : une CA enregistrée qui ne bouge pas quand on change d'armure.

**Le bloc de stats séparé disparaît.** Vous le signalez : quand on ajoute un bloc de personnage, un autre bloc affiche CA / PV / vitesse à côté. Ces valeurs viennent de `characterSheet()`, elles n'ont pas à exister deux fois. À supprimer dans le même ticket.

---

## 1. Structure

```
┌──────────────────────────────────────────────────────────┐
│ Naivara Amakiir            Repos court · long · Exporter │
│ Elfe · Druide · Niv. 1                                   │
│ CA 11   Init +1   Vit. 9 m   Perception 15   Maîtrise +2 │
│ PV 11/11  [− +]     XP 0 / 300  [+ XP]        Épuisement │
├──────────────────────────────────────────────────────────┤
│ FOR +0  DEX +1  CON +2  INT +1  SAG +3  CHA −1           │
│ Compétences ▾                                             │
├──────────────────────────────────────────────────────────┤
│  Actions  │  Inventaire  │  Magie  │  Traits             │
├──────────────────────────────────────────────────────────┤
│  … contenu de l'onglet …                                 │
└──────────────────────────────────────────────────────────┘
```

Vos captures affichent la CA deux fois et un portrait. Les deux sautent : la CA vit dans l'en-tête, le portrait est déjà sur la fiche wiki.

### Quatre onglets, pas plus

| Onglet | Contenu |
|---|---|
| **Actions** | attaques, capacités actives, ressources, compteurs |
| **Inventaire** | armure, armes, objets, encombrement, bourse |
| **Magie** | incantation, emplacements, sorts connus et préparés — masqué si le personnage ne lance pas de sorts |
| **Traits** | espèce, classe, historique, dons, maîtrises, langues |

L'onglet Magie **n'existe pas** pour un barbare. Un onglet vide est un onglet qui fait douter.

---

## 2. Le principe des actions

> **Chaque bouton de la fiche appelle le moteur. Aucun ne calcule.**

C'est la même règle que pour l'IA, appliquée à l'interface. Un bouton d'attaque n'additionne pas « dé + modificateur + maîtrise » dans le composant : il appelle `resolveAction`, qui existe déjà (`specs/regles-couche.md` §4.5).

```ts
// Ce que fait le bouton « Attaquer » de l'épée courte
resolveAction({
  actor: entityId,
  action: 'weapon_attack',
  item: 'i2',
  advantage: 'normal' | 'advantage' | 'disadvantage'
})
// → { rolls, total, isCritical, trace }
```

Conséquence : un même clic produit le même résultat en solo, en campagne, et sur le compagnon joueur. Un seul chemin de code, donc un seul comportement.

### Les jets sont journalisés

Tout jet écrit dans `dice_rolls` avec la graine de la campagne. Hors campagne — un personnage consulté dans le wiki — le jet est éphémère et signalé comme tel : « jet d'essai, non enregistré ».

### Avantage et désavantage

Sur chaque bouton d'attaque, trois états accessibles sans menu : normal, avantage, désavantage. C'est le geste le plus fréquent d'une partie ; il ne doit jamais coûter deux clics.

Ils s'annulent mutuellement, jamais ne s'empilent — la règle est déjà dans le moteur (`wiki-liens-et-personnages.md` §B4), l'interface ne fait que l'exposer.

### Le résultat porte sa trace

```
Épée courte — 17 pour toucher
  1d20 (14) + DEX (+1) + maîtrise (+2)
Dégâts : 6 tranchant
  1d6 (5) + DEX (+1)
```

Même exigence que partout : l'explication vaut le résultat. C'est ce qui permet de repérer que le moteur se trompe.

---

## 3. Les emplacements de sorts

Vous demandez « quelque chose d'intuitif ». Le geste juste tient en trois éléments.

**Un sort affiche son niveau minimal et les emplacements disponibles.** Lancer « Projectile magique » propose les emplacements de niveau 1 et plus, chacun avec ce qu'il change : « niv. 1 — 3 projectiles », « niv. 2 — 4 projectiles ». La montée en puissance vient du bloc `scaling`, elle n'est pas ressaisie.

**Un clic sur le niveau choisi lance et décompte.** Le compteur d'emplacements est dans l'état de jeu, pas dans le bloc.

**Un sort dont aucun emplacement n'est disponible reste visible, désactivé, avec la raison.** Le griser sans dire pourquoi est la frustration classique de ces interfaces.

Les sorts mineurs n'ont pas d'emplacement et sont dans une section distincte.

---

## 4. Repos et état

| Bouton | Effet |
|---|---|
| **Repos court** | dépense de dés de vie au choix, recharge des ressources `short_rest` |
| **Repos long** | PV au maximum, moitié des dés de vie récupérée, ressources `long_rest`, emplacements restaurés, épuisement −1 |

Ce qui se recharge est déclaré par le ruleset, jamais codé en dur : chaque ressource porte `recharge: 'short_rest' | 'long_rest' | ...`. Un système maison change ses règles de repos sans toucher au code.

Un repos écrit un `session_event`, jamais une révision de wiki.

### L'épuisement — le cas qui prouve le modèle

Vous prenez cet exemple : ajouter des points de fatigue doit corriger la vitesse et le reste.

C'est **déjà le comportement**, sans rien ajouter. L'épuisement est un niveau dans l'état de jeu ; la règle d'épuisement du ruleset produit des modificateurs de couche 7 ; `characterSheet()` les applique. La vitesse change, les jets baissent, et la provenance l'indique : « Vitesse 4,5 m = 9 m ÷ 2 (épuisement 2) ».

Si ça ne marche pas ainsi, c'est que la règle d'épuisement n'a pas été convertie en modificateurs à l'import — pas que la fiche a besoin de logique en plus.

---

## 5. Inventaire

### 5.1 Un seul inventaire, deux affichages

Vous signalez le risque de contradiction entre le bloc `inventory` et la fiche. Il n'y a pas de synchronisation à écrire : **c'est le même bloc**. La fiche jouable l'affiche dans son onglet, l'éditeur de wiki l'affiche dans la page. Deux vues d'une donnée.

S'il existe deux blocs `inventory` sur la même entité, c'est une erreur de saisie : la contrainte d'unicité par type de bloc (`wiki-blocs.md` §7) doit l'interdire.

### 5.2 Le sélecteur d'objets

Il interroge les deux sources — règles et entités à facette mécanique — dans un seul champ, avec badge d'origine. Justification en §1.1 de `arbitrage-modifications.md`.

Depuis ce sélecteur, deux échappatoires :
- **« Créer une règle d'objet »** ouvre l'éditeur de règle, puis revient au sélecteur avec l'objet créé. C'est le parcours que vous décrivez.
- **« Objet libre »** ajoute une ligne sans référence, avec un poids et un nom. Pour le bric-à-brac qui ne mérite pas de fiche.

Sans la seconde, chaque babiole exige une fiche de règle et l'inventaire devient une corvée.

### 5.3 Encombrement

Recalculé à chaque changement, comme le reste. La capacité vient du ruleset, pas d'une constante. Un dépassement s'affiche en avertissement, jamais en blocage — on avertit, on n'interdit pas.

---

## 6. Exports

| Format | Usage | Note |
|---|---|---|
| **JSON** | sauvegarde, transfert, réimport | forme documentée : build + état, jamais les valeurs dérivées |
| **PDF** | fiche papier | rendu serveur, mise en page dédiée |

Le JSON exporte **le build**, pas la fiche calculée. Réimporter recalcule tout — et si les règles ont changé entre-temps, la fiche suit. Exporter les valeurs dérivées produirait un fichier qui vieillit mal.

Le PDF est l'inverse : un instantané figé, destiné au papier. Il porte donc sa date et la version du ruleset.

---

## 7. Ce qui n'est pas dans ce ticket

| Reporté | Où |
|---|---|
| Montée de niveau accompagnée | V2 — c'est le parcours de création, rejoué partiellement |
| Boutons depuis le compagnon joueur | V3 — même moteur, autre écran |
| Application automatique des dégâts à une cible | V2, avec l'écran de combat |
| Application des dégâts subis par le personnage | V1-B5, manuel : `[− +]` sur les PV |

La distinction compte : **infliger** des dégâts suppose une cible et un combat en cours ; **subir** est une simple modification d'état.

---

## 8. Critères d'acceptation

- [ ] Aucun composant de la fiche ne calcule une valeur de règle. Tout vient de `characterSheet()` ou de `resolveAction()`.
- [ ] Le bloc de stats séparé n'existe plus ; ajouter un bloc `character` n'en crée pas un second.
- [ ] Décocher « équipé » sur une armure change la CA sans rechargement de page, et la décomposition affichée suit.
- [ ] Passer l'épuisement à 2 change la vitesse affichée, avec sa provenance.
- [ ] Un bouton d'attaque produit un jet journalisé dans `dice_rolls`, avec sa trace lisible.
- [ ] Avantage et désavantage sont accessibles en un clic et s'annulent mutuellement.
- [ ] Lancer un sort de niveau 2 décompte un emplacement de niveau 2 et applique la montée en puissance du bloc `scaling`.
- [ ] Un sort sans emplacement disponible reste visible, désactivé, avec la raison affichée.
- [ ] L'onglet Magie est absent pour un personnage sans incantation.
- [ ] Un repos long recharge ce que le ruleset déclare, rien de codé en dur.
- [ ] Le même inventaire s'affiche dans la fiche et dans l'éditeur ; modifier l'un modifie l'autre.
- [ ] Le sélecteur d'objets propose règles et entités, chacune badgée.
- [ ] L'export JSON ne contient aucune valeur dérivée ; le réimport reconstruit une fiche identique.
- [ ] Une mutation de jeu écrit un `session_event`, jamais une `entity_revision`.
- [ ] La fiche reste lisible et utilisable à 375 px de large — elle servira sur téléphone en V3.
