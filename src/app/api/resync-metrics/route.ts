import { NextResponse } from "next/server";

export async function POST() {
  try {
    // En production, on déclencherait un job queue qui appelle les endpoints
    // métriques de chaque produit (Schooly, Séjoura, Docly…) avec leurs
    // secrets propres. Ici on simule un déclenchement asynchrone.
    return NextResponse.json({
      success: true,
      ref: `resync-${Date.now()}`,
      status: "queued",
    });
  } catch (err: any) {
    console.error("[resync-metrics POST]", err);
    return NextResponse.json({ error: "Impossible de déclencher la ré synchronisation" }, { status: 500 });
  }
}
