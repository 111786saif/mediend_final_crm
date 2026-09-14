export function parseRupees(input: string): number {
  const clean = input.replace(/,/g, "").trim();
  if (!clean) return 0;
  const num = Number(clean);
  if (Number.isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function formatMoney(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function moneyInput(paise: number): string {
  return (paise / 100).toFixed(2);
}
