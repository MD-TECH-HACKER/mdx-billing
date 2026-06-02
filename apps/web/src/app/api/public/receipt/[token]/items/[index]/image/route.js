import sql from "@/app/api/utils/sql";
import { verifyPublicReceiptToken } from "@/app/api/utils/publicReceiptToken";

export async function GET(request, { params }) {
  try {
    const token = params.token;
    const index = Number.parseInt(params.index, 10);
    
    if (!token || Number.isNaN(index)) return new Response("Not found", { status: 404 });

    const payload = await verifyPublicReceiptToken(token);
    if (!payload) return new Response("Not found", { status: 404 });

    const rows = await sql`SELECT items FROM sales WHERE sale_id = ${payload.saleId} LIMIT 1`;
    if (!rows.length || !rows[0].items) return new Response("Not found", { status: 404 });

    const items = typeof rows[0].items === "string" ? JSON.parse(rows[0].items) : rows[0].items;
    if (!Array.isArray(items) || !items[index]) return new Response("Not found", { status: 404 });

    const item = items[index];
    const image = item.imageSnapshot || item.imageUrl;

    if (!image) return new Response("Not found", { status: 404 });

    // If it's base64, decode it and serve as a binary image
    const match = image.match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const buffer = Buffer.from(match[3], "base64");
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // If it's a URL, redirect to it
    if (image.startsWith("http") || image.startsWith("/")) {
      return Response.redirect(image.startsWith("/") ? new URL(image, request.url).href : image);
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error("GET /api/public/receipt/[token]/items/[index]/image error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
