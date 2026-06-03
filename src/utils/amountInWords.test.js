import { describe, expect, test } from "vitest";
import { inrAmountInWords } from "./amountInWords";

describe("INR amount in words", () => {
  test("formats invoice totals using Indian number groups", () => {
    expect(inrAmountInWords(870)).toBe("Rupees Eight Hundred Seventy Only");
    expect(inrAmountInWords(125043.5)).toBe(
      "Rupees One Lakh Twenty Five Thousand Forty Three and Fifty Paise Only",
    );
  });
});
