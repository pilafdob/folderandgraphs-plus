export type GraphColor = {
  a?: number;
  rgb: number;
};

export type GraphColorGroup = {
  query?: unknown;
  color?: unknown;
};

export type FolderColorRuleType = "folder" | "combined";

export type FolderColorChildRule = {
  type: FolderColorRuleType;
  target: string;
  colorLinks: boolean;
  rings: number;
  children: FolderColorChildRule[];
};

export type FolderColorRule = {
  type: FolderColorRuleType;
  target: string;
  color: string;
  inheritToChildren: boolean;
  colorLinks: boolean;
  rings: number;
  children: FolderColorChildRule[];
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
  colorLinks: boolean;
  depth: number;
  level: number;
  priority: number;
  rings: number;
  ruleIndex: number;
  targetKey: string;
};

export type FolderColorVisual = {
  color: GraphColor;
  colorLinks: boolean;
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
  return match
    ? {
        color: match.color,
        colorLinks: getWinningColorLinks(matches),
        rings: getWinningRingCount(matches)
      }
    : null;
}

function getWinningColorLinks(matches: readonly FolderColorRuleMatch[]): boolean {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    if (match) {
      return match.colorLinks;
    }
  }

  return true;
}

function getWinningRingCount(matches: readonly FolderColorRuleMatch[]): number {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const rings = matches[index]?.rings ?? 0;
    if (rings > 0) {
      return rings;
    }
  }

  return 0;
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

    const ruleMatches = getFolderColorRuleMatches(folderPaths, rule, target, mode, color, ruleIndex);
    if (ruleMatches.length === 0) {
      return;
    }

    matches.push(...ruleMatches.map((match) => ({ ...match, targetKey })));
    seenTargets.add(targetKey);
  });

  return matches
    .sort((a, b) => (
      a.priority - b.priority ||
      a.depth - b.depth ||
      a.level - b.level ||
      a.ruleIndex - b.ruleIndex
    ));
}

export function getFolderColorRuleColor(
  folderPaths: readonly string[],
  rules: readonly FolderColorRule[],
  mode: FolderColorMatchMode = "folderNode"
): GraphColor | null {
  const colors = getFolderColorRuleColors(folderPaths, rules, mode);
  return colors[colors.length - 1] ?? null;
}

function getFolderColorRuleMatches(
  folderPaths: readonly string[],
  rule: FolderColorRule,
  target: string,
  mode: FolderColorMatchMode,
  color: GraphColor,
  ruleIndex: number
): FolderColorRuleMatch[] {
  const matches: FolderColorRuleMatch[] = [];

  for (const folderPath of folderPaths) {
    const normalizedPath = normalizeVaultPath(folderPath);
    if (!normalizedPath) {
      continue;
    }

    const match = rule.type === "combined"
      ? getCombinedFolderMatch(normalizedPath, target, mode)
      : getFolderRuleMatch(normalizedPath, target, rule.inheritToChildren !== false, mode);

    const childScope = match ?? getFolderRuleChildScope(normalizedPath, rule, target);
    if (!childScope) {
      continue;
    }

    if (match) {
      matches.push({
        color,
        colorLinks: rule.colorLinks !== false,
        depth: match.depth,
        level: 0,
        priority: match.priority,
        rings: normalizeFolderRuleRings(rule.rings),
        ruleIndex,
        targetKey: `${rule.type}:${target}`
      });
    }

    matches.push(...getNestedFolderColorRuleMatches(
      normalizedPath,
      rule.children ?? [],
      childScope.scope,
      color,
      mode,
      1,
      ruleIndex
    ));
  }

  return matches;
}

function getFolderRuleMatch(
  folderPath: string,
  target: string,
  inheritToChildren: boolean,
  mode: FolderColorMatchMode
): { depth: number; priority: number; scope: string } | null {
  const depth = target.split("/").filter(Boolean).length;

  if (folderPath === target) {
    return { depth, priority: 3, scope: target };
  }

  if (mode === "folderNode" || inheritToChildren) {
    return folderPathMatchesPathRule(folderPath, target)
      ? { depth, priority: mode === "fileNode" ? 2 : 1, scope: target }
      : null;
  }

  return null;
}

