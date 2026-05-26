// Currency helpers — defaults to INR

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "Mex$", name: "Mexican Peso" },
];

const LOCALE_BY_CODE = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  AUD: "en-AU",
  CAD: "en-CA",
  CHF: "de-CH",
  CNY: "zh-CN",
  AED: "ar-AE",
  SAR: "ar-SA",
  SGD: "en-SG",
  MYR: "ms-MY",
  ZAR: "en-ZA",
  BRL: "pt-BR",
  MXN: "es-MX",
};

export function getCurrencyInfo(code) {
  return (
    CURRENCIES.find((c) => c.code === (code || "").toUpperCase()) ||
    CURRENCIES[0]
  );
}

export function formatMoney(value, code = "INR", options = {}) {
  const n = Number(value) || 0;
  const c = (code || "INR").toUpperCase();
  const locale = LOCALE_BY_CODE[c] || "en-IN";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: c,
      maximumFractionDigits: options.maxDigits ?? 2,
      minimumFractionDigits: options.minDigits ?? 2,
    }).format(n);
  } catch {
    const info = getCurrencyInfo(c);
    return `${info.symbol}${n.toFixed(2)}`;
  }
}

export function getSymbol(code = "INR") {
  return getCurrencyInfo(code).symbol;
}
