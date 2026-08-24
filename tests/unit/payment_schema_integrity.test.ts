import { createPaymentSchema } from '../../packages/shared/src';

describe('payment schema integrity', () => {
  it('trims payment methods before persistence', () => {
    const parsed = createPaymentSchema.parse({
      amount: 100,
      method: '  manual  ',
    });

    expect(parsed.method).toBe('manual');
  });

  it('rejects blank payment methods after trimming', () => {
    expect(() =>
      createPaymentSchema.parse({
        amount: 100,
        method: '   ',
      })
    ).toThrow();
  });

  it('rejects excessively long payment methods', () => {
    expect(() =>
      createPaymentSchema.parse({
        amount: 100,
        method: 'x'.repeat(51),
      })
    ).toThrow();
  });
});
