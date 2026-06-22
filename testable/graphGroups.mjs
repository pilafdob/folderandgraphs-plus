// src/graphGroups.ts
function normalizeVaultPath(path) {
  if (typeof path !== "string") return "";
  return path.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}
function folderPathFromNodeId(nodeId) {
  if (nodeId === "/") return "";
  return normalizeVaultPath(nodeId);
}
function parsePathTokens(query) {
  if (typeof query !== "string") return [];
  const tokens = [];
  const re = /(^|[\s(])([!-])?path:(?:"([^"]+)"|'([^']+)'|([^\s)]+))/gi;
  let match;
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
function folderPathMatchesPathRule(folderPath, rulePath) {
  const folder = normalizeVaultPath(folderPath);
  const rule = normalizeVaultPath(rulePath);
  return rule.length > 0 && (folder === rule || folder.startsWith(`${rule}/`));
}
function folderPathMatchesGroupQuery(folderPath, query) {
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
function isGraphColor(value) {
  return typeof value === "object" && value !== null && typeof value.rgb === "number";
}
function parseHexGraphColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return null;
  }
  return {
    a: 1,
    rgb: Number.parseInt(value.trim().slice(1), 16)
  };
}
function folderBasenameFromPath(folderPath) {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
function getFolderColorRuleColors(folderPaths, rules, mode = "folderNode") {
  return getSortedFolderColorRuleMatches(folderPaths, rules, mode).map((match) => match.color);
}
function getFolderColorRuleVisual(folderPaths, rules, mode = "folderNode") {
  const matches = getSortedFolderColorRuleMatches(folderPaths, rules, mode);
  const match = matches[matches.length - 1];
  return match ? {
    color: match.color,
    colorLinks: getWinningColorLinks(matches)
  } : null;
}
function getWinningColorLinks(matches) {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    if (match) {
      return match.colorLinks;
    }
  }
  return true;
}
function getSortedFolderColorRuleMatches(folderPaths, rules, mode) {
  const matches = [];
  const seenTargets = /* @__PURE__ */ new Set();
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
  return matches.sort((a, b) => a.priority - b.priority || a.depth - b.depth || a.level - b.level || a.ruleIndex - b.ruleIndex);
}
function getFolderColorRuleColor(folderPaths, rules, mode = "folderNode") {
  const colors = getFolderColorRuleColors(folderPaths, rules, mode);
  return colors[colors.length - 1] ?? null;
}
function getFolderColorRuleMatches(folderPaths, rule, target, mode, color, ruleIndex) {
  const matches = [];
  for (const folderPath of folderPaths) {
    const normalizedPath = normalizeVaultPath(folderPath);
    if (!normalizedPath) {
      continue;
    }
    const match = rule.type === "combined" ? getCombinedFolderMatch(normalizedPath, target, mode) : getFolderRuleMatch(normalizedPath, target, rule.inheritToChildren !== false, mode);
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
function getFolderRuleChildScope(folderPath, rule, target) {
  if (rule.type !== "folder" || (rule.children ?? []).length === 0) {
    return null;
  }
  return folderPathMatchesPathRule(folderPath, target) ? { scope: target } : null;
}
function getNestedFolderColorRuleMatches(folderPath, children, parentScope, color, mode, level, parentRuleIndex) {
  const matches = [];
  children.forEach((child, childIndex) => {
    const target = normalizeVaultPath(child.target);
    if (!target) {
      return;
    }
    const match = child.type === "combined" ? getScopedCombinedFolderMatch(folderPath, target, parentScope, mode) : getScopedFolderRuleMatch(folderPath, target, parentScope, mode);
    if (!match) {
      return;
    }
    const childRuleIndex = parentRuleIndex + (childIndex + 1) / 1e3;
    matches.push({
      color,
      colorLinks: child.colorLinks !== false,
      depth: match.depth,
      level,
      priority: match.priority,
      ruleIndex: childRuleIndex,
      targetKey: `${level}:${child.type}:${target}`
    });
    matches.push(...getNestedFolderColorRuleMatches(
      folderPath,
      child.children ?? [],
      match.scope,
      color,
      mode,
      level + 1,
      childRuleIndex
    ));
  });
  return matches;
}
function getScopedFolderRuleMatch(folderPath, target, parentScope, mode) {
  const scopedTarget = getScopedFolderTarget(target, parentScope);
  if (!scopedTarget) {
    return null;
  }
  const depth = scopedTarget.split("/").filter(Boolean).length;
  return folderPathMatchesPathRule(folderPath, scopedTarget) ? {
    depth,
    exact: folderPath === scopedTarget,
    priority: mode === "fileNode" ? 4 : 3,
    scope: scopedTarget
  } : null;
}
function getScopedFolderTarget(target, parentScope) {
  if (folderPathMatchesPathRule(target, parentScope)) {
    return target;
  }
  const basename = folderBasenameFromPath(target);
  return basename ? `${parentScope}/${basename}` : null;
}
function getScopedCombinedFolderMatch(folderPath, target, parentScope, mode) {
  if (!folderPathMatchesPathRule(folderPath, parentScope)) {
    return null;
  }
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  const parentDepth = parentScope.split("/").filter(Boolean).length;
  for (let index = parts.length - 1; index >= parentDepth; index -= 1) {
    if (parts[index] === target) {
      return {
        depth: index + 1,
        exact: index === parts.length - 1,
        priority: mode === "fileNode" ? 4 : 3,
        scope: parts.slice(0, index + 1).join("/")
      };
    }
  }
  return null;
}
function getFolderRuleMatch(folderPath, target, inheritToChildren, mode) {
  const depth = target.split("/").filter(Boolean).length;
  if (folderPath === target) {
    return { depth, exact: true, priority: 3, scope: target };
  }
  if (mode === "folderNode" || inheritToChildren) {
    return folderPathMatchesPathRule(folderPath, target) ? { depth, exact: false, priority: mode === "fileNode" ? 2 : 1, scope: target } : null;
  }
  return null;
}
function getCombinedFolderMatch(folderPath, target, mode) {
  const parts = normalizeVaultPath(folderPath).split("/").filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index] === target) {
      return {
        depth: index + 1,
        exact: index === parts.length - 1,
        priority: mode === "fileNode" ? 1 : 2,
        scope: parts.slice(0, index + 1).join("/")
      };
    }
  }
  return null;
}
function getFolderColorStackForPaths(folderPaths, folderColorRules, mode = "folderNode") {
  return getFolderColorRuleColors(folderPaths, folderColorRules, mode);
}
function getDeepestFolderColorForPaths(folderPaths, folderColorRules, mode = "folderNode") {
  const colors = getFolderColorStackForPaths(folderPaths, folderColorRules, mode);
  return colors[colors.length - 1] ?? null;
}
function getGraphNodePluginColors(nodes, folderColorRules, getNodeFolderPaths, isFolderNode) {
  const colorsByNodeId = /* @__PURE__ */ new Map();
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
function getGraphLinkColorDecision(sourceColor, targetColor) {
  if (sourceColor && targetColor) {
    return sourceColor.rgb === targetColor.rgb && (sourceColor.a ?? 1) === (targetColor.a ?? 1) ? { type: "solid", color: sourceColor } : { type: "split", sourceColor, targetColor };
  }
  if (sourceColor || targetColor) {
    return { type: "solid", color: sourceColor ?? targetColor };
  }
  return { type: "default" };
}
function getFolderColorForPaths(folderPaths, colorGroups, folderColorRules, mode = "folderNode") {
  return getFolderColorRuleColor(folderPaths, folderColorRules, mode) ?? getFolderGroupColorForPaths(folderPaths, colorGroups);
}
function getFolderVisualForPaths(folderPaths, colorGroups, folderColorRules, mode = "folderNode") {
  const ruleVisual = getFolderColorRuleVisual(folderPaths, folderColorRules, mode);
  if (ruleVisual) {
    return ruleVisual;
  }
  const fallbackColor = getFolderGroupColorForPaths(folderPaths, colorGroups);
  return fallbackColor ? {
    color: fallbackColor,
    colorLinks: true
  } : null;
}
function getFolderGroupColor(folderPath, colorGroups) {
  return getFolderGroupColorForPaths([folderPath], colorGroups);
}
function getFolderGroupColorForPaths(folderPaths, colorGroups) {
  for (const group of colorGroups) {
    if (folderPaths.some((folderPath) => folderPathMatchesGroupQuery(folderPath, group.query)) && isGraphColor(group.color)) {
      return group.color;
    }
  }
  return null;
}
export {
  folderBasenameFromPath,
  folderPathFromNodeId,
  folderPathMatchesGroupQuery,
  folderPathMatchesPathRule,
  getDeepestFolderColorForPaths,
  getFolderColorForPaths,
  getFolderColorRuleColor,
  getFolderColorRuleColors,
  getFolderColorRuleVisual,
  getFolderColorStackForPaths,
  getFolderGroupColor,
  getFolderGroupColorForPaths,
  getFolderVisualForPaths,
  getGraphLinkColorDecision,
  getGraphNodePluginColors,
  isGraphColor,
  normalizeVaultPath,
  parseHexGraphColor,
  parsePathTokens
};
