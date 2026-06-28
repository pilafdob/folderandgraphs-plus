// src/graphDataPatch.ts
function installGraphDataPatch(existingPatch, renderer, transform) {
  if (!renderer) {
    restoreGraphDataPatch(existingPatch);
    return void 0;
  }
  const keys = getGraphDataPatchKeys(renderer);
  if (keys.length === 0) {
    restoreGraphDataPatch(existingPatch);
    return void 0;
  }
  if (existingPatch?.renderer === renderer && existingPatch.entries.length === keys.length && existingPatch.entries.every((entry) => renderer[entry.key] === entry.wrapper) && keys.every((key) => existingPatch.entries.some((entry) => entry.key === key))) {
    return existingPatch;
  }
  restoreGraphDataPatch(existingPatch);
  const entries = [];
  for (const key of keys) {
    const original = renderer[key];
    if (typeof original !== "function") {
      continue;
    }
    const wrapper = (data) => original.call(renderer, transform(data));
    renderer[key] = wrapper;
    entries.push({ key, original, wrapper });
  }
  const primary = entries[0];
  if (!primary) {
    return void 0;
  }
  return {
    renderer,
    key: primary.key,
    original: primary.original,
    wrapper: primary.wrapper,
    entries
  };
}
function restoreGraphDataPatch(patch) {
  if (!patch) {
    return;
  }
  for (const entry of patch.entries) {
    if (patch.renderer[entry.key] === entry.wrapper) {
      patch.renderer[entry.key] = entry.original;
    }
  }
}
function getGraphDataPatchKeys(renderer) {
  const keys = [];
  if (typeof renderer.originalSetData === "function") {
    keys.push("originalSetData");
  }
  if (typeof renderer.setData === "function") {
    keys.push("setData");
  }
  return keys;
}
export {
  installGraphDataPatch,
  restoreGraphDataPatch
};
