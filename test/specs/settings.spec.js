describe('Настройки', () => {
  const { FakeStorage, FakeDocument, storageApp } = GKFakes;
  const app = (local, doc) => storageApp(local || new FakeStorage(), doc || new FakeDocument(), [GK.SettingsModule]);

  it('по умолчанию берутся значения из схемы', async () => {
    const settings = (await app()).get(GK.SettingsService);
    expect(settings.get('quality')).toBe('medium');
    expect(settings.get('masterVolume')).toBe(GK.SETTINGS_SCHEMA.masterVolume.default);
  });

  it('числа зажимаются в границы, неверные типы отбрасываются', async () => {
    const settings = (await app()).get(GK.SettingsService);
    expect(settings.set('masterVolume', 5)).toBe(true);
    expect(settings.get('masterVolume')).toBe(1);
    expect(settings.set('fov', 'много')).toBe(false);
    expect(settings.set('quality', 'ultra')).toBe(false);
    expect(settings.set('несуществующая', 1)).toBe(false);
    expect(settings.set('invertY', 'true')).toBe(true);
    expect(settings.get('invertY')).toBe(true);
  });

  it('изменения сохраняются и читаются при следующем запуске', async () => {
    const local = new FakeStorage(), doc = new FakeDocument();
    (await app(local, doc)).get(GK.SettingsService).set('sensitivity', 2.5);
    const again = (await app(local, doc)).get(GK.SettingsService);
    expect(again.get('sensitivity')).toBe(2.5);
  });

  it('испорченное значение в хранилище заменяется значением по умолчанию', async () => {
    const local = new FakeStorage();
    local.setItem('gk:settings', JSON.stringify({ fov: 'abc', quality: 'high', grain: 0 }));
    const settings = (await app(local)).get(GK.SettingsService);
    expect(settings.get('fov')).toBe(GK.SETTINGS_SCHEMA.fov.default);
    expect(settings.get('quality')).toBe('high');
    expect(settings.get('grain')).toBe(false);
  });

  it('шлёт settings.changed только при реальном изменении', async () => {
    const a = await app();
    const spy = GKTest.fn();
    a.get(GK.EventBus).on('settings.changed', spy);
    const settings = a.get(GK.SettingsService);
    settings.set('fov', 80);
    settings.set('fov', 80);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ key: 'fov', value: 80 }, 'settings.changed');
  });

  it('reset() возвращает значения по умолчанию и сообщает об изменённых ключах', async () => {
    const a = await app();
    const settings = a.get(GK.SettingsService);
    settings.set('fov', 90);
    const spy = GKTest.fn();
    a.get(GK.EventBus).on('settings.changed', spy);
    settings.reset();
    expect(settings.get('fov')).toBe(GK.SETTINGS_SCHEMA.fov.default);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
