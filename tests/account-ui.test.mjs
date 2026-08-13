import assert from "node:assert/strict";
import test from "node:test";

import { createAccountSystem } from "../src/account-system.js";

function createElement() {
  const attributes = new Set(["hidden"]);
  const listeners = new Map();
  return {
    classList: { toggle() {} },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.({
        preventDefault() {},
        stopImmediatePropagation() {},
        target: this,
        ...event,
      });
    },
    focus() {},
    hasAttribute(name) {
      return attributes.has(name);
    },
    querySelector() {
      return null;
    },
    setAttribute(name) {
      attributes.add(name);
    },
    toggleAttribute(name, force) {
      if (force) attributes.add(name);
      else attributes.delete(name);
    },
  };
}

test("account modal closes only from its close button", () => {
  const menuButton = createElement();
  const modal = createElement();
  const panel = createElement();
  const closeButton = createElement();
  const windowListeners = new Map();

  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;

  globalThis.document = {
    getElementById() {
      return null;
    },
    querySelector(selector) {
      return new Map([
        ["#main-menu-account", menuButton],
        ["#account-modal", modal],
        [".account-modal__panel", panel],
        ["#account-close", closeButton],
      ]).get(selector) ?? null;
    },
    querySelectorAll() {
      return [];
    },
  };
  globalThis.window = {
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    location: { protocol: "https:" },
    requestAnimationFrame(callback) {
      callback();
    },
  };

  try {
    const account = createAccountSystem({ getLanguage: () => "zh-CN" });

    menuButton.dispatch("pointerdown");
    assert.equal(account.isOpen(), true);

    modal.dispatch("pointerdown", { target: modal });
    assert.equal(account.isOpen(), true, "clicking the backdrop must keep the modal open");

    windowListeners.get("keydown")?.({
      key: "Escape",
      preventDefault() {},
      stopImmediatePropagation() {},
    });
    assert.equal(account.isOpen(), true, "Escape must keep the modal open");

    closeButton.dispatch("pointerdown");
    assert.equal(account.isOpen(), false, "the close button must close the modal");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
