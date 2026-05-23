import { decimalsEqual, sumDecimals } from './money.utils';

describe('sumDecimals', () => {
  it('sums evenly split amounts', () => {
    expect(sumDecimals(['150.00', '150.00', '150.00'])).toBe('450.00');
  });

  it('handles fractional cents correctly', () => {
    expect(sumDecimals(['33.33', '33.33', '33.34'])).toBe('100.00');
  });

  it('sums single value', () => {
    expect(sumDecimals(['450.00'])).toBe('450.00');
  });
});

describe('decimalsEqual', () => {
  it('exact match', () => {
    expect(decimalsEqual('450.00', '450.00')).toBe(true);
  });

  it('within 1 cent tolerance', () => {
    expect(decimalsEqual('449.99', '450.00')).toBe(true);
  });

  it('exceeds 1 cent tolerance', () => {
    expect(decimalsEqual('449.50', '450.00')).toBe(false);
  });

  it('custom tolerance', () => {
    expect(decimalsEqual('449.50', '450.00', 50)).toBe(true);
  });
});
