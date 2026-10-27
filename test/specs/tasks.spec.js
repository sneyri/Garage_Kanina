describe('Задания дня (TasksService)', () => {
  const DAYS = [
    {
      day: 1, title: 'Тест',
      tasks: [
        { id: 'talk', type: 'talk', title: 'Поговорить с Каниным' },
        { id: 'floor', type: 'clean', title: 'Оттереть пол', count: 2, requires: ['talk'] },
        { id: 'patch', type: 'use', title: 'Заклеить камеру', requires: ['talk'] },
        { id: 'pump', type: 'use', title: 'Подкачать колесо', requires: ['patch'] },
        { id: 'leave', type: 'leave', title: 'Уйти' },
      ],
    },
    { day: 2, title: 'Второй', tasks: [{ id: 'leave', type: 'leave', title: 'Уйти' }] },
  ];

  let tasks, events;

  beforeEach(async () => {
    const app = await GK.testing.Test.createTestingModule({
      imports: [GK.SharedModule],
      providers: [{ provide: GK.TOKENS.DAYS_CONFIG, useValue: DAYS }, GK.TasksService],
    }).compile();
    tasks = app.get(GK.TasksService);
    events = app.get(GK.EventBus);
    tasks.startDay(1);
  });

  it('до разговора с Каниным всё остальное закрыто', () => {
    expect(tasks.isLocked('talk')).toBe(false);
    expect(tasks.isLocked('floor')).toBe(true);
    expect(tasks.advance('floor')).toBe(false);
    expect(tasks.lockReason('floor')).toBe('Сначала: поговорить с Каниным');
  });

  it('advance засчитывает прогресс и не даёт превысить count', () => {
    tasks.advance('talk');
    expect(tasks.advance('floor')).toBe(true);
    expect(tasks.isDone('floor')).toBe(false);
    expect(tasks.advance('floor')).toBe(true);
    expect(tasks.isDone('floor')).toBe(true);
    expect(tasks.advance('floor')).toBe(false);
    expect(tasks.progress.floor).toBe(2);
  });

  it('цепочка requires: насос только после заплатки', () => {
    tasks.advance('talk');
    expect(tasks.isLocked('pump')).toBe(true);
    tasks.advance('patch');
    expect(tasks.isLocked('pump')).toBe(false);
  });

  it('«уйти» открывается последним, и тогда приходит day.ready', () => {
    const ready = GKTest.fn();
    events.on('day.ready', ready);
    ['talk', 'floor', 'floor', 'patch'].forEach((id) => tasks.advance(id));
    expect(tasks.isLocked('leave')).toBe(true);
    expect(tasks.lockReason('leave')).toBe('Сначала закончи все дела');
    tasks.advance('pump');
    expect(ready).toHaveBeenCalledTimes(1);
    expect(tasks.isLocked('leave')).toBe(false);
    expect(tasks.advance('leave')).toBe(true);
    expect(tasks.isDayComplete()).toBe(true);
  });

  it('task.completed приходит один раз на задание', () => {
    const done = GKTest.fn();
    events.on('task.completed', done);
    tasks.advance('talk');
    tasks.advance('floor');
    tasks.advance('floor');
    expect(done.calls.map((c) => c[0].id)).toEqual(['talk', 'floor']);
  });

  it('nextOpenTask подсказывает, что делать дальше', () => {
    expect(tasks.nextOpenTask().id).toBe('talk');
    tasks.advance('talk');
    expect(tasks.nextOpenTask().id).toBe('floor');
  });

  it('list() отдаёт готовую модель для интерфейса', () => {
    tasks.advance('talk');
    const floor = tasks.list().find((t) => t.id === 'floor');
    expect(floor).toEqual({ id: 'floor', title: 'Оттереть пол', count: 2, progress: 0, done: false, locked: false });
  });

  it('переход между днями', () => {
    expect(tasks.hasNextDay()).toBe(true);
    tasks.startDay(2);
    expect(tasks.dayNumber).toBe(2);
    expect(tasks.hasNextDay()).toBe(false);
    expect(() => tasks.startDay(9)).toThrow('нет дня 9');
  });
});
