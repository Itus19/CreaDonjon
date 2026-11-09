# Backlog V3.1 — Tickets terminés (☑)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md). Faits, ou conçus et découpés en tickets d'implémentation. Rarement à relire : les décisions qu'ils portent vivent dans `docs/adr/`.

> **Restauré le 7 novembre.** Du 13 au 14 octobre, cinq commits de suite (V3.1-117, 113, 48, 74, clôture du 96) ont réécrit ce fichier
> au lieu d'y ajouter leur fiche : les fiches de 36 tickets terminés avaient disparu, la table de l'index les cochait toujours.
> Elles sont remises ci-dessous dans leur dernière version connue (historique Git), sans retouche.

### ☑ V3.1-3 — Les dons à choix (Initié à la magie, etc.) n'ont aucune UI de choix · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) ; implémentation : V3.1-116 à 119**

**Modèle conseillé : Opus** — mécanisme générique de choix pour les dons, partagé avec V3.1-6 et V3.1-7.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Constaté le 27 septembre en accordant « Initié à la magie » via l'historique
« Guide ». Le don s'affiche sur la fiche en texte descriptif, mais l'assistant
de création de personnage ne propose **aucune étape** pour résoudre ses
choix (classe de sorts, deux sorts mineurs, un sort de 1er niveau) — et ce
n'est pas propre au contenu maison : **aucun don du jeu, même officiel,
n'a cette UI aujourd'hui.** `CharacterCreatorWizard.tsx` ne liste aucune étape
de type « FeatsStep » ; `AsiStep.tsx` (amélioration de caractéristique) ne
contient aucune logique de don ; la résolution des dons
(`resolvedRuleset.ts`) ne gère qu'un bloc `modifiers` générique (bonus fixes),
sans mécanisme de sous-choix comparable à celui déjà construit pour les
langues d'un historique (`RemainingChoice`, `resolvedRuleset.ts`).

Déjà noté comme hors périmètre, sans ticket dédié : *« Hors périmètre, à ne
pas faire ici : choix de don (nécessite une UI de création/montée de niveau,
gros morceau à part)... »* (`docs/BACKLOG_V1.md:619`).

**Taille assumée au-delà du format habituel de ce backlog** (voir l'intro :
`S`/`M` presque toujours) — à traiter comme un signal qu'il migre vers V2 ou
V3 le jour où il est pris, pas comme un ticket à boucler sur une session.

**Critères**
- [ ] Un don qui accorde un choix (classe de sorts, sorts mineurs, sort de
  niveau) présente ce choix dans l'assistant de création de personnage, au
  moment où le don est accordé (historique, don libre, etc.).
- [ ] Le choix résolu est appliqué mécaniquement — les sorts choisis
  deviennent réellement disponibles sur la fiche (onglet Actions), pas
  seulement consignés en texte.
- [ ] Le mécanisme est générique (comme `RemainingChoice` pour les langues),
  pas câblé au cas par cas pour Initié à la magie seul — un deuxième don à
  choix (ex. Chanceux répétable, un futur don maison) doit pouvoir le
  réutiliser sans nouveau code de choix.
- [ ] Un don sans choix (la majorité) continue de s'afficher tel quel, sans
  étape supplémentaire imposée à l'assistant.

**Vaut aussi pour un don accordé par une espèce** (constaté le 27 septembre
sur « Polyvalent »/Versatile, trait humain — don d'origine au choix) : la
branche qui résout l'espèce (`resolvedRuleset.ts:342-351`) ne gère aucun don
du tout, contrairement à l'historique qui en accorde au moins un fixe
(`extractBackgroundFeat`). Un don accordé par une espèce est donc un cran
plus creux que le cas déjà décrit ci-dessus — même critère, pas de ticket
séparé.

---
### ☑ V3.1-6 — Aucun mécanisme générique pour les traits d'espèce à choix · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) ; implémentation : V3.1-116 à 119**

**Modèle conseillé : Opus** — mécanisme générique des traits à choix, cinq formes de choix.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Suite à V3.1-3/V3.1-4 (Humain seulement) : relevé le 27 septembre sur les 9
espèces officielles du SRD 5.2.1, quels traits portent un choix.

| Espèce | Trait à choix | Nature du choix |
|---|---|---|
| Elfe | Lignage elfique (Elven Lineage) | choisir un lignage (Drow / Haut-elfe / Elfe des bois) — chacun accorde un cantrip au niveau 1, un sort de plus aux niveaux 3 et 5, et une caractéristique d'incantation à choisir (Int/Sag/Cha) |
| Elfe | Sens aiguisés (Keen Senses) | choisir une compétence parmi Intuition/Perception/Survie — **même mécanisme que V3.1-4** |
| Gnome | Lignage gnomique (Gnomish Lineage) | choisir Gnome des forêts ou Gnome des roches — chacun accorde des cantrips et un sort/objet différents |
| Goliath | Ascendance de géant (Giant Ancestry) | choisir un des 6 bénéfices (Nuage/Feu/Givre/Colline/Pierre/Tempête) — capacité rechargeable, utilisations = bonus de maîtrise, récupérées au Repos long |
| Humain | Compétent (Skillful) | choisir une compétence — **V3.1-4** |
| Humain | Polyvalent (Versatile) | choisir un don d'origine — **V3.1-3** |
| Tieffelin | Legs infernal (Fiendish Legacy) | choisir un legs (Abyssal / Chthonien / Infernal) — même forme que le lignage elfique (résistance + cantrip niveau 1, sorts niveaux 3/5, caractéristique d'incantation à choisir) |

Aucun choix pour Drakéide, Nain, Halfelin, Orc — vérifié, rien à faire sur ces
quatre.

**Le vrai trou n'est pas seulement Compétent/Polyvalent** (déjà couverts) :
c'est le **lignage/legs à choix qui empaquette plusieurs effets** (un
cantrip immédiat, un sort supplémentaire à deux paliers de niveau, une
caractéristique d'incantation choisie une fois pour tout le lignage) — un
schéma qui revient trois fois (Elfe, Gnome, Tieffelin) sans qu'aucun
mécanisme ne l'accueille aujourd'hui. Traiter ce ticket au cas par cas
(un lignage elfique câblé en dur, puis un legs tieffelin câblé en dur...)
serait exactement l'inverse de ce qui est demandé : un mécanisme **générique**
de « trait d'espèce à choix », pour qu'une espèce maison future avec un trait
du même genre marche sans nouveau code — même esprit que `RemainingChoice`
pour les langues d'historique.

**Critères**
- [ ] Un trait d'espèce à choix simple (compétence, langue, outil) suit
  V3.1-4 — ce ticket n'y ajoute rien de plus.
- [ ] Un trait d'espèce à choix de don suit V3.1-3.
- [ ] Un trait d'espèce à choix de lignage/legs présente les options
  (Drow/Haut-elfe/Elfe des bois, etc.) dans l'assistant, applique le
  bénéfice de niveau 1 immédiatement, et prévoit la montée en puissance aux
  niveaux 3 et 5 (nouveau sort toujours préparé, comme un don à sort fixe).
- [ ] La caractéristique d'incantation du lignage/legs (Int/Sag/Cha, choisie
  une fois) est mémorisée et réutilisée pour tous les sorts qu'il accorde.
- [ ] Un trait d'espèce à choix de capacité rechargeable (Ascendance de
  géant) présente le choix, et la capacité se récupère au Repos long comme
  n'importe quelle ressource nommée (déjà un mécanisme existant, à réutiliser
  plutôt qu'à dupliquer).
- [ ] Une espèce maison créée sans ce genre de trait n'est pas affectée —
  aucune étape supplémentaire imposée quand il n'y a rien à choisir.

---
### ☑ V3.1-7 — Une sous-classe n'apporte jamais d'effet mécanique, choix ou pas · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) ; implémentation : V3.1-116 à 119**

**Modèle conseillé : Opus** — sous-classes mécaniques : touche characterSheet() et les choix rechoisis.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Constaté le 28 septembre en vérifiant les 12 sous-classes officielles pour le
même genre de trou que V3.1-3/V3.1-6. Le trou est plus profond que prévu :
ce n'est pas seulement que les *choix* de sous-classe ne sont pas résolus,
c'est qu'**aucune sous-classe n'apporte jamais le moindre effet mécanique**,
choix ou pas.

Cause racine : `CreationSelection.classes` (`resolvedRuleset.ts:72`) est
`{key, level}[]` — **aucun champ pour la sous-classe choisie**. La fonction
qui assemble la fiche résolue (`assembleResolvedRuleset`, même fichier)
résout espèce, historique et classe génériquement, mais n'ajoute jamais la
clé de la sous-classe au lot résolu. Le schéma des blocs de sous-classe
(`zSubclassFeatureEntry`, `src/core/schemas/rule-blocks/blocks.ts:442`) ne
porte que `{name, level, description}` — aucune place pour un modificateur,
une résistance, un type de dégâts ou une liste de sorts. L'écran de la fiche
(`LevelClassesStep.tsx:327-330` → `SubclassFeatures`,
`blockContentRenderer.tsx:930-948`) ne fait que trier par niveau et afficher
le texte. **Ça vaut aussi pour « Serment de vengeance »** (créé le 27
septembre dans cette même session) : ses aptitudes sont dans le même cas,
ce n'est pas un recul propre au contenu maison.

Cinq cas relevés sur les sous-classes officielles, qui couvrent trois formes
différentes de ce qui manque :

| Sous-classe | Aptitude | Ce qui manque |
|---|---|---|
| Cercle de la Terre (Druide) | Sorts du Cercle de la Terre | choix de terrain **rechoisi à chaque Repos long**, change la liste de sorts toujours préparés |
| Sorcellerie draconique (Ensorceleur) | Affinité élémentaire (niv. 6) | choix d'un type de dégâts, **une fois** — résistance + bonus de dégâts |
| Protecteur Fiélon (Occultiste) | Résilience fiélonne (niv. 10) | choix d'un type de dégâts, **rechoisi à chaque repos** — résistance |
| Chasseur (Rôdeur) | Proie du chasseur / Tactiques défensives | choisir une aptitude passive parmi deux, **échangeable à chaque repos** |
| Collège du Savoir (Barde) / Évocateur (Magicien) | Découvertes magiques / Savant en évocation | choisir des sorts à ajouter — **même mécanisme que V3.1-3** (dons à sorts) |

**Aparté positif, à vérifier en direct plutôt qu'à corriger** : le choix de
*lignage* d'espèce (Haut-elfe, Gnome des roches...) existe bien
génériquement (`SpeciesStep.tsx:73-105`, filtre par `parentSpeciesKey`). Les
10 couleurs d'Ascendance draconique du Drakéide semblent suivre la même
forme en base, mais le script d'import standard ne les génère pas
(`scripts/ingest-srd.ts:1992-1995` ne parcourt pas le tableau imbriqué
`Species[].subspecies` du SRD) — impossible de confirmer sans lire la base
réelle si elles portent un vrai modificateur ou seulement un nom.

**Critères**
- [ ] La sous-classe choisie est résolue au même titre que l'espèce,
  l'historique et la classe — sa clé rejoint le lot dont les blocs
  `modifiers` sont appliqués.
- [ ] Un type de dégâts/caractéristique choisi une fois (Affinité
  élémentaire) est mémorisé et appliqué (résistance, bonus de dégâts).
- [ ] Un choix rechoisi à chaque repos (Cercle de la Terre, Résilience
  fiélonne, Chasseur) est présenté à nouveau après un Repos court/long,
  pas seulement à la création — recoupe V3.1-5 sur le déclenchement au
  Repos long.
- [ ] Un choix de sorts accordé par une sous-classe (Découvertes magiques,
  Savant en évocation) réutilise le mécanisme de V3.1-3, pas un nouveau.
- [ ] Une sous-classe purement descriptive (la majorité des niveaux, sur
  toutes les sous-classes) continue de s'afficher telle quelle, sans rien
  d'imposé en plus.

---
### ☑ V3.1-8 — Aucune demande structurée de disponibilités pour la prochaine séance · `L` · sans modèle IA — fait

**Modèle conseillé : Opus** — nouveau flux de demande de disponibilités, schéma et RLS.

Constaté le 27 septembre, captures de crab.fit à l'appui : le Calendrier réel
(V2.1-4, `docs/BACKLOG_V2.1.md:639`) ne connaît qu'un mode — la joueuse
renseigne librement ses disponibilités sur les 12 mois à venir, à tout
moment, sans qu'aucune question précise ne lui ait été posée ; le MJ découvre
ensuite ce qui a été rempli en consultant le classement des jours
(`SchedulingMjPanel.tsx`). Ce n'est pas ce qui se passe à table : le MJ sait
qu'il cherche une date sur une fenêtre donnée (« un des dix prochains
jours », « un mardi ou jeudi soir ») et veut pouvoir le demander
explicitement, comme crab.fit (nommer l'évènement, choisir les dates
candidates au clic-glissé sur un calendrier ou par jour de semaine, choisir
la plage horaire par curseurs) — avec la DA de CreaDonjon, jamais une reprise
visuelle de crab.fit.

Deux volets demandés, imbriqués :
1. **Côté MJ** — un bouton « Demander prochaines disponibilités » dans le
   Calendrier réel, qui ouvre un assistant en plusieurs étapes (nom, dates
   candidates, plage horaire).
2. **Côté joueuse** — une pastille de notification sur le bouton « Prochaine
   session » (voir aussi V3.1-9) dès qu'une demande est ouverte, qui invite à
   répondre sur les dates candidates précises de cette demande, pas sur un
   calendrier ouvert de 12 mois.

**Décision de modèle, actée avec l'auteur avant ce ticket** : le flux guidé
**remplace** le libre-service actuel — une joueuse ne renseigne plus ses
disponibilités sans qu'une demande soit ouverte par le MJ. Ça introduit une
vraie notion de **ronde de demande** : un objet avec ses propres dates
candidates (une liste de dates précises, ou un motif par jour de semaine sur
une fenêtre), sa propre plage horaire candidate, un statut ouvert/fermé, et
ses propres réponses — pas un deuxième calendrier libre, un sondage fermé sur
un choix limité, remis à zéro à chaque nouvelle demande. Ça se rapproche de
la piste C (Doodle) écartée en V2.1-4 au profit de la piste D (dispos
libres), mais seulement pour le tour de la demande — le classement par
chevauchement déjà écrit et testé (`src/core/scheduling/overlap.ts`) reste
réutilisé tel quel une fois les réponses en main, rien à refaire là-dessus.

**Modèle de données**

Nouvelle table `availability_requests` (une ronde par ligne) : `id`,
`campaign_id`, `title` (nullable, généré si vide), les dates candidates
(liste de dates précises, ou motif jour de semaine + fenêtre — à trancher à
l'implémentation selon ce que le schéma existant permet le plus simplement),
`starts_at`/`ends_at` (plage horaire candidate), `status` (`open`/`closed`),
`created_by`, `created_at`. RLS même motif que `real_sessions` (écriture MJ,
lecture ouverte à tout membre du monde).

`real_session_availabilities` gagne une colonne `request_id` (FK vers
`availability_requests`, nullable) — une réponse répond toujours à une ronde
précise. Les lignes déjà en base (saisies en libre-service avant ce ticket,
**en production**, cf. mémoire « migrations appliquées à la main ») restent
lisibles pour l'historique mais ne sont rattachées à aucune ronde — ne pas
les supprimer, ne pas les migrer de force vers une ronde fictive. Nouvelle
migration, jamais de modification d'une migration déjà appliquée (règle
absolue n°14) ; SCHEMA.md ne documente aujourd'hui ni `real_sessions` ni
`real_session_availabilities` (angle mort antérieur à ce ticket, à combler
en même temps qu'on y touche).

**Fait le 29 septembre.** Deux allers-retours en cours de ticket, après
retour utilisateur sur la première version livrée :
- **Formulaire en ligne, jamais dans une fenêtre pop-up** — la toute
  première version ouvrait un assistant en plusieurs étapes dans une boîte
  de dialogue (`RequestAvailabilityWizard.tsx`, supprimé). Refait en une
  seule page qui s'affiche directement dans le Calendrier réel
  (`RequestAvailabilityForm.tsx`), à l'image de la vraie page de crab.fit
  (retour utilisateur : « je voulais un quasi copié-collé de ce que propose
  crab.fit ») — nom, dates candidates, plage horaire empilés et visibles
  d'un coup, pas de Suivant/Précédent.
- **Plage horaire par curseur à deux poignées** (`TimeRangeSlider.tsx`), pas
  deux champs heure — même retour utilisateur, plus proche de crab.fit que
  le motif déjà utilisé pour le réglage manuel.
- `AvailabilityCalendar.tsx` n'a pas été réutilisé pour l'écran de réponse
  joueuse : ce composant naviguait un calendrier libre sur 12 mois, un
  besoin qui n'existe plus une fois la joueuse restreinte à une poignée de
  dates candidates fixes — un nouveau composant plus simple
  (`AvailabilityRequestResponse.tsx`, une ligne par date candidate) l'a
  remplacé, et `AvailabilityCalendar.tsx` a été supprimé (plus aucun appelant
  après ce ticket).

Le clic-glissé pour sélectionner des dates (retour utilisateur en cours de
ticket : « ajoute aussi l'option du cliquer-glisser ») est implémenté et
vérifié directement au niveau des évènements DOM (`mousedown` +
`mouseover`/`relatedTarget`, la façon dont React synthétise réellement
`onMouseEnter` en interne) — le simple clic reste possible en plus.

**Étapes**
1. Fait — Migration `20260929120000_availability_requests.sql` :
   `availability_requests` (dates candidates en `date[]`, résolues côté
   formulaire que l'origine soit un clic ou un motif « jours de semaine »),
   colonne `request_id` sur `real_session_availabilities`, RLS, index partiel
   `availability_requests_one_open_per_campaign`. `docs/SCHEMA.md` complété
   au passage (angle mort antérieur à ce ticket).
2. Fait — Formulaire MJ en ligne (`RequestAvailabilityForm.tsx`), affiché à
   la place du classement tant qu'aucune ronde n'est ouverte : nom, dates
   candidates (onglets « Dates précises » au clic/clic-glissé,
   `expandWeekdayPattern` en pur pour « Jours de la semaine »), plage
   horaire (`TimeRangeSlider.tsx`), bouton Créer — tout sur une page.
3. Fait — Écran de réponse joueuse sur une grille à peindre
   (`AvailabilityPaintGrid.tsx`, refondu — voir plus bas), une colonne par
   date candidate de la ronde ouverte.
4. Fait — `SchedulingMjPanel.tsx` : le classement par chevauchement porte
   sur `request.candidate_dates` (`getRankedDaysForRequest`), plus de
   navigation libre par mois. Une date candidate sans aucune réponse
   apparaît quand même, classée en dernier.
5. Fait — Pastille sur `NextSessionBadge.tsx`, disparaît dès la réponse
   enregistrée (`onResponded`, sans attendre la confirmation MJ).
6. Fait — `createRealSession`/`cancelAvailabilityRequest` ferment la ronde
   ouverte de la campagne.

**Deuxième vague, après retour utilisateur sur la première version livrée**
(mêmes critères, complétés en dessous) :
- **Grille à peindre plutôt que deux champs heure par date**
  (`AvailabilityPaintGrid.tsx`, retour utilisateur : "sélectionner les
  plages horaires par jours" comme sur crab.fit) — clic ou clic-glissé sur
  des cases d'une demi-heure, colonnes = dates candidates, lignes = la
  plage horaire suggérée par le MJ. Peindre reste une **façon de saisir**
  la même plage continue par jour (`rangeFromSlots`,
  `src/core/scheduling/availabilityGrid.ts`, pur/testé) — comble les trous
  plutôt que d'les refuser, aucun changement du modèle de données V2.1-4
  ("jamais deux disponibilités disjointes le même soir").
- **Carte de chaleur côté MJ** (`AvailabilityHeatmap.tsx`, retour
  utilisateur : "des zones de plus en plus foncées... avec une infobulle au
  survol") — complète le classement/bouton Confirmer déjà existant, ne le
  remplace pas : une case par (date, créneau de 30 min), teintée selon le
  nombre de joueuses dont la réponse couvre ce créneau précis, infobulle au
  survol listant qui.
- **Le MJ peut aussi renseigner ses propres disponibilités** (retour
  utilisateur : "le MJ doit aussi pouvoir mettre ses dispos") — section
  « Mes disponibilités » dans `SchedulingMjPanel.tsx`, même
  `AvailabilityPaintGrid.tsx` que côté joueuse, même endpoint
  (`GET`/`POST .../scheduling/availability`, qui a toujours résolu
  « mes propres réponses » depuis l'appelant authentifié — aucun
  changement d'API nécessaire). `totalMembers` compte désormais **tout le
  monde** (MJ inclus), pas seulement les joueuses — renverse le choix
  d'origine V2.1-4 qui excluait le MJ parce qu'il ne répondait jamais ;
  `resolveNamesIncludingGm` (copie locale, jamais `resolvePlayerNames`
  lui-même, réutilisé ailleurs) donne au MJ le nom « MJ » dans les rosters/
  infobulles, faute de PJ associé.
- **Écran joueuse en ligne, jamais en fenêtre pop-up** (retour utilisateur :
  "à l'image de ce que le joueur peut voir pour les autres onglets") —
  nouvelle page `/joueur/prochaine-session` (`app/m/[worldSlug]/joueur/
  prochaine-session/page.tsx`), au même titre que Notes ou Wiki.
  `NextSessionBadge.tsx` n'ouvre plus de `createPortal`/dialogue : c'est
  désormais un lien de navigation, plus léger.
- **Bouton "Prochaine session" invisible sur mobile, corrigé** (retour
  utilisateur : "le bouton de prochaine session disparaît" sur téléphone) —
  il n'existait que pour desktop (`hidden md:block`). Deux présentations
  du même lien dans `NextSessionBadge.tsx` : la bannière verticale habituelle
  à partir de `md:`, une icône + libellé court ("Session") en dessous,
  intégrée à la barre d'onglets du bas comme les six autres destinations.

**Critères**
- [x] Le MJ ouvre une demande avec un nom (ou vide → généré), des dates
  candidates (précises ou par jour de semaine sur une fenêtre), une plage
  horaire.
- [x] Toute joueuse de la campagne voit une pastille sur « Prochaine
  session » tant qu'elle n'a pas répondu à la demande ouverte — visible sur
  mobile comme sur desktop.
- [x] La pastille disparaît dès que la joueuse a répondu, sans attendre que
  le MJ confirme une séance.
- [x] La joueuse (et le MJ) ne répond que sur les dates candidates précises
  de la demande en cours, sur une grille à peindre — plus de calendrier
  ouvert sur 12 mois sans demande, plus de champs heure séparés.
- [x] Le classement des jours et la carte de chaleur côté MJ ne portent que
  sur la demande ouverte en cours, MJ inclus dans l'effectif.
- [x] Confirmer une séance, ou annuler la demande, la ferme : plus de
  pastille, plus d'invite à répondre, pour tout le monde.
- [x] Une seule demande ouverte à la fois par campagne (garanti par l'index
  partiel en base).
- [x] L'écran joueuse ("Prochaine session" et ses trois onglets) est une
  page normale de la coquille, jamais une fenêtre pop-up.

Vérifié en direct sur ClaudeLand (compte de test à la fois MJ et joueuse) :
création d'une ronde par clic (dates précises) et par motif « jours de
semaine sur une fenêtre » (`expandWeekdayPattern` vérifié bout en bout),
glissement des deux poignées du curseur horaire, peinture de cases sur la
grille (glissé réel, pas seulement clic isolé), réponse joueuse **et** MJ,
classement et carte de chaleur mis à jour (« 1/3, session raccourcie » une
fois le MJ compté), confirmation créant la séance et fermant la ronde,
annulation d'une ronde sans séance, page `/joueur/prochaine-session`
atteignable sans pop-up, bouton visible en largeur mobile. `npm run
typecheck && npm run lint && npm run test:core` passent.

---
### ☑ V3.1-9 — Bouton « Prochaine session » mal calibré selon l'écran · `S`/`M` · sans modèle IA — fait

**Modèle conseillé : Sonnet** — ajustement d'affichage.

Constaté le 27 septembre, capture à l'appui : la bannière verticale
(`NextSessionBadge.tsx`), texte tourné à 90°, taille en
`clamp(7px,1.15vh,10px)`, devient illisible/écrasée sur certaines hauteurs
d'écran — le vrai problème étant que tout le texte (« Prochaine session —
dimanche 27 septembre 2026 ») était concaténé en un seul bloc continu. Le
bouton doit aussi donner accès aux dates passées, aux dates à venir, et — si
une demande est ouverte par le MJ (V3.1-8) — au remplissage des
disponibilités : jusque-là il n'ouvrait que la saisie
(`AvailabilityCalendar.tsx`) une fois une séance déjà confirmée, sans aucun
accès à `getPastSessions`/`getUpcomingSessions` (déjà écrits côté service,
`src/server/services/scheduling.ts`, jamais consultés côté joueuse).

Lié à V3.1-8 mais indépendant : ce ticket vaut même si V3.1-8 n'est pas
encore pris (l'onglet « Mes disponibilités » reste alors toujours visible,
faute de demande à conditionner dessus — voir plus bas).

**Fait le 29 septembre.** Première version basculée à l'horizontal (deux
lignes de texte normal) — corrigée après retour utilisateur : l'orientation
verticale devait être **gardée**, seul le texte tout attaché posait
problème. Version finale : le bouton reste vertical
(`writing-mode: vertical-rl`, `rotate(180deg)`), mais scindé en deux blocs
(« Prochaine session » / la date) plutôt qu'une seule chaîne concaténée —
deux blocs sous `vertical-rl` deviennent deux colonnes côte à côte,
chacune bien plus courte que l'ancien texte tout collé, sans changer
l'esthétique voulue.

**Étapes**
- Fait — Bouton normal (contour fin couleur `accent`, sans fond plein, même
  famille que l'ancien bouton « Renseigner mes disponibilités »), texte
  vertical scindé en deux blocs plutôt qu'un seul.
- Fait, puis refondu (V3.1-8, retour utilisateur : "à l'image de ce que le
  joueur peut voir pour les autres onglets") — le clic ouvrait d'abord un
  panneau à onglets en fenêtre pop-up ; il mène désormais à une vraie page
  (`/joueur/prochaine-session`, `NextSessionPanel.tsx`), plus de
  `createPortal`. Trois onglets inchangés (À venir / Passées / Mes
  disponibilités), réutilisant `getUpcomingSessions`/`getPastSessions`.
- Fait, puis complété (retour utilisateur : "le bouton de prochaine session
  disparaît" sur téléphone) — n'existait que pour desktop (`hidden
  md:block`). `NextSessionBadge.tsx` porte désormais deux présentations du
  même lien : la bannière verticale à partir de `md:`, une icône + libellé
  court intégrée à la barre d'onglets du bas en dessous, comme les six
  autres destinations de `PlayerShell.tsx`.
- Fait — Vérifié sur des hauteurs de fenêtre resserrées (jusqu'à 480px) :
  aucun débordement, aucun chevauchement avec les autres destinations de la
  coquille joueuse (`PlayerShell.tsx`).

**Critères**
- [x] Le texte est lisible sur toutes les hauteurs de fenêtre déjà couvertes
  par `PlayerShell.tsx` (desktop) — et visible tout court sur mobile, où il
  n'apparaissait pas du tout.
- [x] Le bouton mène à un écran à onglets (passé/à venir/mes dispos), une
  page normale de la coquille plutôt qu'une fenêtre pop-up ou le seul
  calendrier de saisie.
- [x] L'onglet « Mes disponibilités » affiche la réponse à la ronde ouverte
  (V3.1-8, fait depuis) si une demande est en cours, sinon un message
  explicite plutôt qu'un onglet vide.

---
### ☑ V3.1-10 — Connexion par identifiant/mot de passe plutôt que lien à retrouver · `L` · sans modèle IA — fait

**Modèle conseillé : Opus** — authentification.

Constaté le 27 septembre : les joueuses redemandent systématiquement le lien
d'invitation à l'auteur. Ce n'est pas un oubli isolé, c'est la conséquence
directe d'un choix déjà acté — [docs/adr/0015-provisioning-comptes-invites.md](../adr/0015-provisioning-comptes-invites.md)
: un compte invité (`provisionInviteSession`,
`src/server/services/accountProvisioning.ts:11`) n'a **jamais** d'email réel
ni de mot de passe, seulement une adresse synthétique invisible et une
reconnexion par lien magique. Rien qu'une joueuse puisse retenir ou
retrouver seule.

**Vision retenue, sur plusieurs échanges les 27 et 28 septembre — remplace
toutes les versions précédentes de ce ticket.**

**Comptes et mondes sont découplés.** Un compte peut exister sans être
membre d'aucun monde — au moment de sa création, ou après une révocation.

**Deux familles de comptes, un seul écran de connexion (`/login`,
`app/login/actions.ts`) :**
- **Comptes ordinaires** (email réel + mot de passe) — inchangés, l'auteur
  y compris. `/signup`/`/login` existants ne bougent pas.
- **Comptes « tag »** — un nom affiché (pas unique : deux comptes peuvent
  s'appeler « Julie ») accompagné d'un identifiant à **4 chiffres** généré
  automatiquement (`#0000`–`#9999`, régénéré en cas de collision sur la
  paire nom+chiffres), **invisible partout sauf dans les réglages du compte
  concerné** — jamais dans une liste de membres, jamais dans l'attribution
  publique d'une création. Chaque compte en a un, y compris celui de
  l'auteur (`Gabriel#0000`) : le tag sert à l'attribution interne, pas
  seulement aux comptes invités.
  *Amendé le 1ᵉʳ octobre par V3.1-15 et l'ADR 0032 : le tag devient
  visible du MJ de la campagne, dans la Gestion de campagne, pour distinguer
  deux comptes de même nom. Invisible partout ailleurs, comme avant.*
- **À la connexion, on tape juste un nom et un mot de passe** — jamais le
  tag. La résolution essaie, dans l'ordre, chaque compte « tag » portant ce
  nom contre ce mot de passe (collisions rares à l'échelle d'une table de
  jeu), puis retombe sur un email classique si rien ne correspond.
- **N'importe qui peut créer un compte « tag » sans invitation**, depuis
  `/login` (bascule « créer un compte ») — atteignable aussi par un bouton
  que le MJ pose lui-même sur son wiki public, qui mène au même écran. Un
  tel compte ne donne accès à rien tant que personne ne l'invite dans un
  monde.

**Un lien d'invitation rattache un compte (nouveau ou déjà existant) à un
monde et un rôle — il ne crée plus de mot de passe, la personne le choisit
elle-même en cliquant le lien pour la première fois :**
- **Lien joueur : réutilisable par plusieurs personnes** — un lien = un
  monde, pas une personne. Renverse la décision nominative de V2-M4 (« un
  lien par personne »), volontairement : la nominativité perd son intérêt
  une fois que c'est la personne elle-même, pas le MJ, qui choisit son
  identité et son mot de passe.
- **Lien MJ : reste nominatif, à usage unique**, comme aujourd'hui — rôle
  plus sensible (droits d'édition sur tout le monde), pas de raison de le
  rendre partageable.
- Le mot de passe optionnel déjà existant sur un lien (`password_hash` sur
  `campaign_invites`, `verifyInvitePassword`) reste disponible comme verrou
  de groupe supplémentaire — d'autant plus utile qu'un lien joueur peut
  désormais circuler plus largement qu'à une seule personne.

**Personnage choisi après coup, pas à la création du compte.** Première
visite d'un monde en tant que joueuse sans PJ assigné : écran listant les
PJ ouverts (non réclamés) du monde, plus une option « Nouveau PJ » vers
l'assistant de création existant. Le MJ garde la main pour réassigner qui
joue quel PJ ensuite.

**Révoquer une joueuse = l'expulser du monde**, rien de plus : retire son
adhésion (`campaign_members`), libère le PJ qu'elle jouait
(`campaign_characters.user_id = null`) — même geste que `revokeInvite`
aujourd'hui. Le compte survit, inchangé ailleurs (autres mondes, ou aucun).
Ne touche plus au lien lui-même, qui reste ouvert pour d'autres puisqu'il
est désormais réutilisable.

**Mot de passe oublié — pas de miracle sans email, donc ça reste médié :**
un bouton « Mot de passe oublié » sur l'écran de connexion dépose une
demande plutôt que d'exiger un aller-retour hors de l'app (Discord, SMS...).
Elle apparaît dans le panneau de tout MJ dont ce compte est membre d'un
monde. **Si le compte n'est membre d'aucun monde** (créé en libre-service,
jamais invité, ou révoqué de partout), aucun MJ ordinaire n'a d'autorité
dessus — c'est le superadmin qui la voit et agit (point suivant).

**Le superadmin (compte de l'auteur, `profiles.account_role = 'superadmin'`,
déjà posé par la migration `20260830090001_superadmin_role.sql`) étend ses
pouvoirs déjà existants** (`app/api/admin/*`, `deleteInvitedAccount`, « voir
comme ») avec trois gestes nouveaux, pour couvrir précisément les comptes
qu'aucun MJ particulier ne gère :
- réinitialiser le mot de passe de n'importe quel compte de la plateforme ;
- supprimer n'importe quel compte — généralise `deleteInvitedAccount`
  (`accountProvisioning.ts:192`), dont le garde-fou actuel (« refuse si
  jamais réclamé par un lien d'invitation ») ne tient plus une fois les
  comptes « tag » libre-service possibles, à revoir dans le même geste ;
- transférer un ruleset personnel d'un compte à un autre
  (`rulesets.created_by`) — jamais sur `is_official_base = true`, règle
  absolue n°18, inchangée.

**Corrections par rapport aux versions précédentes de ce ticket :**
- Un mot de passe de **compte** passe par le mécanisme natif de Supabase
  Auth (`admin.auth.admin.createUser({ email, password })`,
  `signInWithPassword`) — jamais par `hashSharePassword`/scrypt
  (`src/core/shareLinks/password.ts`), qui reste réservé aux mots de passe
  de **lien** (partage, invitation), lesquels ne correspondent à aucune
  identité `auth.users`. Une version antérieure de ce ticket proposait à
  tort de réutiliser scrypt pour les mots de passe de compte.
- Le lien magique (`mintSessionForInvitedAccount`/`mintSessionForOwnAccount`,
  `accountProvisioning.ts`) reste exactement ce qu'il est aujourd'hui,
  réservé à « voir comme » côté superadmin — il ne joue plus aucun rôle dans
  la connexion ordinaire, contrairement à ce qu'une version antérieure de ce
  ticket envisageait.
- « Forcer une réinitialisation » (MJ ou superadmin, sur un compte
  existant) ne suppose ni mot de passe temporaire tapé à la main, ni lien
  magique : ça génère un jeton à usage unique — même primitive que les
  liens d'invitation, pas une nouvelle mécanique — qui mène à l'écran de
  choix d'un nouveau mot de passe (jamais de connexion automatique).

**Modèle de données**

- `profiles` gagne `handle_name` (texte) + `handle_tag` (4 chiffres),
  uniques ensemble (pas `handle_name` seul), et `must_change_password`
  (booléen). Aucune colonne de mot de passe applicatif — le mot de passe
  vit dans `auth.users`, géré par Supabase Auth.
- `campaign_invites` : les liens de rôle `player` perdent leur sémantique
  « réclamé une seule fois » — plus de `claimed_by_user_id` singulier pour
  ce rôle, la liste de qui a rejoint via un monde redevient simplement
  `campaign_members` (source de vérité déjà existante, pas de nouvelle
  table de suivi). Les liens de rôle `gm` gardent le comportement actuel à
  l'identique.
- Demande de réinitialisation en attente : petite table ou flag +
  horodatage sur `profiles`, lisible par tout MJ d'un monde dont ce compte
  est membre, et par le superadmin dans tous les cas.

**Étapes**

1. Nouvel ADR actant : mots de passe natifs Supabase (jamais de lien
   magique comme canal de connexion courant), liens joueurs réutilisables
   (renverse V2-M4), comptes utilisables sans monde, réinitialisation
   médiée par jeton à usage unique. L'ADR 0015 et le commentaire « un lien
   par personne » de V2-M4 ne sont jamais réécrits — ce nouvel ADR
   documente la suite, pas une correction de l'ancien.
2. Migration : `handle_name`/`handle_tag`/`must_change_password` sur
   `profiles` (avec attribution d'un tag à chaque compte existant,
   `Gabriel#0000` pour l'auteur), assouplissement de `campaign_invites`
   pour les liens joueur, table/flag de demande de réinitialisation.
3. Écran de connexion unique (`/login`) : « se connecter » (nom + mot de
   passe, ou email pour un compte ordinaire) et bascule « créer un compte »
   (nom, tag généré à la volée, mot de passe) — utilisable avec ou sans
   lien d'invitation en contexte.
4. Un lien d'invitation ouvert dans cet écran attache automatiquement le
   compte (nouveau ou existant) au monde/rôle visé, juste après connexion
   ou création de compte.
5. Première visite d'un monde en tant que joueuse sans PJ assigné : écran
   « Choisis ton personnage » (PJ ouverts + « Nouveau PJ » vers l'assistant
   existant).
6. Panneau MJ (gestion des invitations existante,
   `src/server/services/campaignInvites.ts`) : génération d'un lien joueur
   réutilisable vs un lien MJ nominatif ; « Révoquer » simplifié (retire
   l'adhésion + libère le PJ, ne touche plus au lien) ; bouton « Forcer une
   réinitialisation » par compte ; liste des demandes de réinitialisation
   en attente pour les mondes de ce MJ.
7. Écran de connexion : bouton « Mot de passe oublié » qui dépose une
   demande plutôt que d'exiger un canal externe.
8. Panneau Administration (superadmin) : tous les comptes de la plateforme,
   réinitialisation, suppression généralisée, transfert de ruleset
   personnel, et les demandes de réinitialisation orphelines (compte sans
   aucun monde).

**Critères**

- [x] N'importe qui peut créer un compte (nom + mot de passe, tag généré
  automatiquement) sans invitation, depuis `/login` ou le bouton du wiki
  public — ce compte n'a accès à aucun monde tant que personne ne l'y
  invite.
- [x] Un lien joueur peut être utilisé par plusieurs personnes différentes,
  chacune rejoignant le même monde avec son propre compte.
- [x] Un lien MJ reste utilisable par une seule personne, comme aujourd'hui.
- [x] À la première visite d'un monde comme joueuse, si aucun PJ n'est déjà
  assigné, la joueuse choisit parmi les PJ ouverts ou en crée un nouveau —
  jamais imposé au moment de la création du compte.
- [x] Révoquer une joueuse retire son accès au monde et libère son PJ ; son
  compte reste utilisable ailleurs (autres mondes, ou aucun) ; le lien
  d'invitation, lui, continue de fonctionner pour d'autres.
- [x] Une demande de réinitialisation envoyée sans mot de passe connu arrive
  dans le panneau d'un MJ compétent, ou du superadmin si le compte n'a
  aucun monde.
- [x] Le superadmin peut réinitialiser le mot de passe, supprimer, ou
  transférer un ruleset personnel de n'importe quel compte de la
  plateforme.
- [x] Le tag (`#NNNN`) n'est jamais visible ailleurs que dans les réglages
  du compte concerné.
- [x] Un nouvel ADR documente ce modèle, sans modifier l'ADR 0015 ni le
  commentaire de V2-M4.

Fait le 29 septembre (ADR 0031). Réalisé en six étapes, chacune vérifiée en
navigateur avec des comptes/mondes de test créés puis supprimés :

1. **Migration** (`20260929130000_native_password_accounts.sql`) :
   `profiles.handle_name`/`handle_tag`/`must_change_password`/
   `password_reset_requested_at`, génération de tag avec retry sur
   collision, `app.resolve_login_emails`/`app.request_password_reset_by_name`
   (anon-safe), `app.revoke_campaign_member`, `account_reset_tokens` (RLS
   sans aucune politique).
2. **Écran de connexion unique** (`/login`) : nom-ou-email essaie d'abord
   les comptes "tag", puis retombe sur un email ordinaire ; bascule "Créer
   un compte" (tag, libre-service) ; "mot de passe oublié" par nom.
3. **Liens joueurs réutilisables** : `provisionInviteSession` ne crée plus
   de compte lui-même (déplacé vers `accountAuth.createTagAccount`,
   appelé par `app/rejoindre/[token]/actions.ts` avant la connexion
   directe par mot de passe) ; `campaign_members` fait foi pour un lien
   joueur, `claimed_by_user_id` reste la source pour un lien MJ (nominatif,
   usage unique, inchangé).
4. **Panneau MJ** (`InviteLinkPanel`/`CampaignDetail`) : section "Liens
   joueurs" distincte (jamais "jamais ouvert"), révocation individuelle
   d'un membre (`app.revoke_campaign_member`, sans toucher au lien),
   "Forcer une réinitialisation" par membre avec lien affiché inline,
   indicateur "mot de passe oublié".
5. **Écran "Choisis ton personnage"** (`/joueur`, sans PJ assigné) : PJ
   ouverts de la campagne ou "Nouveau PJ" (même assistant que côté MJ,
   `CharacterCreatorWizard` gagne un prop `onCreate` optionnel pour
   réclamer la fiche immédiatement plutôt que la laisser flottante).
6. **Panneau superadmin** (`AdminPanel`) : section "Comptes — toute la
   plateforme" (jamais le tag), réinitialisation/suppression généralisées à
   tout compte, transfert de ruleset personnel — `deleteInvitedAccount`
   (ancien, borné aux comptes invités) supprimé, devenu mort code une fois
   `adminDeleteAccount` généralisé en place.

**Écarts assumés par rapport au ticket** :
- La demande "mot de passe oublié" par nom (ambigu, plusieurs comptes
  peuvent partager un `handle_name`) pose le drapeau sur TOUS les comptes
  de ce nom plutôt que d'exiger une désambiguïsation — négligeable à
  l'échelle d'une table de jeu personnelle, le MJ/superadmin reconnaît sa
  propre joueuse dans son panneau.
- Le panneau superadmin affiche `password_reset_requested_at` pour TOUS les
  comptes, pas seulement ceux sans monde (le critère garantit un minimum —
  "MJ compétent, ou superadmin si sans monde" — pas un maximum ; le
  superadmin voit de toute façon tout le reste).
- Réglages du compte affichant son propre `handle_tag` : non construit,
  hors des huit étapes listées par le ticket — actuellement aucun endroit
  ne montre jamais le tag à personne, y compris à son propriétaire.
- Bouton "créer un compte" posable par le MJ sur son wiki public : non
  construit (mentionné dans la vision, absent des critères d'acceptation
  et des étapes).
- Réouverture d'un lien MJ déjà réclamé sur un compte créé AVANT V3.1-10
  (sans mot de passe) : ne fonctionne plus pour un lien de rôle `player`
  (le garde-fou par rôle empêche la reconnexion par lien magique) — un tel
  compte a besoin d'une réinitialisation forcée (MJ/superadmin) pour
  obtenir son premier mot de passe. Cas rare (comptes antérieurs à ce
  ticket uniquement), non couvert par une migration de données faute de
  pouvoir deviner un mot de passe à leur place.

---
### ☑ V3.1-11 — Onglet « Solo » visible même avec un MJ humain déjà présent · `S` · sans modèle IA — fait

**Modèle conseillé : Sonnet** — une condition d'affichage.

Constaté le 28 septembre, en discutant de V3.1-10 : la coquille joueuse
(`PlayerShell.tsx:64`) liste « Solo » comme destination fixe, sans condition
— le mode solo (V3, IA locale) n'a de sens que pour une joueuse sans MJ
humain sur ce monde. Aujourd'hui il reste visible même dans un monde qui a
un vrai MJ, alors que `campaign_members` porte déjà un rôle `gm` par
campagne (`src/server/repos/campaigns.ts:138`) — une simple présence de ce
rôle suffit à savoir si ce monde a un MJ humain.

**Critères**
- [x] L'onglet « Solo » n'apparaît dans la coquille joueuse que si la
  campagne du monde consulté ne compte aucun membre de rôle `gm`.
- [x] Un monde sans MJ humain (solo par nature) continue d'afficher l'onglet
  normalement — aucune régression sur l'usage principal de ce mode.

Fait le 29 septembre. `hasHumanGm(supabase, campaignId)` (nouveau, dans
`src/server/services/campaigns.ts`) réutilise `listCampaignMembers` et
cherche un membre `role === "gm"` — même motif que `resolveNamesIncludingGm`
dans `scheduling.ts`. `app/m/[worldSlug]/joueur/layout.tsx` résout la
campagne du monde (`resolveCampaignId`, `null` traité comme « pas de MJ »)
et passe le résultat à `PlayerShell` en prop `hasHumanGm`, qui filtre
l'entrée « Solo » de son tableau `destinations` quand elle vaut `true`.

Vérifié en navigateur sur ClaudeLand/Faerûn (copie), qui a un MJ humain :
l'onglet Solo est bien absent de la coquille joueuse. Le cas inverse (monde
sans MJ humain) n'a pas pu être rejoué en direct — la création de monde
n'offre aujourd'hui que le mode « Campagne (MJ humain) », aucun moyen
d'obtenir un monde solo depuis cet écran — mais découle directement du code :
`createCampaign`/`insertCampaignMember` (`campaigns.ts:120`) n'insère un
membre `role: "gm"` que pour `mode: "campaign"`, jamais pour `mode: "solo"`
ni quand `resolveCampaignId` renvoie `null` (monde sans campagne).

---
### ☑ V3.1-14 — Aucun moyen pour une joueuse de créer elle-même son PJ sans personnage déjà assigné · `M` · sans modèle IA — **repris par V3.1-82, 83 et 100 (9 octobre)**

**Fermé le 9 octobre, repris ailleurs** (décision de l'auteur) : « Créer mon
personnage » depuis l'onglet Personnage → V3.1-83 (carte « Nouveau
personnage » du carrousel, V3.1-82) ; rejoindre une table sans choisir de PJ,
et le lien qui vise un PJ précis → **V3.1-100**. Le texte ci-dessous reste
pour mémoire.

**Modèle conseillé : Opus** — une joueuse crée sa fiche : propriété, RLS, canEditEntity.

Constaté le 29 septembre, en vérifiant V3.1-9 : le lien de test donné par
l'auteur menait à l'écran « Bienvenue » (`app/rejoindre/[token]/JoinForm.tsx`)
avec « Aucun personnage disponible pour l'instant » — le rôle joueur exige
aujourd'hui qu'un PJ non réclamé existe déjà (sinon `missing_entity`,
`accountProvisioning.ts:69`), et la seule façon d'en créer un est que le MJ
le fasse à la main au préalable (nouvelle fiche, puis dropdown « PNJ (sans
joueur) » dans Gestion de campagne pour la laisser ouverte).

Même trou côté onglet Personnage (`ParticipantCharacterSheet.tsx:37`) : le
bouton « Créer mon personnage » n'amorce l'assistant (`CharacterCreatorWizard`)
qu'en `entityMode` — sur une entité **déjà assignée** (`entityId`/
`entityVersion` transmis par la page appelante) — jamais pour une joueuse qui
n'a encore aucun PJ du tout.

Pourtant `CharacterCreatorWizard` sait déjà créer une entité de zéro (mode
hors `entityMode`, ligne 116 : « Requis seulement hors `entityMode` (création
d'une nouvelle entité) », utilisé aujourd'hui seulement côté MJ via
`EditEntityForm.tsx`) — la brique existe, elle n'est simplement jamais
proposée à une joueuse sans PJ.

**Décision** : une joueuse sans PJ assigné peut lancer l'assistant en mode
création (pas seulement édition d'une entité existante), qui crée directement
une fiche marquée PJ (`is_pc: true`) et attribuée à elle
(`campaign_characters.user_id`) — éditable ensuite par elle-même et par le MJ
comme n'importe quel PJ (`canEditEntity`, aucun mécanisme nouveau à écrire
pour ça).

Deux points d'entrée à couvrir :
- Le bouton « Créer mon personnage » du menu Personnage
  (`ParticipantCharacterSheet.tsx`), quand la joueuse n'a aucun PJ du tout —
  pas seulement « PJ sans fiche », le cas déjà couvert aujourd'hui.
- L'écran « Bienvenue » (`JoinForm.tsx`) — remplacer « Aucun personnage
  disponible pour l'instant » par une option « Créer mon personnage » quand
  la liste des PJ ouverts est vide.

Recoupe l'étape « Nouveau PJ » prévue par V3.1-10 (choix du PJ à la première
visite d'un monde, une fois le nouveau système de connexion en place) — même
mécanisme, à ne construire qu'une fois : ce ticket peut se faire
indépendamment et avant, V3.1-10 le réutilise plutôt que d'en réécrire un
second.

**Étapes**
1. Identifier où « aucun PJ du tout » atteint aujourd'hui
   `ParticipantCharacterSheet.tsx` (actuellement ce composant n'est monté
   qu'avec un `entityId` déjà connu — la page appelante doit d'abord
   accepter ce cas).
2. Proposer l'assistant en mode création (hors `entityMode`) à cet endroit ;
   à la validation, marquer la nouvelle entité PJ et l'attribuer à l'auteure
   de la création (`campaign_characters` upsert, `is_pc: true`, `user_id`) —
   un seul geste, pas une création suivie d'une attribution manuelle séparée
   par le MJ.
3. `JoinForm.tsx`/`actions.ts` : quand `characters.length === 0` (rôle
   joueur), remplacer le message bloquant par une option « Créer mon
   personnage » qui ouvre le même assistant avant de finaliser la connexion.
4. Le MJ garde la main ensuite : la fiche reste réassignable/révocable comme
   n'importe quel PJ (`CampaignDetail.tsx`, déjà existant) — rien de nouveau
   à construire ici.

**Critères**
- [ ] Une joueuse sans aucun PJ assigné peut créer le sien elle-même via
  l'assistant, depuis le menu Personnage.
- [ ] La fiche créée est immédiatement un PJ attribué à elle — éditable par
  elle et par le MJ, sans étape manuelle supplémentaire du MJ.
- [ ] L'écran « Bienvenue » (rejoindre un monde) propose la création d'un PJ
  quand aucun n'est disponible, au lieu d'un message bloquant sans issue.
- [ ] Une joueuse qui a déjà un PJ (avec ou sans fiche) n'est pas affectée —
  comportement actuel inchangé pour ce cas.

---
### ☑ V3.1-15 — La Gestion de campagne illisible : invitations en haut, une carte par personne · `M` · sans modèle IA — **fait, vérifié en direct le 9 octobre**

**Modèle conseillé : Sonnet** — interface d'après l'esquisse ; reste la vérification en direct.

Constaté le 1ᵉʳ octobre par l'auteur, captures à l'appui : la fenêtre « Gestion
de campagne » (`CampaignDetail.tsx` + `InviteLinkPanel.tsx`) est « assez
illisible, avec une interface peu claire ». Elle empile cinq listes sans lien
visible entre elles — Membres, À la table, Liens joueurs, Liens MJ en attente,
Personnages attribués, Octrois d'édition — et c'est au MJ de recouper de tête
qui joue quoi et qui peut modifier quoi.

**Esquisse retenue : la piste A**, sur le canevas
[Gestion de campagne — esquisses](https://claude.ai/artifact/KvM1bxgB61kUaJT2n1CxT2)
(artboard « A — Invitations en haut, une fiche par personne », fichier
`Main.dc.html`). Quatre pistes y ont été comparées le 1ᵉʳ octobre : A (cartes
par personne), B (liste à gauche, détail à droite), C (tableau fiches ×
joueurs), D (onglets). **A l'emporte** : elle répond d'un coup d'œil à « qui
est à la table, et qu'est-ce que chacun peut toucher » — et sa seule faiblesse,
s'allonger avec le nombre de joueurs, ne joue pas ici : une table dépasse
rarement 4-5 joueuses (auteur). Comme pour V2.1-24/25, **l'esquisse fait foi**
pour la disposition ; le code fait foi pour tout le reste (jetons, `Dropdown`,
`ActionsMenu`, `ConfirmDialog`).

**Ce que l'écran actuel cache, et que le ticket corrige** — relevé sur les
captures, chacun vérifié dans le code :

1. **« Révoquer » veut dire deux choses.** Dans « Membres », il retire la
   personne de la campagne et libère son personnage (`revokeMember`,
   `ConfirmDialog` « Révoquer ce membre ? ») ; dans « Personnages attribués »,
   il libère seulement le PJ (`revokeCharacterClaim`). Même mot, même couleur,
   deux portées. Deux libellés distincts : **« Retirer de la campagne »** et
   **« Libérer le personnage »**.
2. **« Forcer une réinitialisation » est répété sur chaque ligne** comme un
   lien de texte, alors que c'est un geste rare. Il descend dans le menu ⋮ de
   la carte, avec « Retirer de la campagne ». Une **demande de
   réinitialisation en attente** (`passwordResetRequests`) reste en revanche
   visible sur la carte, sous forme d'étiquette — c'est la seule raison
   d'aller chercher ce geste.
3. **Une même personne est dispersée** entre « Membres » (son compte),
   « Personnages attribués » (son PJ) et « Octrois d'édition » (ses fiches).
   La carte les réunit.
4. **« Personnages attribués » mélange PJ et PNJ sans joueur.** Les PJ
   passent sur les cartes ; les PNJ de la campagne (`is_pc: false`, sans
   `user_id`) vont dans un encart à part, en bas.
5. **Deux comptes portent le même nom** (« Tamara » deux fois, l'un sans
   personnage ni fiche). Rien à l'écran ne permet de les distinguer. **Tranché
   le 1ᵉʳ octobre : le tag à 4 chiffres** — voir « Le tag, visible du MJ »
   ci-dessous.

**La disposition (piste A)**

- **En haut, un panneau « Invitations »** : la création d'une invitation sur
  une ligne (courriel *ou* lien, rôle, mot de passe optionnel, un seul bouton
  principal), puis les liens actifs en lignes calmes — rôle, date de création,
  étiquette « protégé », `Copier` visible, le reste dans ⋮ (`InviteRow`
  existant, déjà ainsi depuis V2.1-25). Le compte des liens dans l'en-tête du
  panneau (« 5 liens joueurs actifs · 0 lien MJ en attente »). L'état vide
  « Aucun lien MJ en attente » se réduit à cette mention : il n'a pas à
  occuper un grand cadre pointillé.
- **« À la table » : les MJ sur une ligne** (nom, étiquette MJ, et ce qu'ils
  ont en plus — ex. « Peut éditer : Prologue »). Un MJ peut déjà tout
  modifier : une carte entière pour lui serait du bruit.
- **Une carte par compte joueur**, en grille (3 colonnes sur grand écran,
  1 sur téléphone) :
  - en-tête : initiale, nom **suivi de son tag** (`Tamara#4821`, le tag en
    `text-ink-muted` et en chiffres tabulaires, plus discret que le nom),
    rôle, menu ⋮ du compte (« Forcer une réinitialisation », « Retirer de la
    campagne », tous deux confirmés) ;
  - **le PJ joué**, mis en avant (fond d'accent), avec son propre ⋮ («
    Ouvrir la fiche », « Libérer le personnage ») — ou, sans PJ, une zone
    pointillée « Aucun personnage — attribuer un PJ » qui ouvre le choix ;
  - **« Peut aussi modifier »** : les fiches octroyées en étiquettes, chacune
    retirable par ×, puis « + Partager une fiche » (le `Dropdown` de fiches
    existant, à l'endroit de la personne — on ne choisit plus le joueur dans
    un second menu, il est déjà donné par la carte).
- **En bas, « PNJ de la campagne · sans joueur »** : les PNJ attribués en
  étiquettes, et « + Ajouter un PNJ » (le geste « Attribuer » actuel, cas
  « PNJ (sans joueur) »).

**Étapes**

1. Relire `CampaignDetail.tsx` et `InviteLinkPanel.tsx` sur `master` (tous
   deux retouchés par V3.1-10) et lister chaque geste existant ; **aucun ne
   disparaît**, chacun reçoit une place dans la carte, le panneau ou l'encart.
2. Regrouper côté client les données que `/api/campaigns/[id]` renvoie déjà
   (`members`, `characters`, `grants`, `displayNames`,
   `passwordResetRequests`) en une vue par personne. **Aucune route ni
   requête nouvelle** : si ce regroupement semble en demander une, s'arrêter
   et le dire. Le regroupement est une fonction pure, testée.
3. **Le tag** (ADR 0032) : `/api/campaigns/[id]` renvoie
   `handleTags: Record<userId, string>` quand l'appelant gère la campagne,
   rien sinon ; test d'intégration des deux cas (MJ reçoit, joueuse ne reçoit
   pas). Nouvelle migration qui remplace le commentaire de colonne
   `profiles.handle_tag` (l'ancienne, appliquée, ne se modifie pas).
4. Composants : `CampaignPersonCard` (une carte), le panneau Invitations
   (réorganisation de `InviteLinkPanel`, `InviteRow` gardé tel quel),
   l'encart PNJ. `CampaignDetail` les assemble.
5. Libellés : « Retirer de la campagne » / « Libérer le personnage » /
   « Partager une fiche » ; textes des `ConfirmDialog` relus pour dire chacun
   sa portée exacte.
6. Vérifier en navigateur sur la campagne réelle (La Croisade des Ombres),
   aux largeurs bureau et 375 px, dans les quatre modes de la charte.

**Critères**

- [x] La fenêtre suit la piste A de l'esquisse : Invitations en haut, MJ sur
  une ligne, une carte par compte joueur, personnages sans joueur en bas.
  Vérifié au banc, puis **chez l'auteur le 9 octobre** sur la vraie campagne.
- [x] Chaque geste de l'écran actuel existe encore, et un seul endroit le
  porte — liste de l'étape 1 :

  | Geste d'avant | Où il vit maintenant |
  |---|---|
  | Inviter par courriel | Panneau Invitations, même ligne que le lien : un courriel saisi change le bouton en « Inviter par courriel » (et le rôle choisi s'applique, là où l'ancien formulaire n'envoyait que « joueur ») |
  | Générer un lien (rôle, mot de passe) | Panneau Invitations |
  | Copier, mot de passe, réinitialiser le personnage, révoquer un lien | `InviteRow`, inchangé |
  | Forcer une réinitialisation | Menu ⋮ de la carte (ou de la ligne MJ) |
  | Révoquer un membre | « Retirer de la campagne », menu ⋮ de la carte, confirmé |
  | Attribuer un PJ à une joueuse | Sa carte : « Aucun personnage — attribuer un PJ » (un PNJ peut toujours devenir son PJ) |
  | Attribuer un personnage sans joueur, ou à un MJ | Encart « Personnages sans joueur » : « PNJ (sans joueur) » ou « MJ — … » |
  | Révoquer une fiche PJ | « Libérer le personnage », menu ⋮ du PJ, **désormais confirmé** |
  | Accorder l'édition d'une fiche | « + Partager une fiche », sur la carte : plus de second menu pour choisir la joueuse |
  | Retirer un octroi | × sur l'étiquette de la fiche |
  | Rappels « référence personnelle » | En tête du panneau Invitations |

- [x] « Révoquer » n'apparaît plus pour deux portées différentes : « Retirer
  de la campagne » et « Libérer le personnage » sont distincts, et chacun
  confirme en nommant la personne et ce qu'elle garde.
- [x] « Forcer une réinitialisation » n'est plus répété sur chaque ligne ; une
  demande en attente reste visible sur la carte (« mot de passe oublié »).
- [x] Partager une fiche se fait depuis la carte de la personne, sans choisir
  de joueur dans un second menu.
- [x] Chaque compte tag est nommé `Nom#0000` partout dans cet écran, y
  compris dans les confirmations ; deux comptes de même nom se distinguent.
- [x] Le tag n'est renvoyé par `/api/campaigns/[id]` qu'à qui gère la
  campagne — **codé** (`isWorldAdmin` dans la route), **pas de test
  d'intégration** : il ne tournerait pas sans base dans la session cloud. À
  vérifier en direct avec un compte joueuse (la réponse ne doit porter aucun
  `handleTags` rempli). **Vérifié le 9 octobre.**
- [x] Aucune nouvelle route ; une seule migration
  (`20261001120000_handle_tag_visible_to_gm.sql`), celle du commentaire de
  colonne. Le reste est de la présentation.
- [x] Lisible à 375 px de large ; les quatre modes et le contraste élevé
  testés (charte §6) — **à faire en direct** : la grille passe à une colonne
  sous 768 px, deux jusqu'à 1 280, trois au-delà.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

**Comment c'est construit.** Le regroupement par personne est une fonction
pure, `groupCampaignPeople` (`src/core/campaigns/people.ts`, tests d'abord) :
MJ, joueuses, et les personnages que personne ne tient — PNJ, PJ libérés, et un
personnage resté au nom d'un compte qui n'est plus membre, qu'on ne perd pas.
Le panneau Invitations est `InviteLinkPanel`, réorganisé : son champ courriel
n'apparaît que dans la Gestion de campagne (l'onglet Accès de l'accueil,
Administration, le monte sans).

**Vérifié au banc** (Chromium, vrai CSS, données des captures de l'auteur) :
les huit tags affichés, plus aucun « Révoquer » à l'écran, la confirmation
« Retirer Tamara#0377 de la campagne ? ».

**Écarts avec l'esquisse, voulus :**
- Les liens MJ déjà utilisés (« Claude, lien créé le 27 septembre ») restent
  dans le panneau Invitations sous « Liens MJ utilisés » plutôt que sur la ligne
  du MJ : c'est là que vivent leurs gestes (mot de passe, révocation).
- « Ouvrir la fiche » n'est pas dans le menu du PJ : l'écran ne connaît que
  l'identifiant et le nom des fiches, pas leur adresse. Ce n'était pas un geste
  de l'ancien écran.
- La RLS de `profiles` laisse encore lire `handle_tag` à tout compte qui
  partage un monde : c'est l'état laissé par V3.1-10. Le filtrage voulu par
  l'ADR 0032 est fait par la route, comme la règle absolue 5 le demande ; une
  restriction en base serait un autre ticket.

**Le tag, visible du MJ — tranché le 1ᵉʳ octobre (ADR 0032).** Deux comptes
peuvent porter le même nom ; c'est précisément ce que le tag à 4 chiffres de
V3.1-10 sert à distinguer. Il s'affiche donc **au MJ de la campagne, dans cet
écran**, après le nom : `Tamara#4821`. Ce choix amende V3.1-10 et l'ADR 0031,
qui le voulaient « invisible hors des réglages du compte concerné » ; il reste
invisible partout ailleurs (liste vue par une joueuse, attribution publique,
wiki). Trois conséquences :

- **Filtrage serveur** (règle absolue 5) : `/api/campaigns/[id]` ajoute les
  tags à sa réponse **seulement** si l'appelant gère la campagne (la garde qui
  alimente déjà `canManage`). Une joueuse qui ouvre la même route ne reçoit
  aucun tag — pas un champ envoyé puis masqué.
- **Partout où le MJ nomme une personne dans cet écran** — cartes, ligne des
  MJ, textes des `ConfirmDialog` (« Retirer Tamara#4821 de la campagne ? ») —
  le tag suit le nom, pour qu'aucun geste ne vise le mauvais compte.
- Un compte ordinaire (courriel, sans tag) affiche son nom seul.

C'est une petite entorse au « aucune route nouvelle » des critères : la
route existe, elle gagne un champ. `getDisplayNamesForUsers` (ou une
variante) lit `handle_tag` en plus de `display_name`.

**Hors périmètre, et dit comme tel** : les cinq liens joueurs réutilisables
se ressemblent tous (seule leur date les distingue). Un seul suffit sans
doute ; les révoquer est un geste du MJ, pas un changement d'écran (mais voir
le bug ci-dessous : avant le correctif du 1ᵉʳ octobre, ce geste expulsait). Les
nommer (« lien Discord », « lien table du jeudi ») serait une fonctionnalité
neuve, à rouvrir si le besoin se confirme.

**Complément du 1ᵉʳ octobre — retirer un second MJ.** Demande de l'auteur :
pouvoir éjecter un MJ de la partie depuis le ⋮ de sa ligne, sauf le créateur du
monde.
- Le ⋮ d'un MJ propose « Retirer de la campagne » **si ce n'est pas le
  créateur du monde** (`worlds.owner_id`). La règle tient dans
  `canRemoveFromCampaign` (`src/core/campaigns/people.ts`, tests d'abord) ;
  `/api/campaigns/[id]` renvoie `worldOwnerId` au seul MJ (même borne que les
  tags).
- La confirmation parle d'un MJ : « n'est plus MJ de cette campagne… Son lien
  MJ, déjà utilisé, ne resservira pas : pour le faire revenir, génère un
  nouveau lien MJ. »
- **Faille fermée en base** (migration `20261001130000`) :
  `app.revoke_campaign_member` vérifiait que l'appelant gère le monde, jamais
  qui était visé. Or tout MJ de campagne gère le monde : un second MJ pouvait
  expulser le créateur en appelant la route à la main. La fonction refuse
  maintenant toute cible qui est le créateur du monde.
- Un MJ invité au niveau du monde (`world_members`, lien MJ de monde) perd sa
  place dans la campagne mais garde ses droits sur le monde : c'est
  « Révoquer » sur son lien qui les retire.
- Test d'intégration ajouté (`campaigns.integration.test.ts`), sauté sans base.
- [x] Vérifié en direct le 9 octobre : le ⋮ de Gabriel (créateur) n'a pas « Retirer » ;
  celui d'un second MJ l'a, et le retrait le fait disparaître de « À la table ».

**Bug trouvé en jouant (1ᵉʳ octobre) — révoquer un lien joueur expulsait des
joueuses.** L'auteur a révoqué les liens joueur en double pour n'en garder
qu'un (celui du 2 septembre) : les joueuses ont disparu de « À la table » et
leur PJ est redevenu libre. L'écran promettait pourtant « Celles qui l'ont
déjà utilisé gardent leur accès ».
- **Cause** : `app.revoke_campaign_invite_access` (V2.1-25) retire l'accès de
  `claimed_by_user_id`. Les liens joueur sont réutilisables depuis V3.1-10 et
  n'écrivent plus ce champ — mais ceux créés **avant**, sous l'ancien régime à
  usage unique, le portaient encore. Révoquer l'un d'eux expulsait la joueuse
  qui l'avait utilisé en premier.
- **Correctif** (migration `20261001140000`) : un lien joueur révoqué cesse
  seulement de fonctionner ; personne n'est expulsé. Retirer quelqu'un, c'est
  « Retirer de la campagne » dans son ⋮. Un lien MJ garde l'ancien
  comportement (le révoquer retire son MJ — c'est ce qui a servi à retirer
  Claude).
- Les comptes, eux, n'ont jamais été touchés : identifiant, mot de passe et
  tag restent valides. Seules les lignes `campaign_members` ont disparu.
  Réintégration donnée à l'auteur : une requête qui recrée la ligne
  `campaign_members` (rôle `player`) pour chaque `claimed_by_user_id` des liens
  joueur révoqués, puis réattribution des PJ depuis « Personnages sans
  joueur » ou « Attribuer un PJ ».
- Test d'intégration ajouté (`campaignInvites.integration.test.ts`), sauté
  sans base.

**Retour en jouant (1ᵉʳ octobre) — le sélecteur « attribuer un PJ » se
chevauchait.** Dans une carte joueuse, la liste, « Attribuer » et « Fermer »
ne tenaient pas sur une ligne et se repliaient les uns sur les autres ; le
chevron de la liste passait sous son libellé (`triggerClassName` remplace le
style de base du `Dropdown`, `inline-flex` compris). Désormais : une petite
boîte, la liste sur toute la largeur, puis « Annuler » et « Attribuer » (ou
« Partager ») en bouton plein, alignés à droite. Pour le PJ, la boîte remplace
la case pointillée au lieu de s'empiler dessous. Vérifié au banc.

**Retour en jouant (1ᵉʳ octobre) — plus de « peut aussi modifier » sur la
ligne d'un MJ.** Un MJ modifie déjà tout le monde : afficher ses octrois
d'édition (« peut aussi modifier : Prologue ») ne disait rien d'utile. La
mention disparaît de la ligne des MJ ; les cartes joueuses la gardent. Les
octrois eux-mêmes restent en base (rien n'est supprimé) : ils resserviraient
tels quels si ce compte redevenait joueur.

---
### ☑ V3.1-16 — Le Calendrier réel refait : une grille à bascule, côté MJ comme côté joueuse · `M`/`L` · sans modèle IA — **fait, vérifié en direct le 9 octobre**

**Modèle conseillé : Sonnet** — interface d'après l'esquisse ; reste la vérification en direct.

Constaté le 1ᵉʳ octobre par l'auteur, captures à l'appui : le Calendrier réel
du MJ (`SchedulingMjPanel.tsx`) empile deux grilles hautes qu'il faut faire
défiler dans les deux sens, perd les heures dès qu'on défile vers la droite,
affiche « ? » au survol à la place de l'auteur, et liste les 31 jours même
quand personne n'est disponible. La vue joueuse (`NextSessionPanel.tsx`,
page `joueur/prochaine-session`) est « pas ouf » : trois onglets, la
prochaine séance cachée derrière l'un d'eux, et aucune vue de la table.

**L'esquisse fait foi, au pixel près pour la grille** — canevas
[Calendrier réel — esquisses](https://claude.ai/artifact/Lh9FKyKz4zF3LbMSBCcXe5),
interactif (bouton Play de chaque cadre) :

- **Vue MJ** : cadre « A — Retenue : une grille, bascule Mes dispos / Toute
  la table », fichier `Main.dc.html`.
- **Vue joueuse** : cadre « Vue joueuse — même écran, sans les outils MJ »,
  fichier `Joueuse.dc.html`.

Les cadres B, C et D (une grille avec panneau latéral, une semaine à la fois,
jours en lignes) ont été regardés et écartés ; ils restent sur le canevas.
Dans l'esquisse, les disponibilités de l'auteur (11, 24, 25 octobre 10:00–22:00,
31 octobre 10:00–18:30) et les séances listées sont réelles ; **celles des
joueuses sont inventées** pour que la carte de chaleur ait quelque chose à
montrer. Comme pour V3.1-15, l'esquisse fait foi pour la disposition et les
comportements ; le code fait foi pour les jetons (`--accent`, `--edge`,
`--panel-*`), `Dropdown`, `ConfirmDialog` et la charte.

#### La grille — commune aux deux vues

Un seul composant de grille remplace `AvailabilityPaintGrid.tsx` et
`AvailabilityHeatmap.tsx` à l'affichage (la logique de peinture et
d'enregistrement de `AvailabilityPaintGrid` est reprise, pas réécrite).

- **Bascule « Mes disponibilités / Toute la table »** (segments, comme dans
  l'esquisse), au-dessus de la grille. Une seule grille à l'écran, jamais deux
  empilées.
  - *Mes disponibilités* : on peint ses créneaux (clic, ou glisser pour
    cocher ou décocher une plage), case pleine en `--accent`. À côté de la
    bascule, le total coché (« 9,5 h cochées »).
  - *Toute la table* : carte de chaleur, fond `--accent` d'autant plus opaque
    qu'il y a de monde, et la légende « Moins → Toute la table » sous la grille.
- **Géométrie de l'esquisse** : colonnes de jour de 40 px, lignes d'une
  demi-heure de 20 px, en-tête de dates de 46 px (jour abrégé au-dessus, numéro
  en dessous), colonne des heures de 68 px avec un libellé par heure pleine.
  Trait vertical plus marqué entre dimanche et lundi ; samedi et dimanche
  légèrement teintés dans l'en-tête.
- **Toutes les heures visibles sans défilement vertical** : la grille prend sa
  hauteur entière (créneau proposé de 08:00 à 22:00 = 28 lignes ≈ 600 px).
  **Une ligne de clôture affiche la dernière heure** (« 22:00 », en accent)
  sous la dernière demi-heure : on voit où finit le créneau proposé. Seul le
  défilement horizontal subsiste, sur les jours.
- **La colonne des heures reste à gauche** quand on défile vers la droite
  (`position: sticky`), et la ligne des dates reste en haut.
- **Surbrillance en croix au survol** : la date dans l'en-tête et l'heure dans
  la colonne de gauche passent en fond accent atténué ; la ligne et la colonne
  de la case s'éclaircissent légèrement ; la case visée est entourée. Vrai dans
  les deux modes.
- **Info-bulle au survol en mode « Toute la table »** : jour en toutes lettres
  et demi-heure (« samedi 24 oct. · 16:00–16:30 »), le décompte (« 5/8
  disponibles »), puis les noms, **la personne qui regarde en tête avec
  « (toi) »**. L'info-bulle passe à gauche de la case près du bord droit.
- **Barre de défilement aux couleurs de l'application** : celle de
  `app/globals.css` (6 px, piste transparente, poignée `--edge`,
  `--edge-strong` au survol), et une marge sous la grille pour qu'elle ne
  couvre jamais la ligne « 22:00 ». Ces règles `::-webkit-scrollbar` ne
  touchent pas Firefox, qui garde la barre du système — limite connue de
  `globals.css`, hors de ce ticket.

#### Les dates possibles — commune aux deux vues

- **Seulement les jours où au moins une personne est disponible.** Les jours
  à « 0/8 — aucun créneau commun » disparaissent.
- Une ligne par jour, comme dans l'esquisse : rang, décompte en grand (« 5/8 »),
  date, meilleur créneau et sa durée (« 14:00–22:00 · 8 h »), étiquette
  « Session complète » ou « Moins de 5 h » (selon la durée visée), les noms des
  présents sur ce créneau, une barre de remplissage.
- **Changement de règle, voulu** : le « meilleur créneau » d'un jour est la plus
  longue plage où le **plus grand nombre** de personnes est disponible, et le
  classement trie par ce nombre, puis par la durée. Aujourd'hui
  (`computeOverlap`/`rankDays`, `src/core/scheduling/overlap.ts`) il faut un
  créneau commun à **toutes** les personnes ayant répondu ce jour-là : une
  seule joueuse dispo le matin seulement suffit à classer le jour « aucun
  créneau commun », alors que quatre autres pourraient jouer 5 h. Fonction
  pure dans `src/core/scheduling`, **tests d'abord**, avec ce cas-là.

#### Vue MJ (`Main.dc.html`)

De haut en bas : en-tête (titre de la demande, « Créneau proposé · N jours ·
X réponses sur Y », durée visée, « Annuler la demande ») → la grille à bascule
→ « Dates possibles » avec un bouton « Confirmer » par ligne (accent plein pour
une session complète) → trois cartes côte à côte : « Régler une date à la
main », « Séances à venir » (avec « Annuler »), « Déjà jouées ».

#### Vue joueuse (`Joueuse.dc.html`)

La même page **sans aucun outil MJ** : ni durée visée, ni « Annuler la
demande », ni « Confirmer », ni date à la main, ni « Annuler » sur les séances.
Elle remplace les trois onglets actuels par une seule page :

1. **La prochaine séance confirmée, en tête et en grand** (carte avec la date
   en pavé, « Dimanche 18 octobre · 16:00 », « environ 6 h · dans 17 jours »).
2. **La demande ouverte** : titre, une phrase qui dit ce que le MJ propose
   (« du 1ᵉʳ au 31 octobre, entre 08:00 et 22:00 — coche tout ce qui t'irait »),
   l'état de sa réponse (« Réponse enregistrée »), puis la grille à bascule —
   **« Toute la table » compris**.
3. **« Les dates qui se dessinent »** : le même classement, en lecture seule,
   avec « c'est le MJ qui choisit ».
4. « Séances à venir » et « Déjà jouées », côte à côte, en lecture seule.

Sans demande ouverte, la section 2 se réduit à une ligne (« Aucune demande de
disponibilités pour le moment ») et la 3 disparaît.

**La joueuse voit la table : aucun droit nouveau.** La RLS de
`real_session_availabilities` ouvre déjà la lecture à tout membre du monde
(« rien ici n'est sensible entre coéquipières », migration
`20260913140000_real_scheduling.sql`). La route
`/api/campaigns/[id]/scheduling/requests/open`, qui renvoie la carte de chaleur
et le classement, ne vérifie que l'authentification : elle sert déjà à une
joueuse, il suffit que sa page l'appelle. Les champs propres au MJ (durée visée)
peuvent rester dans la réponse : ils ne sont pas secrets, seulement inutiles.

#### Deux bugs relevés en lisant le code — corrigés par ce ticket

1. **Le « ? » à la place de l'auteur.** `resolveNamesIncludingGm`
   (`src/server/services/scheduling.ts`) ne nomme que **le premier** MJ trouvé
   (`members.find(m => m.role === "gm")`). Avec deux MJ (Claude et Gabriel),
   l'autre reste sans nom, rendu « ? » par `AvailabilityHeatmap`. Tous les MJ
   sont nommés.
2. **Le « /8 ».** `totalMembers` compte tous les membres de la campagne : les
   deux MJ et le doublon « Tamara ». Le dénominateur devient **les personnes
   attendues à la table** : les joueuses et le MJ qui a ouvert la demande — pas
   un second MJ qui ne répond pas.

#### Points tranchés par l'esquisse, à respecter

- **Les noms affichés sont ceux des personnes**, pas de leurs PJ : l'info-bulle
  et les dates possibles disent « Soso », pas « Fine Lââm ». Aujourd'hui
  `resolvePlayerNames` renvoie le nom du PJ. Lire `display_name` (et le tag de
  V3.1-15 si deux comptes portent le même nom, côté MJ seulement — ADR 0032).
- **Enregistrement côté joueuse** : l'esquisse montre un bouton « Enregistrer
  mes disponibilités ». Aujourd'hui `AvailabilityPaintGrid` enregistre seule, à
  chaque relâchement de la souris. **On garde l'enregistrement automatique** (un
  bouton oublié perd une réponse) et le bouton de l'esquisse devient une ligne
  d'état à la même place : « Enregistrement… » puis « Enregistré ✓ », et l'erreur
  en `--danger` si l'écriture échoue. À rouvrir si l'auteur préfère le bouton.
- Côté MJ, la grille « Mes disponibilités » remplace la grille de peinture
  actuelle : le MJ répond comme une joueuse.

**Étapes**

1. Noyau (`src/core/scheduling`), **tests d'abord** : meilleur créneau d'un jour
   (plus grand nombre, puis plus longue plage), classement, filtrage des jours
   vides, total coché.
2. Serveur : nommer tous les MJ, dénominateur « attendus à la table », noms de
   personnes au lieu des PJ. Tests d'intégration sur deux MJ.
3. Composant de grille unique (bascule, sticky, croix, info-bulle, ligne
   22:00, barre de défilement), monté par les deux vues.
4. `SchedulingMjPanel` réorganisé selon `Main.dc.html`.
5. `NextSessionPanel` réécrit selon `Joueuse.dc.html` (fin des trois onglets).
6. Vérifier en navigateur, avec un compte MJ et un compte joueuse, sur la
   campagne réelle : bureau et 375 px, les quatre modes, le contraste élevé.

**Critères**

- [x] Vue MJ et vue joueuse conformes à `Main.dc.html` et `Joueuse.dc.html`,
  comparées côte à côte avec l'esquisse. **Fait chez l'auteur le 9 octobre**, sur la
  campagne réelle, avec un compte MJ et un compte joueuse.
- [x] Une seule grille par vue, avec la bascule « Mes disponibilités / Toute la
  table » (`AvailabilityGrid.tsx`, monté par `SchedulingMjPanel` et
  `NextSessionPanel` ; `AvailabilityPaintGrid` et `AvailabilityHeatmap`
  supprimés).
- [x] De 08:00 à 22:00, toutes les heures sont visibles sans défilement
  vertical, la ligne « 22:00 » comprise, et la barre de défilement ne la
  couvre pas.
- [x] Les heures restent visibles en défilant vers la droite. *La ligne des
  dates n'a plus besoin de rester en haut : la grille n'a plus de défilement
  vertical.* La colonne des heures a un fond opaque (le panneau posé sur le fond
  de page) : `--panel` est translucide, et les cases défilant dessous
  transparaissaient.
- [x] Au survol, la date et l'heure de la case s'allument, sa ligne et sa
  colonne s'éclaircissent (ombre intérieure, visible aussi sur une case vide) ;
  en « Toute la table », l'info-bulle donne les noms, le sien en tête avec
  « (toi) », et **jamais « ? »** : tous les MJ sont nommés.
- [x] Les dates possibles ne listent que les jours où quelqu'un est disponible,
  classées par nombre de présents puis par durée (`bestWindow.ts`, tests
  d'abord : le cas « une joueuse le matin ne casse plus la journée », et deux
  groupes contigus de même taille jamais fusionnés).
- [x] La vue joueuse ne montre aucun outil MJ, met la prochaine séance en tête,
  et laisse voir la table. Page élargie (`max-w-lg` → `max-w-5xl`).
- [x] La barre de défilement reprend le style de `app/globals.css` (rien à
  écrire : la règle globale s'applique).
- [x] Sans demande en cours, le MJ voit la prochaine séance et un écran vide
  avec « Demander les disponibilités » ; le formulaire s'ouvre au clic, avec
  l'aperçu en direct de la grille (`SansDemande.dc.html`, `Formulaire.dc.html`).
- [x] La grille suit la forme de la demande : colonnes élargies jusqu'à 140 px
  quand il y a peu de dates, mois dans l'en-tête (`EnCours.dc.html`).
- [x] `npm run typecheck && npm run lint && npm run test` passent.

#### Avant et après la demande — ajouté le 1ᵉʳ octobre

Le ticket ne disait rien de l'écran **sans demande en cours**, ni du
**formulaire** qui en ouvre une. L'auteur a demandé à les voir, et à vérifier
que la grille s'adapte à une demande d'une autre forme. Trois cadres ajoutés au
même canevas, rangée « Avant et après la demande », retenus tels quels
(« Allons comme ça ») :

- **`SansDemande.dc.html` — MJ sans demande en cours** : la prochaine séance
  confirmée en tête (la même carte que chez la joueuse, `NextSessionCard`), un
  panneau vide « Aucune demande de disponibilités en cours » avec une phrase
  d'explication et le bouton « Demander les disponibilités », puis les trois
  cartes du bas. Le formulaire ne s'affiche plus d'office : il s'ouvre au clic.
- **`Formulaire.dc.html` — formuler une demande** : trois étapes numérotées
  (nom, dates, plage horaire) et, dessous, **l'aperçu en direct de la grille
  que verront les joueuses** (`AvailabilityGrid` en mode `preview` : ni
  bascule, ni peinture, ni enregistrement). « Annuler » revient à l'écran vide,
  « Envoyer la demande » crée la ronde, comme le « Créer » d'avant.
- **`EnCours.dc.html` — une autre demande** : week-ends de 19:00 à 23:00 sur
  deux mois, pour montrer l'adaptation.

**La grille s'adapte à la demande — c'était déjà vrai, deux choses ajoutées.**
Ses colonnes sont les dates proposées (et elles seules, même non contiguës), ses
lignes la plage horaire par demi-heure, sa ligne de clôture l'heure de fin. Le
curseur va de 00:00 à 24:00 : une demande ne passe jamais minuit. Ajouté :

- **Colonnes élargies quand il y a peu de dates** : la largeur se mesure
  (`ResizeObserver`) et se répartit, entre 40 et 140 px. Huit dates en font
  122 ; trente et une restent à 40, avec défilement.
- **Le mois dans l'en-tête**, au premier jour puis à chaque changement
  (« oct. », « nov. ») : une demande à cheval sur deux mois ne disait pas à quel
  mois appartenait le « 1 ». L'en-tête passe de 46 à 58 px.

**Le formulaire, ce qui change et ce qui reste.**
- Deux mois côte à côte au lieu d'un, flèches pour avancer ; clic et
  clic-glissé comme avant. **Les jours passés ne se choisissent plus** (ils
  restent visibles) : une date candidate passée n'a jamais de sens.
- L'onglet « Jours de la semaine » **garde son fonctionnement** (jours cochés,
  « Du … au … », « Appliquer ») : l'esquisse le simplifiait sur deux mois fixes,
  ce qui aurait perdu la plage libre. Seul le style change.
- Le curseur horaire (`TimeRangeSlider`) se glisse toujours, et gagne des
  boutons − / + d'une demi-heure de chaque côté et une échelle 00:00 → 24:00.
- Même envoi au serveur qu'avant : aucune route ni donnée touchée.

**Vérifié au banc** (même méthode que plus bas) : 8 dates de week-end sur deux
mois → colonnes de 122 px, « oct. » et « nov. » dans l'en-tête ; dans le
formulaire, cinq dates cliquées → l'aperçu en compte cinq, et « Finir plus
tard » ajoute une ligne (40 → 45 cases).

#### Bug trouvé en jouant — corrigé le 1ᵉʳ octobre

**Constat (auteur)** : régler une date à la main pendant la demande d'octobre
a fermé la demande, et les disponibilités cochées ont disparu de l'écran.

**Cause** : `createRealSession` fermait la demande ouverte à **chaque** séance
confirmée, manuelle comprise (comportement de V3.1-8, étape 6, pensé pour le
seul bouton « Confirmer » des dates possibles). **Rien n'était effacé** :
fermer une demande ne fait que passer `availability_requests.status` à
`closed`, et les réponses restent en base, rattachées à elle
(`real_session_availabilities.request_id`).

**Correction** : seule une séance confirmée **depuis les disponibilités**
(`source: "availability"`) ferme la demande ; une date réglée à la main
(`source: "manual"`) est indépendante et la laisse ouverte. Test
`scheduling.createRealSession.test.ts`, écrit avant la correction et vu
échouer dessus.

**Récupérer la demande fermée par erreur** : la rouvrir suffit, les réponses
reviennent avec elle. À faire à la main dans l'éditeur SQL de Supabase (aucun
écran ne rouvre une demande aujourd'hui).

**Ce qui a été vérifié, et comment.** Sans base dans la session cloud, la grille
a été montée seule dans Chromium (Playwright), alimentée par une demande
d'octobre et des réponses de test : réponse existante relue (44,5 h cochées),
colonne des heures immobile à 600 px de défilement, info-bulle « 3/6 disponibles
· Gabriel (toi) · Soso · Leïla », classement des dates, et un glisser sur quatre
cases qui enregistre **une seule plage** `10:00–12:00` — la forme d'avant. Les
routes, la RLS et les deux écrans complets n'ont pas tourné : c'est la
vérification en direct qui reste.

**Les réponses déjà déposées pour octobre ne bougent pas** (demande de l'auteur
pendant le codage) : aucune migration, aucune écriture nouvelle. Une réponse
reste « une plage par jour et par personne » ; seuls le calcul du classement et
l'affichage changent.

**Décisions prises en codant :**
- Noms : **la personne seulement** (`profiles.display_name`), tranché par
  l'auteur le 1ᵉʳ octobre — l'ancien commentaire « les comptes s'identifient par
  leur personnage partout » ne vaut plus pour cet écran. `resolvePlayerNames`
  (nom du PJ) reste inchangé pour le Livre de sessions. Le tag de V3.1-15 n'est
  pas ajouté ici : il vient avec V3.1-15.
- Dénominateur : les joueuses, le MJ qui a ouvert la demande, et tout autre
  membre qui a répondu (`expectedAtTable`). Le doublon « Tamara » compte encore,
  c'est un vrai membre : V3.1-15 permettra de le retirer.
- Enregistrement : automatique au relâchement, comme avant, avec une ligne
  d'état « Enregistrement… / Enregistré ✓ » à côté de la bascule.
- `computeOverlap`/`rankDays` supprimés avec leurs tests : plus aucun appelant.
- Pas de test d'intégration sur deux MJ : il ne tournerait pas sans base. La
  règle du dénominateur est testée dans le noyau ; les noms viennent d'une seule
  requête groupée sur `profiles`.

---
### ☑ V3.1-21 — Cibler et résoudre depuis les boutons de jet · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0042, 0041) → V3.1-105, 106, 107**

**Modèle conseillé : Opus** — résolution partagée par MJ, joueur et solo ; dés lancés par le serveur (règle 8).

**4 octobre — ADR 0036 §6** : cœur commun extrait de `playTurn` ; l'initiative en cours, c'est `combats` et ses participants ; un jet secret qui touche reste secret mais s'applique. L'outil de dés (V3.1-33) livre « Cibler » grisé, ce ticket l'allume.

**Constat.** Les boutons de jet de la fiche (touche, dégâts, sorts, soins)
lancent un dé et l'affichent ; c'est ensuite à la table de calculer et de
reporter le résultat à la main sur la cible. Le mode solo, lui, sait déjà
viser une cible du combat en cours, lire sa CA et établir le verdict
(V3-B1), puis appliquer les effets (V3-B2).

**Décision de l'auteur.** Partout dans l'application (desktop, tablette,
téléphone ; fiche, outil Table, outil Initiative) : **quand une initiative
est lancée**, un bouton de jet demande d'abord une **cible parmi les
participants**, puis tout se résout et s'applique seul — jet de touche
contre la CA, jet de sauvegarde de la cible contre le DD, dégâts (dés doublés
au critique, PV temporaires d'abord), états posés, soins, emplacement dépensé,
PJ à 0 PV → jets contre la mort, créature à 0 PV → sortie de l'initiative.
Sans initiative, rien ne change : le jet s'affiche, sans cible.

Esquissé : fiche complète (bouton « Voir hors combat / en combat ») et outil
Table (au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS de Force,
À terre).

**Revu le 4 octobre : tout passe par l'outil de dés (ADR 0035).** Un bouton de jet de la
fiche (touche, dégâts, sort, soin, caractéristique, sauvegarde, compétence,
initiative) **ouvre l'outil de dés pré-rempli** (dés, modificateur, libellé)
au lieu de lancer ; on peut encore ajouter un dé, l'avantage ou le secret, puis
on **confirme par « Lancer »**. L'outil gagne un bouton **« Cibler »** sur la
ligne de « Lancer » et « Effacer » : il liste les participants de
l'initiative (alliés pour un soin), affiche la cible retenue, et se grise hors
initiative ou pour un jet sans cible (test, sauvegarde). Une touche réussie
fait apparaître la bande « Lancer les dégâts » (V3.1-33 ; dés doublés au critique), même cible
conservée. Partout : MJ, joueur, **solo** (la barre d'intention de V3-B1 y
pré-remplit l'outil de la même façon). Avis : bonne idée — un seul endroit
pour l'avantage, le modificateur, le secret et la cible ; le coût est un
toucher de plus par jet, compensé par le pré-remplissage.

**Contraintes (règles absolues).** Les dés sont lancés par le serveur et la
résolution passe par le moteur (`resolveAttackRoll`, `resolveDamageRoll`,
`eventsForAttack`…) : le client ne calcule rien. Chaque étape est journalisée
comme en solo ; « Annuler » est une écriture inverse journalisée, pas un
effacement. L'autorisation passe par `canEditEntity` (un joueur cible avec
son PJ, le MJ avec n'importe quel participant).

**À trancher avant de coder.**
- Réutiliser telle quelle la résolution du tour solo (`playTurn`) ou en
  extraire le cœur commun — probablement la seconde : le solo ajoute
  l'interprétation et la narration, que la table n'a pas.
- Où vit « l'initiative en cours » côté multijoueur : la table `combats`
  (participants, CA) existe ; vérifier qu'elle suffit pour les PNJ sans fiche.
- Ce qui est montré au joueur ciblé et aux autres (visibilité côté serveur).

**Critères d'acceptation**
- [ ] Initiative lancée : tout bouton de jet offensif ou de soin demande une cible parmi les participants.
- [ ] Touche, sauvegarde, dégâts, états et soins résolus par le moteur et appliqués, journalisés.
- [ ] Même comportement depuis la fiche, l'outil Table et l'outil Initiative, sur tous les écrans.
- [ ] Sans initiative, les jets restent de simples jets.
- [ ] « Annuler » revient en arrière par une écriture journalisée.

---
### ☑ V3.1-23 — Ce que les joueurs modifient eux-mêmes (Règles actives) · `M` · sans modèle IA — **conçu le 9 octobre (ADR 0043) → V3.1-108, 109 (écran : 57)**

**Modèle conseillé : Opus** — droits d'écriture des joueurs, appliqués côté serveur ; schéma à vérifier.

**4 octobre — ADR 0036 §5, accepté par l'auteur** : colonne `table_settings jsonb` sur `campaigns`, validée par `zCampaignTableSettings`, qui porte aussi le maximum d'inspiration (1 par défaut, réglé dans Règles actives). Migration et mise à jour de `docs/SCHEMA.md` dans ce ticket.

**Constat.** Un joueur peut aujourd'hui toucher à tout ce que sa fiche affiche
en commande. À la table, certaines valeurs sont la prérogative du MJ — les
états (Charmé, À terre…) surtout, et l'inspiration — d'autres sont plus
pratiques tenues par le joueur (PV, pièces, emplacements, dés de vie).

**Décision de l'auteur.** Dans l'outil MJ **Règles actives**, une section
« **Ce que les joueurs modifient eux-mêmes** » : un interrupteur par valeur —
leurs **états**, leur **inspiration**, leurs **PV**, leurs **pièces**, leurs
**emplacements de sorts**, leurs **dés de vie**. Réglage de la campagne, valable
**partout dans l'application** : fiche sur ordinateur, tablette et téléphone,
fenêtres du MJ, tout écran où le joueur voit sa fiche.

- Par défaut : états et inspiration au MJ seul ; PV, pièces, emplacements et
  dés de vie au joueur.
- Interrupteur coupé : le joueur voit la valeur, sans commande (pas de
  « + état », pas de ▲▼ sur l'inspiration) ; le MJ la change depuis la fiche
  ou l'outil Table.
- Interrupteur allumé : le joueur la change sur sa fiche ; chaque changement
  est journalisé.
- Les changements faits par le moteur (dégâts résolus par V3.1-21, repos) ne
  dépendent pas de ces réglages.

Esquissé : planche « Téléphone du MJ — feuilles ouvertes », écran Outils →
Règles actives ; planche « Décidé · fiche vue par le MJ et par le joueur »
(zone « Fiche de personnage ») : les six interrupteurs, vivants, pilotent la
fiche de la joueuse — coupé, la commande disparaît (« + état », ▲▼ de
l'inspiration, des PV, des pièces ; colonnes « niv. » de l'égaliseur
inertes ; « Dépenser un dé » du repos court remplacé par « Le MJ dépense
tes dés de vie »).

**À vérifier avant de coder** (règles de méthode) : où vit ce réglage
(table ou colonne de campagne) et si `docs/SCHEMA.md` le prévoit — sinon
s'arrêter et demander. L'autorisation passe par le serveur (`canEditEntity`
étendu, ou une vérification à côté) : un interrupteur coupé refuse
l'écriture côté serveur, pas seulement l'affichage du bouton.

**Critères d'acceptation**
- [ ] Six interrupteurs dans Règles actives, réglage de campagne, valeurs par défaut ci-dessus.
- [ ] Interrupteur coupé : aucune commande côté joueur, et l'écriture est refusée par le serveur.
- [ ] Même comportement sur ordinateur, tablette et téléphone.
- [ ] Le MJ garde toutes les commandes, quels que soient les réglages.

---
### ☑ V3.1-24 — Les services de jeu sous la refonte · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet** — décisions toutes prises dans l'ADR 0036 ; noyau pur, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

Fondation des tickets 32, 33 et 34. Aucune interface.

**À faire**
1. `src/core/rules/deathSaves.ts` (tests d'abord) : les règles 2024 de
   l'ADR 0036 §8 — Inconscient à 0 PV, mort directe si les dégâts restants
   atteignent les PV max, un échec par coup à 0 PV (deux au critique), jet
   (10+ réussit, 1 = deux échecs, 20 = 1 PV), trois réussites stabilisé,
   trois échecs mort, tout soin remet à zéro et retire Inconscient.
   `changeHp` et les dégâts résolus l'appliquent.
2. Concentration (ADR 0036 §3) : champ `concentration` dans `zRuntimeState`
   (`.default(null)`, test de relecture d'une ligne ancienne comme pour
   `inspiration`) ; `castSpell` la pose pour un sort de concentration et
   remplace la précédente ; service `breakConcentration` ; synchronisation
   avec `combat_participants.concentration` comme les états ; l'état
   `concentrating` des déclencheurs est dérivé de ce champ.
3. Monnaie et équipement (ADR 0036 §1) : services `changeCurrency`
   (delta par pièce, `depositCoins` / `spendCoins`, refus si le total ne
   suffit pas) et `setItemEquipped`. **Électrum exclu du regroupement**
   (décision du 4 octobre) : `recompose` ne forme jamais de pe ; l'électrum
   déjà détenu reste tel quel et ne se casse que si le reste ne suffit pas
   — tests d’abord dans `currency.test.ts`. Écriture du bloc `inventory` avec
   contrôle de version ; routes Zod. `InventoryPanel` les utilise à la place
   du renvoi du bloc entier.
4. Repos (ADR 0036 §7) : `takeShortRest` / `takeLongRest` émettent
   `short_rest` / `long_rest` dans `runTriggers` après leurs effets de base.
   **Fait le 9 octobre avec V3.1-5 (ADR 0050).** Reste le test d'intégration
   du critère ci-dessous.
5. **PV temporaires** (vérifié le 4 octobre) : ils sont stockés (`hp.temp`,
   `combat_participants.temp_hp`) et le tour solo les entame d'abord
   (`applyDamage`, `src/core/rules/turn.ts`), mais `changeHp` (fiche) les
   ignore et aucune commande ne permet d'en donner. `changeHp` négatif passe
   par la même règle que `applyDamage` ; nouveau service `changeTempHp`
   (les PV temporaires ne se cumulent pas : en 2024, on choisit de garder
   les anciens ou de prendre les nouveaux — l'interface propose le plus
   grand par défaut).

**Critères d'acceptation**
- [x] Les cas de jets contre la mort ci-dessus, chacun un test du noyau.
- [x] Une fiche enregistrée avant ce ticket se relit sans `concentration` (test).
- [x] Dépenser 3 po avec 1 pp et 0 po rend la monnaie ; dépenser plus que le total est refusé sans rien écrire.
- [x] Ajouter 5 pa à 0 pa ne forme pas d'électrum ; 2 pe détenues restent 2 pe après un dépôt.
- [x] Un repos long émet `long_rest` (test d'intégration avec un déclencheur factice).
- [x] −7 PV sur 15/15 avec 5 temporaires laisse 13/15 et 0 temporaire (test).
- [x] Aucune migration SQL.

**Note de clôture (13 octobre, `dev-sonnet`, relu et corrigé par Opus).**

*Noyau, tests écrits d'abord :*
- `deathSaves.ts` : jets contre la mort, règles 2024 ;
- `tempHp.ts` : entame des PV temporaires d'abord, et non-cumul (garder, remplacer, ou le plus grand par défaut) ;
- `concentration.ts` : le point unique de rupture ;
- `currency.ts` : `applyCurrencyDelta`, électrum hors du regroupement.

*Services :*
- `changeHp` suit les règles de la mort ; il ne lit les PV max que si le coup atteint 0.
- `changeTempHp`.
- `setConcentration`, seul chemin pour changer une concentration, appelé par `castSpell` et `breakConcentration`. Il rend `broken`, où V3.1-130 se branchera.
- `changeCurrency` et `setItemEquipped`, dans un fichier à part, `inventoryActions.ts`.
- Les repos soignent par `applyHealing`.
- `concentrating` est dérivé dans `buildActorState`, jamais stocké.

*Routes* `actions/temp-hp`, `actions/currency`, `actions/equip` : toutes par `guardSheetActionRoute`. Entrée Zod stricte, droit d'édition, même monde, interrupteur de table (`hp`, `currency` ; aucun pour l'équipement). Aucune migration.

*Corrigé par Opus à la relecture :*
- Un soin ne ramène plus un mort. Le repos long, qui soigne aussi, l'aurait relevé ; il faut une magie de résurrection. Un test l'établit.
- `InventoryPanel` affichait rien si le réseau coupait : l'erreur est maintenant capturée et montrée.

*Vérifié en direct (Opus, Testeur B) :*
- `POST actions/currency` 200 en dépôt et en retrait ;
- `POST actions/equip` 200, aller et retour (l'amulette remise comme avant).

À savoir : un dépôt **regroupe** les pièces. Les 15 po de Testeur B sont devenues 1 pp 5 po, de même valeur. C'est la règle de `depositCoins`, mais elle s'applique aussi quand on saisit une valeur dans un champ de pièce.

*Restent hors de ce ticket, pour les tickets d'interface (32 à 34) :*
- aucune route pour `breakConcentration` ni pour un jet contre la mort ;
- la synchronisation fiche → participant d'initiative : seul le MJ écrit les participants (RLS), et elle ne va donc que dans le sens participant → fiche, comme les états.
- Le libellé de concentration est le nom source de la règle (anglais possible), faute de traduction sans requête de plus.
- Le mode serveur de l'inventaire ne vaut que dans l'onglet Inventaire de la fiche. Ajouts, quantités et suppressions d'objets renvoient encore le bloc entier.

---
### ☑ V3.1-37 — L'initiative vue des joueurs : sécurité, invitation, temps réel · `M` · sans modèle IA — **conçu le 9 octobre (ADR 0040) → V3.1-101, 102, 103**

**Modèle conseillé : Opus** — RLS à resserrer, nouvelle vue filtrée pour les joueurs, signal temps réel.

**Constat (lu le 4 octobre, `20260818120001_combats.sql`).** Les politiques
de `combats` et `combat_participants` sont restées celles de la « Phase 0 » :
**tout membre du monde lit et écrit** les deux tables. Un joueur peut donc
déjà, par l'API, lire les PV et la CA des adversaires ou modifier un combat
— la règle absolue 5 n'est tenue que parce qu'aucun écran joueur ne les
affiche. À corriger avant tout écran joueur.

**À faire**
1. **RLS** (nouvelle migration) : écriture réservée au MJ de la campagne sur
   les deux tables ; lecture de `combat_participants` réservée au MJ. La
   ligne `combats` (statut, round, tour) reste lisible des membres : elle
   ne porte rien de secret et sert de signal.
2. **Vue joueur** côté serveur (`GET`, Zod) : l'ordre, le tour, le round ;
   pour chaque participant, son nom **affiché** (le renommage est le
   `label`, le nom d'origine se lit de `rule_key` ou de l'entité et ne sort
   que pour le MJ) ; PV pour les alliés, **état de blessure** calculé côté
   serveur pour les adversaires (Indemne ≥ max, Blessé > ½, En sang > 0,
   Hors de combat 0) ; jamais de CA adverse.
3. **Invitation et jets** : statut « jets d'initiative » entre préparation et
   round 1 ; un joueur dont le PJ combat lance son initiative (serveur) ou
   saisit un vrai dé, avec ou sans modificateur (même principe que
   « annoncé à la main », V3-B5) ; le MJ peut saisir à sa place ; le combat
   terminé (confirmé par le MJ) ramène la fiche normale.
4. **Temps réel** : un signal sans donnée sensible (changement de la ligne
   `combats`, ou canal de diffusion) ; le client du joueur relit la vue
   filtrée. Reprendre le mécanisme déjà utilisé par le chat
   (`ChatPanel.tsx`).
5. Vérifier `docs/SCHEMA.md` : si le statut « jets d'initiative » demande
   une valeur de plus dans le `check` de `combats.status`, c'est un
   changement de schéma — le mettre à jour dans le même ticket.

**Critères d'acceptation**
- [ ] Test d'intégration RLS : un joueur ne lit aucune ligne de `combat_participants` et n'écrit ni `combats` ni `combat_participants`.
- [ ] La vue joueur ne contient ni PV ni CA ni nom d'origine d'un adversaire (test).
- [ ] Invitation, jet du joueur, saisie du MJ, fin confirmée : chacun journalisé.

---
### ☑ V3.1-39 — Les sauvegardes demandées à la cible · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0044) → V3.1-110, 111, 112**

**Modèle conseillé : Opus** — nouveau flux joueur ↔ MJ, et une donnée de règle à ajouter aux effets.

**Demande (4 octobre).** Un sort comme Moquerie cruelle ne se « lance »
pas sur la cible : c'est **la cible qui résiste** par un jet de sauvegarde.
Quand une action impose une sauvegarde, la cible reçoit une demande au
premier plan — « Résiste à Moquerie cruelle · JS Sagesse DD 13 » — avec,
comme pour l'initiative : lancer via l'application, saisir un vrai dé
(interrupteur « modificateur inclus »), ou laisser le MJ saisir la valeur.
Le résultat revient à l'outil de dés de l'auteur, qui affiche le verdict et
enchaîne les dégâts ou l'effet.

**Où le MJ répond.** En combat : dans l'outil Initiative (la demande s'y
affiche en bandeau). Hors combat : dans l'outil **Table**, qui liste déjà
les PJ — c'est la bonne place (avis : d'accord) ; une pastille sur le dé
encoché signale une demande en attente, où qu'on soit. Un PNJ ou un
monstre ciblé : le MJ lance ou saisit, comme pour l'initiative.

**Les règles exactes.** Le moteur doit vérifier la cible avant de demander
quoi que ce soit : Charme-personne ne vise qu'un humanoïde, certains effets
ignorent les créatures immunisées à un état. **Constat (lu le 4 octobre)** :
un effet (`zEffectData`, `src/core/schemas/rule-blocks/blocks.ts`) porte sa
sauvegarde (`save.ability`) ou son attaque, mais **aucune restriction de
cible** ; les types de créature existent sur les blocs de stats et les
espèces. À ajouter : un champ optionnel de restriction (types de créature,
immunités d'état), validé par Zod — pas de migration SQL (`jsonb`), mais
les fiches SRD concernées devront le recevoir. Aucun ticket existant ne le
couvre ; il complète V3.1-21 (résolution) et V3-A6 (règles à
déclencheurs).

**Dépend de** : V3.1-21, V3.1-37 (signal temps réel), V3.1-34 (Table).

**Critères d'acceptation**
- [ ] Une sauvegarde imposée à un PJ arrive à son joueur ; lancer, vrai dé ou saisie du MJ y répondent.
- [ ] Le résultat revient à l'auteur du jet ; verdict, puis dégâts ou effet appliqués.
- [ ] Une cible hors restriction (Charme-personne sur un mort-vivant) est refusée avant toute demande (test du noyau).
- [ ] Hors combat, la demande s'affiche dans l'outil Table ; en combat, dans l'Initiative.

---
### ☑ V3.1-40 — Ressources de classe : magie de pacte et recharge partielle · `M` · sans modèle IA — **conçu le 9 octobre (ADR 0045) → V3.1-113, 114**

**Modèle conseillé : Opus** — deux formes de données que le moteur ne connaît pas encore.

**Constat (lu le 5 octobre).** Les ressources de classe sont génériques
(`src/core/schemas/blocks/resources.ts` : maximum en formule, recharge
`short_rest` / `long_rest` / `dawn` / `never`) et les emplacements de sorts
se dérivent de la progression de la classe (`spellcasting.ts`). Deux règles
2024 n'y entrent pas :
- **la magie de pacte** de l'occultiste : des emplacements tous du même
  niveau (5 au niveau 20), rendus au repos court, distincts des
  emplacements ordinaires (un multiclassé a les deux) ; l'Arcanum mystique
  (un sort précis par niveau 6 à 9, une fois par repos long) ;
- **la recharge partielle** : Rage, Conduit divin, Forme sauvage, Second
  souffle rendent **une** utilisation au repos court et toutes au repos long.

**À faire** : une valeur de recharge de plus (une au repos court), une
source d'incantation « pacte » dans `spellcasting`, les repos (V3.1-24) qui
les appliquent, et la ligne d'égaliseur (planche « Décidé · emplacements et
ressources de classe ») qui les affiche. Validé par Zod, sans migration SQL
(`jsonb`). Les libellés français des ressources (points de focalisation,
Ruse magique…) sont à vérifier dans le manuel de l'auteur.

**Critères d'acceptation**
- [ ] Un occultiste 20 a 4 emplacements de pacte de niveau 5, rendus au repos court ; un multiclassé garde les deux réserves séparées.
- [ ] Un repos court rend une Rage, un repos long toutes (test du noyau).
- [ ] Une ressource de plus de six utilisations s'affiche en compteur.

---
### ☑ V3.1-41 — Bloc-notes : la page partagée devient une entité (données) · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Opus** — migration, RLS et octrois d'écriture ; principe déjà tranché.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision** : ADR 0037 (`docs/adr/0037-une-page-partagee-devient-une-entite.md`,
accepté le 5 octobre). Une page du cahier marquée « La table » devient sa
propre **entité** (genre `shared_note`, visibilité de la table), son
autrice reçoit l'octroi d'écriture (`entity_grants`, que le MJ peut
reprendre), et le cahier garde un lien vers elle. Modèle : le Livre de
sessions (`session_journal`).

**À faire**
1. Relire l'ADR 0037 et `docs/SCHEMA.md` ; la migration ajoute ce que l'ADR
   demande (nouvelle migration, aucune migration appliquée modifiée) ;
   `docs/SCHEMA.md` à jour dans le même commit.
2. Services : `shareNotebookPage(pageId)` (crée l'entité, l'octroi, le lien ;
   idempotent) et `unshareNotebookPage(pageId)` (retire la visibilité de la
   table ; l'entité n'est plus lue que par l'autrice ; aucune donnée perdue).
   Routes Zod.
3. Lecture : « Partagées à la table » = les entités `shared_note` visibles
   du lecteur, avec le nom de l'autrice. Un nom cité que le lecteur n'a pas
   découvert s'affiche **sans lien** — filtré côté serveur (règle 5).
4. Ces entités **ne rejoignent pas** les listes du wiki (arborescence,
   recherche, sommaire public), comme `session_journal`.

**Critères d'acceptation**
- [x] Test d'intégration RLS : une page privée n'est lue par personne d'autre que son autrice, MJ compris.
- [x] Partagée : MJ et joueuses la lisent, seule l'autrice l'écrit ; le MJ peut retirer l'octroi.
- [x] Repasser en privée : plus personne d'autre ne la lit ; le texte est intact.
- [x] Une `shared_note` n'apparaît ni dans l'arborescence, ni dans la recherche, ni dans le wiki public (tests).
- [x] Un nom non découvert arrive au joueur sans identifiant de fiche (test serveur).

**Note de clôture (13 octobre, Opus).** Décisions consignées en bas de l'[ADR 0037](../adr/0037-une-page-partagee-devient-une-entite.md).
- **« La table »** = visibilité `players` du monde.
- **« Ne plus partager »** repasse le bloc de texte en `user` de l'autrice ; l'entité reste.
- **Le titre** est le libellé du bloc. Le nom de l'entité est toujours « Page du cahier », pour qu'aucun titre privé ne soit lisible par la RLS d'`entities`.
- **L'octroi** se réclame seulement à la création (`claim_shared_note_grant`, migration `20261013130000`, appliquée par l'auteur le 13 octobre).

*Code :*
- noyau `src/core/notebook/share.ts` (`pageToSharedLink`, `unlinkUnknownEntityRefs`, 4 tests) ;
- ligne de cahier `shared_page` ;
- service `sharedNotes.ts` (`shareNotebookPage`, `unshareNotebookPage`, `listSharedNotes`) ;
- routes `notes/share`, `notes/unshare`, `notes/shared` (Zod sur l'adresse et le corps) ;
- exclusions dans l'arborescence, la recherche, le wiki public (liste, sommaire, détail) et les fiches à épingler.

*Preuve* : `sharedNotes.integration.test.ts`, **8/8 sur la base le 13 octobre**, aucun monde de test resté.

*En attendant V3.1-42*, le cahier actuel montre une ligne « Page partagée » qui ne s'ouvre pas.

---
### ☑ V3.1-47 — Création : les règles de personnage viennent du ruleset · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) → V3.1-115 à 119**

**Modèle conseillé : Opus** — structures de données de règles, ADR, et lien avec le mécanisme générique des choix.

**Principe de l'auteur (6 octobre)** : **aucune règle de personnage écrite
en dur**. Le ruleset porte tout ; un ruleset maison peut tout changer.

**Inventaire — ce qui est déjà en données** : `class_progression` (avec
`max_level`), `subclass_slot.chosen_at_level`, le dé de vie, la progression
d'incantation (budgets de sorts).

**À structurer (ce ticket)**, chacun validé par Zod (`jsonb`, sans
migration SQL sauf si `docs/SCHEMA.md` l'exige — alors s'arrêter et
demander) :
1. **Plafond de niveau du personnage** (20 en D&D 2024) — aujourd'hui seul
   le plafond par classe existe.
2. **Prérequis de multiclassage structurés** (caractéristique ≥ valeur,
   « et » / « ou ») — `prerequisites` n'est que du texte libre ; le contrôle
   reste indicatif tant que ce n'est pas fait. Le MJ peut passer outre.
3. **Améliorations de caractéristiques et dons, don épique** comme
   **choix accordés par une ligne de progression** (niveau, nature du
   choix) — à brancher sur le mécanisme générique des choix
   (V3.1-3, V3.1-6, V3.1-7), qui reste à concevoir : **ce ticket le conçoit
   s'il n'existe pas encore**, ADR à l'appui.
4. **Génération des caractéristiques** : tableau standard, budget et coûts
   de l'achat de points, formule du tirage — aujourd'hui constantes de
   `src/core/rules/abilityGeneration.ts` (`STANDARD_ARRAY`,
   `POINT_BUY_BUDGET`, `POINT_BUY_MIN/MAX`, `ROLL_*`) ; plus l'**ordre de
   répartition suggéré par classe** (« Répartir pour un clerc »).
5. **Charge** : le multiplicateur de Force (7,5 kg par point en 2024).
6. **Départ à haut niveau** : la table « Commencer à un niveau supérieur »
   (or en plus, somme fixe + jet du serveur, objets magiques à choisir aux
   niveaux élevés). **Valeurs à vérifier dans le MdJ 2024** par l'auteur
   avant saisie (CLAUDE.md : le contenu de règles va en base, jamais dans
   une migration ni un seed suivi par Git).
7. **Revente** : le ratio de vente en jeu (moitié du prix en 2024).
8. Le noyau lit ces valeurs dans le ruleset résolu
   (`src/server/services/resolvedRuleset.ts` → `src/core`), avec les valeurs
   2024 comme **valeurs de la base officielle**, pas comme constantes de
   repli dans le code.

**Critères d'acceptation**
- [ ] ADR écrit (structures, lien avec les choix génériques).
- [ ] Un ruleset de test au plafond 15 limite la création à 15 (test).
- [ ] Un prérequis non rempli est signalé ; le MJ peut passer outre (test).
- [ ] Plus aucune constante de génération dans `abilityGeneration.ts` (lu du ruleset), tests du noyau verts.

---
### ☑ V3.1-48 — Création : identité, prénom, nom, naissance au calendrier du monde · `M` · sans modèle IA — **fait le 13 octobre (ADR 0063)**

**Modèle conseillé : Sonnet** — décision prise ; ADR à écrire d'après elle, noyau pur, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Creation-Decide.dc.html` (étape Identité). **Départ** :
`src/core/schemas/blocks/character.ts` (+ test),
`components/blocks/characterCreatorSteps/IdentityStep.tsx`,
`src/core/calendar/` (types, `formatDate.ts`).

**Ce qui est décidé (auteur, 5 octobre)**
- Deux champs **Prénom** et **Nom** (`given_name`, `family_name` dans le bloc
  `character`), puis genre et pronoms. Le nom de l'entité (wiki, mentions,
  recherche) reste « Prénom Nom », composé à la création et **recomposé
  automatiquement** quand on édite le prénom ou le nom.
- **Naissance** : on saisit l'âge (± ou au clavier) et on choisit jour et
  mois (les mois du calendrier du monde). L'année se calcule depuis
  `calendar.currentDate` : année du jour − âge, moins un si l'anniversaire
  n'est pas encore passé cette année (121 ans au 14 Germinal 1492, né un
  3 Messidor → 1370). Une phrase résume : « Née le 3 Messidor 1370 ·
  121 ans au 14 Germinal 1492 ». Sans date du jour réglée par le MJ,
  l'année se saisit à la main et l'âge attend la date du jour.
- **Règle 16** : la fiche stocke la **date de naissance** (`GameDate`), plus
  l'âge ; l'âge est **dérivé** de la date du jour en jeu et vieillit avec la
  campagne.
- **Reprise** : un `age` existant devient une date de naissance au 1er du
  premier mois, à corriger à la main (lecture tolérante dans Zod, test de
  relecture d'une fiche ancienne).

**À faire** : écrire l'ADR (décision ci-dessus, dix lignes) ; fonctions
pures `birthYearFromAge` et `ageAt` dans `src/core/calendar` (tests
d'abord, mois de longueurs différentes, anniversaire le jour même) ;
schéma Zod ; recomposition du nom côté serveur.

**Critères d'acceptation**
- [x] Le cas « 121 ans au 14 Germinal 1492, né un 3 Messidor → 1370 », et le cas « anniversaire aujourd'hui », en tests.
- [x] Une fiche enregistrée avec `age` se relit (test) ; l'âge affiché est calculé, jamais stocké.
- [x] Éditer le prénom renomme l'entité ; ~~les mentions suivent~~ les mentions pointent toujours l'entité par `id`, leur libellé écrit n'est jamais réécrit (spec §A1 ; reformulé le 13 octobre) (test serveur).
- [x] Les trois lecteurs actuels du champ `age` (V3-Z1) passent à l'âge dérivé : la rangée d'identité de `CharacterSheetHeader` (avec `AgeInput`), la colonne solo, et le refus de `applyLevelUp` (`forbidden_field_change`), qui porte désormais sur la date de naissance.
- [ ] *Repris de V3-Z1 (12 octobre)* : vérifié à la main dans l'assistant, la barre d'étapes, Précédent / Suivant et l'Aperçu avec l'étape Identité (`docs/TESTS.md` §4, Fiche).

**Note de clôture (13 octobre, Opus).** [ADR 0063](../adr/0063-naissance-en-date-de-jeu.md). Codé par Sonnet ; relu, et deux défauts locaux corrigés par Opus (précision « mois » d'une naissance sans jour ; import relatif dans le noyau).

*Décisions prises en route :*
- **Mentions** : une mention garde le texte que l'auteur a écrit (« le tavernier » pour Bram), comme le veut la spec. Le renommage ne casse aucun lien, puisque tout passe par l'`id`.
- **Calendrier** : le layout du monde le lit côté serveur, en même temps que le reste (une lecture d'une colonne par rendu, QUOTAS Q1), et le partage par un contexte (`WorldCalendarProvider`). Aucun écran ne le demande au montage.

*Vérifié* :
- 26 tests unitaires et 1 test d'intégration (renommage et mentions) ;
- en vrai, sur la fiche de Testeur B : Prénom, Nom, Âge, Jour, Mois ; son monde n'a pas de date du jour, donc « Année de naissance » s'affiche.

*À voir par l'auteur* : l'assistant avec une date du jour réglée (121 ans, 3 Messidor → « Née le 3 Messidor 1370 · 121 ans au 14 Germinal 1492 »).

*Reste* : une fiche ancienne qui n'a qu'un `age` devient une date de naissance à la première édition de l'âge, pas avant.
### ☑ V3.1-59 — Publication : le fond par défaut du wiki (données) · `M` · sans modèle IA — **fait le 13 octobre (ADR 0047)**

**Modèle conseillé : Opus** — donnée nouvelle par monde, lue par la page publique (service role) et par l'onglet Wiki des joueuses.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision de l'auteur (8 octobre)** : le MJ choisit le **fond par défaut du
wiki** — un fond (fourni ou de sa bibliothèque), le **mode des pages**, le
**flou**. C'est un réglage **du monde**, vu de tous : il s'applique au wiki
public (`/partage`) **et à l'onglet Wiki des joueuses** (même `BookSkin`).
Une fiche qui a son propre fond (image « fond de page wiki », V2-G13) **le
garde**.

**À faire**
1. Où stocker : colonne(s) sur `worlds` ou réglage existant — **pas prévu
   dans `docs/SCHEMA.md` : ADR, mise à jour du schéma, nouvelle migration**.
   Valider par Zod (référence de fond, mode parmi les modes permis par le
   fond, flou 0–40).
2. Une image de la bibliothèque **personnelle** du MJ devient visible des
   visiteurs anonymes : décider comment elle est servie (copie dans le
   stockage du monde, ou lecture publique de cette seule image) — la règle 2
   s'applique (`publicShare.ts` seul porte le service role).
3. `BookSkin` / `WikiBackgroundProvider` : fond de la fiche s'il existe,
   sinon fond par défaut du monde, sinon rien (comportement actuel).
4. Route d'écriture (Zod, MJ seul).

**Critères d'acceptation**
- [x] ADR et `docs/SCHEMA.md` à jour ; nouvelle migration.
- [x] Un visiteur anonyme voit le fond par défaut ; une fiche avec son propre fond garde le sien (tests).
- [x] Une joueuse voit le même fond dans son onglet Wiki.
- [x] Aucune autre image de la bibliothèque du MJ n'est lisible publiquement (test).

**Note de clôture (13 octobre, Opus).** Détails en bas de l'[ADR 0047](../adr/0047-le-fond-par-defaut-du-wiki.md).

*Base* : colonne `worlds.wiki_background` ; `asset_reference_count` compte la copie (migration `20261013140000`, appliquée par l'auteur le 13 octobre).

*Code :*
- noyau `src/core/theme/worldWikiBackground.ts`, 8 tests : entrée, forme stockée, mode permis, résolution, `chooseWikiBackground` ;
- service `worldWikiBackground.ts` : écriture par le MJ, copie de la bibliothèque en `players`, suppression de l'ancienne copie ;
- `publicShare.ts` : lecture publique ; ne signe que la copie ;
- routes `PUT /api/worlds/[slug]/wiki-background`, `GET …/wiki-background/image` (membres), `GET /partage/[token]/fond-du-wiki` (visiteurs, même porte que le lien) ;
- `WikiBackgroundProvider` reçoit le fond du monde comme repli, dans les trois wikis ;
- le recensement des orphelines compte la copie.

*Preuves (base réelle, 13 octobre) :*
- `worldWikiBackground.integration.test.ts`, **5/5** : la joueuse est refusée à l'écriture ; le visiteur et la joueuse voient le même fond fourni ; un mode non permis est refusé ; l'image de bibliothèque est copiée, et seule la copie est lisible (aucune image de bibliothèque signable par l'anonyme ni par la joueuse) ; changer de fond supprime la copie, jamais l'original.
- `mapAssetsCleanup.integration.test.ts` toujours 5/5 avec le nouveau compteur.
- Aucun monde de test resté.

*Vu en passant* : le cookie de mot de passe d'un lien de partage se forge → **V3.1-142**, inscrit au registre de `SECURITE.md`.

*Interface* : l'écran de réglage du fond (le choix, l'aperçu) vient avec V3.1-60.

---
### ☑ V3.1-62 — Rapidité : mesurer, puis recâbler · `M` · sans modèle IA — **fait le 12 octobre (mesures, ADR 0055 et 0056, `docs/CABLAGE.md`)**

**Modèle conseillé : Opus** pour la mesure et le plan (étapes 1 et 2), **Sonnet** pour appliquer les corrections listées (étape 3).

**Question de l'auteur (8 octobre)** : faut-il revoir le « câblage » pour
rendre l'application plus rapide ? **Oui, mais en mesurant d'abord.** Ce
qui est déjà bien : `createClient`, `getAuthUser` et `getWorldBySlug` sont
mis en cache par requête (`cache()` de React) ; plusieurs services publics
aussi. Relevé dans le code le 8 octobre, sans mesure :
- **Chargements après affichage** : 56 composants lancent un `fetch` dans un
  `useEffect` — l'écran s'affiche vide (« … ») puis se remplit, souvent en
  cascade (une requête attend la précédente). Les fenêtres du MJ demandent
  leurs données à `/api/worlds/[worldSlug]/mj/[tool]/window` **après**
  l'ouverture.
- **Rafraîchissements complets** : 32 `router.refresh()` — chacun relance
  tout l'arbre serveur de la page (layouts compris : arborescence, entités,
  campagnes) pour un seul changement ; un `window.location.reload()`
  (`DeletedEntitiesPanel`).
- **Attentes en série** dans les layouts et la route des fenêtres : monde →
  utilisateur → droits → campagnes, l'un après l'autre alors que plusieurs
  sont indépendants.
- **Requêtes par ligne** : l'Initiative charge chaque PJ un par un
  (`getEntityById` par participant, route des fenêtres, cas `initiative`).
- **Peu de chargement progressif** : 3 `loading.tsx`, 2 `<Suspense>` — une
  page lente bloque tout l'écran.
- **Deux allers-retours d'authentification par navigation** (le
  middleware et le serveur appellent chacun `auth.getUser()`) — à mesurer
  avant d'y toucher : la vérification réseau est un choix de sécurité
  documenté dans `lib/supabase/middleware.ts`.

**À faire**
1. **Mesurer** (Opus) : temps serveur des pages les plus utilisées (fiche
   du wiki, fiche de personnage, ouverture d'une fenêtre d'outil, accueil,
   page joueur) — en-tête `Server-Timing` ou journal en développement —, et
   nombre de requêtes à la base par page. Écrire les chiffres ici.
2. **Planifier** (Opus) : classer les causes par gain mesuré ; écrire un ADR
   court sur les conventions retenues (données initiales en props,
   mises à jour optimistes, `Promise.all`, `loading.tsx` par zone,
   `revalidatePath` ciblé plutôt que `router.refresh()` global), qui devient
   la règle commune 6 des tickets du lot i.
3. **Recâbler** (Sonnet) : les corrections listées par le plan, une par
   commit, **sans changer aucun comportement** ; les outils refaits par le
   lot i suivent déjà la règle 6.

**Fait le 11 octobre (étapes 1 et 2).**
- **Instrumentation** : `lib/supabase/measuredFetch.ts`, en développement seulement, active avec `CREADONJON_MESURE=1`.
- **Outils de mesure** : `scripts/mesure-cablage.mjs` (pilote) et `scripts/analyse-mesure.ts` ; `src/core/mesure/vagues.ts` compte les vagues, avec ses tests.
- **Mesures** sur le Banc d'essai, dans `docs/CABLAGE.md` §3. La fiche de personnage coûte 581 requêtes, 123 vagues et 44 chargements après affichage.
- **Décision** : ADR 0055, sept règles C1 à C7.
- **Garde-fou** : le cliquet `lib/cablage.test.ts`.

**Étape 3 (Sonnet)** : suivre `docs/CABLAGE.md` §7, dans l'ordre. *Correction 1, partie C2, faite le 11 octobre par Opus : le contexte était déjà chargé dans la session (skill `deleguer`, règle 1). Mesures dans `docs/CABLAGE.md` §3.* Une correction par commit, une mesure après chacune, le plafond du cliquet abaissé à chaque fois.

**Étape 3 faite les 11 et 12 octobre** (par Opus, le contexte étant chargé) : les six corrections de `docs/CABLAGE.md` §7, une par commit, chacune mesurée. Chemin détaillé dans `docs/CABLAGE.md` §3, rechargements restants justifiés au §6.

**Avant / après** (Banc d'essai, développement, médiane de 3 essais ; avant le 11 octobre, après le 12 octobre) :

| Écran | Requêtes à la base | Vagues | Chargements après affichage | Écran stable |
|---|---|---|---|---|
| MJ, accueil du monde | 68 → 25 | 28 → 8 | 3 → 0 | 6,7 s → 4,0 s |
| MJ, fiche du wiki | 42 → 29 | 14 → 11 | 3 → 0 | 3,3 s → 3,5 s |
| MJ, fiche de personnage | 581 → 143 | 123 → 30 | 44 → 5 | 23,6 s → 7,5 s |
| MJ, page Initiative | 54 → 23 | 14 → 7 | 3 → 0 | 5,1 s → 2,8 s |
| MJ, fenêtre Initiative (route) | 34 → 15 | 10 → 8 | — | 3,4 s → 1,4 s |
| Joueuse, accueil | 33 → 13 | 11 → 7 | 5 → 0 | 3,1 s → 3,1 s |
| Joueuse, sa fiche | 279 → 115 | 77 → 28 | 21 → 7 | 16,5 s → 6,7 s |
| Joueuse, fiche du wiki de son PJ | 334 → 132 | 65 → 30 | 31 → 5 | 12,8 s → 7,0 s |

Sortie de la base par ouverture de la fenêtre Initiative : 4,9 Mo → 65 ko. `router.refresh()` : 20 appels → 14.

**Critères d'acceptation**
- [x] Les mesures avant / après sont écrites dans ce ticket (tableau ci-dessus ; détail correction par correction dans `docs/CABLAGE.md` §3).
- [x] Aucune régression : `npm run test` vert, aucun test affaibli.
- [x] Aucun changement de sécurité (RLS, vérification de session) sans décision écrite de l'auteur.

---
### ☑ V3.1-74 — Dates de naissance et de mort (données) · `M` · sans modèle IA — **fait le 13 octobre (ADR 0063, complément)**

**Modèle conseillé : Opus** — donnée nouvelle, ADR, `SCHEMA.md`.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : V3.1-48 (la naissance d'un personnage devient une `GameDate`
dans le bloc `character`), `src/core/schemas/blocks/character.ts`,
`src/core/calendar/`, `src/server/services/genealogy.ts`. **Dépend de** :
48.

**La question (ouverte)** : la Généalogie B montre « 1420 – 1478 † » et
« née en 1424 ». La naissance existera avec V3.1-48 (bloc `character`) ;
**la mort n'existe nulle part**, et une fiche sans bloc `character` (un
PNJ décrit en texte) n'a pas de naissance.

**Décidé (auteur, 8 octobre) — la proposition ci-dessous est acceptée**
- Naissance : celle de V3.1-48 (`character`).
- Mort : un champ optionnel `death` (`GameDate`) dans le même bloc ;
  « défunt » = `death` renseigné (pas de booléen à part, règle 16).
- Une fiche sans bloc `character` : pas de dates dans l'arbre (rien
  d'inventé).
- L'âge affiché s'arrête à la mort.

**À faire** : ADR (décision ci-dessus, dix lignes), `SCHEMA.md`, schéma Zod (lecture
tolérante), service de la généalogie qui lit naissance et mort en **une
requête groupée**, remplissage de la ligne prévue en V3.1-73.

**Note de clôture (13 octobre, Opus).** [ADR 0063](../adr/0063-naissance-en-date-de-jeu.md), section « Complément ».

*Fait* :
- `death` dans le bloc `character` ;
- `lifeDatesFromCharacter` et `ageWithDeath` (7 tests) ; l'âge de la fiche et de la colonne solo s'arrête à la mort ;
- la généalogie lit naissance et mort en une requête groupée et les filtre pour le lecteur (2 tests d'intégration : une date réservée au MJ ne part pas vers le wiki public).

*Vu en route* : le bloc `character` a sa propre visibilité. Sans ce filtre, la date de naissance d'un PNJ secret serait partie dans l'arbre.

*Restes* :
- la ligne de dates de l'arbre attend V3.1-73 (Sonnet), qui reçoit la donnée ;
- aucun écran ne permet encore de saisir une mort. Le champ existe, mais il faudra un ticket de saisie (avec 73, ou la fiche).
### ☑ V3.1-84 — Identité de l'application : où elle vit (ADR) · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Opus** — changement de schéma, RLS lue avant
connexion, téléversement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Ce qui est décidé (auteur, 9 octobre)** : la marque par défaut est
**« Antre Nous »**, phrase **« Le repaire de ta table. »**, logo **d20**
au trait ; le superadmin peut changer **nom** (32 caractères), **phrase**
(80), **logo** (l'un des douze au trait, ou une image téléversée PNG ou
WebP carrée de 512 px ; **jamais de SVG téléversé**, il peut porter du
script).

**À trancher, ADR à l'appui** (rien n'existe dans `docs/SCHEMA.md`) :
- Proposé : une table à **ligne unique** `app_identity` (`name`, `tagline`,
  `logo_key` parmi `d20`, `dungeon_door`, `dragon_eye`, `dice_cup`,
  `quill_die`, `key`, `grimoire`, `tower`, `maze`, `scale`, `lair`, `map`,
  `logo_asset_path` nullable via l'interface de stockage, `updated_at`,
  `updated_by`). RLS : lecture pour tous **y compris anonyme** (l'écran-titre
  la lit avant connexion), écriture réservée au superadmin
  (`is_superadmin()`). Aucune ligne → valeurs par défaut de `messages/`.
- Les douze logos sont des SVG **du code** (`components/brand/logos.tsx`),
  jamais des données ; Zod valide `logo_key` contre cette liste.
- Service `getAppIdentity()` (cache court, invalidé à l'écriture) et
  action `updateAppIdentityAction` (Zod, superadmin vérifié côté serveur).
- Contrôle du téléversement : type réel du fichier (signature), pas
  l'extension ; taille bornée.

**Critères d'acceptation**
- [x] ADR écrit ; migration nouvelle ; `docs/SCHEMA.md` à jour ; types
  régénérés.
- [x] Un visiteur non connecté lit l'identité ; un compte non superadmin ne
  peut pas l'écrire (test RLS).
- [x] Un SVG renommé en .png est refusé.

**Note de clôture (13 octobre, Opus).** [ADR 0061](../adr/0061-l-identite-de-l-application.md).
- **Base.** Migration `20261013120000` : la table `app_identity` (une ligne au plus), le bucket privé `brand` et leurs règles. Appliquée par l'auteur le 13 octobre. `SCHEMA.md` §18.0 et les types sont à jour.
- **Noyau** (`src/core/brand/identity.ts`, 7 tests) : les douze clés de logo, les valeurs par défaut, `zAppIdentityInput`, et `detectRasterImageType`, qui lit le type dans la signature du fichier.
- **Serveur.**
  - `getAppIdentity()` lit par un client anonyme (`lib/supabase/anon.ts`). La lecture est mise en cache une heure et invalidée par `updateTag("app-identity")`. Le fichier ne charge pas `sharp`.
  - `updateAppIdentity` / `resetAppIdentity` (`appIdentityWrite.ts`) : superadmin vérifié par le service ; le logo doit être carré, d'au moins 512 px et de 900 Ko au plus, puis il est réencodé en WebP 512 px.
  - Les actions `updateAppIdentityAction` et `resetAppIdentityAction` (`app/appIdentityActions.ts`) valident leur entrée par Zod.
  - La route `GET /api/app-identity/logo?v=…` a un cache d'un an quand `v` est la version en cours, et le middleware l'ouvre aux visiteurs anonymes.
- **Preuves.**
  - `appIdentityWrite.test.ts`, 5 tests : SVG renommé refusé sans rien écrire, image non carrée ou trop petite refusée, réencodage, non-superadmin refusé.
  - `middleware.test.ts`, 2 tests de plus.
  - `appIdentityRls.integration.test.ts`, **5/5 sur la base le 13 octobre** : lecture anonyme ; écriture refusée à l'anonyme et au non-superadmin ; suppression et dépôt de logo refusés au non-superadmin.
- **Écarts.**
  - Le logo est plafonné à 900 Ko : la limite de 1 Mo des actions serveur n'a pas été relevée.
  - Les valeurs par défaut vivent dans le code, en français pour toutes les langues (une marque, pas un libellé).
  - Les douze logos sont dessinés par V3.1-86 et 88, qui les affichent ; ce ticket n'en pose que les clés.

---
### ☑ V3.1-101 — Initiative : la base et les routes réservées au MJ · `S` · sans modèle IA — **terminé le 10 octobre**

**Modèle conseillé : Opus** — RLS et sécurité. **ADR 0040.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration nouvelle : `combats` lisible des membres, écrit par
  `app.is_world_admin(app.campaign_world_id(campaign_id))` ;
  `combat_participants` lu et écrit par `app.is_world_admin(app.combat_world_id(combat_id))`.
- **Chaque route** de `app/api/campaigns/[campaignId]/combats/**` vérifie
  `isWorldAdmin` (`src/server/services/permissions.ts`) et répond 403 avant
  toute lecture de participants ou écriture.
- Vérifier que rien d'autre ne lisait les participants pour un joueur en
  multijoueur (lu le 9 octobre : `turnIntent`, `turnLoop`, `combatTriggers`,
  `soloScene` — solo, où le joueur est propriétaire) ; le solo ne change pas.

**Critères d'acceptation**
- [x] Test d'intégration RLS : un joueur ne lit aucune ligne de
  `combat_participants` et n'écrit ni `combats` ni `combat_participants`.
- [x] Chaque route de combat répond 403 à un joueur (test de la porte `checkCombatAccess` sur la base, commune aux dix routes).
- [x] Le solo et l'outil Initiative du MJ marchent comme avant. Vérifié à l'écran le 10 octobre par une session de vérification : créer, lancer les initiatives, commencer, passer les tours, terminer, supprimer, tout en 200/201. L'ajout d'un PJ sans fiche répond 404, comme avant (les PJ du Banc d'essai n'ont pas encore de fiche). Solo non joué : le joueur y est propriétaire du monde, donc administrateur.
- [x] À faire par l'auteur : appliquer la migration `20261010120000_combats_gm_only` (`supabase db push`), puis relancer les tests d'intégration avec `NEXT_PUBLIC_SUPABASE_ANON_KEY` défini.

**Codé le 10 octobre.**
- **Base** : migration `20261010120000_combats_gm_only`. `combats` reste lisible des membres et n'est plus écrit que par un administrateur du monde ; `combat_participants` est lu et écrit par l'administrateur seulement.
- **Routes** : les dix routes de `app/api/campaigns/[campaignId]/combats/**` passent par une porte commune, `guardCombatRoute` (`lib/combats/routeGuard.ts`). Elle valide l'adresse par Zod (règle 4, ce qui manquait partout), exige une session (trois lectures n'en demandaient pas) et le droit MJ, puis vérifie que le combat appartient à la campagne de l'adresse et le participant au combat. Elle répond 400, 401, 403 ou 404 avant toute lecture ou écriture.
- **Décision** : la règle pure `decideCombatAccess` (`src/core/permissions/combatAccess.ts`, 6 tests) refuse un joueur avant de lui dire si un combat existe. Les faits sont rassemblés par `checkCombatAccess` (`services/combats.ts`).
- **Solo** : inchangé. Le joueur y est propriétaire du monde, donc administrateur ; `turnLoop`, `turnIntent`, `soloScene` et `combatTriggers` ne sont pas touchés.
- **Tests** : `combatsRls.integration.test.ts`. Un joueur voit le combat mais aucun participant, et n'écrit rien ; le MJ lit et écrit ; la porte rend le même verdict. Ce test n'a pas tourné ici : la base n'est pas joignable avec la clé publique, et la migration n'est pas encore appliquée.
- Typecheck et lint verts. `npm run test` : 1405 tests passent ; 3 échecs et 14 fichiers en erreur **préexistants**, identiques sans ce ticket. Cette session voit l'URL et la clé service de Supabase mais pas la clé publique : des tests d'intégration démarrent puis échouent à connecter leurs comptes.

---
### ☑ V3.1-108 — Droits des joueurs : la base ferme, le serveur règle · `M` · sans modèle IA — **terminé le 10 octobre**

**Modèle conseillé : Opus** — RLS et schéma. **ADR 0043.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : `campaigns.table_settings jsonb not null default '{}'` ;
  `docs/SCHEMA.md` ; `zCampaignTableSettings` (défauts : `inspiration_max`
  1 ; `player_can_edit` : `conditions` et `inspiration` faux, `hp`,
  `currency`, `spell_slots`, `hit_dice` vrais).
- Migration : écriture de `entity_runtime_state` et `entity_active_effects`
  par `app.can_edit_entity(entity_id)` (au lieu de tout membre du monde).
- `src/core/campaigns/tableSettings.ts` : `mayPlayerChange(field, settings)`
  (tests d'abord) ; garde dans chaque service qui écrit un de ces champs
  pour une joueuse (PV, états, inspiration, pièces, emplacements, dés de
  vie) : 403 si l'interrupteur est coupé et que l'appelant n'est pas MJ.
  Les fonctions du moteur (repos, résolution) ne passent pas par la garde.
- Route d'écriture des réglages (Zod, MJ seul).

**Critères d'acceptation**
- [x] Une joueuse ne peut plus écrire l'état de jeu d'une autre fiche
  (test RLS).
- [x] Interrupteur coupé : l'écriture d'une joueuse est refusée par le
  serveur ; le MJ et le repos passent (tests de service).

**Note de clôture (10 octobre).** Fait :
- migration `20261010130000_runtime_state_can_edit_and_table_settings` : RLS
  d'écriture par `can_edit_entity`, colonne `table_settings` (objet) ;
- `src/core/campaigns/tableSettings.ts` et
  `src/core/permissions/sheetActionAccess.ts` (tests d'abord, 15 tests) ;
- porte commune `lib/characterActions/routeGuard.ts` sur les 11 routes
  d'action qui ne vérifiaient rien (droit d'éditer, Zod sur l'adresse,
  campagne du même monde) ; interrupteurs : PV → `hp`, inspiration →
  `inspiration` (plafonnée à `inspiration_max`), épuisement → `conditions` ;
- la route de la fiche n'enregistre l'état de départ que pour qui peut
  éditer ;
- route `/api/campaigns/[campaignId]/table-settings` (GET membres, PUT MJ) ;
- test d'intégration `runtimeStateRls.integration.test.ts`, passé sur la
  vraie base le 10 octobre (4/4, voir `docs/TESTS.md` §4 bis).

Pièces, emplacements et dés de vie n'ont pas encore de geste manuel (seuls
le sort et les repos les écrivent, chemins du moteur) : leur garde viendra
avec ces gestes (V3.1-24, 109). L'écran des réglages et le masquage des
commandes coupées : V3.1-57, 109.

---
### ☑ V3.1-113 — Ressources : pacte, recharge partielle, multiclassage (noyau) · `M` · sans modèle IA — **fait le 13 octobre (ADR 0045)**

**Modèle conseillé : Opus** — moteur, tests d'abord. **ADR 0045.**
**Dépend de** : 115 (pour la table du multiclassé dans `character_rules`).

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `recharge: "short_rest_one"` (bloc Ressources, version relevée) ;
  `spellcasting.kind` `slots` | `pact` et `pactSlots` ; `casterWeight` ;
  `pact_slots_used` dans l'état de jeu (défaut 0).
- `characterSheet()` : emplacements du multiclassé (niveaux pondérés,
  arrondi inférieur, table du ruleset) ; réserve de pacte séparée.
- Import SRD : poids d'incantation, magie de pacte de l'occultiste, Arcanum
  mystique (ressource `long_rest` par niveau 6 à 9), recharges partielles
  (Rage, Conduit divin, Forme sauvage, Second souffle).

**Critères d'acceptation**
- [x] Occultiste 20 : 4 emplacements de pacte de niveau 5 ; clerc 3 /
  magicien 2 : emplacements d'un lanceur de niveau 5 ; un multiclassé
  occultiste garde deux réserves (tests).
- [x] Repos court : une Rage rendue ; repos long : toutes (test).

**Note de clôture (13 octobre, Opus).** Détail dans l'[ADR 0045](../adr/0045-pacte-recharge-partielle-multiclassage.md), section « Réalisé ».

*Fait :*
- `computeSpellSlots` et `rechargeTrackers`, 12 tests du noyau ;
- `pact_slots_used` dans l'état de jeu ;
- poids d'incantation de chaque classe dans `data/srd/class-spellcasting.json` ;
- `castSpell` et les repos branchés ;
- 2 tests d'intégration contre la base (occultiste 20, clerc 3 / magicien 2), et ceux des repos rejoués.

*Corrigé en route* : l'arrondi de l'ADR 0045. En 2024, la moitié des niveaux de paladin ou de rôdeur s'arrondit au supérieur.

*Vérifié en vrai* (Testeur B, Clerc 1) : « Niv. 1 — 2/2 » emplacements, inchangé.

*Reporté* :
- les recharges de classe déclarées par les règles et l'Arcanum mystique vont à V3.1-129 ;
- l'écran de la réserve de pacte va à V3.1-114. D'ici là, un occultiste ne voit pas ses emplacements de pacte à l'écran, mais il peut les dépenser.
### ☑ V3.1-115 — Règles de personnage : la fiche `character_rules` · `L` · sans modèle IA — **fait le 13 octobre (ADR 0046)**

**Modèle conseillé : Opus** — structure de règles, héritage, import.
**ADR 0046.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Bloc typé `zCharacterRules` (champs de l'ADR) ; une fiche
  `character_rules` par ruleset, héritée et surchargée champ par champ comme
  les autres fiches ; sur la fiche de classe : `multiclass_prerequisites`
  structurés, `suggested_abilities`, `casterWeight`.
- Import SRD (base officielle) : les valeurs 2024 (plafond 20, tableau
  standard, achat de points, tirage, charge, revente, table du multiclassé,
  prérequis de multiclassage). **Le départ à haut niveau** : valeurs à
  vérifier par l'auteur dans le MdJ 2024 avant saisie — le contenu va en
  base ou dans `data/personnel/`, jamais en migration.
- `resolvedRuleset` expose ces valeurs ; `abilityGeneration.ts`,
  l'encombrement et la revente les lisent : **plus aucune constante**.

**Critères d'acceptation**
- [x] Un ruleset de test au plafond 15 limite la création à 15 (test).
- [x] Un prérequis non rempli est signalé ; le MJ peut passer outre (test).
- [x] Plus aucune constante de génération dans `abilityGeneration.ts`.
- [x] La charge suit la règle 2024 (Force × 7,5 kg) : un Guerrier FOR 17 à 75 kg n'est plus « Encombré » (vu par la vérification du 11 octobre).

**Note de clôture (13 octobre, Opus).** Détail dans l'[ADR 0046](../adr/0046-regles-de-personnage-et-choix-generiques.md), section « Réalisé ».

*Noyau et données (Opus) :*
- bloc `character_rules`, fiche `character-rules` posée par l'import dans les deux bases officielles (`data/srd/character-rules.json`) ;
- `class_basics` porte `multiclass_prerequisites` et `suggested_abilities` ;
- `characterSheet()` applique le plafond de caractéristique ; la charge lit ses paliers dans les règles (2024 : aucun palier).

*Écrans et routes (Sonnet, relu par Opus) :*
- l'étape des caractéristiques ne propose que les méthodes du ruleset, avec ses valeurs ; le tirage lit les règles côté serveur ;
- la montée de niveau refuse le dépassement du plafond de niveau et un prérequis de multiclassage non rempli ; le MJ peut passer outre, le serveur le re-vérifie (`isWorldAdmin`) ;
- `abilityGeneration.ts` supprimé.

*Vérifié en vrai* (Testeur B, Clerc nain) : charge 29,5 / 88,5 kg, soit FOR 13 × 15 lb, sans « Encombré ». Le cas exact du Guerrier FOR 17 à 75 kg est couvert par un test du noyau.

*Restes, hors de ce ticket :*
- `sell_ratio` est stocké mais aucun code de revente n'existe encore ;
- le départ à haut niveau reste à saisir par l'auteur ;
- le test du MJ qui passe outre porte sur le noyau (`checkMulticlassEntry`) ; la condition serveur tient en une ligne, sans test d'intégration dédié ;
- l'assistant de création lit le ruleset par défaut du monde, la fiche celui de la campagne : écart antérieur, à traiter avec V3.1-118.

---
### ☑ V3.1-116 — Le mécanisme générique des choix (noyau et résolution) · `L` · sans modèle IA — **fait le 13 octobre (ADR 0046)**

**Modèle conseillé : Opus** — cœur du moteur. **ADR 0046.**
**Dépend de** : 115.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `zChoiceGrant` (champs de l'ADR), accepté dans la progression d'une
  classe ou sous-classe, un trait d'espèce, un historique, un don.
- `resolvedRuleset` collecte tous les choix accessibles et rend
  `RemainingChoice` généralisé ; `characterSheet()` applique les effets des
  options choisies (`character.choices`, clés qualifiées).
- Les améliorations de caractéristiques et dons de progression deviennent
  des choix `ability` / `feat`.
- Import SRD : Compétent, Polyvalent, Sens aiguisés, lignages elfiques et
  gnomiques, legs infernal, ascendance de géant, Initié à la magie.

**Critères d'acceptation**
- [x] Initié à la magie : le choix de liste, les sorts mineurs et le sort de
  niveau 1 deviennent des sorts réels de la fiche (test).
- [x] Lignage elfique Drow : le sort mineur au niveau 1, les sorts aux
  niveaux 3 et 5, la caractéristique d'incantation choisie une fois (test).
- [x] Un don ou un trait sans choix n'ajoute rien à faire.
- [x] L'Humain ne liste plus « Polyvalente » (propriété d'arme) parmi ses traits (vu par la vérification du 11 octobre).

**Note de clôture (13 octobre, Opus).** Détail dans l'[ADR 0046](../adr/0046-regles-de-personnage-et-choix-generiques.md), section « Réalisé (V3.1-116) ».

*Fait :*
- bloc `choices` et `resolveChoices`, 23 tests du noyau ;
- `data/srd/choices-2024.json` (Compétent, Polyvalent, Sens aiguisés, Doué, Initié à la magie, lignages elfiques et gnomes, héritages fiélons, ascendance gigante ; listes imposées par l'Acolyte et le Sage), posé par l'import et gardé par un test ;
- serveur (moteur) et fiche du navigateur appliquent la même résolution ; 2 tests d'intégration contre la base.

*Critères :*
- Initié à la magie et Drow : tests du noyau, rejoués contre la base ;
- l'Humain : la table de traduction par nom anglais donnait « Polyvalente » (la propriété d'arme) au trait Polyvalent et « Polyvalent » à Compétent. Corrigé par clé (`scripts/write-human-trait-names-fr.ts`), vérifié après réimport.

*Vérifié en vrai* (Testeur B) : la route du ruleset rend, pour un Humain Acolyte, Compétent à sa place, les 4 dons d'origine, la liste du clerc imposée ; la fiche de B se charge sans changement.

*Reporté à V3.1-118* :
- les améliorations de caractéristiques gardent leur mécanisme ;
- les écrans des choix imbriqués et des sorts accordés.
### ☑ V3.1-117 — La sous-classe résolue et ses choix · `M` · sans modèle IA — **fait le 13 octobre (ADR 0046)**

**Modèle conseillé : Opus.** **ADR 0046.** **Dépend de** : 116.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `CreationSelection.classes[].subclass` ; la sous-classe rejoint le lot
  résolu ; `zSubclassFeatureEntry` accepte modificateurs, sorts toujours
  préparés et `zChoiceGrant`.
- Import SRD : Affinité élémentaire (type de dégâts, une fois), Cercle de
  la Terre (terrain, au repos long), Résilience fiélonne (au repos),
  Proie du chasseur / Tactiques défensives (au repos), Découvertes
  magiques, Savant en évocation (sorts).

**Critères d'acceptation**
- [ ] ~~Affinité élémentaire Feu : résistance et bonus de dégâts appliqués (test).~~ Reporté à V3.1-137 et V3.1-134 (décision de l'auteur, 13 octobre) : le type choisi est enregistré (test).
- [x] Une sous-classe purement descriptive ne change rien.

**Note de clôture (13 octobre, Opus).** Détail dans l'[ADR 0046](../adr/0046-regles-de-personnage-et-choix-generiques.md), section « Réalisé (V3.1-117) ».

*Fait :*
- sous-classe dans la sélection, dans le moteur et dans la fiche ;
- `subclassFeatures` et le niveau de classe pour les choix et les sorts ; 9 tests du noyau ;
- `data/srd/subclasses-2024.json`, posé par l'import et gardé par un test ;
- 3 tests d'intégration contre la base : Cercle de la Terre, Savant en évocation, Voleur descriptif.

*Défaut trouvé en route et corrigé* : la validation des sorts côté serveur perdait un sort valide placé après des sorts refusés.

*Vérifié en vrai* : la route du ruleset rend, pour un Druide 5 du Cercle de la Terre, le choix du terrain et ses quatre options ; la fiche de Testeur B se charge sans changement.

*Restes* :
- la clé de la sous-classe Cercle de la Terre est `circle-of-the-land-subclass` (collision avec une aptitude 2014 à l'import) ; elle entre dans la clé des choix stockés ;
- les sorts de domaine, de serment, de protecteur et draconiques (toujours préparés) ne sont pas encore saisis : le vocabulaire existe, c'est de la donnée ;
- l'écran des choix revient à V3.1-118.
### ☑ V3.1-120 — Défaire les cycles d'import (services serveur, fiche jouable) · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet** — refactorisation sans changement de comportement ; les tests existants font foi.

**Sous-tâches Haiku** (`aide-haiku`) : recenser, avant de coder, chaque import de la liste ci-dessous et ses usages ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Constat (audit Graphify du 10 octobre, ADR 0054).** Huit cycles d'import. Rien ne casse aujourd'hui, mais un cycle rend l'ordre de chargement fragile. Une constante peut valoir `undefined` au moment où un module la lit. Et on ne peut plus toucher à un fichier sans tirer les autres. La refonte va justement modifier la fiche jouable et l'assistant de montée de niveau (V3.1-26, 48 à 53).

**Les cycles et l'import qui les ferme**

*Composants*, deux cycles : `LevelUpWizard` → `AsiStep` / `RemainingChoicesStep` → `PlayableCharacterSheet` → `LevelUpWizard`.
- `AsiStep.tsx` et `RemainingChoicesStep.tsx` n'importent de `PlayableCharacterSheet.tsx` que deux constantes, `ABILITY_LABELS` et `SORTED_SKILLS`.
- `ABILITY_LABELS` existe déjà dans `src/core/rules/sheet.ts`. S'il est identique, utiliser celui-là ; sinon, garder la version française la plus complète et le dire.
- `SORTED_SKILLS` va dans un petit module sans composant, par exemple `components/blocks/skillOrder.ts`. `PlayableCharacterSheet.tsx` l'importe de là.

*Services serveur* (`src/server/services/`), six cycles qui passent par ces imports :

| Fichier | Importe | Depuis |
|---|---|---|
| `campaigns.ts` | `createEntity`, `listEntities` | `entities.ts` |
| `entities.ts` | `listPlayerCharacterEntityIds` | `worldPlayerCharacters.ts` |
| `entities.ts` | `getSessionJournalTreeGroup` | `sessionJournal.ts` |
| `worldPlayerCharacters.ts` | `listCampaigns` | `campaigns.ts` |
| `worldPlayerCharacters.ts` | `assembleResolvedRuleset` | `resolvedRuleset.ts` |
| `sessionJournal.ts` | `createEntity` | `entities.ts` |
| `sessionJournal.ts` | `getCalendar` | `worlds.ts` |
| `worlds.ts` | `createCampaign`, `listWorldPlayerCharacters` | `campaigns.ts`, `worldPlayerCharacters.ts` |
| `rules.ts` | `getWorldBySlug` | `worlds.ts` |
| `resolvedRuleset.ts` | `resolveEntryBlocksInRuleset…`, `walkRulesetChain` | `rules.ts` |

**Méthode**, dans cet ordre, en gardant chaque fonction publique et sa signature :
1. **Quand le service importé ne fait que relayer un repo** (`listCampaigns`, `getCalendar`, `getWorldBySlug` sont les premiers à vérifier) : appeler directement la fonction de `src/server/repos/`. Un service peut toujours importer un repo.
2. **Sinon, déplacer la fonction partagée vers le bas**, dans le module dont elle dépend vraiment, ou dans un nouveau module de service « feuille » qui n'importe aucun des fichiers du cycle. Par exemple, les lectures des PJ d'un monde, utilisées par `entities.ts` et `worlds.ts`.
3. Ne jamais casser un cycle par un `import()` dynamique, ni en dupliquant une requête. Une requête Supabase reste dans `src/server/repos/` (règle 20).

**Garde-fou.** Activer `import/no-cycle` dans `eslint.config.mjs`, pour `src/` et `components/`. La règle vient de `eslint-plugin-import`, déjà présent dans `node_modules` ; s'il n'est pas une dépendance directe, le dire avant de l'ajouter à `package.json`. Le lint échoue désormais sur tout nouveau cycle.

**Critères d'acceptation**
- [x] `import/no-cycle` actif ; `npm run lint` passe sans aucune exception désactivée.
- [x] Aucune signature publique changée ; aucun test modifié, sauf ses imports.
- [x] `npm run typecheck && npm run lint && npm run test` passent.
- [x] Une note de clôture liste, pour chaque cycle, l'import déplacé et sa nouvelle source.

**Note de clôture (13 octobre, fait par Opus, sans délégation : la carte des cycles était déjà chargée).** Le recensement par `import/no-cycle` a trouvé **sept** cycles : les six du constat, plus un apparu depuis dans le noyau (`encumbrance.ts` ↔ `sheet.ts`). Aucune signature publique n'a changé : chaque fonction déplacée est réexportée par son ancien fichier, et aucun test n'a été touché.

| Cycle | Import déplacé | Nouvelle source |
|---|---|---|
| Fiche jouable ↔ assistant de montée de niveau | `ABILITY_LABELS` (abréviations FOR, DEX…), `SORTED_SKILLS` | `components/blocks/sheetLabels.ts`. `ABILITY_LABELS` du noyau donne les noms complets (« Force ») : différent, donc gardé à part. La fiche, ses étapes et les deux fichiers du solo l'importent de là |
| `sheet.ts` ↔ `encumbrance.ts` (noyau) | `Ability`, `ABILITIES`, `ABILITY_LABELS`, `SKILL_ABILITIES`, `Skill`, `SKILLS` | `src/core/rules/abilities.ts`, module feuille ; `sheet.ts` le réexporte |
| `worldPlayerCharacters` → `campaigns` → `entities` → `worldPlayerCharacters` | `listCampaigns`, `CampaignSummary` | `services/campaignSummary.ts`. Pas d'appel direct au repo : `listCampaigns` est enveloppé dans `React.cache()`, l'appel direct aurait doublé des requêtes par page |
| `rules` → `worlds` → `worldPlayerCharacters` → `resolvedRuleset` → `rules` | `getWorldBySlug` | `services/worldLookup.ts`, même raison (`React.cache()`) |
| `entities` ↔ `sessionJournal` (et les cycles qui passaient par `worlds`) | `getSessionJournalTreeGroup`, `getLatestSessionJournalSlug`, `SESSION_JOURNAL_KIND` | `services/sessionJournalTree.ts` |

Les autres arêtes du tableau du constat (`getCalendar`, `createCampaign`, `resolveEntryBlocks…`) restent : une fois ces trois coupures faites, elles ne ferment plus aucune boucle. **Garde-fou** : `import/no-cycle` est actif pour `src/` et `components/`. Le plugin et son résolveur TypeScript sont déjà chargés par `eslint-config-next` : aucune dépendance ajoutée. `docs/ARCHITECTURE.md` §6 dit comment casser un cycle. Vérifié : typecheck, lint, 1 468 tests unitaires et 161 d'intégration.


---
### ☑ V3.1-121 — Ténacité naine ignorée dans les PV max · `S` · sans modèle IA — **fait et vérifié le 13 octobre** — cause : les effets passifs des traits d'espèce ne sont appliqués nulle part, et aucun ticket ne le prévoit (V3.1-116 ne traite que les traits à choix).

**Modèle conseillé : Opus** — calcul de la fiche (`characterSheet()`, noyau).

Nain Clerc 1, CON 14 : PV max 10 au lieu de 11. Les sources de PV renvoyées par `GET /api/entities/[id]/sheet` ne listent que « Dés de vie (1d8) » 8 et « Constitution » 2 ; le trait est affiché à l'étape Espèce mais ne produit aucun modificateur.

**Critères d'acceptation**
- [x] Test d'abord (noyau) : un Nain niveau 1 gagne +1 PV max, puis +1 par niveau.
- [x] La fiche du PJ de Testeur B affiche 11 PV max, avec la source « Ténacité naine ».

**Vérifié en direct le 13 octobre (Opus).** Application lancée en local, connexion en Testeur B par Chromium, fiche `/m/banc-d-essai/joueur/fiche/3`.
- La jauge affiche « 10/11 ». Les PV actuels restent à 10 : c'est un état enregistré, et une hausse du maximum ne soigne pas.
- Les données de la page portent les trois sources des PV : Dés de vie 8, Constitution 2, **Ténacité naine 1**.
- L'écran n'affiche aucune source des PV, ni au survol ni ailleurs, pour aucune des trois. C'est déjà le cas avant ce ticket ; la fiche à jauges (V3.1-26) est l'endroit pour les montrer.
- En passant : l'inventaire affiche la masse d'armes à 1.8 kg (V3.1-125).

**Codé le 13 octobre (Opus).** Choix de l'auteur : un modificateur « par niveau ».
- **Moteur.** Un modificateur peut porter `per_level` (`zModifier`, `DeclaredModifier`). `characterSheet()` multiplie sa valeur par le niveau total du personnage, avant toute pile ; les sources affichent le total. 5 tests dans `sheet.test.ts`.
- **Branchement.** `resolvedRuleset.ts` lit enfin le bloc `modifiers` des traits d'espèce, validé par Zod, et l'ajoute à la feature de l'espèce en couche 2, avec le nom du trait pour étiquette. Aucune requête de plus : `fetchEntriesBatch` lisait déjà tous les blocs des traits.
- **Donnée.** `data/srd/modifiers-2024.json`, saisi à la main sur le modèle de `triggers-2024.json`, lu par `ingest-srd.ts` et testé par `srdModifiersData.test.ts`. La fiche de règle affiche « +1 par niveau ».
- **Pas fait ici.** La Résilience draconique dépend du *niveau de classe*, et les aptitudes de sous-classe ne sont pas encore résolues : elle attend V3.1-117. Le don Robuste n'est pas dans le SRD 5.2.1 ; une version maison peut porter `per_level`.

---
### ☑ V3.1-125 — Masse d'armes : poids faux à l'import · `S` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet.**

La masse d'armes pèse 0,9 kg sur la fiche ; le SRD donne 4 lb, soit environ 1,8 kg. Trouver l'erreur de conversion dans `ingest-srd` (et vérifier les autres armes de la même famille), la corriger à l'import, jamais à la main en base.

**Critères d'acceptation**
- [x] Masse d'armes à 1,8 kg après réimport ; un test couvre le cas. **Réimport fait le 13 octobre** : 4 lb en base dans les deux rulesets SRD (1 904 entrées, aucun échec), les trois scripts d'auteur rejoués.

**Diagnostic du 13 octobre (`dev-sonnet`, vérifié par Opus).** Pas d'erreur de conversion : `lbToKg` est juste. C'est `data/srd/srd-2024.json` qui était faux. Comparé au tableau des armes du SRD 5.2.1 (`data/srd/en-source/srd-5.2.1-en.txt`) :
- masse d'armes : 2 lb au lieu de 4 ;
- lance : 2 lb au lieu de 3 ;
- pique : 6 lb au lieu de 18.

Les trois sont corrigées dans le JSON. `srdWeaponWeights.test.ts` compare les 28 armes de corps à corps au tableau ; il échoue sans la correction.

---
### ☑ V3.1-126 — Les `catch` muets restants · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet.** Sous-tâches Haiku : recenser les occurrences et les classer par fichier (`grep -rn "catch {\|\.catch(() => {})" app components lib src`, tests exclus).

`CLAUDE.md` interdit le `catch` silencieux. Le 12 octobre, il en reste **55, dans 44 fichiers**. Ceux touchés par V3.1-62 ont été corrigés en passant (chargeurs de la fiche, pastille du chat, radio, dés, liste des règles, découverte d'une fiche joueuse). Les autres datent d'avant la règle.

**Méthode**, fichier par fichier, sans changer le comportement visible :
- un échec qui doit rester sans effet pour l'utilisateur (geste « au mieux ») garde son repli, mais **journalise** l'erreur (`console.error` avec ce qui a échoué) ;
- un échec qui laisse un écran sur un état faux reçoit l'état d'erreur de la charte (`docs/CHARTE-UI.md`, états d'écran) ;
- un `fetch` qui ne teste pas `res.ok` le teste (charte : « un `fetch` dont on ne teste pas `res.ok` est un bug »).

**Garde-fou.** Ajouter le motif au cliquet `lib/cablage.test.ts`, plafond au compte du jour, abaissé à chaque lot.

**Critères d'acceptation**
- [x] Plus aucun `catch` sans traitement de l'erreur hors des tests.
- [x] Le cliquet compte les `catch` muets et échoue s'ils augmentent.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

**Note de clôture (13 octobre, `dev-sonnet`, relu par Opus).** Le grep du ticket comptait 55 lignes, mais beaucoup traitaient déjà l'erreur (réponse HTTP, erreur typée, état d'erreur). Il y avait environ 35 vrais muets, formes `.catch(() => setX(null))` comprises.
- **Journalisés** (`console.error` avec ce qui a échoué), repli inchangé : stockage local, chargements « au mieux » du shell et des blocs, cartes, calendrier, narration et esquisses du solo, préchauffage de `publicShare.ts`, arguments d'outil illisibles de l'adaptateur d'IA.
- **Marqués `catch-attendu`**, échec prévu par conception et justifié dans le commentaire : `wikiPath.ts`, `supabase/server.ts`, `embedUrl.ts`, `tables/roll.ts`, `CommandPalette.tsx` (requête annulée à chaque frappe ; un journal ferait du bruit), `srdMapping.ts`, `homebrewEdit.ts`.
- **Aucun état d'erreur posé, aucun `res.ok` ajouté** : ceux vus le testaient déjà.

**Cliquet** : clé `catchMuets` de `lib/cablage.test.ts`, **plafond 0**. `lib/` entre dans les racines comptées.

**Laissé pour plus tard** (relevé par Sonnet, hors périmètre) :
- `app/api/campaigns/[id]/invites/route.ts` transforme tout échec en 403 « seul le MJ peut inviter » ; le changer modifie le comportement visible.
- La carte vide et le calendrier par défaut mériteraient l'état d'erreur de la charte, plutôt qu'un simple journal : c'est un ticket d'interface.


---
### ☑ V3.1-127 — Mettre à jour Next et les dépendances vulnérables · `S` · sans modèle IA — **fait le 12 octobre**

**Modèle conseillé : Opus**, car le changement de version de Next touche tout le rendu. Sous-tâches Haiku : lancer `npm audit --omit=dev`, typecheck, lint, tests et build, et résumer les échecs.

Le 12 octobre, `npm audit --omit=dev` relève 32 failles (1 critique, 6 hautes, 25 moyennes), inscrites au registre de `docs/SECURITE.md` §3.
- **Next 16.2.12** : plusieurs failles corrigées en 16.3.8, dont des exécutions de code à distance (optimisation d'images AVIF, `next/og`, serveur Windows) et une falsification de requête par l'optimisation d'images. Le code n'utilise ni `next/image` ni `next/og` : exposition faible, mais `/_next/image` répond quand même.
- **Éditeur** : `@tiptap/core` et `prosemirror-view` (XSS au collage) ; correctif dans les versions permises.
- **Outillage** : `sharp`, `postcss` (suivent Next), `nanoid`, `source-map-js`.

**Méthode**
1. Monter `next` (et `eslint-config-next`) à la dernière 16.x, au moins 16.3.8 ; lire ses notes de version pour les changements de comportement.
2. `npm audit fix`, **sans** `--force`.
3. `npm run typecheck && npm run lint && npm run test`, `npm run build`, `npm run verifier:secrets`.
4. Parcours à la main (`docs/TESTS.md`) : une fiche de personnage, l'éditeur (coller du texte), un portrait téléversé, une page partagée.
5. Passer la ligne du registre à *corrigée*.

**Fait le 12 octobre.**
- **Next 16.3.8**, pas 16.4.0 : dernière version corrective de la ligne 16.3, qui corrige toutes les failles relevées ; 16.4.0 (six jours) apporte des nouveautés, donc plus de changements possibles. `eslint-config-next` suit.
- **Tiptap 3.31.4**, toutes les extensions ensemble (elles exigent la même version exacte). Le fichier de verrouillage gardait l'ancienne version de chaque extension : ses entrées Tiptap ont été retirées pour que npm les résolve à neuf, puis `npm ci` a prouvé qu'il s'installe proprement depuis zéro.
- `sharp`, `nanoid`, `source-map-js` montés dans leurs versions permises (`npm update`).
- `npm audit fix` plante avec npm 10.9 (`edgesOut`) : les mises à jour ont été faites paquet par paquet.
- **Parcours à la main** sur le build de production (`next start`), Banc d'essai, Chromium :
  - fiche de personnage côté MJ et côté joueuse : CA 16, PV 12/12 ;
  - éditeur : bloc Texte ajouté à la faction, frappe et collage enregistrés et relus ; une image collée avec un script caché (`onerror`) ne l'exécute pas ; bloc supprimé ensuite ;
  - page partagée avec un jeton inconnu : 404 prévu, pas d'erreur serveur ; en-têtes de sécurité présents.
  - Téléversement d'image : *erreur corrigée le 12 octobre*. Ce ticket affirmait d'abord que notre code n'utilisait pas `sharp` : faux, il le charge à la demande (`await import("sharp")`, `src/server/services/assetUpload.ts`, `blockImageUpload.ts`, `backgroundImageProcessing.ts`), forme que la recherche n'avait pas trouvée. Vérifié ensuite sur la machine, sans rien téléverser, avec `sharp` 0.35.5 et les réglages exacts de l'app : une carte PNG de 19,6 Mo (5760 px) devient un WebP de 537 ko à 4096 px, 168 ko à 1600 px, 30 ko en portrait ; un faux fichier est refusé proprement. L'envoi vers le stockage (`supabase-js`) n'a pas changé de version.
- **Nouveau en 16.3** : la règle de lint `no-location-assign-relative-destination` signalait `components/shell/CommandPalette.tsx` (navigation par `window.location.href`, donc rechargement complet). Corrigé le même jour : `router.push`. Cette branche ne sert que hors du bureau de fenêtres, qui entoure aujourd'hui toutes les pages d'un monde ; aucun écran actuel ne change.
- **Outils de développement**, le même jour : 10 → 5 failles avec npm 11 (Vitest 4.1.11, `brace-expansion`, `js-yaml`) ; les 5 restantes n'ont aucun correctif publié (`docs/SECURITE.md` §6).

**Critères d'acceptation**
- [x] `npm audit --omit=dev` ne relève plus de faille critique ni haute, ou chaque reste est justifié au registre. *0 faille en production ; les 10 restes des outils de développement sont justifiés dans `docs/SECURITE.md` §6.*
- [x] `npm run typecheck && npm run lint && npm run test` et le build passent.
- [x] Le parcours à la main ne montre aucune régression.

---
### ☑ V3.1-128 — Les cartes laissent leurs images dans le stockage · `S` · sans modèle IA — **fait le 12 octobre**

**Modèle conseillé : Sonnet** au départ. *Corrigé après coup : le ticket a demandé une migration et une fonction `security definer`, domaine d'Opus (`CLAUDE.md`, répartition par modèle). Fait par Opus.* Sous-tâches Haiku : aucune.

Trouvé le 12 octobre en écrivant `docs/QUOTAS.md` Q5. Les portraits, images de blocs et fonds d'écran effacent leur ancien fichier (`deleteAsset`). Les cartes, non :
- **Remplacer l'image d'une carte** (`components/entities/map/MapWorkspace.tsx`, `upload`) téléverse deux nouveaux fichiers (4096 px et vignette 1600 px) et remplace `assetId` et `thumbnailAssetId` dans les données du bloc. Les deux anciens restent dans le stockage et dans `assets`, désignés par rien.
- **Supprimer un bloc `map`** (`deleteBlock`, `src/server/services/blocks.ts`) ne retire l'image que pour un bloc `image`.

Chaque cas laisse ≈ 700 ko d'orphelins, sur 1 Go de stockage gratuit.

**À faire**
1. Côté serveur, à l'enregistrement d'un bloc `map` : si `assetId` ou `thumbnailAssetId` change, effacer l'ancien par `deleteAsset`, après l'écriture réussie.
2. `deleteBlock` : pour un bloc `map`, effacer ses deux images, comme pour un bloc `image`.
3. Vérifier qu'aucune autre ligne ne désigne ces images avant de les effacer (une carte dupliquée partage-t-elle ses images ? Lire « Dupliquer » avant de coder).
4. Recenser les orphelins déjà présents (lignes `assets` qu'aucun bloc, portrait ni fond ne désigne) et proposer leur nettoyage à l'auteur, sans rien effacer d'office.

**Fait le 12 octobre** (Opus, contexte déjà chargé ; décision de l'auteur, ADR 0057).
- **Les images se partagent.** `duplicateEntity` et la duplication d'un bloc recopient `assetId` : compter avant d'effacer est indispensable. Et la RLS cache certains blocs même au MJ : le compte se fait par `app.asset_reference_count`, `security definer` (migration `20261012120000`).
- `src/core/images/imagesDeCarte.ts` (10 tests) : les images qu'un enregistrement abandonne.
- `deleteAssetIfUnreferenced` (`storage.ts`) : efface après l'écriture, seulement à un compte de 0 ; un échec est journalisé.
- Branché dans `updateBlockContent` et `deleteBlock` pour les blocs `map`.
- **Migration appliquée par l'auteur** (SQL Editor) le 12 octobre. Le test d'intégration a alors révélé un **défaut plus ancien, commun à toutes les images** : `deleteAsset` effaçait la ligne `assets` avant le fichier, or la règle de lecture du stockage (`assets_bucket_select`, migration `20260902110001`) n'ouvre un fichier que si une ligne le désigne. Le fichier devenait invisible et `remove` ne retirait rien, sans erreur : chaque portrait, image de bloc ou fond d'écran supprimé depuis le 2 septembre est resté dans le stockage. Corrigé : le fichier d'abord, la ligne ensuite.
- **Orphelins existants** : `npm run recenser:images-orphelines` (lecture seule). Le 12 octobre : 19 images, 27,8 Mo, toutes dans « Faerûn », des paires carte + vignette du 1er septembre. S'y ajoutent 12 fichiers sans ligne (0,4 Mo), laissés par le défaut de `deleteAsset`. Rien n'est effacé sans l'accord de l'auteur.
- **Effacement** (demandé par l'auteur le 12 octobre) : `npm run effacer:images-orphelines`. Même liste que le recensement (`src/core/images/orphelins.ts`, 10 tests), exige l'empreinte de la liste relue, met de côté ce qui a moins d'une heure, fichier avant ligne. Essayé sur un monde jetable : orphelin effacé, image désignée gardée, fichier récent intact, empreinte fausse refusée. Lancé par l'auteur, jamais par Claude.

**Critères d'acceptation**
- [x] Remplacer l'image d'une carte, puis supprimer son bloc, ne laisse aucun fichier ni aucune ligne `assets` orpheline (test d'intégration `mapAssetsCleanup.integration.test.ts`). *5/5 sur la vraie base le 12 octobre, après la migration et la correction de `deleteAsset`.*
- [x] Une carte dupliquée garde son image quand on supprime l'original (même test, copie dans un bloc privé invisible au MJ).
- [x] `npm run typecheck && npm run lint && npm run test` passent (1603 tests).

---
### ☑ V3.1-142 — Le mot de passe d'un lien de partage se contourne par un cookie forgé · `S` · sans modèle IA — **fait le 13 octobre (ADR 0062)**

**Modèle conseillé : Opus** : sécurité.

**Constat (13 octobre, en codant V3.1-59).** `verifySharePasswordAction` (`app/partage/[token]/passwordActions.ts`) pose un cookie dont la valeur est toujours `"1"`, et dont le nom dérive du jeton (`sv_` + début de `hashShareToken(token)`). Le visiteur a forcément le jeton, puisqu'il est dans le lien : il peut calculer ce nom et poser le cookie lui-même. `hasVerifiedSharePassword` le croit, et toutes les pages du lien s'ouvrent sans mot de passe. Inscrit au registre de `docs/SECURITE.md` §3.

**À faire**
1. Une valeur que seul le serveur sait produire. Par exemple une signature HMAC du jeton et d'une échéance, par un secret serveur (variable nouvelle : `.env.example` et `scripts/verifier-secrets-build.mjs`, SECURITE §2). Ou un jeton aléatoire gardé en base avec son échéance. Choisir en disant pourquoi.
2. `hasVerifiedSharePassword` vérifie cette valeur et son échéance. Les trois appelants (layout, pages, `fond-du-wiki`) n'ont rien à changer.
3. Changer le mot de passe d'un lien invalide les cookies déjà posés.

**Critères d'acceptation**
- [x] Test : un cookie au bon nom avec la valeur `"1"` est refusé ; un cookie posé par le serveur est accepté ; un cookie échu est refusé.
- [x] Registre de `SECURITE.md` passé à « corrigée ».

**Note de clôture (13 octobre, Opus).** [ADR 0062](../adr/0062-le-mot-de-passe-d-un-lien-reste-sur-le-serveur.md).

*Plus large que prévu :*
- les **invitations** avaient le même cookie forgeable, plus grave : on pouvait rejoindre une campagne avec le seul lien ;
- en corrigeant, une seconde faille est apparue : `resolve_share_link` et `resolve_campaign_invite`, ouvertes à `anon`, renvoyaient le **hash** du mot de passe, qu'on pouvait essayer hors ligne.

*Choix de l'auteur* : fermer la fuite du hash plutôt qu'ajouter un secret serveur.

*Code :*
- **Preuve** `<échéance>.<HMAC(hash, jeton.échéance)>`, dans `src/core/shareLinks/access.ts` (7 tests).
- **Cookies** dans des modules serveur ordinaires : `lib/shareLinks/passwordCookie.ts` et `lib/campaignInvites/passwordCookie.ts`. Avant, un fichier `"use server"` en faisait une action appelable par tous.
- **Migration `20261013150000`**, appliquée par l'auteur le 13 octobre :
  - `resolve_share_link` est fermée aux visiteurs, et `publicShare.ts` résout par la clé service ;
  - `resolve_campaign_invite` ne renvoie plus que `has_password` ;
  - `campaign_invite_password_hash` est réservée à la clé service, et lue par `accountProvisioning.ts`.

*Preuves (13 octobre) :*
- `linkPasswordPrivacy.integration.test.ts` : 4/4.
- Tests existants des invitations, des liens de partage et du wiki public toujours verts : 23/23 en tout.
- **Vérifié en direct** sur un lien de test protégé, supprimé ensuite :
  - sans cookie, la porte s'affiche ;
  - avec le cookie forgé « 1 », elle reste affichée ;
  - avec un mauvais mot de passe aussi ;
  - avec le bon, elle s'ouvre, et le cookie posé vaut `<échéance>.<signature>`.

---



---

### ☑ V3.1-79 — Fiche de créature (A) : la fiche de personnage, pour une créature · `L` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] Les quatre tuiles de constantes ont la même largeur et leurs libellés tiennent sur une ligne à 920 px et 390 px.
- [x] Les composants de la fiche sont importés, pas recopiés (extraits une fois : `BouclierCA`, `EtatsEnCours`, `TuileCaracteristique`, variantes de `StatBadge` et `CommandeE`).
- [x] Une pastille ouvre l'outil de dés avec la bonne formule (test de la construction du jet).
- [x] Hors combat : aucune écriture de PV ou d'état possible depuis le bloc ; aucun champ de jeu ajouté au schéma `statblock`.
- [x] Les modificateurs sont calculés (FOR 19 → +4), jamais stockés (test).

**Réalisé** (serveur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct, hors combat et en combat, 920 et 390 px)
- Serveur : route `GET /api/entities/[id]/creature-combat` (`creatureCombat.ts`, MJ seulement, combat en cours seulement) ; une fiche de créature entre dans l'initiative (CA et PV lus dans son `statblock`) ; **seul un personnage partage son état de jeu avec sa ligne de combat** — sans cela, le déclencheur de V3.1-38 recopiait les PV d'une instance sur toutes les instances de la même créature (trouvé en direct, test d'intégration).
- Interface : `CreatureSheet.tsx` en deux colonnes, sélecteur d'instance numéroté (« … · 1 »), écritures par la route du participant sans engager le bloc. Logique pure dans `lib/ui/creature.ts`. L'anneau écrit la valeur et le maximum sur deux lignes au-delà de cinq signes (« 136 » / « /136 »).
- Reste connu : « Ce qui se recharge » reste en lecture même en combat (aucun champ de recharge dans une instance — ajout de schéma à décider) ; le repaire et les défenses ne s'affichent pas faute de champs dans `statblock` ; la tuile de caractéristique de la fiche de personnage passe ses libellés de 10–11 px à 12 px (plancher du lint).

---

### ☑ V3.1-78 — Carte (C) : la carte et sa liste par couches · `M` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] Toucher un nom centre la carte sur l'élément.
- [x] Une punaise publique sur une couche MJ n'arrive pas au joueur (vérifié en direct depuis ce bloc : la joueuse ne reçoit que la punaise publique d'une couche publique).
- [x] « Voir comme les joueurs » ne reçoit aucun élément MJ dans la réponse (test) — ajouté le 26 octobre : d'abord reporté à tort (V3.1-12 était livré, son index n'était pas à jour). `mapViewer.integration.test.ts`.
- [x] Téléphone : liste sous la carte.

**Réalisé** (interface par Sonnet, relue par Opus ; vérifié en direct, MJ, joueuse et téléphone)
- La liste par couches (`components/entities/map/CarteListe.tsx`) : en-tête de couche et ses éléments, chacun avec sa pastille de visibilité écrite par sa propre route (`map-pins`, `map-regions`, `map-layers`), sans engager le bloc ; l'annonce d'une punaise dit « (et seulement si sa couche l'est aussi) » (ADR 0017). Toucher un nom centre et agrandit (`MapCanvas` expose `centrerSur`, `zoomer`, `recadrer`). Mode référent en lecture seule. Logique pure dans `lib/ui/carte.ts`.
- « Voir comme les joueurs » (MJ seulement) : le serveur calcule la carte avec un lecteur joueur générique de la campagne (`genericPlayerViewer`, `src/core/visibility` ; `resolveMapViewer`, `mapViewer.ts`) au lieu d'emprunter un compte (« voir comme » de V3.1-12 bascule toute la session) ; `?vue=joueurs` sur les lectures de punaises, zones et couches, refusé (403) à qui n'est pas MJ — sinon un simple membre du monde y gagnerait le niveau `players`. Liste en lecture seule pendant la vue. Vérifié en direct : la vue joueurs du MJ rend exactement ce que reçoit une vraie joueuse.
- Écarts : « + Punaise » et « + Zone » ouvrent la vue agrandie (l'outil de pose vit dans `MapWorkspace`) ; dans l'aperçu public, toucher une punaise liée l'allume au lieu d'ouvrir la fiche (la vue agrandie navigue toujours) ; le wiki public montre une liste plate, faute de couches dans la donnée publique.

---

### ☑ V3.1-77 — Musique (A) : la platine, les bornes, la durée des fondus · `M` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] « 0:12 » écrit `startSeconds: 12` ; vide l'efface ; fin ≤ début refusé avec le message du schéma.
- [x] Les champs de bornes n'apparaissent pas pour Spotify / SoundCloud.
- [x] Pas-à-pas bornés à 0 et 5 s ; la platine applique la nouvelle durée au fondu suivant.
- [x] Aucun changement du lecteur de la page de lecture.

**Réalisé** (interface par Sonnet, relue par Opus ; vérifié en direct)
- Platine (service, ce qu'il permet, bornes en cours, ◂◂ lecture ▸▸), liste rangeable (dnd-kit), « ⋯ » sous la piste (bornes m:ss pour YouTube, phrase pour Spotify / SoundCloud, « Retirer la piste »), réglages (trois interrupteurs, deux pas-à-pas), ajout d'un lien avec la validation du schéma, rappel sous le bloc. Logique pure dans `lib/ui/musique.ts` (la validation réutilise `zMusicBlockData`).
- Lecteur inchangé (`MusicVoice`, `MusicPlaybackContext`, `youtubeApi`, `PublicMusicToggle`) : la durée des fondus est lue à chaque lancement de piste.
- Reste à faire : la barre de progression, les temps de la platine et la durée de chaque piste — le lecteur partagé ne publie pas la position et la donnée n'a pas de durée ; il faudra que le lecteur l'expose (ticket à part). Le fondu sortant d'une piste déjà en cours garde l'ancienne durée jusqu'à la piste suivante.

---

### ☑ V3.1-76 — Quête (C) : une ligne, dépliable · `S` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] L'anneau et « Prochain » suivent les cases cochées sans rechargement.
- [x] Les cinq états s'enregistrent (route existante).
- [x] Téléphone : récompenses et prérequis empilés.

**Réalisé** (interface par Sonnet, relue par Opus ; vérifié en direct)
- Repliée : anneau de progression, état, commanditaire, « Prochain » ; dépliée : pilule à cinq états, objectifs à cocher (barrés quand atteints), récompenses et prérequis côte à côte (empilés sous 36 rem). Ligne partagée avec le wiki public (`components/entities/quest/QuestLigne.tsx`, `PublicQuestBlock.tsx`). Logique pure dans `lib/ui/quete.ts`.
- Opus : une case d'objectif déclenchait, en plus de sa propre route, l'enregistrement du bloc (`Checkbox` → ADR 0023) : les deux écritures partaient ensemble et l'une revenait en 409. `Checkbox` gagne `ecritAilleurs`. La pilule d'état s'engage tout de suite, comme le menu d'avant (sinon perdue en quittant la page). `QUEST_STATE_LABELS_FR`, devenue inutile, est retirée.

---

### ☑ V3.1-75 — Table aléatoire (A) et le dé animé · `M` · sans modèle IA — **fait le 26 octobre**

**Critères d'acceptation**
- [x] Le tirage vient du serveur (aucun `Math.random` côté client hors des chiffres décoratifs de l'animation).
- [x] La ligne s'allume après la fin de l'animation, pas avant.
- [x] Avec sous-tirage : deux dés se figent l'un après l'autre.
- [x] Mouvement réduit : pas d'animation (test avec la préférence simulée).
- [x] « Sans répétition » : une entrée sortie ne ressort pas avant « Remettre à zéro » (test de la route).

**Réalisé** (serveur et cœur par Opus, tests d'abord ; interface par Sonnet, relue par Opus ; vérifié en direct, ordinateur, téléphone et mouvement réduit)
- Cœur : chaque tirage rend son chiffre et l'indice de la ligne (`drawOnce`), `drawExcluding` tire parmi les lignes non encore sorties (rejet borné, puis repli par le RNG avec un chiffre dans la plage), `TableExhaustedError` quand tout est sorti.
- Service et route : le tirage rend le dé, le chiffre, la ligne et les sous-tirages (`subDraws`, dé et chiffre de chaque `{table:…}`) ; `exclude` (Zod) porte les lignes déjà sorties, 409 quand la table est épuisée.
- Interface : l'animation de l'outil de dés extraite une fois (`components/shared/DeAnime.tsx`, `lib/ui/animationDe.ts`) et partagée ; la table telle qu'on la lit, renvois `{table:…}` en pastille ; résultat en carte avec ses sous-tirages ; lignes sorties barrées, « Remettre à zéro ». Logique pure dans `lib/ui/tirageTable.ts`.
- Le champ « nombre de tirages » de l'ancien bloc disparaît (absent de la planche) ; le serveur sait toujours tirer plusieurs fois.
- Reste connu : les `refs` d'une entrée s'affichent sous le résultat (le moteur ne les place pas dans le texte) ; les lignes n'ont toujours pas d'éditeur de `refs`.

---

### ☑ V3.1-73 — Généalogie (B) : les grands portraits · `M` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Conforme à la planche à 920 px et 390 px.
- [x] « Centrer l'arbre ici » change la racine sans rien enregistrer.
- [x] Ajouter un lien depuis la barre crée la relation (choix source/cible extrait et testé : `lib/ui/liensFamille.ts` ; route inchangée).
- [x] Sans données de dates, aucune ligne vide sous les noms.

**Réalisé** (donnée et cœur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct à 920 et 390 px)
- Donnée : `hasPortrait` sur chaque nœud, lu en une requête avec les dates — une carte sans portrait ne demande plus d'image vouée au 404. Le wiki public reçoit le calendrier quand l'arbre porte une date.
- Cœur : `FamilyTreeEdge.ex` (ex-partenaire) ; les ex se placent à gauche de la fiche, les partenaires actuels à droite — un ex ne se glisse plus entre un couple (test d'abord).
- Interface : cartes 100 × 130 (66 × 88 et prénoms au téléphone), nom en pastille, dates, défunt en gris, traits arrondis, ex en pointillé `--gm`, case « + enfant », zoom en bas à droite, barre sous l'arbre (ouvrir, centrer ici, ajouter et les neuf liens), glisser et pincer au doigt. Logique pure dans `lib/ui/arbre.ts` et `lib/ui/liensFamille.ts`.
- « Centrer l'arbre ici » relit l'arbre par la même route avec une autre racine (l'arbre chargé est borné en profondeur, un recalcul local ne suffisait pas) ; la donnée du bloc ne change pas (vérifié en direct).

---

### ☑ V3.1-72 — Réseau (B) : vignettes, filtres, survol qui allume · `M` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Le survol allume exactement les liens et voisins de la vignette (test de la fonction de voisinage).
- [x] Les portraits arrivent en une seule requête (test du service : nombre d'appels au dépôt).
- [x] Filtrer un genre ne masque jamais la fiche du centre.
- [x] Téléphone : premier toucher = sélection, second = ouverture.

**Réalisé** (donnée par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct, ordinateur et téléphone tactile)
- Donnée : `hasPortrait` sur chaque nœud, lu par `listEntityIdsWithPortrait` en une requête pour tout le graphe (`relationsGraph.test.ts`).
- Interface : vignettes (portrait ou icône du genre, liseré par genre : personnes `link-entity`, lieux `success`, factions `gm`, objets `players`, autres neutre), survol qui allume le voisinage (reste à 0,2) et écrit le type des liens, carte de la fiche au clic avec « Ouvrir la fiche », filtres par genre avec leur nombre, « Trouver… », « Tout montrer ». Logique pure dans `lib/ui/reseau.ts`.
- Opus : le clic sur une vignette remontait au fond, qui désélectionnait — la carte ne paraissait jamais.
- Changement de comportement : sur ordinateur, cliquer une vignette ouvre sa carte au lieu de la fiche ; « Ouvrir la fiche » est dans la carte.

---

### ☑ V3.1-71 — Relation (A) : deux portraits, le résumé, les fils à perle · `L` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Les noms longs tiennent dans le bloc (points de suspension, test visuel à 920 px et 390 px).
- [x] Le résumé change pendant le glissé, avant même l'enregistrement.
- [x] « Voir l'autre sens » ne montre jamais un bloc inverse invisible du lecteur (test serveur) ; « Créer ce bloc » absent sans droit d'écriture sur la cible.
- [x] Une cible faction ne montre pas Attirance.
- [x] Le nombre de souvenirs est calculé, jamais stocké.

**Réalisé** (serveur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct à 1440, 920 et 390 px)
- Serveur : route `GET /api/entities/[id]/relationship-face?targetId=` (`relationshipFace.ts`) — portraits, valeurs, nombre de souvenirs compté (`count: "exact"`), bloc de la paire seulement s'il est visible du lecteur ; appelée sens échangé pour « ⇄ Voir l'autre sens ». Le MJ lit les valeurs même avant l'enregistrement d'une nouvelle cible.
- Faille vue en chemin et corrigée : tout membre du monde lisait et écrivait les relations des PNJ (`docs/SECURITE.md`, registre) — gardes `canReadRelationship` et `canWriteRelationship` sur les quatre routes des attitudes et souvenirs.
- Interface : `VueRelation` (face-à-face, résumé en direct, prénoms), `PortraitRelation` (184 px, 70 × 92 au téléphone), `FilsPerles` (sept fils, « pourquoi » au survol ou au toucher, Attirance masquée hors personne), souvenirs par `SouvenirsPsyche` (troisième genre, confirmation au-delà de 40). Table unique `RELATIONSHIP_AXES_FR`. Logique pure dans `lib/ui/relationFace.ts`.
- Le résumé d'un réglage manuel ne porte plus de nombre (« Réglage manuel, vers Confiance »).
- Reste connu : une joueuse qui choisit une nouvelle cible pour la relation de son PJ voit les fils à zéro jusqu'au rechargement (le bloc n'est pas encore enregistré quand la face est relue).

---

### ☑ V3.1-65 — Bloc Texte : lettrine, bulle du paragraphe, assistance IA en encart · `M` · **avec modèle IA** — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — tout existe ; c'est un rangement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Texte ». **Départ** :
`components/blocks/TextBlockEditor.tsx`,
`components/entities/richtext/RichTextEditor.tsx`,
`src/core/schemas/blocks/text.ts`, `src/server/services/aiProposals.ts`.
**Dépend de** : 63.

**Ce qui est décidé**
- La **lettrine** devient un **interrupteur dans l'en-tête de la carte**
  (passé par `BlockCard` en action d'en-tête), au lieu d'un réglage dans le
  corps. Même champ qu'aujourd'hui.
- Toucher un paragraphe ouvre **la bulle de l'éditeur riche** : niveau de
  titre, G / I / S, Lier à une fiche, Créer une fiche, Spoiler, et la
  **visibilité du paragraphe** (Public, Joueurs, MJ). Un passage MJ est
  bordé à gauche d'orange (`--gm`) et marqué « MJ » ; un passage Joueurs
  bordé de bleu. Rappel : Spoiler est de la mise en forme, jamais de la
  sécurité (règle 6) ; le secret passe par la visibilité du paragraphe.
- **L'assistance IA** (MJ seulement, jamais dans la coquille joueur) en
  **encart violet sous le texte** : la consigne, le budget visible (ce
  qu'il reste), « Proposer ». La proposition apparaît **en pointillé à sa
  place** dans le texte ; **rien n'est écrit avant « Accepter »** (règle 9 :
  `ai_proposals` → validation → application) ; « Refuser » l'efface.

**Critères d'acceptation**
- [x] Lettrine activée depuis l'en-tête : le rendu public la montre.
- [x] Un paragraphe MJ n'est jamais envoyé à un joueur ni au wiki public (test serveur existant étendu au nouveau rendu).
- [x] Une proposition de l'IA ne modifie pas le bloc tant qu'elle n'est pas acceptée (test).
- [x] L'encart IA n'existe pas dans la coquille joueur.

**Réalisé** (Opus — ticket « avec modèle IA », vérifié contre le modèle local)
- La lettrine quitte le corps du bloc pour l'en-tête de la carte (`LettrineBouton`, emplacement `lettrine` de `BlockCard`). Elle est **aussi** dans l'en-tête de l'éditeur plein écran du téléphone : sans ça elle y devenait injoignable, faute de carte de verre.
- La bulle du paragraphe avait déjà tout ce que le ticket demande (niveau de titre, G/I/S/U, Lier à la Fiche, Créer comme Fiche, Spoiler, visibilité) : rien à coder.
- Le liseré dit désormais le niveau — bleu Joueurs (`--players`), terracotta MJ **plus la mention « MJ »**, parce que la couleur seule ne doit jamais porter l'information (impression en noir et blanc, mode fort contraste où les deux jetons deviennent le même noir).
- Encart violet (`--link-entity`, le violet du projet ; aucun jeton violet propre, même décision qu'aux emplacements de pacte) et **budget restant affiché** : `decideRateLimit` rend `remaining`, exposé par `GET /api/ai/budget`. La limite horaire existait côté serveur et n'était jamais annoncée — « Proposer » tombait en 429 sans prévenir. La proposition s'affiche en pointillé à sa place sous le texte ; rien n'est écrit avant « Accepter ».
- Tout ce qui s'affiche se décide dans `lib/ui/assistanceTexte.ts` (pur, testé) : `masquee` vide l'encart **et** les propositions en attente — une proposition d'IA ne passe jamais sous les yeux d'un joueur.

*Défaut trouvé à l'écran, invisible aux tests* : le `:not([data-visibility="public"])` de la règle existante pesait (0,3,0) et battait les règles par niveau en (0,2,0) — le bleu Joueurs ne sortait jamais. Corrigé en `:not(:where(…))`, revérifié sur les styles calculés.

*Réserve* : « l'encart n'existe pas dans la coquille joueur » est couvert par le test pur seulement, faute de compte joueur sous la main ; le câblage `hideAiAssist={playerRestricted}` n'a pas été touché.

---

### ☑ V3.1-70 — Personnalité (A) et Convictions (même dessin, comparer avec une faction) · `L` · sans modèle IA — **fait le 25 octobre**

**Critères d'acceptation**
- [x] Aucun nombre à l'écran pour un joueur (test de rendu public) ; le MJ voit la valeur au survol seulement.
- [x] ★ : deux au plus, ordre conservé (test).
- [x] Souvenir > 40 : confirmation demandée ; refuser n'écrit rien (test).
- [x] « Comparer avec » ne propose que les factions liées, puis « Autre… » ; une faction au bloc Convictions MJ n'est pas proposée à un joueur (test serveur).
- [x] La phrase de tension apparaît à 3 crans, pas à 2.

**Réalisé** (serveur par Opus ; interface par Sonnet, relue par Opus ; vérifié en direct, MJ et joueuse)
- Serveur : route `GET /api/entities/[id]/worldview-comparisons` (`worldviewComparisons.ts`) — factions liées par `member_of`, `serves`, `leads` (deux sens), ou recherche « Autre… » ; une fiche n'est proposée que si son bloc Convictions est visible du lecteur (règle 5, test d'intégration).
- Faille vue en chemin et corrigée : une aspiration MJ d'un bloc Personnalité visible partait aux joueurs et au wiki public (`docs/SECURITE.md`, registre).
- Interface : radar commun `PoleRadar` (bande nommée à chaque sommet, faction en pointillé bleu), barres `PoleBars` (★, mot de la bande, trait bleu, valeur exacte en `title` pour le MJ seulement), `PersonnaliteChamps` (aspirations en trois colonnes avec pastille de visibilité, lignes, façon de parler), `SouvenirsPsyche` (repliable, chargé à l'ouverture, saisie en une ligne, confirmation au-delà de 40, brut et appliqué). Logique pure dans `lib/ui/psycheBloc.ts`.
- Le wiki public dit « vers Curiosité » au lieu d'un écart chiffré ; le résumé d'un réglage manuel aussi (« Réglage manuel, vers Curiosité »). Les anciens souvenirs gardent leur texte.
- Reste à regarder : les mots des sommets du radar sont petits sur téléphone (le dessin est large et réduit).

---

### ☑ V3.1-69 — Noyau psyché : libellés uniques, bandes des pôles, tension, résumé · `S` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — fonctions pures, tests d'abord.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/psyche/` (`keys.ts`, `bands.ts`), et les libellés
aujourd'hui **dupliqués** dans `components/entities/psyche/`
(`PersonalityPoleSliders.tsx`, `WorldviewPoleSliders.tsx`,
`WorldviewRadar.tsx`, `WorldviewEventTable.tsx`, `PersonalityRadar.tsx`).
**Dépend de** : —.

**Ce qui est décidé**
1. **Une seule source pour les libellés des pôles** (personnalité,
   convictions) dans `src/i18n/fr.ts`, à côté des descriptions existantes
   (`PERSONALITY_POLE_DESCRIPTIONS_FR`, `WORLDVIEW_POLE_DESCRIPTIONS_FR`).
   Les composants ne gardent plus leurs propres tables.
2. **Deux renommages, libellés seulement** (clés et valeurs inchangées,
   aucune migration) :
   - `curiosity_caution` : « Circonspection ↔ Curiosité » (fin du doublon
     « Prudence » avec `impulse_prudence`) — mettre aussi à jour la
     description (« Circonspection : préfère le connu… ») ;
   - `wealth_honor` : « Profit ↔ Honneur » (description : « Profit : … »).
3. **Bandes nommées des pôles** : `poleBandLabel(ends, value)` → « neutre —
   ne s'en soucie pas » (bande 0) ou « <pôle> <léger|fort|extrême> », le pôle
   étant celui du côté de la valeur, l'adjectif **accordé** au genre du
   pôle (Altruisme fort, Dureté légère, Circonspection extrême). Seuils :
   `bandTierFor` existant (≤ −67, −34, −12, 11, 33, 66).
4. **Tension faction** : `worldviewTension(entity, faction)` → l'axe au plus
   grand écart en **crans** (différence des bandes), et l'écart ; tension
   quand l'écart ≥ 3 (specs/psyche-pnj.md §2).
5. **Résumé d'une relation** : `relationshipSummary(axes)` → les mots des
   axes dont la bande vaut ±2 ou ±3, dans l'ordre des axes
   (« aveugle, amical, admiratif et obligé ») ; « rien de marquant » s'il
   n'y en a aucun. Mots : `RELATIONSHIP_AXIS_BAND_LABELS_FR` existant.

**Critères d'acceptation**
- [x] Tests : les sept bandes de deux pôles (accord masculin et féminin), les bornes exactes des seuils.
- [x] Tests : tension à 2 crans (non), à 3 (oui), choix de l'axe le plus écarté.
- [x] Tests : résumé vide, un mot, plusieurs mots (« a, b et c »).
- [x] `grep` : plus aucune table de libellés de pôles dans `components/`.

**Réalisé** (Sonnet, tests d'abord ; relu par Opus)
- Source unique : `PERSONALITY_POLES_FR` et `WORLDVIEW_POLES_FR` (`src/i18n/fr.ts`) — libellé, mot court du radar, et les deux bouts avec leur genre grammatical en donnée ; les dix composants qui avaient leur table la lisent.
- Renommages (libellés seulement) : « Circonspection ↔ Curiosité », « Profit ↔ Honneur », descriptions comprises.
- `poleBandLabel` (accord du genre, « extrême » invariable), `worldviewTension` (écart en crans, seuil 3, pôles saisis des deux côtés seulement), `relationshipSummary` (« a, b et c »). Pas encore branchées : 70 à 73.
- Opus : identifiants du noyau remis en anglais (`gap`, `gender`…).

---

### ☑ V3.1-68 — Bloc Chronologie : l'axe en bande et une ligne par événement · `M` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — dessin décidé, schéma inchangé.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Chronologie ».
**Départ** : `components/blocks/TimelineBlockEditor.tsx`,
`components/entities/timeline/`, `src/core/schemas/blocks/timeline.ts`,
`components/shared/useWorldCalendar.ts`. **Dépend de** : 63, 64.

**Ce qui est décidé**
- En tête, **l'axe en bande** : les périodes (ères) en segments nommés, les
  événements en points, **le jour actuel en trait doré** (date du jour du
  calendrier du monde ; pas de trait si le MJ ne l'a pas réglée).
- Dessous, **une ligne par événement** : date, titre, **genre en pastille**
  (`kind`), **visibilité en pastille** (`VisibilityPill` de V3.1-64, un
  événement MJ n'est jamais envoyé à un joueur), et « → en faire une
  fiche » (crée une entité liée, même service que « Créer une fiche » du
  texte).

**Critères d'acceptation**
- [x] Le trait doré tombe sur la date du jour du monde ; absent sans date.
- [x] La pastille d'un événement suit le cycle de V3.1-64 ; un événement MJ n'arrive pas au joueur (test serveur).
- [x] « → en faire une fiche » crée l'entité et lie l'événement.

**Réalisé** (Sonnet, relu et corrigé par Opus)
- Axe en bande (`AxeBande`, positions pures testées dans `lib/ui/axeBande.ts`) : ères en segments, périodes en barres, événements en points, trait doré à la date du jour du monde (absent sans date) ; toucher l'axe ajoute un point, glisser une période.
- Une ligne par événement : genre en pastille, date, titre, `VisibilityPill` (écriture optimiste, « Privé » sauté hors auteur), « → en faire une fiche » par la route de promotion existante, puis « ◆ nom ».
- Test serveur ajouté (Opus) : un événement MJ de la Chronologie d'une fiche ne part jamais au visiteur du wiki public, l'événement public si (`publicShare.integration.test.ts`).
- Défaut corrigé en vérifiant (Opus) : « → en faire une fiche » échouait (409). Le bouton se désactivait pendant l'envoi, perdait le focus, et la carte s'enregistrait « à la perte du focus » en même temps : la promotion arrivait avec une version périmée. Le bouton reste focusable, se dit occupé et ignore le second clic.
- Colonne du genre de largeur fixe (les titres se décalaient).
- Vérifié au navigateur (fiches de test supprimées) : pastille Public → Joueurs enregistrée, promotion qui crée la fiche et lie l'événement.

*Écarts* : plus de zoom ni de panoramique dans l'éditeur (bande fixe de la planche) ; couleurs de genre regroupées en cinq jetons.

---

### ☑ V3.1-67 — Bloc Image : la barre flottante et l'aperçu dans le texte (B) · `M` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — tous les champs existent déjà ; c'est l'interface.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, carte « Image ». **Départ** :
`components/blocks/ImageBlockEditor.tsx`, `src/core/schemas/blocks/image.ts`
(lire son commentaire en entier), `src/core/images/blockAnchor.ts`.
**Dépend de** : 63.

**Ce qui est décidé (B)**
- Aujourd'hui : neuf réglages en liste sous l'image. Demain :
- **Toucher l'image fait paraître une barre flottante** sur elle :
  Gauche / Centre / Droite (`align`), « − taille + » (`sizePct`, 50–200 %,
  pas de 10), « Le texte contourne » (interrupteur : `anchorFlow` `float`
  quand activé, `break` sinon).
- **L'aperçu** montre l'image **dans le texte**, telle qu'elle sera dans le
  wiki, avec sa légende dessous (éditable sur place).
- **À part, dans un encart sous l'aperçu** :
  - Emplacement : « Bloc autonome » (`placement: "flow"`) ou « Dans un bloc
    de texte » (`placement: "anchored"` + choix du bloc et du paragraphe,
    curseur à N + 1 crans comme aujourd'hui) ;
  - Parallaxe (`parallaxPct`, 0–40) ;
  - Fond de la page du wiki, trois choix : « Non » (`useAsWikiBackground:
    false`), « En fond et dans la fiche » (`true` + `alsoShowInFlow: true`),
    « Seulement en fond » (`true` + `alsoShowInFlow: false`) ; avec flou
    (`backgroundBlurPx`) et fondu (`fadeMs`) **seulement si** un fond est
    choisi.
- `wrapMode` n'apparaît pas (lu seulement, comme aujourd'hui).

**Critères d'acceptation**
- [x] Chaque contrôle de la barre écrit le bon champ (test de la correspondance contrôle → champ).
- [x] Les trois choix de fond donnent les bonnes paires de valeurs (test).
- [x] Flou et fondu n'apparaissent qu'avec un fond.
- [x] Un bloc enregistré avant ce ticket s'affiche à l'identique (pas de réécriture en base).

**Réalisé** (Sonnet, relu par Opus)
- `ImageBlockEditor` refait : toucher l'image ouvre la barre (Gauche / Centre / Droite, − taille +, « Le texte contourne »), Échap la ferme ; aperçu dans le vrai texte du bloc hôte, légende éditable dessous ; encart Emplacement, Parallaxe, Fond (trois choix), flou et fondu seulement avec un fond. Libellés de l'éditeur sortis du code vers `fiche.image`.
- Correspondance contrôle → champ et choix de fond en fonctions pures (`lib/ui/imageBloc.ts`, testées) ; test qu'aucun `onChange` ne part au montage.
- Vérifié au navigateur (fiche de test supprimée) : ouvrir la fiche n'écrit rien ; Droite, 110 %, ancrage dans le texte, fond « en fond et dans la fiche » enregistrés ; flou et fondu absents sans fond.
- Catalogue : Encadré, Tableau et Image passent de la planche 3 (qui dépassait 8 000 px) à la planche 8 « Wiki visuel » ; la deuxième rangée du canevas descend sous la première.

*Choix* : « Centre » coupe le contournement (un flottement centré n'existe pas en CSS) ; sans ancrage dans un texte, « Le texte contourne » est grisé avec la raison.

---

### ☑ V3.1-66 — Blocs Encadré et Tableau · `M` · sans modèle IA — **fait le 25 octobre (ADR 0067)**

**Modèle conseillé : Sonnet** — décisions prises ; une seule à trancher dans le ticket (tranchée ci-dessous).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html`, cartes « Encadré » et
« Tableau ». **Départ** : `components/blocks/InfoboxBlockEditor.tsx`,
`components/blocks/CustomTableBlockEditor.tsx`,
`src/core/schemas/blocks/infobox.ts`, `customTable.ts`. **Dépend de** : 63.

**Encadré — ce qui est décidé**
- Les lignes se **lisent comme dans le wiki** (intitulé à gauche, valeur à
  droite) et **s'éditent sur place** (toucher l'intitulé ou la valeur) ;
  ⠿ pour réordonner ; × au survol pour retirer ; « + ligne ».
- **« @ » dans une valeur cite une fiche** (même mention que dans le texte).
- **Intitulés suggérés selon le type de fiche** : en tapant un intitulé, une
  liste propose ceux du type (PNJ : Race, Âge, Rôle, Allégeance… ; Lieu :
  Région, Population, Dirigeant… ; Faction : Siège, Chef, Fondation…).
  **Tranché ici : une constante dans le fichier de libellés**, clé = genre
  d'entité (`entityKind`), pas une table en base (rien à migrer ; à revoir
  au troisième besoin de personnalisation). Pour un genre sans liste : pas
  de suggestion.

**Tableau — ce qui est décidé**
- Un **vrai tableau** (`<table>` accessible) éditable en cellules.
- × de colonne (dans l'en-tête) et × de ligne (au bout) **au survol** ;
  « + » au bout des en-têtes pour une colonne, « + Ligne » dessous.

**Critères d'acceptation**
- [x] Encadré : réordonner, éditer sur place, « @ » qui crée une vraie mention (même test que le texte).
- [x] Les suggestions dépendent du genre de la fiche (test de la fonction de suggestion).
- [x] Tableau : ajouter et retirer lignes et colonnes ; navigation au clavier entre cellules (Tab).

**Réalisé** (Sonnet pour les éditeurs, Opus pour la mention et un défaut d'affichage)
- Encadré : lecture comme au wiki, édition sur place, ⠿ souris et clavier, × au survol et au focus, « + Ligne », intitulés proposés selon le genre (`lib/ui/encadre.ts`, testé ; listes dans les libellés, en pastilles comme la planche).
- **Mention « @ »** (ADR 0067, choix de l'auteur : des nœuds comme le texte) : `zInfoboxValue` = chaîne ou nœuds ; champ `ValeurAvecMentions` (liste des fiches, flèches, Entrée, Échap ; mention en pastille avec ×) ; saisie pure testée (`lib/ui/mentionValeur.ts`) ; résolution serveur comme le texte (wiki public et vue joueur) ; test d'intégration : une fiche masquée citée ne devient jamais un lien.
- Tableau : vrai `<table>`, × de colonne et de ligne au survol et au focus, « + » et « + Ligne », Tab de cellule en cellule, noms de colonne en double suffixés (« Prix 2 ») (`lib/ui/tableauBloc.ts`, testé).
- **Défaut ancien corrigé** (vu en vérifiant, présent avant V3.1-63 et en production) : un bloc Image, Encadré ou Tableau ajouté n'apparaissait qu'après rechargement — son éditeur, chargé à la demande, suspendait la carte sans frontière. Le corps de chaque carte est désormais dans un `Suspense`.
- Vérifié au navigateur sur une fiche Lieu de test (supprimée) : suggestions, mention enregistrée en nœuds, colonnes et lignes ajoutées et retirées, Tab.

*Écart* : les intitulés proposés sont des pastilles (planche) plutôt qu'une liste sous le champ (ticket).

---

### ☑ V3.1-64 — La pastille de visibilité au toucher, avec « Annuler » · `S` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — comportement entièrement décrit ; route existante.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Blocs-Recit-Decide.dc.html` (toutes les cartes ; essayer la
pastille). **Départ** : `BlockCard` (V3.1-63),
`components/shared/visibilityOptions.ts`, la route de mise à jour de
visibilité d'un bloc utilisée aujourd'hui par `EntityBlocks.tsx`.
**Dépend de** : 63.

**Ce qui est décidé (demande de l'auteur)**
- Un toucher sur la pastille fait passer à la visibilité **suivante** :
  Public → Joueurs → MJ → Privé → Public. Couleur et libellé suivent
  aussitôt (mise à jour optimiste, remise en place si le serveur refuse).
- Chaque changement **s'annonce** dans une annonce discrète en bas de la
  fiche : « « Rumeurs de Phandaline » : visible par le MJ seul. » avec un
  bouton **« Annuler »** (remet la valeur précédente). Quand le bloc devient
  **plus visible** qu'avant (MJ → Privé → Public…), l'annonce ajoute
  « Attention : il redevient visible. ».
- Phrases exactes : Public = « tout le monde, wiki public compris » ;
  Joueurs = « la table, pas le wiki public » ; MJ = « le MJ seul » ; Privé =
  « son auteur seul ».
- Le choix direct reste dans ⋮ « Choisir la visibilité… » (tous les
  niveaux, y compris campagne et utilisateur, qui **ne font pas partie du
  cycle** : un bloc à l'un de ces niveaux passe à Public au premier
  toucher, avec l'annonce).
- Valable pour **tous les blocs**, et pour la pastille de chaque événement
  de la Chronologie (V3.1-68), chaque aspiration (V3.1-70), chaque punaise
  et couche de la Carte (V3.1-78) — un seul composant `VisibilityPill`.
- **Limite assumée** : l'écriture est immédiate, d'où l'annonce et
  « Annuler ». La visibilité reste filtrée côté serveur (règle 5).

**À faire** : composant `VisibilityPill` (props : niveau, `onChange`,
libellé de l'objet pour l'annonce) ; annonce avec « Annuler » (réutiliser le
composant d'annonce existant s'il y en a un, sinon le créer une fois) ;
planche du catalogue.

**Critères d'acceptation**
- [x] Quatre touchers ramènent à la visibilité de départ ; chaque étape est enregistrée (test de composant + route).
- [x] « Annuler » rétablit la valeur précédente côté serveur.
- [x] L'annonce dit « Attention : il redevient visible. » quand on va vers plus visible.
- [x] Lecteur d'écran : la pastille annonce sa valeur et l'action (« Visibilité : MJ. Toucher pour passer à Privé »).
- [x] Un refus du serveur remet l'ancienne pastille et l'annonce le dit.

**Réalisé** (Sonnet, relu et corrigé par Opus)
- `VisibilityPill` (composant partagé, pour 68, 70, 78) ; cycle, « plus visible que » et annonce en fonctions pures (`lib/ui/visibilitePastille.ts`, testées) ; annonce `AnnonceVisibilite` avec « Annuler », créée faute d'existante ; écriture optimiste par la route de bloc existante, ancienne valeur rendue sur refus.
- Vérifié au navigateur : quatre touchers enregistrés (200), annonces et avertissement, « Annuler » rétablit côté serveur.
- Opus :
  - les libellés étaient rangés dans l'espace `outilDes` (pastille sans nom accessible) : déplacés dans `fiche` ;
  - **« Privé » = son auteur seul** : la RLS refusait qu'un MJ y passe le bloc d'un autre, la route répondait 500 et le cycle restait bloqué. Désormais `updateBlockContent` refuse proprement (403), `listVisibleBlocks` marque `nonAuteur`, et la pastille comme le choix de ⋮ sautent Privé pour ces blocs (test d'intégration « V3.1-64 », `entityHistory.integration.test.ts`).

*Écarts* : « plus visible » au sens strict (seul Privé → Public, ou campagne/utilisateur → Public, avertit ; MJ → Privé restreint). Le choix direct de ⋮ n'offre pas campagne et utilisateur (il faudrait un sélecteur de campagne ou de personne).

---

### ☑ V3.1-63 — Fiche du wiki sur ordinateur : en-tête, cartes de verre, palette en familles · `L` · sans modèle IA — **fait le 25 octobre**

**Modèle conseillé : Sonnet** — planche définitive, aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Wiki-Fiche-Decide.dc.html`. **Départ** :
`app/m/[worldSlug]/(monde)/f/[entitySlug]/page.tsx` et `EditEntityForm.tsx`,
`components/blocks/EntityBlocks.tsx` (`BLOCK_TYPE_LABELS`,
`BlockDataEditor`, l'ajout de bloc), `components/shared/ActionsMenu.tsx`,
`components/shared/visibilityOptions.ts`, `components/entities/RelationsChips.tsx`,
`components/entities/PortraitUpload.tsx`, `components/entities/EntityHistoryPanel.tsx`.
**Dépend de** : 20 (fenêtres à volets), 25 (pilule).

**Ce qui est décidé**
- La fiche **s'édite directement**, au verre minéral, dans la fenêtre à
  volets du MJ (V3.1-20). C'est l'écran le plus utilisé du MJ. Le téléphone
  garde l'éditeur de V3.1-30 et 31 (rien à changer ici sur téléphone).
- **En-tête** :
  - le titre, éditable sur place ; sur une fiche neuve, le nom par défaut
    est **sélectionné** (on tape directement par-dessus) ;
  - le **type ▾** (PJ, PNJ, Lieu… et « + Créer une catégorie » en bas du
    menu — même service que la création de catégorie d'aujourd'hui) ;
  - l'**historique** (ouvre `EntityHistoryPanel`) et l'**œil du wiki
    public** (même lien qu'aujourd'hui) ;
  - l'**adresse** (slug) dessous, en petit ;
  - **Alias** et **Relations** en pastilles, × pour retirer, « + » pour
    ajouter (relations : `RelationsChips`, même route qu'aujourd'hui) ;
  - le **portrait à droite** (`PortraitUpload`).
- **Une carte de verre par bloc.** En-tête de la carte, de gauche à droite :
  - ⠿ pour glisser (réordonner), **aussi au clavier** (focus sur ⠿, puis
    flèches haut/bas, Entrée pour poser, Échap pour annuler) ;
  - ▾ / ▸ pour replier / déplier (l'état replié est une préférence locale
    de l'éditeur, pas une donnée du bloc) ;
  - le titre du bloc, **éditable sur place** (`display.label`) ;
  - le type en pastille (« Texte », « Relation »…, `BLOCK_TYPE_LABELS`) ;
  - « Enregistré », annoncé poliment (`aria-live="polite"`) après chaque
    sauvegarde réussie ;
  - **la visibilité en pastille de couleur** : vert Public, bleu Joueurs,
    orange MJ, gris Privé (jetons de la charte ; « campagne » et
    « utilisateur » gardent leur libellé actuel). Son comportement au
    toucher est V3.1-64 ; ici elle ouvre seulement l'infobulle qui dit qui
    la voit (« le MJ seul — jamais envoyé aux joueurs ») ;
  - ⋮ (`ActionsMenu`) : Monter, Descendre, Dupliquer, Choisir la
    visibilité…, Supprimer…. **Les ▲▼ d'aujourd'hui passent dans ⋮.** La
    suppression est confirmée (`ConfirmDialog`) et rappelle que
    l'historique la garde.
- **« + Ajouter un bloc »** en bas ouvre la palette **en familles**, dans
  cet ordre :
  - Récit : Texte, Encadré, Image, Tableau, Chronologie ;
  - Personnage : Personnage, Inventaire, Incantation, Ressources, Fiche de
    créature ;
  - Psyché et liens : Personnalité, Relation, Convictions, Réseau,
    Généalogie ;
  - Outils de jeu : Table aléatoire, Quête, Musique, Carte.
  - `generator`, `note_tree` et `session_journal_meta` **n'apparaissent
    pas** dans la palette (comme aujourd'hui pour le dernier).
- **Fenêtre étroite** (tablette, volet partagé — requête de conteneur, pas
  `window.innerWidth`) : portrait réduit, blocs Personnalité et Convictions
  sur une colonne, pastille de type masquée dans l'en-tête de carte.
- **Données** : rien de neuf.

**À faire**
1. Extraire l'en-tête de carte en un composant partagé `BlockCard`
   (`components/blocks/BlockCard.tsx`) : il porte ⠿, ▾, titre, type,
   « Enregistré », pastille, ⋮, et reçoit l'intérieur en `children`. Tous
   les blocs passent par lui ; les tickets 65 à 79 n'y touchent pas.
2. Refaire l'en-tête de fiche dans `EditEntityForm.tsx`.
3. Palette en familles (constante ordonnée dans `EntityBlocks.tsx`, libellés
   des familles dans le fichier de libellés).
4. Planche du catalogue : en-tête de fiche, `BlockCard`, palette.

**Ne pas faire** : toucher l'intérieur des blocs (tickets suivants) ;
changer le téléphone ; ajouter un type de bloc.

**Critères d'acceptation**
- [x] Une fiche neuve s'ouvre le nom sélectionné ; taper le remplace.
- [x] Réordonner un bloc au clavier (⠿ + flèches + Entrée) fonctionne et s'annonce.
- [x] Les ▲▼ ont disparu des cartes ; Monter / Descendre sont dans ⋮.
- [x] La palette montre quatre familles, dans l'ordre ci-dessus, sans `generator`, `note_tree`, `session_journal_meta`.
- [x] En fenêtre étroite (volet partagé), la pastille de type disparaît et le portrait se réduit (test visuel à 820 px de volet).
- [x] Aucun changement côté téléphone (390 px).

**Réalisé** (Sonnet, relu et corrigé par Opus)
- `BlockCard` (⠿, ▾/▸ en préférence locale, titre éditable, type, « Enregistré », pastille de visibilité, ⋮ : Monter, Descendre, Dupliquer, Choisir la visibilité…, Supprimer…) ; `SortableBlockCard` ne garde que le câblage.
- En-tête de fiche refait (`EditEntityForm.tsx`) ; portrait réduit en fiche étroite.
- Palette en familles (`lib/ui/ficheBlocs.ts`, testée) ; `BarreAjoutBloc` reste celle de l'éditeur téléphone.
- Glisser au clavier : celui de dnd-kit (Entrée, flèches, Entrée, Échap) avec des annonces françaises calculées par `annonceReordonnancement`.
- Jeton `players` (bleu Joueurs) ajouté à la charte, tous modes.
- Vérifié au navigateur : 1440 px, 820 px (type masqué, portrait sous l'en-tête), 390 px ; menu ⋮ et palette.

*Écarts* :
- La fiche affichée au téléphone (pas l'éditeur) prend aussi les cartes de verre : elle partage le composant. Le titre de bloc y était coupé ; corrigé par une taille réduite en carte étroite (`.block-title-carte`, requête de conteneur).
- `session_journal_meta` ne se pose plus à la main sur ordinateur, comme le demande le ticket.
- La pastille vit dans `BlockCard` ; V3.1-64 l'extrait en `VisibilityPill`.

---

### ☑ V3.1-114 — Ressources : repos et égaliseur · `S` · sans modèle IA — **fait le 25 octobre (ADR 0045)**

**Modèle conseillé : Sonnet.** **Dépend de** : 113, 24, 26.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `takeShortRest` rend les emplacements de pacte et une utilisation des
  `short_rest_one` ; `takeLongRest` rend tout.
- L'égaliseur (planche « Décidé · emplacements et ressources de classe »)
  montre la réserve de pacte à part ; une ressource de plus de six
  utilisations en compteur.

**Reçu de V3.1-113** (13 octobre) : les deux repos rendent déjà la réserve de pacte et une utilisation des `short_rest_one` (`rechargeTrackers`). Il reste l'écran :
- montrer `sheet.spellcasting.pactSlots` et `pact_slots_used`, à part ;
- d'ici là, un occultiste ne voit pas ses emplacements de pacte, mais `castSpell` les dépense déjà.

**Critères d'acceptation**
- [x] Les trois cas de V3.1-40 se voient sur la fiche.

**Réalisé**
- Égaliseur (`components/blocks/Egaliseur.tsx`, Sonnet, relu) d'après la planche « Fiche-Emplacements » : groupes « Emplacements de sorts » (niveaux, puis la réserve de pacte à part), « Classe », « Traits » ; compteur au-delà de six ; recharge sous chaque colonne ; la ligne défile au téléphone. Il remplace la ligne d'emplacements et la liste « Ressources » de l'onglet Actions.
- Répartition pure `lib/ui/egaliseur.ts` (tests d'abord) : « Classe » = ressource dont la source est une classe ou sous-classe du personnage.
- Route `actions/spell-slot` : dépenser ou rendre un emplacement ou un de la réserve de pacte à la main, borné, derrière l'interrupteur « spell_slots » (test d'intégration, docs/SECURITE.md).
- Vérifié au navigateur (ordinateur et 390 px), fiches de test du MJ supprimées : occultiste 3 (« Pacte niv. 2 », court) ; clerc 3 / magicien 2 (4/3/2) ; Conduit divin « 1 au court » en Classe, 8 points de chance en compteur ; geste de pacte enregistré.

*Écart* : pas de jeton violet propre au pacte ; emplacements et pacte prennent `link-entity`, le pacte se distingue par son libellé et un séparateur.


---

### ☑ V3.1-112 — Sauvegardes : les écrans · `M` · sans modèle IA — **fait le 24 octobre (ADR 0044)**

**Modèle conseillé : Sonnet.** **Dépend de** : 111, 33, 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- La cible reçoit un **bandeau au premier plan** : « Résiste à Moquerie
  cruelle · JS Sagesse DD 13 » — « Lancer », « J'ai un vrai dé »
  (interrupteur « modificateur inclus »), « Laisser le MJ saisir ».
- Le MJ répond dans l'outil **Initiative** en combat (bandeau), dans
  l'outil **Table** hors combat ; une **pastille sur le dé encoché** compte
  les demandes en attente, où qu'on soit.
- L'outil de dés de l'auteur affiche le verdict revenu, puis enchaîne.

**Critères d'acceptation**
- [x] Les trois façons de répondre fonctionnent, sur ordinateur et téléphone.

**Réalisé** (détail dans l'ADR 0044, « Réalisation des écrans »)
- Migration `20261024120000_save_requests_realtime.sql` (appliquée le 24 octobre) : `save_requests` en temps réel.
- `SauvegardesProvider` (AppShell) : la liste arrive avec la page, un seul canal la suit ; `lib/ui/sauvegardes.ts` pur et testé.
- Bandeau de la cible, liste du MJ (Initiative : le combat ouvert ; Table : toutes), pastille du dé encoché, verdict dans l'outil de l'auteur (Sonnet, relu).
- Libellé de la demande : nom traduit du sort (« Flamme sacrée · JS Dextérité DD 13 »).
- Vérifié au navigateur, MJ et Testeuse A, ordinateur et 390 px : lancer, vrai dé « modificateur inclus », laisser le MJ puis saisie du MJ ; bandeau et pastille en direct ; « En attente » puis verdict chez l'auteur. PV de A remis à 12/12.

*Écart* : « Laisser le MJ saisir » n'écrit rien (le bandeau se replie, le temps de la page).
*Restes* (audit V3.1-144) : sauvegardes laissées en attente par un combat supprimé ; clé du sort dans l'historique des jets.


---

### ☑ V3.1-106 — Cibler côté MJ : outil de dés, Table, Initiative · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet.** **Dépend de** : 105, 33 (outil de dés), 34, 38.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- « Cibler » s'allume dans l'outil de dés **pour le MJ** quand une
  initiative est `running` : liste des participants (alliés pour un soin),
  cible retenue affichée ; grisé hors initiative ou pour un jet sans cible.
- « Lancer » appelle `resolveTargetedRoll` ; une touche fait apparaître la
  bande « Lancer les dégâts » (même cible) ; verdict et changements affichés.
- Même chemin depuis l'outil Table (action d'un PNJ) et l'outil Initiative.
- *Repris de V3.1-33 (17 octobre)* : les boutons d'attaque, de sort et de
  dégâts de la fiche ouvrent l'outil pré-rempli (`openDiceTool`) ; la bande
  du pied (place déjà réservée dans `OutilDes.tsx`) devient « Lancer les
  dégâts » sur une touche, et « Valider · dégâts » / « Faire échouer » quand
  un monstre touche un joueur (critères de V3.1-33 restés ouverts).

*Déjà fait le 24 octobre, depuis l'outil Initiative (suite de V3.1-38)* :
« Cibler » et la liste des participants, les dés du jet ciblé affichés,
l'avantage au choix, la bande « Lancer les dégâts » après une touche (même
cible, critique compris). Reste : l'outil de dés **ouvert seul** par le MJ
pendant une initiative, l'outil Table, les boutons de la fiche, et
« Valider · dégâts » / « Faire échouer ». *Relevé le 24 octobre* : après
« Lancer les dégâts », la grille de l'outil garde le d20 de l'attaque (le
préréglage n'est pas remplacé par celui des dégâts) — à régler ici.

**Critères d'acceptation**
- [x] Au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS, À terre
  appliqués (planche de la Table).
- [x] Hors initiative, les jets restent de simples jets.

**Livré le 24 octobre.** Interface (Sonnet) : les boutons Attaquer, Dégâts,
attaque de sort et lancer de sort de la fiche ouvrent l'outil de dés
pré-rempli (mêmes routes ; dés, paire et d20 gardé par `rollsForDisplay`) ;
après une touche, « Lancer les dégâts · formule » (critique compris,
`pendingCrit` retiré) ; pour le MJ pendant une initiative en cours, au
toucher du bouton, « Cibler » et `targeted-roll` (`lib/ui/ficheDesApi.ts`,
deux lectures) ; effet à la place du verdict (« Worg : 26 → 13 PV ») ;
« Valider · dégâts » / « Faire échouer » quand un monstre touche un PJ
(`lib/ui/jetCibleOutil.ts`, partagé avec l'initiative) ; la grille passe aux
dés des dégâts. Corrections d'Opus : (1) depuis la fiche, l'attaque de sort
n'est JAMAIS ciblée — `spell_attack` dépense l'emplacement et applique les
dégâts d'un coup, et le bouton « Dégâts » du même sort l'aurait relancé
(emplacement dépensé deux fois) ; un sort ciblé se lance depuis la ligne de
l'initiative ; (2) **défaut de 105 trouvé en vérifiant** : le serveur
cherchait l'action d'un monstre dans le bloc brut (« Bite ») alors que
l'écran envoie le nom traduit (« Morsure ») — aucune attaque de monstre
ciblée n'aboutissait en français, et une variante ne trouvait pas le
monstre de sa base ; `loadMonsterBlocks` lit désormais par
`getRuleEntryForWorld` (chaîne du ruleset, surcharges, langue), et le test
d'intégration envoie le nom traduit comme l'écran. Vérifié en direct (MJ de
test, combat avec un Worg du bestiaire et Testeuse A) : depuis la fiche de
A ouverte dans l'initiative, Attaquer → Cibler le Worg → touché → « Lancer
les dégâts · 2d6+3 » → Worg 26 → 13 PV, grille en 2d6+3 ; Morsure du Worg
sur A → touché → « Valider · dégâts » / « Faire échouer » → les PV de A
restent à 12. Combats d'essai supprimés, PV remis. Planche : section
« Outil de dés unique » de `Ecrans.dc.html`. *Écarts* : l'outil Table ne
liste que des PJ (aucune action de PNJ à brancher) ; les dégâts à deux
mains restent un simple jet (`targeted-roll` ne les connaît pas) ; l'effet
s'écrit « Worg : 26 → 13 PV » plutôt que « Worg −13 PV ».

*Relevé par l'auteur le 24 octobre, corrigé* : ancré au dé du rail par le
bas, le panneau de l'outil de dés grandissait vers le haut sans limite et
son en-tête (titre, Secret, ×) sortait de l'écran. Sa hauteur se borne
maintenant à l'espace au-dessus de son ancrage, et il défile au-delà
(`PanneauFlottant`, `OutilDes.tsx`) ; vérifié à 1280×800 et 1280×640.

---

### ☑ V3.1-38 — L'outil Initiative refondu, MJ et joueur · `L` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive, données fournies par V3.1-37.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · initiative (A retouchée) ». **Départ** :
`components/shell/InitiativeTracker.tsx`, `app/m/[worldSlug]/mj/initiative/page.tsx`.
**Dépend de** : V3.1-37, V3.1-24 (PV temporaires), V3.1-26 (jauges),
V3.1-29 (téléphone), V3.1-33 (outil de dés).

- MJ, ordinateur et téléphone : tout le détail de la décision (V3.1-19,
  lot i) — colonnes CA / PV alignées, score modifiable qui réordonne,
  lignes dépliables avec toutes les actions en deux boutons (touche,
  dégâts), PV temporaires, renommage avec le nom d'origine en petit,
  menace restante, Commencer / Round 1 / fin confirmée.
- Joueur : invitation au premier plan (lancer, ou vrai dé avec
  l'interrupteur « modificateur inclus »), mode combat dans Perso. (ordre,
  économie d'action, Actions · Sorts · Capacités), retour à la fiche
  normale à la fin.

**Critères d'acceptation**
- [x] Le parcours de la planche, de « Commencer » à la fin confirmée, avec un MJ et deux joueurs (dont un sans l'application).
- [x] « Quitter le combat » puis « Reprendre tel quel » : ordre, PV et états intacts ; « Recommencer » relance l'initiative et renvoie l'invitation.
- [x] Côté joueur, le mode combat garde la fiche complète (même composant que hors combat), l'ordre du tour en tête.
- [x] Un dégât porté depuis la fiche du joueur se voit aussitôt dans l'initiative du MJ, et inversement (même état de jeu).
- [x] À 390 px et sur ordinateur, côté MJ et côté joueur.
- [x] Planche du catalogue « Initiative » créée ou mise à jour.
- [x] Un adversaire saisi à la main reçoit CA et PV dès l'ajout ; la liste des combats suit l'état (commencé, terminé) sans recharger (vu par la vérification du 11 octobre).

**Livré le 24 octobre.** Serveur (Opus) : migration
`20261024090000_combat_paused_realtime` (appliquée le 24 octobre) — statut
`paused` (choix de l'auteur : suspendu ≠ terminé), `combats` publiée en temps
réel, et un déclencheur qui recopie PV, PV temporaires et états d'un PJ vers
ses combats non terminés (sans lui, un dégât porté depuis la fiche ne
remontait jamais chez le MJ). Conséquence corrigée : une sauvegarde ratée par une
joueuse lisait l'« avant » de sa ligne de combat après la recopie, et
l'annulation du MJ ne rendait rien ; l'« avant » se lit désormais dans sa
vue filtrée, avant d'écrire (`saveRequests.ts`). Noyau `canPauseCombat`, `resumedCombatStatus`
(tests d'abord) ; services et routes `pause`, `resume`, `restart` ; un combat
suspendu n'est plus « en cours » pour les joueuses ; renommer un participant
(`label`, annulable) ; CA et PV d'un adversaire saisi à la main ; le jet
d'initiative d'une joueuse renvoie son d20. Tests d'intégration
(`combatPause.integration.test.ts`, 5 cas). ADR 0040 complétée, SCHEMA.md.
Interface (Sonnet, deux agents en parallèle) : outil du MJ refait
(`components/shell/initiative/`, `lib/ui/initiative.ts`, `initiativeApi.ts`,
temps réel sur `combats`) ; côté joueuse, `components/shell/combat/`
(invitation, ordre du tour, économie d'action au-dessus de la fiche
inchangée), `lib/ui/combatJoueur.ts`. Vérifié en direct (MJ de test,
Testeuse A, Testeur B joué « sans l'application ») : gobelin saisi à 13 CA
et 7 PV ; « Commencer » lance les adversaires et l'invitation arrive chez A
sans recharger ; jet, résultat, « validé dans 4 s… », fermeture ; saisie du
MJ pour B ; Round 1 ; ordre du tour chez A ; PV fiche → MJ (12 → 11 par la
route de la fiche) et MJ → fiche (9/12) ; Quitter (A revient à sa fiche),
Reprendre tel quel (round, PV, initiatives intacts), Recommencer
(invitation renvoyée) ; renommé « Monstre non identifié », A ne voit jamais
« Gobelin » ; ordinateur et 390 px des deux côtés. Combats d'essai supprimés,
PV de A (12/12) et B (10/11) remis. Planche : section « Initiative » de
`OutilsMJ.dc.html` refaite.

*Restes* : la fin confirmée et la liste des combats en temps réel n'ont pas
été rejouées en direct (code relu) ; au téléphone, les noms du MJ
sont très tronqués ; le volet de dés s'ouvre après le jet d'initiative,
par-dessus la fiche ; le bleu des PV temporaires est une constante locale,
à promouvoir en jeton.

*Suite du 24 octobre — les dés des jets ciblés* : le serveur renvoie
`dice` (total, étapes, paire d'avantage, d20 gardé) pour l'attaque, les
dégâts et l'attaque de sort (`rollsForDisplay`, `src/core/dice/diceTool.ts`,
testé) ; l'outil de dés laisse choisir l'avantage d'un jet ciblé d'attaque
(`avantageLibre`) et propose, après une touche, « Lancer les dégâts » sur la
même cible, critique compris (`SuiteDeJet`, d'après le `chained` du
serveur). Vérifié en direct : attaque avec avantage (d20 1 et 8, 8 gardé,
total 13, « Touché »), puis dégâts 2d6+3 = 15 sur le gobelin. Le
doublement au critique passe par le chemin serveur déjà testé
(`targetedRoll.integration.test.ts`) ; non rejoué en direct, faute de 20
naturel. Après les dégâts, la grille de l'outil garde le d20 de l'attaque
(le préréglage n'est pas remplacé) : cosmétique.

---

### ☑ V3.1-57 — Règles actives : le ruleset à gauche, la table à droite · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; données et serveur de V3.1-23.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Regles-Decide.dc.html`. **Départ** :
`components/rules/RulesetSelector.tsx`, `RulesetImportMappingDialog.tsx`,
cas `regles-actives`. **Dépend de** : **23** (interrupteurs,
`campaigns.table_settings`, refus serveur), 26 (fiche).

**Ce qui est décidé**
- **À gauche, le ruleset** :
  - « Ruleset de la campagne » : les variantes **en arbre sous leur base**
    (trait de rattachement) ; pastilles « officiel », « variante »,
    « référence personnelle » ; « ● actif » ou « Choisir » ; « Exporter »
    sur une variante **jamais sur une référence personnelle** ; × sur une
    variante, confirmé en surface flottante (« Supprimer la variante « … » ?
    Ses fiches de règles disparaissent ; la campagne revient à … » si elle
    est active) ;
  - « Créer une variante » : la base en puces, le nom, « Créer » (grisé sans
    nom), l'interrupteur « Référence personnelle » (« Contenu saisi depuis
    un ouvrage que je possède ») et son avertissement
    (`referencePersonnelleAvertissement`, texte inchangé) ;
  - « Importer des règles » : « Ajouter à la variante active » / « Créer un
    nouveau ruleset personnel » en puces, l'aide (textes existants de
    `messages/fr.json`), « Choisir un fichier JSON… », le résultat et les
    erreurs ligne à ligne (correspondance des colonnes inchangée).
- **À droite, la table** :
  - « Ce que les joueurs modifient eux-mêmes » : les six interrupteurs de
    V3.1-23 (états, inspiration, PV, pièces, emplacements, dés de vie), chacun
    avec ce qu'il commande en petit et **qui tient la valeur** (« le MJ » /
    « la joueuse ») ; « Par défaut » remet les six réglages ;
  - « Inspiration au plus » en − / + ;
  - **l'aperçu de la fiche de la joueuse** (une fiche de PJ de la campagne,
    en lecture) qui suit les interrupteurs **en direct** : « + état »
    apparaît, ▲▼ apparaissent, emplacements inertes, « Le MJ dépense tes dés
    de vie ». C'est **la fiche réelle** (composant de V3.1-26) en mode
    lecture, pas un dessin à part.
- **Tablette** : un volet — la table et l'aperçu d'abord, puis le ruleset et
  l'atelier. **Téléphone** : le ruleset, la table, l'aperçu, puis
  « Variantes et import » replié.

**Critères d'acceptation**
- [x] Choisir un ruleset : fiches, création et règles le suivent sans rechargement (caches clients vidés comme aujourd'hui).
- [x] « Exporter » absent d'une référence personnelle.
- [x] Basculer un interrupteur change l'aperçu aussitôt et l'écrit (une requête).

**Livré le 24 octobre.** Serveur (Opus) : `chargerReglesActives`
(`src/server/services/reglesActives.ts`) lit ensemble les rulesets (avec leur
parent, pour l'arbre), l'actif, les interrupteurs de la campagne et un PJ
pour l'aperçu (une joueuse de préférence), page et fenêtre ; la page lance
la fiche de l'aperçu avec elle (ADR 0056). `DELETE /api/rulesets/[id]?worldSlug=`
(`deleteRulesetVariantFromWorld`) : la variante ACTIVE rend la campagne à sa
base avant de disparaître, et le monde la reprend si elle ne peut pas
disparaître (test d'intégration, trois cas) ; Zod ajouté sur cette route qui
n'en avait pas. Interface (Sonnet) : `ReglesActivesPanel`, `RulesetSelector`
refait sans chargement au montage, `Interrupteur`, logique pure
`lib/ui/reglesActives.ts` (testée) ; l'aperçu est la vraie fiche
(`ParticipantCharacterSheet`) en `inert`, avec `commandesImposees` calculées
par `sheetControls` sur les interrupteurs locaux. Correction d'Opus : en
grande fenêtre, l'atelier tombait sous la hauteur de l'aperçu (rangées de
grille), corrigé par `auto auto 1fr`. Vérifié en direct avec le MJ de test :
« Leur inspiration » allumé fait apparaître ▲▼ dans l'aperçu aussitôt, une
requête, persiste au rechargement ; « Par défaut » remet tout en une
requête (réglages du banc d'essai remis). Créer, importer et supprimer une
variante n'ont pas été rejoués en direct (le test d'intégration couvre la
suppression). Limite : « Variantes et import » s'ouvre de force dès `@md`
par `::details-content` (Chromium 131+, Firefox 143+) ; plus ancien, il
reste replié mais s'ouvre à la main.

---

### ☑ V3.1-109 — Droits des joueurs : la fiche obéit aux interrupteurs · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet.** **Dépend de** : 108, 26, 32. L'écran
Règles actives est V3.1-57.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Partout où la joueuse voit sa fiche (ordinateur, tablette, téléphone) :
  interrupteur coupé → la valeur se voit, sans commande (« + état » absent,
  ▲▼ de l'inspiration, des PV, des pièces absents, colonnes « niv. » de
  l'égaliseur inertes, « Le MJ dépense tes dés de vie » à la place de
  « Dépenser un dé ») — planche « Décidé · fiche vue par le MJ et par le
  joueur ». Le MJ garde toutes les commandes.

**Critères d'acceptation**
- [x] Les six interrupteurs pilotent la fiche de la joueuse sur les trois
  écrans.

**Livré le 24 octobre.** Noyau (Opus) : `sheetControls(settings, { callerIsGm })`
(`src/core/campaigns/tableSettings.ts`, testé) — le MJ garde tout, hors
campagne il n'y a pas de table. Serveur (Opus) : la réponse de la fiche
calculée (`/sheet` et chargement avec la page) porte `controls`, calculés
pour l'appelant et la campagne (`loadSheetControls`, deux lectures en
parallèle, seulement dans une campagne ; test d'intégration). Interface
(Sonnet) : aucune commande tant que la fiche calculée n'est pas arrivée
(`lib/ui/commandesFiche.ts`, testé) ; PV (jauge et soins du bloc mourant),
inspiration et pièces perdent leurs commandes quand leur interrupteur est
coupé ; « Le MJ dépense tes dés de vie » sous la rangée de badges. Constat :
la fiche de la joueuse n'a ni « + état », ni égaliseur d'emplacements, ni
« Dépenser un dé » — ces commandes n'existent que dans l'outil Table du MJ ;
rien à cacher pour ces champs. Vérifié en direct avec Testeuse A (réglages
par défaut, puis PV et dés de vie coupés), réglages du banc d'essai remis.

---

### ☑ V3.1-60 — Publication : les réglages, et ce que voit un visiteur · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; galerie de 58, données de 59.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Publication-Decide.dc.html`. **Départ** :
`components/shell/PublicationPanel.tsx`, `ShareLinkPanel.tsx`,
`BookSkin.tsx` (pour l'aperçu). **Dépend de** : 58 (galerie), 59.

**Ce qui est décidé**
- **À gauche** :
  - « Partage en lecture seule » : texte d'aide inchangé ; alias
    (« /partage/ » + champ), mot de passe, « Créer un lien » ; « Lien créé : »
    avec « Copier » (« Copié ✓ ») ; la liste (adresse, « Créé le … »,
    « protégé », Copier, Révoquer) ; textes existants de `ShareLinkPanel`.
  - « Message d'accueil » : 500 caractères avec compteur, « Enregistrer »
    (« Enregistré ») ; « Remplace le grand titre de la page d'accueil. Vide :
    le nom de la campagne. »
  - « Fond par défaut du wiki public » : **la galerie de V3.1-58** (même
    composant), « une fiche qui a son propre fond le garde », « Mode des
    pages » en puces (modes non permis grisés), « Flou du fond ».
- **À droite, « Ce que voit un visiteur »** : la page d'accueil du wiki en
  petit — le message en titre (ou le nom de la campagne), le sommaire, le
  fond, le mode, le flou — qui **suit chaque changement** avant
  enregistrement ; « Prévisualiser ↗ » ouvre le vrai (`/m/[slug]/apercu`).
- **Tablette** : un volet — l'aperçu d'abord, puis le message, le fond, les
  liens. **Téléphone** : les liens, le message, le fond, puis l'aperçu ;
  « Prévisualiser ↗ » en haut.

**Critères d'acceptation**
- [x] L'aperçu suit message, fond, mode et flou sans requête au serveur.
- [x] Choisir un fond qui ne permet pas le mode des pages bascule sur un mode permis et l'annonce.
- [x] Liens : créer, copier, révoquer inchangés (tests existants verts).

**Livré le 24 octobre.** Serveur (Opus) : `chargerPublication`
(`src/server/services/publication.ts`) lit ensemble les liens, le message,
le nom de la campagne, le sommaire public (même service que le wiki public,
donc jamais plus que ce qu'un visiteur voit) et le fond enregistré, pour la
page comme pour la fenêtre ; noyau `publicationBackgroundState` et
`wikiBackgroundInputFromRef` (testés). Entrée `keep` ajoutée à la route du
fond (ADR 0047, complément) : sans elle, le mode d'une copie ne se réglait
pas, et chaque geste sur le flou aurait recopié l'image. Interface (Sonnet) :
`PublicationPanel` en deux colonnes par requêtes de conteneur,
`ApercuVisiteur` sans requête, `lib/ui/publication.ts` (testé). Corrections
d'Opus : envois du fond mis en file (un `keep` n'arrive jamais avant le choix
qui le précède) ; au téléphone, carte des liens doublée et « Créer un lien »
hors de l'écran. Vérifié en direct avec le MJ de test : l'aperçu suit la
frappe sans aucune requête ; un fond fourni, le mode, le flou : un envoi par
geste, tout persiste au rechargement ; banc d'essai remis sans fond. Le
deuxième critère (bascule annoncée) passe par le même `modeApresChoixDeFond`
que V3.1-58 : les fonds fournis permettant tous les quatre modes, il ne se
voit qu'avec une image personnelle limitée. Planche : section
« Publication » de `OutilsMJ.dc.html`.

---

### ☑ V3.1-58 — Personnalisation : le fond d'abord, et pour les joueuses · `M` · sans modèle IA — **fait le 24 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Perso-Decide.dc.html`. **Départ** :
`components/shell/PersonnalisationPanel.tsx`, `BackgroundPicker.tsx`,
`src/core/theme/builtinBackgrounds.ts`, `HomeProfilePanel.tsx`,
`PlayerShell.tsx`. **Dépend de** : 27 (rail), 35 (Compte sur l'accueil).

**Ce qui est décidé**
- **Barre en tête** : le mode en **pilule à quatre** (Sombre, Demi-sombre,
  Demi-clair, Clair) — un mode que le fond ne permet pas est grisé, raison
  au survol (« Ce fond ne permet pas ce mode de façon lisible ») ; « Flou
  du fond » (0 à 40 px, pas de 2) ; « Contraste élevé » en interrupteur
  (« Palette neutre sombre et traits nets, quel que soit le mode »).
- **Galerie des fonds** en grandes vignettes (les miniatures réelles,
  `thumbDataUrl`), chacune avec **ses modes lisibles en points** (un point
  teinté par mode permis, vide sinon) ; les images personnelles à la suite,
  avec × ; « + Ajouter une image » en dernière vignette (téléversement
  existant). Choisir un fond qui ne permet pas le mode en cours **bascule**
  sur un mode permis et **le dit** (message court).
- Sous la galerie : « Ces réglages sont les tiens, sur cet appareil : ils
  s'appliquent aussitôt, sans enregistrer. Tes images personnelles te
  suivent sur tous tes appareils. »
- **Données** : rien de neuf — cookies `mode`, `contrast`, `background`,
  `bgBlur` et la bibliothèque personnelle (`/api/settings/background`).
- **Tablette** : deux vignettes par rangée. **Téléphone** : la barre en
  colonne, puis la galerie en deux colonnes.
- **Pour tout le monde (accord de l'auteur, 8 octobre)** : le même écran
  dans **« Compte » de l'accueil** (V3.1-35), à côté du profil ; une entrée
  **« Apparence »** en pied du rail du joueur, au-dessus de « Mes mondes »,
  qui l'ouvre en page pleine ; au téléphone, par Accueil › Compte. Le MJ
  garde son outil. Un seul composant pour les trois accès.

**Critères d'acceptation**
- [x] Un compte joueur sans aucun monde mené règle son mode et son fond depuis Compte.
- [x] Choisir un fond à deux modes en mode clair bascule en sombre et l'annonce.
- [x] Un seul composant monté aux trois endroits (aucun doublon).

**Livré le 24 octobre.** L'essentiel était déjà en place depuis V3.1-80
et 81 (barre à quatre modes grisés, flou, contraste, galerie, section
Apparence du Compte). Reste fait par Opus, sans délégation : la bascule de
mode imposée par un fond est annoncée sous la barre (`role="status"`) ;
chaque vignette porte toujours quatre points, vides pour les modes non
lisibles (logique pure `lib/ui/apparence.ts`, testée) ; « Apparence » en
pied du rail du joueur, au-dessus de « Mes mondes », ouvre la page pleine
`/m/[monde]/joueur/apparence`, qui monte le même `PersonnalisationPanel`.
Vérifié en direct avec Testeuse A (ordinateur et téléphone). Les fonds
fournis permettent tous les quatre modes : la bascule ne se produit qu'avec
une image personnelle, d'où le test unitaire plutôt qu'un téléversement.

---

### ☑ V3.1-42 — Bloc-notes : le cahier refait, MJ et joueuse · `L` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; données fournies par 41.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Notes-Decide.dc.html` (« Décidé · bloc-notes (A) avec le
partage à la table »). **Départ** :
`components/shell/notebook/NotebookWorkspace.tsx`,
`components/shell/notebook/FicheCompanion.tsx`,
`app/m/[worldSlug]/joueur/notes/page.tsx`, cas `notes` de
`components/shell/MjToolWindowContent.tsx`. **Dépend de** : 41, 20, 25, 29.

**Ce qui est décidé**
- **Ordinateur** : sommaire arborescent à gauche — « Mon cahier » (pages,
  fiches ◆ et règles § épinglées), puis « Partagées à la table » (chaque
  page avec son autrice) ; la page au centre ; la fiche citée ou épinglée
  dans le panneau de droite (`FicheCompanion`). En bas du sommaire :
  « + Nouvelle page », « + Préparation de séance » (MJ seul), « ◆ Épingler
  une fiche ou une règle ».
- **Partage** : chaque page de **son** cahier porte un sélecteur « Privée |
  La table » (services de 41). Partagée, elle reste à sa place, marquée
  « partagée ». Une page partagée par quelqu'un d'autre s'ouvre en lecture
  seule, « <autrice> · lecture seule ».
- **MJ** : en fenêtre (V3.1-20), rail présent. **Joueuse** : « Notes » de
  son rail, en page pleine, même disposition, sommaire « Mes notes » puis
  « Partagées à la table » (pas de « Préparation de séance »).
- **Tablette** (fenêtre ≈ 556 px) : sommaire en tiroir ☰, fiche en panneau
  par-dessus la page ; au-dessus de ~640 px de fenêtre, la disposition
  d'ordinateur.
- **Téléphone du MJ** : Outils › Bloc-notes — épinglées en puces, « Mon
  cahier » puis « Partagées à la table » en liste, page en plein écran,
  fiche citée en feuille du bas. **Téléphone de la joueuse** : Notes, pilule
  « Les miennes / Partagées à la table ».

**Critères d'acceptation**
- [x] Les quatre écrans de la planche (MJ fenêtre, joueuse page pleine, tablette, deux téléphones).
- [x] Partager puis repasser en privée depuis la page ; l'autre compte voit la page apparaître puis disparaître.
- [x] Une page partagée par une autre personne n'offre aucune commande d'écriture.
- [x] Première vue sans écran « Chargement… » (données en props, règle commune 6).

**Livré le 19 octobre.** Serveur (Opus) : `loadNotebookWorkspace` charge le
cahier ET les pages partagées en un seul `Promise.all`, dans la fenêtre du
MJ comme dans les deux pages pleines ; `SharedNoteView` porte `shared`,
`blockId` et `version`. Interface (Sonnet) : `NotebookWorkspace` découpé en
`SommaireCahier`, `PageCahier`, `LecturePage`, `SelecteurPartage`,
`BoutonEpingler`, `TelephoneCahier` ; logique pure dans `lib/ui/cahier.ts`
(19 cas). Vérifié en direct avec Testeuse A et Testeur B : partager (200),
B lit « PJ de Testeuse A · lecture seule » sans aucune commande d'écriture,
repasser en privée (204), B ne la voit plus ; aucun « Chargement… » ;
captures MJ ordinateur, tablette (« ☰ Sommaire ») et téléphone joueuse.
Planche : section « Cahier » de `OutilsMJ.dc.html`. Limite connue : une
page partagée (ou qui l'a été) ne se supprime pas depuis le cahier, faute
de route qui retire l'entité `shared_note`.

---

### ☑ V3.1-43 — Livre de sessions : le registre et ses trois ajouts · `M` · sans modèle IA — **fait le 19 octobre (sauf « Relancer », qui attend V3.1-22)**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Livre-Decide.dc.html`. **Départ** :
`components/shell/sessionJournal/SessionJournalMjPanel.tsx`,
`components/shell/sessionJournal/SessionJournalBanner.tsx`, cas
`livre-de-sessions` de `MjToolWindowContent.tsx`. **Dépend de** : 20, 29 ;
l'ajout (2) « Relancer » dépend de V3.1-22 (fils du chat).

**Ce qui est décidé**
- **MJ, ordinateur** : une ligne par séance — date en jeu, titre, autrice,
  séance réelle, état (« Rédigée », « En attente », « Pas de devoir »). En
  tête : la prochaine séance et « Assigner le devoir » (feuille : séance
  réelle et date en jeu proposées d'office, « Qui l'écrit »). Une entrée —
  ou un devoir en attente, avec « Relancer » et « Annuler le devoir » —
  s'ouvre en lecture dans la colonne de droite.
- **Tablette** : registre réduit (date · titre · état), lecture en panneau
  par-dessus. **Téléphone du MJ** : Outils › Livre de sessions, prochaine
  séance puis registre en liste, entrée en plein écran.
- **Joueuse** (page pleine et téléphone) : le bandeau du devoir, puis le
  Livre en **premier chapitre du sommaire** de son wiki.
- **Ajouts** : (1) « à qui le tour » — la feuille propose la personne qui
  n'a pas écrit depuis le plus longtemps (ou jamais) ; (2) « Relancer » —
  un rappel posé dans le fil privé du chat de l'autrice (V3.1-22),
  journalisé ; tant que 22 n'est pas livré, le bouton n'apparaît pas ;
  (3) le Livre en chapitre de tête du sommaire du wiki de la joueuse.

**Critères d'acceptation**
- [x] Assigner, annuler un devoir ; chaque geste journalisé une fois (`sessionJournalGestes.test.ts`). « Relancer » : absent tant que V3.1-22 n'est pas livré, comme décidé.
- [x] « À qui le tour » : test du choix (jamais écrit > plus ancien > égalité par nom).
- [x] La joueuse voit le Livre en tête de son sommaire, jamais une entrée réservée au MJ.

**Livré le 19 octobre.** Opus : `nextWriter` (src/core/sessionJournal,
6 tests) ; assigner et annuler écrits une fois au journal de la campagne
(événement `system` du MJ dans `session_events`), annuler ne journalise
rien si aucun devoir n'a été effacé (`deleteAssignment` rend la ligne) ;
**faille corrigée** : le groupe épinglé du Livre échappait au filtre de
visibilité de la joueuse, le titre d'une entrée réservée au MJ lui
apparaissait (test d'intégration, rouge sur l'ancien code) ; la route des
devoirs renvoie les séances réelles et, par devoir, le nom et le slug de
l'entrée rédigée ; `campaignId`/`assignmentId` validés par Zod ; le roster
porte le rôle, et « à qui le tour » ne propose d'office qu'une joueuse.
Sonnet : registre, lecture, feuille « Assigner le devoir », tablette et
téléphone, bandeau au verre ; logique pure `lib/ui/livreDeSessions.ts`
(12 tests, jour local de création vérifié en trois fuseaux). Vérifié en
navigateur (Testeur MJ) : registre à 1280, 820 et 390 px, feuille avec la
suggestion d'une joueuse. Puis, à la demande de l'auteur, le parcours
complet : le MJ assigne un devoir à Testeuse A et un à Testeur B (201,
deux « En attente »), annule celui de B (confirmation, 204) ; Testeuse A
voit le bandeau, rédige « Essai du Livre (test) » (201), le bandeau
disparaît et le Livre ouvre son sommaire avec l'entrée ; le MJ retrouve
l'entrée, « Ouvrir la fiche » mène à sa page, et la suggestion passe à
Testeur B. Chaque geste s'écrit une fois au journal ; il s'y affichait
« Système » seul : le fait passe maintenant par `note`, et le journal dit
« Système — Livre de sessions : devoir assigné à PJ de Testeur B ».
Nettoyage : devoir et entrée de test retirés (l'entrée est dans la
corbeille), aucun devoir restant. Constat hors ticket (tâche proposée) :
l'éditeur d'une entrée du Livre affiche le type brut « session_journal ».
Planche OutilsMJ : section « Livre de sessions ».

---

### ☑ V3.1-45 — Générateurs : les tirages à gauche, la fiche à droite · `M` · **avec modèle IA** — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; tables et IA inchangées.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Generateurs-Decide.dc.html`. **Départ** :
`components/shell/GeneratorToolPanel.tsx`, cas `generateurs`. **Dépend de** :
20, 25 (pilule), 29.

**Ce qui est décidé**
- **En haut** : la pilule des outils (Taverne, Échoppe, PNJ…) et les
  variantes **en puces** (dont « Aléatoire ») — elles remplacent les listes
  déroulantes.
- **À gauche, les tirages** : chaque section et ses emplacements (dé,
  résultat, ↻ par emplacement, ↻ par section). « Éditer les tables » prend
  la place des tirages dans cette colonne (retour par ×).
- **À droite, l'aperçu de la fiche assemblée** : chaque morceau tiré est
  souligné en pointillé et se relance d'un toucher (↻) ; la prose écrite
  par l'IA est marquée « IA », longueur 40 / 80 / 120 mots ; menu de taverne
  en deux colonnes (plats par palier, boissons) ; « Tout relancer » ;
  « Copier le texte » ; « Créer la fiche » promeut le résultat en entité
  visible du MJ seul.
- **Tablette** : l'aperçu d'abord, les tirages dessous. **Téléphone** :
  pilule des outils, variantes et « Les tirages » en feuilles du bas,
  aperçu (↻ par morceau, menu en une colonne), « Créer la fiche ».
- **Inchangé** : les tables restent des fiches de règles pondérées du
  ruleset ; la prose de l'IA reste de la donnée, revue avant création
  (règle 10), passée par `src/server/ai/` ; aucun tirage côté client (le
  serveur tire).

**Critères d'acceptation**
- [x] Relancer un emplacement ne relance que lui (test existant du service : `generators.integration.test.ts`, « onlySlotKey : ne tire que l'emplacement désigné » ; en direct, le corps envoie la seule clé visée).
- [x] « Créer la fiche » crée une entité visible du MJ seul (test `lib/generators/promoteVisibility.test.ts` ; la route créait des blocs publics, corrigé).
- [x] Les variantes n'utilisent plus aucune liste déroulante.

**Livré le 19 octobre.** Opus : « Créer la fiche » naît en visibilité `gm`
(elle naissait publique : un PNJ ou une taverne inventés apparaissaient aux
joueurs). Sonnet : `GeneratorToolPanel.tsx` découpé dans
`components/shell/generateurs/` (état unique `useTirages`, colonne des
tirages, aperçu, menu de taverne, édition des tables en colonne, puces de
variantes) ; logique pure `lib/ui/generateurs.ts` (12 tests). Vérifié en
navigateur (Testeur MJ) : pilule des outils, puces, aucune liste
déroulante ; « Tout relancer » = une requête par section, une après
l'autre ; relancer un emplacement n'envoie que sa clé, les autres ne
bougent pas ; édition des tables ouverte et refermée par × ; au téléphone,
feuilles « Variantes » et « Les tirages » (Échap), pilule qui défile.
Limites : les sections du banc d'essai n'ont aucune table (le serveur rend
`slots: []`), donc ni contenu réel ni prose « IA » vus en direct ;
« Créer la fiche » non cliqué (la fiche resterait en base). Longueurs de
prose gardées à 30 / 100 / 250 mots (`PROSE_LENGTH_PRESETS`, aussi lues
par le schéma des blocs générateurs) au lieu des 40 / 80 / 120 de la
planche : à trancher par l'auteur. Planche OutilsMJ : section
« Générateurs ».

---

### ☑ V3.1-44 — Rencontres : l'atelier en trois colonnes · `M` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; budget et solveur inchangés.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Rencontres-Decide.dc.html`. **Départ** :
`components/shell/EncounterBuilder.tsx`, cas `rencontres` de
`MjToolWindowContent.tsx` et de la route
`app/api/worlds/[worldSlug]/mj/[tool]/window/route.ts`. **Dépend de** : 20, 29.

**Ce qui est décidé**
- **Ordinateur, trois colonnes** : à gauche le groupe (PJ de la campagne
  avec leurs vrais niveaux ; un absent se décoche et le budget suit), la
  difficulté visée, « Mes rencontres » (une rencontre sauvegardée se
  rouvre) ; au centre le catalogue du ruleset (recherche, filtres par type) ;
  à droite la barre de budget (les trois paliers 2024 et la difficulté
  visée), la rencontre en cours (± nombre, ×), « Génération aléatoire »,
  « Sauvegarder », « Lancer le combat » (vers l'Initiative).
- **Tablette** : les colonnes s'empilent. **Téléphone du MJ** : le groupe en
  pastilles (prénom · niveau ; toucher un absent le retire, le budget
  suit), la difficulté et la barre, la rencontre en cours, le catalogue en
  feuille du bas, « Lancer le combat ».
- **Inchangé** : le budget est une donnée du ruleset (`encounter_budget`),
  le solveur reste celui du code, la table `campaign_encounters` reste.
- Jauge : pendant un combat, la « menace restante » remplace le budget
  (décidé avec l'Initiative, V3.1-38) — ce ticket n'affiche que le budget.

**Critères d'acceptation**
- [x] Décocher un PJ change le budget (même calcul que le serveur, aucun calcul de règle côté client : le budget vient de la réponse).
- [x] Sauvegarder, rouvrir, lancer le combat : la rencontre arrive dans l'Initiative (lancement vérifié en direct ; sauvegarde et réouverture non exercées en direct : une rencontre sauvegardée ne s'efface pas, elle resterait en base).
- [x] Le catalogue cherche dans le ruleset actif, sans requête par monstre.

**Livré le 19 octobre.** Serveur (Opus) : `memberBudgetShares` dans
`src/core/rules/encounter.ts` (la ligne d'un niveau ; la somme des parts
redonne `encounterBudget`, testé) ; `src/server/services/encounterWorkshop.ts`
(`listEncounterParty` : PJ, niveau total des classes, trois lectures
groupées ; `withBudgetShares` ; `chargerAtelierRencontres`, chargeur commun
de la page et de la fenêtre) ; la génération accepte `partyLevels` (Zod,
1 à 20 niveaux de 1 à 20), l'ancien corps reste valide. Écran (Sonnet,
retouché par Opus) : trois colonnes par requête de conteneur, empilées en
fenêtre étroite, téléphone sous 28rem (pastilles, catalogue en feuille du
bas) ; budget = somme des parts des présents, sans règle côté client ;
repli « groupe hypothétique » si la campagne n'a aucun PJ ; types de
créatures regroupés par base et traduits (`typeDeBase`,
`CREATURE_TYPE_LABELS_FR`). Vérifié en navigateur (Testeur MJ) : deux PJ de
niveau 1 → 100 / 150 / 200 PX, un absent → 50 / 75 / 100 ; génération avec
`partyLevels: [1, 1]` ; lancement → Initiative (combat de test effacé) ;
tablette en colonnes empilées ; téléphone en pastilles, feuille du bas
(recherche, ajout, Échap).

---

### ☑ V3.1-56 — Calendrier réel au verre minéral, côté MJ et côté joueuse · `M` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — disposition déjà codée (V3.1-16) ; transposition seulement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Calendrier-Reel.dc.html`. **Départ** :
`components/shell/scheduling/*` (`SchedulingMjPanel.tsx`,
`NextSessionPanel.tsx`, `AvailabilityGrid.tsx`),
`app/m/[worldSlug]/joueur/prochaine-session/page.tsx`. **Dépend de** : 20,
27, 29.

**Ce qui est décidé** : la disposition de V3.1-16 **ne change pas**
(grille à bascule « Mes disponibilités / Toute la table », géométrie, ligne
« 22:00 », colonne des heures fixe, croix au survol, info-bulle « (toi) »
en tête, dates possibles classées par nombre puis par durée,
enregistrement automatique de la joueuse). Le verre minéral :
- **MJ** : fenêtre à volets ; en-tête — titre, « Créneau proposé · N jours ·
  X réponses sur Y », **durée visée en − / +**, « Annuler la demande » en
  danger fantôme ; la grille et les dates possibles dans des panneaux en
  verre ; « Confirmer » **plein** pour une session complète, contour accent
  sinon ; trois cartes (« Régler une date à la main », « Séances à venir »
  avec « Annuler », « Déjà jouées »). Tablette : les cartes l'une sous
  l'autre. Téléphone (Outils › Calendrier réel) : la même colonne, la
  grille défile à l'horizontale.
- **Joueuse** : page pleine « Prochaine séance » dans sa coquille, sans aucun
  outil MJ — la prochaine séance en grand (pavé de date), la demande ouverte
  et sa grille (« Toute la table » comprise), « Les dates qui se
  dessinent » en lecture seule (« c'est le MJ qui choisit »), « Séances à
  venir » et « Déjà jouées ». Ligne d'état « Enregistrement… » puis
  « Enregistré ✓ ».

**Critères d'acceptation**
- [x] Tests de V3.1-16 verts, sans modification.
- [x] Aucun outil MJ dans la page de la joueuse (test de rendu).
- [x] La grille défile à l'horizontale au téléphone, la colonne des heures reste visible (code de V3.1-16 inchangé : `overflow-x-auto`, colonne `sticky left-0` à fond opaque ; non revérifié en direct, aucune demande ouverte dans le banc d'essai).

**Livré le 19 octobre.** Panneaux et cartes en verre (coins 18 px, flou
`--blur`). MJ : durée visée en − / + (pas de 30 min, de 1 h à 14 h), un
seul `PATCH …/scheduling/settings` 500 ms après le dernier clic ;
« Annuler la demande » et « Annuler » d'une séance en danger fantôme ;
« Confirmer » plein si `category === "full"` (créneau ≥ durée visée),
contour accent sinon ; cartes et séances empilées par requête de conteneur.
Joueuse : page « Prochaine séance », pavé de date agrandi. Test de rendu
`lib/ui/prochaineSeance.test.ts` (aucun outil MJ, avec une demande ouverte,
un jour complet et des séances ; d'abord posé sous `components/`, où Vitest
ne cherche pas, et déplacé le 19 octobre avec V3.1-45 : il ne tournait pas). Vérifié en navigateur sans demande ouverte :
MJ à 1280, 820 et 390 px, quatre clics − / + = une requête, durée inchangée
(5 h) ; Testeuse A à 1280 et 390 px, aucun outil MJ. Non exercé en direct :
la grille et l'en-tête d'une demande ouverte (en ouvrir une laisserait une
demande fermée en base). Planche OutilsMJ : section « Calendrier réel ».

---

### ☑ V3.1-143 — Journal : « supprimée … par X », et les fiches supprimées dans la fenêtre d'outil · `S` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Opus** — une migration (une colonne et un déclencheur) ; l'affichage est court.

**Demande de l'auteur (19 octobre)**, après V3.1-61 : la planche
`Journal-Decide.dc.html` dit « supprimée le 6 oct. par Gabriel », mais la
base ne garde pas l'auteur d'une suppression ; et la fenêtre d'outil du
journal (`MjToolWindowContent`, cas `journal-historique`) ne montre pas les
fiches supprimées, que la page montre.

**Ce qui est décidé**
- **Migration** : `entities.deleted_by uuid null references auth.users(id) on delete set null` (à la livraison, `auth.users` comme `created_by` plutôt que `profiles` : une suppression ne doit jamais échouer faute de ligne de profil). Rempli par la BASE, pas par l'application : un déclencheur `before update` met `deleted_by = auth.uid()` quand `deleted_at` passe de `null` à une date, et `deleted_by = null` quand la fiche est rétablie (`deleted_at` revient à `null`). Aucun chemin de suppression ne peut l'oublier, et un client ne peut pas l'écrire à la main (le déclencheur l'écrase). RLS inchangée ; `docs/SCHEMA.md` mis à jour. Les suppressions d'avant la migration restent sans auteur.
- **Lecture** : la liste des fiches supprimées (`/api/worlds/[worldSlug]/deleted-entities`) renvoie aussi le nom de l'auteur (`getDisplayNamesForUsers`, une lecture groupée, jamais une par fiche) ; « supprimée le 6 oct. par Gabriel », ou sans « par … » quand l'auteur est inconnu.
- **Fenêtre d'outil** : le cas `journal-historique` de `MjToolWindowContent` monte aussi `DeletedEntitiesPanel` (même disposition que la page : dessous sous 1024 px, à droite au-delà). « Rétablir » y passe par la même action serveur (`restoreEntityAction`).

**Critères d'acceptation**
- [x] Supprimer une fiche puis lire la corbeille : « supprimée le … par » le compte qui l'a supprimée (test d'intégration avec les comptes de test, `docs/TESTS.md`).
- [x] Rétablir efface l'auteur ; une écriture directe de `deleted_by` par un client est écrasée par le déclencheur.
- [x] La fenêtre d'outil du journal montre les fiches supprimées, et « Rétablir » y fonctionne sans rechargement.

**Livré le 19 octobre.** Migration `20261019090000_entities_deleted_by`
(colonne, déclencheur `stamp_entities_deleted_by`, `list_deleted_entities`
recréée avec `deleted_by`), appliquée par l'auteur. Le service lit les noms
des auteurs en une fois (`getDisplayNamesForUsers`). La page et la fenêtre
d'outil partagent `journal/JournalEtCorbeille.tsx`, qui bascule sur la
largeur du conteneur (64rem) et non plus de l'écran. Tests d'intégration
`entitiesDeletedBy.integration.test.ts` (4 cas : écriture directe écrasée
sur une fiche vivante comme supprimée, auteur posé et nommé, effacé au
rétablissement). Vérifié en navigateur en Testeur MJ : « Essai Naissance »
rétablie depuis la fenêtre d'outil sans rechargement, supprimée de nouveau,
puis « supprimée le 19 oct. par Testeur MJ » ; elle reste dans la corbeille,
comme avant, désormais avec un auteur.

---

### ☑ V3.1-54 — Gestion de campagne au verre minéral, avec « Voir comme » · `S` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — disposition déjà codée (V3.1-15) ; transposition seulement.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Campagne-Gestion.dc.html`. **Départ** :
`components/shell/CampaignsPanel.tsx`, `components/shell/CampaignDetail.tsx`,
`InviteLinkPanel.tsx`. **Dépend de** : 20, 29 ; l'entrée « Voir comme »
dépend de **V3.1-12** (autorisation et garde-fous).

**Ce qui est décidé** : la disposition de V3.1-15 (piste A) **ne change
pas** — invitations en haut, « À la table » avec les MJ sur une ligne, une
carte par compte joueur, les PNJ sans joueur en bas. Le verre minéral :
panneaux en verre (coins 18 px), carte en verre sombre avec le PJ en ambre,
menus ⋮ et confirmations en **surfaces flottantes** (elles nomment
`Nom#0000`), boutons de la charte. Tablette : deux cartes par rangée.
Téléphone : cartes l'une sous l'autre, ligne de lien réduite au rôle,
Copier et ⋮.
- **« Voir comme Inès#4821 »** en tête du menu ⋮ de chaque carte, avant
  « Forcer une réinitialisation » et « Retirer de la campagne ». Tant que
  V3.1-12 n'est pas livré, l'entrée n'apparaît pas.

**Critères d'acceptation**
- [x] Les gestes existants inchangés (tests de V3.1-15 verts).
- [x] Menus et confirmations en surfaces flottantes, au clavier (Échap ferme).
- [x] « Voir comme » visible seulement si V3.1-12 l'autorise côté serveur.

**Livré le 19 octobre.** Panneau de campagne, invitations, cartes joueurs
et « Personnages sans joueur » en verre (coins 18 px, flou `--blur`) ;
grille d'une, deux puis trois cartes (téléphone, `md`, `xl`). Menu ⋮
(`ActionsMenu`, coins 14 px) et `ConfirmDialog` (coins 18 px) en surfaces
flottantes en verre ; Échap ferme le menu **et rend le focus au bouton ⋮**
(le menu vit en portail). Au téléphone, la sous-ligne d'un lien
d'invitation est masquée (`hidden sm:block`) : la ligne se réduit au rôle,
Copier et ⋮. « Voir comme » était déjà en tête du menu (V3.1-12) ; le
serveur l'autorise au MJ de la campagne sur un compte « tag » membre,
l'entrée reste donc. Vérifié en navigateur à 1280, 820 et 390 px (3, 2, 1
colonnes), Échap et focus, et l'aller-retour « Voir comme » sur Testeuse A.
Non exercé : la ligne réduite d'un lien, aucune invitation n'existant dans
le banc d'essai. Planches Navigation (menu ⋮) et Surfaces (confirmation)
mises à jour.

---

### ☑ V3.1-61 — Journal historique : par fiche, ou chronologique · `M` · sans modèle IA — **fait le 19 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; un champ de plus côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Journal-Decide.dc.html`. **Départ** :
`components/shell/GmJournalPanel.tsx`, `DeletedEntitiesPanel.tsx`,
`src/server/services/activityJournal.ts`,
`app/m/[worldSlug]/mj/journal-historique/page.tsx`, cas
`journal-historique`. **Dépend de** : 20, 29.

**Demande de l'auteur (8 octobre)** : chercher par personne, trier,
filtrer par objet modifié ou par élément (wiki, fiche de personnage…).

**Ce qui est décidé**
- **Serveur** : `JournalEntry` gagne `entityKind` (le type de la fiche,
  déjà connu du serveur, lu dans la même requête — pas de requête par
  ligne) et le nom du bloc modifié reste `blockLabel`. Accès réservé au MJ,
  inchangé.
- **Bascule en tête** (pilule) :
  - « **Par fiche** » : une carte par objet modifié — nom (lien entité,
    toucher = ne montrer que cette fiche), type en pastille, « n
    modifications » ; dedans, une ligne par changement : quand (« 8 oct.
    10:42 »), qui, et « partie modifiée — détail » (le détail d'inventaire
    existant, ligne par ligne). Les événements de jeu sans fiche se
    regroupent dans « Sans fiche (jeu) ».
  - « **Chronologique** » : la liste groupée selon le tri — plus récent
    (par jour : « Aujourd'hui · mercredi 8 octobre »), plus ancien, par
    personne, par fiche ; chaque ligne : heure, avatar (initiale ; ✦ pour
    « IA / système »), « Inès a modifié Inventaire de Sakaburin », type en
    pastille, première ligne du détail et « révision #14 », pastille
    « wiki » / « jeu » ; toucher la ligne **déplie** le détail complet.
- **Filtres communs** : la recherche (« Chercher une personne, une fiche, un
  mot… » — dans la personne, la fiche, la partie modifiée, le détail,
  l'élément) ; « Qui » en puces (chaque personne avec son nombre, « IA /
  système » compris) ; « Élément » en puces (Fiches de personnage, PNJ,
  Lieux, Factions, Objets, Pages, Jeu (jets, actions, narration)) avec
  leur nombre — **les nombres suivent les autres filtres** ; les filtres
  actifs en étiquettes (× par étiquette, « Tout effacer ») et « n
  modifications sur N ».
- Filtres et tri **côté client**, sur les entrées déjà reçues (pas de
  requête par filtre).
- **Fiches supprimées** à droite (texte « … · PNJ · supprimée le 6 oct. par
  Gabriel », « Rétablir »). Rétablir met à jour l'arborescence **sans
  `window.location.reload()`** (règle commune 6).
- **Tablette** : une colonne, les fiches supprimées en bas. **Téléphone** :
  la bascule et la recherche en tête, « Filtres » (avec le nombre de
  filtres actifs) ouvre une **feuille du bas** — tri, Qui, Élément, Partie
  modifiée (cases à cocher avec nombres), « Voir n résultats » ; les cartes
  l'une sous l'autre.

**Critères d'acceptation**
- [x] `entityKind` renvoyé sans requête supplémentaire par ligne (test du service).
- [x] « Inès » + « Fiches de personnage » : seules ses modifications de fiches de PJ ; les nombres des autres puces suivent.
- [x] Toucher « Sakaburin » ne montre que cette fiche ; l'étiquette se retire d'un ×.
- [x] Rétablir une fiche : elle revient dans l'arborescence, sans rechargement de la page.

**Clôture (19 octobre).**
- Serveur (Opus) : `JournalEntry` gagne `entityKind` (lu dans la même requête que le nom de la fiche), `pc` (les PJ de la campagne lus une fois pour tout le journal) et `revisionNumber` ; test du service (une lecture des PJ, une des fiches d'événements, jamais par ligne). « Rétablir » devient une action serveur (`restoreEntityAction`, Zod, droit vérifié par `restoreDeletedEntity`) qui revalide la mise en page du monde : plus de `window.location.reload()`, aucun `router.refresh()` ajouté (C5).
- Interface (Sonnet) : `GmJournalPanel`, `components/shell/journal/`, `DeletedEntitiesPanel` ; logique pure testée (`lib/ui/journalHistorique.ts` : éléments, filtres, comptes qui suivent les autres filtres, regroupements). Correction d'Opus : une révision qui touche plusieurs parties (« Personnage, Inventaire ») comptait comme une partie à part ; chaque partie a maintenant sa case (tests).
- Vérifié au navigateur en Testeur MJ (Banc d'essai) : « Testeur MJ » + « Fiches de personnage » → 20 modifications sur 73, la puce « Fiches de personnage » passe de 42 à 20 ; toucher « PJ de Testeuse A » ne garde qu'elle (24 sur 74) et l'étiquette se retire d'un × ; bascule et quatre tris ; « Rétablir » sans aucun rechargement, la fiche est dans l'arborescence au passage suivant sur le wiki ; feuille « Filtres » au téléphone, aucun débordement. La fiche rétablie pour l'essai a été remise à la corbeille (sa date de suppression est maintenant le 19 octobre).
- Restes : « supprimée … par X » n'est pas affiché, la base ne garde pas l'auteur d'une suppression (une migration, à décider) ; la fenêtre d'outil du journal ne montre pas les fiches supprimées (inchangé) ; « IA / système » n'est pas traduit (il vient du serveur).

---

### ☑ V3.1-55 — Calendrier ingame : l'année d'un coup d'œil · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — planche définitive ; aucune donnée nouvelle.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Calendrier-Decide.dc.html`. **Départ** :
`components/shell/CalendarSettingsPanel.tsx`, `src/core/calendar/*`
(`weekday.ts`, `formatDate.ts`), cas `calendrier`. **Dépend de** : 20, 29.

**Ce qui est décidé**
- **En haut, la frise des ères** : une bande, chaque ère de largeur
  proportionnelle à sa durée (la dernière court jusqu'à « an actuel +
  300 »), le jour actuel marqué d'un trait accent et de son année. Toucher
  une ère ouvre le réglage des ères.
- **À côté, le jour actuel** : son jour de la semaine, la date, son ère et
  « an N de l'ère », « jour 44 sur 360 ». Pas : « ‹ Veille »,
  « Lendemain › », « + une semaine » (libellé « + une décade » pour une
  semaine de 10 jours, sinon « + N jours ») ; « Changer la date » ouvre
  jour, mois (‹ ›) et an.
- **Dessous, les douze mois en vignettes** (nom, durée, mini-grille, le
  jour actuel allumé ; le mois actuel bordé d'accent). **La semaine en
  puces** : › décale d'un rang, × supprime, « + jour » ; « Le 1er jour de
  l'an 0 était un ‹ Primidi › ».
- **Réglage contextuel à droite** : toucher un mois ouvre nom, durée en − /
  + (1 à 60), position ↑ ↓, la grille du mois (‹ › pour changer de mois),
  « + Ajouter un mois après », « Supprimer ce mois » ; toucher un jour de
  la grille le sélectionne (« samedi 30 Brumaire 1492 — dans 6 jours ») et
  propose « En faire aujourd'hui ». Toucher une ère ouvre la liste des ères
  (nom, « dès l'an », ×, « + Ajouter une ère »).
- **Raccourcir un mois recale le jour actuel** sur le dernier jour du mois.
- **Rien n'est enregistré avant « Enregistrer »** (le calendrier est
  remplacé en entier, comme aujourd'hui) ; la barre du bas dit
  « Modifications non enregistrées » ou « Tout est enregistré ».
- **Tablette** : la frise puis le jour actuel l'un sous l'autre, trois
  vignettes par rangée, le réglage sous l'année. **Téléphone** : le jour
  actuel, la frise, trois vignettes par rangée, la semaine ; un mois ou une
  ère touché s'ouvre en **feuille du bas** ; « Enregistrer » en haut.
- Calculs (jour de la semaine, jour de l'année, décalage de N jours) dans
  `src/core/calendar`, **tests d'abord** ; le composant n'en fait aucun.

**Critères d'acceptation**
- [x] Tests du noyau : lendemain du dernier jour de l'an, veille du 1er jour de l'an 0 (année négative), décalage de 10 jours sur deux mois.
- [x] Raccourcir Brumaire à 10 jours quand on est le 14 : le jour actuel devient le 10.
- [x] Changer le 1er jour de l'an 0 décale toutes les vignettes.
- [x] Rien n'est écrit avant « Enregistrer » (test : aucune requête).

**Clôture (18 octobre).**
- Noyau (Opus, tests d'abord) : `src/core/calendar/navigation.ts` — `shiftDate`, `daysBetween`, `dayOfYearNumber`, `clampDayToCalendar`, `yearInEra`, `eraBand`, `monthGrid`. Les trois cas du ticket sont testés (lendemain du dernier jour de l'an, veille du 1er de l'an 0, dix jours sur deux mois), et le décalage des grilles par le 1er jour de l'an 0.
- Interface (Sonnet) : `CalendarSettingsPanel.tsx` et `components/shell/calendrier/` ; un réducteur pur testé (`lib/ui/calendrierEdition.ts`), une seule requête, celle d'« Enregistrer ». Corrections d'Opus : le jour actuel suit SON mois quand on déplace, ajoute ou supprime un mois (le 14 Brumaire restait le 14 du mois qui prenait sa place), et le jour du 1er de l'an 0 suit son jour de semaine quand on décale ou supprime un jour (tests ajoutés).
- Vérifié au navigateur en Testeur MJ (Banc d'essai) : régler le jour actuel, Lendemain, « + une décade » → « jour 12 sur 360 » ; choisir le 14 Brumaire dans la grille (« dans 43 jours »), « En faire aujourd'hui », raccourcir Brumaire à 10 jours → le 10 ; changer le 1er jour de l'an 0 décale la vignette ; **aucune requête avant « Enregistrer », une seule après** ; l'enregistrement tient après rechargement ; feuille du bas au téléphone ; aucun débordement à 820 et 390 px. Le calendrier du Banc d'essai a été remis à l'identique ensuite.
- Le 19 octobre, à la demande de l'auteur : « Ne plus régler le jour actuel » rend le jour actuel « non réglé » (action `jourEffacer`, testée), comme la case de l'ancien panneau.
- Restes : un nom vide grise « Enregistrer » (le schéma le refuse) ; saisir un an négatif passe par le clavier.

---

### ☑ V3.1-46 — Probabilités : la matrice, caractéristiques et compétences · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — calcul pur à étendre, tests d'abord ; planche définitive.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Probabilites-Decide.dc.html`. **Départ** :
`src/core/rules/probability.ts` (+ `probability.test.ts`),
`components/shell/PartyProbabilityTable.tsx`, cas `probabilites`.
**Dépend de** : 20, 29.

**Ce qui est décidé**
- **Noyau, tests d'abord** : `probability.ts` gagne les **jets de
  caractéristique** (Force, Dextérité, Constitution, Intelligence, Sagesse,
  Charisme) — même formule que les compétences, touche-à-tout compris,
  avantage / désavantage de la fiche compris. Rien en base (règle 16).
- **Ordinateur** : une seule grille ; les PJ de la campagne en colonnes ;
  en lignes **les six caractéristiques**, puis les dix-huit compétences.
  Le pourcentage au DD choisi (5 à 30, pas à pas ou puces 10 / 15 / 20 /
  25). Le meilleur de chaque ligne est encadré ; une case touchée explique
  son calcul (caractéristique, maîtrise ou expertise, touche-à-tout,
  avantage ou désavantage). Campagne en sélecteur compact.
- **Couleurs** : un **spectre continu** du rouge (peu de chances) au vert
  (presque sûr), fond et chiffre teintés selon le pourcentage — pas trois
  paliers. Interpolation dans l'espace OKLCH entre deux jetons de la charte
  (`--danger` et `--success`), contraste du chiffre vérifié dans les quatre
  modes.
- **Tablette** : la même grille, qui défile. **Téléphone** : le DD (pas à pas
  et puces), le détail de la case touchée, la grille compacte (noms
  abrégés, sans la colonne de caractéristique).
- Libellé : Insight = **Intuition** (`src/i18n/fr.ts`).

**Critères d'acceptation**
- [x] Tests du noyau : jet de Force sans maîtrise avec touche-à-tout ; avec avantage ; DD 5 et DD 30 aux bornes.
- [x] La grille montre 6 + 18 lignes, le meilleur de chaque ligne encadré.
- [x] Teinte continue : 50 % et 51 % ont deux teintes différentes ; contraste AA du chiffre dans les quatre modes.

**Clôture (18 octobre).**
- **Découverte** : le moteur de fiche ignorait le Touche-à-tout et n'avait pas de jet de caractéristique à part. Décision d'Opus, dans le sens du ticket (« touche-à-tout compris ») : un effet de règle `half_proficiency` (cible `check` ou `check.<car>`, la moitié de la maîtrise arrondie vers le bas sur un jet sans maîtrise), un résultat `abilityChecks` dans `characterSheet()`, une compétence qui lit aussi l'avantage de sa caractéristique (`check.<car>`), et l'encombrement qui pénalise aussi les jets de caractéristique. Tests d'abord (`sheet.test.ts`, `probability.test.ts`). Les jets réels (outil de dés, solo) lisent `abilityChecks` : le tableau et le dé disent le même chiffre. Deux endroits qui comptaient « tout sauf `none` » comme une maîtrise corrigés (résumé des compétences, choix déjà accordés).
- Donnée : `bard-jack-of-all-trades` dans `data/srd/modifiers-2024.json` (testé) ; SRD réimporté le 18 octobre (1 905 fiches, 0 échec, aucune fiche retirée), les trois scripts d'après import rejoués, bloc vérifié en base.
- Calcul : `checkLines` (6 + 18 lignes, sources pour le détail), `bestIndices` (une ligne toute à égalité n'est pas encadrée), DD 5 à 30. Service `getPartyCheckLines`, PJ résolus ensemble (C3).
- Teinte (Opus) : `lib/ui/teinteProbabilite.ts`, interpolation OKLCH entre `--danger` et `--success`, mêlée au panneau et à l'encre **en OKLab** (en OKLCH, le rouge tournait au violet sur un fond de monde violacé) ; test de contraste AA calculé d'après `tokens.css` dans les quatre modes et sur trois teintes de fond.
- Interface (Sonnet) : `PartyProbabilityTable.tsx` (page et fenêtre), DD réglable, détail de la case, légende. Corrections d'Opus : noms de colonne courts mais distincts (`nomsCourts` : « PJ Testeuse A » et « PJ Testeur B » donnaient deux « PJ »), teinte plus franche (45 % / 20 %), encadrement sans égalité, en-tête de colonne accessible.
- Vérifié au navigateur en Testeur MJ (Banc d'essai, 2 PJ) à 1280, 820 et 390 px : 24 lignes, aucun débordement de page, Force 35 % → 10 % de DD 15 à 20, détail « Testeur · Force · DD 20 : 10 % · Force +1 », DD borné à 5.
- Restes : le Touche-à-tout ne vaut que pour le SRD 2024 (comme la Ténacité naine) ; l'initiative ne le compte pas encore (en 2024, c'est un jet de Dextérité) ; aucun barde au Banc d'essai, le Touche-à-tout n'a été vu qu'en test.

---

### ☑ V3.1-88 — Administration › Identité de l'application · `S` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : `Entree-Decide.dc.html` (panneau de droite),
`Admin-Decide.dc.html` (tuile Identité). **Dépend de** : 84, 87.

**Ce qui est décidé**
- La tuile « Identité de l'application » ouvre le panneau : note « Ce que
  voient tous les visiteurs : l'écran-titre, le rail, l'onglet du
  navigateur. Un changement s'applique à tous, aussitôt enregistré. » ;
  **Nom** (32), **Phrase d'accueil** (80) ; **Logo** : grille des douze
  tuiles (7 par rangée ; 4 sur tablette et téléphone), le choisi bordé
  d'accent, puis « + Téléverser » (PNG ou WebP carré, 512 px ; note
  « jamais de SVG téléversé (il peut contenir du script) ») ; **Aperçu**
  en direct (fond flouté, tuile, nom, phrase) ; **Enregistrer** (« Enregistré
  ✓ ») et **« Rétablir « Antre Nous » »**.
- Écriture par `updateAppIdentityAction` (V3.1-84).

**Critères d'acceptation**
- [x] L'aperçu suit la saisie sans enregistrer.
- [~] Enregistrer change l'écran-titre et la tête du rail pour tous.
- [~] Rétablir revient au nom, à la phrase et au d20 par défaut.

**Clôture (18 octobre).**
- Serveur : rien de neuf, l'action et ses contrôles viennent de V3.1-84 (`updateAppIdentityAction`, `resetAppIdentityAction`, `updateTag`). La page `/admin` transmet en plus la phrase d'accueil.
- Interface (Sonnet) : `PanneauIdentite.tsx`, règle d'envoi du logo en fonction pure testée (`lib/ui/identiteApp.ts` : téléverser, retirer ou garder), champs réalignés sur l'identité enregistrée sans effet de synchronisation, aperçu du fichier révoqué. Corrections d'Opus : la grille appelle `LogoApp` au lieu d'en recopier le balisage ; le champ fichier n'a de nom que pendant un vrai téléversement (un fichier abandonné pour un dessin ne part plus avec le formulaire).
- Vérifié au navigateur sur une page d'essai locale (jamais commitée) à 1280 et 390 px : douze dessins plus « Téléverser » (7 puis 4 par rangée), l'aperçu suit nom, phrase et logo sans aucune requête, `logoAction` reste `keep` sur un dessin, le dialogue de Rétablir s'ouvre et s'annule. Aucun débordement.
- Restes : Enregistrer et Rétablir n'ont pas été exécutés. Aucun compte de test n'est superadmin, et le faire changerait l'identité de l'application pour tous les visiteurs. **À vérifier par l'auteur** : un enregistrement (l'écran-titre et la tête du rail changent), un téléversement PNG ou WebP et un refus, le passage d'un logo téléversé à un dessin, Rétablir.

---

### ☑ V3.1-87 — Administration (B) : le tableau de bord · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Admin-Decide.dc.html`. **Départ** :
`components/shell/AdminPanel.tsx` (`InviteAdminRow`, `AccountAdminRow`),
`app/page.tsx`, `/api/admin/invites`, `/api/admin/accounts`. **Dépend
de** : V3.1-35 (« Administration » dans le rail, superadmin seulement).

**Ce qui est décidé**
- Une page « Administration » (« Superadmin seulement · toute la
  plateforme »), vérifiée côté serveur (`isSuperadmin`) avant tout rendu.
- **Cinq tuiles** en tête : **À traiter** (le nombre en accent),
  **Comptes**, **Liens d'invitation actifs**, **Identité de
  l'application** (tuile du logo + nom), **Titres des joueurs** (nombre de
  titres ; panneau : V3.1-92). La tuile choisie (bordure
  d'accent) ouvre sa liste dessous. **La page s'ouvre sur « À traiter »**,
  ou sur Comptes s'il n'y a rien à traiter.
- **À traiter** : une ligne par compte avec `password_reset_requested_at`
  (« Tamara a demandé une réinitialisation de mot de passe · il y a 2 h ·
  compte sans email »), bordure d'accent, bouton **« Forcer une
  réinitialisation »** (geste existant ; le lien à usage unique s'affiche
  comme aujourd'hui, « à transmettre hors application »). Puis, sans
  geste, les comptes avec `must_change_password` (« doit changer son mot
  de passe à sa prochaine connexion · rien à faire, pour mémoire »). Note :
  « Les demandes de réinitialisation arrivent aussi chez le MJ de la
  campagne ; ici, celles de tous les comptes. »
- **Comptes** : recherche par nom (filtrage côté client) ; une ligne de
  verre par compte : initiale, nom, « depuis le … », étiquettes
  (**superadmin** violet, **Réinitialisation demandée · il y a …** accent,
  **Doit changer son mot de passe** neutre), ⋮ avec les gestes
  d'`AccountAdminRow` **inchangés** (forcer une réinitialisation,
  transférer un ruleset…, supprimer le compte en rouge + `ConfirmDialog`).
  Jamais le numéro.
- **Liens d'invitation** : en-têtes Monde, Campagne, Rôle, Réclamé par,
  État ; une ligne de verre par lien ; ⋮ avec les gestes d'`InviteAdminRow`
  **inchangés** (copier le lien, voir comme, mot de passe, réinitialiser le
  lien, révoquer, supprimer le compte ; destructeurs en rouge et
  confirmés).
- **Tablette** : tuiles en 2 × 2 ; ligne de lien sur deux lignes, en-têtes
  masqués, ⋮ en haut à droite. **Téléphone** : Accueil › Administration,
  « ‹ Accueil », tuiles en 2 × 2, nom de la tuile Identité sur une ligne
  (15 px).
- La section Administration de l'accueil disparaît (son contenu est ici).

**Critères d'acceptation**
- [~] Chaque geste d'`AdminPanel` est présent et fonctionne.
- [x] Un compte non superadmin reçoit une 404 sur la page (pas un écran vide).
- [x] Les compteurs des tuiles suivent les gestes sans rechargement.

**Clôture (18 octobre).**
- Décision d'Opus : Administration est une **route**, `/admin`, et non plus une destination locale de l'accueil. La 404 du critère n'existe que pour une page qui a une adresse. La coquille de l'accueil l'habille (`HomeShell page="admin"`) : ses lignes Mondes et Compte y mènent à `/` et `/?vue=compte`. La section Admin de l'accueil a disparu.
- Serveur (Opus) : la page vérifie `isSuperadmin` avant tout rendu, puis lit comptes, liens, identité et nombre de titres ensemble, avec elle (C1, C3) ; `countPlayerTitleTiers` compte sans lire de ligne. **Changement de sens** : forcer une réinitialisation efface la demande en attente (`accountAuth.forcePasswordReset`), chez le MJ comme ici ; le compte passe de « à traiter » à « doit changer son mot de passe ». Sans cela, la ligne restait à traiter après le geste. `SCHEMA.md` le dit.
- Interface (Sonnet) : `PageAdministration.tsx`, logique pure `lib/ui/administration.ts` (testée) ; les gestes d'`AdminPanel` repris avec les mêmes requêtes et les mêmes confirmations ; `AdminPanel.tsx` supprimé, cliquet du câblage 59 → 58. Correction d'Opus : le calcul « il y a … », écrit deux fois, en un seul hook.
- Vérifié au navigateur : `/admin` répond 404 à Testeur MJ et Testeuse A, et leur rail n'a pas d'Administration ; `/?vue=compte` ouvre le Compte. Mise en page, recherche, menu ⋮ et tuile d'ouverture vérifiés à 1280, 820 et 390 px sur une page d'essai locale (données fictives, jamais commitée), aucun débordement.
- Restes : aucun compte de test n'est superadmin. Les gestes eux-mêmes (forcer, transférer, supprimer, révoquer, mot de passe, voir comme) et les compteurs après un vrai geste sont **à vérifier par l'auteur**, avec son compte. La mention « compte sans email » de la planche manque : `AdminAccountRow` ne porte pas cette donnée. Les panneaux Identité et Titres arrivent avec V3.1-88 et V3.1-92.

---

### ☑ V3.1-83 — Choix : PJ sans fiche et « Créer mon personnage » · `S` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Choix-Decide.dc.html` (Mirelle Vantor, 3ᵉ carte).
**Départ** : `components/shell/ParticipantCharacterSheet.tsx` (`wizardOpen`,
« Aucune fiche de personnage pour cette entrée »),
`components/blocks/CharacterCreatorWizard.tsx`. **Dépend de** : 82.

**Ce qui est décidé**
- **PJ ouvert sans fiche** (`hasSheet: false`) : la carte garde portrait et
  phrase de la fiche de wiki ; à la place de l'espèce et de la classe,
  l'étiquette pointillée en accent « Fiche de personnage à créer » ; le
  bouton dit « Jouer Mirelle · créer sa fiche ». Réclamer **ouvre
  directement l'assistant de création** (la Création décidée, A), déjà au
  nom et au portrait de l'entité — plus besoin de toucher « Créer la
  fiche » sous « Aucune fiche de personnage ».
- **« + Créer mon personnage »** ouvre l'assistant sur une **entité
  nouvelle** ; la joueuse la réclame à la fin de l'assistant (même chemin
  serveur que la création depuis « Nouveau PJ » aujourd'hui). Annuler
  l'assistant revient au carrousel, rien n'est créé.

**Critères d'acceptation**
- [x] Réclamer un PJ sans fiche ouvre l'assistant avec son nom pré-rempli.
- [x] Créer un personnage de zéro le rend réclamé par la joueuse.
- [x] Annuler ne laisse ni entité ni réclamation orpheline.

**Clôture (18 octobre).**
- Décision d'Opus, dans l'esprit du ticket : un PJ sans fiche se réclame **à la validation** de l'assistant, pas au clic sur la carte. Une joueuse ne peut pas rendre un PJ (seul le MJ écrit dans `campaign_characters`) : réclamer d'abord aurait laissé une réclamation orpheline à chaque annulation, contre le troisième critère. Rien n'a changé dans le schéma.
- Serveur (Opus) : `reclamerEtCreerFiche` (`src/server/services/choixPersonnage.ts`, 4 tests) réclame puis écrit (la réclamation donne le droit d'écrire), n'écrit jamais un PJ pris par une autre, et reprend à l'écriture si le PJ est déjà à elle (seconde tentative). Action `reclamerEtCreerFicheAction`, schéma Zod de l'écrasement.
- Page `/joueur/nouveau-personnage` : sans `pj`, la création de zéro (chemin existant, réclamée à la fin) avec un bouton Annuler ; avec `?pj=`, l'assistant au nom et au portrait de la fiche, après que le serveur a revérifié que ce PJ est réclamable et sans fiche (un lien recopié renvoie au carrousel). L'assistant accepte une action de remplacement et une note de bandeau (`entityMode.onSubmit`, `note`) et un `onCancel` hors `entityMode`.
- Carte : étiquette pointillée « Fiche de personnage à créer », bouton « Jouer {prénom} · créer sa fiche ».
- Restes du 82 vérifiés en vrai (trois PJ libres créés en Testeur MJ, puis supprimés) : portrait, phrase, identité, rotation par flèches, clavier, points et glissé, boucle, aucun débordement à 1280 et 390 px. Corrigé au passage : le niveau s'affichait deux fois (« Clerc 1 1 » : `classesLabel` porte déjà les niveaux).
- Critères vérifiés au navigateur : réclamer Mirelle ouvre l'assistant prérempli et la rend sienne à la validation (message « Mirelle est à toi ») ; « Testine Essai » créée de zéro est réclamée ; annuler dans les deux cas laisse les réclamations et les lignes de campagne inchangées. Données du Banc d'essai rendues à leur état d'avant.
- Restes : un PJ ouvert dont le bloc `character` est réservé au MJ passe pour « sans fiche » aux yeux de la joueuse, et l'assistant lui créerait un second bloc ; cas jugé improbable, non traité. Le message de validation de l'assistant reste en anglais quand aucune classe n'est choisie (« Too small… »), défaut antérieur.

---

### ☑ V3.1-82 — Choix du personnage (C2) : le carrousel · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Choix-Decide.dc.html`. **Départ** :
`app/m/[worldSlug]/joueur/ChooseCharacterScreen.tsx`,
`app/m/[worldSlug]/joueur/page.tsx`, `listUnclaimedCharacters`
(`src/server/services/campaigns.ts`), `claimCharacterAction`.

**Ce qui est décidé**
- **Données** : `listUnclaimedCharacters` renvoie en plus, pour chaque PJ
  ouvert : le **portrait** (`entity_assets`, rôle `portrait`, URL signée
  comme ailleurs), le **`summary`**, et l'**identité calculée** par
  `characterSheet()` — espèce, classe(s) et niveau — ou `hasSheet: false`
  quand l'entité n'a pas de bloc `character`. Une requête groupée (pas de
  N+1). Rien n'est stocké (règle 16) ; seules les fiches visibles par la
  joueuse (règle 5).
- **Le carrousel** : la carte au centre en grand (portrait 330 px de haut,
  nom, « Elfe · Rôdeuse 3 » en accent, la phrase), bordure d'accent et
  halo ; ses voisines en retrait de part et d'autre (échelle 0,8, opacité
  0,45, désaturées) ; au-delà, masquées. Flèches ‹ ›, points (le point
  courant s'allonge), touches ← →, glisser au doigt ; le carrousel boucle.
  Toucher une voisine la centre.
- **« Nouveau personnage » est la dernière carte** : pointillés, grand +
  en accent, « Le tien, de zéro : l'assistant de création, pas à pas. »
- **La page s'ouvre sur « Nouveau personnage »** (à sa gauche le dernier
  PJ ouvert, à sa droite le premier). Sans PJ ouvert : la carte est seule,
  sans flèches ni points.
- **Arrivée par un lien qui vise un PJ précis** (V3.1-100) : le carrousel
  ne montre que **ce PJ et « Nouveau personnage »** (au cas où), et
  **s'ouvre sur le PJ**. Le composant reçoit la liste et la carte de départ
  du serveur ; il ne filtre rien lui-même.
- **Un seul bouton** sous le carrousel : « Jouer Naivara » (prénom), ou
  « + Créer mon personnage » quand la carte « Nouveau » est centrée.
  « Jouer » réclame (`claimCharacterAction`) puis l'onglet Personnage
  affiche la fiche jouable. Message après réclamation : « Naivara est à
  toi : l'onglet Personnage montre maintenant sa fiche. Ton MJ peut encore
  le réattribuer. » Échec (déjà pris) : message de l'action, le carrousel
  se recharge.
- En-tête : « Choisis ton personnage » et « {monde} · {campagne} — ton MJ
  a laissé {n} personnages ouverts. Tu peux aussi créer le tien. »
- **Tablette** : même carrousel, sans flèches, cartes de 280 px.
  **Téléphone** (onglet Perso. de la barre du joueur) : carte de 250 px,
  voisines qui dépassent des bords, bouton sur toute la largeur au-dessus
  de la barre.

**Critères d'acceptation**
- [ ] À l'ouverture, « Nouveau personnage » est centrée.
- [ ] Clavier : ← → font tourner ; Entrée déclenche le bouton.
- [ ] Une seule requête pour la liste enrichie (vérifiée en test de service).
- [ ] Un PJ caché à la joueuse n'apparaît pas.

**Clôture (18 octobre).**
- Serveur (Opus) : `listCartesPersonnage` lit tout par lot (blocs, portraits, lecteur, libellés), avec un test d'une requête par nature de donnée et un test qu'aucune donnée cachée ne sort ; `premierePhrase` (noyau, tests d'abord) saute le texte marqué `spoiler` ; `libellesIdentite` est partagé avec `listWorldPlayerCharacters`. Décision de l'auteur : la phrase est la première du premier texte visible (la colonne `summary` du ticket n'existe plus).
- Interface (Sonnet) : le carrousel, `lib/ui/carrousel.ts` testé.
- Corrections d'Opus : message « c'est réclamé » par `?reclame=1` après la redirection ; le clavier marche sans `autoFocus` (plus d'anneau au chargement).
- Vérifié en Testeur MJ à 1280 et 390 px : carte « Nouveau » seule, aucun débordement, Entrée mène à la création.
- Restes : les cartes de PJ et la rotation n'ont pas été vues en vrai (aucun PJ libre au Banc d'essai) ; le cas « PJ sans fiche » revient à V3.1-83.

---

### ☑ V3.1-81 — L'Apparence du Compte est la Personnalisation C · `S` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Compte-Decide.dc.html`, section Apparence ;
`Perso-Decide.dc.html` (la Personnalisation décidée). **Départ** :
`components/shell/PersonnalisationPanel.tsx`. **Dépend de** : 80.

**Ce qui est décidé**
- La section Apparence **monte `PersonnalisationPanel` tel quel** (un code,
  deux portes : la fenêtre Personnalisation des outils du MJ, et le
  Compte, pour tout le monde). Pas de copie du composant.
- La barre : la **pilule des quatre modes** et le **contraste élevé** sur
  une ligne, le **flou du fond sur toute la largeur** en dessous ; puis la
  galerie des fonds avec leurs points de modes lisibles, les images
  personnelles (+, ×), et la note « Ces réglages sont les tiens, sur cet
  appareil… ».
- Tablette : galerie à deux vignettes. **Téléphone** : la barre en colonne
  (modes, contraste, flou), galerie à deux colonnes. **Piège corrigé sur la
  planche le 9 octobre** : en colonne, ne jamais donner au flou
  `flex-basis: 100%` (cela devient toute la hauteur et pousse le réglage
  hors de l'écran) ; libellés de la pilule en 11 px pour que
  « Demi-sombre » tienne.

**Critères d'acceptation**
- [x] Un compte joueur sans monde mené règle son mode et son fond depuis
  Compte (critère déjà posé par V3.1-35).
- [x] Téléphone 390 px : le flou est entièrement visible et réglable.
- [x] Aucune duplication de `PersonnalisationPanel`.

**Clôture** : Opus — `lirePersonnalisation` (`src/server/services/personnalisation.ts`) lit les cookies de l'appareil pour les trois portes (page et fenêtre Personnalisation des outils du MJ, section Apparence du Compte : règle des trois, la lecture était recopiée deux fois) ; l'accueil monte `PersonnalisationPanel` dans l'emplacement `apparence` de `PageCompte`. Interface (Sonnet) — la barre de la planche : pilule `Tabs` des quatre modes et interrupteur « Contraste élevé » sur une ligne, flou sur toute la largeur (sans `basis-full`), galerie à points de modes lisibles, « + » et « × », note de la planche ; en colonne sur téléphone ; `Tabs` accepte des onglets désactivés (mode illisible sur ce fond, avec son explication). Corrigé par Opus : les flèches du clavier sautent désormais un onglet désactivé au lieu de s'y arrêter ; la rangée de pastilles du Compte, collante, est floutée (le texte passait au travers). Vérifié dans le navigateur (Testeuse A, compte sans monde mené) : Apparence dans le sommaire et la page ; mode Clair appliqué, flou réglé à 10 px ; 390 px : curseur du flou visible (144 px de large), pilule sans débordement, aucun défilement horizontal ; page Personnalisation du MJ (Testeur MJ) avec son curseur. Réglages limités aux cookies du navigateur de test.

*Restes* : les libellés de la pilule restent en 12 px (la charte interdit 11 px, la règle de lint l'a refusé) — « Demi-sombre » tient à 390 px. Le « + » (envoi d'une image) et le « × » (retrait) ne sont pas rejoués : leur comportement n'a pas changé, seule la présentation.

---

### ☑ V3.1-80 — Compte (A) : une page en sections · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Compte-Decide.dc.html`. **Départ** :
`components/shell/HomeProfilePanel.tsx` (et `DisplayNameForm`,
`PasswordForm`, `MyInvitePanel.tsx`, `DeleteAccountSection.tsx`),
`app/settings/actions.ts` (`setLocaleAction`), `app/page.tsx`.
**Dépend de** : V3.1-35 (« Compte » dans le rail de l'accueil).

**Ce qui est décidé**
- Une page « Compte » ouverte par l'entrée « Compte » du rail de l'accueil
  (au téléphone : Accueil › Compte, bouton « ‹ Accueil »). En-tête :
  « Compte » et une ligne de contexte (« Léonie · MJ d'un monde, joueuse
  dans trois », calculée).
- **Six sections empilées en cartes de verre**, dans cet ordre :
  1. **Identité** : nom affiché (champ + Enregistrer, `DisplayNameForm`) ;
     « Ton identifiant » : le nom et le numéro (`handle_tag`, en accent,
     chiffres tabulaires) avec la note « Le numéro distingue deux
     « Léonie ». Tu ne le tapes jamais pour te connecter ; il n'est visible
     qu'ici et par le MJ de tes campagnes. » ; l'email, seulement pour un
     compte à email (« · seulement pour les comptes ouverts avec un email »).
  2. **Connexion** : la note « Tu te connectes avec ton nom et ton mot de
     passe. Mot de passe oublié : ton MJ ou l'administrateur peut le
     réinitialiser — aucun email n'est envoyé. » (texte adapté pour un
     compte à email), nouveau mot de passe, « Encore une fois »,
     « Changer le mot de passe » (`PasswordForm`) ; « Les deux ne
     correspondent pas. » en rouge sous le bouton tant qu'ils diffèrent.
  3. **Mon lien d'invitation** (`MyInvitePanel`), **seulement si l'on a
     rejoint par un lien** : mot de passe du lien (vide pour retirer) +
     Enregistrer.
  4. **Apparence** : V3.1-81.
  5. **Langue** : deux pastilles Français / English (`setLocaleAction`,
     cookie + profil) et la note « Enregistrée sur ton compte (elle te suit
     d'un appareil à l'autre). Le contenu des mondes ne change pas de
     langue. »
  6. **Supprimer le compte**, bordure et titre en rouge
     (`DeleteAccountSection`) : ce qui est supprimé (le compte et les mondes
     dont on est propriétaire, nommés), « Tape SUPPRIMER », bouton
     « Supprimer définitivement » désactivé tant que le texte ne
     correspond pas.
- **Sommaire à gauche** (200 px) : Identité, Connexion, Mon lien
  d'invitation (absent si la section l'est), Apparence, Langue, Supprimer le
  compte (en rouge). Toucher une entrée fait défiler jusqu'à la section et
  l'allume (bordure d'accent) ; le défilement allume aussi l'entrée de la
  section visible.
- **Tablette** : le sommaire devient une rangée de pastilles en tête
  (Identité, Connexion, Invitation, Apparence, Langue, Supprimer).
  **Téléphone** : mêmes pastilles ; libellés au-dessus des champs ; un
  bouton à côté d'un champ (« Enregistrer », « Supprimer définitivement »)
  passe sous le champ plutôt que de se couper sur deux lignes.
- La colonne « Profil » de l'accueil disparaît (son contenu est ici).

**Critères d'acceptation**
- [x] Chaque geste de `HomeProfilePanel` est présent et fonctionne.
- [x] Le numéro n'apparaît qu'en Identité.
- [x] « Mon lien d'invitation » est absent pour un compte qui n'a pas
  rejoint par un lien.
- [x] Changer la langue bascule l'interface sans rechargement manuel.
- [x] Téléphone 390 px : aucun bouton coupé, aucun défilement horizontal.

**Clôture** : données (Opus) — `getOwnHandle` (repo : le nom et le numéro de son propre compte) ; la page d'accueil assemble `DonneesCompte` avec elle (C1) : numéro, email seulement s'il n'est pas synthétique, invitation réduite à `{ id, hasPassword }` (l'ancienne route envoyait l'invitation entière, jeton compris), langue, mondes possédés nommés, contexte compté par `repartirMondes` ; `compteDuContexte` et `sectionsCompte` (`lib/ui/compte.ts`, tests d'abord). Interface (Sonnet, interrompu une fois par une limite de session puis relancé) — `PageCompte` : six cartes de verre, sommaire de 200 px suivi par `IntersectionObserver`, pastilles sur tablette et téléphone ; `PasswordForm` gagne « Encore une fois » (bouton désactivé et message rouge tant qu'ils diffèrent) ; `MyInvitePanel` reçoit l'invitation avec la page et ne charge plus rien au montage (cliquet 60 → 59) ; `DeleteAccountSection` nomme les mondes possédés, champ toujours visible ; `HomeProfilePanel` supprimé. Opus : la destination Compte de `HomeShell` passe de `max-w-2xl` à `max-w-4xl` (le sommaire n'y tenait pas). Vérifié dans le navigateur (Testeuse A) : 1280 et 390 px sans défilement horizontal ; le numéro une seule fois, en Identité ; « Mon lien d'invitation » absent (compte sans lien) ; mots de passe différents → message et bouton désactivé ; suppression désactivée tant que SUPPRIMER n'est pas tapé ; English bascule l'interface sans rechargement, puis retour au français (la langue de Testeuse A est revenue au français). Rien d'écrit sur le compte de test hors la langue, restaurée.

*Restes* : la section Apparence attend V3.1-81 (emplacement prévu, absent tant qu'il est vide). Non rejoués ici : l'enregistrement du nom et du mot de passe (actions inchangées, comptes de test à préserver), un compte à email et un compte qui a rejoint par un lien (aucun sous la main). La ligne de contexte dit « joueur » au neutre (le genre n'est pas connu).

---

### ☑ V3.1-86 — La marque partout : rail, onglet, Rejoindre, Réinitialiser · `S` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : `Entree-Decide.dc.html`, `Admin-Decide.dc.html` (tête du
rail). **Départ** : `app/layout.tsx` (`metadata.title`),
`app/rejoindre/[token]/` (`InvitePasswordGate`, `JoinForm`),
`app/reinitialiser/[token]/ResetPasswordForm.tsx`, le rail de l'accueil.
**Dépend de** : 84, 85.

**Ce qui est décidé**
- **Tête du rail de l'accueil** (hors d'un monde) : la tuile du logo et le
  nom de l'application (à la place du nom du monde). Dans un monde, rien
  ne change.
- **Onglet du navigateur** : titre = nom de l'application
  (`generateMetadata` lisant `getAppIdentity()`), favicon = le logo choisi
  (les douze sont dessinés en clair sur la tuile d'accent ; image
  téléversée sinon).
- **Rejoindre, sa porte à mot de passe, Réinitialiser** prennent le cadre
  de l'écran-titre : même fond, même titre ; le panneau de verre à la
  place du menu porte leur formulaire **actuel** (rôle, nom, mot de passe ;
  nouveau mot de passe) — **sans le choix du personnage** : la joueuse le
  fait ensuite dans le carrousel (V3.1-100).

**Critères d'acceptation**
- [x] Changer le nom en administration change l'onglet du navigateur au
  rechargement suivant.
- [x] Les trois formulaires gardent tous leurs champs et messages, sauf le
  choix du personnage de Rejoindre (déplacé, V3.1-100).

**Clôture** (Opus, sans délégation : quelques fichiers, contexte déjà chargé par 85) — onglet : `generateMetadata` (`app/layout.tsx`) lit `getAppIdentity()` (titre = nom, description = phrase) ; icône = l'image téléversée, sinon `/api/app-identity/icone?cle=…` qui dessine la tuile d'une des douze clés (Zod, `next/og`, publique dans le middleware, cache d'un an : une adresse donne toujours la même image ; les dessins de `LogoApp` partagés par `DESSINS_LOGO`) ; le favicon par défaut de Next (`app/favicon.ico`, celui de create-next-app) est retiré. Tête du rail de l'accueil : `LogoApp` de 26 px et le nom. `CadreTitre` (`components/brand/`) extrait de l'écran-titre, sans état : Rejoindre (lien invalide, porte à mot de passe, lien déjà servi, formulaire) et Réinitialiser (lien invalide, formulaire) y posent leur formulaire **actuel** dans le panneau de verre ; le choix du personnage était déjà sorti de Rejoindre (V3.1-100). Vérifié dans le navigateur : les douze icônes rendues, une clé inconnue refusée (400), titre « Antre Nous » sur /login, /rejoindre, /reinitialiser et l'accueil, lien `rel=icon` vers la tuile ; tête du rail ; les deux portes avec un lien invalide.

*Restes* : le changement de nom en administration n'est pas rejoué ici (il toucherait l'identité réelle) ; il repose sur l'invalidation déjà en place de `getAppIdentity` (`updateTag`, V3.1-84). Les formulaires avec un jeton valide ne sont pas vus à l'écran (aucun jeton de test, jamais affiché) : seules leurs enveloppes ont changé.

---

### ☑ V3.1-85 — Écran-titre (C) : connexion, création, mot de passe oublié · `M` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet.**

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : `Entree-Decide.dc.html`. **Départ** : `app/login/page.tsx`,
`app/login/actions.ts`, `app/auth/forgot-password/`. **Dépend de** : 84.

**Ce qui est décidé**
- **Le fond** de l'application (le fond par défaut), flouté et voilé ; au
  tiers haut, **la tuile du logo** (84 px, accent) **et le nom en très
  grand** (Outfit 800, ~72 px) sur une ligne, la **phrase d'accueil**
  dessous — lus dans `getAppIdentity()`.
- **Le menu** : trois gros boutons pilule de 340 px — **« Se connecter »**
  (plein, accent), **« Créer un compte »**, **« J'ai un lien
  d'invitation »** (verre). Survol : légère mise à l'échelle et bordure
  d'accent.
- Choisir **ouvre un panneau de verre (380 px) à la place du menu**,
  « ‹ Menu » en tête, son titre (« Bon retour », « Bienvenue », « Mot de
  passe oublié ») :
  - **Se connecter** : « Ton nom ou ton email », « Mot de passe », bouton,
    « Mot de passe oublié ? » en lien (action `login` inchangée).
  - **Créer un compte** : « Ton nom », « Mot de passe » (8 caractères au
    moins), la note « Pas d'email : tu te connectes avec ton nom et ce mot
    de passe. Un numéro (#4821) distingue deux comptes du même nom ; seul
    le MJ de tes campagnes le voit. Le compte n'ouvre aucun monde tant
    qu'on ne t'y invite pas. », « Créer mon compte » (`createAccount`).
  - **Mot de passe oublié — un seul champ** « Ton nom ou ton email » :
    une action nouvelle `requestResetAction` (Zod) qui choisit la voie —
    s'il y a un « @ », le chemin email (`requestPasswordReset`) ; sinon la
    demande au MJ (`requestResetByName`). **Réponse identique dans tous
    les cas** : « Demande envoyée. Si ce compte existe, un lien part vers
    son email, ou ton MJ reçoit la demande dans son panneau. »
    « ‹ Revenir à la connexion ».
  - **J'ai un lien d'invitation** : un champ pour coller le lien, qui mène
    à `/rejoindre/[token]` (le jeton est extrait côté client ; un lien
    invalide donne le message actuel « Ce lien n'est plus valide »).
- `/signup` (compte à email) ne change pas et n'est pas lié depuis ici.
- **Téléphone** : titre 46 px, logo au-dessus du nom ; menu de 300 px ;
  panneau de 340 px. Tablette : comme l'ordinateur.

**Critères d'acceptation**
- [x] Les trois actions existantes fonctionnent depuis le nouvel écran.
- [x] Mot de passe oublié : même message pour un nom inconnu, un nom connu,
  un email inconnu, un email connu (test).
- [x] Le nom, la phrase et le logo viennent de l'identité (V3.1-84).

**Clôture** : serveur (Opus) — `voieReinitialisation` et `requestResetSchema` (`lib/auth/reinitialisation.ts`, tests d'abord : un email valide part par le lien, tout le reste est un nom, jamais un email deviné) ; `demanderReinitialisation` (`src/server/services/passwordReset.ts`) ne rend rien et ne lève jamais, l'envoi de l'email passe par `sendPasswordResetEmail` (repo) ; `requestResetAction` répond `{ success: true }` dans tous les cas, test des quatre cas (nom connu ou non, email connu ou non) avec la base simulée. Interface (Sonnet) — `app/login/page.tsx` devient serveur et lit `getAppIdentity()` ; `EcranTitre` (menu de trois pilules, quatre panneaux de verre, chacun son propre état) ; `components/brand/LogoApp.tsx` dessine les douze logos de la planche d'administration (réutilisé par 86) ; `cheminInvitation` (`lib/ui/ecranTitre.ts`) s'appuie sur `jetonDepuisLien`. Corrigé par Opus : React vidait le nom après une faute de mot de passe ; le nom (jamais le mot de passe) est désormais gardé, à la connexion comme à la création. Le pilote de mesure ouvre le formulaire par « Se connecter ». Vérifié dans le navigateur : 1280 et 390 px conformes à la planche (logo au-dessus du nom sur téléphone) ; un lien sans jeton dit « Ce lien n'est plus valide. » sans naviguer ; « Mot de passe oublié » sur un nom inexistant rend le message unique (rien déposé) ; mauvais mot de passe puis connexion de Testeuse A, arrivée sur l'accueil.

*Restes* : la création de compte n'est pas essayée en direct (jamais de compte neuf, `docs/TESTS.md`) ; elle appelle l'action `createAccount` inchangée. `app/auth/forgot-password/` n'est plus lié d'ici, gardé tel quel. Le titre du panneau d'invitation (« Lien d'invitation ») n'était pas dessiné : choisi par Sonnet.

---

### ☑ V3.1-36 — Le solo : ailes d'ordinateur et téléphone modèle A (lot d) · `L` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — planches définitives ; le moteur solo ne change pas.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Solo-Desktop » ; « Décidé · solo sur téléphone (modèle A) »
(trois planches). **Départ** : `SoloShell.tsx`, `IntentBar.tsx`,
`ScenePanel`, `ConsequencesDrawer`. **Dépend de** : 29, 32, 33.

- Ordinateur : poignées de repli sur les bords de la fenêtre du Jeu ; Monde
  disparaît replié ; la Fiche repliée devient une bande de 96 px — bouclier
  CA, PV, Niveau, Charge.
- Téléphone : barre Jeu, Monde, Fiche | Quêtes, Règles, Notes, dé encoché.
  Monde = wiki du joueur avec « Présents dans la scène » en tête, puis
  récents (Quêtes et Règles n'y sont plus). Jeu : bandeau lieu / heure,
  bande de jauges, fil, barre d'intention ; ✦ ouvre la feuille des
  conséquences. Fiche : la fiche de 32. Quêtes : pilule En cours /
  Terminées, une quête en feuille avec ses étapes. Notes : Les miennes /
  Journal de partie.
- « Jouer » ouvre l'outil de dés pré-rempli (33) ; « Lancer » confirme, le
  tour suit le chemin actuel de V3-B5.

**Critères d'acceptation**
- [x] Un tour complet sur téléphone : intention, outil de dés, Lancer, le tour dans le fil.
- [x] Aucun changement du moteur de tour (tests solo existants verts sans modification).

**Clôture** : interface (Sonnet), relue par Opus. Ordinateur — deux poignées sur les bords du Jeu (`SoloShell`) ; le Monde disparaît replié, la Fiche devient une bande de 96 px (`BandeFiche` : CA, PV, Niveau, Charge en kg). La fiche publie ses jauges par `SoloContexte` (une page serveur ne peut pas passer de fonction à `SoloShell`) : elle reste le seul endroit qui charge la feuille. Téléphone — barre du solo dans `PlayerShell`, vues `?vue=` écrites par `history.replaceState` (aucune navigation de document, vérifié), Monde (présents, wiki avec recherche, récents), Quêtes (pilule, feuille avec étapes), bande de jauges et ✦ des conséquences en feuille du bas. « Jouer » ouvre l'outil de dés (`PreReglage.lancer`) ; « Lancer » appelle `encaisser-fiche`, le serveur tire le dé ; une attaque qui touche rouvre l'outil sur les dégâts. Logique pure dans `lib/ui/solo.ts` (23 tests). Aucun fichier du moteur, des routes ni de `lib/solo` touché ; tests solo existants verts sans modification. Corrigé par Opus : l'outil affiche le DD figé de la demande (il montrait « — ») ; poignées redessinées en languettes neutres (cerclées d'accent et ouvertes, elles encadraient une ligne du fil comme une sélection). Vérifié dans le navigateur (Testeuse A, Banc d'essai) : 390 px — cinq tours d'Investigation complets (intention, outil, Lancer, tour au fil), vues Monde, Quêtes, Fiche ; 1440 px — Fiche en bande, puis les deux repliées (Jeu centré). Les cinq tours restent au journal de la campagne de test.

*Restes* : Notes sans « Les miennes / Journal de partie » (la page existante est liée telle quelle) ; « Terminées » = toutes les étapes faites, faute de quêtes closes chargées ; attaque, dégâts enchaînés et avantage non joués à l'écran (pas de cible dans la scène de test). En dev, le fil affiché prend jusqu'à 20 s de retard : l'écran sonde `/sheet` deux fois toutes les 4 s (fil et fiche), ce qui préexistait au ticket.

---

### ☑ V3.1-34 — L'outil Table du MJ · `L` · sans modèle IA — **fait le 18 octobre**

**Modèle conseillé : Sonnet** — tout est esquissé ; données et règles fournies par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » (Table) et « —
feuilles ouvertes » (Toute la table). **Départ** : `mjToolWindows.ts`,
`MjToolWindowContent.tsx` (un outil de plus dans la liste). **Dépend de** :
24, 26 (commande E), 29, 33.

- Une ligne par PJ de la campagne : nom + niveau ; dessous « joueur · CA ·
  PV » puis la ligne des états ; à droite classe et sous-classe. Toucher
  déplie.
- Déplié — **revu le 5 octobre** (alignement sur la fiche et la carte de
  l'ordinateur) : la ligne dépliée **est** le haut de la fiche du téléphone,
  même composant que la carte de l'ordinateur — bouclier de CA ; PV
  (temporaires par-dessus), niveau et XP, épuisement, chacun avec la
  commande E ; initiative, vitesse, maîtrise, inspiration ▲▼ ; Perception
  passive, dés de vie ▲▼, états · concentration (× retire ou rompt, « + »
  ouvre les états du ruleset en feuille), repos court et long du PJ ; « Ce
  qui se dépense » en groupes ; charge et pièces avec commande E
  (`changeCurrency`, un message dit le change fait). Aucune commande sur
  CA, initiative, vitesse, maîtrise, Perception passive. La ligne repliée ne
  change pas.
- À 0 PV, la ligne se transforme : fond rouge, « Contre la mort »,
  trois réussites / trois échecs, « Soigner +1 PV » (règles de 24).
- « Toute la table » : + XP, ± pièces, repos court, repos long — chacun en
  feuille avec « Pour qui » ; XP et pièces à partager ou à chacun, aperçu par
  PJ, qui monte de niveau est signalé ; les repos passent par
  `takeShortRest` / `takeLongRest` pour chaque PJ coché.
- Chaque geste passe par le même service que la fiche (même journal) ; le
  MJ a toutes les commandes. Sur ordinateur : fenêtre d'outil MJ, ascenseur
  fin ; sur téléphone : `no-scrollbar`.
- **Ordinateur et tablette — décidé le 5 octobre** (planche « Décidé ·
  outil Table ») : une carte par PJ, qui **est** le haut de la fiche
  (composant partagé avec V3.1-26 / V3.1-32, en mode MJ), plus la charge et
  les pièces ; ▲▼ sur les dés de vie ; aucune commande sur CA, initiative,
  vitesse, maîtrise, Perception passive (valeurs dérivées). Deux cartes par
  rangée, une seule dans un volet partagé ou sur tablette.

**Critères d'acceptation**
- [x] Les gestes de la planche, chacun journalisé une fois.
- [x] Partage de 10 po entre trois PJ : 3 po chacun, le reste affiché.
- [x] Un repos long sur trois PJ : trois résultats, trois événements `long_rest`.
- [x] Ordinateur : la carte réutilise le composant du haut de fiche, sans le dupliquer.

**Clôture** : serveur (Opus) — `partagerEgalement` (noyau, tests d'abord : 10 po entre trois PJ, 3 chacun et 1 de reste) ; trois gestes qui manquaient, derrière la porte commune et l'interrupteur de table : `actions/conditions` (poser ou retirer un état), `actions/concentration` (rompre, par `setConcentration`), `actions/hit-dice` (dés de vie ▲▼ bornés au total) ; `getTableParty` (chaque PJ résolu comme sa fiche) servi par la fenêtre d'outil MJ `table` ; `characterActions.integration.test.ts` 11/11. Interface (Sonnet) — `RangeeChiffree` extraite de `CharacterSheetHeader` et partagée (la fiche est inchangée, vérifié à l'écran), `OutilTable` (cartes, lignes, 0 PV en rouge, compteurs par recharge, charge et pièces), `FeuilleToutelaTable` (Pour qui, à partager ou à chacun, aperçu, un appel par PJ), page `/mj/table`, entrées MJ et téléphone. Corrigé par Opus : la charge sortait en livres sous l'unité kg (même défaut corrigé sur la fiche solo, `FicheJouableSac`). Vérifié dans le navigateur en MJ (Banc d'essai) : 1280 px — +10 po à partager (+5 par PJ, aperçu juste), puis rendus ; « À terre » posé puis retiré ; 390 px — lignes repliées et dépliées ; la fiche d'un PJ identique à avant. Les bourses de test sont revenues à 5 et 18 po.

*Restes* : PV temporaires sans commande dans la carte (affichage « +N temp. » seul) ; les trois événements `long_rest` d'un repos sur trois PJ suivent du code testé ailleurs (`takeLongRest`, un appel par PJ), non revérifiés à l'écran.

---

### ☑ V3.1-35 — Accueil en tableau de bord (lot h) · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — proposition 3 tranchée ; « Reprendre » rangé dans le navigateur (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `HomeShell.tsx`, `HomeScreen.tsx`,
`CampaignsPanel.tsx`. **Dépend de** : 25, 27.

- Rail du joueur : Mondes, Compte, Administration (superadmin seulement),
  Déconnexion en pied ; dalle Outils avec les dés seuls.
- En haut : prochaines séances de tous les mondes ; « Reprendre » sur la
  dernière visite (mémorisée dans le navigateur).
- Bouton « Nouveau monde » agrandi, à gauche : Mener une partie, Jouer en
  solo, Rejoindre une table (coller un lien d'invitation).
- Colonnes « Je mène » (+ « En solo ») et « Je joue » sur une même ligne de
  titres ; panneau du monde choisi à droite, avec les outils du **rôle tenu
  dans ce monde**.
- Téléphone : pilule Je mène / Je joue / Solo, le monde en feuille,
  « Nouveau monde » en grand bouton.

**Critères d'acceptation**
- [x] Un compte MJ dans un monde et joueur dans un autre voit les bons outils pour chacun.
- [x] « Rejoindre une table » accepte un lien d'invitation valide et refuse un lien invalide, sans rien créer.
- [x] « Reprendre » absent si rien n'est mémorisé.

**Clôture** : serveur (Opus) — prochaine séance de chaque monde dans les cartes de l'accueil, en une requête (`listNextSessionsForCampaigns`, même règle que `getNextSession`) ; `POST /api/invitations/verifier` (lien collé → valide ou non, rien de créé ; `jetonDepuisLien` testé ; test d'intégration dans `campaignInvites.integration.test.ts`, 12/12) ; `POST /api/dice-rolls` (jet hors de tout monde, lancé par le serveur, jamais enregistré) ; « Reprendre » : la dernière fiche ouverte, gardée dans le navigateur avec les fiches récentes (`lib/ui/recents.ts`, testé). Interface (Sonnet) — `HomeShell` sur le rail du joueur (dé seul `DeSeulDalle`), `AccueilHaut`, `NouveauMonde`, `RejoindreTable`, colonnes et panneau par rôle, téléphone en pilule et feuille du bas ; logique dans `lib/ui/accueil.ts` (testée). Corrigé par Opus : la date et l'heure d'une séance sont deux colonnes (la requête plantait l'accueil), pilule du téléphone ouverte sur le premier onglet non vide, dé dans la barre du bas du téléphone (le bouton flottant la recouvrait). Vérifié dans le navigateur : Testeur MJ à 1280 px (« Je mène », classeur Journal / Joueurs / Accès / Réglages, lien invalide refusé sans quitter l'accueil, jet de dés hors campagne sans « Secret ») ; Testeuse A à 1280 et 390 px (« Je joue », Mon personnage, Prochaine séance, MJ, stats ; « Reprendre » après une fiche ouverte, absent dans un navigateur neuf).

*Restes* : PV et XP du personnage dans le panneau joueur, et « Où tu en étais » d'un monde solo (planche) : ils demandent des lectures que l'accueil ne fait pas ; entre 768 et 1280 px, le panneau du monde passe sous les colonnes.

---

### ☑ V3.1-20 — Fenêtres du MJ en deux volets à onglets · `L` · sans modèle IA — **fait le 17 octobre (ADR 0066)**

**Modèle conseillé : Sonnet** — interface décidée et esquissée, sans nouvelle donnée.

Lot g du ticket parent V3.1-19 (refonte « verre minéral »).

**Constat.** Les fenêtres du MJ se déplacent librement, s'aimantent à une
moitié d'écran contre un bord, se réduisent en bas, mais **ne se
redimensionnent pas** ; elles s'ouvrent à 860 px, décalées en cascade. L'auteur
veut que la place se répartisse toute seule.

**Décision** (sur quatre propositions esquissées et vivantes dans « verre
minéral », rangée « Fenêtres du MJ » : 1 tuiles à deux, 2 une grande + une
pile, 3 deux volets à onglets, 4 une fiche + des vignettes) : **la 3**, avec
son évolution faite tout de suite.

- **Une fiche** prend toute la zone de travail.
- **Une deuxième** ouvre un second volet, moitié-moitié ; le séparateur se fait
  glisser, un double-clic le ramène au milieu.
- **Au-delà**, une fiche ne remplace rien : elle s'ajoute **en onglet** dans le
  volet actif (le dernier cliqué). Les onglets vivent dans la barre de titre du
  volet, chacun avec son ×.
- **Glisser un onglet** :
  - sur l'autre volet → il y passe (c'est ainsi qu'on choisit ce qui s'affiche
    de chaque côté) ;
  - hors de la barre d'onglets, sur la moitié vide quand il n'y a qu'un volet →
    il crée le second volet.
- Un volet dont on ferme le dernier onglet disparaît ; l'autre reprend toute la
  place.
- Les pastilles restent : agrandir un volet le temps de lire, fermer.

**Ce qui ne change pas** : chaque fiche reste dans l'adresse (`?avec=`, ADR
0006/0011) — l'URL devra porter aussi le volet et l'onglet actif de chaque
fiche, pour qu'un rechargement rende la même disposition. Sur téléphone, rien
ne change (plein écran, une fiche à la fois).

**À trancher en le codant** : la barre des fiches réduites (V2-K4) devient
inutile si plus rien ne se réduit — onglets à la place. Un ADR remplacera la
partie « fenêtres flottantes » de l'ADR 0006.

**Tranché le 4 octobre, pour que le ticket parte à Sonnet** : la barre des
fiches réduites (V2-K4) disparaît, les onglets la remplacent ; l'ADR qui
remplace la partie « fenêtres flottantes » de l'ADR 0006 s'écrit dans ce
ticket. Sur téléphone, la pile « N fiches » en feuille est faite par
V3.1-29. **Dépend de** : V3.1-25 (pilule).

**Critères d'acceptation**
- [x] Une, deux, trois fiches et plus : disposition conforme ci-dessus.
- [x] Glisser un onglet d'un volet à l'autre, et hors de la barre pour créer le second volet.
- [x] Séparateur glissable, double-clic au milieu.
- [x] Rechargement : même disposition (URL).
- [x] Catalogue mis à jour (planche « Fenêtre flottante » remplacée).

**Clôture** : logique (Opus) — `lib/ui/volets.ts`, testée d'abord (placer, retirer, glisser, partage, adresse `?volets=` qui rend la même disposition, ancien lien et adresse abîmée tolérés) ; ADR 0066, qui remplace la partie « fenêtres flottantes » de l'ADR 0006. Interface (Sonnet) — `VoletsLayer.tsx` (une boîte stable par fiche, la primaire y entre par un portail : changer de volet ne remonte jamais une fiche), `DesktopWindowsProvider` réécrit (disposition dérivée de l'adresse), onglets glissables (HTML5), séparateur à capture de pointeur ; `WindowFrame` et la barre des fiches réduites retirés ; `?volets=` suit `?avec=` au changement de section. Corrigé par Opus : onglets qui débordaient d'un volet étroit, volets collés au rail (désormais un cadre arrondi à 8 px). Vérifié dans le navigateur à 1280 et 820 px (MJ) : une, deux, trois fiches ; glisser vers l'autre volet ; dépôt sur la moitié droite qui crée le second volet ; séparateur à 31 % puis rechargement identique ; aucun remontage d'une fiche déplacée ; téléphone inchangé (390 px, pile « 2 fiches »).

*Restes* : navigation au clavier par flèches dans une barre d'onglets (chaque onglet reste atteignable à la tabulation) ; la couche suit la zone par sa taille, pas par un simple décalage sans changement de taille.

---

### ☑ V3.1-33 — L'outil de dés unique (feuille, panneau, scintillement) · `L` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — ADR 0035, ADR 0036 §6, planches précises ; la cible reste à V3.1-21.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : téléphones (feuille des dés), « Décidé · outil de dés sur
ordinateur et tablette », « Décidé · le jet en animation » (l'outil réel,
issue du d20 forçable : réussite, échec, critique). C'est le même gabarit
sur toutes les planches qui ont un outil de dés (zone « Fiche de
personnage » entière, six téléphones MJ et joueur, trois téléphones solo,
outil de dés sur ordinateur, Initiative).
**Départ** : `DiceRollPanel.tsx`, `POST /api/campaigns/[id]/dice-rolls`.
**Dépend de** : 29.

- Point d'entrée serveur étendu (Zod) : dés, **modificateur**, **avantage /
  désavantage**, **libellé**, secret. Le serveur lance ; avec avantage, il
  renvoie les deux d20 et lequel est retenu.
- Une seule interface : feuille du bas sur téléphone (hauteur de la feuille
  Outils), panneau ancré au dé du rail sur ordinateur et tablette. Dés d4 à
  d100 empilables avec compteur ; modificateur dans la case sous le d10
  (commande E) ; pilule Normal / Avantage / Désavantage ; une ligne
  **Cibler · Lancer · Effacer** — Cibler grisé tant que V3.1-21 n'est pas
  livré.
- Résultat : chaque dé (max en ambre, 1 en rouge) ; avantage : paire
  étiquetée, d20 retenu cerclé d'ambre, l'autre effacé. Derniers jets (30)
  qui défilent avec l'ascenseur fin de `globals.css`.
- Animation scintillement : les chiffres défilent flous puis se figent un
  par un, le total compte jusqu'à sa valeur ; elle couvre l'attente du
  serveur ; chiffres décoratifs seulement ; mouvement réduit → résultat
  immédiat.
- API de pré-remplissage utilisée par la fiche (32), la Table (34) et le
  solo (36) : `openDiceTool({ dice, modifier, label, advantage? })`.
- **Revu le 4 octobre (lot i)** :
  - **Un seul gabarit, toujours le même** : seule la présélection change
    selon le bouton touché ; son nom s'affiche en titre (« Dague — touche »).
    Ouvert depuis le dé, sans bouton : « **Jet libre** ».
  - **Secret** : interrupteur dans l'en-tête de l'outil (il existait dans
    `DiceRollPanel` et manquait à l'esquisse). Un jet secret n'est vu que de
    son auteur et du MJ ; les jets d'un monstre sont secrets par défaut.
  - **DD** (retour de l'auteur, 4 octobre : l'outil en ligne, `DiceRollPanel`,
    l'a déjà et l'esquisse l'avait perdu) : une ligne DD sous la grille —
    ▼ valeur ▲, vide = pas de DD — et, pour le MJ seul, **« DD privé »** :
    le joueur voit « contre DD ? », jamais la valeur. Le « Lancé public » de
    l'outil en ligne devient l'interrupteur Secret.
  - **Verdict, dans la case du résultat** (aucune place en plus) : il ne
    s'affiche que s'il y a quelque chose à battre — une CA (attaque), un DD
    (test, sauvegarde). Réussite en vert, **échec en rouge**, **critique en
    or lumineux**. Animation **tranchée le 4 octobre : B, la case se
    remplit** — la couleur du verdict envahit la case de gauche à droite
    puis se pose en teinte légère derrière le résultat (planche « Décidé ·
    verdict d'un jet ») ; mouvement réduit : la teinte seule. Le même outil
    servant partout, le verdict est le même partout.
  - **Zone de résultat permanente** (4 octobre) : elle est toujours là,
    même avant le premier jet — « — » et **un carré vide par dé** du
    prochain lancer (deux pour un d20 avec avantage), qui se remplissent au
    lancer. Sur téléphone, la feuille des dés monte plus haut pour la
    loger. Sa hauteur ne change jamais.
  - **« Lancer les dégâts » dans la zone de résultat — tranché le 4
    octobre : la bande du bas** (sur quatre propositions, les autres
    retirées de l'esquisse). Une bande fine au pied de la zone, dont la
    place est **toujours réservée** (la hauteur ne bouge jamais) :
    - **invisible** s'il n'y a rien à battre (ni cible, ni DD) ou pas de
      suite ;
    - avant le jet : rien (revu le 4 octobre : la bande n'annonçait la suite
      que pour s'effacer sur un raté — elle n'apparaît plus que sur une
      réussite suivie de dégâts) ;
    - **touché** : toute la bande devient le bouton « Lancer les dégâts » ;
      côté MJ, un monstre qui touche un joueur donne « Valider · dégâts » /
      « Faire échouer » ;
    - **raté** : pas de bande du tout ;
    - **dégâts lancés depuis la bande** : la partie du dessus rejoue le
      scintillement avec les dés de dégâts, **sans remplissage** (un jet de
      dégâts ne réussit ni n'échoue) ; à la place du verdict, l'effet
      (« Worg −3 PV », « Tharnok +7 PV ») ; la bande disparaît.
    Les détails (« contre CA 13 », « JS Force : raté — À terre ») restent
    en lignes sous la zone.
  - **Enchaînement** : « Touché » /
    « Raté » (ou « Résiste » / « Pas résisté ») puis le bouton suivant. Si l'attaque réussit, le bouton « **Lancer les
    dégâts · 1d4 + 2** » apparaît : un toucher lance les bons dés sur la
    même cible et les dégâts s'appliquent seuls.
  - **Critique** : un 20 naturel touche toujours et double les **dés** de
    dégâts, pas le modificateur (1d4+2 → 2d4+2) ; un 1 naturel rate
    toujours. Règle 2024, déjà dans l'outil.
  - **Validation du MJ** : quand un monstre touche un joueur, l'outil du MJ
    s'arrête sur « Valider la touche » / « Faire échouer » avant les dégâts.
  - **Limites relevées, tranchées avec l'auteur, à traiter dans V3.1-21** :
    - **bonus après la touche** : l'outil **lit la fiche du lanceur** et
      propose ce qui est disponible à ce moment (Attaque sournoise si l'arme
      et la situation la permettent et qu'elle n'a pas servi ce tour,
      Châtiment divin s'il reste un emplacement, Inspiration bardique
      reçue…) ; le joueur coche, les dés s'ajoutent avant le lancer ;
    - **réactions** : en 2024, Bouclier est une **réaction prise quand on
      est touché** (+5 CA, y compris contre l'attaque qui la déclenche) —
      elle se joue donc **après** le « Touché », avant les dégâts. Il faut
      une courte fenêtre de réaction côté cible ; si elle fait passer la CA
      au-dessus du jet, la touche devient un raté ;
    - **résistances, immunités, vulnérabilités** de la cible appliquées par
      le moteur, et **JS de concentration** déclenché quand une cible
      concentrée subit des dégâts (DD 10 ou moitié des dégâts, au plus 30) ;
    - **zones** : le lanceur choisit **plusieurs cibles** dans « Cibler » ;
      un jet de sauvegarde par cible, dégâts lancés une fois.

**Critères d'acceptation**
- [x] Jet avec avantage : deux d20 affichés, seul le retenu dans le total et les derniers jets.
- [x] Le client n'envoie jamais un résultat (test de la route).
- [x] Même outil sur téléphone, tablette et ordinateur.
- [x] Titre : le nom du bouton touché, ou « Jet libre » ; Secret dans l'en-tête ; DD sous la grille, « DD privé » pour le MJ (le joueur lit « contre DD ? »).
- [x] Zone de résultat toujours visible, hauteur fixe : « — » et un carré vide par dé du prochain jet avant le lancer.
- [x] Verdict seulement contre une CA ou un DD, en remplissage de la case : vert, rouge, or au 20 naturel ; mouvement réduit : teinte sans mouvement.
- [ ] *(V3.1-106)* Bande « Lancer les dégâts » seulement sur une réussite suivie de dégâts ; le jet de dégâts s'applique à la cible et affiche l'effet à la place du verdict, sans remplissage.
- [ ] *(V3.1-106)* Monstre qui touche un joueur : « Valider · dégâts » / « Faire échouer » côté MJ.
- [x] Bande d'après-jet (décision A du 5 octobre, V3.1-19) : sur un d20 raté de son personnage, Relancer (Inspiration héroïque), Avantage (Chanceux), + d6 (Inspiration bardique reçue) selon ce que la fiche possède ; une fois par jet ; le point est retiré côté serveur et le nouveau jet est lancé par le serveur ; rien sur une réussite.

**Clôture** : serveur (Opus) — noyau `src/core/dice/diceTool.ts` (formule de l'outil, paire d'avantage lue dans la trace, verdict contre un DD, or au 20 naturel ; tests d'abord) ; migration `20261017170000_dice_rolls_roller_visibility.sql` (niveau `roller` de l'ADR 0038 : le jet secret d'un joueur, vu de lui et du MJ) ; `POST …/dice-rolls` étendu (modificateur, avantage, libellé, DD, DD privé jamais écrit), schéma strict qui refuse tout champ de résultat ; jets de fiche secrets pour les joueurs ; `POST …/actions/heroic-reroll` (le serveur retire l'Inspiration héroïque puis relance) ; `checkRolls.integration.test.ts` 14/14. Interface (Sonnet) — `OutilDes.tsx` dans la feuille du bas sous 768 px et un panneau ancré au rail au-delà, scintillement, verdict en remplissage, bande de relance ; les tests de caractéristique, sauvegarde, compétence et l'initiative de la fiche (et du solo) ouvrent l'outil pré-rempli. Corrigé par Opus : le panneau s'ouvrait sur le rail. Vérifié dans le navigateur : Testeuse A à 390 et 820 px (test de Sagesse avec avantage contre DD 30, jet libre secret, relance payée par l'Inspiration donnée par le MJ, puis rendue à 0), MJ à 1280 px (jet libre 1d20+2d6+3 contre DD 10, DD privé sous `/mj`).

*Restes* : la bande « Lancer les dégâts » et « Valider · dégâts » / « Faire échouer » demandent une cible : V3.1-106 (place de la bande réservée). Les attaques, sorts et dégâts de la fiche passent encore par leurs boutons : ils rejoindront l'outil avec le ciblage (106). Chanceux et Inspiration bardique reçue ne sont modélisés par aucune fiche : la bande ne propose que la relance par l'Inspiration héroïque. « DD privé » n'apparaît qu'en mode MJ (`/mj`), comme l'ancien interrupteur. Retirer un seul dé : non voulu (décision de l'auteur, 17 octobre : « Effacer » suffit).

---

### ☑ V3.1-32 — Fiche sur téléphone : jets, infobulles de règles, sac · `L` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — fiche entièrement esquissée ; services fournis par 24.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · fiche sur téléphone, vivante et déroulée partie
par partie », « Décidé · fiche en combat », téléphone du joueur (trois
planches). **Dépend de** : 24, 26, 29.

- Ordre de la sous-planche : en-tête, bouclier CA et jauges PV, niveau,
  épuisement (commande E de 26), constantes, perception passive, dés de vie,
  concentration, états, six caractéristiques, compétences repliables, puis
  la pilule des cinq onglets collée en haut au défilement.
- Boutons de jet : chaque case de caractéristique a deux boutons (haut :
  test, bas : sauvegarde) ; une compétence se touche ; initiative, attaque
  de sort, bonus de touche et dégâts sont des boutons. Tous ouvrent l'outil
  de dés pré-rempli (33) — en attendant 33, ils appellent le chemin actuel.
- Infobulles de règles : tout nom d'arme, sort, objet, aptitude, action,
  état, la concentration et l'épuisement ouvrent leur règle en feuille du
  bas (« Ouvrir dans Règles ») — partir de `useOpenRuleLink`. Même contenu
  en fenêtre sur ordinateur.
- Inventaire : « Équipé » / « Au sac » par objet (`setItemEquipped`, 24) ;
  la charge se recalcule.
- À 0 PV, les jauges cèdent la place aux jets contre la mort (24).

**Critères d'acceptation**
- [x] La fiche de Candide de la sous-planche, reproduite à 390 px.
- [x] Chaque type de nom ouvre la bonne règle, joueur et MJ.
- [x] À 0 PV : jets contre la mort, puis stabilisé ou mort selon 24.

**Clôture** : serveur (Opus) — `rollDeathSaveForCharacter` et `POST /api/entities/[id]/actions/death-save` (d20 du serveur ou vrai dé annoncé, refusé hors de 0 PV, journalisé ; `characterActions.integration.test.ts` 10/10). Interface (Sonnet) — ordre de l'esquisse sous 40rem, caractéristiques en 3 colonnes, pilule collée au défilement, `aria-label` des jets ; `NomDeRegle` (arme, objet, sort, aptitude, épuisement, état s'il a une règle, sort de concentration) : feuille du bas chargée au toucher sous 768 px, fenêtre au-dessus ; `BlocMourant` à 0 PV (`lib/ui/etatMourant.ts`) ; concentration affichée (sans bouton pour la rompre : aucune action serveur). Corrigé par Opus : « Ouvrir dans Règles » mène le joueur à `/joueur/regles/…`, libellé « Épuisement » en capitales. Cliquet du câblage porté à 60 (chargement au toucher, CABLAGE §6). Vérifié dans le navigateur à 390 px en MJ et en Testeuse A : règle de l'épée à deux mains, deux jets de mort (7 : échec, 14 : réussite), soin, PV remis à 12.

---

### ☑ V3.1-31 — Éditeur plein écran en accordéon (téléphone) · `M` · sans modèle IA — **fait le 17 octobre (ADR 0065)**

**Modèle conseillé : Sonnet** — option A tranchée et esquissée.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · téléphone du MJ — plein écran et infobulles ».
**Dépend de** : 29.

Plein écran, barre flottante masquée, « Annuler » / « Enregistrer » en
haut. Tous les blocs dans la page, repliés en une ligne de résumé, un seul
ouvert à la fois ; poignée ⠿ pour réordonner (aussi au clavier) ; « + bloc »
en bas. Le joueur a le même éditeur, limité à ses droits (`canEditEntity`).
Les éditeurs de blocs existants sont réutilisés tels quels à l'intérieur.

**Critères d'acceptation**
- [x] Ouvrir, modifier deux blocs, réordonner, enregistrer : une seule écriture, contrôle de version compris.
- [x] Annuler avec des changements demande confirmation.
- [x] Un joueur ne voit pas les blocs qu'il ne peut pas modifier.

**Clôture** : serveur (Opus) — `public.save_entity_blocks` (migration `20261017150000`, `security invoker`, tout ou rien), `saveEntityBlocks` (droit, appartenance, Zod, une révision), `PATCH /api/entities/[id]/blocks` ; `saveEntityBlocks.integration.test.ts` 5/5. Interface (Sonnet) — `EditeurPleinEcran` (portail dans `<body>`, ajouté par Opus : la couche restait sous la barre flottante), crayon `md:hidden`, Identité puis blocs repliés, un seul ouvert, ⠿ au doigt et aux flèches (`aria-live`), « + bloc », confirmation d'« Annuler » ; logique pure `lib/ui/editeurPlein.ts`. Les éditeurs à sous-écriture reprennent la version renvoyée ; carte et fiche de personnage « se modifient sur la fiche ». Passages MJ teintés en lecture (reporté de V3.1-30). Vérifié dans le navigateur à 390 px : un seul `PATCH …/blocks` par enregistrement, ordre conservé au rechargement, confirmation, menus au-dessus de la couche. Catalogue : planche « 10 · Téléphone » créée (Ecrans dépassait 8 000 px).

---

### ☑ V3.1-30 — Wiki et Règles sur téléphone : ☰ et consultées récemment · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — parcours esquissé ; stockage tranché (ADR 0036 §4).

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : téléphones MJ et joueur, écrans Monde / Wiki / Règles et
leurs feuilles. **Départ** : `BookSkin.tsx`, `TwoPaneReaderLayout.tsx`,
`PlayerRulesSidebar.tsx`. **Dépend de** : 29.

- Toucher Monde / Wiki / Règles ouvre un écran d'accueil : recherche,
  bouton ☰ (sommaire complet, types repliables, PJ déplié par défaut) et
  la liste des fiches consultées récemment.
- Une fiche choisie s'affiche dans la peau actuelle (`BookSkin`), ☰ en
  haut à gauche ; le tiroir commence lui aussi par « Récemment ».
- « Récemment » vit dans le navigateur (identifiants et titres seulement,
  20 au plus, par monde) ; une fiche devenue invisible n'est pas affichée
  (le serveur répond à l'ouverture).
- Côté MJ : « + » nouvelle entité, passages MJ en orange, crayon vers
  l'éditeur (31). Règles : même parcours, la règle en page.

**Critères d'acceptation**
- [x] Le parcours accueil → fiche → retour, pour le MJ et le joueur.
- [x] Le joueur ne reçoit jamais un passage MJ (test serveur existant toujours vert).
- [x] Navigation privée ou stockage bloqué : la liste est vide, rien ne casse.

**Clôture** : `AccueilLecteur` (sous 768 px) sur Monde, Règles (MJ et joueur) et Wiki joueur : recherche locale sur l'arbre déjà chargé, ☰, « Consultées récemment » ; « + » côté Monde MJ. Liste dans le navigateur (`lib/ui/recents.ts`, `useRecents`, 20 par monde et par espace, adresses et titres seulement), enregistrée par les pages de fiche (jamais `/apercu` ni `/partage`). Wiki joueur : `?accueil=1` saute la redirection vers le Livre de sessions (la barre téléphone y pointe ; le rail garde la redirection). Les ☰ de `BookSkin` et `TwoPaneReaderLayout` ouvrent une feuille du bas, celles du MJ commencent par « Récemment » ; le ☰ ne chevauche plus le titre de la fiche MJ. Vérifié dans le navigateur à 390 px (MJ, joueur, stockage bloqué) et à 1 280 px ; `visibilityRls.integration.test.ts` 7/7. Pas de crayon (V3.1-31) ; les passages MJ ne sont pas encore teintés (`--gm` inutilisé par les segments) — à reprendre avec 31.

---

### ☑ V3.1-29 — Coquille téléphone : barre flottante et feuilles du bas (lot c) · `L` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — entrées, gabarits et comportements fixés par les planches.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : « Décidé · téléphone du MJ — écrans » et « — feuilles
ouvertes », mêmes planches côté joueur. **Départ** : `PlayerShell.tsx`,
`AppShell.tsx`, `useMatchMedia.ts`. **Dépend de** : 27 (dalle Outils).

- Sous 768 px : barre du bas flottante à six entrées, dé encoché au centre.
  MJ : Monde, Règles, Fiches | Table, Chat, Outils. Joueur : Perso.,
  Édition, Notes | Wiki, Règles, Chat. Toucher de nouveau une entrée active
  ramène à son écran d'accueil.
- Un composant « feuille du bas » unique (poignée, glisser pour fermer,
  piège du focus, Échap) : tout ce qui s'ouvre vient du bas.
- **Fiches** (MJ) : une fiche à la fois, pastille « N fiches » qui ouvre la
  pile en feuille, même adresse `?avec=`.
- **Outils** (MJ) : grille par moment (séance, préparation, campagne),
  radio comprise ; le chat n'y est plus.
- Écrans Table, Wiki, Règles, Édition, dés : des emplacements, remplis par
  30, 31, 33 et 34.

**Tranché le 17 octobre** (reporté de V3.1-28) : sous 640 px de fiche, les compétences deviennent une ligne repliable « Compétences » **fermée par défaut**, entre les caractéristiques et les onglets, comme l'esquisse « Fiche PJ — téléphone » (résumé fermé : « N maîtrisées · meilleure compétence +X ▾ », ouvert : « replier ▴ », la liste puis la légende ● expertise · ◐ maîtrise). Le sélecteur « Points de vie : valeur fixe / jetés » passe **dans ce bloc replié**, sous la liste (choix de l'auteur) ; au-delà de 640 px, rien ne change.

**Critères d'acceptation**
- [x] Les deux barres conformes aux planches à 390 px ; aucune page à défilement horizontal.
- [x] Feuille du bas : clavier, lecteur d'écran, glisser pour fermer.
- [x] Au-dessus de 768 px, rien ne change.
- [x] Planche « Tiroir » remplacée par « Feuille du bas » ; planche « Barre flottante » créée.

**Clôture** : `FeuilleDuBas` (`components/shared/`, portail, piège du focus, Échap, glisser ; seuil dans `lib/ui/feuilleDuBas.ts`) ; `BarreFlottante` commune, `BarreTelephoneMj` montée une fois dans `AppShell` (classement des pages : `lib/ui/barreMj.ts`) ; barre joueur dans `PlayerShell` (monde sans MJ : « Solo » remplace « Chat »). Fiches : pile lue dans l'état des fenêtres, même `?avec=`. Outils : grille par moment, radio en tête ; un outil s'ouvre en page (pas dans la feuille : `MjToolWindowContent` demanderait un chargement de plus). Table : feuille « bientôt » (V3.1-34). Le ☰ de Monde et Règles ouvre une feuille ; celui du MJ disparaît. Le dé flottant se retire là où une barre ou une dalle le remplace (`enregistrerDalle(portee)`). Fiche étroite : compétences repliables fermées par défaut, sélecteur de PV dedans (`lib/ui/resumeCompetences.ts`). Vérifié dans le navigateur à 390 px (MJ et joueur) et à 1 280 px (rien ne change). Reste au ticket 30 : le ☰ de la fiche qui chevauche son titre, le tiroir de `BookSkin`.

---

### ☑ V3.1-27 — Rail repliable et dalle Outils (lots a, b) · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — mesures et comportements donnés par V3.1-19.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** : MJ et joueur, ordinateur et tablette. **Départ** :
`Sidebar.tsx`, `MjSidebar.tsx`, `PlayerShell.tsx`, `RadioWidget.tsx`,
`ChromePill.tsx`, `DiceRollPanel.tsx`.

- Rail flottant, coins arrondis : 204 px déployé ↔ 64 px replié
  (`width 380ms cubic-bezier(.4,0,.2,1)`), libellés qui s'effacent ;
  poignée en onglet 16 × 44 px sur le bord droit ; replié, l'arborescence
  s'ouvre en menu flottant au survol et au clavier. Listes :
  `overflow-y: auto` et `overflow-x: hidden`. État replié mémorisé dans le
  navigateur (`localStorage` protégé).
- Dalle « Outils » en bas du rail : le dé s'y encoche (48 px, anneau de 6 px
  couleur du panneau) et ouvre le panneau de dés existant ; la radio y
  passe, visible rail replié, point vert en lecture / rouge à l'arrêt.
  L'horloge n'est pas reprise.
- Au-dessous de 768 px, le rail n'existe pas (le téléphone est 29).

**Critères d'acceptation**
- [x] Déplier / replier à la souris et au clavier ; état gardé au rechargement.
- [x] Radio et dé utilisables rail replié.
- [x] Planches « Pastille chrome », « Bouton de dés », « Rail du joueur » mises à jour ; planche « Rail repliable » créée.

**Clôture** : `components/shell/Rail.tsx` (rail, lignes, menu flottant en portail, dalle Outils) sert les quatre rails (Monde, Règles, MJ, joueur) ; un seul arbre DOM par barre, sous 768 px tiroir et barre du bas inchangés. État replié dans `localStorage` (`creadonjon:rail:replie`, `lib/ui/rail.ts`) lu par `useSyncExternalStore` : changer de section ne rejoue pas l'animation. Le dé de la dalle ouvre le volet existant (`ouvrirVolet`) ; le bouton flottant ne se cache que tant qu'une dalle est montée (une page sans rail garde son dé). Radio du rail : point vert en lecture, rouge à l'arrêt ; `ChromePill` retirée en vue ordinateur, horloge non reprise. Vérifié dans le navigateur (MJ Monde/MJ/Règles, joueur, 390 px). Écarts : les menus repliés lisent l'arbre du chargement de la page (un duplicata n'y paraît qu'à la navigation suivante) ; Règles repliées : une ligne pointillée regroupe « Ajouter une règle » et les bacs à sable.

---

### ☑ V3.1-28 — Tablette : la fiche s'adapte à sa fenêtre (lot f) · `S` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — règle simple, planche à trois largeurs.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · fiche sur tablette : elle suit la largeur de sa
fenêtre (piste B) » (zone « Fiche de personnage » ; la fiche y prend, sous
~640 px, la disposition du téléphone). **Dépend de** : 26.

La fiche lit la largeur de **sa** fenêtre (requête de conteneur CSS, pas
la largeur de l'écran) : sous ~640 px, les six caractéristiques passent en
ligne au-dessus des onglets.

**Critères d'acceptation**
- [x] La même fiche à 960, 680 et 540 px de fenêtre, conforme à la planche.
- [x] Aucune lecture de `window.innerWidth` pour cette règle.

**Clôture** : `@container` sur la fiche entière (`PlayableCharacterSheet.tsx`), variantes `@min-[40rem]:` à la place de `md:` (y compris le filet de l'en-tête). Vérifié dans le navigateur à 960, 680 (colonne de gauche) et 540 px (six tuiles en ligne, aucun défilement horizontal). Fait par Opus, sans délégation : quatre classes.

---

### ☑ V3.1-26 — Fiche d'ordinateur à jauges et commande E · `M` · sans modèle IA — **fait le 17 octobre**

**Modèle conseillé : Sonnet** — interface esquissée, services existants.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planches** (zone « Fiche de personnage ») : « Décidé · fiche sur
ordinateur, vivante et déroulée partie par partie », « Décidé · jauge à
commandes (option E) ». **Départ** :
`CharacterSheetHeader.tsx`, `JaugeCirculaire` (`FicheJouableEnTete.tsx`).
**Dépend de** : 25.

- Bouclier de CA ; jauges circulaires PV (temporaires d'abord), niveau / XP,
  épuisement (0 à 6), chacune avec la commande E : ▲, champ d'écart, ▼ —
  champ vide = ±1, champ rempli = ce nombre puis le champ se vide.
- Bornes : PV et épuisement plafonnés ; XP sans plafond.
- Constantes en badges (initiative, vitesse, maîtrise) ; Inspiration au
  gabarit exact d'un badge (72 × 56 px), même taille de chiffre, ▲▼ intégrés.
- Les onglets de la fiche en pilule (25).
- Les commandes appellent les services existants (`changeHp`, `changeXp`,
  `changeExhaustion`, `changeInspiration`) ; aucune valeur posée par le client.

**Critères d'acceptation**
- [x] Les quatre jauges et l'inspiration conformes à la planche, aux quatre modes.
- [x] Commande E : ±1 champ vide, ±N champ rempli, champ vidé après usage.
- [x] Un composant `CommandeE` réutilisable (il resservira en 32 et 34), avec sa planche au catalogue.
- [x] Jamais de valeur provisoire fausse (CA 11, PV 0/0) ni de clé technique d'objet pendant le chargement de la fiche ; vitesses au format français, arrondies au mètre (« 9 m ») (vu par la vérification du 11 octobre). Le 13 octobre, la même CA provisoire provoque une erreur d'hydratation de React : le serveur rend 11, le navigateur 16 quand les règles sont déjà en cache.

**Clôture** : `CommandeE` (`components/shared/CommandeE.tsx`, écart seul, règles dans `lib/ui/commandeE.ts`, testées) porte PV, niveau/XP et épuisement ; bouclier de CA, badges, Inspiration 72 × 56 ; squelette sans chiffre tant que les règles et l'état de jeu ne sont pas arrivés (`useResolvedRuleset` part toujours de vide : plus d'erreur d'hydratation) ; vitesse au mètre. Vérifié dans le navigateur (Banc d'essai, chargement froid et chaud, écart 2 puis ±1). Planche « Jauge à commandes » dans `Fiche.dc.html`.

---

### ☑ V3.1-25 — La pilule glissante remplace `BinderTabs` · `S` · sans modèle IA — **fait le 17 octobre (ADR 0034)**

**Modèle conseillé : Sonnet** — composant décidé (ADR 0034), usages listés.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; mettre à jour la planche du catalogue d'après le code livré ; recenser les usages à remplacer avant de coder, puis vérifier qu'il n'en reste aucun ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Planche** : « Décidé · accueil : tableau de bord, onglets en pilule
glissante ». **Départ** : `components/shared/BinderTabs.tsx`.

Un composant d'onglets unique : fond qui glisse sous l'onglet actif (260 ms,
sauté sous mouvement réduit), clavier (flèches, Début, Fin), rôles ARIA
`tablist` / `tab` / `tabpanel`. Il remplace `BinderTabs` partout : fiche
jouable, fiche solo, colonne Monde et coquille du solo, aperçu du créateur.
Sur téléphone, la pilule défile horizontalement si elle déborde.

**Critères d'acceptation**
- [x] Plus aucun import de `BinderTabs` ; le fichier est supprimé.
- [x] Clavier et lecteur d'écran : un test de composant.
- [x] Charte §3 et planche 3 du catalogue mises à jour.

**Réalisé** (délégué à `dev-sonnet`, planche à `aide-haiku`, relu par Opus)
- `components/shared/Tabs.tsx` : pilule glissante, fond positionné d'après l'onglet actif mesuré (suit le défilement sur téléphone), 260 ms, sauté sous mouvement réduit ; `TabPanel` (`role="tabpanel"`, relié par `idPrefix`). Clavier sorti en fonction pure (`lib/ui/tabsKeyboard.ts`).
- Les 7 usages convertis ; `BinderTabs.tsx` supprimé. Charte §3 et §9, planche `Navigation.dc.html`.
- Tests : `lib/ui/tabsKeyboard.test.ts`, `lib/ui/tabs.test.ts` (balisage ARIA rendu côté serveur, sans dépendance ajoutée).
- Vérifié dans le navigateur (Banc d'essai, Testeur MJ) : fiche de personnage sur ordinateur et téléphone — flèche et Fin changent l'onglet, le focus suit, un seul onglet tabulable, le fond reste aligné, la pilule défile sur téléphone.

*À voir à l'œil* : accueil (onglets d'un monde ouvert), solo, aperçu du créateur.


---

### ☑ V3.1-111 — Sauvegardes : la demande et la réponse (données, serveur) · `M` · sans modèle IA — **fait le 17 octobre (ADR 0044)**

**Modèle conseillé : Opus** — table nouvelle, RLS. **ADR 0044.**
**Dépend de** : 105, 110.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : table `save_requests` (champs de l'ADR), RLS (lecture :
  auteur, cible, MJ ; réponse par `app.answer_save_request`) ;
  `docs/SCHEMA.md`.
- `resolveTargetedRoll` (105) : un effet à sauvegarde vérifie la cible
  (`isValidTarget`), puis crée la demande au lieu d'appliquer ; la réponse
  (lancer côté serveur, vrai dé avec « modificateur inclus », ou saisie du
  MJ) est traitée **au nom de celui qui répond** : verdict, puis dégâts ou
  état appliqués, journal, et le résultat revient au jet de l'auteur.

**Critères d'acceptation**
- [x] Une sauvegarde imposée à un PJ n'est lisible que de l'auteur, du
  joueur de la cible et du MJ (test RLS).
- [x] Réponse → verdict → effet appliqué, journalisé (test de service).

**Réalisé** (détail dans l'ADR 0044, « Réalisation de la demande et de la réponse »)
- Migration `20261017120000_save_requests.sql` (appliquée le 17 octobre, après correction : `natural` est un mot réservé, la colonne s'appelle `natural_roll`) : table, RLS, `answer_save_request`, `set_own_participant_vitals`.
- Noyau : `zSaveRequestEffect`, `saveTotal`, `effectsForSaveOutcome` (`src/core/rules/saveRequest.ts`), tests d'abord.
- « Cibler » avec un sort à sauvegarde : `isValidTarget` avant de lancer (aucun emplacement dépensé sur un refus), puis la demande. Réponse `answerSaveRequest` au nom du répondant ; routes `GET …/save-requests` et `POST …/save-requests/[requestId]/answer`.
- Tests d'intégration : 14/14 (`saveRequests.integration.test.ts`, `targetedRoll.integration.test.ts`) — RLS avec deux comptes joueurs, réponse → verdict → effet → journal, annulation par le MJ.

*Écart* : `set_own_participant_vitals`, écriture étroite du joueur sur la ligne de combat de son PJ (ADR 0040 l'avait fermée).
*Restes* : les écrans (bandeau de la cible, pastille du dé) et la publication temps réel de `save_requests` ; la création par un joueur (V3.1-104).


---

### ☑ V3.1-110 — Sauvegardes : la restriction de cible (noyau) · `S` · sans modèle IA — **fait le 17 octobre (ADR 0044)**

**Modèle conseillé : Sonnet** — noyau pur, tests d'abord. **ADR 0044.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `zEffectData` gagne `target?: { creature_types?, exclude_creature_types?,
  immune_conditions_block? }` (Zod) ; `isValidTarget(effect, target)` dans
  `src/core/rules/` lit le type de créature (bloc de stats, espèce) et les
  immunités d'état.
- L'import SRD pose la restriction sur les sorts concernés (Charme-personne :
  humanoïde, etc.) — liste à relever dans le SRD, le contenu reste l'import.

**Critères d'acceptation**
- [x] Charme-personne sur un mort-vivant : refusé (test) ; sur un humanoïde :
  accepté ; un immunisé à Charmé : refusé.

**Réalisé** (par Opus : noyau du moteur et contexte déjà chargé, skill `deleguer` §1)
- `zEffectData.target` ; `isValidTarget`, `creatureTypeOf` (`src/core/rules/targetRestriction.ts`), tests d'abord.
- `data/srd/spell-targets.json` par édition (15 sorts en 2014, 7 en 2024, relevés dans le texte du SRD), testé (`srdSpellTargetsData.test.ts`) ; `mergeSpellTargets` dans l'import, qui crée le bloc `effects` s'il manque. SRD réimporté le 17 octobre, scripts d'après import rejoués.
- Fiche d'un sort : la restriction s'affiche sous l'effet.

*Écart* : `immune_conditions_block` est une liste d'états, pas un booléen (ADR 0044, « Réalisation »).
*Restes* : Amitié avec les animaux (Intelligence 4 ou plus) n'est pas modélisée ; Domination de bête est laissée sans restriction, son texte SRD dit « créature ».


---

### ☑ V3.1-105 — Cibler : le cœur commun de résolution · `L` · sans modèle IA — **fait le 17 octobre (ADR 0042)**

**Modèle conseillé : Opus** — extraction du tour solo, moteur. **ADR 0042.**
**Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- `src/server/services/targetedRoll.ts` : `resolveTargetedRoll` (entrée
  Zod de l'ADR) — lit la cible dans le combat `running`, lance (serveur),
  résout (`resolveAttackRoll`, `resolveDamageRoll`, sauvegarde contre DD
  pour un sort à jet du MJ, `eventsForAttack`, déclencheurs), calcule
  (`applyEffects`) et écrit ; touche → demande de dégâts chaînée (dés
  doublés au critique) ; PJ à 0 PV → jets contre la mort (ADR 0036 §8) ;
  créature à 0 PV → hors de l'initiative ; journal ; « Annuler » = écriture
  inverse journalisée.
- `applyResolvedTurn` (solo) délègue sa partie « appliquer » à ce service ;
  les tests du solo restent verts **sans modification**.
- Autorisation : MJ → tout participant ; joueur → son PJ comme acteur, et
  écriture refusée sur une cible qu'il ne contrôle pas (verdict seulement)
  tant que V3.1-104 n'est pas fait.

**Critères d'acceptation**
- [x] Touche, dégâts, états, soins résolus par le moteur et appliqués,
  journalisés (tests de service).
- [x] Les tests du solo passent tels quels.
- [x] « Annuler » rend l'état d'avant par une écriture inverse.

**Réalisé** (détail dans l'ADR 0042, « Réalisation »)
- Noyau, tests d'abord : `src/core/rules/targeting.ts` (`attackVerdict` 2024, `damageAfterSave`, `monsterSaveBonus`, `isOutOfFight`, `advanceTurnSkipping`/`retreatTurnSkipping`) ; `eventsForDamage` ; un critique sur un PJ à 0 PV coûte deux échecs (`turn.ts`).
- `src/server/services/targetedRoll.ts` : `applyResolvedEffects` (extrait du solo, qui l'appelle) et `resolveTargetedRoll` (attaque, dégâts, sort à attaque, sort à sauvegarde, soin ; acteur personnage ou monstre). Route `POST …/combats/[combatId]/targeted-roll` (MJ).
- `patchCombatParticipant` porte et annule les jets contre la mort ; le passage de tour saute une créature à 0 PV ; `castSpell` peut dépenser l'emplacement sans lancer de dégâts.
- Tests : `targetedRoll.integration.test.ts` 9/9 (dont un tour solo de bout en bout), `targetedRoll.noAi.test.ts` ; tests du solo inchangés et verts (`turnIntent.noAi`, `turnIntent.pendingRequest`, `characterActions`, `ownInitiative`).

*Écart* : un joueur n'a pas encore le « verdict seulement » prévu — il ne lit plus la CA adverse (ADR 0040) ; il viendra avec V3.1-104.
*Restes* : « Cibler » dans l'outil de dés (écran) ; jets secrets d'une fiche (ADR 0038) ; données de sauvegarde et de soins des sorts SRD (rares).


---

### ☑ V3.1-103 — Initiative : les jets d'initiative des joueurs · `M` · sans modèle IA — **fait le 17 octobre (ADR 0040)**

**Modèle conseillé : Opus** — changement de schéma. **ADR 0040.**
**Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : `combats.status` accepte `rolling` (« jets d'initiative »)
  entre `draft` et `running` ; `docs/SCHEMA.md`.
- Fonction `app.set_own_initiative(p_participant uuid, p_value int)` : seul
  le joueur dont le PJ (`campaign_characters.user_id`) est ce participant,
  seulement en `rolling`, valeur −10 à 40.
- Route `POST …/combats/[combatId]/my-initiative` (Zod) : `{ mode: "roll" }`
  (le serveur tire le d20 et ajoute l'initiative de la fiche, règle 8) ou
  `{ mode: "die", natural: 1..20, modifierIncluded: boolean }`.
- Le MJ : « Demander les jets » (draft → rolling), saisir à la place d'un
  joueur, « Commencer » (rolling → running), « Terminer » (confirmé).
- Chaque étape écrit un `session_events` de genre `combat`.

**Critères d'acceptation**
- [x] Un joueur ne peut écrire que l'initiative de son PJ, et seulement en
  `rolling` (test).
- [x] Invitation, jet, saisie du MJ, fin : journalisés.

**Réalisé**
- Migration `20261017090000_combat_rolling_own_initiative.sql` (appliquée le 17 octobre) : statut `rolling`, `public.set_own_initiative` (renvoie avant/après, `null` si refus).
- Noyau : `ownInitiativeFromDie`, `isOwnInitiativeInRange` (`src/core/rules/combat.ts`), tests d'abord ; schéma Zod `myInitiativeSchema` testé.
- Service `setMyInitiative` (`src/server/services/ownInitiative.ts`) : « lancer » par `rollInitiativeCheck` (jet enregistré et attribué, V3.1-89), « vrai dé » plus la Dextérité de la fiche ; journal au nom de la joueuse (`actor: player`), annulable. Route `POST …/combats/[combatId]/my-initiative`.
- Écran du MJ : statut « Jets d'initiative », « Demander les jets », « ▶ Commencer », « ■ Stop » confirmé ; planche `OutilsMJ.dc.html` complétée.
- Tests d'intégration : 3/3 (`ownInitiative.integration.test.ts`).

*Restes* : l'écran des joueuses qui appelle la route vient avec V3.1-38.


---

### ☑ V3.1-102 — Initiative : la vue filtrée des joueurs · `M` · sans modèle IA — **fait le 17 octobre (ADR 0040)**

**Modèle conseillé : Opus.** **ADR 0040.** **Dépend de** : 101.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Fonction `app.combat_player_view(p_combat uuid)` (`security definer`,
  `row_security = off`), vérifie que l'appelant est membre de la campagne ;
  renvoie par participant : `id`, `label`, `initiative`, ordre, `is_current`,
  `side`, états ; allié (PJ ou `is_ally`) : PV courants, max, temporaires ;
  adversaire : `wound` parmi `unhurt` (≥ max), `hurt` (> ½), `bloodied`
  (> 0), `down` (0). Jamais `ac`, `rule_key`, ni le nom d'entité d'un
  adversaire. Plus la ligne `combats` (statut, round, tour).
- Service `getPlayerCombatView`, route `GET
  /api/campaigns/[campaignId]/combats/active/player` (Zod).
- Le MJ touche `combats.updated_at` à chaque changement de participant
  (signal temps réel des joueurs).

**Critères d'acceptation**
- [x] La vue ne contient ni PV, ni CA, ni nom d'origine d'un adversaire (test).
- [x] Un non-membre reçoit un refus.

**Réalisé**
- Migration `20261016120000_combat_player_view.sql` (appliquée le 16 octobre) : `public.combat_player_view` (refus `42501` pour un non-membre) et trois déclencheurs par instruction qui touchent `combats.updated_at`.
- Noyau : `orderPlayerCombatView` (`src/core/rules/combatPlayerView.ts`), tests d'abord — même tri que l'écran du MJ, d'où `display_order` plutôt qu'un rang calculé en SQL.
- Service `getPlayerCombatView` (`src/server/services/playerCombatView.ts`), route `GET /api/campaigns/[campaignId]/combats/active/player`.
- Tests d'intégration : 4/4 (`playerCombatView.integration.test.ts`) — ni PV, ni CA, ni bestiaire, ni fiche d'origine d'un adversaire ; même tour que le MJ ; refus d'un non-membre ; signal du combat.

*Restes* : l'écran des joueuses (V3.1-38) lira cette route et ajoutera `combats` à la publication temps réel.


---

### ☑ V3.1-100 — Rejoindre sans choisir de PJ ; le lien qui vise un PJ précis · `M` · sans modèle IA — **fait le 16 octobre (ADR 0049)**

**Modèle conseillé : Opus** — parcours d'adhésion, une colonne nouvelle,
une réservation à faire respecter côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : reporter les libellés dans `messages/fr.json` et `messages/en.json` ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Décision de l'auteur (9 octobre)**
- **Rejoindre une table ne demande plus de choisir un PJ.** L'écran
  Rejoindre (V3.1-86) garde rôle, nom et mot de passe ; la joueuse arrive
  ensuite sur le **carrousel** (V3.1-82), ouvert sur « Nouveau personnage ».
  Plus de blocage « Aucun personnage disponible » (V3.1-14).
- **Un lien peut viser un PJ précis** (« ce lien est pour Naivara ») : la
  joueuse qui l'ouvre voit un carrousel réduit à **ce PJ et « Nouveau
  personnage »** (au cas où), **ouvert sur le PJ**.

**Constat (lu le 9 octobre)** : `campaign_invites` n'a pas de colonne de
personnage ; `accountProvisioning.ts` refuse un rôle joueur sans
`entityId` (`missing_entity`) et réclame le PJ au moment de rejoindre.

**À concevoir, ADR à l'appui**
- `campaign_invites.entity_id uuid null` (lien nominatif) ; la génération
  d'un lien joueur dans Gestion de campagne gagne « pour : [PJ ▾]
  (facultatif) » (avec V3.1-54).
- Adhésion sans réclamation : `accountProvisioning` accepte un joueur sans
  `entityId` ; la réclamation se fait ensuite par le carrousel.
- **Réservation** : tant que le lien nominatif est actif et non utilisé, son
  PJ n'apparaît pas dans le carrousel des autres joueuses ; la joueuse
  arrivée par ce lien peut le réclamer même s'il n'est pas « ouvert ». La
  règle est vérifiée par le serveur à la réclamation, pas seulement à
  l'affichage.
- Le serveur dit au carrousel quoi montrer et sur quelle carte s'ouvrir
  (V3.1-82).

**Critères d'acceptation**
- [x] Une joueuse rejoint par un lien ouvert sans aucun PJ disponible, puis
  crée le sien depuis le carrousel.
- [x] Par un lien nominatif : carrousel réduit au PJ visé et à « Nouveau
  personnage », ouvert sur le PJ ; une autre joueuse ne voit pas ce PJ.
- [x] Réclamer le PJ réservé avec un autre compte est refusé par le serveur
  (test).

**Réalisé**
- Migration `20261016090000_nominative_player_invites.sql` (appliquée le 16 octobre) : `campaign_invites.entity_id`, `public.list_claimable_characters`, `public.claim_campaign_character`, `resolve_campaign_invite` renvoie `entity_id`, liste anonyme des PJ par jeton supprimée.
- Rejoindre ne choisit plus de PJ ; une joueuse sans PJ arrive sur `/joueur`. Un lien nominatif sert une fois (`claimed_by_user_id`) ; déjà utilisé par un autre, la page le dit avant le formulaire.
- Noyau : `claimableView` (`src/core/campaigns/claimable.ts`), tests d'abord. L'écran de choix reçoit `characters` et `startOn` du serveur ; le carrousel (V3.1-82) les lira.
- « Nouveau PJ » d'une joueuse : la fiche est réclamée avant l'écriture de ses blocs (`createCharacterFromWizard`, `claimInCampaignId`).
- Gestion de campagne : « pour : [PJ] » à la génération d'un lien joueur.
- Tests d'intégration : 11/11 (`campaignInvites.integration.test.ts`).

*Faille relevée en route, fermée* : `campaign_characters_write` laissait tout compte connecté s'attribuer une fiche, donc en devenir éditeur. Écriture directe réservée au MJ ; inscrite au registre de `SECURITE.md`.


---

### ☑ V3.1-89 — Statistiques : attribuer chaque jet (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0064)**

**Modèle conseillé : Opus** — changement de schéma, quatre chemins
d'écriture, RLS d'une table temps réel.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Le problème** : `dice_rolls` ne dit pas **qui** a lancé (seulement
`rolled_by` : player, gm, ai, system) ni **pour quel personnage** ; `who`
est un nom affiché, instable (renommage, homonymes). Et avec avantage ou
désavantage, la trace porte les deux d20 sans dire lequel est gardé.

**Proposé (à trancher, ADR à l'appui)**
- **Qui a lancé** : `dice_rolls.rolled_by_user_id`, **déjà décidé par
  l'ADR 0038** (salon et jets secrets, V3.1-22) et posé par le serveur.
  Ne pas créer de seconde colonne : si V3.1-22 n'est pas encore fait, ce
  ticket ajoute cette colonne-là, sous ce nom, et V3.1-22 la réutilise.
- Migration nouvelle : `dice_rolls.entity_id uuid null references
  entities(id) on delete set null` ; index `(campaign_id, entity_id,
  created_at desc)`. Rempli par les quatre chemins d'écriture : l'entité du
  jet quand il y en a une — jet libre : l'entité réclamée par l'appelant
  dans la campagne, sinon null.
- `detail.naturalD20` (entier 1 à 20, ou absent sans d20) : **le d20
  gardé**, écrit au moment du jet par le serveur (règle 8). `detail.kind` :
  `attack`, `damage`, `check`, `save`, `spell`, `heal`, `free` — pour
  regrouper « l'action la plus utilisée » sans analyser du texte.
- **Jets anciens** (sans ces champs) : `entity_id` reste null ; on ne
  devine pas par le nom (homonymes). Ils sont **exclus** des statistiques
  personnelles (**confirmé par l'auteur le 9 octobre** : pas de rattrapage),
  et le volet le dit (« Statistiques depuis le … », date de la migration).
- **Les jets secrets ne comptent jamais** (décision de l'auteur, 9
  octobre) : `listRollsForStats` ne lit que les jets `visibility_level =
  'public'` — ni les jets cachés du MJ (`gm`), ni les jets secrets d'un
  joueur (`roller`, ADR 0038), **pas même pour leur auteur**. Même règle pour
  la moyenne de la table.
- RLS : inchangée en lecture. Les nouvelles colonnes ne s'écrivent que côté
  serveur.
- **Monnaie** : vérifier que les mouvements de monnaie (services de jeu,
  V3.1-24) créent encore une révision du bloc `inventory` ; si la monnaie a
  migré vers `entity_runtime_state`, `campaignEconomy.ts` ne la voit plus et
  il faut une autre source (journal de mouvements ou `session_events`).
  Trancher, et documenter dans l'ADR.
- **Les titres sont des données** (le superadmin les change, V3.1-92) :
  proposé, une table `player_title_tiers` (`family` parmi `luck`, `bad_luck`,
  `purse`, `favorite_action` ; `position` ; `range_from numeric`,
  `range_to numeric null` (null = sans borne) pour les trois premières ;
  `action_kind` pour la quatrième ; `name` ; `template` (petit texte à
  variables) ; `icon_key` parmi douze icônes **du code** ; `color_token`
  parmi `success`, `danger`, `accent`, `link_entity`, `link_rule`),
  globale à la plateforme. RLS : lecture pour tout compte connecté,
  écriture superadmin. Valeurs par défaut insérées par la migration
  **comme réglages**, pas comme contenu de règles. Zod valide `icon_key`,
  `color_token` et les variables du `template`.
- Contrat pour V3.1-90/91 : `listRollsForStats(campaignId, entityId,
  sinceSessionId?)` renvoie `{ naturalD20, kind, what, result, sessionId,
  createdAt }[]` (repo) ; `getPlayerEconomy(entityId, sinceSessionId?)`.

**Critères d'acceptation**
- [x] ADR ; migration ; `docs/SCHEMA.md` ; types régénérés.
- [x] Les quatre chemins écrivent `rolled_by_user_id`, `entity_id`,
  `naturalD20`, `kind` (tests d'intégration).
- [x] Avantage : `naturalD20` = le plus haut des deux ; désavantage : le
  plus bas (test).
- [x] Aucun jet `gm` ni `roller` n'apparaît dans `listRollsForStats`, même
  lu par son auteur (test).

**Réalisé**
- Migration `20261014090000_dice_rolls_attribution.sql` (appliquée le 14 octobre) : `rolled_by_user_id` (posé par la base, `default auth.uid()`) et `entity_id` ; index `(campaign_id, entity_id, created_at desc)` ; `dice_rolls_insert` refuse un autre compte et un personnage que l'auteur ne peut pas modifier ; table `player_title_tiers` et ses quatorze paliers.
- Noyau : `naturalD20FromTrace` et `DICE_ROLL_KINDS` (`src/core/dice/rollAttribution.ts`), `zPlayerTitleTier` et `DEFAULT_TITLE_TIERS` (`src/core/stats/titleTiers.ts`), tests d'abord.
- `DiceRollAttribution` obligatoire dans `insertDiceRoll` : les quatre chemins la fournissent. Contrat pour 90 et 91 : `listRollsForStats` (jets publics seulement) et `listPlayerRolls`, `getPlayerEconomy` (`src/server/services/playerStats.ts`).
- Monnaie : toujours dans le bloc `inventory`, donc dans ses révisions ; `campaignEconomy` reste la source.
- Tests d'intégration : 30/30 sur les trois fichiers des jets.

*Faille relevée en route, fermée* : l'usurpation du compte ou du personnage d'un jet. *Reste ouvert, antérieur* : un membre peut insérer lui-même un jet public au résultat inventé ; il ne fausse que ses propres statistiques. Les deux sont inscrits au registre de `SECURITE.md`.


---

### ☑ V3.1-96 — Chronologie : portée, événements directs, naissances et morts (données, ADR) · `M` · sans modèle IA — **fait le 14 octobre (ADR 0048)**

**Modèle conseillé : Opus** — forme d'une donnée de bloc, une fiche
système, une agrégation filtrée côté serveur.

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Départ** : `src/core/schemas/blocks/timeline.ts`,
`src/server/services/timeline.ts` (`getWorldTimeline`), la route
`timeline-promote`. **Dépend de** : V3.1-74 (dates de naissance et de mort).

**À trancher, ADR à l'appui** (les trois points de la décision du 9 octobre)
1. **La portée** d'une entrée de chronologie : champ `scope` parmi `major`
   (Monde), `notable` (Région), `detail` (Détail), **optionnel** — absent =
   défaut selon le genre : guerre, catastrophe, fondation → `major` ;
   bataille, découverte, serment, trahison → `notable` ; naissance, mort,
   rencontre → `detail`. Naissances et morts des fiches personnage →
   `detail`. Nouvelle version du schéma de bloc (`__v`), migration des
   données lue par le schéma, pas de réécriture en base.
2. **Où vit un événement ajouté directement** dans la frise générale.
   Proposé : le bloc Chronologie d'une **fiche système « Chronologie du
   monde »**, une par monde, hors des listes du wiki (comme le Livre de
   sessions), plutôt qu'une table nouvelle. À confirmer ou remplacer.
3. **L'agrégation** : `getWorldTimeline` lit aussi les naissances et morts
   des blocs personnage (V3.1-74), **en une requête groupée** (pas de N+1),
   et filtre chaque date par sa visibilité **côté serveur** (règle 5) : une
   date MJ ou privée n'est jamais envoyée à une joueuse.
- Chaque entrée renvoyée dit d'où elle vient (`source` : fiche et bloc, ou
  frise générale, ou naissance / mort d'un personnage) pour « Depuis la
  fiche de… ». Les séances n'y entrent pas.
- Une action serveur pour **changer la portée** d'une entrée (MJ) et pour
  **ajouter un événement** dans la frise générale ou dans une fiche ; Zod.

**Critères d'acceptation**
- [x] ADR ; schéma de bloc versionné ; `docs/SCHEMA.md` à jour si une table
  ou une fiche système naît.
- [x] Une joueuse ne reçoit aucune date qu'elle ne peut pas voir (test).
- [x] Une seule requête pour les naissances et morts d'un monde (test).

**Note de clôture (14 octobre, Opus).** Détail dans l'[ADR 0048](../adr/0048-les-donnees-de-la-chronologie.md), section « Réalisé ».

*Fait* :
- portée (`resolveScope`) et entrées de naissance et de mort (10 tests du noyau) ;
- fiche système `world_timeline` (migration `20261013160000`, appliquée par l'auteur le 14 octobre) ;
- `getWorldTimeline` en une requête, filtrée bloc puis entrée (3 tests) ;
- deux actions serveur Zod : ajouter un événement, changer une portée ;
- `WIKI_HIDDEN_KINDS` pour les fiches système.

*Faille relevée en route, fermée* : un joueur pouvait créer la fiche système avant le MJ. Inscrite au registre de `SECURITE.md`. Le test d'intégration échouait avant la migration et passe après (3/3).

*Restes* : l'écran de la frise (portées, filtres, ajout d'un événement) vient avec V3.1-97 et 98, qui lisent `scope` et `source`.

### V3.1-146 — Musique : la position et la durée de la piste YouTube (26 octobre)

Codé par `dev-sonnet`, relu par Opus.
- Le lecteur partagé relève la position de la voix YouTube une fois par seconde, **seulement en lecture** : arrêt en pause, à la fin, au changement de piste et au démontage (`actionReleve`, testée).
- Un contexte à part, `MusicProgressContext`, publie la position : la radio et le bouton public ne se redessinent pas chaque seconde.
- Les durées connues restent en mémoire : aucun champ au schéma `music`, aucune requête.
- La platine montre la barre et « 0:30 / 1:18 », relatifs aux bornes.
- La liste montre la durée une fois connue, masquée au téléphone.
- Spotify, SoundCloud et la page de lecture ne changent pas.

*Reste* : la durée se perd au rechargement de la page (choix du ticket).

### V3.1-147 — Fiche de créature : le repaire et les défenses (26 octobre)

Opus : schéma et serveur. `dev-sonnet` : interface.
- Le schéma `statblock` gagne `lair` (une fiche) et `defenses` (quatre listes), tous deux facultatifs ; un ancien bloc reste valide (tests du schéma).
- `statblockLair.ts` résout le repaire pour le lecteur, dans le wiki public (fiches publiques) et la coquille joueur (`listPlayerVisibleEntityIds`). Un repaire caché est retiré de la donnée du bloc. Tests d'intégration : public et vrai compte joueur.
- La fiche affiche « · repaire » dans l'en-tête (lien de fiche) et « Défenses » dans Maîtrises, une ligne par catégorie présente.
- Le formulaire gagne le choix du repaire et quatre listes en pastilles.
- Aucune règle de dégâts ne change : V3.1-137 lira ces listes.

*Faille relevée en route, fermée le même jour* : dans la coquille joueur, une mention de texte ou d'Encadré vers une fiche réservée au MJ envoyait son nom et son slug. Les fiches citées sont désormais filtrées par ce que le joueur voit (registre de `SECURITE.md`, test d'intégration).


### V3.1-49 — Création : le chemin qui se ramifie (31 octobre)

Opus, de bout en bout (ADR 0068). Deux décisions de l'auteur en route : ajouter au 49 l'Expertise et l'Argot des voleurs, absents des données, et poser un sélecteur générique en attendant les sélecteurs fins du 118.
- **Noyau** : un choix de compétence peut être une `expertise`. `resolveChoices` ne la retient que sur une compétence maîtrisée ailleurs (`otherFeatures`, ou un autre choix). Chaque source de choix porte son origine (espèce, classe, historique), et les aptitudes de classe ouvrent leurs choix au niveau de leur classe.
- **Données** : `rogue-expertise` (deux au niveau 1, deux au niveau 6) et `rogue-thieves-cant` (Argot imposé, plus une langue). L'import accepte les choix des aptitudes de classe ; `ingest-srd` relancé le 31 octobre.
- **Chemin** (`lib/ui/cheminCreation.ts`, pur, 16 tests) : les étapes, les sous-étapes nées de chaque source, l'ordre Précédent / Suivant et les compteurs. Il est recalculé à chaque rendu, donc un choix disparaît quand sa source change.
- **Assistant** :
  - étapes à gauche, écran au centre, aperçu en direct à droite (grille des 18 compétences) ;
  - plus d'étape Compétences, les langues sous Identité ;
  - un choix ouvert n'empêche pas de créer ;
  - tablette sans colonne d'aperçu, téléphone avec une étape par écran et une barre de progression ;
  - la mise en page suit la largeur du conteneur, donc de la fenêtre du MJ.
- **Joueuse** : mêmes droits que le MJ ; `playerRestricted` et `hideAddClass` disparaissent.
- **Fiche jouable** : un bandeau rappelle les choix ouverts.
- **Vérifié au navigateur** :
  - Humain → Don d'origine → Initié à la magie → Liste → Sorts mineurs (7 sorts du clerc), puis disparition en passant à Elfe ;
  - un Guerrier 3 / Roublard 2 créé côté MJ avec 8 choix ouverts, rappelés sur la fiche, puis supprimé ;
  - Testeuse A : niveau de départ et seconde classe accessibles, sans valider ;
  - mise en page à 1440, 820 et 390 px.

*Restes* :
- les sélecteurs fins par genre de choix (118) ;
- l'équipement A/B et la sous-classe en sous-étapes (50 à 53) ;
- l'Expertise du Barde et du Rôdeur, à saisir sur le même modèle ;
- `RemainingChoicesStep` sert encore à la montée de niveau (51).

### V3.1-50 — Création : Origines, Historique et un seul sélecteur de sorts (31 octobre)

Opus : le noyau et les données ; `dev-sonnet` : les écrans ; relu et corrigé par Opus.
- **Noyau** : `spellNumbers`, la seule formule du DD et de l'attaque des sorts (le moteur l'écrivait deux fois). `choiceEffects.ts` chiffre chaque option d'un choix pour ce personnage : DD et attaque d'une caractéristique d'incantation, total d'une compétence, et « déjà maîtrisée (Acolyte) ».
- **Chemin** : le don qu'accorde l'historique devient une seule sous-étape, « Don : Initié à la magie (Clerc) · n/3 », dont l'écran réunit les choix en sections. La cascade de Polyvalent sous Espèce garde ses sous-étapes.
- **Écrans** :
  - un seul sélecteur de sorts (`SelecteurSorts`, avec la fiche du sort touché), pour l'étape Sorts comme pour tout choix de sort ;
  - Espèce et Historique en petites cartes, avec la fiche de la sélection et « Ce qui en naît » ;
  - un tableau comparatif des lignages aux niveaux 1, 3 et 5 ;
  - les jetons « +2 et +1 » ;
  - l'équipement de l'historique en deux cartes A et B.
- **Maîtrises** : `dedoublonnerMaitrises` réunit les doublons et traduit, par exemple l'outil de l'Acolyte. Le jeu du Soldat était un `proficiency_choices` du SRD, que le serveur ignorait. Il devient un choix d'outil en données (`soldier`, sous-étape « Un jeu » en cartes), affiché dans les maîtrises ; `ingest-srd` relancé le 31 octobre.
- **Corrections d'Opus** :
  - les jetons de l'historique recalculaient le modificateur et codaient un plafond de 20 : ils lisent maintenant la fiche du moteur ;
  - la vitesse d'une option de lignage s'affichait en pieds : elle est en mètres.
- **Vérifié au navigateur** :
  - le don de l'Acolyte et ses sections ;
  - le tableau du lignage elfique (Vitesse +1,5 m) ;
  - « mod. +0 → DD 10, attaque +2 », avec « celle de votre classe » ;
  - Sens aiguisés : « déjà maîtrisée (Acolyte) » ;
  - le Soldat : Échecs draconiques dans les maîtrises, aucun doublon, tout en français.

*Restes* :
- la double « Lance » de la vérification du 11 octobre n'a pas été reproduite ; le dédoublonnage la couvre, mais le serveur pousse toujours une ligne par source ;
- les vitesses d'espèce s'écrivent « 9.1 m » (point décimal), comme avant.

### V3.1-51 — Création : la Classe, et le même écran pour monter de niveau (31 octobre)

Opus : le noyau et la route. `dev-sonnet` : les écrans. Relu, et un correctif d'Opus.
- **Noyau** :
  - chaque choix ouvert porte le niveau qui l'ouvre et sa classe (`atLevel`, `classKey`), et les sous-étapes du chemin aussi ;
  - `progressionClasse` (pure) donne une ligne par niveau (acquis, atteint, nouveau, à venir) avec ses pastilles (choix, sous-classe, amélioration) et le compte « Choix de niveau · n à faire » ;
  - `sousEtapesNouvelles` réduit la montée de niveau à ce qui change.
- **« Lancer tous »** : `roll-hp` lance plusieurs dés de vie en un appel. Son corps est strict : un client qui envoie un résultat est refusé (`lib/characterCreator/desDeVie.ts`, testé).
- **Écrans** :
  - les classes en emplacements, avec les prérequis et le plafond du ruleset ;
  - la progression avec ses pastilles ;
  - les Points de vie ligne par ligne ;
  - la montée de niveau dans le même assistant : classe existante ou nouvelle, plusieurs niveaux d'un coup, aperçu avant → après, UNE écriture (`level-up`, PV en intentions).
- **Suppressions** : `LevelUpWizard.tsx`, `HpRollStep.tsx` et `RemainingChoicesStep.tsx` n'existent plus.
- **Correctif d'Opus** : la validation de la montée renvoyait 409. Le bouton se désactivait pendant l'envoi ; le focus quittait alors la carte du bloc, dont la sauvegarde sur perte de focus faisait monter la version pendant la requête. Le bouton n'est plus désactivé, un garde empêche le double envoi.
- **Vérifié au navigateur** :
  - Clerc 3 / Guerrier 2 : deux emplacements, niveau 5, pastilles « compétences » (ligne 1) et « Sous-classe » (ligne 3), « Choix de niveau · 1 à faire » ;
  - montée de 3 niveaux en ajoutant une classe (Moine) : aperçu « Niveau 8 → 11 », une seule écriture, 200, PV en moyenne calculés par le serveur.

*Restes* :
- la sauvegarde sur perte de focus des cartes de bloc enregistre même un bloc inchangé, et fait monter sa version à chaque fois : des écritures inutiles, et un risque de 409 ailleurs ;
- aucun test d'intégration ne couvre `applyLevelUp` ;
- les prérequis de multiclassage s'affichent à la création sans la bloquer (le serveur ne les vérifie qu'à la montée).

### V3.1-52 — Création : les Caractéristiques, la suggestion puis l'échange (31 octobre)

Opus : le noyau et la route ; `dev-sonnet` : l'écran ; relu, deux retouches d'Opus.
- **Noyau** (`lib/ui/caracteristiques.ts`, testé) :
  - `repartirSelonPriorite` : les valeurs de la plus haute à la plus basse, dans l'ordre de la classe lu dans le ruleset ;
  - `echangerValeurs` ;
  - `peutAugmenter` / `peutDiminuer` : le budget et les bornes de l'achat de points, lus dans le ruleset.
- **Tirage** : `roll-abilities` passe par `lib/characterCreator/tirageCaracteristiques.ts`, au corps strict. Un client qui envoie des valeurs est refusé (testé).
- **Écran** :
  - les méthodes que le ruleset propose ;
  - « Répartir pour un clerc », puis l'échange en touchant deux cases ;
  - six grandes cases (total, modificateur, et d'où vient le total, lus dans la fiche du moteur) ;
  - l'achat de points avec sa jauge ;
  - le tirage, puis la même suggestion.
- **Retouches d'Opus** :
  - « Valeur attribuée » prend son accent (libellé du moteur) ;
  - les boutons du `Stepper` partagé ont un nom accessible (« Augmenter FOR »), plus « ▲ ».
- **Vérifié au navigateur** :
  - la suggestion pour un clerc (SAG 15), puis l'échange SAG ↔ CHA : les totaux suivent ;
  - l'achat de points : à 27 / 27, tous les + se grisent ;
  - le tirage : `{ worldSlug }` seul, jets du serveur, suggestion appliquée (SAG 17).

*Restes* : le SRD ne donne que la caractéristique principale d'une classe (`suggested_abilities`). La suggestion place donc le reste de FOR à CHA. ~~Un ordre complet par classe reste à saisir en données.~~ Fait avec V3.1-53 : le tableau « Standard Array by Class » du SRD 5.2.1 (`data/srd/standard-array-2024.json`) donne l'ordre complet (Guerrier : FOR › DEX › CON › CHA › SAG › INT).

### V3.1-53 — Création : l'Équipement (31 octobre)

Opus : le noyau, les données et la route ; `dev-sonnet` : l'écran ; `aide-haiku` : la planche du catalogue ; relu, retouches d'Opus.
- **Données SRD 5.2.1** (réimport approuvé par l'auteur) :
  - « Starting Equipment at Higher Levels » dans `character-rules.json` : par palier, or fixe, `gold_roll` (1d10 × 25 ou × 250) et `magic_item_picks` par rareté ;
  - « Standard Array by Class » : l'ordre complet des caractéristiques par classe (reste du 52) ;
  - `bundle_size` du bloc `item_properties` : un objet vendu par lot (20 flèches pour 1 po et 1 lb).
- **Noyau** (testé) :
  - `startingAtHigherLevel`, `startingGold` (`characterRules.ts`) ; `perUnitWeight`, `perUnitCost`, `orderFromStandardArray` (`srdMapping.ts`) ;
  - `lib/ui/equipement.ts` : `emplacementDe`, `basculerPort` (allumer range l'ancien du même emplacement), `acheter` / `rendre` (par `spendCoins` / `depositCoins`), `filtrerBoutique`.
- **Route** `/api/character-creator/roll-starting-gold`, corps strict `{count, faces}` : le serveur lance les dés (règle 8).
- **Serveur** : les poids et prix d'un objet vendu par lot sont rendus à l'unité. L'inventaire compte des unités : la charge de 20 flèches passait de 20 lb à 1 lb, et les rendre une à une ne rembourse plus 20 po.
- **Écran** (`EquipmentStep.tsx`) : bourse et charge ; trois tuiles qui scintillent et CA du moteur qui compte ; bande d'équipement au trait ; inventaire alphabétique ; boutique cherchable, chargée seulement à l'ouverture ; départ à haut niveau (jet du serveur, objets magiques par rareté). Une bourse sans objet (option B) est maintenant envoyée à la création.
- **Retouches d'Opus** : l'écran a son propre conteneur (`@container/equip`) — les seuils sur le conteneur de l'assistant cassaient la grille à 820 px ; portées en virgule décimale ; totaux de pile sur chaque ligne ; vente par lot dans la boutique.
- **Vérifié au navigateur** : Soldat (option A), porter l'arc range la lance ; « perforants » ne garde que les armes perforantes ; achat 14 → 9 po ; 390 px, 820 px et ordinateur alignés sans défilement horizontal ; niveau 5 : jet du serveur (10 → 750 po), pas de relance au retour, or retiré en redescendant au niveau 1.

*Restes* : le prix de l'arc long est faux à la source (`srd-2024.json` : 5 po, le SRD dit 50 po) ; les objets magiques déjà cochés restent si le palier change ; l'attaque de la tuile suppose la maîtrise de l'arme (comme la fiche).

### V3.1-118 — Les choix dans l'assistant de création et de montée de niveau (31 octobre)

Opus : le noyau et le serveur ; `dev-sonnet` : les sélecteurs ; relu, retouches d'Opus. Décisions de l'auteur : le don à la place de l'amélioration entre dans ce ticket ; les maîtrises d'armes, à part (V3.1-148).
- **Don de niveau** (`abilityScoreImprovement.ts`, testé) : chaque niveau d'amélioration ouvre un choix de don général (`<classe>.l<n>.feat`, rangé sous Classe à son niveau). Le don « Amélioration de caractéristique » garde son +2 / +1+1 sous `<classe>.l<n>.asi` ; un autre don le remplace (`asiApplies`, au client, au serveur et à la montée de niveau). Un personnage d'avant, avec son `.asi`, a choisi l'amélioration (`withImplicitAsiFeat`), sans réécriture en base.
- **Chemin** : la sous-étape du don n'est faite qu'avec un +2 / +1+1 valide ; sa pastille remplace celle de l'amélioration sur la progression (comptée une fois).
- **Sélecteurs** : dons en cartes (catégorie, prérequis, extrait de la fiche) avec le +2 / +1+1 dessous (`AsiStep`, sorti de l'étape Classe) ; cartes de maîtrise d'armes avec la botte de chaque arme ; options nommées avec leur effet (`description`, Ascendance gigante saisie d'après le SRD 5.2.1).
- **Onglet Magie** (fiche, aperçu, solo) : les sorts accordés (`sheet.grantedSpells`), « toujours préparé » et leur source.
- **Retouches d'Opus** : doublon de la pastille d'amélioration corrigé à la source (`progressionClasse`) ; formatage involontaire d'un fichier annulé ; gras Markdown retiré des extraits ; bottes des maîtrises ; sorts accordés passés aux deux autres onglets Magie.
- **Vérifié au navigateur** : Guerrier niveau 4, la sous-étape « Don de niveau » ; « Amélioration de caractéristique » puis FOR +2 : l'aperçu passe à FOR 12 et le choix est fait ; « Empoigneur » à la place : le +2 disparaît ; maîtrise d'armes : chaque arme montre sa botte.

*Restes* : l'Empoigneur n'a pas ses effets en données (le +1 en Force ou Dextérité) ; l'Ascendance gigante n'est pas une ressource qui se recharge (critère de V3.1-6, à reprendre avec V3.1-119) ; deux armes s'appellent « Lance » en français (lance et lance d'arçon) ; les textes de l'Ascendance gigante arrivent en base au prochain import.

### V3.1-119 — Les choix rouverts au repos (31 octobre)

Opus : le noyau, l'état de jeu, le service et la route ; `dev-sonnet` : le bandeau ; relu, une retouche d'Opus.
- **Noyau** (`src/core/rules/choiceRefresh.ts`, testé) : un repos long rouvre les choix « repos long » et « repos court », un repos court les siens ; seulement ceux déjà répondus. Une nouvelle réponse vaut si le moteur, résolu avec elle, la retient entière.
- **État de jeu** : `choices_to_refresh` (jsonb, `.default([])`, aucune migration). Les deux repos le remplissent et le journal l'annonce (« Choisir à nouveau : Terrain »).
- **Action** `POST /api/entities/{id}/actions/refresh-choice`, corps strict `{campaignId, key, values | null}`, mêmes droits qu'un repos : `values` rechoisit (validé par le moteur, écrit avec contrôle de version), `null` garde ; un choix non rouvert est refusé (409).
- **Test de service** (base réelle, monde jetable) : Druide du Cercle de la Terre, repos long, Terres arides → Terres polaires, la liste de sorts suit (Rayon de givre remplace Mains brûlantes) ; réponse hors options refusée ; un repos court ne rouvre pas le terrain.
- **Écran** (`ChoixRouverts.tsx`) : bandeau en tête de fiche, tableau comparatif ou sélecteur générique, « Valider » ou « Garder » ; au téléphone, un rappel et une feuille du bas. Retouche d'Opus : types de dégâts en français.
- **Vérifié au navigateur** (druide de test créé puis supprimé) : repos long → bandeau ; « Valider » Terres polaires → 204, bandeau parti, terrain changé en base ; « Garder » → Terres arides reste, bloc non réécrit ; téléphone : « Un choix à refaire » ouvre la feuille.

*Restes* : un choix de don ou de sort rouvert n'a que « Garder » sur la fiche (aucun catalogue chargé), aucun cas dans les données ; la sous-classe du druide s'appelle `circle-of-the-land-subclass` (homonyme d'une aptitude).

### V3.1-104 — Écritures du moteur au nom d'un joueur : changements signés (31 octobre)

Opus seul (sécurité, base, cryptographie). ADR 0041, option B, avec un addendum.
- **Migration** `20261031120000_engine_signed_changes` : schéma `app_private` sans droit pour les clients, tables `engine_signing_keys` et `engine_change_nonces`, fonction `public.apply_engine_change(p_payload text, p_signature text)` (security definer, `search_path` fixé). Écart avec l'ADR : le changement arrive en texte, l'HMAC porte sur les octets reçus (un `jsonb` réordonne ses clés). Appliquée en deux temps : la version était déjà enregistrée par un essai précédent, son insertion annulait tout le script.
- **Noyau** (`src/core/rules/engineChange.ts`, testé) : `canonicalJson` et le schéma fermé `zEngineChange`.
- **Serveur** : `engineSigning.ts` (HMAC-SHA256, clé de l'environnement, erreur explicite si absente), `repos/engineChanges.ts`. `applyResolvedEffects` écrit par un changement signé ce qui n'est pas au joueur quand `resolveTargetedRoll` reçoit `callerIsGm: false` ; le MJ garde l'écriture directe. Les jets contre la mort d'une autre fiche restent au MJ (hors liste signable).
- **Clé** : posée par l'auteur (`docs/CLE-MOTEUR.md`), jamais passée par la conversation ; `ENGINE_SIGNING_KEY` ajoutée à `verifier:secrets`, `.env.example`, `SECURITE.md` §4, `SCHEMA.md` §12.1 bis.
- **Vérifié** contre la base réelle (session cloud avec la clé) : changement appliqué puis rejoué refusé ; signature fausse, clé inconnue, `issued_at` trop vieux, champ hors liste, ligne d'une autre campagne refusés sans rien écrire ; client anonyme refusé. Depuis le serveur : table des clés invisible par l'API.

*Restes* : le test de rotation (deux clés actives) attend une seconde clé ; le chemin signé ne sert qu'avec V3.1-107, qui doit aussi donner au joueur la lecture des participants (vue filtrée de V3.1-102).

### V3.1-107 — Cibler côté joueur (1er novembre)

Opus : conception (ADR 0069, choix de l'auteur : lecture signée), migration, noyau, serveur ; `dev-sonnet` : l'écran ; relu.
- **Lecture signée** : `public.engine_read_combat` rend les participants d'un combat à une demande signée (même clé, 60 s, `nonce` commun ; une demande d'écriture ne passe pas pour une lecture). Migration `20261101090000_engine_signed_read`, appliquée en deux temps (même cas que le 104).
- **Jeton de dégâts** (`signDamageToken` / `verifyDamageToken`, testés) : une attaque qui touche au nom d'un joueur rend un jeton signé (acteur, action, cible, critique, dix minutes) ; la demande de dégâts doit le présenter, et son `nonce` devient celui de l'écriture signée : la base refuse qu'il serve deux fois. Le critique ne vient jamais du client.
- **Ce que lit le joueur** (`src/core/rules/playerFacing.ts`, testé) : le verdict sans la CA, l'effet sur un adversaire par son état de blessure, les PV d'un allié seulement ; au journal, les phrases sans les changements bruts.
- **Route** `player-targeted-roll` : Zod strict (son PJ, arme ou sort, ni monstre, ni secret, ni critique), droit de modifier la fiche de l'acteur ; 503 explicite si le moteur ne peut pas signer. Un sort à sauvegarde reste au MJ (409, ADR 0044).
- **Écran** : « Cibler » depuis Attaquer (arme) et les sorts de soin, cibles par la vue filtrée (V3.1-102), bande « Lancer les dégâts » avec le jeton. Le MJ garde son chemin.
- **Vérifié** contre la base réelle (session cloud avec la clé) : 3/3. Depuis le serveur : signature fausse, clé hors liste et client anonyme refusés.

*Restes* : la faille du journal relevée en concevant (CA et PV des jets du MJ lisibles des joueurs) est le ticket V3.1-149 ; un sort à sauvegarde lancé par un joueur reste au MJ ; à vérifier au navigateur avec un compte joueur pendant une vraie initiative.

### V3.1-148 — Les bottes d'armes maîtrisées, appliquées en jeu (1er novembre)

Opus seul (moteur de jeu ; l'affichage tenait en quelques lignes).
- **Noyau** (`src/core/rules/weaponMastery.ts`, testé d'abord) : une arme n'a sa botte que si elle est maîtrisée (choix `<classe>.weapon_mastery` encore ouverts à la fiche). Sape et Vexation posent une **marque** dans les états de la cible (`botte:<genre>:<auteur>:<round>`) ; Écorchure (raté : dégâts égaux au modificateur) et Renversement (touché : sauvegarde de Constitution DD 8 + mod + maîtrise) passent par les effets ; Poussée, Ralentissement, Enchaînement et Coup double se disent à la table. La marque se lit « Sapé » / « Vexé » partout où un état s'affiche.
- **Serveur** (`resolveTargetedRoll`) : avant le jet, Sapé donne le désavantage à l'attaquant marqué, Vexé l'avantage à l'auteur contre sa cible ; la marque est consommée. Renversement : le serveur lance la sauvegarde d'un monstre ; un PJ reçoit l'indication. Au nom d'un joueur, tout passe par le changement signé (ADR 0041), comme les PV.
- **Tour** (`moveTurn`) : Sapé tombe au début du tour suivant de son auteur ; Vexé à la fin de son prochain tour. En avant seulement, comme les déclencheurs, et par une écriture de participant journalisée (« Annuler » la rend).
- L'onglet Actions affichait déjà la botte d'une arme maîtrisée (V2-G1) : inchangé.
- **Vérifié** contre la base réelle : épée longue maîtrisée (SRD 5.2.1), touché → la cible « subit : Sapé » ; sa riposte a le désavantage et consomme la marque ; l'épée courte non maîtrisée ne pose rien ; expiration au tour. Le chemin joueur (signé) repasse 3/3.

*Restes* : un monde en SRD 5.1 (2014) n'a pas de bottes (les armes n'en portent pas) ; Poussée, Ralentissement et Enchaînement restent à la table (pas de position ni de Vitesse dans la scène).

### V3.1-149 — Le journal de session sans la CA ni les PV des adversaires (1er novembre)

Opus seul (sécurité, RLS). ADR 0070.
- **Migration** `20261102090000_session_events_gm_details` :
  - les événements `combat` se lisent par l'administrateur du monde et leur auteur ;
  - l'ancienne écriture `FOR ALL` (qui ouvrait aussi la lecture) est découpée : insérer pour les membres, modifier et supprimer pour l'administrateur ;
  - la table `session_event_gm_details` (MJ seul) ;
  - la fonction `next_session_event_seq`.
  Suivie de `20261102100000` : la fonction accepte le client service-role, qu'elle refusait (les tests du tour solo l'utilisent).
- **Serveur** : un jet ciblé du MJ et la sauvegarde d'un monstre écrivent au journal les phrases de `playerFacing.ts` ; CA, PV et changements bruts vont dans la table du MJ (`journalPayloads`, `gmJournal`). Un jet secret n'y laisse que « Jet secret du MJ. ». Le dépôt joint les chiffres à la lecture quand la RLS les rend : le fil du MJ et la narration ne changent pas.
- **Vérifié** contre la base réelle : le joueur ne lit au journal ni CA, ni PV d'adversaire, ni événement de combat, ni la table du MJ ; le fil du MJ relit « contre CA 1 » et « Gobelin : 30 → … PV » ; un joueur journalise encore après des événements qu'il ne voit pas ; « Annuler » rend les PV.

*Restes* : le journal d'activité d'un joueur ne montre plus les lignes de combat ; « Annuler » rejoue un événement `combat` inséré par un joueur sans vérifier l'auteur (registre de `SECURITE.md`, faible).

### V3.1-22 — Salon de groupe et jets dans le chat (1er novembre)

Opus : migration, RLS, routes, logique du DD privé, relecture ; `dev-sonnet` : les écrans ; `aide-haiku` : la planche. ADR 0038.
- **Migration** `20261102120000_campaign_chat_salon` : `thread_user_id` nul = salon, lisible et écrivable des membres de la campagne et du MJ ; fils privés inchangés ; la lecture du salon se note (index unique `nulls not distinct`). `related_entity_id` reste en base, plus écrit ni lu.
- **Routes** : `?fil=salon` (messages, lecture) ; le salon rend aussi les jets de la campagne (RLS : publics, et les secrets de leur auteur et du MJ). Un verdict contre un DD privé ne part plus chez un joueur (`rollDetailForReader`, aussi sur la route `dice-rolls`).
- **Écrans** : fenêtre du MJ (salon en grand, fils privés en pastilles, colonne ou panneau par requête de conteneur), page pleine du joueur (deux conversations), pilules au téléphone ; jets en cartes intercalés par l'heure, sans abonnement de plus (les jets que reçoit déjà l'outil de dés, dans un contexte à part). Demande de modification retirée (bouton, champ du schéma, affichage).
- **Vérifié** contre la base réelle (`chatSalon.integration.test.ts`, 3/3) : salon lu et écrit par les membres, refusé hors campagne et au nom d'un autre ; fil privé d'un autre illisible et non écrivable ; lecture du salon notée une fois.

*Restes* : à voir au navigateur par l'auteur ; non-lus par conversation côté joueur partent de zéro au chargement (la pastille globale est exacte) ; pas d'animation d'entrée du panneau ; le temps réel des jets envoie encore le verdict d'un DD privé (registre de `SECURITE.md`).

### V3.1-90 — Statistiques : le noyau pur (1er novembre)

Opus seul (le contexte de V3.1-89 était chargé ; un fichier). Tests d'abord, 29 cas.
- **`src/core/stats/playerStats.ts`** : `d20Histogram` (vingt colonnes sur le d20 GARDÉ, `tooFew` sous 5 jets), `rollCount`, `d20Average` (au dixième), `longestStreak` (ordre des dates, jets sans d20 ignorés), `favoriteAction` (hors dégâts et jet libre ; test et sauvegarde confondus ; l'attaque sournoise reconnue à son libellé, faute de genre propre ; égalité : le plus récent), `biggestHit`, `familyMeasures`, `pickTitle`, `renderTemplate` (une seule passe, texte brut, décimal à la française), `checkTiers` (trous, chevauchements, nature d'action en double), `playerTitles` (une case par famille, vide sans palier ; `[]` sous 5 jets).
- **Cas limites tranchés** : rapport à une table à zéro : 0 pour 0 vaut 1, sinon l'infini ; bourse sans rien dépensé : 0 (« rien gagné » ne fait pas une bourse percée quand rien n'est sorti).
- Rien n'est stocké (règle 16) ; rien de `next`, `react` ni `@supabase` (règle 19).

*Restes* : le service et le volet (V3.1-91) ; l'éditeur des paliers (V3.1-92) lira `checkTiers`.

### V3.1-91 — Statistiques : le service et le volet de l'accueil (1er novembre)

Opus : service, route, accès ; `dev-sonnet` : le volet ; `aide-haiku` : la planche ; relu et vérifié au navigateur par Opus.
- **Service** `getPlayerStats` (`src/server/services/playerStats.ts`) : le personnage réclamé de l'appelante est résolu par le serveur (la route n'accepte que `scope`, Zod strict) ; ses jets publics seulement ; la moyenne de la table en une requête (`listTableD20`, personnages réclamés ayant lancé un d20 dans la période, elle comprise ; seule la moyenne sort) ; « Dernière séance » = la séance la plus récente (jets et argent) ; paliers lus et validés (`listPlayerTitleTiers`, une ligne abîmée écartée et signalée).
- **Route** `GET /api/campaigns/[campaignId]/player-stats?scope=…`.
- **Volet** `StatsJoueur.tsx` (remplace `DiceStatsPanel`, retiré avec la route `economy-stats` qu'il était seul à lire) : pilule, histogramme sur une grille de 20 colonnes partagée (moyenne au centre, 1 en rouge et 20 en vert au-dessus de leur colonne, même source que les barres), quatre titres en 2 × 2 avec icônes au trait (`IconeTitre.tsx`), états vides et d'erreur. Appel dans `lib/ui/statsJoueurApi.ts`.
- **Vérifié** contre la base (`playerStats.integration.test.ts`, 3/3 : secrets et cachés exclus, 1 et 20 égaux aux colonnes, dernière séance, chacune son personnage, MJ sans statistiques) et au navigateur (Testeuse A, banc d'essai) : 1400 × 860 sans défilement ; 390 px, aucun chiffre recouvert.

*Restes* : « Statistiques depuis le 9 octobre » est un libellé fixe ; l'attaque sournoise n'a pas encore de jet qui la nomme (V3.1-90).

### V3.1-92 — Administration › Titres des joueurs : l'éditeur (1er novembre)

Opus : écriture, validation, accès ; `dev-sonnet` : l'éditeur ; `aide-haiku` : la planche ; relu par Opus.
- **Serveur** : `savePlayerTitleTiersAction` / `resetPlayerTitleTiersAction` (`app/admin/titresActions.ts`) → `playerTitleTiersWrite.ts` : superadmin vérifié (puis RLS), jeu complet validé par `zPlayerTitleTierSet` (douze icônes, cinq couleurs, variables connues, chaque famille garde un palier) ; remplacement sans table vide (le nouveau jeu inséré avant le retrait de l'ancien). L'Administration charge les paliers avec la page.
- **Éditeur** (`PanneauTitres.tsx`) : familles, mesure, une ligne par palier (sélecteur d'icône 6 × 2 et de couleur, nom, plage en virgule décimale ou sorte d'action, petit texte, × jamais sur le dernier), avertissement `checkTiers`, aperçu avec valeur d'essai et la carte partagée avec le volet (`CarteTitre.tsx`, texte brut), Enregistrer, Rétablir confirmé ; erreur du serveur affichée (retouche d'Opus).
- **Vérifié** : validation (4 tests : icône, couleur, famille vide, variable inconnue ; du HTML reste une simple chaîne) ; contre la base, un compte ordinaire refusé par le service puis par la RLS, rien ne change.

*À vérifier par l'auteur* (seul superadmin) : Administration › Titres des joueurs, changer un nom de palier, Enregistrer, puis recharger le volet « Je joue » d'une joueuse ; Rétablir remet les paliers par défaut.

### V3.1-93 — Règles : le sommaire passe dans la fenêtre (1er novembre)

`dev-sonnet` : le code ; `aide-haiku` : la planche ; relu et vérifié au navigateur par Opus.
- **`WindowsDesktop`** accepte un `sommaire` : sur ordinateur, une colonne de 250 px à gauche de la zone ; la couche des volets reste calée sur la zone (mesurée par `ResizeObserver`), donc à droite du sommaire. Sans `sommaire`, rendu inchangé (Monde, MJ).
- **`SommaireRegles.tsx`** : recherche en direct, « Récemment » (même clé que le téléphone, espace `mj-regles`), catégories repliables avec leur nombre, sous-classes et sous-espèces sous leur parent, règle ouverte surlignée (`aria-current`), « + Ajouter une règle ▾ » et « Bacs à sable ▾ » en pied (mêmes liens qu'avant, en volet). Fenêtre étroite (requête de conteneur, 48 rem) : colonne réduite et tiroir ☰.
- **`RulesSidebar`** ne garde que le rail commun (sections, dé, radio) ; téléphone inchangé.
- **Vérifié au navigateur** (MJ du banc d'essai, 1440 et 900 px) : recherche « boule » filtrée en direct, « Récemment », les cinq formulaires et les deux bacs à sable listés, « Créer une arme maison » ouvert en volet à droite de la règle, tiroir en fenêtre étroite.

*Restes* : le contenu de la règle, ses onglets et le ⋮ (V3.1-94).

### V3.1-150 — Le devoir de journal : la page naît à l'assignation, « Devoir fait » la publie, le MJ valide (sans modèle IA)

**Modèle conseillé : Opus** (schéma, RLS, sécurité). ADR 0071. Esquisse décidée le 1ᵉʳ novembre : canevas « Esquisse · Devoir de journal » (privé, celui de l'auteur), piste A.

**Le constat (1ᵉʳ novembre).** Une joueuse a écrit son résumé de séance dans son cahier de notes, l'a partagé, puis a passé la page partagée en type `session_journal` avec le sélecteur de type. La page n'apparaissait alors nulle part : le sommaire écarte ce type, et le Livre de sessions ne liste que les fiches rattachées à un devoir rédigé. En cause aussi, le parcours du devoir lui-même : un devoir assigné ne créait rien. Seule une bannière, en haut de l'onglet Wiki, permettait de créer la page. La joueuse ne l'avait jamais vue, et son devoir était resté « en attente » un mois. Elle avait aussi, sans le vouloir, un second compte (ouvert par le lien d'invitation réutilisable).

**Ce qui change.**

0. **Un type système ne se choisit plus à la main** (déjà fait, commit du 1ᵉʳ novembre). Le sélecteur ne propose plus `session_journal`, `shared_note` ni `world_timeline` comme catégories ; le serveur refuse d'entrer dans un type système ou d'en sortir (`canChangeEntityKind`), et la création libre d'une fiche le refuse aussi.
1. **Assigner crée la page.** Le MJ assigne le devoir : la fiche `session_journal` est créée aussitôt, titre provisoire « Journal · <date en jeu> », avec ses blocs « Séance » et « Récit », non publique (`is_public = false`). L'autrice reçoit l'octroi d'édition : la page est dans son onglet Édition. Le MJ peut s'assigner le devoir à lui-même.
2. **Tant qu'il n'est pas rendu, le devoir est masqué.** La page n'est ni dans le Livre, ni dans le sommaire, ni dans la recherche, ni dans les listes « lien vers une fiche » d'un autre joueur, et sa lecture directe dans le wiki joueur répond « introuvable ». Seuls l'autrice et le MJ la voient.
3. **« Devoir fait » publie, et c'est définitif.** L'autrice clique « Devoir fait » : le devoir passe à `written`, la page devient publique (`is_public = true`), la date de rédaction se pose dans le bloc « Séance », et le fait s'écrit au journal de la campagne. La page entre dans le Livre pour toute la table. Pas d'annulation.
4. **Le MJ valide.** Un nouvel état, `validated`, que seul le MJ pose (« Valider le devoir » dans le registre). La validation retire la mention du devoir de la barre de la joueuse. L'autrice garde son droit d'édition ; le MJ peut le lui retirer comme pour toute fiche.
5. **Côté joueuse, piste A.** Sous « Édition », dans le rail, une sous-entrée « Devoir de journal » : « À rendre » (pastille dorée) tant qu'il n'est pas rendu, « Rendu · à valider » ensuite, rien une fois validé. Sur la page du devoir, un bandeau : séance et date en jeu, bouton « Devoir fait » ; après le rendu, un bandeau vert. Au téléphone, une pastille sur l'entrée « Édition » de la barre flottante. La bannière de l'onglet Wiki disparaît.
6. **Côté MJ.** Le registre montre trois états : « En cours d'écriture », « Rendue · à valider », « Validée ». « Annuler le devoir » reste possible tant qu'il n'est pas rendu, et efface aussi la page encore vide de toute publication.

**Sécurité.** La joueuse pouvait jusqu'ici modifier n'importe quelle colonne de son devoir (politique `session_journal_entries_update`) : avec un état `validated`, elle se serait validée elle-même. La modification devient réservée au MJ ; la joueuse ne passe son propre devoir de `pending` à `written` que par une fonction étroite (`submit_journal_assignment`). L'ancienne fonction `claim_journal_entry_grant`, qui ne sert plus, est retirée.

**Hors du ticket.** Fusionner deux comptes d'une même personne ; empêcher qu'un lien d'invitation ouvre un second compte (à trancher à part si le cas revient). Un devoir « en attente » sans page n'existe pas dans la base au 1ᵉʳ novembre (les trois devoirs existants sont rédigés) : rien n'est prévu pour ce cas, le MJ l'annule et le réassigne.

**Critères d'acceptation.**
- [x] Assigner un devoir crée la page, l'octroi et les deux blocs ; la page est dans l'onglet Édition de l'autrice et nulle part ailleurs pour un autre joueur.
- [x] Un autre joueur ne trouve la page ni dans le Livre, ni dans le sommaire, ni par la recherche, et sa lecture directe répond « introuvable ».
- [x] « Devoir fait » : devoir `written`, page publique, date de rédaction posée, fait au journal ; la page est dans le Livre.
- [x] La joueuse ne peut ni valider son devoir, ni modifier ses autres colonnes, ni rendre le devoir d'une autre.
- [x] « Valider » (MJ seul) passe le devoir à `validated` ; la mention quitte la barre de la joueuse.
- [x] Annuler un devoir non rendu efface aussi sa page.
- [x] `npm run typecheck`, lint, tests unitaires ; test d'intégration `sessionJournalDevoir.integration.test.ts` contre la vraie base (après application de la migration).

**Sous-tâches Haiku.** Planche du catalogue (sous-entrée du rail, bandeau du devoir, pastilles d'état du registre).

**Fait le 1ᵉʳ novembre** (Opus seul : schéma, RLS, sécurité ; le contexte était chargé).
- **Noyau** `src/core/sessionJournal/devoir.ts` (tests d'abord) : états, `canSubmitDevoir`, `canValidateDevoir`, `canCancelDevoir`, `mentionDevoir`, `titreProvisoire` ; « à qui le tour » compte un devoir validé comme écrit.
- **Migration** `20261102130000_session_journal_devoir` : état `validated` et `validated_at` ; modification réservée au MJ ; `submit_journal_assignment` ; `claim_journal_entry_grant` retirée. Types mis à jour à la main.
- **Serveur** (`sessionJournal.ts`) : `assignJournalEntry` crée page, octroi, blocs et devoir (MJ et autrice de la campagne vérifiés avant ; page effacée si une écriture rate) ; `submitMyJournalAssignment` publie, date, puis rend ; `validateJournalAssignment` ; `cancelJournalAssignment` refuse un devoir rendu et efface la page ; `getMyOpenDevoir`, `getDevoirBandeau`. Brouillon masqué dans `listPlayerVisibleEntityIds` et `getPlayerEntityDetail`. Routes : `submit` (« Devoir fait », Zod strict), `validate` (nouvelle), assigner et annuler disent leurs refus ; annuler vérifie la campagne de l'adresse. Retirés : la route `my-assignment` et la bannière du Wiki.
- **Écrans** : `SousEntreeDevoir` dans le rail (`PlayerShell`), pastille sur « Édition » rail replié et au téléphone ; `BandeauDevoir` sur la page de l'onglet Édition ; registre MJ à trois états, « Devoir fait » pour le MJ autrice, « Valider le devoir ». Planche « Livre de sessions » (`OutilsMJ.dc.html`), `docs/CABLAGE.md`, `docs/SCHEMA.md`, registre de `docs/SECURITE.md`.
- **Vérifié** : typecheck ; lint des fichiers touchés ; tests unitaires (292 fichiers) dont `devoir.test.ts` et `sessionJournalGestes.test.ts` (16 cas : ordre des écritures, refus, journal). `sessionJournalDevoir.integration.test.ts` contre la base réelle, migration appliquée : 6/6 ; aucun monde de test laissé ; les trois devoirs existants intacts (`written`).

**Clôture (1ᵉʳ novembre).**
- **Navigateur**, Banc d'essai, Chromium local : Testeur MJ assigne (« En cours d'écriture ») ; Testeur B ne voit ni sous-entrée, ni page au sommaire, et l'adresse directe répond 404 ; Testeuse A voit « Devoir de journal · À rendre » sous Édition et la page dans sa colonne, rend par « Devoir fait » (confirmation), bandeau vert et « Rendu · à valider » ; Testeur B lit alors la page ; le MJ valide, la mention quitte la barre de A ; téléphone 390 px : pastille « 1 » sur Édition. Corrigé en chemin : le formulaire gardait l'ancienne version de la fiche après le rendu (« Rédigé le » vide, faux conflit au renommage) ; libellé du rail tronqué ; « 1er novembre ». Les trois devoirs d'essai, leurs pages et octrois sont retirés du Banc d'essai.
- **`/security-review`** : aucune faille au-dessus du seuil. Note retenue : la confidentialité du brouillon repose sur les lectures côté serveur (`listPlayerVisibleEntityIds`, `getPlayerEntityDetail`), pas sur la RLS d'`entities`/`blocks` (lisibles des membres du monde, comme avant) — toute nouvelle route de lecture joueuse doit passer par elles.
- **Catalogue** : CSS recompilé et téléversé, planche « Outils du MJ » publiée sur le canevas (hauteur 21 000) ; `canvas.json` du dépôt réaligné sur celui du canevas, qui avait divergé. Les autres planches gardent l'ancienne feuille, suffisante pour elles.

### V3.1-151 — « Insérer un trait » passe dans la bulle de mise en forme (2 novembre)

Opus seul (petit, contexte chargé). Demande de l'auteur : sortir « — Insérer un trait » du haut du bloc de texte.
- **Bulle de mise en forme** (`RichTextEditor.tsx`) : un bouton « — » après le spoiler. La bulle ne s'ouvre que sur une sélection, que la commande standard remplacerait : le trait se pose SOUS le bloc où finit la sélection, texte intact (`insertContentAt` après le bloc).
- **Ligne vide** (option b choisie par l'auteur) : un petit « — » apparaît au curseur dans un paragraphe vide (`FloatingMenu` de Tiptap, déjà chargé par le module de menus avec la bulle : aucune dépendance nouvelle).
- **Vérifié au navigateur** (Banc d'essai, fiche d'essai) : l'ancien bouton a disparu ; « — » dans la bulle insère un trait sans toucher au mot sélectionné ; « — » apparaît sur une ligne vide.

### V3.1-152 — « Lier tout » dans « Détecter des liens » (2 novembre)

Opus seul. Demande de l'auteur : retirer les mauvaises détections, puis lier le reste d'un coup.
- **Bouton « Lier tout (n) »** en bas de la liste, dès qu'il reste une proposition. Toutes les plages sont calculées avant toute modification, puis remplacées de la dernière à la première dans une seule transaction (un seul « Annuler ») ; deux propositions qui se chevauchent : la première gagne.
- **Vérifié au navigateur** : deux propositions, une ignorée, « Lier tout (1) » lie la restante et vide la liste.

### V3.1-153 — Le badge « Prochaine session » couché rail déplié, debout rail replié (2 novembre)

Opus seul. Esquisse « Prochaine session et fiche à créer » : proposition B, animation X, choisies par l'auteur. Revient sur le choix « vertical » de V3.1-9 pour le rail déplié seulement.
- **`NextSessionBadge`** reçoit `replie`. Déplié : une ligne du rail (icône dorée, « Prochaine session », date abrégée en doré). Replié : la même, debout (icône, date courte « dim. 8 nov. » à la verticale) — il ne disparaît plus. Les deux présentations sont superposées et se croisent en fondu pendant le changement de largeur du rail ; le texte ne pivote jamais. Coupé sous `motion-reduce`. Pastille rouge et téléphone inchangés.
- **Vérifié au navigateur** (Testeur B) : badge visible rail déplié et rail replié.

### V3.1-154 — PJ attribué sans fiche : sa carte et « Créer la fiche de … » (2 novembre)

Opus seul. Demande de l'auteur : remplacer la petite ligne « Aucune fiche de personnage pour cette entrée » par un dérivé de l'écran de choix.
- **Serveur** (`choixPersonnage.ts`) : la construction des cartes sort de `listCartesPersonnage` dans `cartesPourFiches` (mêmes lectures par lot, même filtre de visibilité) ; `getCartePersonnage` pour le PJ de la joueuse, lue par la page `/joueur` seulement quand il n'a pas de bloc `character`.
- **Carte partagée** `ContenuCartePersonnage.tsx` : le carrousel et le nouvel écran s'en servent, rien n'est recopié.
- **Écran** (`ParticipantCharacterSheet`) : « Ton personnage », la carte seule (halo d'accent), bouton « Créer la fiche de {prénom} » qui ouvre l'assistant comme avant. Libellés fr et en.
- **Vérifié au navigateur** (Testeur B, rattaché le temps du test à un PJ vide, puis remis sur le sien ; PJ d'essai supprimé) : carte avec la phrase, ancienne ligne absente, l'assistant s'ouvre.

### V3.1-94 — Règles : la règle au centre, renvois en volet, onglets (3 novembre)

Opus : la version maison (ADR 0072, choix de l'auteur : copie sous la même clé) et l'épinglage côté serveur ; `dev-sonnet` : l'écran ; `aide-haiku` : la planche ; relu et vérifié au navigateur par Opus.
- **Version maison** (`createHouseVersion`, route `POST /api/worlds/[worldSlug]/rules/house-version`, Zod, MJ) : copie de la règle (blocs de base traduits) dans la variante active, sous la même clé (`replace_entry`, déjà prévu, aucune migration) ; refusée sur une base officielle (règle 18, et par la RPC) ; seulement les cinq types qui ont un formulaire. Lue par la fiche ET par la mécanique ; « Modifier » la réécrit ; les blocs qui diffèrent portent « Modifiée dans ta variante ». Noyau `src/core/rules/houseVersion.ts` (testé).
- **Épingler au Bloc-notes** (`pinRuleToNotebook`, route `POST /api/worlds/[worldSlug]/notes/pin-rule`) : ajout côté serveur dans le cahier privé, écriture versionnée (relue et réessayée une fois, jamais d'écrasement), une seule fois par règle. Relevé par `dev-sonnet`, qui s'est arrêté plutôt que de réécrire le cahier depuis le client.
- **Écran** : plus de cadre d'illustration vide ; renvois soulignés en pointillé (`LienRegle`), ouverts dans le volet de droite ; bascule Officiel / Ta variante en lecture ; « Cette règle cite / Citée par » ; ⋮ (`lib/ui/regleEcran.ts`, testé) : épingler, copier le lien (l'adresse de la page : le wiki n'a pas de syntaxe textuelle de renvoi — retouche d'Opus), version maison, Modifier jamais sur une règle officielle.
- **Vérifié** : contre la base (`houseVersion.integration.test.ts`, 3/3 : refus sur base officielle ; copie, « Modifier » 1d8 → 1d12 lu par la mécanique, officielle intacte ; épinglage unique) ; au navigateur (MJ du banc d'essai, base officielle) : renvoi « Polyvalente » ouvert à droite sans changer l'Épée longue, ⋮ réduit à Épingler et Copier le lien.

*Restes* : la version maison n'a pas été créée au navigateur (le banc d'essai est sur la base officielle) ; le sommaire garde le nom officiel d'une version maison renommée ; revenir à l'officielle n'existe pas encore (ADR 0072).

### V3.1-95 — Règles : fenêtre étroite et page du joueur (3 novembre)

Opus : le filtrage côté serveur (faille trouvée en préparant le ticket) ; `dev-sonnet` : l'écran ; `aide-haiku` : la planche ; relu et vérifié au navigateur par Opus.
- **Faille corrigée** (registre de `SECURITE.md`) : la page joueur et la fenêtre d'une règle (`…/regles/[cle]/window`, lue aussi par la fiche et le cahier du joueur) envoyaient la fiche entière — données brutes du SRD, donnée officielle d'avant variante, marques du MJ — masquées seulement à l'écran. `getRuleEntryPageData` applique désormais `ruleEntryForPlayer` (`src/core/rules/ruleForReader.ts`, testé) à tout appelant qui n'est pas administrateur du monde ; `tableRule` dit seulement que la règle diffère de l'officielle.
- **Fenêtre étroite** (requête de conteneur, 48 rem) : un renvoi s'ouvre en panneau opaque de 340 px (`PanneauRenvoi.tsx`) par-dessus la page ; × ou Échap le ferme ; au-delà du seuil, volet de droite inchangé.
- **Page du joueur** : `SommaireRegles` avec un drapeau `joueur` (sans « Ajouter » ni bacs à sable, Récemment de l'espace `joueur-regles`) ; la règle sans ⋮ ni bascule ; badge « Règle de la table ». Téléphone inchangé (V3.1-30).
- **Vérifié** : contre la base (`houseVersion.integration.test.ts`, 4/4 : la réponse servie au joueur n'a ni données brutes ni `originalData`, celle du MJ si) ; au navigateur (MJ à 860 px : tiroir et panneau opaque ; Testeuse A : page sans ⋮ ni données brutes, rien dans le HTML reçu).

*Restes* : la colonne du sommaire joueur fait 176 px (gabarit partagé avec le wiki) au lieu de 250 ; le panneau de renvoi n'existe que dans la section Règles du MJ.

### V3.1-97 — Chronologie : le noyau pur (3 novembre)

`dev-sonnet` : le code et ses tests ; relu par Opus (retrait d'un champ toujours vide).
- **`src/core/timeline/view.ts`** (55 tests du dossier) : échelle (`xOfYear`, `yearOfX`, marge 110 px, `clampSpan` entre 20 ans et l'étendue du monde, `worldExtent`) ; niveau de détail (`detailLevel` : > 400 major ; 130–400 major + notable ; < 130 tout ; `summarizeView` compte les dates cachées ; `viewLabel`) ; graduations (250/100/50/10/5) ; rangement des cartes (186 px, alternance, « + n autour » avec sa plage — aucune date perdue, prouvé sur cinq étendues) ; ères en bandeaux coupées aux bords ; gestes purs (défiler ±12 %, ‹ › ±30 %, zoom ×1,25 / ×0,8 / ×1,6 autour d'un point, préréglages, centrer sur aujourd'hui).
- Le noyau reçoit des points `{ id, year, scope }` : l'écran calcule l'année (`yearPosition`) et la portée (`resolveScope`).
- Choix non tranchés par le ticket : seuils 400 et 130 inclus dans « major + notable » ; libellés des niveaux autres que « tout » (« grandes dates et notables », « grandes dates seulement »).


### V3.1-98 — Chronologie : la frise du MJ (3 novembre)

`dev-sonnet` : l'écran ; Opus : le serveur et un correctif ancien.
- **Serveur (Opus)** : `getWorldTimeline(…, { vueJoueurs })` passe par `resolveMapViewer` (refusé à un non-MJ) ; chaque entrée porte son bloc (`block: { id, version }`, nul pour naissances et morts) pour la portée et la promotion.
- **Écran** : `WorldTimelineView.tsx` réécrit, `components/shell/frise/` (carte, formulaire, ères), `lib/ui/frise.ts` (testé), `lib/ui/friseApi.ts`. Fleuve, ères, aujourd'hui, cartes alternées ; barre (vue, compteur des dates cachées, − / +, préréglages, Centrer, ‹ ›, filtres, recherche) ; molette, Ctrl + molette, glisser, pincer ; « Voir comme les joueurs » par `?vue=joueurs` (le serveur retire les dates du MJ) ; + Événement, Ères… (route calendrier), portée et visibilité au toucher, « → en faire une fiche ». Rafraîchissement par une action `revalidatePath` (cliquet du câblage).
- **Correctif** : `promoteTimelineEntry` créait la fiche avant de vérifier la version du bloc ; un conflit laissait une fiche orpheline. Version vérifiée d'abord, fiche retirée si l'écriture échoue ; test d'intégration.
- **Vérifié** : contre la base (`worldTimeline.integration.test.ts`, 5/5) ; au navigateur avec le MJ du banc d'essai (ajout par le formulaire, seuils de vue, Ctrl + molette sans défilement de la page, vue des joueurs sans la date MJ, portée, visibilité, promotion, panneau des ères, 700 px sans débordement). Données de test supprimées.
- **Catalogue** : section « Frise du monde » de `WikiVisuel` (version 85).

*Restes* : « Dans : une fiche » ne propose que les fiches qui ont déjà une chronologie ; la visibilité relit tout le bloc (deux allers-retours) ; enregistrer des ères n'a pas été essayé au navigateur (route existante).

### V3.1-99 — Chronologie : la page des joueurs (3 novembre)

`dev-sonnet` : la page et le rail ; Opus : le test serveur et un correctif.
- **Page** : `app/m/[worldSlug]/joueur/chronologie/page.tsx`, la frise du 98 avec `estMj={false}` ; le serveur ne renvoie que les dates visibles du lecteur. Route hors de `/joueur/wiki/` : une fiche nommée « chronologie » y serait masquée.
- **Accès** : rail du joueur (`PlayerShell`, après Wiki, icône `frise`) ; au téléphone, lien « Chronologie › » en tête de l'accueil du Wiki ; préréglages en pilules sous la frise sous 768 px (frise du MJ comprise).
- **Correctif de Sonnet** : les liens d'une carte menaient à la route du MJ (`/f/…`) ; ils mènent au wiki du joueur (`baseFiche`).
- **Correctif d'Opus** : le formulaire de la frise ne propose plus « Privé » — une date ne retient pas son auteur, le filtre la refusait à tout le monde, MJ compris.
- **Vérifié** : contre la base (`worldTimeline.integration.test.ts`, 6/6 : la joueuse ne reçoit ni date MJ ni date privée, pas même dans le JSON) ; au navigateur avec la Testeuse A (ordinateur et 390 px : date MJ absente du HTML reçu, aucun outil du MJ, rail actif, lien de l'accueil Wiki, aucun débordement ; au doigt, glisser défile et pincer zoome de 390 à 78 ans). Données de test supprimées.
- **Catalogue** : vue joueur dans « Frise du monde » (`WikiVisuel`), entrée du rail joueur (`Navigation`), version 86.

*Restes* : glisser ne part pas d'une carte (seulement du fond de la scène) ; l'accueil du Wiki joueur au téléphone n'a pas de planche.

### V3.1-129 — Le noyau des règles jouables (3 novembre)

Opus, tests d'abord ; planche par `aide-haiku`.
- **Blocs de règle** (`src/core/schemas/rule-blocks/playable.ts`, ADR 0060) : `resources`, `activation` (avec `durable_effects`, variantes, jetons ; un `apply_effect` qui vise un effet absent du bloc est refusé), `coverage`. `apply_effect` rejoint `EffectNode`, `ResolvedEffect` et `zEffect` ; `resolveEffectList` résout une liste sans chaîne de déclencheurs. Le tour (`turn.ts`) rapporte un `apply_effect` comme non posé, jamais en silence.
- **Fiche** : `characterSheet().resources`, calculées depuis les aptitudes (`ResolvedFeature.resources`) et les objets équipés (liés s'ils le demandent). Références : `level`, `class.level` et `column.<clé>` (classe qui accorde, dernière ligne de progression atteinte), `proficiency`, `ability.*`, `spell_save_dc`. Même clé deux fois : le plus grand maximum. Formule incalculable : 0 et un avertissement. Le serveur fournit ressources et colonnes (`progressionColumns`) sans requête de plus.
- **Fonctions pures** : `planActivation` (prérequis, ressources tout ou rien avant le moindre dé, cibles, budget payé sans bloquer, effets par cible, effets qui durent ancrés) ; `expireEffects` (début de tour de la source, fin de tour, repos et avance du temps — un repos fait passer 1 h ou 8 h —, événements, concentration, « au choix ») ; `consumeToken` ; `coverageState` ; `activeEffectsForSheet` (couche 7).
- **Recharge des créatures** : `creatureRecharge.ts` (lecture du seuil dans le nom ou le texte, clé stable, d6) ; migration `20261103120000` (`combat_participants.resources_used`) ; d6 du serveur au début du tour de l'instance et par « Recharge d6 » (`POST …/participants/[id]/recharge`), journalisé et annulable ; fiche de créature : pastille Prête / Dépensée, bouton Recharge d6, pastilles estompées.
- **Vérifié** : critères en tests (Paladin 9 → 2 Conduits divins, Abjuration à `Rng` fixe, Effrayé aux dégâts et à 10 rounds, jeton, refus sans ressource, recharge par instance) ; contre la base (`creatureCombat.integration.test.ts`, 2/2 : instance par instance, d6 à 3 puis 5, annulation, jet au début du tour) ; au navigateur (MJ du banc d'essai, deux dragonnets). Données de test supprimées.
- **Catalogue** : « Fiche de créature » (`OutilsMJ`), version 87.

*Restes* : le jet de recharge est noté au journal du combat, pas dans `dice_rolls` ; le service `activateFeature` et les effets actifs en base viennent avec V3.1-130 ; les données du SRD (Conduit divin, etc.) avec V3.1-133.

### V3.1-130 — Activer une règle et faire durer ses effets (3 novembre)

Opus. Choix de l'auteur : les effets se rangent **par instance de combat** (ADR 0073).
- **Migration `20261103130000`** : `entity_active_effects` accepte `feature`, `payload`, et un porteur entité OU instance (`combat_participant_id`) ; politique MJ seulement pour une instance ; `apply_engine_change` gagne `effect_add` et `effect_remove` ; `engine_read_combat_effects` (lecture signée).
- **Service** `featureActivation.ts` et route `actions/activate` (Zod, `canEditEntity` par la garde commune, règle possédée par le personnage) : `planActivation` avec les dés du serveur ; usages dans l'état de jeu ; effets immédiats et états par `applyResolvedEffects` (direct pour le MJ, signé pour un joueur) ; effets qui durent par PJ ou par instance ; concentration posée.
- **Expiration** `effectExpiry.ts` : décision du noyau (`expireEffects`), écriture ici ; branchée sur la bascule de tour (fin de tour, fin de round, début de tour), les dégâts subis, la concentration rompue et les repos ; un effet retiré emporte ses états (sauf s'ils sont tenus par un autre) et se journalise.
- **Fiche** : les effets portés par le personnage entrent en couche 7 (une lecture de plus, dans la même vague).
- **Vérifié** contre la base (`featureActivation.integration.test.ts` 5/5) : Abjuration sur deux gobelins (1 Conduit divin, sauvegardes au détail du MJ, effets par instance, tout relu) ; quatrième cible et ressource épuisée refusées sans écriture ; Effrayé retiré aux dégâts avec son état ; effet de concentration compté sur la fiche puis retiré à la rupture ; joueur sans droit refusé, insertion directe sur une instance refusée.
- **Docs** : SCHEMA §12.2, specs/regles-blocs.md §5, SECURITE (registre), QUOTAS.

*Restes* : `characterSheet()` n'applique pas les modificateurs `add` aux sauvegardes (tâche proposée à part) ; le budget d'action de la table n'est pas tenu en base (la boucle du solo le tiendra) ; les jets de sauvegarde vont au journal (détail du MJ), pas dans `dice_rolls` ; l'application n'est pas une transaction unique (le chemin signé l'est, l'écriture directe du MJ se fait en plusieurs requêtes) ; les libellés d'état restent des clés (« frightened ») au journal des joueurs.

### V3.1-131 — La fiche jouable : un bouton par activation (4 novembre)

`dev-sonnet` : l'écran ; Opus : les données, deux correctifs, la vérification.
- **Planche** « Esquisse · Règle jouable — En jeu » décidée par l'auteur avec trois ajustements : pas de « budget du tour » (non tenu en base) ; « Sur la scène » = les effets que porte le personnage et ses jetons (un joueur ne lit pas ceux d'un monstre, ADR 0073) ; une joueuse ne voit que le verdict d'une sauvegarde, le MJ voit aussi le jet et le DD (ADR 0070).
- **Données (Opus)** : les aptitudes portent leur bloc `activation` (lu avec les blocs déjà chargés) ; la route de la fiche renvoie les effets portés (`effects`) ; l'activation rend un résultat par cible (`save` au MJ seulement). Aucun chargement de plus à l'ouverture (cliquet du câblage inchangé).
- **Écran** : `ActivationsPanel.tsx`, `lib/ui/activationFiche.ts` (pur, testé), `lib/ui/activationApi.ts` ; ressources en pastilles ; une carte par activation (coût, cibles, DD, durée), bouton désactivé avec sa raison ; cibles par cases à cocher, combat lu au clic ; résultat par cible ; « Sur la scène » (durée en rounds, minutes ou heures, concentration, jetons). Les compteurs manuels restent.
- **Correctifs (Opus)** : la fiche calculée dans le navigateur ignorait les effets (la CA ne prenait pas « +1 ») — ils passent désormais par `useCharacterSheetContext` ; relancer une concentration de même nom empilait l'effet — le service retire d'abord les effets de la concentration précédente (test d'intégration ajouté).
- **Vérifié** : `featureActivation.integration.test.ts` 5/5 ; au navigateur avec la Testeuse A dans un monde de test isolé (variante rendant jouables le Conduit divin et Abjuration d'ennemis, Paladin 9, quatre gobelins) : Veille sacrée (CA 10 → 11, concentration), Abjuration sur deux gobelins par l'écriture signée (Effrayé par instance en base, verdict seul à l'écran), Conduit divin 2 → 1 → 0 et bouton désactivé ; au téléphone (390 px) sans débordement. Monde de test supprimé.

*Restes* : le parcours du MJ n'a pas été rejoué au navigateur (les chiffres du MJ sont testés : service et `ligneResultat`) ; les activations accordées par un jeton s'affichent mais ne se jouent pas encore (le service exige une règle possédée) ; la page « Édition » et la fiche du wiki n'ont pas de campagne : on n'y joue pas une règle (comme les autres jets).

---

### V3.1-132 — L'éditeur de briques et l'état de couverture (4 novembre)

Détail dans [`12-regles-jouables.md`](12-regles-jouables.md). Noyau et serveur par Opus, écran par `dev-sonnet`, relu par Opus.

- **Noyau** : citations facultatives par brique (`passage`, `passages` indexés par `brickPaths`), `coverageSummary`, `pruneOrphanDurableEffects`, `applyOverrideFacts`.
- **Serveur** : `savePlayableBlocks` écrit dans la variante du monde (`add_block`, `replace_block` ou `remove_block` selon la règle d'en dessous ; version maison réécrite d'un tenant ; refus sans variante) ; `listUnplayableRules`, `listDeclaredResources`, `unplayableAmong` ; routes MJ `rules/playable` et `rules/resources`.
- **Écran** : éditeur dans la fiche de règle, rendu des trois blocs, badge de couverture, page « Règles non jouables », bandeau du mode solo.
- **Vérifié** : `rulePlayableBlocks.integration.test.ts` 3/3 ; au navigateur, Abjuration d'ennemis saisie par le MJ et jouée par la Testeuse A.

*Restes* : l'aperçu du bouton montre les formules brutes ; `apply_modifier` ignoré par le tour du moteur (V3.1-134) ; condition d'accès, jetons et modificateurs d'un effet qui dure conservés mais pas saisissables.

---

### V3.1-133 — Les données : le quotidien du SRD rendu jouable (7 novembre)

Détail dans [`12-regles-jouables.md`](12-regles-jouables.md). Par Opus.

- **Données** : `data/srd/playable-2024.json` — Second souffle, Fougue, Conduit divin (Paladin, Clerc), Abjuration d'ennemis ; ce qui attend 134, 135, 136, 137 ou 138 va en `coverage`.
- **Import** : `ingest-srd` lit et valide les trois blocs (SRD 2024 seulement) ; réimport fait, aucun échec.
- **Moteur** : `class.level` dans le contexte d'activation (`grantingClassLevel`).
- **Écran** : le résultat d'une capacité sur soi dit ce qui a changé.
- **Vérifié** : `srdPlayableData.test.ts`, `srdPlayable.integration.test.ts` 4/4, et au navigateur (Testeuse A et MJ, monde isolé sur l'officiel).

*Restes* : Fougue n'ajoute l'action qu'au journal (pas de budget d'action en base à la table) ; Fougue et Abjuration s'affichent « Partielle », honnêtement.

### V3.1-186 — Le quota de journaux ingérés de Supabase (3 novembre)

Opus seul. Constat de l'auteur : le tableau d'usage Supabase montre « Log Ingestion » à 0,99 Go sur 1, avec des pics les jours de travail avec Claude.
- **Cause probable** : chaque requête est journalisée par chaque service qu'elle traverse ; les suites d'intégration complètes (68 fichiers contre la vraie base) et les mesures de câblage font les pics. Aucune migration n'active de journalisation Postgres en plus.
- **Disponibilité** : quota marqué « Upcoming », facturation et restriction annoncées pour début 2027.
- **`QUOTAS.md`** : ligne « Journaux ingérés » au tableau Supabase, réflexe **T6** (« les journaux suivent les requêtes »).
- *Reste, hors de ce ticket* : avant 2027, une base locale pour les tests d'intégration serait la vraie réponse.