function getCombinedFolderMatch(
  folderPath: string,
  target: string,
  mode: FolderColorMatchMode
): { depth: number; priority: number; scope: string } | null {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index] === target) {
      return {
        depth: index + 1,
        priority: mode === "fileNode" ? 1 : 2,
        scope: parts.slice(0, index + 1).join("/")
      };
    }
  }

  return null;
}

function getFolderRuleChildScope(
  folderPath: string,
  rule: FolderColorRule,
  target: string
): { scope: string } | null {
  if (rule.type !== "folder" || (rule.children ?? []).length === 0) {
    return null;
  }

  return folderPathMatchesPathRule(folderPath, target) ? { scope: target } : null;
}

function getNestedFolderColorRuleMatches(
  folderPath: string,
  children: readonly FolderColorChildRule[],
  parentScope: string,
  color: GraphColor,
  mode: FolderColorMatchMode,
  level: number,
  parentRuleIndex: number
): FolderColorRuleMatch[] {
  const matches: FolderColorRuleMatch[] = [];

  children.forEach((child, childIndex) => {
    const target = normalizeVaultPath(child.target);
    if (!target) {
      return;
    }

    const match = child.type === "combined"
      ? getScopedCombinedFolderMatch(folderPath, target, parentScope, mode)
      : getScopedFolderRuleMatch(folderPath, target, parentScope, mode);
    if (!match) {
      return;
    }

    const colorLinks = child.colorLinks !== false;
    matches.push({
      color,
      colorLinks,
      depth: match.depth,
      level,
      priority: match.priority,
      rings: normalizeFolderRuleRings(child.rings),
      ruleIndex: parentRuleIndex + ((childIndex + 1) / 1000),
      targetKey: `${level}:${child.type}:${target}`
    });
    matches.push(...getNestedFolderColorRuleMatches(
      folderPath,
      child.children ?? [],
      match.scope,
      color,
      mode,
      level + 1,
      parentRuleIndex + ((childIndex + 1) / 1000)
    ));
  });

  return matches;
}

function getScopedFolderRuleMatch(
  folderPath: string,
  target: string,
  parentScope: string,
  mode: FolderColorMatchMode
): { depth: number; priority: number; scope: string } | null {
  const scopedTarget = getScopedFolderTarget(target, parentScope);
  if (!scopedTarget) {
    return null;
  }

  const depth = scopedTarget.split("/").filter(Boolean).length;
  return folderPathMatchesPathRule(folderPath, scopedTarget)
    ? { depth, priority: mode === "fileNode" ? 4 : 3, scope: scopedTarget }
    : null;
}

function getScopedFolderTarget(target: string, parentScope: string): string | null {
  if (folderPathMatchesPathRule(target, parentScope)) {
    return target;
  }

  const basename = folderBasenameFromPath(target);
  return basename ? `${parentScope}/${basename}` : null;
}

function getScopedCombinedFolderMatch(
  folderPath: string,
  target: string,
  parentScope: string,
  mode: FolderColorMatchMode
): { depth: number; priority: number; scope: string } | null {
  if (!folderPathMatchesPathRule(folderPath, parentScope)) {
    return null;
  }

  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  const parentDepth = parentScope.split("/").filter(Boolean).length;
  for (let index = parts.length - 1; index >= parentDepth; index -= 1) {
    if (parts[index] === target) {
      return {
        depth: index + 1,
        priority: mode === "fileNode" ? 4 : 3,
        scope: parts.slice(0, index + 1).join("/")
      };
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
    const visual = getFolderColorRuleVisual(
      getNodeFolderPaths(nodeId),
      folderColorRules,
      isFolderNode(nodeId) ? "folderNode" : "fileNode"
    );
    if (visual?.color && visual.colorLinks) {
      colorsByNodeId.set(nodeId, visual.color);
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
  return fallbackColor ? { color: fallbackColor, colorLinks: true, rings: 0 } : null;
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
