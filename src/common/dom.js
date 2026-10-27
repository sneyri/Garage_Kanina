/** Короткие помощники для DOM. */
(function (GK) {
  'use strict';

  GK.dom = {
    $(selector, root) { return (root || document).querySelector(selector); },
    $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); },
    show(el, visible) { if (el) el.classList.toggle('is-hidden', !visible); },
    text(el, value) {
      if (el && el.textContent !== value) el.textContent = value;
    },
    escape(value) {
      return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
  };
})(window.GK);
