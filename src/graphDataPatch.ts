export type GraphDataRenderer<TData> = {
  setData?: (data: TData) => unknown;
  originalSetData?: (data: TData) => unknown;
};

export type GraphDataMethodKey = "setData" | "originalSetData";

export type GraphDataPatch<TData> = {
  renderer: GraphDataRenderer<TData>;
  key: GraphDataMethodKey;
  original: (data: TData) => unknown;
  wrapper: (data: TData) => unknown;
};

export function installGraphDataPatch<TData>(
  existingPatch: GraphDataPatch<TData> | undefined,
  renderer: GraphDataRenderer<TData> | undefined,
  transform: (data: TData) => TData
): GraphDataPatch<TData> | undefined {
  if (!renderer) {
    restoreGraphDataPatch(existingPatch);
    return undefined;
  }

  const key = getGraphDataPatchKey(renderer);
  if (!key) {
    restoreGraphDataPatch(existingPatch);
    return undefined;
  }

  if (existingPatch?.renderer === renderer && existingPatch.key === key && renderer[key] === existingPatch.wrapper) {
    return existingPatch;
  }

  restoreGraphDataPatch(existingPatch);

  const original = renderer[key];
  if (typeof original !== "function") {
    return undefined;
  }

  const wrapper = (data: TData): unknown => original.call(renderer, transform(data));
  renderer[key] = wrapper;

  return { renderer, key, original, wrapper };
}

export function restoreGraphDataPatch<TData>(patch: GraphDataPatch<TData> | undefined): void {
  if (!patch) {
    return;
  }

  if (patch.renderer[patch.key] === patch.wrapper) {
    patch.renderer[patch.key] = patch.original;
  }
}

function getGraphDataPatchKey<TData>(renderer: GraphDataRenderer<TData>): GraphDataMethodKey | null {
  if (typeof renderer.originalSetData === "function") {
    return "originalSetData";
  }

  return typeof renderer.setData === "function" ? "setData" : null;
}
