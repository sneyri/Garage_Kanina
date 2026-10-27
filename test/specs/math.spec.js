describe('Математика (GK.math)', () => {
  const M = GK.math;

  it('clamp и lerp', () => {
    expect(M.clamp(5, 0, 1)).toBe(1);
    expect(M.clamp(-5, 0, 1)).toBe(0);
    expect(M.lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('damp приближается к цели и не перескакивает её', () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v = M.damp(v, 1, 5, 1 / 60);
    expect(v).toBeGreaterThan(0.99);
    expect(v).toBeLessThan(1.0000001);
  });

  it('rng детерминированный: один seed — одна последовательность', () => {
    const a = M.rng(42), b = M.rng(42), c = M.rng(43);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(c()).not.toBe(first[0]);
  });

  it('weightedPick учитывает веса', () => {
    const list = [{ id: 'a', weight: 0 }, { id: 'b', weight: 1 }];
    for (let i = 0; i < 20; i++) expect(M.weightedPick(list).id).toBe('b');
  });

  it('wrapAngle держит угол в пределах ±π', () => {
    expect(M.wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 5);
    expect(M.wrapAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('formatTime', () => {
    expect(M.formatTime(68.9)).toBe('01:08');
    expect(M.formatTime(0)).toBe('00:00');
  });
});
