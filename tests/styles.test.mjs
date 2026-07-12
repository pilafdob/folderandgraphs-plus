import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("plugin styles avoid important declarations", () => {
  assert.doesNotMatch(styles, /!important\b/);
});

test("iWork package internals use specific File Explorer selectors", () => {
  assert.match(
    styles,
    /\.nav-folder-collapse-indicator\.folderandgraphs-plus-iwork-package-collapse/,
  );
  assert.match(styles, /\.nav-folder-children\.folderandgraphs-plus-iwork-package-children/);
});
