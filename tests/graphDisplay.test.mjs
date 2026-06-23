import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SHOW_FOLDER_EMOJI,
  PARENT_MARKER_PREFIX,
  buildFolderDisplayText
} from "../testable/graphDisplay.mjs";

test("folder emoji defaults to on", () => {
  assert.equal(DEFAULT_SHOW_FOLDER_EMOJI, true);
});

test("folder display text does not insert combining underline characters", () => {
  assert.equal(
    buildFolderDisplayText("ebooks", {
      showFolderEmoji: false
    }),
    "ebooks"
  );
});

test("folder emoji prefixes folder labels when enabled", () => {
  assert.equal(
    buildFolderDisplayText("ebooks", {
      showFolderEmoji: true
    }),
    `${PARENT_MARKER_PREFIX}ebooks`
  );
});

test("parent marker prefix is not duplicated", () => {
  assert.equal(
    buildFolderDisplayText(`${PARENT_MARKER_PREFIX}ebooks`, {
      showFolderEmoji: true
    }),
    `${PARENT_MARKER_PREFIX}ebooks`
  );
});

test("legacy star prefix is stripped before applying folder emoji", () => {
  assert.equal(
    buildFolderDisplayText("★ ebooks", {
      showFolderEmoji: true
    }),
    `${PARENT_MARKER_PREFIX}ebooks`
  );
});

test("disabled folder emoji strips existing markers", () => {
  assert.equal(
    buildFolderDisplayText(`${PARENT_MARKER_PREFIX}ebooks`, {
      showFolderEmoji: false
    }),
    "ebooks"
  );
});
