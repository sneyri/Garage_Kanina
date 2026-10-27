/**
 * Логика заданий дня: прогресс, блокировки, завершение. Ничего не знает
 * про 3D и DOM, поэтому полностью покрыта тестами (test/specs/tasks.spec.js).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  function lowerFirst(text) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  class TasksService {
    constructor(events, days) {
      this.events = events;
      this.days = days;
      this.index = -1;
      this.progress = {};
    }

    get day() {
      return this.days[this.index] || null;
    }

    get dayNumber() {
      return this.day ? this.day.day : 0;
    }

    startDay(number) {
      const index = this.days.findIndex((d) => d.day === number);
      if (index === -1) throw new Error('В конфиге нет дня ' + number);
      this.index = index;
      this.progress = {};
      this.day.tasks.forEach((task) => { this.progress[task.id] = 0; });
      this.events.emit('day.started', { day: number });
      this.emitChanged();
      return this.day;
    }

    hasNextDay() {
      return this.index + 1 < this.days.length;
    }

    getTask(id) {
      return this.day ? this.day.tasks.find((t) => t.id === id) || null : null;
    }

    count(task) {
      return task.count || 1;
    }

    isDone(id) {
      const task = this.getTask(id);
      return !!task && this.progress[id] >= this.count(task);
    }

    isLocked(id) {
      const task = this.getTask(id);
      if (!task) return true;
      if ((task.requires || []).some((r) => !this.isDone(r))) return true;
      if (task.type === 'leave') return !this.allWorkDone();
      return false;
    }

    lockReason(id) {
      const task = this.getTask(id);
      if (!task) return '';
      const unmet = (task.requires || []).find((r) => !this.isDone(r));
      if (unmet) return 'Сначала: ' + lowerFirst(this.getTask(unmet).title);
      if (task.type === 'leave' && !this.allWorkDone()) return 'Сначала закончи все дела';
      return '';
    }

    /** Продвинуть задание. Возвращает false, если оно заблокировано или уже сделано. */
    advance(id, amount) {
      const task = this.getTask(id);
      if (!task || this.isLocked(id) || this.isDone(id)) return false;
      this.progress[id] = Math.min(this.count(task), this.progress[id] + (amount || 1));
      this.events.emit('task.progress', { id: id, progress: this.progress[id], count: this.count(task) });
      if (this.isDone(id)) {
        this.events.emit('task.completed', { id: id, title: task.title, type: task.type });
        if (task.type !== 'leave' && this.allWorkDone()) this.events.emit('day.ready', { day: this.dayNumber });
      }
      this.emitChanged();
      return true;
    }

    /** Для отладки: засчитать задание без условий. */
    forceComplete(id) {
      const task = this.getTask(id);
      if (!task) return;
      this.progress[id] = this.count(task);
      this.emitChanged();
    }

    allWorkDone() {
      return !!this.day && this.day.tasks.filter((t) => t.type !== 'leave').every((t) => this.isDone(t.id));
    }

    isDayComplete() {
      return !!this.day && this.day.tasks.every((t) => this.isDone(t.id));
    }

    /** Первое несделанное и доступное задание — для подсказок Канина. */
    nextOpenTask() {
      if (!this.day) return null;
      return this.day.tasks.find((t) => !this.isDone(t.id) && !this.isLocked(t.id)) || null;
    }

    list() {
      if (!this.day) return [];
      return this.day.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        count: this.count(t),
        progress: this.progress[t.id],
        done: this.isDone(t.id),
        locked: this.isLocked(t.id),
      }));
    }

    emitChanged() {
      this.events.emit('tasks.changed', { day: this.dayNumber, title: this.day && this.day.title, tasks: this.list() });
    }
  }

  GK.TasksService = decorate([Injectable(), Dependencies(GK.EventBus, GK.TOKENS.DAYS_CONFIG)], TasksService);
})(window.GK);
