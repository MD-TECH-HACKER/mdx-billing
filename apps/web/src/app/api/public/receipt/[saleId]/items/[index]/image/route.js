import sql from "@/app/api/utils/sql";
import { verifyPublicReceiptToken } from "@/app/api/utils/publicReceiptToken";

export async function GET(request, { params }) {
  try {
    const saleId = Number.parseInt(params.saleId, 10);
    const index = Number.parseInt(params.index, 10);
    
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!saleId || Number.isNaN(index) || !token) return new Response("Not found", { status: 404 });

    const rows = await sql`SELECT * FROM sales WHERE sale_id = ${saleId} LIMIT 1`;
    if (!rows.length) return new Response("Not found", { status: 404 });

    const sale = rows[0];
    const isValid = verifyPublicReceiptToken(sale, token);
    if (!isValid) return new Response("Unauthorized", { status: 401 });

    const items = typeof sale.items === "string" ? JSON.parse(sale.items) : sale.items;
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
    console.error("GET /api/public/receipt/[saleId]/items/[index]/image error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
