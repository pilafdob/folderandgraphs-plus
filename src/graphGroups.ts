export type GraphColor = {
  a?: number;
  rgb: number;
};

export type GraphColorGroup = {
  query?: unknown;
  color?: unknown;
};

export type FolderColorRuleType = "folder" | "combined";

export type FolderColorRule = {
  type: FolderColorRuleType;
  target: string;
  color: string;
  inheritToChildren: boolean;
  colorLinks: boolean;
  rings: number;
};

export type GraphLinkColorNode = {
  links?: Record<string, unknown>;
};

export type FolderColorMatchMode = "folderNode" | "fileNode";

export type GraphLinkColorDecision =
  | {
      type: "default";
    }
  | {
      type: "solid";
      color: GraphColor;
    }
  | {
      type: "split";
      sourceColor: GraphColor;
      targetColor: GraphColor;
    };

type PathToken = {
  path: string;
  negated: boolean;
};

type FolderColorRuleMatch = {
  color: GraphColor;
  depth: number;
  priority: number;
  rings: number;
  ruleIndex: number;
  targetKey: string;
};

export type FolderColorVisual = {
  color: GraphColor;
  rings: number;
};

export const MAX_FOLDER_RULE_RINGS = 8;

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

export function parseHexGraphColor(value: unknown): GraphColor | null {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return null;
  }

  return {
    a: 1,
    rgb: Number.parseInt(value.trim().slice(1), 16)
  };
}

export function normalizeFolderRuleRings(value: unknown): number {
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseInt(value, 10)
      : 0;

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(MAX_FOLDER_RULE_RINGS, Math.max(0, Math.round(numericValue)));
}

