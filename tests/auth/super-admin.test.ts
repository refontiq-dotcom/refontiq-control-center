import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient, makeAuthClient } from "../helpers/fake-supabase";

const state = vi.hoisted(() => ({ auth: null as unknown, admin: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.admin }));

import { requireSuperAdmin } from "@/lib/auth/super-admin";

const USER = { id: "auth-user-1" };
const ACTIVE_ADMIN = { id: "u1", role: "super_admin", is_active: true };

async function run(user: { id: string } | null, admin: ReturnType<typeof makeAdminClient>) {
  state.auth = makeAuthClient(user);
  state.admin = admin.client;
  return requireSuperAdmin();
}

describe("requireSuperAdmin", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("401 sans utilisateur authentifié, et ne lit aucune table", async () => {
    const admin = makeAdminClient({ profile: ACTIVE_ADMIN });
    const r = await run(null, admin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
    expect(admin.touched).toEqual([]);
  });

  it("403 si le profil est absent", async () => {
    const r = await run(USER, makeAdminClient({ profile: null }));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it("403 si le rôle n'est pas super_admin", async () => {
    const r = await run(USER, makeAdminClient({ profile: { ...ACTIVE_ADMIN, role: "client" } }));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it("403 si le Super Admin est désactivé", async () => {
    const r = await run(USER, makeAdminClient({ profile: { ...ACTIVE_ADMIN, is_active: false } }));
    expect(!r.ok && r.response.status).toBe(403);
  });

  it("échoue FERMÉ (500) si la lecture du profil échoue", async () => {
    const r = await run(USER, makeAdminClient({ profile: ACTIVE_ADMIN, profileError: "boom" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(500);
  });

  it("accepte un Super Admin actif et expose ses identifiants", async () => {
    const r = await run(USER, makeAdminClient({ profile: ACTIVE_ADMIN }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.admin).toEqual({ authUserId: "auth-user-1", userId: "u1" });
  });

  it("valide l'identité avec getUser (le faux client n'a pas de getSession)", async () => {
    const auth = makeAuthClient(USER);
    state.auth = auth;
    state.admin = makeAdminClient({ profile: ACTIVE_ADMIN }).client;
    await requireSuperAdmin();
    expect(auth.auth.getUser).toHaveBeenCalledTimes(1);
  });
});
