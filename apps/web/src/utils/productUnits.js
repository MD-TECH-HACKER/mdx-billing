export const PRODUCT_UNITS = [
  { value: "pcs", label: "Pieces / Pcs" },
  { value: "piece", label: "Piece" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "bag", label: "Bag" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram" },
  { value: "g", label: "Gram (g)" },
  { value: "liter", label: "Liter" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "meter", label: "Meter" },
  { value: "feet", label: "Feet" },
  { value: "cm", label: "Centimeter (cm)" },
  { value: "dozen", label: "Dozen" },
  { value: "set", label: "Set" },
  { value: "bottle", label: "Bottle" },
  { value: "roll", label: "Roll" },
];

const ALLOWED_PRODUCT_UNITS = new Set(PRODUCT_UNITS.map((unit) => unit.value));

function rounded(value, precision = 6) {
  const scale = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}

export function sanitizeProductUnit(value, { fallback = null } = {}) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (ALLOWED_PRODUCT_UNITS.has(normalized)) return normalized;
  return fallback;
}

export function sanitizeConversionRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rounded(rate) : null;
}

export function getUnitModel(product = {}) {
  const primaryUnit = sanitizeProductUnit(
    product.primary_unit ?? product.primaryUnit,
    { fallback: "piece" },
  );
  const secondaryUnit = sanitizeProductUnit(
    product.secondary_unit ?? product.secondaryUnit,
    { fallback: null },
  );
  const conversionRate = secondaryUnit
    ? sanitizeConversionRate(product.conversion_rate ?? product.conversionRate)
    : null;

  return {
    primaryUnit,
    secondaryUnit,
    conversionRate,
    baseUnit: conversionRate ? secondaryUnit : primaryUnit,
  };
}

export function getProductUnitLabel(product) {
  const { primaryUnit, secondaryUnit } = getUnitModel(product);
  return secondaryUnit ? `${primaryUnit} / ${secondaryUnit}` : primaryUnit;
}

export function availableSaleUnits(product) {
  const { primaryUnit, secondaryUnit, conversionRate } = getUnitModel(product);
  return secondaryUnit && conversionRate ? [primaryUnit, secondaryUnit] : [primaryUnit];
}

export function toBaseQuantity(quantity, selectedUnit, product) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || amount < 0) return 0;

  const { primaryUnit, secondaryUnit, conversionRate } = getUnitModel(product);
  const unit = sanitizeProductUnit(selectedUnit, { fallback: primaryUnit });
  if (secondaryUnit && conversionRate && unit === primaryUnit) {
    return rounded(amount * conversionRate);
  }
  if (unit !== primaryUnit && unit !== secondaryUnit) {
    return 0;
  }
  return rounded(amount);
}

export function fromBaseQuantity(baseQuantity, outputUnit, product) {
  const amount = Math.max(0, Number(baseQuantity) || 0);
  const { primaryUnit, secondaryUnit, conversionRate } = getUnitModel(product);
  const unit = sanitizeProductUnit(outputUnit, { fallback: primaryUnit });
  if (secondaryUnit && conversionRate && unit === primaryUnit) {
    return rounded(amount / conversionRate);
  }
  return unit === primaryUnit || unit === secondaryUnit ? rounded(amount) : 0;
}

export function priceForUnit(primaryUnitPrice, selectedUnit, product) {
  const price = Math.max(0, Number(primaryUnitPrice) || 0);
  const { primaryUnit, secondaryUnit, conversionRate } = getUnitModel(product);
  const unit = sanitizeProductUnit(selectedUnit, { fallback: primaryUnit });
  if (secondaryUnit && conversionRate && unit === secondaryUnit) {
    return rounded(price / conversionRate, 2);
  }
  return unit === primaryUnit ? rounded(price, 2) : 0;
}

export function getStockBaseQuantity(product) {
  const storedBase = product?.stock_base_unit ?? product?.stockBaseUnit;
  if (storedBase !== undefined && storedBase !== null) {
    return Math.max(0, rounded(storedBase));
  }
  return toBaseQuantity(product?.stock ?? 0, getUnitModel(product).primaryUnit, product);
}

function displayNumber(value) {
  const amount = rounded(value, 3);
  return Number.isInteger(amount) ? String(amount) : String(amount);
}

export function formatStockQuantity(baseQuantity, product) {
  const { primaryUnit, secondaryUnit } = getUnitModel(product);
  const stockBase = Math.max(0, Number(baseQuantity) || 0);
  if (!secondaryUnit || !getUnitModel(product).conversionRate) {
    return `${displayNumber(stockBase)} ${primaryUnit}`;
  }
  return `${displayNumber(fromBaseQuantity(stockBase, primaryUnit, product))} ${primaryUnit} / ${displayNumber(stockBase)} ${secondaryUnit}`;
}
