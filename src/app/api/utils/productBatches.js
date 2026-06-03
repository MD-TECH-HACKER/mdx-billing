function round(value, precision = 6) {
  const scale = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function batchQuantity(batch) {
  return Math.max(0, number(batch.quantity_remaining_base_unit ?? batch.quantity_remaining));
}

function batchCostPerBaseUnit(batch, product = {}) {
  if (batch.cost_price_base_unit !== undefined && batch.cost_price_base_unit !== null) {
    return money(batch.cost_price_base_unit);
  }
  const conversionRate = number(
    batch.conversion_rate_snapshot ?? product.conversion_rate ?? product.conversionRate,
  );
  return conversionRate > 0 ? money(number(batch.cost_price) / conversionRate) : money(batch.cost_price);
}

export function allocateFifoBatches({
  quantityBaseUnit,
  sellingPricePerBaseUnit,
  batches,
  product,
}) {
  let remaining = round(quantityBaseUnit);
  const salePrice = money(sellingPricePerBaseUnit);
  const sortedBatches = [...(batches || [])]
    .filter((batch) => batchQuantity(batch) > 0)
    .sort((a, b) => {
      const dateA = new Date(a.purchase_date || a.created_at || 0).getTime();
      const dateB = new Date(b.purchase_date || b.created_at || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return number(a.batch_id) - number(b.batch_id);
    });

  const allocations = [];
  for (const batch of sortedBatches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batchQuantity(batch));
    const costPerBaseUnit = batchCostPerBaseUnit(batch, product);
    const totalCost = money(take * costPerBaseUnit);
    const revenueAtSelectedSalePrice = money(take * salePrice);
    allocations.push({
      batchId: batch.batch_id,
      quantityBaseUnit: round(take),
      costPriceAtSale: costPerBaseUnit,
      sellingPriceAtSale: salePrice,
      totalCost,
      revenueAtSelectedSalePrice,
      profitAmount: money(revenueAtSelectedSalePrice - totalCost),
      marginPercent: revenueAtSelectedSalePrice > 0
        ? money(((revenueAtSelectedSalePrice - totalCost) / revenueAtSelectedSalePrice) * 100)
        : 0,
    });
    remaining = round(remaining - take);
  }

  if (remaining > 0) {
    throw new Error("Not enough batch stock");
  }

  const totalCost = money(allocations.reduce((sum, item) => sum + item.totalCost, 0));
  const totalRevenue = money(
    allocations.reduce((sum, item) => sum + item.revenueAtSelectedSalePrice, 0),
  );
  return {
    allocations,
    totalCost,
    totalRevenue,
    totalProfit: money(totalRevenue - totalCost),
  };
}
