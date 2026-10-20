# Contrat « métriques » v1 — `POST /api/metrics/push`

Un SaaS Refontiq **pousse** ses indicateurs vers le Control Center. Le Control Center ne
lit jamais directement la base d'un SaaS. Ce document est la référence ; le code qui
l'applique est `src/lib/contracts/metrics-v1.ts` (validation) et `src/lib/metrics/store.ts`
(stockage). Les tests dans `tests/metrics/` en sont la preuve exécutable.

## Authentification
`Authorization: Bearer <METRICS_PUSH_SECRET>` — comparaison à temps constant, secret lu à
chaque requête (une rotation ne demande pas de redémarrage). Le secret d'envoi de
métriques ne doit servir **à rien d'autre** (ni commandes, ni administration).

## Corps de la requête (v1)
| Champ | Obligatoire | Règle |
|---|---|---|
| `contract_version` | oui | exactement `1` |
| `projet` | oui | identifiant stable : `sejoura`, `schooly`, `docly`, `trouvetou` |
| `nom` | oui | 1 à 100 caractères |
| `environment` | oui | `production` \| `preview` \| `development` — **seul `production` est enregistré** |
| `collected_at` | oui | ISO 8601 avec fuseau : l'instant où la donnée a été **lue à sa source** |
| `run_id` | oui | UUID propre à l'exécution : clé d'idempotence |
| `statut_sante` | non | `healthy` \| `warning` \| `critical` \| `unknown` |
| `mrr` | non | entier ≥ 0, ≤ 2 000 000 000, **nombre** JSON (pas une chaîne) |
| `comptes_actifs` | non | entier ≥ 0, ≤ 2 000 000 000 |
| `details` | non | objet ; valeurs : texte ≤ 500 car., nombre, booléen, null, tableau ≤ 50, objet ; profondeur ≤ 3 ; ≤ 16 Ko |

Corps ≤ 64 Ko. Les champs inconnus sont ignorés.

### Règle d'or : un champ absent n'est pas un zéro
Un champ **absent** laisse la valeur précédente inchangée. Un émetteur qui ne sait pas
calculer une métrique **ne l'envoie pas** ; il n'envoie jamais `0` à la place.

### Fraîcheur
`collected_at` détermine la fraîcheur affichée (`derniere_synchro` / `captured_at`). Il est
refusé s'il est dans le futur de plus de 5 min (`future_payload`) ou antérieur de plus de
72 h (`stale_payload`). La date de **réception** est conservée à part (`received_at`).

## Réponses
Succès : `200 { ok: true, status, projet, contract_version, collected_at, collected_at_source, received_at, schema, warnings[] }`

| `status` | Signification |
|---|---|
| `stored` | état courant mis à jour **et** historique écrit |
| `history_only` | envoi plus ancien que l'état courant : historique écrit, état courant conservé |
| `duplicate` | cet envoi (même `run_id`) est déjà enregistré : rien n'a été écrit |

Erreurs : `{ ok: false, code, ... }` — jamais la valeur fautive, seulement le champ et la règle.

| HTTP | `code` | À faire côté émetteur |
|---|---|---|
| 401 | `unauthorized` | vérifier le secret ; **ne pas relancer** |
| 503 | `receiver_not_configured` | le Control Center n'a pas de secret : prévenir un administrateur |
| 413 | `payload_too_large` | réduire `details` |
| 400 | `invalid_json`, `invalid_payload`, `invalid_details` | corriger (voir `issues[]`) ; **ne pas relancer à l'identique** |
| 422 | `environment_not_accepted`, `future_payload`, `stale_payload` | ne rien réenvoyer tel quel |
| 500 | `storage_failed`, `history_failed`, `internal_error` | **relancer le même envoi** (même `run_id`) |

### Résultat partiel (`history_failed`)
La valeur courante est enregistrée (`metric_stored: true`) mais l'historique a échoué.
L'erreur est volontairement visible. **Relancer le même envoi** (même `run_id` et même
`collected_at`) : l'état courant est réécrit sans effet, l'historique est complété, et
l'envoi n'est jamais compté deux fois. L'historique est écrit en dernier précisément pour
que le doublon ne soit détecté qu'une fois l'envoi entièrement enregistré.

## Politique de relance recommandée (émetteur)
Relancer **uniquement** sur erreur réseau, délai dépassé, `429` ou `5xx`, avec le **même**
corps (même `run_id`, même `collected_at`). 2 tentatives, 1 s d'attente, délai de 10 s par
tentative. Jamais de relance sur `4xx`.

## Ancien format (v0)
Un corps sans `contract_version` reste accepté : `timestamp` sert de date de collecte
(sinon la date de réception, signalée par `collected_at_source: "received"`), la valeur
`environment` est supposée `production`, et `mrr` / `comptes_actifs` en chaîne d'entiers
sont tolérés. Cette tolérance sera retirée une fois tous les émetteurs migrés.

## Schéma de base (migration du contrat v1)
La migration `20261020000000_metrics_contract_v1.sql` ajoute `contract_version`,
`environment`, `received_at`, `run_id` (+ index unique partiel). **Elle n'est pas
indispensable au fonctionnement** : sans elle, le récepteur répond `schema: "legacy"` avec
l'avertissement `schema_outdated`, l'idempotence se fait sur `collected_at` et la
provenance n'est pas conservée.

## Limites connues
- **Pas de limitation de débit** : elle exige un stockage partagé (non disponible ici). Le
  plafond de taille et l'authentification limitent l'abus ; à compléter côté plateforme.
- **Un secret partagé** : tout émetteur qui le détient peut écrire pour n'importe quel
  `projet`. Un secret par projet est prévu au lot suivant.
- **Liste de produits fermée** dans le code ; un registre en base est prévu.
- `mrr` est un entier **sans devise** : le SaaS doit documenter l'unité de sa valeur.
