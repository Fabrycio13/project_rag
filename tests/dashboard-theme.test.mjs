import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const scriptUrl = new URL("../public/theme-init.js", import.meta.url);

function applyTheme({ stored = null, systemDark = false, storageThrows = false } = {}) {
  const root = { dataset: {} };
  const storage = {
    getItem() {
      if (storageThrows) throw new Error("storage unavailable");
      return stored;
    },
  };
  const mediaQuery = { matches: systemDark };
  const source = readFileSync(scriptUrl, "utf8");

  runInNewContext(source, {
    document: { documentElement: root },
    localStorage: storage,
    window: { matchMedia: () => mediaQuery },
  });

  return root.dataset.theme;
}

test("theme bootstrap honors a saved light or dark choice", () => {
  assert.equal(applyTheme({ stored: "light", systemDark: true }), "light");
  assert.equal(applyTheme({ stored: "dark", systemDark: false }), "dark");
});

test("theme bootstrap follows the system when there is no saved choice", () => {
  assert.equal(applyTheme({ systemDark: true }), "dark");
  assert.equal(applyTheme({ systemDark: false }), "light");
});

test("theme bootstrap safely falls back to system preference when storage is unavailable", () => {
  assert.equal(applyTheme({ systemDark: true, storageThrows: true }), "dark");
});
