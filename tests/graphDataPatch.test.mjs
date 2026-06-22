import assert from "node:assert/strict";
import test from "node:test";

import {
  installGraphDataPatch,
  restoreGraphDataPatch
} from "../testable/graphDataPatch.mjs";

test("graph data patch wraps originalSetData when Folder2Graph is present", () => {
  const calls = [];
  const renderer = {
    setData(data) {
      calls.push(["setData", data]);
    },
    originalSetData(data) {
      calls.push(["originalSetData", data]);
    }
  };

  const patch = installGraphDataPatch(undefined, renderer, (data) => ({ ...data, patched: true }));
  renderer.originalSetData({ nodes: {} });

  assert.equal(patch.key, "originalSetData");
  assert.deepEqual(calls, [["originalSetData", { nodes: {}, patched: true }]]);
});

test("graph data patch wraps setData when originalSetData is absent", () => {
  const calls = [];
  const renderer = {
    setData(data) {
      calls.push(data);
    }
  };

  const patch = installGraphDataPatch(undefined, renderer, (data) => ({ ...data, patched: true }));
  renderer.setData({ nodes: {} });

  assert.equal(patch.key, "setData");
  assert.deepEqual(calls, [{ nodes: {}, patched: true }]);
});

test("graph data patch reinstalls when renderer method is replaced", () => {
  const calls = [];
  const renderer = {
    setData(data) {
      calls.push(["original", data]);
    }
  };

  const firstPatch = installGraphDataPatch(undefined, renderer, (data) => ({ ...data, first: true }));
  renderer.setData = (data) => calls.push(["replacement", data]);
  const secondPatch = installGraphDataPatch(firstPatch, renderer, (data) => ({ ...data, second: true }));

  renderer.setData({ nodes: {} });

  assert.notEqual(secondPatch.wrapper, firstPatch.wrapper);
  assert.deepEqual(calls, [["replacement", { nodes: {}, second: true }]]);
});

test("graph data patch restores the original renderer method", () => {
  const calls = [];
  const original = (data) => calls.push(data);
  const renderer = { setData: original };

  const patch = installGraphDataPatch(undefined, renderer, (data) => ({ ...data, patched: true }));
  restoreGraphDataPatch(patch);
  renderer.setData({ nodes: {} });

  assert.equal(renderer.setData, original);
  assert.deepEqual(calls, [{ nodes: {} }]);
});
