var IWORK_PACKAGE_EXTENSIONS = ["key", "numbers", "pages"];
var DEFAULT_IWORK_PACKAGE_SETTINGS = {
  enabled: false
};
function normalizeIWorkPackageSettings(value) {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_IWORK_PACKAGE_SETTINGS };
  }
  const raw = value;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_IWORK_PACKAGE_SETTINGS.enabled
  };
}
function isIWorkPackagePath(path) {
  return IWORK_PACKAGE_EXTENSIONS.includes(getPathExtension(path));
}
function moveIWorkPackagesFromFolderList(listed) {
  const files = new Set(listed.files);
  const folders = [];
  for (const folder of listed.folders) {
    if (isIWorkPackagePath(folder)) {
      files.add(folder);
    } else {
      folders.push(folder);
    }
  }
  return {
    ...listed,
    files: [...files],
    folders
  };
}
function normalizeIWorkPackageGraphData(data, isFolderNode) {
  if (!data.nodes) {
    return data;
  }
  const packageNodeIds = /* @__PURE__ */ new Map();
  for (const [nodeId, node] of Object.entries(data.nodes)) {
    if (!isFolderNode(nodeId, node)) {
      continue;
    }
    const packagePath = folderNodeIdToFilePath(nodeId);
    if (packagePath && isIWorkPackagePath(packagePath)) {
      packageNodeIds.set(nodeId, packagePath);
    }
  }
  if (packageNodeIds.size === 0) {
    return data;
  }
  const packageDescendantIds = /* @__PURE__ */ new Set();
  for (const nodeId of Object.keys(data.nodes)) {
    for (const packageNodeId of packageNodeIds.keys()) {
      if (nodeId.startsWith(`${packageNodeId}/`)) {
        packageDescendantIds.add(nodeId);
      }
    }
  }
  const rewriteNodeId = (nodeId) => packageNodeIds.get(nodeId) ?? nodeId;
  const nodes = {};
  for (const [nodeId, node] of Object.entries(data.nodes)) {
    if (packageDescendantIds.has(nodeId)) {
      continue;
    }
    const targetNodeId = rewriteNodeId(nodeId);
    const convertedNode = packageNodeIds.has(nodeId) ? graphFolderNodeToFileNode(node) : node;
    const links = rewriteIWorkPackageLinks(
      convertedNode.links,
      targetNodeId,
      packageNodeIds,
      packageDescendantIds
    );
    const existingNode = nodes[targetNodeId];
    nodes[targetNodeId] = {
      ...existingNode,
      ...convertedNode,
      links: {
        ...(existingNode?.links ?? {}),
        ...links
      }
    };
  }
  return { ...data, nodes };
}
function getPathExtension(path) {
  const normalizedPath = path.split("#")[0].split("?")[0].replace(/\\/g, "/").replace(/\/+$/, "");
  const slashIndex = normalizedPath.lastIndexOf("/");
  const basename = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
  const dotIndex = basename.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < basename.length - 1 ? basename.slice(dotIndex + 1).toLowerCase() : "";
}
function folderNodeIdToFilePath(nodeId) {
  return nodeId.startsWith("/") ? nodeId.slice(1) : "";
}
function graphFolderNodeToFileNode(node) {
  const { type: _type, folderNode: _folderNode, ...fileNode } = node;
  return fileNode;
}
function rewriteIWorkPackageLinks(links, ownNodeId, packageNodeIds, packageDescendantIds) {
  const rewrittenLinks = {};
  if (!links) {
    return rewrittenLinks;
  }
  for (const [targetId, value] of Object.entries(links)) {
    if (packageDescendantIds.has(targetId)) {
      continue;
    }
    const rewrittenTargetId = packageNodeIds.get(targetId) ?? targetId;
    if (rewrittenTargetId === ownNodeId) {
      continue;
    }
    rewrittenLinks[rewrittenTargetId] = value;
  }
  return rewrittenLinks;
}
export {
  DEFAULT_IWORK_PACKAGE_SETTINGS,
  IWORK_PACKAGE_EXTENSIONS,
  getPathExtension,
  isIWorkPackagePath,
  moveIWorkPackagesFromFolderList,
  normalizeIWorkPackageGraphData,
  normalizeIWorkPackageSettings
};
