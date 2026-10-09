# 0051 — Le retour de « voir comme » reprend sa propre session, jamais un identifiant

**Date :** 2026-10-09
**Statut :** acceptée (faille trouvée en préparant V3.1-12)

## Contexte

« Voir comme » posait un cookie httpOnly `view_as_admin_uid` qui contenait l'**identifiant** du superadmin. Au retour, la route `/api/admin/return-from-view-as` lisait ce cookie, vérifiait que l'identifiant était superadmin (service role), puis fabriquait un lien de connexion pour ce compte. Elle ne contrôlait ni la session ni une signature.

httpOnly empêche seulement le JavaScript de la page de lire le cookie. N'importe qui peut envoyer `Cookie: view_as_admin_uid=<identifiant>`. Connaître l'identifiant du superadmin, une donnée qui n'est pas secrète, suffisait donc pour se connecter à son compte. Le ticket V3.1-12 proposait en plus de retirer la condition superadmin du retour, ce qui aurait étendu la faille à tous les comptes.

## Options envisagées

- **A.** Signer le cookie (HMAC avec un secret serveur). Il faut un secret de plus, et le retour fabrique toujours un lien de connexion par service role.
- **B.** Stocker un jeton aléatoire côté serveur. Il faut une table, donc une migration.
- **C.** Mettre de côté le **jeton de rafraîchissement** de la propre session de l'appelant, et le reprendre au retour.

## Décision

C. Au départ, la session de l'appelant est renouvelée (`refreshSession`), et son jeton de rafraîchissement va dans un cookie httpOnly `view_as_return` (`secure` en production, `sameSite=strict`, une heure). Renouveler d'abord donne un jeton d'accès frais : le middleware ne consommera pas le jeton mis de côté pendant la bascule.

Au retour, `signOut({ scope: "local" })` révoque la session empruntée, puis `refreshSession({ refresh_token })` reprend la sienne. Le jeton ne se forge pas. Il n'y a plus de service role ni de condition de rôle sur ce chemin. `mintSessionForOwnAccount` et `isSuperadminByIdViaServiceRole` sont supprimées.

## Conséquences

Le retour marche à l'identique pour un superadmin et pour un MJ, ce que demandait l'étape 3 de V3.1-12, sans élargir quoi que ce soit. Un « voir comme » en cours avec l'ancien cookie ne peut plus revenir : la personne se reconnecte. Si la session d'origine a été fermée entre-temps (déconnexion ailleurs), le retour échoue proprement et demande de se reconnecter.
