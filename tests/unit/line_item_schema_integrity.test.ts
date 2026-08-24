import { lineItemSchema } from '../../packages/shared/src';

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
});
