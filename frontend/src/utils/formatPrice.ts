export const formatPrice = (amount: number | string | null | undefined): string => {
  if (!amount) return "TZS 0";

  const number = typeof amount === "string" ? parseFloat(amount) : amount;

  return "TZS " + number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};
