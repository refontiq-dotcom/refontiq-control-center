# Standard d'intégration des projets Refontiq

## Objectif

Tout nouveau produit Refontiq doit être intégré au **Refontiq Control Center** comme source opérationnelle, sans créer de second centre Super Admin.

**Références officielles de l'architecture : Séjoura et Schooly.** Trouvetou reste uniquement la référence spécifique au suivi du trafic.

## Architecture obligatoire

**Projet Refontiq → Refontiq Control Center**

Le Control Center est l'unique Super Admin global de l'écosystème.

Chaque produit conserve sa logique métier et son administration opérationnelle locale, mais ne doit pas créer de Super Admin global concurrent.

## Références d'implémentation

### Séjoura

Séjoura est la référence pour :
- suppression du Super Admin global local ;
- redirection des accès Super Admin vers le Control Center ;
- intégration des métriques ;
- intégration des alertes ;
- intégration de la validation des paiements par le Control Center ;
- utilisation de CONTROL_CENTER_URL et METRICS_PUSH_SECRET ;
- callbacks sécurisés entre le Control Center et le produit.

### Schooly

Schooly est la référence pour :
- suppression du Super Admin global local ;
- suppression des routes, menus et guards Super Admin locaux ;
- intégration des métriques ;
- remontée des alertes vers le Control Center/Telegram ;
- demandes de paiement traitées par le Control Center ;
- callback de décision du Control Center vers le produit ;
- utilisation de CONTROL_CENTER_URL et METRICS_PUSH_SECRET.

### Trouvetou

Trouvetou est uniquement la référence pour le cas d'usage **trafic** :
- visites ;
- visiteurs uniques ;
- historique quotidien ;
- transmission minimale sans données personnelles.

## Contrat d'intégration

Chaque nouveau projet doit définir explicitement :

1. Identité du projet : id, nom, URL, statut.
2. Métriques nécessaires à la supervision.
3. Alertes nécessaires.
4. Paiements, si le produit en possède.
5. URL centrale : CONTROL_CENTER_URL.
6. Secret partagé : METRICS_PUSH_SECRET.
7. Contrats de données strictement limités au besoin du produit.

## Règle de sécurité

Aucun nouveau projet ne doit créer son propre Super Admin global.

Le Control Center est le seul point de supervision et de validation **à l'échelle de l'écosystème**.

Les données envoyées doivent être limitées au contrat défini. Aucune donnée personnelle ne doit être transmise lorsqu'elle n'est pas nécessaire à la supervision.

## Checklist obligatoire pour un futur projet

- [ ] Projet enregistré dans src/lib/projects.ts.
- [ ] Architecture alignée sur Séjoura/Schooly.
- [ ] Super Admin global local supprimé ou interdit.
- [ ] CONTROL_CENTER_URL configuré.
- [ ] METRICS_PUSH_SECRET configuré.
- [ ] Métriques définies.
- [ ] Alertes définies si nécessaires.
- [ ] Paiement centralisé si applicable.
- [ ] Callbacks sécurisés si nécessaires.
- [ ] Migrations DB appliquées.
- [ ] Contrats de données vérifiés.
- [ ] Test réel de transmission effectué.
- [ ] Déploiement Vercel vérifié.

## Règle pour les futurs projets

Ne pas repartir de zéro.

**Séjoura + Schooly = architecture de référence Refontiq.**

On reprend leur modèle d'intégration au Control Center, puis on ajoute uniquement les fonctionnalités propres au nouveau produit.

**Trouvetou = référence trafic uniquement.**
