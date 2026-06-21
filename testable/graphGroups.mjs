export function normalizeVaultPath(path) {
  if (typeof path !== "string") return "";
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function folderPathFromNodeId(nodeId) {
  if (nodeId === "/") return "";
  return normalizeVaultPath(nodeId);
}

export function parsePathTokens(query) {
  if (typeof query !== "string") return [];

  const tokens = [];
  const re = /(^|[\s(])([!-])?path:(?:"([^"]+)"|'([^']+)'|([^\s)]+))/gi;
  let match = null;

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

export function folderPathMatchesPathRule(folderPath, rulePath) {
  const folder = normalizeVaultPath(folderPath);
  const rule = normalizeVaultPath(rulePath);
  return rule.length > 0 && (folder === rule || folder.startsWith(`${rule}/`));
}

export function folderPathMatchesGroupQuery(folderPath, query) {
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

export function isGraphColor(value) {
  return typeof value === "object" && value !== null && typeof value.rgb === "number";
}

export function parseHexGraphColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return null;
  }

  return {
    a: 1,
    rgb: Number.parseInt(value.trim().slice(1), 16)
  };
}

export function folderBasenameFromPath(folderPath) {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function getFolderColorRuleColors(folderPaths, rules, mode = "folderNode") {
  const matches = [];
  const seenTargets = new Set();

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

    matches.push({ color, depth: match.depth, priority: match.priority, ruleIndex, targetKey });
    seenTargets.add(targetKey);
  });

  return matches
    .sort((a, b) => a.priority - b.priority || a.depth - b.depth || a.ruleIndex - b.ruleIndex)
    .map((match) => match.color);
}

export function getFolderColorRuleColor(folderPaths, rules, mode = "folderNode") {
  const colors = getFolderColorRuleColors(folderPaths, rules, mode);
  return colors[colors.length - 1] ?? null;
}

function getFolderColorRuleMatch(folderPaths, rule, target, mode) {
  let bestMatch = null;

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

function getFolderRuleMatch(folderPath, target, inheritToChildren, mode) {
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

function getCombinedFolderMatch(folderPath, target, mode) {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index] === target) {
      return { depth: index + 1, priority: mode === "fileNode" ? 1 : 2 };
    }
  }

  return null;
}

export function getFolderColorStackForPaths(folderPaths, folderColorRules, mode = "folderNode") {
  return getFolderColorRuleColors(folderPaths, folderColorRules, mode);
}

export function getDeepestFolderColorForPaths(folderPaths, folderColorRules, mode = "folderNode") {
  const colors = getFolderColorStackForPaths(folderPaths, folderColorRules, mode);
  return colors[colors.length - 1] ?? null;
}

export function getGraphNodePluginColors(nodes, folderColorRules, getNodeFolderPaths, isFolderNode) {
  const colorsByNodeId = new Map();

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

export function getGraphLinkColorDecision(sourceColor, targetColor) {
  if (sourceColor && targetColor) {
    return sourceColor.rgb === targetColor.rgb && (sourceColor.a ?? 1) === (targetColor.a ?? 1)
      ? { type: "solid", color: sourceColor }
      : { type: "split", sourceColor, targetColor };
  }

  if (sourceColor || targetColor) {
    return { type: "solid", color: sourceColor ?? targetColor };
  }

  return { type: "default" };
}

export function getFolderColorForPaths(folderPaths, colorGroups, folderColorRules, mode = "folderNode") {
  return getFolderColorRuleColor(folderPaths, folderColorRules, mode) ??
    getFolderGroupColorForPaths(folderPaths, colorGroups);
}

export function getFolderGroupColor(folderPath, colorGroups) {
  return getFolderGroupColorForPaths([folderPath], colorGroups);
}

export function getFolderGroupColorForPaths(folderPaths, colorGroups) {
  for (const group of colorGroups) {
    if (folderPaths.some((folderPath) => folderPathMatchesGroupQuery(folderPath, group.query)) && isGraphColor(group.color)) {
      return group.color;
    }
  }

  return null;
}
