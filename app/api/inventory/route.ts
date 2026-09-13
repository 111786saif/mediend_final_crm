import { getSessionFromRequest, getSessionWithFreshUser } from "@/lib/session";
import {
  getSnapshot,
  postCommand,
  auditPage,
} from "@/lib/inventory/repository";
import { InventoryError } from "@/lib/inventory/engine";
import { UserRole } from "@/generated/prisma/enums";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getActor(request: Request) {
  const session = (await getSessionWithFreshUser()) || getSessionFromRequest(request);
  if (!session) {
    throw new InventoryError("Authentication required.", 401);
  }

  const role = session.role as UserRole;
  const permissions: Array<"read" | "write" | "admin"> = ["read"];

  if (
    role === "MD" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "EXECUTIVE_ASSISTANT"
  ) {
    permissions.push("write", "admin");
  } else if (
    role === "FINANCE_HEAD" ||
    role === "PL_HEAD" ||
    role === "SALES_HEAD" ||
    role === "CATEGORY_MANAGER" ||
    role === "ASSISTANT_CATEGORY_MANAGER" ||
    role === "TEAM_LEAD"
  ) {
    permissions.push("write");
  }

  return {
    id: session.id,
    name: session.name || session.email || "Staff User",
    workspaceId: "default",
    permissions,
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    const url = new URL(request.url);
    if (url.searchParams.has("audit")) {
      const at = url.searchParams.get("beforeAt"),
        id = url.searchParams.get("beforeId");
      const cursor =
        at && id
          ? z.object({ at: z.string().datetime(), id: z.string().uuid() }).parse({ at, id })
          : undefined;
      return Response.json(
        { audit: await auditPage(actor, cursor) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(await getSnapshot(actor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") },
        { status: 400 },
      );
    }
    return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor.permissions.includes("write")) {
      throw new InventoryError("You do not have permission to modify inventory.", 403);
    }
    const text = await request.text();
    if (text.length > 1_000_000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    return Response.json(
      await postCommand(actor, JSON.parse(text)),
    );
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") },
        { status: 400 },
      );
    }
    return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
