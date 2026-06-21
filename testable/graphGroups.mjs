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
