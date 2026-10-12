# Rester dans les plans gratuits (Vercel Hobby, Supabase Free)

**À quoi sert ce document.** CreaDonjon tourne sur deux plans gratuits. Si l'un d'eux déborde, il ne facture rien : **il coupe**. L'app tombe alors pour toute la table, jusqu'au mois suivant ou jusqu'à un passage au plan payant. C'est arrivé une fois : les anciens tests créaient un compte par exécution (`SECURITE.md` §3, 10 octobre). Ce document dit **ce qui est compté**, **ce qui le consomme dans notre code** et **les réflexes à avoir**.

**Quand le lire :**
- avant tout ticket qui ajoute un chargement, une route, un sondage, un abonnement temps réel, des images ou une tâche planifiée ;
- avant de lancer des tests, des mesures ou des scripts contre la vraie base.

Le skill `deleguer` l'impose aux sous-agents.

Les chiffres ont été relevés le 11 octobre 2026 dans la documentation officielle (liens en bas). Ils changent : **relis la source avant de te fier à un chiffre**, et mets ce tableau à jour.

---

## 1. Ce qui est compté

### Supabase, plan Free

| Ressource | Limite | Ce qui la consomme chez nous |
|---|---|---|
| Taille de la base | 500 Mo par projet | Le SRD importé (deux éditions, traductions, blocs), le wiki, le journal de session, `ai_usage_log`, les vecteurs (`pgvector`) |
| **Sortie réseau (egress)** | **5 Go par mois** (+ 5 Go en cache), partagés par toute l'organisation | Chaque réponse de la base vers le serveur Next ou le navigateur : listes de règles, fiches, images du stockage |
| Stockage de fichiers | 1 Go, 50 Mo par fichier | Portraits, images de blocs, fonds de page, cartes |
| Utilisateurs actifs par mois | 50 000 | Chaque compte qui se connecte dans le mois, comptes de test compris |
| Temps réel | 200 connexions simultanées, 2 millions de messages par mois | Le chat, les messages non lus, les jets de dés (un abonnement par onglet ouvert) |
| Fonctions Edge | 500 000 appels par mois | Aucune aujourd'hui |
| Projets actifs | 2 | La vraie table ; aucun projet de test séparé |
| **Inactivité** | **Pause après 1 semaine sans activité** | Rien à faire en jeu ; à surveiller pendant une longue pause de la campagne |
| Sauvegardes | Aucune sauvegarde automatique | Nos exports, faits à la main |

**Au-delà d'une limite**, Supabase prévient par email, puis laisse un délai de grâce. Ensuite il restreint **toute l'organisation**, jusqu'au prochain cycle de facturation :
- projets mis en pause ;
- base en lecture seule ;
- requêtes refusées en HTTP 402.

Il n'y a **pas de second délai de grâce** si l'on déborde à nouveau.

### Vercel, plan Hobby

| Ressource | Inclus par mois | Ce qui la consomme chez nous |
|---|---|---|
| **Appels de fonction** | **1 000 000** | Chaque rendu de page serveur et **chaque appel `/api`** : une fiche de personnage en lançait 44 avant V3.1-62 |
| **Temps CPU actif** | **4 heures** | Le calcul des routes : assemblage du ruleset, fiche dérivée, résolution des blocs |
| Mémoire provisionnée | 360 Go·h | La durée des fonctions × leur mémoire (une route qui attend la base longtemps coûte aussi) |
| Transfert rapide (navigateur ← Vercel) | 100 Go | Pages, scripts, réponses JSON |
| Transfert d'origine | 10 Go | Les réponses qui ne viennent pas du cache |
| Optimisation d'images | 5 000 transformations | Aucune : nous n'utilisons pas `next/image` |
| Déploiements | 100 par jour, un à la fois | Chaque poussée sur `master`, chaque branche avec aperçu |
| Durée de construction | 45 min par déploiement | `npm run build` |
| Journaux | gardés 1 heure | Un incident se diagnostique vite, ou pas du tout |
| Usage | **personnel, non commercial** | Aucune publicité, aucun paiement, aucun don détourné en vente |

