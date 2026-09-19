export type IntegrationStatus = "not_started" | "in_progress" | "validated" | "blocked";

export interface ChecklistDefinition {
  key: string;
  section: string;
  label: string;
  required: boolean;
}

export const INTEGRATION_CHECKLIST: ChecklistDefinition[] = [
  { key: "project.identity", section: "Identification", label: "Projet identifié et enregistré dans le Control Center", required: true },
  { key: "project.github", section: "Identification", label: "Repository GitHub créé ou relié", required: true },
  { key: "project.vercel", section: "Identification", label: "Projet Vercel créé ou relié", required: true },
  { key: "project.supabase", section: "Identification", label: "Projet Supabase créé ou relié si nécessaire", required: false },

  { key: "architecture.central_admin", section: "Architecture", label: "Refontiq Control Center est le seul Super Admin global", required: true },
  { key: "architecture.no_local_super_admin", section: "Architecture", label: "Aucun Super Admin global local n'est exposé", required: true },
  { key: "architecture.operational_roles", section: "Architecture", label: "Les rôles locaux restent limités aux besoins opérationnels", required: true },
  { key: "architecture.central_super_admin_redirect", section: "Architecture", label: "Les accès Super Admin éventuels sont redirigés vers le Control Center", required: true },

  { key: "security.control_center_url", section: "Sécurité", label: "CONTROL_CENTER_URL configuré en production", required: true },
  { key: "security.metrics_secret", section: "Sécurité", label: "METRICS_PUSH_SECRET configuré et partagé uniquement côté serveur", required: true },
  { key: "security.authenticated_endpoints", section: "Sécurité", label: "Les endpoints entrants sensibles vérifient l'authentification", required: true },
  { key: "security.payload_validation", section: "Sécurité", label: "Les payloads entrants sont validés", required: true },
  { key: "security.no_unnecessary_pii", section: "Sécurité", label: "Aucune donnée personnelle inutile n'est transmise au Control Center", required: true },

  { key: "metrics.contract", section: "Supervision", label: "Contrat de métriques documenté et validé", required: true },
  { key: "metrics.health", section: "Supervision", label: "État de santé du projet remonté si nécessaire", required: true },
  { key: "metrics.business", section: "Supervision", label: "Métriques métier nécessaires définies", required: true },
  { key: "metrics.real_test", section: "Supervision", label: "Transmission réelle des métriques testée", required: true },

  { key: "alerts.types", section: "Alertes", label: "Types et niveaux d'alertes définis si le projet en a besoin", required: false },
  { key: "alerts.secure", section: "Alertes", label: "Endpoint d'alerte sécurisé", required: false },
  { key: "alerts.telegram", section: "Alertes", label: "Telegram / Control Center testé si activé", required: false },

  { key: "billing.centralized", section: "Paiements", label: "Validation globale des paiements centralisée au Control Center si applicable", required: false },
  { key: "billing.callback", section: "Paiements", label: "Callback de décision Control Center → projet authentifié si applicable", required: false },
  { key: "billing.no_local_admin", section: "Paiements", label: "Aucun système de validation Super Admin parallèle dans le projet", required: false },

  { key: "database.migrations", section: "Base de données", label: "Migrations nécessaires créées et appliquées", required: true },
  { key: "database.rls", section: "Base de données", label: "RLS et permissions vérifiés", required: true },
  { key: "database.atomic", section: "Base de données", label: "Les opérations concurrentes sont atomiques si nécessaire", required: false },

  { key: "production.env", section: "Production", label: "Variables d'environnement de production vérifiées", required: true },
  { key: "production.build", section: "Production", label: "Build Vercel validé", required: true },
  { key: "production.ready", section: "Production", label: "Déploiement Vercel en état READY", required: true },
  { key: "production.logs", section: "Production", label: "Logs post-déploiement vérifiés", required: true },

  { key: "validation.functional", section: "Validation finale", label: "Tests fonctionnels terminés", required: true },
  { key: "validation.security", section: "Validation finale", label: "Tests de sécurité terminés", required: true },
  { key: "validation.control_center", section: "Validation finale", label: "Projet et données visibles correctement dans le Control Center", required: true },
  { key: "validation.no_demo_data", section: "Validation finale", label: "Aucune donnée fictive de démonstration en production", required: true },
];

export const CHECKLIST_SECTIONS = [...new Set(INTEGRATION_CHECKLIST.map((item) => item.section))];

export function calculateIntegrationStatus(
  items: Array<{ checked: boolean; required: boolean }>
): IntegrationStatus {
  const required = items.filter((item) => item.required);
  if (required.length > 0 && required.every((item) => item.checked)) return "validated";
  if (items.some((item) => item.checked)) return "in_progress";
  return "not_started";
}

export const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_started: "Non commencé",
  in_progress: "En cours",
  validated: "Validé",
  blocked: "Bloqué",
};
