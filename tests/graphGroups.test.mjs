import assert from "node:assert/strict";
import test from "node:test";

import {
  folderPathFromNodeId,
  folderPathMatchesGroupQuery,
  getFolderGroupColor,
  getFolderGroupColorForPaths
} from "../testable/graphGroups.mjs";

test("folder node id is normalized to full vault-relative path", () => {
  assert.equal(folderPathFromNodeId("/Wiki/Dustcore/"), "Wiki/Dustcore");
});

test("People matches path:People", () => {
  assert.equal(folderPathMatchesGroupQuery("People", "path:People"), true);
});

test("Dev matches path:Dev", () => {
  assert.equal(folderPathMatchesGroupQuery("Dev", "path:Dev"), true);
});

test("Projects/Web matches path:Projects", () => {
  assert.equal(folderPathMatchesGroupQuery("Projects/Web", "path:Projects"), true);
});

test("Projects/Web matches path:Projects/Web", () => {
  assert.equal(folderPathMatchesGroupQuery("Projects/Web", "path:Projects/Web"), true);
});

test("Wiki/Dustcore matches path:Wiki/Dustcore", () => {
  assert.equal(folderPathMatchesGroupQuery("Wiki/Dustcore", "path:Wiki/Dustcore"), true);
});

test("quoted path rules are supported", () => {
  assert.equal(folderPathMatchesGroupQuery("Wiki/Dustcore", 'path:"Wiki/Dustcore"'), true);
});

test("Archive does not match path:Dev", () => {
  assert.equal(folderPathMatchesGroupQuery("Archive", "path:Dev"), false);
});

test("first matching group wins", () => {
  const groups = [
    { query: "path:Projects", color: { a: 1, rgb: 111 } },
    { query: "path:Projects/Web", color: { a: 1, rgb: 222 } }
  ];

  assert.deepEqual(getFolderGroupColor("Projects/Web", groups), { a: 1, rgb: 111 });
});

test("combined folder paths still use first matching group", () => {
  const groups = [
    { query: "path:TeamB/Overview", color: { a: 1, rgb: 111 } },
    { query: "path:TeamA/Overview", color: { a: 1, rgb: 222 } }
  ];

  assert.deepEqual(getFolderGroupColorForPaths(["TeamA/Overview", "TeamB/Overview"], groups), { a: 1, rgb: 111 });
});

test("simple negated path terms exclude matches", () => {
  assert.equal(folderPathMatchesGroupQuery("Projects/Archive", "path:Projects -path:Projects/Archive"), false);
});
