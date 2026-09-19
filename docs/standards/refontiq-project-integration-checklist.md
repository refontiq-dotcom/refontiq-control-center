# Checklist réutilisable — intégration d'un projet Refontiq au Control Center

> **Modèle de référence : Séjoura + Schooly.**
> 
> Trouvetou sert uniquement de référence pour le module de trafic.

## 0. Identification du projet

- [ ] Nom du projet défini
- [ ] Identifiant technique défini
- [ ] Repository GitHub créé
- [ ] Projet Vercel créé ou relié
- [ ] Projet Supabase créé si nécessaire
- [ ] URL de production définie
- [ ] Projet ajouté à `src/lib/projects.ts` dans Refontiq Control Center

## 1. Architecture Refontiq

- [ ] Le projet suit le modèle **Projet → Refontiq Control Center**
- [ ] Refontiq Control Center est le seul **Super Admin global**
- [ ] Aucun Super Admin global local n'est créé
- [ ] Aucun menu, route ou page de Super Admin global local n'est exposé
- [ ] Les rôles locaux sont limités aux besoins opérationnels du produit
- [ ] Les accès Super Admin éventuels sont redirigés vers le Control Center

## 2. Connexion sécurisée au Control Center

- [ ] `CONTROL_CENTER_URL` configuré
- [ ] `METRICS_PUSH_SECRET` configuré
- [ ] Secret identique entre le projet et le Control Center
- [ ] Secret utilisé uniquement côté serveur
- [ ] Aucun secret exposé dans le navigateur
- [ ] Les endpoints entrants vérifient l'authentification
- [ ] Les payloads sont validés avant traitement

## 3. Contrat de supervision

Définir avant de coder ce que le Control Center doit recevoir.

- [ ] Identité du projet
- [ ] État de santé / disponibilité
- [ ] Métriques métier nécessaires
- [ ] Métriques techniques nécessaires
- [ ] Alertes opérationnelles nécessaires
- [ ] Fréquence de remontée définie
- [ ] Format JSON du contrat documenté
- [ ] Aucune donnée inutile ajoutée au contrat

### Règle de minimisation

- [ ] Pas de nom personnel
- [ ] Pas d'email personnel
- [ ] Pas de téléphone personnel
- [ ] Pas d'adresse personnelle
- [ ] Pas de contenu utilisateur
- [ ] Pas d'identifiant personnel inutile
- [ ] Pas d'IP ou User-Agent sauf nécessité explicitement validée
- [ ] Pas de données de paiement sensibles

## 4. Trafic — uniquement si nécessaire

- [ ] Visites définies
- [ ] Visiteurs uniques définis
- [ ] Données quotidiennes agrégées
- [ ] Historique 7 jours prévu si nécessaire
- [ ] Historique 30 jours prévu si nécessaire
- [ ] Aucun identifiant personnel transmis
- [ ] Incrément atomique utilisé côté base si plusieurs requêtes peuvent arriver simultanément

Payload minimal de référence :

```json
{
  "date": "YYYY-MM-DD",
  "visits": 0,
  "unique_visitors": 0
}
```

## 5. Alertes

Si le projet nécessite des alertes :

- [ ] Types d'alertes définis
- [ ] Niveaux `info`, `warning`, `error` définis
- [ ] Endpoint sécurisé
- [ ] Produit identifié dans chaque alerte
- [ ] Message utile et non sensible
- [ ] Telegram/Control Center configuré si nécessaire
- [ ] Test d'alerte effectué

## 6. Paiements — si le projet en possède

Suivre le modèle Séjoura/Schooly :

- [ ] Le paiement reste géré par le produit côté opérationnel
- [ ] La validation globale passe par le Control Center
- [ ] Les demandes de paiement remontent au Control Center
- [ ] Le Super Admin central décide : validation ou rejet
- [ ] Le produit reçoit le callback de décision
- [ ] Le callback est authentifié par secret partagé
- [ ] La décision est journalisée
- [ ] Une alerte est générée si nécessaire
- [ ] Aucun système de validation Super Admin parallèle n'existe dans le produit

## 7. Base de données

- [ ] Tables nécessaires identifiées
- [ ] Migration SQL créée
- [ ] RLS activé lorsque nécessaire
- [ ] Permissions vérifiées
- [ ] Fonctions RPC sécurisées si utilisées
- [ ] Opérations concurrentes rendues atomiques lorsque nécessaire
- [ ] Aucun accès public inutile
- [ ] Migration appliquée sur la base de production
- [ ] Vérification post-migration effectuée

## 8. Intégration Control Center

- [ ] Projet visible dans le Control Center
- [ ] Statut du projet correct
- [ ] URL correcte
- [ ] Métriques visibles
- [ ] Alertes visibles si activées
- [ ] Paiements visibles si applicables
- [ ] Trafic visible si activé
- [ ] Aucun faux chiffre ou donnée de démonstration en production

## 9. Tests

### Tests fonctionnels

- [ ] Test de remontée des métriques
- [ ] Test de remontée du trafic si activé
- [ ] Test d'alerte si activé
- [ ] Test de demande de paiement si applicable
- [ ] Test de validation de paiement si applicable
- [ ] Test de rejet de paiement si applicable
- [ ] Test du callback Control Center → projet

### Tests de sécurité

- [ ] Requête sans secret refusée
- [ ] Mauvais secret refusé
- [ ] Payload invalide refusé
- [ ] Données personnelles absentes du payload
- [ ] Endpoints sensibles non accessibles publiquement
- [ ] Aucun Super Admin global local accessible

## 10. Vercel / production

- [ ] Variables d'environnement configurées en production
- [ ] Build local vérifié
- [ ] Build Vercel vérifié
- [ ] Déploiement `READY`
- [ ] URL de production testée
- [ ] Logs vérifiés
- [ ] Aucune erreur critique après déploiement

## 11. Validation finale

Le projet peut être déclaré **intégré au Control Center** uniquement lorsque :

- [ ] Architecture Séjoura/Schooly respectée
- [ ] Super Admin global centralisé
- [ ] Sécurité validée
- [ ] Contrat de données validé
- [ ] Métriques testées
- [ ] Alertes testées si nécessaires
- [ ] Paiements testés si applicables
- [ ] Base de données validée
- [ ] Production Vercel validée
- [ ] Transmission réelle Control Center vérifiée
- [ ] Aucune donnée personnelle inutile transmise

### Règle finale

**Ne jamais repartir de zéro.**

Pour chaque nouveau projet :

**Séjoura + Schooly → architecture et supervision**  
**Trouvetou → trafic uniquement si nécessaire**  
**Control Center → supervision et Super Admin global**

Le nouveau projet ne doit ajouter que ses fonctionnalités métier propres.
