# 0078 — Le modèle du monde : qui voit qui, les formes, les invocations, les cas uniques

**Date :** 2026-11-08
**Statut :** acceptée (V3.1-138 ; deux choix de l'auteur, notés ci-dessous)

## Contexte

L'étude des règles jouables (`docs/etude-regles-jouables.md`, §5) range ici ce qu'aucun chantier précédent ne joue :

- **Perception et visibilité** : invisible, caché, sens (vision dans le noir, vision véritable, perception aveugle), lumière par zone. Sans elles, ni l'Invisibilité, ni « une créature que vous voyez », ni la lumière de l'Aasimar ou de l'Arme sacrée ne se jouent.
- **M15, restrictions et immunités par étiquette** : ne peut pas être ciblé par la divination, immunité à un sort précis.
- **Cas uniques** :
  - M10, la transformation (Forme sauvage) ;
  - M11, l'invocation (Compagnon sauvage) ;
  - M23, les PV temporaires en effet ;
  - M28, la redirection d'une attaque ;
  - M29, une jauge qui monte ;
  - M22, une recharge sur événement (Rage persistante) ;
  - M13, une quantité choisie (Imposition des mains, Restauration magique) ;
  - M30, les consommables ;
  - les choix contraints (« le MJ décide » mis en données).

Règles de l'échantillon visées : 8, 15, 16, 22, 29, 34, 35, 38.

L'ADR 0077 a posé le plan : des positions en mètres, et « ce qui est posé est vu » en attendant ce chantier.

## Options envisagées

1. **Qui voit qui** (choix de l'auteur).
   - A : **le moteur calcule**, à partir de la lumière (ambiante et sources), des sens et des états Invisible et Caché. La vue des joueuses masque, côté serveur, ce qu'elles ne voient pas.
   - B : Invisible et Caché sont des états posés à la main, sans lumière calculée.
   - C : rien n'est masqué ; seuls avantage et désavantage sont appliqués.
2. **Formes et invocations** (choix de l'auteur).
   - A : **le moteur les joue**. La forme est un profil sur la ligne de combat ; la créature invoquée est un participant piloté par sa joueuse.
   - B : le moteur pose l'effet, et le MJ fait le reste à la main.
3. **Le masquage des joueuses** : la fonction SQL `combat_player_view` ne peut pas calculer les sens, qui sont dérivés des fiches.
   - A : le serveur calcule et **écrit un drapeau d'accès** par participant.
   - B : un filtrage dans le service seulement. B est contournable : la joueuse appelle la fonction elle-même.

## Décision

**1-A, 2-A, 3-A.**

### Qui voit qui

- **Les entrées** :
  - **La lumière ambiante du combat** : `combats.lighting`, qui vaut `bright`, `dim` ou `dark`. Le MJ la règle ; le solo a déjà la sienne dans sa scène.
  - **Les sources de lumière** : cibles de modificateur `light.bright` et `light.dim`, en mètres, portées par une fiche ou un effet qui dure (Lumière de l'Aasimar, Arme sacrée). Elles partent de la position de leur porteur.
  - **Les sens** : `sheet.senses` pour un personnage, `senses` du bloc de stats pour un monstre.
  - **Les états** : Invisible, Caché (avec le total du test de Discrétion qui l'a posé) et Aveuglé.
- **Une fonction pure**, `canSee(observateur, cible, monde)`, rend `clear`, `obscured` ou `unseen` :
  - un observateur Aveuglé ne voit rien, sauf par perception aveugle à portée ;
  - une cible Invisible n'est pas vue, sauf par vision véritable ou perception aveugle à portée ;
  - une cible Cachée n'est pas vue tant qu'elle n'est pas trouvée (Perception au moins égale à son total) ou qu'elle ne s'est pas révélée (en attaquant) ;
  - dans les ténèbres, une cible n'est pas vue, sauf par vision dans le noir à portée, qui la voit comme en lumière faible ;
  - en lumière faible, la cible est `obscured` : désavantage aux tests de Perception ;
  - sinon, elle est `clear`.
- **Les conséquences**, jouées par le moteur :
  - une attaque contre une cible qu'on ne voit pas se fait avec désavantage ; une attaque par un attaquant que la cible ne voit pas se fait avec avantage ;
  - `targets.must_see` refuse une cible non vue ;
  - une réaction peut porter `trigger.must_see` (Mots cinglants : « une créature que vous voyez ») ;
  - Se cacher pose Caché avec le total d'un test de Discrétion lancé par le serveur, contre DD 15.
- **Sans plan** (moins de deux jetons posés), seuls les états comptent ; la lumière et la portée des sens ne se mesurent pas.

### Le masquage

- `combat_participants.hidden_from_players boolean` est un **drapeau d'accès**, de la même nature que `visibility_level`, et non une valeur de jeu (règle 16).
- Le serveur le recalcule après chaque écriture qui change la perception : un déplacement, un état, la lumière, un effet. Il est vrai quand aucun PJ du combat ne voit la créature.
- Le MJ peut le forcer.
- `combat_player_view` omet la position et l'état d'une ligne masquée. Elle garde la ligne « Quelqu'un » dans l'ordre du tour, pour que le tour en cours désigne le même participant que chez le MJ.

### Les formes

- Un effet `transform: { form, mode }` existe en deux modes :
  - `overlay` (Forme sauvage 2024) : le profil de la bête remplace CA, vitesse, FOR, DEX, CON et attaques ; le personnage garde ses PV, et l'effet lui donne des PV temporaires ;
  - `replace` (Métamorphose) : la forme a ses propres PV, et la créature revient à son profil quand ils tombent à 0.
- La forme se range sur la ligne de combat (`form jsonb` : clé du bloc de stats, mode, PV de la forme), et non sur la fiche. Elle prend fin avec son effet.
- Une forme « connue » se choisit dans une liste en données : les formes vues, plafonnées par le facteur de puissance.

### Les invocations

- Un effet `summon: { creature, count? }` ajoute au combat un participant :
  - `source_kind = statblock` et `is_ally` ;
  - `summoned_by`, la ligne de celui qui invoque ;
  - `controlled_by`, la joueuse qui le pilote ;
  - `effect_instance_id`, l'effet qui le fait vivre.
- Le participant est retiré quand l'effet prend fin.
- La joueuse le fait agir par les jets ciblés existants (acteur `participant`). Elle n'a ce droit que sur les créatures qu'elle pilote, revérifié en base comme `set_own_position`.

### Les cas uniques

Chacun a une forme propre, tant qu'aucun troisième cas ne demande de généraliser :

| Cas | Forme |
|---|---|
| PV temporaires | effet `grant_temp_hp` |
| Jauge qui monte | effet `gain_resource` |
| Recharge sur événement | déclencheur qui pose `restore_resource` |
| Quantité choisie | `amount: { max }` sur une activation ; la joueuse saisit le nombre, le serveur le borne |
| Consommable | coût `consume_item` (une unité de l'inventaire) |
| Redirection | opération de réaction `redirect` (la cible devient le réagissant) |
| Choix contraint | les options en données, présentées à la joueuse ou tirées sur une table par le serveur |

Pour **M15**, une fiche porte des étiquettes : `immune.spell.<clé>` et `untargetable.<étiquette>` (par exemple `divination`). Elles sont vérifiées au ciblage.

## Conséquences

- **Deux migrations** :
  - la perception : `combats.lighting`, `hidden_from_players`, et `combat_player_view` qui masque ;
  - les formes et invocations : `form`, `summoned_by`, `controlled_by`, `effect_instance_id`, plus le droit de jouer sa créature.
- **Coût** (QUOTAS) : recalculer le masquage demande les fiches des PJ du combat, à chaque écriture qui touche la perception. C'est borné, mais à mesurer.
- **L'écran** :
  - la lumière (fond qui s'assombrit, halos des sources) ;
  - Caché et Invisible sur les jetons ;
  - la forme sur la ligne ;
  - la créature invoquée, pilotée par la joueuse.
- **Découpé** en V3.1-180 à 185.
