/**
 * Проверки построенного мира. Нужен WebGL, поэтому только в браузере
 * (откройте test/index.html). В Node эти тесты пропускаются.
 */
describe.browser('Мир (нужен браузер)', () => {
  let world, colliders;

  beforeEach(async () => {
    if (world) return; // строим мир один раз — это ~1 секунда
    const app = await GK.testing.Test.createTestingModule({ imports: [GK.SharedModule, GK.WorldModule] })
      .overrideProvider(GK.TOKENS.WEB_STORAGE).useValue(new GKFakes.FakeStorage())
      .overrideProvider(GK.TOKENS.DOCUMENT).useValue(new GKFakes.FakeDocument())
      .compile();
    world = app.get(GK.WorldService);
    colliders = app.get(GK.CollidersService);
  });

  it('мир построился', () => {
    expect(world.ready).toBe(true);
  });

  it('все цели заданий из LAYOUT существуют, у полок нужное число слотов', () => {
    GK.LAYOUT.targetIds.forEach((id) => {
      expect(world.targets[id]).toBeDefined();
      expect(world.targets[id].proxy).toBeDefined();
    });
    Object.keys(GK.LAYOUT.slots).forEach((id) => expect(world.targets[id].slots).toHaveLength(GK.LAYOUT.slots[id]));
  });

  it('точка появления игрока свободна', () => {
    expect(colliders.isFree(GK.LAYOUT.spawn.x, GK.LAYOUT.spawn.z, 0.3)).toBe(true);
  });

  it('предметы на полу и пятна не застряли в стенах и мебели', () => {
    GK.DAYS.forEach((day) => {
      day.items.filter((i) => i.pos[1] < 0.05).forEach((item) => {
        const p = world.resolvePosition(item.pos, item.space);
        if (!colliders.isFree(p.x, p.z, 0.08)) throw new Error('День ' + day.day + ': предмет ' + item.id + ' внутри коллайдера');
      });
      day.tasks.filter((t) => t.type === 'clean').forEach((t) => t.spots.forEach((s, i) => {
        const p = world.toWorld(s[0], 0, s[1]);
        if (!colliders.isFree(p.x, p.z, 0.1)) throw new Error('День ' + day.day + ': пятно ' + i + ' под мебелью');
      }));
    });
  });

  it('точки появления «Типа» не внутри стен', () => {
    world.row.stalkerSpots.forEach((s) => {
      if (!colliders.isFree(s.x, s.z, 0.3)) throw new Error('Точка ' + s.x + ', ' + s.z + ' внутри коллайдера');
    });
  });

  it('проезд от ворот до гаража Канина проходим', () => {
    // шагаем по прямой от въезда до ворот гаража и проверяем, что нигде не упёрлись
    const from = { x: 0, z: GK.LAYOUT.spawn.z }, to = { x: 2.5, z: -6.75 };
    for (let t = 0; t <= 1; t += 0.02) {
      const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
      if (!colliders.isFree(x, z, 0.3)) throw new Error('Путь перекрыт в точке ' + x.toFixed(1) + ', ' + z.toFixed(1));
    }
  });

  it('у гаража Канина есть дверь, щиток, люк и лампа', () => {
    const g = world.garage;
    expect(g.door.objects).toHaveLength(2);
    expect(g.panel.proxy).toBeDefined();
    expect(g.hatch.proxy).toBeDefined();
    expect(g.led.proxy).toBeDefined();
  });
});
