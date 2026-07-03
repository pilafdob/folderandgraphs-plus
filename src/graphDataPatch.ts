export type GraphDataRenderer<TData> = {
  setData?: (data: TData) => unknown;
  originalSetData?: (data: TData) => unknown;
};

export type GraphDataMethodKey = "setData" | "originalSetData";

export type GraphDataPatchEntry<TData> = {
  key: GraphDataMethodKey;
  original: (data: TData) => unknown;
  wrapper: (data: TData) => unknown;
};

export type GraphDataPatch<TData> = {
  renderer: GraphDataRenderer<TData>;
  key: GraphDataMethodKey;
  original: (data: TData) => unknown;
  wrapper: (data: TData) => unknown;
  entries: GraphDataPatchEntry<TData>[];
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

  const keys = getGraphDataPatchKeys(renderer);
  if (keys.length === 0) {
    restoreGraphDataPatch(existingPatch);
    return undefined;
  }

  if (
    existingPatch?.renderer === renderer &&
    existingPatch.entries.length === keys.length &&
    existingPatch.entries.every((entry) => renderer[entry.key] === entry.wrapper) &&
    keys.every((key) => existingPatch.entries.some((entry) => entry.key === key))
  ) {
    return existingPatch;
  }

  restoreGraphDataPatch(existingPatch);

  const entries: GraphDataPatchEntry<TData>[] = [];
  const nativeSetData = typeof renderer.originalSetData === "function"
    ? renderer.originalSetData
    : undefined;
  for (const key of keys) {
    const original = renderer[key];
    if (typeof original !== "function") {
      continue;
    }

    const wrapper = (data: TData): unknown => {
      const nextData = transform(data);
      if (
        key === "setData" &&
        !hasGraphNodes(nextData) &&
        typeof nativeSetData === "function"
      ) {
        return nativeSetData.call(renderer, nextData);
      }

      return original.call(renderer, nextData);
    };
    renderer[key] = wrapper;
    entries.push({ key, original, wrapper });
  }

  const primary = entries[0];
  if (!primary) {
    return undefined;
  }

  return {
    renderer,
    key: primary.key,
    original: primary.original,
    wrapper: primary.wrapper,
    entries
  };
}

export function restoreGraphDataPatch<TData>(patch: GraphDataPatch<TData> | undefined): void {
  if (!patch) {
    return;
  }

  for (const entry of patch.entries) {
    if (patch.renderer[entry.key] === entry.wrapper) {
      patch.renderer[entry.key] = entry.original;
    }
  }
}

function getGraphDataPatchKeys<TData>(renderer: GraphDataRenderer<TData>): GraphDataMethodKey[] {
  const keys: GraphDataMethodKey[] = [];
  if (typeof renderer.originalSetData === "function") {
    keys.push("originalSetData");
  }

  if (typeof renderer.setData === "function") {
    keys.push("setData");
  }

  return keys;
}

function hasGraphNodes(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { nodes?: unknown }).nodes === "object" &&
    (data as { nodes?: unknown }).nodes !== null
  );
}
