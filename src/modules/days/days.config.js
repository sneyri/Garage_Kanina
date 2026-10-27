/**
 * Конфиг дней. Новый день = новый объект в массиве, код трогать не нужно.
 *
 * Координаты предметов — в системе гаража [u, y, v]:
 *   u — вглубь от ворот (0…6.5), v — поперёк (−2…2), y — высота.
 * Для улицы укажи space: 'world' и мировые [x, y, z].
 *
 * Типы заданий:
 *   talk    — поговорить с Каниным
 *   clean   — оттереть пятна (в руках должна быть тряпка); spots — точки [u, v]
 *   deliver — отнести предметы kind в target (полка, бак)
 *   use     — применить предмет kind к target, удерживая E hold секунд
 *   leave   — закрыть гараж и уйти (открывается, когда сделано всё остальное)
 * requires — какие задания должны быть сделаны раньше.
 */
(function (GK) {
  'use strict';

  GK.ITEM_KINDS = Object.freeze({
    rag: { label: 'Тряпка', hold: { x: 0.02, y: -0.06, z: 0, rx: 0.3, ry: 0.4 } },
    canister: { label: 'Канистра', hold: { x: 0.05, y: -0.33, z: 0.05, ry: 0.2 } },
    fuel: { label: 'Канистра с бензином', hold: { x: 0.05, y: -0.33, z: 0.05, ry: 0.2 } },
    oil: { label: 'Бутылка масла', hold: { x: 0, y: -0.16, z: 0, ry: -0.5 } },
    trash: { label: 'Мусорный пакет', hold: { x: 0.05, y: -0.32, z: 0.05 } },
    clutch: { label: 'Трос сцепления', hold: { x: 0, y: -0.06, z: 0, ry: 0.4 } },
    patch: { label: 'Ремкомплект для камер', hold: { x: 0, y: -0.05, z: 0, ry: 0.3 } },
    pump: { label: 'Насос', hold: { x: 0.08, y: -0.55, z: 0.05, rz: 0.15 } },
  });

  const TALK = { id: 'talk', type: 'talk', title: 'Поговорить с Каниным' };
  const LEAVE = { id: 'leave', type: 'leave', title: 'Закрыть гараж и уйти' };

  GK.DAYS = Object.freeze([
    {
      day: 1,
      title: 'Уборка',
      time: '18:24',
      bike: { tireFlat: true, clutchNew: false },
      intro: [
        'О, пришёл. Ворота не закрывай — пусть проветривается.',
        'Короче. Пол весь в масле — тряпка на верстаке.',
        'Канистры — на нижнюю полку стеллажа. Масло — повыше.',
        'Мусор вынеси в бак. Он в проулке напротив, через проезд.',
        'Как закончишь — закрывай ворота и иди домой.',
      ],
      outro: 'Когда ты уходил, Канин так и стоял у верстака. Не шевелясь.',
      items: [
        { id: 'rag', kind: 'rag', pos: [5.98, 0.91, 1.72] },
        { id: 'can-1', kind: 'canister', variant: 'green', pos: [1.6, 0.012, 1.55], rotY: 0.3 },
        { id: 'can-2', kind: 'canister', variant: 'gray', pos: [2.3, 0.012, -1.0], rotY: 1.2 },
        { id: 'can-3', kind: 'canister', variant: 'green', pos: [1.9, 0.012, -1.6], rotY: -0.4 },
        { id: 'oil-1', kind: 'oil', variant: 'blue', pos: [3.0, 0.012, 1.6], rotY: 0.5 },
        { id: 'oil-2', kind: 'oil', variant: 'gold', pos: [3.45, 0.012, 1.75], rotY: 2.1 },
        { id: 'oil-3', kind: 'oil', variant: 'black', pos: [0.35, 0.012, -0.6], rotY: 0.9 },
        { id: 'oil-4', kind: 'oil', variant: 'red', pos: [1.15, 0.012, 0.8], rotY: -1 },
        { id: 'trash-1', kind: 'trash', pos: [2.7, 0.012, -1.45] },
        { id: 'trash-2', kind: 'trash', pos: [0.45, 0.012, 1.3] },
        { id: 'trash-3', kind: 'trash', pos: [2.4, 0, -4.9], space: 'world' },
      ],
      tasks: [
        TALK,
        {
          id: 'floor', type: 'clean', title: 'Оттереть масло с пола', count: 5, requires: ['talk'],
          spots: [[0.7, 0.2], [2.0, -1.05], [3.6, 1.1], [5.5, 0.55], [5.6, -0.6]],
        },
        { id: 'canisters', type: 'deliver', title: 'Канистры — на стеллаж', kind: 'canister', target: 'shelf-canisters', count: 3, requires: ['talk'] },
        { id: 'oil', type: 'deliver', title: 'Масло — на полку', kind: 'oil', target: 'shelf-oil', count: 4, requires: ['talk'] },
        { id: 'trash', type: 'deliver', title: 'Мусор — в бак в проулке', kind: 'trash', target: 'dumpster', count: 3, requires: ['talk'] },
        LEAVE,
      ],
    },
    {
      day: 2,
      title: 'Питбайк',
      time: '18:40',
      bike: { tireFlat: true, clutchNew: false },
      intro: [
        'Сегодня питбайк. Сам он себя не починит.',
        'Бензин — в красной канистре у входа. Залей полный.',
        'Новый трос сцепления — на стеллаже, в коробке. Старый совсем лохматый.',
        'Заднее колесо спускает. Ремкомплект на верстаке, насос рядом.',
        'И это… если кто позвонит — не бери.',
      ],
      outro: 'Питбайк завёлся с первого раза. Канин долго смотрел на люк в полу.',
      items: [
        { id: 'fuel', kind: 'fuel', pos: [0.9, 0.012, 1.5], rotY: 0.2 },
        { id: 'clutch', kind: 'clutch', pos: [6.22, 1.095, -1.3], rotY: -Math.PI / 2 },
        { id: 'patch', kind: 'patch', pos: [6.0, 0.91, 0.95], rotY: 0.3 },
        { id: 'pump', kind: 'pump', pos: [5.45, 0.012, 1.75], rotY: 0.8 },
      ],
      tasks: [
        TALK,
        {
          id: 'fuel', type: 'use', title: 'Залить бензин в бак', kind: 'fuel', target: 'bike-tank', hold: 3.5,
          verb: 'Залить бензин', sound: 'pour', need: 'Бак пустой — нужен бензин', relabel: 'Пустая канистра', requires: ['talk'],
        },
        {
          id: 'clutch', type: 'use', title: 'Заменить трос сцепления', kind: 'clutch', target: 'bike-clutch', hold: 4,
          verb: 'Поменять трос', sound: 'ratchet', need: 'Нужен новый трос (на стеллаже)', consume: true,
          effect: { clutchNew: true }, requires: ['talk'],
        },
        {
          id: 'patch', type: 'use', title: 'Заклеить камеру заднего колеса', kind: 'patch', target: 'bike-wheel', hold: 4,
          verb: 'Заклеить прокол', sound: 'patch', need: 'Колесо спущено — нужен ремкомплект', consume: true, requires: ['talk'],
        },
        {
          id: 'pump', type: 'use', title: 'Подкачать колесо', kind: 'pump', target: 'bike-wheel', hold: 3,
          verb: 'Накачать колесо', sound: 'pump', need: 'Нужен насос', effect: { tireFlat: false }, requires: ['patch'],
        },
        LEAVE,
      ],
    },
  ]);
})(window.GK);
