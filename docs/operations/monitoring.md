# Surveillance des produits

Le Control Center **prévient** quand un produit cesse d'envoyer ses métriques. Avant, la
fraîcheur n'était qu'affichée : Séjoura est resté 3 semaines sans déploiement et Schooly n'a rien
envoyé depuis le 20/09 sans que personne ne soit informé.

## Fonctionnement
Toutes les 30 minutes, le workflow GitHub `Surveillance des produits` appelle
`POST /api/monitoring/check`. La route compare chaque produit surveillé à son délai attendu
(`src/lib/freshness.ts` : alerte au-delà de **2 × la cadence d'envoi**).

| Constat | Gravité | Condition |
|---|---|---|
| `stale` | avertissement | pas d'envoi depuis plus de 2 × la cadence |
| `stale` | **critique** | pas d'envoi depuis plus de 6 × la cadence |
| `missing` | **critique** | aucune ligne, ou date de synchronisation illisible |
| `unhealthy` | **critique** | le produit déclare lui-même un état critique |

**Anti-spam** : un même constat n'est renotifié qu'après 24 h. Une aggravation (avertissement →
critique) notifie tout de suite. Quand le produit redevient normal, **un** message « de nouveau à
jour » est envoyé. Une alerte dont aucune livraison n'a réussi est retentée au passage suivant.

**Canaux** : notification push dans l'application, Telegram si configuré, et trace dans la table
`telegram_alerts` (visible dans la supervision) dans tous les cas.

## Mise en route (une fois)
1. Générez un secret : `openssl rand -hex 32`.
2. **Vercel**, projet *Control Center*, environnement Production : variable `MONITORING_SECRET` = ce secret. Redéployer.
3. **GitHub**, dépôt *refontiq-control-center* → Settings → Secrets and variables → Actions : secret `MONITORING_SECRET` = **la même valeur**.
4. (Facultatif) Telegram : `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans Vercel.
5. Lancer le workflow à la main (Actions → Surveillance des produits → Run workflow) et lire le résumé.

Ce secret est **dédié** : ne réutilisez ni `METRICS_PUSH_SECRET` ni `CRON_SECRET`.

## Ajouter un produit à la surveillance
Dans `src/lib/monitoring.ts`, ajouter son identifiant à `MONITORED_PROJECTS` **seulement quand il
envoie réellement** ses métriques, et déclarer sa cadence dans `src/lib/freshness.ts`. Sinon l'alerte
serait permanente.

## Limites connues
- GitHub peut retarder une exécution planifiée de quelques minutes, et **désactive les workflows
  planifiés d'un dépôt sans activité pendant 60 jours** : un commit ou un lancement manuel le réactive.
- Telegram n'est pas configuré aujourd'hui (la table des alertes est vide) : sans lui, l'alerte arrive
  par notification push dans l'application, qui exige une souscription préalable.
- Si le Control Center est lui-même en panne, c'est l'**échec du workflow** (e-mail GitHub) qui prévient.
- Dette connue : la route d'ingestion `/api/telegram-alerts/ingest` enregistre le niveau `error`, interdit
  par la table (info, warning, critical, success) : elle échoue à chaque alerte d'erreur. À corriger séparément.
