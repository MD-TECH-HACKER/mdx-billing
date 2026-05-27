function cleanText(value) {
  return String(value ?? "")
    .replaceAll("₹", "Rs ")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value) {
  return cleanText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function shortText(value, length) {
  const text = cleanText(value);
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 3))}...`;
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN");
}

function textCommand(text, x, y, size = 9, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function lineCommand(fromX, fromY, toX, toY) {
  return `${fromX} ${fromY} m ${toX} ${toY} l S`;
}

export function buildInvoicePdfBytes(sale, { thermal = false, amountInWords = "" } = {}) {
  const width = thermal ? 226 : 595;
  const height = thermal ? 640 : 842;
  const margin = thermal ? 12 : 32;
  const pages = [];
  let commands;
  let y;

  const newPage = () => {
    commands = ["0.25 w"];
    pages.push(commands);
    y = height - margin;
  };
  const write = (text, x = margin, size = 9, font = "F1", step = size + 5) => {
    commands.push(textCommand(text, x, y, size, font));
    y -= step;
  };
  const divider = () => {
    commands.push(lineCommand(margin, y, width - margin, y));
    y -= 10;
  };
  const ensureSpace = (required) => {
    if (y >= required) return;
    newPage();
    write(`Invoice ${sale.receipt_number || ""} - continued`, margin, 10, "F2", 18);
  };

  newPage();
  write(sale.shop_name || "MDX Billing", margin, thermal ? 13 : 18, "F2", thermal ? 19 : 25);
  if (sale.address) write(shortText(sale.address, thermal ? 34 : 90), margin, 8);
  if (sale.phone) write(`Phone: ${sale.phone}`, margin, 8);
  if (sale.gstin) write(`GSTIN: ${sale.gstin}`, margin, 8);
  divider();
  const documentTitle =
    sale.invoice_type === "receipt"
      ? "RECEIPT"
      : sale.invoice_type === "estimate"
        ? "ESTIMATE / QUOTATION"
        : sale.invoice_type === "gst_invoice"
          ? "GST TAX INVOICE"
          : "INVOICE";
  write(documentTitle, margin, thermal ? 11 : 14, "F2", 19);
  write(`${sale.invoice_type === "estimate" ? "Estimate" : "Invoice"} No: ${sale.receipt_number || "-"}`, margin, 9);
  write(`Date: ${dateText(sale.created_at)}`, margin, 9);
  write(`Payment: ${sale.payment_method || "-"}`, margin, 9);
  y -= 3;
  write(`Bill To: ${sale.buyer_name || "-"}`, margin, 10, "F2");
  if (sale.buyer_phone) write(`Phone: ${sale.buyer_phone}`, margin, 9);
  divider();

  const items = Array.isArray(sale.items) ? sale.items : [];
  if (thermal) {
    write("# Item / Quantity                    Amount", margin, 8, "F2", 14);
    divider();
    items.forEach((item, index) => {
      ensureSpace(100);
      write(`${index + 1}. ${shortText(item.productNameSnapshot || item.title, 25)}`, margin, 8, "F2", 12);
      write(`${item.quantity || 0} ${item.selectedUnit || ""} x ${money(item.pricePerUnitAtSale ?? item.unitPrice)}    ${money(item.totalAmount ?? item.subtotal)}`, margin + 8, 8, "F1", 14);
    });
  } else {
    commands.push(textCommand("#", 32, y, 8, "F2"));
    commands.push(textCommand("Item Name", 50, y, 8, "F2"));
    commands.push(textCommand("HSN/SAC", 186, y, 8, "F2"));
    commands.push(textCommand("Qty", 242, y, 8, "F2"));
    commands.push(textCommand("Unit", 278, y, 8, "F2"));
    commands.push(textCommand("Price / Unit", 326, y, 8, "F2"));
    commands.push(textCommand("Discount", 405, y, 8, "F2"));
    commands.push(textCommand("Tax", 465, y, 8, "F2"));
    commands.push(textCommand("Amount", 515, y, 8, "F2"));
    y -= 14;
    divider();
    items.forEach((item, index) => {
      ensureSpace(120);
      commands.push(textCommand(index + 1, 32, y, 8));
      commands.push(textCommand(shortText(item.productNameSnapshot || item.title, 22), 50, y, 8));
      commands.push(textCommand(shortText(item.hsnSacSnapshot || "-", 8), 186, y, 8));
      commands.push(textCommand(item.quantity || 0, 242, y, 8));
      commands.push(textCommand(shortText(item.selectedUnit || "-", 7), 278, y, 8));
      commands.push(textCommand(money(item.pricePerUnitAtSale ?? item.unitPrice), 326, y, 8));
      commands.push(textCommand(money(item.discountAmount || 0), 405, y, 8));
      commands.push(textCommand(money(item.taxAmount || 0), 465, y, 8));
      commands.push(textCommand(money(item.totalAmount ?? item.subtotal), 515, y, 8));
      y -= 17;
    });
  }

  ensureSpace(thermal ? 115 : 150);
  divider();
  const totalsX = thermal ? margin : 390;
  write(`Subtotal: ${money(Number(sale.total_amount || 0) - Number(sale.tax_amount || 0) + Number(sale.discount_amount || 0))}`, totalsX, 9);
  if (Number(sale.discount_amount || 0) > 0) write(`Discount: ${money(sale.discount_amount)}`, totalsX, 9);
  if (Number(sale.tax_amount || 0) > 0) write(`Tax: ${money(sale.tax_amount)}`, totalsX, 9);
  write(`Grand Total: ${money(sale.total_amount)}`, totalsX, 10, "F2", 16);
  write(`Received: ${money(sale.paid_amount)}`, totalsX, 9);
  write(`Balance: ${money(Math.max(0, Number(sale.total_amount || 0) - Number(sale.paid_amount || 0)))}`, totalsX, 9, "F2", 18);
  if (!thermal && amountInWords) {
    write(`Amount in words: ${shortText(amountInWords, 90)}`, margin, 9, "F1", 17);
  }
  if (sale.default_terms && !thermal) {
    write("Terms & Conditions:", margin, 9, "F2", 14);
    write(shortText(sale.default_terms, 100), margin, 8, "F1", 18);
  }
  if (!thermal) {
    commands.push(textCommand("Authorized Signatory", width - 150, Math.max(margin + 10, y), 9, "F2"));
  } else if (sale.thank_you_message) {
    write(shortText(sale.thank_you_message, 34), margin, 8);
  }

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageIds = [];
  pages.forEach((page) => {
    const stream = page.join("\n");
    const contentId = objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function buildInvoicePdfBlob(sale, options) {
  return new Blob([buildInvoicePdfBytes(sale, options)], { type: "application/pdf" });
}
