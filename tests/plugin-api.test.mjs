import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");

test("exposes a versioned API for review-first Folder2Graph options", () => {
  assert.match(main, /pilafdob:folderandgraphs-plus:api:v1/);
  assert.match(main, /version: 1 as const/);
  for (const key of [
    "showFolderNodes",
    "showHeadingNodes",
    "weightNodesBySubtree",
    "nodeColor",
    "headingNodeColor"
  ]) assert.match(main, new RegExp(`case "${key}"`));
  assert.match(main, /The Folder and Graphs Plus option changed after the proposal was prepared/);
});
