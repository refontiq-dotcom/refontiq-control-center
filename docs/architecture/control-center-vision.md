# Control Center — vision, modèle financier et feuille de route

> Statut : **proposition validée dans ses grandes lignes** par le propriétaire (21/10/2026) ;
> aucun changement de code ni de production dans ce document. Les décisions prises sont en
> §4.3 et §8 ; ce qui reste « À CONFIRMER » est signalé.

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
| Revenu | paiement reçu d'un client et **validé** ; comptabilisé à la date de validation. Sources **décidées** : abonnements Séjoura et frais par inscription Schooly (§4.3) |
| MRR | somme mensualisée des abonnements **actifs** payés à Refontiq |
| ARR | MRR × 12 |
| Charges | **saisie manuelle** (décidé) : date, catégorie libre, libellé, montant XOF, récurrente oui/non. Catégories à définir au fil de l'eau |
| Marge | revenu − charges, par mois et par produit |
| Impayés | échéances dues et non validées au-delà du délai |
| Churn | abonnements actifs en début de mois, résiliés ou expirés dans le mois |
| ARPA | MRR ÷ nombre de comptes payants |

**B. Activité des clients (ce n'est PAS votre argent)**
Volume géré par vos clients (ex. encaissements des hôtels, frais scolaires collectés).
Sert à mesurer la **santé et l'usage** d'un produit et, si applicable, à calculer une
commission. Affiché à part, libellé « volume géré », jamais additionné au revenu de Refontiq.

### 4.3 Revenus de Refontiq par produit (décisions du propriétaire)
| Produit | Qui paie Refontiq | Quoi | Rythme | Nature |
|---|---|---|---|---|
| **Séjoura** | chaque résidence | **abonnement mensuel** | fin de mois | récurrent → MRR |
| **Schooly** | chaque établissement | **1 000 F par élève**, à l'inscription confirmée | à chaque inscription | **ponctuel par événement, PAS un MRR** |
| **Docly** | chaque abonné | **abonnement mensuel** | de la date d'activation à la date de fin | récurrent → MRR |
| **Trouvetou** | annonceurs | **publicité** affichée sur la plateforme | à chaque achat de publicité | ponctuel ; **pas d'abonnement** |

Trouvetou n'a pas de revenu d'abonnement. Le Control Center y suit : **revenus publicitaires**
(paiements de publicité validés), **nombre d'utilisateurs** (total, actifs 30 j, nouveaux 7 j),
trafic (déjà collecté dans `trouvetou_traffic_daily`) et annonces/publicités actives.

**Schooly — vérifié dans la base le 21/10/2026** : le mécanisme existe déjà (`platform_fee_ledger` :
une ligne `enrollment_confirmed` de 1 000 F par inscription, puis `platform_invoices` par
établissement et période). Situation constatée : 2 inscriptions, **2 000 F dus, 0 F encaissé**,
1 établissement, aucune facture émise. Le Control Center doit donc afficher pour Schooly trois
chiffres distincts, et **non** un « MRR » :
- `frais_dus` — frais générés par les inscriptions, pas encore encaissés ;
- `frais_encaisses` — factures payées (`paid_amount`) ;
- `inscriptions_facturables` — nombre d'inscriptions de la période.

**Séjoura** : le revenu de Refontiq est l'abonnement de chaque résidence (`subscriptions`),
distinct des encaissements des hôtels auprès de leurs voyageurs (volume géré, §4.1-B). Un
abonnement dû en fin de mois et non validé devient un **impayé** après le délai de grâce
(À CONFIRMER : durée).

### 4.5 Règles d'abonnement et de versement (PROPOSÉES, à valider)
**Abonnements (Séjoura, Docly) — période « anniversaire »**
- Une période va du **jour d'activation** à la veille du même quantième du mois suivant
  (si le mois n'a pas ce quantième : dernier jour du mois). L'abonnement se renouvelle à
  la date de fin.
- Délai de grâce **5 jours** après la date de fin ; passé ce délai, le compte passe en
  **lecture seule** (jamais de suppression de données) et le montant devient un **impayé**.
- Un changement de formule prend effet à la **période suivante** (pas de prorata).
- MRR = somme des abonnements **actifs à la date du jour** ; revenu = paiement **validé**.
- Raison : les échéances sont étalées sur le mois au lieu de tomber toutes le même jour,
  ce qui évite la pointe de validations manuelles de fin de mois.

**Schooly — 1 000 F par élève et par année scolaire**
- Fait générateur : inscription **confirmée** ; une seule fois par inscription (garanti en
  base par `UNIQUE (product_id, event_id)`) ; l'année suivante, nouvelle inscription →
  nouveaux 1 000 F. Montant paramétrable (`billing_configs`, 1 000 par défaut).
- **Versement proposé : facture mensuelle à terme échu** par établissement : le 1ᵉʳ de chaque
  mois, génération de la facture des frais `due` du mois écoulé (fonction existante
  `generate_platform_invoices`), échéance **15 jours**, règlement par mobile money,
  validation dans le Control Center (flux `payment_validation_requests` existant).
- Statuts du frais : `due` → `collected` → `settled`.

**Cas limites — DÉCIDÉS le 21/10/2026**
1. *Transfert d'élève en cours d'année* → **1 000 F une seule fois par élève et par année**,
   quel que soit le nombre d'établissements. Écart avec le système actuel : l'unicité porte
   sur l'inscription, pas sur (élève, année) → un transfert peut aujourd'hui facturer deux
   fois. **Correctif à faire côté Schooly** (contrainte unique par élève et année + reprise
   de l'existant), via une migration dédiée, relue et testée avant toute application.
2. *Inscription annulée après confirmation* → **les 1 000 F restent dus pour l'année**.
   C'est déjà le comportement actuel : rien à changer.

### 4.4 Charges — saisie manuelle
Table dédiée (à venir) : `date`, `catégorie` (libre, enrichie au fil de l'eau), `libellé`,
`montant` (XOF entier), `récurrente`, `créé_par`. Une charge saisie n'est jamais modifiée ni
supprimée : on la **contre-passe** (traçabilité). Accès : super administrateur uniquement.

### 4.2 Règles
- Montants en **XOF (franc CFA), entiers**, devise unique (décidé) : aucune conversion, aucune virgule flottante.
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

## 8. Décisions et points ouverts
**Décidé (21/10/2026)** :
1. Revenus : abonnements mensuels Séjoura ; 1 000 F par élève à l'inscription pour Schooly.
2. Charges : saisie manuelle pour l'instant, catégories non figées.
3. Devise : franc CFA (XOF) uniquement.
4. Accès : le propriétaire seul (un seul rôle suffit pour l'instant ; la conception ne l'interdit pas à l'avenir).
5. Schooly : frais par inscription uniquement (pas d'abonnement).

**Décidé aussi** : Docly = abonnement mensuel ; Trouvetou = revenus publicitaires + nombre
d'utilisateurs (pas d'abonnement) ; Schooly = 1 000 F une fois par élève et par année.

**Validé** : période d'abonnement « anniversaire » avec 5 jours de grâce ; facture mensuelle
à terme échu pour Schooly ; frais Schooly uniques par élève et par année, conservés en cas
d'annulation.

**Hypothèse de travail, à confirmer** : les publicités Trouvetou sont **achetées par des
annonceurs qui paient Refontiq** (mobile money, paiement validé par le propriétaire), ce que
le flux de paiement publicitaire déjà présent dans Séjoura suggère. Le revenu publicitaire
appartient à Refontiq. La conception prévoit un champ « source » pour accueillir plus tard
un réseau publicitaire (type AdSense) sans refonte.

## 9. Dette connue liée (issue de l'audit)
- `POST /api/billing` compare encore son secret sans temps constant et réutilise `METRICS_PUSH_SECRET` (un secret pour trois usages) → secret dédié, au lot « commandes et audit ».
- Aucune limitation de débit sur les endpoints d'écriture.
- Aucune trace d'audit des validations de paiement au-delà de `validated_by` / `validated_at`.
