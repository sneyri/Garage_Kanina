/**
 * Проверки конфига дней: ловят опечатки до того, как они сломают игру.
 * Добавил новый день — запусти тесты.
 */
describe('Конфиг дней (days.config.js)', () => {
  const DAYS = GK.DAYS, KINDS = GK.ITEM_KINDS, L = GK.LAYOUT;
  const garageBounds = (u, v) => u >= 0 && u <= L.garage.maxX - L.garage.minX && v >= -2 && v <= 2;

  it('дни идут по порядку с 1', () => {
    DAYS.forEach((d, i) => expect(d.day).toBe(i + 1));
  });

  DAYS.forEach((day) => {
    describe('день ' + day.day, () => {
      const ids = day.tasks.map((t) => t.id);

      it('id заданий уникальны, первым идёт разговор, последним — уход', () => {
        expect(new Set(ids).size).toBe(ids.length);
        expect(day.tasks[0].type).toBe('talk');
        expect(day.tasks[day.tasks.length - 1].type).toBe('leave');
      });

      it('requires ссылаются на существующие задания', () => {
        day.tasks.forEach((t) => (t.requires || []).forEach((r) => expect(ids).toContain(r)));
      });

      it('у Канина есть вступление', () => {
        expect(day.intro.length).toBeGreaterThan(0);
      });

      it('предметы: известные виды, уникальные id, лежат внутри гаража', () => {
        const itemIds = day.items.map((i) => i.id);
        expect(new Set(itemIds).size).toBe(itemIds.length);
        day.items.forEach((item) => {
          expect(Object.keys(KINDS)).toContain(item.kind);
          if (item.space !== 'world') expect(garageBounds(item.pos[0], item.pos[2])).toBe(true);
        });
      });

      it('цели заданий существуют в мире, предметов хватает', () => {
        day.tasks.filter((t) => t.type === 'deliver' || t.type === 'use').forEach((t) => {
          expect(L.targetIds).toContain(t.target);
          const available = day.items.filter((i) => i.kind === t.kind).length;
          expect(available).toBeGreaterThan((t.count || 1) - 1);
          if (L.slots[t.target]) expect(L.slots[t.target]).toBeGreaterThan((t.count || 1) - 1);
          if (t.type === 'use') {
            expect(typeof t.verb).toBe('string');
            expect(t.hold).toBeGreaterThan(0);
          }
        });
      });

      it('пятна: их ровно count, и все на полу гаража', () => {
        day.tasks.filter((t) => t.type === 'clean').forEach((t) => {
          expect(t.spots).toHaveLength(t.count);
          t.spots.forEach((s) => expect(garageBounds(s[0], s[1])).toBe(true));
        });
      });
    });
  });
});
