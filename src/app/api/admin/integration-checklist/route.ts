import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { REFONTIQ_PROJECTS } from "@/lib/projects";
import {
  INTEGRATION_CHECKLIST,
  calculateIntegrationStatus,
  type IntegrationStatus,
} from "@/lib/integration-checklist";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return Boolean(profile?.role === "super_admin" && profile.is_active !== false);
}

async function ensureProjectItems(projet: string) {
  const admin = createAdminClient();
  const rows = INTEGRATION_CHECKLIST.map((item) => ({
    projet,
    item_key: item.key,
    section: item.section,
    label: item.label,
    required: item.required,
  }));

  const { error } = await admin
    .from("project_integration_checklist_items")
    .upsert(rows, { onConflict: "projet,item_key", ignoreDuplicates: true });

  if (error) throw error;
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    for (const project of REFONTIQ_PROJECTS) {
      await ensureProjectItems(project.id);
    }

    const [{ data: items, error: itemsError }, { data: statuses, error: statusesError }] =
      await Promise.all([
        admin.from("project_integration_checklist_items")
          .select("projet,item_key,section,label,required,checked,note,updated_at")
          .order("section")
          .order("item_key"),
        admin.from("project_integration_status")
          .select("projet,status,note,updated_at"),
      ]);

    if (itemsError || statusesError) {
      console.error("[integration checklist]", { itemsError, statusesError });
      return NextResponse.json({ error: "Lecture de la checklist impossible." }, { status: 500 });
    }

    const projects = REFONTIQ_PROJECTS.map((project) => {
      const projectItems = (items ?? []).filter((item) => item.projet === project.id);
      const storedStatus = (statuses ?? []).find((status) => status.projet === project.id);
      const calculated = calculateIntegrationStatus(projectItems);

      return {
        ...project,
        status: storedStatus?.status === "blocked" ? "blocked" : calculated,
        note: storedStatus?.note ?? null,
        updatedAt: storedStatus?.updated_at ?? null,
        items: projectItems,
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[integration checklist]", error);
    return NextResponse.json({ error: "Checklist indisponible." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const projet = String(body?.projet ?? "");
    const itemKey = body?.itemKey ? String(body.itemKey) : null;
    const checked = body?.checked;
    const note = body?.note === undefined ? undefined : String(body.note ?? "");
    const requestedStatus = body?.status ? String(body.status) as IntegrationStatus : null;

    if (!REFONTIQ_PROJECTS.some((project) => project.id === projet)) {
      return NextResponse.json({ error: "Projet invalide." }, { status: 400 });
    }

    const definition = itemKey
      ? INTEGRATION_CHECKLIST.find((item) => item.key === itemKey)
      : null;

    if (itemKey && !definition) {
      return NextResponse.json({ error: "Élément de checklist invalide." }, { status: 400 });
    }

    const admin = createAdminClient();

    if (itemKey) {
      if (typeof checked !== "boolean") {
        return NextResponse.json({ error: "checked doit être booléen." }, { status: 400 });
      }

      const update: Record<string, unknown> = { checked };
      if (note !== undefined) update.note = note;

      const { error } = await admin
        .from("project_integration_checklist_items")
        .update(update)
        .eq("projet", projet)
        .eq("item_key", itemKey);

      if (error) throw error;
    }

    const { data: projectItems, error: readError } = await admin
      .from("project_integration_checklist_items")
      .select("checked,required")
      .eq("projet", projet);

    if (readError) throw readError;

    const calculated = calculateIntegrationStatus(projectItems ?? []);
    const status: IntegrationStatus =
      requestedStatus === "blocked" ? "blocked" : calculated;

    const { error: statusError } = await admin
      .from("project_integration_status")
      .upsert(
        { projet, status, ...(note !== undefined ? { note } : {}) },
        { onConflict: "projet" }
      );

    if (statusError) throw statusError;

    return NextResponse.json({ success: true, projet, status });
  } catch (error) {
    console.error("[integration checklist update]", error);
    return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 });
  }
}
