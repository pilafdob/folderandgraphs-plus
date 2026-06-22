export type GraphFilterAttachmentMode = "all" | "pdf" | "documents" | "hide-media" | "custom" | "none";

export type GraphFilterSettings = {
  enabled: boolean;
  showNotes: boolean;
  showFolders: boolean;
  showTags: boolean;
  showCanvases: boolean;
  attachmentMode: GraphFilterAttachmentMode;
  attachmentExtensions: string[];
  hideOrphans: boolean;
};

export type GraphFilterNode = {
  type?: unknown;
  folderNode?: unknown;
  links?: Record<string, unknown>;
  [key: string]: unknown;
};

export type GraphFilterData = {
  nodes?: Record<string, GraphFilterNode>;
  [key: string]: unknown;
};

export const DEFAULT_GRAPH_FILTER_SETTINGS: GraphFilterSettings = {
  enabled: false,
  showNotes: true,
  showFolders: true,
  showTags: true,
  showCanvases: true,
  attachmentMode: "all",
  attachmentExtensions: ["pdf"],
  hideOrphans: false
};

export const DOCUMENT_ATTACHMENT_EXTENSIONS = [
  "csv",
  "doc",
  "docx",
  "key",
  "numbers",
  "pages",
  "pdf",
  "ppt",
  "pptx",
  "xls",
  "xlsx"
] as const;

export const MEDIA_ATTACHMENT_EXTENSIONS = [
  "aac",
  "aiff",
  "avif",
  "avi",
  "flac",
  "gif",
  "jpeg",
  "jpg",
  "m4a",
  "m4v",
  "mov",
  "mp3",
  "mp4",
  "ogg",
  "png",
  "svg",
  "wav",
  "webm",
  "webp"
] as const;

export const ATTACHMENT_EXTENSION_GROUPS = [
  { label: "PDFs", extensions: ["pdf"] },
  { label: "Images", extensions: ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"] },
  { label: "Audio", extensions: ["aac", "aiff", "flac", "m4a", "mp3", "ogg", "wav"] },
  { label: "Video", extensions: ["avi", "m4v", "mov", "mp4", "webm"] },
  { label: "Office", extensions: ["csv", "doc", "docx", "key", "numbers", "pages", "ppt", "pptx", "xls", "xlsx"] },
  { label: "Archives", extensions: ["7z", "gz", "rar", "tar", "zip"] },
  { label: "Code", extensions: ["css", "html", "js", "json", "jsx", "mjs", "py", "ts", "tsx", "xml", "yaml", "yml"] }
] as const;

export function normalizeGraphFilterSettings(value: unknown): GraphFilterSettings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_GRAPH_FILTER_SETTINGS };
  }

  const raw = value as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_GRAPH_FILTER_SETTINGS.enabled,
    showNotes: typeof raw.showNotes === "boolean" ? raw.showNotes : DEFAULT_GRAPH_FILTER_SETTINGS.showNotes,
    showFolders: typeof raw.showFolders === "boolean" ? raw.showFolders : DEFAULT_GRAPH_FILTER_SETTINGS.showFolders,
    showTags: typeof raw.showTags === "boolean" ? raw.showTags : DEFAULT_GRAPH_FILTER_SETTINGS.showTags,
    showCanvases: typeof raw.showCanvases === "boolean" ? raw.showCanvases : DEFAULT_GRAPH_FILTER_SETTINGS.showCanvases,
    attachmentMode: normalizeAttachmentMode(raw.attachmentMode),
    attachmentExtensions: normalizeAttachmentExtensions(raw.attachmentExtensions),
    hideOrphans: typeof raw.hideOrphans === "boolean" ? raw.hideOrphans : DEFAULT_GRAPH_FILTER_SETTINGS.hideOrphans
  };
}

