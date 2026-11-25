# Génération du monde

*Spécification de la V4 « Simulation » : la carte, les villes, l'histoire d'un monde généré, et la façon dont ses détails apparaissent quand on les découvre. Les principes viennent de l'[ADR 0104](../docs/adr/0104-le-cap-du-mode-solo.md) ; les choix qui engagent le schéma, de l'[ADR 0109](../docs/adr/0109-la-generation-du-monde-demarre.md).*

**État au 25 novembre 2026** : spécifiée. Le noyau de la ville en agrégat existe (`src/core/worldgen/`) ; rien d'autre n'est construit.

---

## 1. Le but

On lance une partie et le monde **semble avoir existé avant nous** (PDD §13) : des villes à leur place, des peuples, des guerres passées, des lignées. Rien de tout cela n'est inventé par l'IA. Le code génère, l'IA habille (règle absolue 8, ADR 0104 §1).

Ce que la génération ne cherche pas : simuler chaque habitant, chaque pierre ou chaque jour. Dwarf Fortress inspire la **méthode**, jamais l'échelle ni le contenu (ADR 0104 §7).

## 2. Les principes

1. **Pur et déterministe.** Toute la génération vit dans `src/core/worldgen/`, sans base ni réseau (règle 19). Elle reçoit une graine et rend des données. Même graine, même monde.
2. **Générer, figer, découvrir.** Trois temps distincts (PDD §13, « génération / simulation / rendu ») :
   - **générer** : carte, villes et histoire, calculées d'un bloc ;
   - **figer** : le résultat entre dans le wiki, qui devient gravé dans la pierre (ADR 0104 §2) ;
   - **découvrir** : les détails (une personne, une pièce, un objet) se matérialisent quand on s'y intéresse, par tirage à graine fixe, et ne s'écrivent dans le wiki qu'à l'interaction.
3. **Régénérer, seulement avant le figement.** Une graine permet de rejouer ou de varier un monde tant qu'il n'est pas figé. Après, le wiki l'emporte : on ne régénère jamais par-dessus.
4. **Des agrégats, pas des individus.** Une ville est un ensemble de chiffres (ADR 0104 §3). Un PNJ est une fonction de ces chiffres, d'un lieu et d'un rôle.
5. **Une seule mémoire.** Le monde généré remplit le **même** wiki que le MJ humain et le solo : entités, blocs, frise. Pas de deuxième système.
6. **Les mêmes fonctions pour le MJ.** Tout tirage que fait le solo, un MJ peut le lancer depuis sa fenêtre et obtenir le même résultat.

## 3. Le vocabulaire

| Terme | Sens | Identifiant |
|---|---|---|
| **graine** | Entier non signé de 32 bits dont découle un tirage | `seed` |
| **ville** | Un lieu habité décrit par ses agrégats, quelle que soit sa taille | bloc `settlement` |
| **occupant** | Une personne matérialisée dans un lieu, pas encore écrite dans le wiki | `Occupant` |
| **espace** | Une partie d'un lieu (la salle commune, l'étage). Jamais « zone » : ce mot désigne déjà les distances de scène et les régions de carte | `space` |
| **biome** | Le milieu d'un lieu, dans la liste fermée de §5 | `biome` |
| **élément** | Une entrée du catalogue (minéral, plante, animal, magie) | fiche de règle |
| **acteur** | Ce que l'histoire fait agir : un peuple, un État, une ville, une figure notable | — |
| **chronique** | La suite d'événements produite par la simulation de l'histoire | — |

## 4. La ville en agrégat

### 4.1 Les données

Un bloc `settlement` sur l'entité du lieu (ADR 0109, décision G1). Aucune table nouvelle. Schéma : `src/core/schemas/blocks/settlement.ts`.

| Champ | Type | Sens |
|---|---|---|
| `seed` | entier 0 à 2³² − 1 | La graine de la ville. Tirée par le serveur à la création, ou reprise d'Azgaar |
| `population` | entier ≥ 0 | Nombre d'habitants |
| `zone` | `bourg`, `ville`, `capitale` | Le rang de la ville. Mêmes clés que l'axe « Zone » des générateurs Taverne et Échoppe |
| `wealth` | `modeste`, `correcte`, `reputee` | La richesse. Mêmes clés que l'axe « Richesse » des mêmes générateurs |
| `biome` | clé de §5 | Le milieu |
| `peoples` | liste `{ key, share }` | Les peuples et leur poids relatif (`share` entier ≥ 1). `key` = clé d'espèce des règles |
| `trades` | liste `{ key, share }` | Les métiers et leur poids relatif |

