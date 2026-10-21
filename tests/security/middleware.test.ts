import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Profile = { role: string; is_active?: boolean } | null;
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as Profile,
  getUser: vi.fn(),
}));

// Le faux client n'expose PAS getSession : si le middleware l'appelait, le test échouerait.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: state.getUser },
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.single = () => Promise.resolve({ data: state.profile, error: null });
      return chain;
    },
  }),
}));

import { middleware } from "@/middleware";

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const loc = (res: Response) => res.headers.get("location") ?? "";

describe("middleware /admin", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    state.user = null;
    state.profile = null;
    state.getUser.mockReset();
    state.getUser.mockImplementation(async () => ({ data: { user: state.user }, error: null }));
  });

  it("redirige un visiteur non authentifié vers /admin avec le chemin demandé", async () => {
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(loc(res)).toContain("/admin?next=%2Fadmin%2Fdashboard");
  });

  it("valide l'identité avec getUser()", async () => {
    await middleware(req("/admin/dashboard"));
    expect(state.getUser).toHaveBeenCalledTimes(1);
  });

  it("refuse un utilisateur connecté qui n'est pas Super Admin", async () => {
    state.user = { id: "a" };
    state.profile = { role: "client", is_active: true };
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(loc(res)).pathname).toBe("/admin");
  });

  it("refuse un Super Admin désactivé", async () => {
    state.user = { id: "a" };
    state.profile = { role: "super_admin", is_active: false };
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
  });

  it("laisse passer un Super Admin actif", async () => {
    state.user = { id: "a" };
    state.profile = { role: "super_admin", is_active: true };
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("envoie un Super Admin déjà connecté de la page de login vers le dashboard", async () => {
    state.user = { id: "a" };
    state.profile = { role: "super_admin" };
    const res = await middleware(req("/admin"));
    expect(new URL(loc(res)).pathname).toBe("/admin/dashboard");
  });

  it("laisse la page de login accessible sans session", async () => {
    const res = await middleware(req("/admin"));
    expect(res.status).toBe(200);
  });
});
