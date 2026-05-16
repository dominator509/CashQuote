import { calculateLineItemsSubtotal, calculateTotals } from '../../server/src/services/billing/math.service';

const runTests = () => {
  console.log('Running math unit tests...');

  // Test Subtotals
  const items = [
    { quantity: 2, price: 1500 }, // 3000
    { quantity: 1, price: 500 },  // 500
  ];
  const subtotal = calculateLineItemsSubtotal(items);
  if (subtotal !== 3500) throw new Error(`Subtotal failed: Expected 3500, got ${subtotal}`);

  // Test Totals (Standard)
  const totals1 = calculateTotals(3500, 10, 500); // taxable: 3000, tax 10% = 300, total = 3300
  if (totals1.total !== 3300) throw new Error(`Totals 1 failed: Expected 3300, got ${totals1.total}`);

  // Test Totals (Rounding)
  const totals2 = calculateTotals(100, 8, 0); // taxable 100, tax 8% = 8, total = 108
  if (totals2.total !== 108) throw new Error(`Totals 2 failed: Expected 108, got ${totals2.total}`);

  const totals3 = calculateTotals(125, 8.5, 0); // taxable 125, tax 8.5% = 10.625 => 11, total 136
  if (totals3.total !== 136) throw new Error(`Totals 3 failed: Expected 136, got ${totals3.total}`);

  // Test Totals (Negative bounds)
  const totals4 = calculateTotals(-100, -5, 5000);
  // subtotal 0, discount 5000, taxable 0, tax 0, total 0
  if (totals4.total !== 0) throw new Error(`Totals 4 failed: Expected 0, got ${totals4.total}`);

  console.log('Math unit tests passed!');
};

runTests();
