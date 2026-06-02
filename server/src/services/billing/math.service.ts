/**
 * All financial math is strictly calculated in integers (cents) to avoid floating point precision errors.
 */

export interface LineItemInput {
  quantity: number;
  price: number; // in cents
}

export interface FinancialTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export const calculateLineItemsSubtotal = (items: LineItemInput[]): number => {
  return items.reduce((acc, item) => acc + item.quantity * item.price, 0);
};

export const calculateTotals = (
  subtotal: number,
  taxRatePercent: number, // e.g. 8 for 8%
  discountAmount: number // in cents
): FinancialTotals => {
  if (subtotal < 0) subtotal = 0;
  if (discountAmount < 0) discountAmount = 0;
  if (taxRatePercent < 0) taxRatePercent = 0;

  let taxableAmount = subtotal - discountAmount;
  if (taxableAmount < 0) taxableAmount = 0;

  // We round tax to the nearest cent
  const tax = Math.round((taxableAmount * taxRatePercent) / 100);

  const total = taxableAmount + tax;

  return {
    subtotal,
    tax,
    discount: discountAmount,
    total,
  };
};
