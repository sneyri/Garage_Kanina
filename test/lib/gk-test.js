/**
 * Мини-фреймворк тестов в духе Jest: describe / it / beforeEach / expect / fn.
 * Работает и в браузере (test/index.html), и в Node (test/run-node.js).
 *
 *   describe('Сервис', () => {
 *     it('делает дело', async () => {
 *       expect(1 + 1).toBe(2);
 *     });
 *   });
 *
 * describe.browser(...) — набор, которому нужен настоящий браузер (WebGL, DOM).
 * В Node такие тесты помечаются как пропущенные.
 */
(function (root) {
  'use strict';

  const rootSuite = { name: '', tests: [], suites: [], before: [], after: [], browser: false };
  let current = rootSuite;

  function describe(name, body, options) {
    const suite = {
      name: name, tests: [], suites: [], before: [], after: [],
      browser: !!(options && options.browser) || current.browser,
    };
    current.suites.push(suite);
    const parent = current;
    current = suite;
    try {
      body();
    } finally {
      current = parent;
    }
  }

  describe.browser = function (name, body) {
    describe(name, body, { browser: true });
  };

  function it(name, body) {
    current.tests.push({ name: name, body: body });
  }

  it.skip = function (name) {
    current.tests.push({ name: name, skip: true });
  };

  function beforeEach(hook) { current.before.push(hook); }
  function afterEach(hook) { current.after.push(hook); }

  class AssertionError extends Error {}

  function format(value) {
    if (typeof value === 'function') return 'function ' + (value.name || '');
    if (typeof value === 'string') return JSON.stringify(value);
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }

  function messageMatches(message, expected) {
    if (!expected) return true;
    return expected instanceof RegExp ? expected.test(message) : message.indexOf(expected) !== -1;
  }

  const matchers = {
    toBe: (a, e) => ({ pass: Object.is(a, e), message: 'ожидалось ' + format(e) + ', получено ' + format(a) }),
    toEqual: (a, e) => ({ pass: deepEqual(a, e), message: 'ожидалось ' + format(e) + ', получено ' + format(a) }),
    toBeTruthy: (a) => ({ pass: !!a, message: 'ожидалось истинное значение, получено ' + format(a) }),
    toBeFalsy: (a) => ({ pass: !a, message: 'ожидалось ложное значение, получено ' + format(a) }),
    toBeNull: (a) => ({ pass: a === null, message: 'ожидалось null, получено ' + format(a) }),
    toBeUndefined: (a) => ({ pass: a === undefined, message: 'ожидалось undefined, получено ' + format(a) }),
    toBeDefined: (a) => ({ pass: a !== undefined, message: 'значение не определено' }),
    toContain: (a, e) => ({ pass: a != null && a.indexOf(e) !== -1, message: format(a) + ' не содержит ' + format(e) }),
    toHaveLength: (a, n) => ({ pass: a != null && a.length === n, message: 'ожидалась длина ' + n + ', получено ' + (a && a.length) }),
    toBeGreaterThan: (a, n) => ({ pass: a > n, message: format(a) + ' не больше ' + n }),
    toBeLessThan: (a, n) => ({ pass: a < n, message: format(a) + ' не меньше ' + n }),
    toBeCloseTo: (a, e, digits) => ({
      pass: Math.abs(a - e) < Math.pow(10, -(digits == null ? 2 : digits)) / 2,
      message: 'ожидалось ≈' + e + ', получено ' + a,
    }),
    toBeInstanceOf: (a, C) => ({ pass: a instanceof C, message: 'не экземпляр ' + C.name }),
    toThrow: (fn, expected) => {
      try {
        fn();
      } catch (err) {
        return { pass: messageMatches(err.message, expected), message: 'сообщение «' + err.message + '» не подходит под ' + format(String(expected)) };
      }
      return { pass: false, message: 'функция не бросила исключение' };
    },
    toHaveBeenCalled: (spy) => ({ pass: spy.calls.length > 0, message: 'шпион не вызывался' }),
    toHaveBeenCalledTimes: (spy, n) => ({ pass: spy.calls.length === n, message: 'вызовов ' + spy.calls.length + ', ожидалось ' + n }),
    toHaveBeenCalledWith: function (spy) {
      const args = Array.prototype.slice.call(arguments, 1);
      return { pass: spy.calls.some((call) => deepEqual(call, args)), message: 'не было вызова с ' + format(args) + '; вызовы: ' + format(spy.calls) };
    },
  };

  function expect(actual) {
    const api = { not: {} };
    Object.keys(matchers).forEach((name) => {
      api[name] = function () {
        const r = matchers[name].apply(null, [actual].concat(Array.prototype.slice.call(arguments)));
        if (!r.pass) throw new AssertionError(r.message);
      };
      api.not[name] = function () {
        const r = matchers[name].apply(null, [actual].concat(Array.prototype.slice.call(arguments)));
        if (r.pass) throw new AssertionError('НЕ ожидалось: ' + r.message);
      };
    });
    api.rejects = {
      toThrow: async (expected) => {
        try {
          await actual;
        } catch (err) {
          if (!messageMatches(err.message, expected)) throw new AssertionError('сообщение «' + err.message + '» не подходит под ' + String(expected));
          return;
        }
        throw new AssertionError('промис не был отклонён');
      },
    };
    return api;
  }

  /** Шпион: запоминает вызовы, может подменять реализацию. */
  function fn(impl) {
    const spy = function () {
      const args = Array.prototype.slice.call(arguments);
      spy.calls.push(args);
      return impl ? impl.apply(this, args) : undefined;
    };
    spy.calls = [];
    return spy;
  }

  function withTimeout(value, ms) {
    let timer;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('тест не завершился за ' + ms + ' мс')), ms);
    });
    return Promise.race([Promise.resolve(value), timeout]).finally(() => clearTimeout(timer));
  }

  async function run(options) {
    const env = (options && options.env) || 'browser';
    const results = [];

    async function runSuite(suite, path, before, after) {
      const names = suite.name ? path.concat(suite.name) : path;
      const allBefore = before.concat(suite.before);
      const allAfter = suite.after.concat(after);
      for (const test of suite.tests) {
        const fullName = names.concat(test.name).join(' › ');
        if (test.skip || (suite.browser && env !== 'browser')) {
          results.push({ name: fullName, status: 'skip' });
          continue;
        }
        const started = Date.now();
        try {
          for (const hook of allBefore) await hook();
          await withTimeout(test.body(), 8000);
          results.push({ name: fullName, status: 'pass', ms: Date.now() - started });
        } catch (err) {
          results.push({ name: fullName, status: 'fail', error: err });
        } finally {
          for (const hook of allAfter) {
            try { await hook(); } catch (err) { /* ошибка в afterEach не должна скрывать результат */ }
          }
        }
      }
      for (const child of suite.suites) await runSuite(child, names, allBefore, allAfter);
    }

    await runSuite(rootSuite, [], [], []);
    return results;
  }

  const api = { describe, it, beforeEach, afterEach, expect, fn, run, AssertionError };
  root.GKTest = api;
  Object.assign(root, { describe, it, beforeEach, afterEach, expect });
})(window);
