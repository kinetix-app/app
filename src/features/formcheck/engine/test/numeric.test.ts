import { formatFixed, gradient, nanmedian, nanpercentile, roundHalfEven } from '../numeric';

describe('numeric helpers match Python/numpy', () => {
  it('rounds halves to even like round()', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, 2.4, 2.6].map(roundHalfEven)).toEqual([
      0, 2, 2, 0, -2, 2, 3,
    ]);
  });

  it('formats like f"{x:.Nf}", including exact ties', () => {
    expect(formatFixed(2.5, 0)).toBe('2');
    expect(formatFixed(3.5, 0)).toBe('4');
    expect(formatFixed(0.25, 1)).toBe('0.2'); // exact binary tie → even
    expect(formatFixed(0.35, 1)).toBe('0.3'); // 0.35 is 0.34999… in binary
    expect(formatFixed(1.005, 2)).toBe('1.00');
    expect(formatFixed(99.96, 1)).toBe('100.0');
    expect(formatFixed(-0.04, 1)).toBe('-0.0');
    expect(formatFixed(-1.25, 1)).toBe('-1.2');
  });

  it('computes percentiles and medians ignoring NaN', () => {
    expect(nanpercentile([1, 2, 3, 4], 95)).toBeCloseTo(3.85, 12);
    expect(nanpercentile([NaN, 5], 5)).toBe(5);
    expect(nanmedian([3, NaN, 1, 2])).toBe(2);
    expect(nanmedian([NaN])).toBeNaN();
  });

  it('takes gradients over uneven time steps', () => {
    const t = [0, 1, 3];
    const f = t.map((x) => x * x);
    expect(gradient(f, t)).toEqual([1, 2, 4]); // np.gradient([0, 1, 9], [0, 1, 3])
  });
});