export function folderBasenameFromPath(folderPath: unknown): string {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function getFolderColorRuleColors(
  folderPaths: readonly string[],
  rules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): GraphColor[] {
  return getSortedFolderColorRuleMatches(folderPaths, rules, mode).map((match) => match.color);
}

export function getFolderColorRuleVisual(
  folderPaths: readonly string[],
  rules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): FolderColorVisual | null {
  const matches = getSortedFolderColorRuleMatches(folderPaths, rules, mode);
  const match = matches[matches.length - 1];
  return match ? { color: match.color, rings: match.rings } : null;
}

function getSortedFolderColorRuleMatches(
  folderPaths: readonly string[],
  rules: readonly FolderColorRule[],
  mode: FolderColorMatchMode
): FolderColorRuleMatch[] {
  const matches: FolderColorRuleMatch[] = [];
  const seenTargets = new Set<string>();

  rules.forEach((rule, ruleIndex) => {
    const target = normalizeVaultPath(rule.target);
    const color = parseHexGraphColor(rule.color);
    if (!target || !color) {
      return;
    }

    const targetKey = `${rule.type}:${target}`;
    if (seenTargets.has(targetKey)) {
      return;
    }

    const match = getFolderColorRuleMatch(folderPaths, rule, target, mode);
    if (!match) {
      return;
    }

    matches.push({
      color,
      depth: match.depth,
      priority: match.priority,
      rings: normalizeFolderRuleRings(rule.rings),
      ruleIndex,
      targetKey
    });
    seenTargets.add(targetKey);
  });

  return matches
    .sort((a, b) => a.priority - b.priority || a.depth - b.depth || a.ruleIndex - b.ruleIndex);
}

export function getFolderColorRuleColor(
  folderPaths: readonly string[],
  rules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): GraphColor | null {
  const colors = getFolderColorRuleColors(folderPaths, rules, mode);
  return colors[colors.length - 1] ?? null;
}

function getFolderColorRuleMatch(
  folderPaths: readonly string[],
  rule: FolderColorRule,
  target: string,
  mode: FolderColorMatchMode
): { depth: number; priority: number } | null {
  let bestMatch: { depth: number; priority: number } | null = null;

  for (const folderPath of folderPaths) {
    const normalizedPath = normalizeVaultPath(folderPath);
    if (!normalizedPath) {
      continue;
    }

    const match = rule.type === "combined"
      ? getCombinedFolderMatch(normalizedPath, target, mode)
      : getFolderRuleMatch(normalizedPath, target, rule.inheritToChildren !== false, mode);

    if (
      match &&
      (!bestMatch ||
        match.priority > bestMatch.priority ||
        (match.priority === bestMatch.priority && match.depth > bestMatch.depth))
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

function getFolderRuleMatch(
  folderPath: string,
  target: string,
  inheritToChildren: boolean,
  mode: FolderColorMatchMode
): { depth: number; priority: number } | null {
  const depth = target.split("/").filter(Boolean).length;

  if (folderPath === target) {
    return { depth, priority: 3 };
  }

  if (mode === "folderNode" || inheritToChildren) {
    return folderPathMatchesPathRule(folderPath, target)
      ? { depth, priority: mode === "fileNode" ? 2 : 1 }
      : null;
  }

  return null;
}

function getCombinedFolderMatch(
  folderPath: string,
  target: string,
  mode: FolderColorMatchMode
): { depth: number; priority: number } | null {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index] === target) {
      return { depth: index + 1, priority: mode === "fileNode" ? 1 : 2 };
    }
  }

  return null;
}

export function getFolderColorStackForPaths(
  folderPaths: readonly string[],
  folderColorRules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): GraphColor[] {
  return getFolderColorRuleColors(folderPaths, folderColorRules, mode);
}

export function getDeepestFolderColorForPaths(
  folderPaths: readonly string[],
  folderColorRules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): GraphColor | null {
  const colors = getFolderColorStackForPaths(folderPaths, folderColorRules, mode);
  return colors[colors.length - 1] ?? null;
}

export function getGraphNodePluginColors(
  nodes: Record<string, GraphLinkColorNode> | undefined,
  folderColorRules: readonly FolderColorRule[],
  getNodeFolderPaths: (nodeId: string) => readonly string[],
  isFolderNode: (nodeId: string) => boolean
): Map<string, GraphColor> {
  const colorsByNodeId = new Map<string, GraphColor>();

  for (const nodeId of Object.keys(nodes ?? {})) {
    const color = getDeepestFolderColorForPaths(
      getNodeFolderPaths(nodeId),
      folderColorRules,
      isFolderNode(nodeId) ? "folderNode" : "fileNode"
    );
    if (color) {
      colorsByNodeId.set(nodeId, color);
    }
  }

  return colorsByNodeId;
}

export function getGraphLinkColorDecision(
  sourceColor: GraphColor | null | undefined,
  targetColor: GraphColor | null | undefined
): GraphLinkColorDecision {
  if (sourceColor && targetColor) {
    return sourceColor.rgb === targetColor.rgb && (sourceColor.a ?? 1) === (targetColor.a ?? 1)
      ? { type: "solid", color: sourceColor }
      : { type: "split", sourceColor, targetColor };
  }

  if (sourceColor || targetColor) {
    return { type: "solid", color: sourceColor ?? (targetColor as GraphColor) };
  }

  return { type: "default" };
}

export function getFolderColorForPaths(
  folderPaths: readonly string[],
  colorGroups: readonly GraphColorGroup[],
  folderColorRules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): GraphColor | null {
  return (
    getFolderColorRuleColor(folderPaths, folderColorRules, mode) ??
    getFolderGroupColorForPaths(folderPaths, colorGroups)
  );
}

export function getFolderVisualForPaths(
  folderPaths: readonly string[],
  colorGroups: readonly GraphColorGroup[],
  folderColorRules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): FolderColorVisual | null {
  const ruleVisual = getFolderColorRuleVisual(folderPaths, folderColorRules, mode);
  if (ruleVisual) {
    return ruleVisual;
  }

  const fallbackColor = getFolderGroupColorForPaths(folderPaths, colorGroups);
  return fallbackColor ? { color: fallbackColor, rings: 0 } : null;
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