export function applyGraphFilters(
  data: GraphFilterData,
  settings: GraphFilterSettings,
  isFolderNode: (nodeId: string, node: GraphFilterNode | undefined) => boolean
): GraphFilterData {
  if (!settings.enabled || !data.nodes) {
    return data;
  }

  const keptNodeIds = new Set<string>();
  for (const [nodeId, node] of Object.entries(data.nodes)) {
    if (shouldShowGraphNode(nodeId, node, settings, isFolderNode)) {
      keptNodeIds.add(nodeId);
    }
  }

  if (settings.hideOrphans) {
    removeOrphanNodeIds(keptNodeIds, data.nodes);
  }

  const nodes: Record<string, GraphFilterNode> = {};
  for (const nodeId of keptNodeIds) {
    const node = data.nodes[nodeId];
    if (!node) {
      continue;
    }

    nodes[nodeId] = {
      ...node,
      links: filterNodeLinks(node.links, keptNodeIds)
    };
  }

  return { ...data, nodes };
}

export function shouldShowGraphNode(
  nodeId: string,
  node: GraphFilterNode | undefined,
  settings: GraphFilterSettings,
  isFolderNode: (nodeId: string, node: GraphFilterNode | undefined) => boolean
): boolean {
  if (isFolderNode(nodeId, node)) {
    return settings.showFolders;
  }

  if (node?.type === "tag" || nodeId.startsWith("#")) {
    return settings.showTags;
  }

  const extension = getNodeExtension(nodeId);
  if (extension === "md" || extension === "") {
    return settings.showNotes;
  }

  if (extension === "canvas") {
    return settings.showCanvases;
  }

  return shouldShowAttachmentExtension(extension, settings);
}

export function normalizeAttachmentExtensions(value: unknown): string[] {
  const extensions = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : DEFAULT_GRAPH_FILTER_SETTINGS.attachmentExtensions;
  const unique = new Set<string>();

  for (const extension of extensions) {
    if (typeof extension !== "string") {
      continue;
    }

    const normalized = extension.trim().toLowerCase().replace(/^\.+/, "");
    if (/^[a-z0-9]+$/.test(normalized)) {
      unique.add(normalized);
    }
  }

  return unique.size > 0 ? [...unique].sort() : [...DEFAULT_GRAPH_FILTER_SETTINGS.attachmentExtensions];
}

export function shouldShowAttachmentExtension(extension: string, settings: GraphFilterSettings): boolean {
  switch (settings.attachmentMode) {
    case "all":
      return true;
    case "pdf":
      return extension === "pdf";
    case "documents":
      return (DOCUMENT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension);
    case "hide-media":
      return !(MEDIA_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension);
    case "custom":
      return settings.attachmentExtensions.includes(extension);
    case "none":
      return false;
  }
}

function normalizeAttachmentMode(value: unknown): GraphFilterAttachmentMode {
  if (
    value === "all" ||
    value === "pdf" ||
    value === "documents" ||
    value === "hide-media" ||
    value === "custom" ||
    value === "none"
  ) {
    return value;
  }

  return value === "selected" ? "custom" : DEFAULT_GRAPH_FILTER_SETTINGS.attachmentMode;
}

function getNodeExtension(nodeId: string): string {
  const path = nodeId.split("#")[0].split("?")[0];
  const slashIndex = path.lastIndexOf("/");
  const basename = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
  const dotIndex = basename.lastIndexOf(".");

  return dotIndex > 0 ? basename.slice(dotIndex + 1).toLowerCase() : "";
}

function filterNodeLinks(
  links: Record<string, unknown> | undefined,
  keptNodeIds: ReadonlySet<string>
): Record<string, unknown> | undefined {
  if (!links) {
    return links;
  }

  const filteredLinks: Record<string, unknown> = {};
  for (const [targetId, value] of Object.entries(links)) {
    if (keptNodeIds.has(targetId)) {
      filteredLinks[targetId] = value;
    }
  }

  return Object.keys(filteredLinks).length > 0 ? filteredLinks : undefined;
}

function removeOrphanNodeIds(
  keptNodeIds: Set<string>,
  nodes: Record<string, GraphFilterNode>
): void {
  const linkedNodeIds = new Set<string>();

  for (const nodeId of keptNodeIds) {
    const links = nodes[nodeId]?.links;
    if (!links) {
      continue;
    }

    for (const targetId of Object.keys(links)) {
      if (keptNodeIds.has(targetId)) {
        linkedNodeIds.add(nodeId);
        linkedNodeIds.add(targetId);
      }
    }
  }

  for (const nodeId of [...keptNodeIds]) {
    if (!linkedNodeIds.has(nodeId)) {
      keptNodeIds.delete(nodeId);
    }
  }
}
