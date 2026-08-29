import { createClientSchema } from '../../packages/shared/src';

describe('client schema integrity', () => {
  it('trims client names and billing addresses', () => {
    const parsed = createClientSchema.parse({
      name: '  Acme Services  ',
      billingAddress: '  100 Main St  ',
    });

    expect(parsed.name).toBe('Acme Services');
    expect(parsed.billingAddress).toBe('100 Main St');
  });

  it('trims and validates client email addresses', () => {
    const parsed = createClientSchema.parse({
      name: 'Acme Services',
      email: '  billing@example.com  ',
    });

    expect(parsed.email).toBe('billing@example.com');
    expect(() =>
      createClientSchema.parse({ name: 'Acme Services', email: 'not-an-email' })
    ).toThrow();
  });

  it('rejects blank client names after trimming', () => {
    expect(() => createClientSchema.parse({ name: '   ' })).toThrow();
  });

  it('normalizes tags and rejects blank tags', () => {
    const parsed = createClientSchema.parse({
      name: 'Acme Services',
      tags: ['  VIP  ', 'plumbing'],
    });

    expect(parsed.tags).toEqual(['VIP', 'plumbing']);
    expect(() =>
      createClientSchema.parse({
        name: 'Acme Services',
        tags: ['   '],
      })
    ).toThrow();
  });

  it('caps tag count and tag length', () => {
    expect(() =>
      createClientSchema.parse({
        name: 'Acme Services',
        tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
      })
    ).toThrow();

    expect(() =>
      createClientSchema.parse({
        name: 'Acme Services',
        tags: ['x'.repeat(51)],
      })
    ).toThrow();
  });
});
