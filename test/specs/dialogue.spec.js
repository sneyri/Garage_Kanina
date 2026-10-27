describe('Реплики (DialogueService)', () => {
  let dialogue, events;

  beforeEach(async () => {
    const app = await GK.testing.Test.createTestingModule({
      imports: [GK.SharedModule],
      providers: [GK.DialogueService],
    }).compile();
    dialogue = app.get(GK.DialogueService);
    dialogue.timeScale = 0.001; // реплики пролетают за миллисекунды
    events = app.get(GK.EventBus);
  });

  it('показывает реплики по очереди и завершает промис значением true', async () => {
    const shown = GKTest.fn(), hidden = GKTest.fn();
    events.on('subtitle.show', shown);
    events.on('subtitle.hide', hidden);
    const done = await dialogue.play('Канин', ['Раз.', 'Два.']);
    expect(done).toBe(true);
    expect(shown.calls.map((c) => c[0].text)).toEqual(['Раз.', 'Два.']);
    expect(shown.calls[0][0].speaker).toBe('Канин');
    expect(hidden).toHaveBeenCalledTimes(1);
    expect(dialogue.busy).toBe(false);
  });

  it('новая реплика перебивает старую — старая завершается false', async () => {
    const first = dialogue.play('Канин', ['Длинная история…', 'продолжение']);
    const second = dialogue.say('Смерть В Нищете', '…обернись.');
    expect(await first).toBe(false);
    expect(await second).toBe(true);
  });

  it('длительность растёт с длиной текста', () => {
    expect(dialogue.duration('Очень длинная фраза про подвал')).toBeGreaterThan(dialogue.duration('Да.'));
  });
});