**Au-delà**, Vercel peut mettre le déploiement **en pause** après un usage « durable » hors limites. En général, il prévient d'abord. La reprise se fait projet par projet, à la main, après avoir réduit la consommation ou changé de plan.

## 2. Les réflexes, dans notre code

Chaque réflexe renvoie à une règle déjà écrite ailleurs. Ce sont les mêmes règles : la rapidité et les quotas vont dans le même sens.

**Q1. Moins d'appels `/api`.** Chaque appel est une fonction Vercel (appel compté, CPU, mémoire) **et** plusieurs requêtes Supabase (sortie réseau). Les règles C1 et C2 de `CABLAGE.md` sont aussi des règles de quota : données avec la page, une donnée partagée chargée une fois par écran, demandes simultanées regroupées (`lib/chargement/chargeurParLots.ts`).

**Q2. Pas de sondage périodique sans raison écrite.** Un `setInterval` qui appelle le serveur toutes les 4 s, sur un onglet oublié, fait environ 650 000 appels par mois : les deux tiers du quota Vercel. Préférer le temps réel de Supabase pour ce qui change rarement. Si un sondage est indispensable :
- il s'arrête quand l'onglet est caché (`document.visibilityState`) ;
- il dit son intervalle et sa raison en commentaire.

Aujourd'hui, seul le mode solo sonde (superadmin seulement).

**Q3. Un abonnement temps réel par besoin, refermé au démontage.** Chaque `channel()` ouvert compte dans les 200 connexions simultanées. Un abonnement filtre côté serveur (`filter`) au lieu de recevoir toute une table.

**Q4. Ne lire que les colonnes utiles.** `select("*")` sur une table de règles envoie des blocs entiers et leur prose : c'est de la sortie réseau facturée au quota. Lister les colonnes ; dans une colonne JSON, extraire les seuls champs utiles (`source_raw->name`). Filtrer par type côté base plutôt qu'après réception. Paginer toute liste qui peut grandir.

*Cas réel, 11 octobre* : chaque ouverture de l'Initiative transportait 4,9 Mo (deux fois le texte SRD complet de 1 907 entrées), soit un millier d'ouvertures pour épuiser les 5 Go du mois. Chaque affichage de la fiche d'un Guerrier en transportait autant. Après correction : 65 ko et 10 ko (`docs/CABLAGE.md` §3).

**Q5. Les images restent légères, et ne laissent rien derrière elles.** Les images vont dans le **stockage de fichiers** (1 Go), pas dans la base (500 Mo) : la base n'en garde qu'une ligne de description (`assets`).

