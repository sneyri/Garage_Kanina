describe('Столкновения (CollidersService)', () => {
  let colliders;

  beforeEach(() => {
    colliders = new GK.CollidersService();
    colliders.add(0, 2, 0, 2, 'box'); // квадрат 2×2
  });

  it('выталкивает круг, который залез в стену сбоку', () => {
    const p = colliders.resolve(-0.1, 1, 0.3);
    expect(p.x).toBeCloseTo(-0.3, 5);
    expect(p.z).toBeCloseTo(1, 5);
  });

  it('не трогает круг, который стоит свободно', () => {
    expect(colliders.resolve(-1, 1, 0.3)).toEqual({ x: -1, z: 1 });
  });

  it('если центр оказался внутри — выталкивает по кратчайшей оси', () => {
    const p = colliders.resolve(1.9, 1, 0.3);
    expect(p.x).toBeCloseTo(2.3, 5);
  });

  it('isFree', () => {
    expect(colliders.isFree(1, 1, 0.1)).toBe(false);
    expect(colliders.isFree(3, 3, 0.3)).toBe(true);
  });

  it('segmentBlocked видит стену между точками', () => {
    expect(colliders.segmentBlocked(-1, 1, 3, 1)).toBe(true);
    expect(colliders.segmentBlocked(-1, 3, 3, 3)).toBe(false);
    expect(colliders.segmentBlocked(-1, 1, 3, 1, 'box')).toBe(false);
  });

  it('removeTag убирает группу коллайдеров', () => {
    colliders.add(5, 6, 5, 6, 'door');
    colliders.removeTag('door');
    expect(colliders.isFree(5.5, 5.5, 0.1)).toBe(true);
    expect(colliders.isFree(1, 1, 0.1)).toBe(false);
  });
});
