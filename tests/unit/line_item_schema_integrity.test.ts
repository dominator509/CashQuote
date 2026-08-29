import {
  createInvoiceSchema,
  createQuoteSchema,
  lineItemSchema,
  MAX_FINANCIAL_SUBTOTAL_CENTS,
} from '../../packages/shared/src';

describe('line item schema integrity', () => {
  it('trims line item descriptions and categories', () => {
    const parsed = lineItemSchema.parse({
      description: '  Onsite repair  ',
      quantity: 1,
      price: 25000,
      category: '  service  ',
    });

    expect(parsed.description).toBe('Onsite repair');
    expect(parsed.category).toBe('service');
  });

  it('rejects blank descriptions and categories after trimming', () => {
    expect(() =>
      lineItemSchema.parse({
        description: '   ',
        quantity: 1,
        price: 25000,
      })
    ).toThrow();

    expect(() =>
      lineItemSchema.parse({
        description: 'Onsite repair',
        quantity: 1,
        price: 25000,
        category: '   ',
      })
    ).toThrow();
  });

  it('caps oversized quantities, prices, descriptions, and categories', () => {
    expect(() =>
      lineItemSchema.parse({
        description: 'Onsite repair',
        quantity: 10_001,
        price: 25000,
      })
    ).toThrow();

    expect(() =>
      lineItemSchema.parse({
        description: 'Onsite repair',
        quantity: 1,
        price: 100_000_001,
      })
    ).toThrow();

    expect(() =>
      lineItemSchema.parse({
        description: 'x'.repeat(501),
        quantity: 1,
        price: 25000,
      })
    ).toThrow();

    expect(() =>
      lineItemSchema.parse({
        description: 'Onsite repair',
        quantity: 1,
        price: 25000,
        category: 'x'.repeat(51),
      })
    ).toThrow();
  });

  it('rejects persisted line-item totals that can overflow database financial columns', () => {
    const overLimitLineItems = [
      { description: 'Large project', quantity: 10, price: 100_000_000 },
      {
        description: 'Additional work',
        quantity: 1,
        price: MAX_FINANCIAL_SUBTOTAL_CENTS - 1_000_000_000 + 1,
      },
    ];

    expect(() =>
      createQuoteSchema.parse({
        clientId: '11111111-1111-4111-8111-111111111111',
        lineItems: overLimitLineItems,
      })
    ).toThrow();

    expect(() =>
      createInvoiceSchema.parse({
        clientId: '11111111-1111-4111-8111-111111111111',
        lineItems: overLimitLineItems,
      })
    ).toThrow();
  });
});
