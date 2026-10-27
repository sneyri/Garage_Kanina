describe('Состояние игры', () => {
  async function make() {
    return GK.testing.Test.createTestingModule({ imports: [GK.SharedModule, GK.GameStateModule] }).compile();
  }

  it('начинается с заставки', async () => {
    expect((await make()).get(GK.GameStateService).state).toBe('boot');
  });

  it('разрешённый переход шлёт state.changed', async () => {
    const app = await make();
    const spy = GKTest.fn();
    app.get(GK.EventBus).on('state.changed', spy);
    const gs = app.get(GK.GameStateService);
    expect(gs.set('menu', 'тест')).toBe(true);
    expect(spy).toHaveBeenCalledWith({ from: 'boot', to: 'menu', reason: 'тест' }, 'state.changed');
    expect(gs.is('menu', 'playing')).toBe(true);
  });

  it('запрещённый переход игнорируется', async () => {
    const gs = (await make()).get(GK.GameStateService);
    expect(gs.set('paused')).toBe(false);
    expect(gs.state).toBe('boot');
  });

  it('полный круг: меню → карточка дня → игра → пауза → игра → меню', async () => {
    const gs = (await make()).get(GK.GameStateService);
    ['menu', 'cutscene', 'playing', 'paused', 'playing', 'menu'].forEach((s) => expect(gs.set(s)).toBe(true));
  });
});
