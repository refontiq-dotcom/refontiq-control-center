import type { LucideIcon } from "lucide-react";
import { Building2, Stethoscope, GraduationCap, BedDouble } from "lucide-react";

export interface RefontiqProject {
  id: string;
  name: string;
  tagline: string;
  description: string;
  href: string;
  icon: keyof typeof ICON_MAP;
  accent: string;
  status: "active" | "coming-soon";
  statusLabel?: string;
}

export const ICON_MAP = {
  Building2,
  Stethoscope,
  GraduationCap,
  BedDouble,
} as const satisfies Record<string, LucideIcon>;

export const REFONTIQ_PROJECTS: RefontiqProject[] = [
  {
    id: "sejoura",
    name: "Séjoura",
    tagline: "Gestion de résidences & hôtels",
    description: "SaaS complet pour résidences meublées, hôtels et locations de courte durée. Réservations, ménage, facturation, Trouvetou.",
    href: "https://sejoura.refontiq.com",
    icon: "Building2",
    accent: "#0C1C33",
    status: "active",
    statusLabel: "En production",
  },
  {
    id: "schooly",
    name: "Schooly",
    tagline: "Gestion scolaire multi-établissements",
    description: "Inscriptions, caisse, pédagogie, vie scolaire, portails parents/élèves/profs. Facturation 1000 FCFA/élève.",
    href: "https://schooly.refontiq.com",
    icon: "GraduationCap",
    accent: "#1E3A8A",
    status: "active",
    statusLabel: "En développement",
  },
  {
    id: "docly",
    name: "Docly",
    tagline: "Gestion de cliniques & cabinets",
    description: "Dossiers patients, rendez-vous, facturation actes médicaux, confidentialité renforcée.",
    href: "https://docly.refontiq.com",
    icon: "Stethoscope",
    accent: "#065F46",
    status: "coming-soon",
    statusLabel: "En reconstruction",
  },
  {
    id: "trouvetou",
    name: "Trouvetou",
    tagline: "Découverte écoles, hébergements, cliniques",
    description: "Plateforme grand public unifiée pour trouver une école, un logement ou une clinique. Connecteur standardisé.",
    href: "https://trouvetou.refontiq.com",
    icon: "BedDouble",
    accent: "#7C2D12",
    status: "active",
    statusLabel: "En production",
  },
];

export const REFONTIQ_ROADMAP = [
  { label: "Refontiq Control Center", hint: "Hub super-admin unifié (ce projet)" },
  { label: "@refontiq/billing", hint: "Moteur facturation mutualisé (extraction Séjoura)" },
  { label: "@refontiq/ui", hint: "Design system partagé" },
];
