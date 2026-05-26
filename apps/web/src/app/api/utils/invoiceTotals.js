function currency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateInvoiceTotals(subtotalValue, taxPercentValue, discountValue) {
  const subtotal = currency(Math.max(0, Number(subtotalValue) || 0));
  const taxPercent = Math.max(0, Math.min(100, Number(taxPercentValue) || 0));
  const discountAmount = currency(
    Math.min(subtotal, Math.max(0, Number(discountValue) || 0)),
  );
  const taxableAmount = currency(subtotal - discountAmount);
  const taxAmount = currency(taxableAmount * (taxPercent / 100));
  const grandTotal = currency(taxableAmount + taxAmount);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    grandTotal,
  };
}
