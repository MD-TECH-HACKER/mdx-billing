import { describe, expect, test } from "vitest";
import {
  escapeHtml,
  receiptEmailTemplate,
  teamInviteEmailTemplate,
} from "./emailTemplates";
import { isValidEmail, normalizeEmail } from "./email";

describe("email helpers", () => {
  test("validates and normalizes customer email addresses", () => {
    expect(normalizeEmail("  Customer@Example.COM  ")).toBe("customer@example.com");
    expect(isValidEmail("customer@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  test("escapes untrusted text before placing it in email HTML", () => {
    expect(escapeHtml(`<img src=x onerror=alert('x')>`)).toBe(
      "&lt;img src=x onerror=alert(&#39;x&#39;)&gt;",
    );
  });

  test("renders safe team invite and receipt email templates", () => {
    const inviteHtml = teamInviteEmailTemplate({
      shop: { shop_name: "<script>Shop</script>", shop_logo: "/logo.png" },
      invitedName: "Rahul",
      role: "manager",
      inviterName: "Owner",
      inviteUrl: "https://mdx-billing.app/invite/accept?token=abc",
    });
    expect(inviteHtml).toContain("You are invited to join MDX Billing App");
    expect(inviteHtml).toContain("&lt;script&gt;Shop&lt;/script&gt;");
    expect(inviteHtml).not.toContain("<script>Shop</script>");

    const receiptHtml = receiptEmailTemplate({
      sale: {
        receipt_number: "INV-1",
        buyer_name: "Customer",
        customer_email: "customer@example.com",
        created_at: "2026-05-26T10:00:00.000Z",
        total_amount: 100,
        paid_amount: 80,
        tax_amount: 5,
        discount_amount: 0,
        payment_method: "cash",
        currency: "INR",
        items: [{ productNameSnapshot: "Bag", quantity: 1, selectedUnit: "Bag", pricePerUnitAtSale: 100, totalAmount: 100 }],
      },
      shop: { shop_name: "Customer Shop", shop_logo: "/logo.png" },
      receiptUrl: "https://mdx-billing.app/receipt/1",
      downloadUrl: "https://mdx-billing.app/receipt/1?download=1",
    });
    expect(receiptHtml).toContain("Your receipt is ready");
    expect(receiptHtml).toContain("Receipt #INV-1");
    expect(receiptHtml).toContain("View Receipt");
    expect(receiptHtml).toContain("Download PDF");
    expect(receiptHtml).not.toContain("Cashier");
  });
});