*Ce que fait déjà l'app, à garder pour toute image nouvelle.* Tout envoi passe par `uploadAsset` (`src/server/services/assetUpload.ts`), qui, sur le serveur, avec `sharp` :
1. n'accepte que PNG, JPEG et WebP, et refuse un fichier qui n'est pas vraiment une image ;
2. **réduit** l'image à la taille utile de son usage, sans jamais l'agrandir ;
3. la **réencode en WebP**, qualité 85 (perte invisible à l'œil).

| Usage | Côté le plus long | Fichier reçu au plus | Poids typique stocké |
|---|---|---|---|
| Portrait | 640 px | 5 Mo | ≈ 30 ko |
| Image de bloc | 1600 px | 5 Mo | ≈ 170 ko |
| Fond d'écran | 1920 px (+ vignette 64 px en base, ≈ 1 ko) | 5 Mo | ≈ 220 ko |
| Carte | 4096 px, **plus** une vignette de 1600 px | 25 Mo | ≈ 540 + 170 ko |

*Mesuré le 12 octobre* (`sharp` 0.35.5, réglages de l'app) : une carte PNG de 19,6 Mo (5760 px) devient 537 ko ; une photo JPEG de 1,2 Mo devient 28 à 539 ko selon l'usage. À ≈ 200 ko par image, 1 Go tient environ 5 000 images.

*Les réflexes :*
- **Une image nouvelle passe par `uploadAsset`** avec une `maxDimension` choisie pour son affichage réel. Jamais d'envoi direct au stockage, jamais l'original gardé « au cas où ».
- **Remplacer ou supprimer une image efface l'ancien fichier** (`deleteAsset`, qui retire la ligne `assets` *et* le fichier). Un fichier sans ligne qui le désigne est un orphelin : invisible dans l'app, il occupe le stockage pour toujours. Portraits, images de blocs et fonds d'écran le font (V2-L1). **Pas encore les cartes** : en remplacer une ou supprimer son bloc laisse ses deux fichiers (≈ 700 ko). Ticket V3.1-128.
- **Une image ne part pas dans la base**, ni en `data:` dans une colonne JSON, sauf une vignette de quelques ko : la base est le quota le plus petit.
- **Pas de `next/image`** : son optimisation compte dans les 5 000 transformations mensuelles de Vercel, et l'app réduit déjà ses images à l'envoi.
- **Les images s'affichent par `/api/assets/[id]`**, redirection mise en cache vers une adresse signée : chaque affichage est de la sortie réseau, d'où l'intérêt de fichiers légers.

**Q6. Les valeurs dérivées ne sont jamais stockées** (règle absolue 16). C'est aussi une règle de place : la base reste petite.

**Q7. Les journaux se purgent.** `ai_usage_log`, `session_events`, `dice_rolls` grandissent à chaque partie. Tout nouveau journal dit dans `SCHEMA.md` combien de temps il garde ses lignes, ou pourquoi il les garde toutes.

## 3. Les réflexes, quand on teste et mesure

Les tests, les mesures et les scripts tournent **contre la vraie base**, celle de la table. Ils consomment donc les mêmes quotas.

**T1. Jamais de compte neuf.** Les tests d'intégration utilisent le groupe fixe (`docs/TESTS.md` §2), les vérifications à la main le Banc d'essai (§3).

**T2. Pas de suite complète en boucle.** Une exécution complète de `npm run test`, tests d'intégration compris, fait quelques milliers de requêtes. Pour itérer, on lance le seul fichier concerné, et la suite complète avant de pousser.

**T3. Les mesures de câblage coûtent.** Un passage de `scripts/mesure-cablage.mjs` charge neuf écrans quatre fois : environ 2 000 requêtes à la base. On mesure avant et après une correction, pas à chaque essai.

**T4. Les scripts d'import se lancent rarement.** `npm run ingest:srd` réécrit des milliers de lignes, et il efface ce qu'il ne connaît pas : relancer ensuite les scripts qu'il rappelle. On ne le lance que pour une raison écrite.

**T5. Les sessions de vérification se ferment.** Une session cloud qui garde `npm run dev` ouvert ne consomme rien chez Vercel, mais garde des abonnements temps réel et des requêtes vers Supabase. On arrête le serveur à la fin.

## 4. Surveiller

- **Une fois par mois, et avant une séance importante** : le tableau d'usage de Supabase (*Organization › Usage*) et celui de Vercel (*Usage*). Repérer ce qui approche 80 %.
- **Supabase prévient par email** quand une limite approche. Un tel email est une **alerte de panne prochaine** : on regarde le jour même ce qui consomme.
- **Une hausse sans raison** se diagnostique avec les outils de `CABLAGE.md` (§2) : quel écran fait le plus de requêtes, quelle route est la plus appelée.

## 5. Où cette règle est appliquée

- `CLAUDE.md` : la ligne de ce document dans le tableau, et la méthode de travail.
- `docs/CABLAGE.md` : chaque requête évitée est aussi du quota épargné.
- `docs/TESTS.md` : les comptes fixes et la sobriété des tests.
- `docs/SECURITE.md` §1 : « l'usage lui-même » fait partie du modèle de menace (faire tomber l'app pour tout le monde).
- Skill `deleguer` : le brief d'un ticket concerné cite ce document.

## Sources

- Vercel, [Limits](https://vercel.com/docs/limits) et [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (mises à jour du 14 et 16 septembre 2026).
- Vercel, [Why has my account or deployment been paused?](https://vercel.com/kb/guide/why-is-my-account-deployment-blocked).
- Supabase, [Pricing](https://supabase.com/pricing) et [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq).
