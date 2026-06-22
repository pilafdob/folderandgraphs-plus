// src/graphDataPatch.ts
function installGraphDataPatch(existingPatch, renderer, transform) {
  if (!renderer) {
    restoreGraphDataPatch(existingPatch);
    return void 0;
  }
  const key = getGraphDataPatchKey(renderer);
  if (!key) {
    restoreGraphDataPatch(existingPatch);
    return void 0;
  }
  if (existingPatch?.renderer === renderer && existingPatch.key === key && renderer[key] === existingPatch.wrapper) {
    return existingPatch;
  }
  restoreGraphDataPatch(existingPatch);
  const original = renderer[key];
  if (typeof original !== "function") {
    return void 0;
  }
  const wrapper = (data) => original.call(renderer, transform(data));
  renderer[key] = wrapper;
  return { renderer, key, original, wrapper };
}
function restoreGraphDataPatch(patch) {
  if (!patch) {
    return;
  }
  if (patch.renderer[patch.key] === patch.wrapper) {
    patch.renderer[patch.key] = patch.original;
  }
}
function getGraphDataPatchKey(renderer) {
  if (typeof renderer.originalSetData === "function") {
    return "originalSetData";
  }
  return typeof renderer.setData === "function" ? "setData" : null;
}
export {
  installGraphDataPatch,
  restoreGraphDataPatch
};
