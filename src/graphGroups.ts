export type GraphColor = {
  a?: number;
  rgb: number;
};

export type GraphColorGroup = {
  query?: unknown;
  color?: unknown;
};

type PathToken = {
  path: string;
  negated: boolean;
};

export function normalizeVaultPath(path: unknown): string {
  if (typeof path !== "string") return "";
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function folderPathFromNodeId(nodeId: unknown): string {
  if (nodeId === "/") return "";
  return normalizeVaultPath(nodeId);
}

export function parsePathTokens(query: unknown): PathToken[] {
  if (typeof query !== "string") return [];

  const tokens: PathToken[] = [];
  const re = /(^|[\s(])([!-])?path:(?:"([^"]+)"|'([^']+)'|([^\s)]+))/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(query)) !== null) {
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    const path = normalizeVaultPath(value);
    if (path.length > 0) {
      tokens.push({
        path,
        negated: match[2] === "!" || match[2] === "-"
      });
    }
  }

  return tokens;
}

export function folderPathMatchesPathRule(folderPath: string, rulePath: string): boolean {
  const folder = normalizeVaultPath(folderPath);
  const rule = normalizeVaultPath(rulePath);
  return rule.length > 0 && (folder === rule || folder.startsWith(`${rule}/`));
}

export function folderPathMatchesGroupQuery(folderPath: string, query: unknown): boolean {
  const tokens = parsePathTokens(query);
  const positiveTokens = tokens.filter((token) => !token.negated);

  if (positiveTokens.length === 0) {
    return false;
  }

  if (tokens.some((token) => token.negated && folderPathMatchesPathRule(folderPath, token.path))) {
    return false;
  }

  return positiveTokens.some((token) => folderPathMatchesPathRule(folderPath, token.path));
}

export function isGraphColor(value: unknown): value is GraphColor {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { rgb?: unknown }).rgb === "number"
  );
}

export function getFolderGroupColor(
  folderPath: string,
  colorGroups: readonly GraphColorGroup[]
): GraphColor | null {
  return getFolderGroupColorForPaths([folderPath], colorGroups);
}

export function getFolderGroupColorForPaths(
  folderPaths: readonly string[],
  colorGroups: readonly GraphColorGroup[]
): GraphColor | null {
  for (const group of colorGroups) {
    if (folderPaths.some((folderPath) => folderPathMatchesGroupQuery(folderPath, group.query)) && isGraphColor(group.color)) {
      return group.color;
    }
  }

  return null;
}
