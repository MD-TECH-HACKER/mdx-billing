export const PRODUCT_UNITS = [
  { value: "piece", label: "Piece" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "liter", label: "Liter" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "meter", label: "Meter" },
  { value: "cm", label: "Centimeter (cm)" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "dozen", label: "Dozen" },
  { value: "bottle", label: "Bottle" },
  { value: "bag", label: "Bag" },
];

const ALLOWED_PRODUCT_UNITS = new Set(PRODUCT_UNITS.map((unit) => unit.value));

export function sanitizeProductUnit(value, { fallback = null } = {}) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (ALLOWED_PRODUCT_UNITS.has(normalized)) return normalized;
  return fallback;
}

export function getProductUnitLabel(product) {
  const primary = sanitizeProductUnit(product?.primary_unit ?? product?.primaryUnit, { fallback: "piece" });
  const secondary = sanitizeProductUnit(product?.secondary_unit ?? product?.secondaryUnit, { fallback: null });
  return secondary ? `${primary} / ${secondary}` : primary;
}
