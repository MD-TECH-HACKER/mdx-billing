import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const id = params.id;
    if (!id) return new Response("Not found", { status: 404 });

    const rows = await sql`SELECT shop_logo FROM shops WHERE shop_id = ${id}`;
    if (!rows.length || !rows[0].shop_logo) return new Response("Not found", { status: 404 });

    const logo = rows[0].shop_logo;
    
    // If it's base64, decode it and serve as a binary image
    const match = logo.match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/);
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
    if (logo.startsWith("http") || logo.startsWith("/")) {
      return Response.redirect(logo.startsWith("/") ? new URL(logo, request.url).href : logo);
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error("GET /api/public/shops/[id]/logo error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
