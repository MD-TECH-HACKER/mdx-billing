import { auth } from "@/auth";
import { upload } from "@/app/api/utils/upload";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const base64 = body.base64;
    if (!base64 || typeof base64 !== "string") {
      return Response.json({ error: "No image" }, { status: 400 });
    }

    // Validate mime type
    const match = base64.match(/^data:(image\/(png|jpeg|jpg|webp));base64,/);
    if (!match) {
      return Response.json(
        { error: "Only PNG, JPG, WEBP allowed" },
        { status: 400 },
      );
    }

    // Limit size ~ 5MB (base64 is ~33% larger than binary)
    if (base64.length > 7_000_000) {
      return Response.json(
        { error: "Image too large (max 5MB)" },
        { status: 413 },
      );
    }

    // Skip the external upload API which was a placeholder.
    // Return the base64 string directly so it can be saved in the database as a data URI.
    return Response.json({ url: base64, mimeType: match[1] });
  } catch (err) {
    console.error("POST /api/upload-image", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
