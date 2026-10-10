const decimalFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const roundedFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// "Sle" (Sierra Leonean Leone) prefix, formatted manually rather than via
// Intl's `style: 'currency'` — ICU's own rendering of the "SLE" currency
// code doesn't match the "Sle 1,500.00" look this app wants everywhere.
export function formatCurrency(amount, { rounded = false } = {}) {
  const value = Number(amount ?? 0);
  const formatter = rounded ? roundedFormatter : decimalFormatter;
  return `Sle ${formatter.format(value)}`;
}
