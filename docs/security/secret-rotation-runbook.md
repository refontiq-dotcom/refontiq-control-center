# Runbook — rotation de secrets exposés

Ce document est **générique** : il ne contient ni valeur, ni emplacement précis d'un
secret. Les dépôts Refontiq sont publics ; décrire publiquement où se trouve un secret
exposé reviendrait à le désigner. La liste des incidents en cours se tient hors du dépôt.

## Principe

1. **Un secret apparu dans un dépôt public est compromis**, même supprimé du dernier
   commit : l'historique Git, les forks et les caches le conservent.
2. **On régénère d'abord, on nettoie ensuite.** Réécrire l'historique ne rend pas un
   secret à nouveau confidentiel ; seule la rotation le fait.
3. **On change l'ordre « ajouter, basculer, révoquer »** quand le service le permet,
   pour ne pas créer d'interruption.

## Procédure par type de secret

### Clé Supabase `service_role` (ou clé secrète `sb_secret_…`)
Elle contourne toutes les politiques RLS : c'est le secret le plus grave.
1. Supabase → Project Settings → API Keys : créer une nouvelle clé secrète, **ou**
   renouveler le JWT secret (invalide aussi les anciennes clés `anon` et `service_role`).
2. Mettre la nouvelle valeur dans les variables Vercel du projet (Production, Preview).
3. Redéployer, puis vérifier une route qui lit avec le rôle de service.
4. Désactiver / supprimer l'ancienne clé.
5. Contrôler les journaux d'accès Supabase sur la période d'exposition.

### Jeton de bot Telegram
1. BotFather → `/revoke` (ou `/token`) pour le bot concerné → nouveau jeton.
2. Mettre à jour la variable d'environnement correspondante (Vercel, secrets GitHub si utilisés).
3. Envoyer une alerte de test et confirmer sa réception.

### Clés d'intégration Trouvetou (`tv_live_…`)
1. Générer une nouvelle clé pour le fournisseur concerné (routes de rotation du Control
   Center ou script de rotation du produit) : seule l'empreinte est stockée côté Trouvetou.
2. Mettre la nouvelle clé dans l'environnement du produit émetteur.
3. Lancer une synchronisation et vérifier qu'elle est acceptée ; l'ancienne clé doit être refusée.

### Secrets inter-services (`METRICS_PUSH_SECRET`, `CRON_SECRET`, secrets de commande)
1. Générer une valeur aléatoire d'au moins 32 octets (`openssl rand -base64 32`).
2. La poser des **deux côtés** (émetteur et récepteur) avant de retirer l'ancienne lorsque
   le récepteur accepte deux valeurs ; sinon prévoir une courte fenêtre de maintenance.
3. Vérifier un envoi authentifié, puis un envoi avec l'ancienne valeur (doit être refusé).

### Jeton d'accès personnel GitHub
Révoquer dans GitHub → Settings → Developer settings → Personal access tokens, dès la fin
de l'opération pour laquelle il a été créé. Préférer un jeton à durée courte et à portée minimale.

## Après la rotation
- Confirmer que **l'ancienne valeur est refusée** (preuve de rotation effective).
- Consigner la date, le périmètre et la personne responsable, sans écrire la valeur.
- Activer l'analyse de secrets (GitHub secret scanning + push protection) sur chaque dépôt.
- Décider si l'historique doit être purgé (`git filter-repo` puis force-push) : opération
  destructrice, à n'engager qu'après rotation et avec accord explicite.
- Envisager de passer les dépôts en privé.

## Prévention
- Aucun secret dans le code, les `.md`, les scripts d'exemple ni les captures.
- Fichiers d'exemple (`.env.example`) : noms de variables uniquement.
- Les `docs/` décrivent les secrets **par leur nom**, jamais par leur valeur.
