const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(number) {
  if (number < 20) return ONES[number];
  if (number < 100) return `${TENS[Math.floor(number / 10)]} ${ONES[number % 10]}`.trim();
  return `${ONES[Math.floor(number / 100)]} Hundred ${belowThousand(number % 100)}`.trim();
}

function indianIntegerWords(number) {
  if (number === 0) return "Zero";
  const parts = [];
  const groups = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]];
  let remaining = number;
  for (const [size, label] of groups) {
    if (remaining >= size) {
      parts.push(`${belowThousand(Math.floor(remaining / size))} ${label}`);
      remaining %= size;
    }
  }
  if (remaining) parts.push(belowThousand(remaining));
  return parts.join(" ");
}

export function inrAmountInWords(value) {
  const totalPaise = Math.round(Math.max(0, Number(value) || 0) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const paiseWords = paise ? ` and ${indianIntegerWords(paise)} Paise` : "";
  return `Rupees ${indianIntegerWords(rupees)}${paiseWords} Only`;
}
