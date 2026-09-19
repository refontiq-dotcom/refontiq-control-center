# Standard d'intégration des projets Refontiq

## Objectif
Tout nouveau produit Refontiq doit être intégré au Refontiq Control Center comme source opérationnelle, sans créer de second centre Super Admin.

Trouvetou sert de référence pour l'intégration minimale et sécurisée : le produit conserve sa logique métier, tandis que les données de supervision nécessaires remontent au Control Center.

## Architecture obligatoire
Projet Refontiq → Control Center
Le Control Center est l'unique Super Admin global de l'écosystème.
Un projet ne doit pas créer de route, page, rôle ou privilège de Super Admin global local.

## Contrat d'intégration
Chaque nouveau projet doit définir explicitement :
1. Identité du projet : id, nom, URL, statut.
2. Métriques : uniquement les indicateurs nécessaires à la supervision.
3. Trafic, si nécessaire : date, visites, visiteurs uniques.
4. Alertes, si nécessaire : événements opérationnels utiles au Control Center.
5. Paiements, uniquement si le produit en possède : validation centralisée par le Control Center.
6. Secret partagé : METRICS_PUSH_SECRET pour les échanges serveur-à-serveur.
7. URL centrale : https://refontiq-control-center.vercel.app.

## Règle de minimisation des données
Un projet ne doit envoyer au Control Center que les champs explicitement définis par son contrat.
Pour un projet utilisant uniquement le suivi du trafic, le payload de référence est :
{"date":"YYYY-MM-DD","visits":0,"unique_visitors":0}
Aucune donnée personnelle (nom, email, téléphone, adresse, contenu utilisateur, identifiant personnel, IP ou User-Agent) ne doit être ajoutée à ce contrat.

## Référence Trouvetou
Trouvetou implémente le modèle trafic : endpoint produit /api/traffic ; endpoint Control Center /api/traffic/trouvetou ; table quotidienne trouvetou_traffic_daily ; incrément atomique côté base ; authentification par METRICS_PUSH_SECRET ; aucune donnée personnelle dans le payload ; aucun système de paiement ou Super Admin local.

## Checklist avant mise en production
- [ ] Projet enregistré dans src/lib/projects.ts.
- [ ] Contrat de données documenté.
- [ ] Endpoint serveur sécurisé.
- [ ] CONTROL_CENTER_URL configuré.
- [ ] METRICS_PUSH_SECRET configuré.
- [ ] Données envoyées limitées au contrat.
- [ ] Aucun Super Admin global local.
- [ ] Paiement centralisé si applicable.
- [ ] Migration DB appliquée si nécessaire.
- [ ] Test réel de transmission effectué avant validation finale.
- [ ] Déploiement Vercel vérifié.

## Règle pour les futurs projets
Ne pas repartir de zéro. Copier ce modèle d'intégration, adapter uniquement le contrat de données et les endpoints propres au produit, puis enregistrer le produit dans le Control Center.