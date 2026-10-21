# Control Center — vision, modèle financier et feuille de route

> Statut : **proposition** (aucun changement de code ni de production). Les points marqués
> « À CONFIRMER » demandent une décision du propriétaire avant implémentation.

## 1. Mission
Le Control Center est le **poste de pilotage de l'entreprise Refontiq** : ses finances, ses
produits (Séjoura, Schooly, Trouvetou, Docly…) et ses décisions. Il sert à répondre, à tout
moment et avec des chiffres fiables, à : *gagne-t-on de l'argent ? que se passe-t-il ? que
faut-il faire ?*

## 2. Principes (non négociables)
1. **Un chiffre affiché est un chiffre traçable** : source, définition, date de collecte.
2. **Inconnu ≠ zéro.** Une donnée absente s'affiche « inconnue », jamais `0`.
3. **Deux comptabilités séparées** : l'argent de Refontiq et l'activité de ses clients (§4).
4. **Agrégats uniquement.** Aucune donnée personnelle (élèves, voyageurs, parents…) ne
   transite par le Control Center : seulement des totaux.
5. **Règles déterministes d'abord, IA ensuite.** Toute recommandation cite les données qui
   la justifient ; l'IA explique, elle ne décide pas et n'invente aucun chiffre.
6. **Action sensible = validation humaine + trace d'audit.** Un secret par usage.

## 3. État des lieux (relevé dans le code et la base, 21/10/2026)
| Sujet | Constat |
|---|---|
| Pages existantes | dashboard, supervision, finance, finance/recouvrement, projets, checklist d'intégration, trafic Trouvetou, notifications |
| Revenus réels de Refontiq | table `payment_validation_requests` (paiement d'abonnement d'un client à Refontiq, validé par le super admin) : **bonne base, vide aujourd'hui** |
| Charges / dépenses | **inexistantes** → marge impossible à calculer |
| Moteur d'intelligence | `src/lib/intelligence.ts` : règles déterministes (donnée absente, ancienne, état critique, chute d'activité) |
| **Incohérence fraîcheur** | seuil « périmé » = **30 min**, alors que les envois sont horaires/quotidiens → alertes « synchronisation ancienne » quasi permanentes |
| Sens de « MRR » | **Séjoura** : somme des abonnements actifs (vrai MRR). **Schooly** : commissions cumulées depuis l'origine (ce n'est pas un MRR). **Trouvetou, Docly** : aucun |
| « Revenus collectés » | Séjoura : encaissements **des hôtels** (≠ revenu de Refontiq) |
| Historique | `portfolio_metric_snapshots` : 1 point par envoi, pas encore exploité (tendances) |
| Données | 11 tables, RLS actif partout ; Séjoura envoie du réel depuis le 21/10/2026, Schooly depuis le 20/09 (arrêté), Trouvetou/Docly : rien de réel |

## 4. Modèle financier

### 4.1 Deux registres, jamais additionnés
**A. Finances de Refontiq (c'est VOTRE argent)**
| Indicateur | Définition |
|---|---|
| Revenu | paiement reçu d'un client et **validé** (abonnement, commission, frais d'installation — À CONFIRMER) ; comptabilisé à la date de validation |
| MRR | somme mensualisée des abonnements **actifs** payés à Refontiq |
| ARR | MRR × 12 |
| Charges | hébergement, outils, salaires, publicité… saisies par catégorie (À CONFIRMER : saisie manuelle puis import) |
| Marge | revenu − charges, par mois et par produit |
| Impayés | échéances dues et non validées au-delà du délai |
| Churn | abonnements actifs en début de mois, résiliés ou expirés dans le mois |
| ARPA | MRR ÷ nombre de comptes payants |

**B. Activité des clients (ce n'est PAS votre argent)**
Volume géré par vos clients (ex. encaissements des hôtels, frais scolaires collectés).
Sert à mesurer la **santé et l'usage** d'un produit et, si applicable, à calculer une
commission. Affiché à part, libellé « volume géré », jamais additionné au revenu de Refontiq.

### 4.2 Règles
- Montants en **XOF, entiers** (aucune virgule flottante) ; autre devise : convertie à la saisie, taux conservé.
- Mois calendaires en **UTC** (même fuseau que Côte d'Ivoire) ; période = [début, fin[.
- Une écriture financière **n'est jamais modifiée ni supprimée** : on contre-passe (traçabilité).
- Chaque indicateur affiche sa **date de collecte** et son **statut** : frais / périmé / inconnu.

## 5. Contrat de données (évolution de `metrics-push-v1`)
Le contrat v1 reste valide. Ajouts proposés (v1.1, rétrocompatibles) dans `details` puis en colonnes :
- `refontiq_mrr` : ce que les clients paient **à Refontiq** (remplace l'usage ambigu de `mrr`).
- `volume_gere` : activité des clients, avec son unité.
- `expected_interval_minutes` : cadence d'envoi déclarée par le produit.
- **Fraîcheur** : « périmé » = âge > 2 × `expected_interval_minutes` (au lieu du 30 min fixe).
- Chaque produit publie sa **définition** de chaque indicateur (document versionné).

## 6. Intelligence — par niveaux
1. **Règles** (existant) : donnée absente/périmée, état critique, chute d'activité.
2. **Tendances** : semaine sur semaine, mois sur mois, à partir des snapshots.
3. **Anomalies** : écart à la normale (seuil statistique simple, avec explication).
4. **Prévisions** : projection du MRR et de la trésorerie (méthode simple, intervalle de confiance affiché).
5. **Recommandations** : « que faire », toujours avec la preuve ; couche d'explication IA optionnelle et strictement fondée sur les données.

## 7. Feuille de route et critères d'acceptation
| Phase | Contenu | Réussite = |
|---|---|---|
| **1. Fondations** | définitions ci-dessus ; seuil de fraîcheur par cadence ; correction des définitions de MRR par produit ; contrat v1.1 | chiffres de Séjoura recoupés avec la base source, tests, document de définitions |
| **2. Vue unifiée** | tous les produits (santé, fraîcheur, MRR, comptes, tendances) | 4 produits visibles, aucune valeur « 0 » trompeuse |
| **3. Finances** | registre des revenus, charges, marge, impayés, historique mensuel | rapprochement avec vos relevés réels |
| **4. Intelligence** | tendances, anomalies, prévisions, recommandations | chaque conseil cite sa donnée ; prévisions testées sur l'historique |

## 8. Questions ouvertes (À CONFIRMER)
1. Quelles sources de revenu : abonnements, commissions, frais d'installation, autres ?
2. Charges : saisie manuelle dans le Control Center ou import ? catégories ?
3. Tout en XOF ? Des clients paient-ils dans une autre devise ?
4. Qui consulte le Control Center : vous seul, ou aussi des associés / un comptable (droits de lecture) ?
5. Faut-il facturer Schooly par commission, abonnement, ou les deux ?

## 9. Dette connue liée (issue de l'audit)
- `POST /api/billing` compare encore son secret sans temps constant et réutilise `METRICS_PUSH_SECRET` (un secret pour trois usages) → secret dédié, au lot « commandes et audit ».
- Aucune limitation de débit sur les endpoints d'écriture.
- Aucune trace d'audit des validations de paiement au-delà de `validated_by` / `validated_at`.
