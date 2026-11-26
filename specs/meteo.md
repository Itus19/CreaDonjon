# La météo se calcule

Spécification du 26 novembre 2026 (fil « Rendre la météo dynamique »). Décision d'architecture : ADR 0116. Elle prolonge `specs/vie-du-monde.md` (ADR 0115) : comme les routines, la météo **se calcule à la lecture, elle ne se simule pas**.

## 0. Pourquoi

En solo, l'en-tête affiche une météo figée (« pluie fine ») : elle est tirée une seule fois à la table MJ `meteo` quand le personnage change de lieu, puis ne bouge plus, quelle que soit l'heure, la saison ou la région. L'IA la reçoit telle quelle, sans savoir si le personnage est dehors : elle fait tomber la pluie dans la taverne.

L'auteur veut une météo qui dépend **du lieu géographique** (biome, climat, carte Azgaar) et **de la saison** (calendrier du monde, horloge de la scène).

## 1. Ce qui existe (inventaire du 26 novembre)

| Brique | Où | Ce qu'on en garde |
|---|---|---|
| Table MJ `meteo` tirée au changement de lieu (V3-C6) | `src/core/generators/tools.ts`, `drawWeather` dans `src/server/services/soloScene.ts` | Devient un **forçage** facultatif du MJ (§7), plus la source par défaut |
| `SceneState.weather: string \| null`, stocké dans `scene_states` | `src/core/rules/scene.ts` | Remplacé par une valeur recalculée (règle absolue 16) |
| L'éclairage suit l'heure (`lightingAt`, `advanceSceneTime`) | `src/core/rules/scene.ts` | Même endroit, même discipline : la météo se recalcule à chaque avance de l'horloge |
| Calendrier du monde : mois, jours, date « aujourd'hui », `sceneCalendarDate` | `src/core/calendar/`, `scene.ts` | Donne le jour de l'année, donc la saison. Aucune saison n'y est nommée aujourd'hui |
| Bloc `settlement` avec `biome` (13 biomes d'Azgaar) et `seed` | `src/core/schemas/blocks/settlement.ts` | Le climat s'y ajoute (§3) |
| `deriveSeed` (FNV-1a), `SeededRng` | `src/core/worldgen/seed.ts` | Toute part de hasard de la météo |
| La ville la plus proche d'un lieu (relation `part_of`) | `setScene`, en-tête | Un lieu sans bloc `settlement` prend le climat de sa ville |
| Bloc `rooms` (nom, description) | `src/core/schemas/blocks/rooms.ts` | Gagne une exposition (§6) |
| Export Azgaar complet (exemple : Anteau, une carte parmi d'autres) | `azgaar/anteau-full-2026-11-26.json` (dossier du projet) | Par cellule de la grille : `temp` (moyenne annuelle en °C, de −15 à 17 sur Anteau) et `prec` (précipitations, de 0 à 57) ; par cellule du pack : `h` (altitude), `biome`, `g` (cellule de grille) ; `mapCoordinates` (latitudes 49,7° N à 13,7° N) ; chaque ville a sa `cell` |

Rien ne calcule de température, de saison ou de climat. Les tickets G-3 (éditeur du bloc `settlement`) et G-7 (import Azgaar) ne sont pas faits : **aucun lieu n'a encore de climat**. D'où le climat par défaut du monde (§3.3).

## 2. Principes

1. **Fonction pure, à graine fixe.** `weatherAt(climat, date, heure, graine)` dans `src/core/weather/`. Même lieu, même jour, même heure : même temps. Revenir à midi le jour 12 redonne la même averse.
2. **Rien n'est stocké** que les données d'entrée du climat (§3). La météo d'un instant est une valeur dérivée (règle absolue 16).
3. **Aucun coût de fond** (`docs/QUOTAS.md`) : calculée au moment d'un tour ou d'un affichage que le jeu fait déjà, sans requête de plus que la lecture du bloc `settlement` de la ville (déjà chargé pour les occupants).
4. **Le moteur décide, l'IA narre** (règle absolue 8, ADR 0104). L'IA reçoit la météo comme un fait, et ce que le personnage en perçoit selon qu'il est dehors ou dedans. Elle ne la change jamais.
5. **Le wiki l'emporte** : un MJ peut forcer une météo (§7), qui prime sur le calcul.
6. **Chaque partie a son monde, donc sa carte** (remarque de l'auteur, 26 novembre 2026). Le climat se lit toujours dans les fiches du monde de la partie en cours, jamais dans une carte Azgaar fixe ni dans un fichier du dépôt. L'import Azgaar (ME-7) recopie le climat de **la carte de ce monde-là** dans ses propres blocs `settlement` ; une autre partie importe sa carte à elle. Le climat par défaut est un réglage de la campagne, et toutes les graines dérivent de la graine de la ville, donc du monde. Aucun code de la météo ne connaît Anteau : l'export d'Anteau ne sert que d'exemple pour lire le format.

## 3. Le climat d'un lieu

### 3.1 Les données d'entrée

Ajoutées au bloc `settlement` (champ `climate` facultatif, donc sans changement de version ni migration : le bloc vit en JSON) :

| Champ | Sens | Source |
|---|---|---|
| `climate.mean_temp_c` | Température moyenne annuelle | Azgaar `grid.cells[g].temp`, sinon table du biome |
| `climate.precipitation` | Humidité relative, de 0 à 100 | Azgaar `prec` ramené à 0-100, sinon table du biome |
| `climate.latitude` | Degrés, signée (négative au sud) | Azgaar : `latN − y / hauteur × latT` |
| `climate.elevation_m` | Altitude | Azgaar `h` converti en mètres |
| `climate.coastal` | Au bord de la mer | Azgaar : cellule `harbor` ou `haven` |

Ce sont des faits de la carte, saisis ou importés, pas des valeurs calculées par une règle : la règle 16 est respectée.

### 3.2 Les normales par biome

Une table fermée dans le noyau : pour chacun des 13 biomes, une température moyenne, une amplitude saisonnière, une humidité, une part de neige possible. Elle sert quand un champ manque. Exemple : `temperate_deciduous_forest` = 11 °C, amplitude 9 °C, humidité 55 ; `hot_desert` = 26 °C, amplitude 8 °C, humidité 5.

### 3.3 Le repli

Un lieu sans bloc `settlement` prend celui de sa ville (`part_of`). Une ville sans bloc, ou un monde sans aucune ville, prend **le climat par défaut du monde** : un biome choisi dans les réglages de campagne (défaut `temperate_deciduous_forest`, latitude 45° N). C'est ce qui fait marcher la météo dès aujourd'hui, avant G-3 et G-7.

## 4. La saison

1. Le **jour de l'année** vient de `sceneCalendarDate` : rang du jour dans l'année, longueur de l'année = somme des mois.
2. La **position dans le cycle** est une fraction de 0 à 1. Par défaut, le premier jour de l'année est le cœur de l'hiver (comme le 1er janvier). Un réglage du calendrier, `midwinter_day` (jour de l'année), le déplace.
3. **L'hémisphère** vient du signe de la latitude : au sud, le cycle est décalé d'une demi-année.
4. **L'amplitude** saisonnière grandit avec la latitude et loin de la mer, diminue au bord de la mer et sous les tropiques. Près de l'équateur, la saison joue sur la pluie (saison sèche, saison des pluies) plus que sur la température.
5. Sans date réglée dans le calendrier, pas de saison : la météo utilise les moyennes annuelles, et l'en-tête n'affiche pas de nom de saison (même principe que la date omise, V3-D2).
6. **Noms de saison** (affichage seulement) : quatre par défaut (« hiver », « printemps », « été », « automne »), renommables dans le calendrier, comme les mois.

## 5. Le temps qu'il fait

### 5.1 Le calcul

Trois couches additionnées, toutes déterministes :

1. **La normale du jour** : climat (§3) + saison (§4).
2. **Les perturbations de quelques jours** : un bruit lisse sur le compteur absolu des jours (bruit de valeur à graine fixe, une période de trois à cinq jours), qui fait passer des fronts : plusieurs jours gris, puis une éclaircie. Graine : `deriveSeed(graine de la ville, "meteo")`.
3. **La journée** : courbe de température (minimum avant l'aube, maximum vers 15 h), et un bruit à l'heure pour les averses, le brouillard du matin, l'orage de fin d'après-midi en été.

Deux villes voisines ont pour l'instant des temps indépendants. Un temps partagé par région (province Azgaar) viendra avec le voyage, s'il se montre utile (règle des trois).

### 5.2 La sortie

Une valeur structurée, identifiants en anglais, libellés dans `messages/` :

```ts
type Weather = {
  sky: "clear" | "hazy" | "cloudy" | "overcast";
  precipitation: "none" | "drizzle" | "rain" | "downpour" | "thunderstorm" | "snow" | "sleet" | "hail";
  wind: "calm" | "breeze" | "wind" | "gale";
  fog: boolean;
  temperatureC: number;            // arrondi au degré
  feel: "freezing" | "cold" | "cool" | "mild" | "warm" | "hot" | "scorching";
  season: "winter" | "spring" | "summer" | "autumn" | null;
};
```

La neige et le grésil n'apparaissent que sous 2 °C ; l'orage, que chaud et humide.

### 5.3 Ce qui change pendant un tour

`weatherChanges(avant, après)` compare la météo du début et de la fin d'un tour (l'horloge avance, ADR 0112) et rend des faits : « la pluie cesse », « le vent se lève », « la nuit fraîchit ». Ils vont dans le contexte de l'IA et la ligne du tour (ADR 0114), jamais plus d'un ou deux.

## 6. Dedans ou dehors

C'est le bogue de la taverne. Le calcul est le même ; ce que le personnage **perçoit** dépend de l'endroit où il est.

1. **Exposition** : `outdoor` (une rue, une clairière), `sheltered` (un porche, une tente, une écurie ouverte), `indoor` (une salle fermée).
2. Elle se porte sur chaque pièce du bloc `rooms` (champ `exposure`), et sur l'espace principal du lieu (champ `main_exposure` du même bloc). Défaut : `indoor` pour une pièce, `outdoor` pour un lieu sans pièce. L'IA qui invente une pièce propose son exposition, le moteur la valide comme le reste de la pièce (V3.2-19).
3. `perceivedWeather(météo, exposition)` rend ce qu'on perçoit :
   - dehors : tout ;
   - à l'abri : le vent et la température, la pluie qu'on voit tomber à côté ;
   - dedans : seulement ce qui s'entend ou se sent (« la pluie bat les volets », « le vent siffle sous la porte », un froid qui passe les murs l'hiver), et jamais une précipitation sur le personnage.
4. L'IA reçoit les deux, clairement séparés : « Le personnage est à l'intérieur. Dehors : pluie fine, 8 °C, vent faible. Perçu d'ici : la pluie contre les vitres. » La consigne du prompt dit de ne décrire que le perçu tant qu'il ne sort pas.

La consigne de narration elle-même (ne pas faire pleuvoir dedans) est corrigée par le fil « Faire avancer l'intrigue en narration solo » ; ce chantier lui fournit la donnée.

## 7. La table MJ `meteo` devient un forçage

Le calcul remplace la table comme source par défaut. Un MJ (ou la personne qui joue en solo, depuis la fenêtre du MJ) peut **forcer** une météo pour une durée : « tempête jusqu'à demain midi ». Le forçage est stocké dans la scène (`weather_override: { weather, until }`) et prime sur le calcul jusqu'à son échéance. La table `meteo` reste dans les outils MJ, utilisable pour tirer ce forçage.

## 8. Les effets en jeu

Le Guide du maître 2024 donne des effets au froid et à la chaleur extrêmes, aux fortes précipitations (désavantage aux tests de Sagesse (Perception) qui reposent sur la vue ou l'ouïe) et au vent fort. Ils viennent **après**, dans un ticket à part : ils supposent que le moteur lise la météo dans les règles, comme l'éclairage attend un système de vision (réserve de V3-C6). La sortie du §5.2 a déjà ce qu'il faut pour les brancher.

## 9. Ce que voient la personne qui joue et l'IA

- **En-tête** : un glyphe au trait, la condition et la température (« · Pluie fine, 8 °C »), et la saison si le calendrier est réglé. Le libellé suit le perçu : dedans, « Dehors : pluie fine ».
- **IA** : le bloc du §6.4 dans le contexte du tour, plus les changements du §5.3.
- **MJ à distance** : la colonne de scène montre la même chose, et le bouton de forçage.

## 10. Stocké, jamais stocké

| Stocké | Où |
|---|---|
| Le climat d'une ville | bloc `settlement`, champ `climate` |
| Le climat par défaut | réglages de campagne |
| Le jour du cœur de l'hiver, les noms de saison | `worlds.calendar` (JSON) |
| L'exposition des pièces | bloc `rooms` |
| Un forçage du MJ | `scene_states`, champ `weather_override` |

**Jamais stocké** : la météo d'un instant. `SceneState.weather` disparaît (version de la scène suivante, lue sans erreur depuis l'ancienne).

## 11. Découpage

| Ticket | Contenu | Modèle conseillé |
|---|---|---|
| ME-1 | Cette spec et l'ADR 0116 | Opus |
| ME-2 | Noyau : normales des 13 biomes, `climateOf` (bloc, ville, défaut du monde), position dans l'année et saison, tests d'abord | Opus · fait (`src/core/weather/climate.ts`, `season.ts`) |
| ME-3 | Noyau : `weatherAt` (normale, fronts, journée) et `weatherChanges`, tests d'abord (même graine, même temps ; neige seulement au froid ; continuité d'une heure à l'autre) | Opus · fait (`src/core/weather/weather.ts`) |
| ME-4 | Exposition dans le bloc `rooms` et `perceivedWeather`, éditeur, libellés | Sonnet |
| ME-5 | Branchement solo : calcul à chaque tour, en-tête, contexte de l'IA, ligne du tour ; fin de `SceneState.weather` ; climat par défaut dans les réglages | Sonnet, relu par Opus |
| ME-6 | Forçage du MJ (`weather_override`), depuis la fenêtre du MJ et la colonne de scène à distance | Sonnet |
| ME-7 | Import du climat depuis la carte Azgaar **du monde importé** dans ses blocs `settlement` (à faire avec G-7) ; test avec deux cartes différentes qui donnent deux climats différents | Opus |
| ME-8 | Effets en jeu du Guide du maître 2024 (froid, chaleur, précipitations, vent) | Opus, plus tard |

Ordre : ME-2, ME-3, ME-4, ME-5 donnent une météo vivante dès maintenant, avec le climat par défaut. ME-7 la rend géographique quand l'import Azgaar existe.

## 12. Questions ouvertes

| Question | Proposition |
|---|---|
| Temps partagé par région, pour qu'un voyage d'une ville à l'autre reste cohérent | Plus tard, avec le voyage ; graine par province Azgaar |
| La magie qui change le temps (sort *Contrôle du climat*) | Un forçage (§7) posé par le moteur quand le sort est lancé, avec sa durée |
| Une météo propre à un donjon, une grotte | Exposition `indoor` sans bruit extérieur perçu ; à voir à l'usage |
