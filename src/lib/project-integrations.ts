export interface ProjectIntegrationCredential {
  integrationId: string;
  providerName: string;
  providerId: string;
  label: string;
  description: string;
  environment: "production" | "staging";
}

export const PROJECT_INTEGRATIONS: Record<string, ProjectIntegrationCredential[]> = {
  sejoura: [
    {
      integrationId: "trouvetou",
      providerName: "Séjoura",
      providerId: "7a358385-6a88-4c8e-8e93-ef743a5ff218",
      label: "Trouvetou",
      description: "Clé utilisée par Séjoura pour publier et synchroniser ses annonces sur Trouvetou.",
      environment: "production",
    },
  ],
  schooly: [
    {
      integrationId: "trouvetou",
      providerName: "Schooly",
      providerId: "79402646-081e-490e-9096-e1cd3caa7a8c",
      label: "Trouvetou",
      description: "Clé utilisée par Schooly pour publier et synchroniser les établissements sur Trouvetou.",
      environment: "production",
    },
  ],
};

export function getProjectIntegrations(projectId: string): ProjectIntegrationCredential[] {
  return PROJECT_INTEGRATIONS[projectId] ?? [];
}
