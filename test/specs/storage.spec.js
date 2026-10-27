describe('Хранилище: localStorage + cookie + память', () => {
  const { FakeStorage, FakeDocument, storageApp } = GKFakes;

  describe('CookieService', () => {
    it('пишет и читает кириллицу и JSON', async () => {
      const doc = new FakeDocument();
      const app = await storageApp(new FakeStorage(), doc);
      const cookies = app.get(GK.CookieService);
      expect(cookies.write('t', '{"имя":"Канин"}')).toBe(true);
      expect(cookies.read('t')).toBe('{"имя":"Канин"}');
      expect(doc.cookie).toContain('gk_t=');
    });

    it('remove удаляет cookie', async () => {
      const app = await storageApp(new FakeStorage(), new FakeDocument());
      const cookies = app.get(GK.CookieService);
      cookies.write('t', '1');
      cookies.remove('t');
      expect(cookies.read('t')).toBeNull();
    });

    it('слишком длинное значение не пишется (лимит cookie ~4 КБ)', async () => {
      const app = await storageApp(new FakeStorage(), new FakeDocument());
      expect(app.get(GK.CookieService).write('big', 'я'.repeat(3000))).toBe(false);
    });

    it('у file:// в Chrome cookie не сохраняются — сервис это замечает', async () => {
      const app = await storageApp(new FakeStorage(), new FakeDocument({ disabled: true }));
      expect(app.get(GK.CookieService).isAvailable()).toBe(false);
    });
  });

  describe('StorageService', () => {
    it('пишет JSON в localStorage с префиксом gk:', async () => {
      const local = new FakeStorage();
      const app = await storageApp(local, new FakeDocument());
      const storage = app.get(GK.StorageService);
      storage.set('x', { a: 1 });
      expect(local.getItem('gk:x')).toBe('{"a":1}');
      expect(storage.get('x')).toEqual({ a: 1 });
      expect(storage.mode).toBe('localStorage');
    });

    it('ключи с { cookie: true } дублируются в cookie', async () => {
      const doc = new FakeDocument();
      const app = await storageApp(new FakeStorage(), doc);
      app.get(GK.StorageService).set('settings', { v: 1 }, { cookie: true });
      expect(doc.cookie).toContain('gk_settings=');
    });

    it('если localStorage очистили — данные поднимаются из cookie', async () => {
      const local = new FakeStorage();
      const app = await storageApp(local, new FakeDocument());
      const storage = app.get(GK.StorageService);
      storage.set('settings', { v: 2 }, { cookie: true });
      local.clear();
      storage.memory.data.clear();
      expect(storage.get('settings')).toEqual({ v: 2 });
    });

    it('без localStorage основным хранилищем становятся cookie', async () => {
      const app = await storageApp(null, new FakeDocument());
      const storage = app.get(GK.StorageService);
      expect(storage.mode).toBe('cookie');
      storage.set('k', [1, 2]);
      storage.memory.data.clear();
      expect(storage.get('k')).toEqual([1, 2]);
    });

    it('переполненный localStorage считается недоступным', async () => {
      const local = new FakeStorage();
      local.broken = true;
      const app = await storageApp(local, new FakeDocument());
      expect(app.get(GK.StorageService).mode).toBe('cookie');
    });

    it('когда недоступно ничего — живём в памяти и не падаем', async () => {
      const app = await storageApp(null, new FakeDocument({ disabled: true }));
      const storage = app.get(GK.StorageService);
      expect(storage.mode).toBe('memory');
      expect(storage.set('k', 1)).toBe(false);
      expect(storage.get('k')).toBe(1);
    });

    it('битый JSON возвращает значение по умолчанию', async () => {
      const local = new FakeStorage();
      local.setItem('gk:save', '{сломано');
      const app = await storageApp(local, new FakeDocument());
      expect(app.get(GK.StorageService).get('save', 'нет')).toBe('нет');
    });
  });

  describe('SaveService', () => {
    it('без сохранения load() возвращает null', async () => {
      const app = await storageApp(new FakeStorage(), new FakeDocument());
      expect(app.get(GK.SaveService).load()).toBeNull();
      expect(app.get(GK.SaveService).hasSave()).toBe(false);
    });

    it('save() дополняет данные, а load() их возвращает', async () => {
      const app = await storageApp(new FakeStorage(), new FakeDocument());
      const save = app.get(GK.SaveService);
      save.save({ day: 2, completedDays: [1] });
      save.save({ stats: { scares: 3 } });
      const loaded = save.load();
      expect(loaded.day).toBe(2);
      expect(loaded.completedDays).toEqual([1]);
      expect(loaded.stats.scares).toBe(3);
      expect(loaded.stats.playTime).toBe(0);
      expect(loaded.version).toBe(GK.SAVE_VERSION);
    });

    it('migrate чинит мусор из хранилища', async () => {
      const local = new FakeStorage();
      local.setItem('gk:save', JSON.stringify({ day: -4, completedDays: [1, 'два', 2.5], stats: { scares: 'много' } }));
      const app = await storageApp(local, new FakeDocument());
      const loaded = app.get(GK.SaveService).load();
      expect(loaded.day).toBe(1);
      expect(loaded.completedDays).toEqual([1]);
      expect(loaded.stats.scares).toBe(0);
    });

    it('в cookie лежит только компактная версия сохранения', async () => {
      const doc = new FakeDocument();
      const app = await storageApp(new FakeStorage(), doc);
      app.get(GK.SaveService).save({ day: 2, completedDays: [1] });
      const cookie = JSON.parse(app.get(GK.CookieService).read('save'));
      expect(Object.keys(cookie).sort()).toEqual(['day', 'finished', 'savedAt', 'version']);
      expect(cookie.day).toBe(2);
    });

    it('reset() удаляет сохранение отовсюду', async () => {
      const doc = new FakeDocument();
      const app = await storageApp(new FakeStorage(), doc);
      const save = app.get(GK.SaveService);
      save.save({ day: 2 });
      save.reset();
      expect(save.load()).toBeNull();
      expect(doc.cookie).not.toContain('gk_save=');
    });

    it('шлёт событие save.written', async () => {
      const app = await storageApp(new FakeStorage(), new FakeDocument());
      const spy = GKTest.fn();
      app.get(GK.EventBus).on('save.written', spy);
      app.get(GK.SaveService).save({ day: 1 });
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