`zone` n'est pas dérivé de `population` : une capitale est un fait politique, pas un seuil. Les deux sont donc saisis, sans contredire la règle 16. Les factions, les ressources et la religion attendent un tirage qui en ait besoin (règle des trois).

Les clés `zone` et `wealth` sont françaises parce qu'elles reprennent celles qui existent déjà dans les générateurs (`src/core/generators/tools.ts`) : une ville et son auberge parlent la même langue.

### 4.2 La matérialisation

`materializeOccupants(settlement, place, moment)` (`src/core/worldgen/occupants.ts`) rend la liste des personnes présentes dans un lieu de la ville, sans rien stocker.

- **Les gabarits de peuplement** disent qui se trouve dans un type de lieu. Un seul type pour l'instant, l'auberge (`inn`) :
  - un aubergiste, toujours ;
  - du personnel, de 1 à 3, plafonné par la richesse (1 pour une auberge modeste, 3 pour une réputée) ;
  - des clients, selon le moment de la journée, multipliés selon le rang.
- **La graine de chaque tirage** se calcule à partir de la graine de la ville, de l'identifiant stable du lieu, du rôle et du rang dans ce rôle (`deriveSeed`, FNV-1a sur 32 bits). Revenir dans la même auberge redonne le même aubergiste et le même personnel.
- **Les clients changent** avec le jour et le moment (matin, après-midi, soir, nuit) : leur graine les inclut. Le même soir rejoué redonne les mêmes clients.
- **Chaque occupant** porte son rôle, son rang, sa graine propre, son peuple (tiré selon `peoples`), son métier (fixe pour l'aubergiste et le personnel, tiré selon `trades` pour un client) et sa tranche d'âge. Sa graine propre sert ensuite aux tables du générateur PNJ (nom, apparence) : la même personne reçoit toujours le même nom.
- **Une personne écrite dans le wiki gagne.** Quand on interagit avec un occupant, `promoteSketch` en fait une entité. La matérialisation suivante doit la retrouver plutôt que la retirer : le service qui branche ce noyau sur le solo (ticket G-4) remplace l'occupant de même rôle et même rang par l'entité existante.

Ce que la graine devient quand la ville change (incendie, guerre) reste ouvert (§10).

## 5. Les biomes

La liste fermée d'Azgaar's Fantasy Map Generator (ADR 0109, décision G4), pour que l'import de sa carte s'y branche sans table de traduction : `marine`, `hot_desert`, `cold_desert`, `savanna`, `grassland`, `tropical_seasonal_forest`, `temperate_deciduous_forest`, `tropical_rainforest`, `temperate_rainforest`, `taiga`, `tundra`, `glacier`, `wetland`. Constante : `BIOMES` dans `src/core/worldgen/biomes.ts`.

Chaque biome aura ses listes (flore, faune, matériaux, climat), tirées du catalogue (§6), où l'IA puise pour habiller une scène.

## 6. Le catalogue

Des fiches de règles, avec un nouveau type et un bloc typé « élément du monde » (ADR 0109, décision G5) : on réutilise l'éditeur de règles, les variantes par ruleset et l'interdiction de modifier une base officielle (règle 18). Les bêtes du SRD reçoivent ce bloc sans être dupliquées.

Le format de départ, et rien de plus tant qu'aucun tirage n'en demande davantage : nom, catégorie (`mineral`, `metal`, `plant`, `animal`, `magic`), biomes, rareté, usages, lien vers une règle quand l'élément a des chiffres, source (Wikidata et son identifiant, SRD, ou maison). Wikidata fournit seulement ses données structurées CC0, jamais les textes de Wikipédia (ADR 0104 §8).

Ce chapitre demande sa migration (type de fiche) et la mise à jour de `docs/SCHEMA.md` au moment de son ticket (G-5).

## 7. Les espaces d'un lieu

Un lieu se découpe en espaces reliés (porte, escalier, ouverture). Chaque type de lieu a un gabarit ; la variante dépend des agrégats de la ville (une auberge modeste n'a pas d'étage). Les objets du catalogue sont posés dans un espace, avec deux drapeaux : bloque la vue, offre un abri (demi, trois quarts, total). **La disposition vient d'abord, la description en découle** : la prose ne peut pas parler d'une porte que le plan n'a pas. Un objet inventé par l'IA qui ne trouve pas de place est refusé (ADR 0104 §2).

Ce chapitre reste au niveau des intentions : ses gabarits se décideront avec la tranche « ville + auberge » du solo (ticket G-4).

## 8. La carte : Azgaar

L'**export JSON** d'Azgaar d'abord (ADR 0109, décision G2), pas son code : aucune dépendance ajoutée, et l'image exportée s'affiche déjà dans le bloc carte (ADR 0017). L'import, pur dans `src/core/worldgen/azgaar/`, lit le fichier validé par Zod et rend :

- chaque ville (`burg`) : une entité `location` avec son bloc `settlement` (graine dérivée de la graine de la carte et de l'identifiant de la ville) et une punaise sur la carte ;
- chaque État : une entité faction ;
- les biomes, directement (§5).

Le format d'export change avec les versions d'Azgaar : l'import dit la version qu'il connaît et refuse proprement un fichier qu'il ne sait pas lire. La notice MIT d'Azgaar va dans `NOTICE.md` dès qu'une ligne de son code ou de son format est reprise.

## 9. L'histoire du monde

### 9.1 La méthode

Faire passer des siècles sur la carte, au niveau des **groupes et des figures**, jamais des individus, puis figer le résultat (ADR 0104 §7). On génère d'abord les faits, puis on leur donne une explication cohérente après coup (méthode de Caves of Qud) : l'IA peut rédiger l'explication, jamais décider d'un fait.

### 9.2 Les couches

| Couche | Contenu | Écrit dans |
|---|---|---|
| 1 | Trois types d'événements : fondation, guerre, mort d'un chef. Une petite carte | La frise du monde (`world_timeline`, ADR 0048), portée `major` ou `notable` |
| 2 | Les figures notables, leurs liens, leurs descendants | Des entités avec bloc `character`, `relations`, la généalogie (`src/core/genealogy/`) |
| 3 | Les conséquences en chaîne (famine → guerre → chute → exil), l'explication après coup | La frise, et le texte des pages |
| 4 | Les artefacts, les religions, les légendes | Des entités, des blocs `timeline` |

Chaque couche se termine par une chronique qu'on lit dans la frise du monde avant d'ouvrir la suivante.

### 9.3 Où elle tourne

Le simulateur est **pur** (`src/core/worldgen/history/`), donc il tourne n'importe où (ADR 0109, décision G3). Il n'est jamais lancé dans une route `/api` : une fonction Vercel gratuite est coupée bien avant mille ans simulés. Il tourne **dans le navigateur** (un Web Worker) ou dans un **script local**, puis le résultat est écrit en une seule fois par une action serveur validée par Zod.

**Un plafond d'événements stockés** protège la base (500 Mo, `docs/QUOTAS.md`) : la simulation peut produire des milliers d'événements, seuls les plus marquants deviennent des entrées de frise. Le chiffre du plafond se fixera à la couche 1, mesure à l'appui.

## 10. Questions ouvertes

- Ce que devient la graine d'une ville qui change (incendie, guerre, croissance) : nouvelle graine, ou graine gardée et agrégats modifiés.
- Ce que « s'intéresser » veut dire pour figer un détail : regarder, demander, toucher, revenir (Backlog solo, D3).
- La simulation après le début de partie (PDD §13, « le monde continue à évoluer ») : écartée pour l'instant, la chronique est figée au lancement (ADR 0109).
- Où vit la donnée du catalogue importée de Wikidata : versionnée dans `data/` comme le SRD, ou en base seulement.
- La place de la magie dans le catalogue : un élément, une propriété d'un élément, ou les deux.

## 11. Les tickets

| Ticket | Contenu | Modèle conseillé | État |
|---|---|---|---|
| G-1 | Cette spec et l'ADR 0109 | Opus | fait |
| G-2 | Le noyau de la ville en agrégat : schéma du bloc, `deriveSeed`, `materializeOccupants` pour l'auberge, tests | Opus | fait |
| G-3 | Le bloc `settlement` enregistré : registre des blocs, éditeur, vue publique, planche du catalogue, libellés | Sonnet | à faire |
| G-4 | La tranche ville + auberge du solo : tables de départ du biome tempéré (noms, PNJ, taverne), peuplement à l'entrée d'un lieu, l'entité existante remplace l'occupant, même tirage depuis la fenêtre du MJ | Opus | à faire, après les étapes 1 et 2 du Backlog solo |
| G-5 | Le catalogue : type de fiche, bloc « élément du monde », import Wikidata limité au biome tempéré | Opus | à faire |
| G-6 | L'import Azgaar : villes, États, punaises | Opus | à faire, après G-3 |
| G-7 | L'histoire, couche 1 | Opus | à faire, après G-6 |
