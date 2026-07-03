export type IWorkPackageSettings = {
  enabled: boolean;
};

export type IWorkGraphNode = {
  type?: unknown;
  folderNode?: unknown;
  links?: Record<string, unknown>;
  [key: string]: unknown;
};

export type IWorkGraphData = {
  nodes?: Record<string, IWorkGraphNode>;
  [key: string]: unknown;
};

export type ListedPaths = {
  files: string[];
  folders: string[];
};

export const IWORK_PACKAGE_EXTENSIONS = ["key", "numbers", "pages"] as const;

export const DEFAULT_IWORK_PACKAGE_SETTINGS: IWorkPackageSettings = {
  enabled: false
};

export function normalizeIWorkPackageSettings(value: unknown): IWorkPackageSettings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_IWORK_PACKAGE_SETTINGS };
  }

  const raw = value as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_IWORK_PACKAGE_SETTINGS.enabled
  };
}

export function isIWorkPackagePath(path: string): boolean {
  return (IWORK_PACKAGE_EXTENSIONS as readonly string[]).includes(getPathExtension(path));
}

export function moveIWorkPackagesFromFolderList(listed: ListedPaths): ListedPaths {
  const files = new Set(listed.files);
  const folders: string[] = [];

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

export function normalizeIWorkPackageGraphData(
  data: IWorkGraphData,
  isFolderNode: (nodeId: string, node: IWorkGraphNode | undefined) => boolean
): IWorkGraphData {
  if (!data.nodes) {
    return data;
  }

  const packageNodeIds = new Map<string, string>();
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

  const packageDescendantIds = new Set<string>();
  for (const nodeId of Object.keys(data.nodes)) {
    for (const packageNodeId of packageNodeIds.keys()) {
      if (nodeId.startsWith(`${packageNodeId}/`)) {
        packageDescendantIds.add(nodeId);
      }
    }
  }

  const rewriteNodeId = (nodeId: string): string => packageNodeIds.get(nodeId) ?? nodeId;
  const nodes: Record<string, IWorkGraphNode> = {};

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

export function getPathExtension(path: string): string {
  const normalizedPath = path.split("#")[0].split("?")[0].replace(/\\/g, "/").replace(/\/+$/, "");
  const slashIndex = normalizedPath.lastIndexOf("/");
  const basename = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
  const dotIndex = basename.lastIndexOf(".");

  return dotIndex > 0 && dotIndex < basename.length - 1
    ? basename.slice(dotIndex + 1).toLowerCase()
    : "";
}

function folderNodeIdToFilePath(nodeId: string): string {
  return nodeId.startsWith("/") ? nodeId.slice(1) : "";
}

function graphFolderNodeToFileNode(node: IWorkGraphNode): IWorkGraphNode {
  const { type: _type, folderNode: _folderNode, ...fileNode } = node;
  return fileNode;
}

function rewriteIWorkPackageLinks(
  links: Record<string, unknown> | undefined,
  ownNodeId: string,
  packageNodeIds: ReadonlyMap<string, string>,
  packageDescendantIds: ReadonlySet<string>
): Record<string, unknown> {
  const rewrittenLinks: Record<string, unknown> = {};
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
