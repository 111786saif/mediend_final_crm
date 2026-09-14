import { getSessionFromRequest, getSessionWithFreshUser } from "@/lib/session";
import { addAttachment } from "@/lib/inventory/repository";
import { InventoryError } from "@/lib/inventory/engine";
import { UserRole } from "@/generated/prisma/enums";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor.permissions.includes("write")) {
      throw new InventoryError("You do not have permission to upload inventory attachments.", 403);
    }
    if (Number(request.headers.get("content-length") || 0) > 5_300_000)
      throw new InventoryError("Maximum attachment size is 5 MB.", 413);
    const data = await request.formData(),
      file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new InventoryError("Choose a PDF, JPEG or PNG smaller than 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
    const mime = png
      ? "image/png"
      : jpeg
        ? "image/jpeg"
        : pdf
          ? "application/pdf"
          : "";
    if (!mime)
      throw new InventoryError(
        "Unsupported file contents. Use PDF, JPEG or PNG.",
      );
    return Response.json(
      await addAttachment(actor, {
        name: file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 150),
        mime,
        bytes,
      }),
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Upload error" },
      { status: 500 },
    );
  }
}
