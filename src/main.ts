import {
  AbstractInputSuggest,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  prepareFuzzySearch,
  getLinkpath,
  setIcon,
  type TAbstractFile,
  type FileStats,
  type WorkspaceLeaf
} from "obsidian";
import {
  type FolderColorChildRule,
  type FolderColorRule,
  type FolderColorRuleType,
  type GraphColor,
  type GraphColorGroup,
  folderPathFromNodeId,
  getFolderVisualForPaths,
  getGraphLinkColorDecision,
  getGraphNodePluginColors,
  normalizeFolderRuleBoldLabel,
  parseHexGraphColor
} from "./graphGroups";
import {
  DEFAULT_SHOW_FOLDER_EMOJI,
  buildFolderDisplayText
} from "./graphDisplay";
import {
  DEFAULT_GRAPH_FILTER_SETTINGS,
  applyGraphFilters,
  normalizeGraphFilterSettings,
  removeRootFolderNode,
  type GraphFilterSettings
} from "./graphFilters";
import {
  installGraphDataPatch,
  restoreGraphDataPatch,
  type GraphDataPatch
} from "./graphDataPatch";
import {
  DEFAULT_IWORK_PACKAGE_SETTINGS,
  getPathExtension,
  isIWorkPackagePath,
  normalizeIWorkPackageGraphData,
  normalizeIWorkPackageSettings,
  type IWorkPackageSettings
} from "./iworkPackages";
import Folder2GraphPlugin from "./vendor/folders2graph/main";

const FOLDER2GRAPH_NODE_TYPE = "f2g_node";
const DEFAULT_FOLDER_RULE_COLOR = "#5c8af5";

type Folder2GraphHeadingLinkAnchorMode =
  | "file-file"
  | "file-heading"
  | "heading-file"
  | "heading-heading";

type Folder2GraphFolderFilterMode = "exclude" | "include";

type Folder2GraphSettings = {
  showFolderNodes: boolean;
  hideRootNode: boolean;
  nodeColor: string;
  showHeadingNodes: boolean;
  headingNodeColor: string;
  headingLinkAnchorMode: Folder2GraphHeadingLinkAnchorMode;
  hiddenNodes: Record<string, boolean>;
  weightNodesBySubtree: boolean;
  folderFilterMode: Folder2GraphFolderFilterMode;
  folderFilterList: string[];
  folderFilterHideFiles: boolean;
};

const DEFAULT_FOLDER2GRAPH_SETTINGS: Folder2GraphSettings = {
  showFolderNodes: true,
  hideRootNode: true,
  nodeColor: "#5c8af5",
  showHeadingNodes: false,
  headingNodeColor: "#f5a55c",
  headingLinkAnchorMode: "heading-heading",
  hiddenNodes: {},
  weightNodesBySubtree: false,
  folderFilterMode: "exclude",
  folderFilterList: [],
  folderFilterHideFiles: false
};

type FolderAndGraphsPlusSettings = {
  combineSameNameFolders: boolean;
  showFolderEmoji: boolean;
  iWorkPackages: IWorkPackageSettings;
  graphFilters: GraphFilterSettings;
  folderColorRules: FolderColorRule[];
  folder2graph: Folder2GraphSettings;
};

const DEFAULT_SETTINGS: FolderAndGraphsPlusSettings = {
  combineSameNameFolders: false,
  showFolderEmoji: DEFAULT_SHOW_FOLDER_EMOJI,
  iWorkPackages: { ...DEFAULT_IWORK_PACKAGE_SETTINGS },
  graphFilters: {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    attachmentExtensions: [...DEFAULT_GRAPH_FILTER_SETTINGS.attachmentExtensions],
    attachmentFolderRules: [...DEFAULT_GRAPH_FILTER_SETTINGS.attachmentFolderRules]
  },
  folderColorRules: [],
  folder2graph: {
    ...DEFAULT_FOLDER2GRAPH_SETTINGS,
    hiddenNodes: { ...DEFAULT_FOLDER2GRAPH_SETTINGS.hiddenNodes },
    folderFilterList: [...DEFAULT_FOLDER2GRAPH_SETTINGS.folderFilterList]
  }
};

function createDefaultSettings(): FolderAndGraphsPlusSettings {
  return {
    ...DEFAULT_SETTINGS,
    iWorkPackages: { ...DEFAULT_SETTINGS.iWorkPackages },
    graphFilters: {
      ...DEFAULT_SETTINGS.graphFilters,
      attachmentExtensions: [...DEFAULT_SETTINGS.graphFilters.attachmentExtensions],
      attachmentFolderRules: [...DEFAULT_SETTINGS.graphFilters.attachmentFolderRules]
    },
    folderColorRules: [...DEFAULT_SETTINGS.folderColorRules],
    folder2graph: {
      ...DEFAULT_SETTINGS.folder2graph,
      hiddenNodes: { ...DEFAULT_SETTINGS.folder2graph.hiddenNodes },
      folderFilterList: [...DEFAULT_SETTINGS.folder2graph.folderFilterList]
    }
  };
}

type GraphRenderer = {
  nodes?: unknown[] | Set<unknown>;
  links?: unknown;
  edges?: unknown;
  linkNodes?: unknown;
  linkObjects?: unknown;
  nodeLookup?: Record<string, unknown> | Map<string, unknown>;
  renderer?: Record<string, unknown>;
  graph?: Record<string, unknown>;
  changed?: () => void;
  setData?: (data: GraphData) => unknown;
  originalSetData?: (data: GraphData) => unknown;
};

type GraphLeaf = WorkspaceLeaf & {
  view?: {
    getViewType?: () => string;
    containerEl?: HTMLElement;
    renderer?: GraphRenderer;
    dataEngine?: {
      getOptions?: () => unknown;
      setOptions?: (options: unknown) => void;
      updateSearch?: () => void;
      requestUpdateSearch?: {
        run?: () => void;
      };
    };
    unload?: () => void;
    load?: () => void;
  };
};

type GraphLeafController = {
  dataPatch?: GraphDataPatch<GraphData>;
};

type PatchableGraphNode = {
  id?: unknown;
  type?: unknown;
  folderNode?: unknown;
  __folderAndGraphsPlusOriginalGetFillColor?: () => GraphColor;
  __folderAndGraphsPlusOriginalGetDisplayText?: () => string;
  __folderAndGraphsPlusOriginalNodeRenderMethods?: Partial<Record<GraphNodeRenderMethodName, GraphNodeRenderMethod>>;
  getFillColor?: () => GraphColor;
  getDisplayText?: () => string;
  render?: GraphNodeRenderMethod;
  draw?: GraphNodeRenderMethod;
  updateGraphics?: GraphNodeRenderMethod;
};

type GraphNodeRenderMethodName = "render" | "draw" | "updateGraphics";

type GraphNodeRenderMethod = (this: PatchableGraphNode, ...args: unknown[]) => unknown;

type PatchableGraphLink = {
  source?: unknown;
  target?: unknown;
  from?: unknown;
  to?: unknown;
  sourceNode?: unknown;
  targetNode?: unknown;
  node1?: unknown;
  node2?: unknown;
  a?: unknown;
  b?: unknown;
  line?: unknown;
  graphics?: unknown;
  path?: unknown;
  container?: unknown;
  sprite?: unknown;
  x1?: unknown;
  y1?: unknown;
  x2?: unknown;
  y2?: unknown;
  sourceX?: unknown;
  sourceY?: unknown;
  targetX?: unknown;
  targetY?: unknown;
  renderer?: unknown;
  __folderAndGraphsPlusOriginalLinkRenderMethods?: Partial<Record<GraphLinkRenderMethodName, GraphLinkRenderMethod>>;
  render?: GraphLinkRenderMethod;
  draw?: GraphLinkRenderMethod;
  updateGraphics?: GraphLinkRenderMethod;
};

type GraphLinkRenderMethodName = "render" | "draw" | "updateGraphics";

type GraphLinkRenderMethod = (this: PatchableGraphLink, ...args: unknown[]) => unknown;

type PixiLineLike = {
  parent?: unknown;
  pivot?: unknown;
  position?: unknown;
  rotation?: unknown;
  scale?: unknown;
  tint?: number;
  alpha?: number;
  lineWidth?: number;
  width?: number;
  clear?: () => void;
  moveTo?: (x: number, y: number) => void;
  lineTo?: (x: number, y: number) => void;
  lineStyle?: (width?: number, color?: number, alpha?: number) => void;
};

type GraphPoint = {
  x: number;
  y: number;
};

type GraphLabelStyleLike = {
  fontWeight?: unknown;
  [key: string]: unknown;
};

type GraphLabelLike = {
  style?: GraphLabelStyleLike;
  text?: unknown;
  _text?: unknown;
  dirty?: boolean;
  children?: unknown;
  updateText?: () => unknown;
  [key: string]: unknown;
};

type OriginalGraphLabelStyle = {
  hadFontWeight: boolean;
  fontWeight: unknown;
};

type GraphLinkEndpoints = {
  sourceId: string;
  targetId: string;
  directed: boolean;
  source: unknown;
  target: unknown;
};

type GraphNodeData = {
  type?: unknown;
  folderNode?: unknown;
  links?: Record<string, unknown>;
  [key: string]: unknown;
};

type GraphData = {
  nodes?: Record<string, GraphNodeData>;
  [key: string]: unknown;
};

type IWorkPackageFile = TFile & {
  __folderAndGraphsPlusIWorkPackageFile: true;
  __folderAndGraphsPlusPackageFolder: TFolder;
};

type FileExplorerLike = {
  refresh?: () => void;
  requestRefresh?: () => void;
  requestSort?: () => void;
  update?: () => void;
  containerEl?: HTMLElement;
  fileItems?: Record<string, FileExplorerItemLike>;
};

type PatchableVault = {
  getFiles: () => TFile[];
};

type PatchableMetadataCache = {
  getFirstLinkpathDest: (linkpath: string, sourcePath: string) => TFile | null;
  fileToLinktext: (file: TFile, sourcePath: string, omitMdExtension?: boolean) => string;
};

type FileExplorerClickEvent = MouseEvent | KeyboardEvent;

type FileExplorerItemLike = {
  file?: TAbstractFile;
  el?: HTMLElement;
  view?: {
    tree?: {
      handleItemSelection?: (event: FileExplorerClickEvent, item: FileExplorerItemLike) => boolean;
    };
    app?: {
      workspace?: {
        getLeaf?: (newLeaf?: boolean) => WorkspaceLeaf;
        getMostRecentLeaf?: () => WorkspaceLeaf | null;
        setActiveLeaf?: (leaf: WorkspaceLeaf | null, params?: { focus?: boolean }) => void;
      };
    };
  };
  selfEl?: HTMLElement;
  collapseEl?: HTMLElement;
  childrenEl?: HTMLElement;
  tagEl?: HTMLElement;
  setCollapsed?: (collapsed: boolean) => void;
  onSelfClick?: (event: FileExplorerClickEvent) => void;
  __folderAndGraphsPlusOriginalOnSelfClick?: (event: FileExplorerClickEvent) => void;
};

type FolderColorSuggestion = {
  type: FolderColorRuleType;
  target: string;
  label: string;
  detail: string;
};

type Folder2GraphRuntimePlugin = Plugin & {
  settings?: Folder2GraphSettings;
  loadData: () => Promise<unknown>;
  saveData: (data: unknown) => Promise<void>;
  refreshGraphLeaves?: () => void;
};

export default class FolderAndGraphsPlusPlugin extends Plugin {
  settings: FolderAndGraphsPlusSettings = createDefaultSettings();
  private bundledFolder2Graph: Plugin | null = null;
  private patchedPrototype: PatchableGraphNode | null = null;
  private originalGetFillColor: (() => GraphColor) | null = null;
  private patchedGetFillColor: (() => GraphColor) | null = null;
  private originalGetDisplayText: (() => string) | null = null;
  private patchedGetDisplayText: (() => string) | null = null;
  private styledGraphLabels = new Set<GraphLabelLike>();
  private originalGraphLabelStyles = new WeakMap<GraphLabelLike, OriginalGraphLabelStyle>();
  private patchedLinkPrototypes = new Set<PatchableGraphLink>();
  private rendererByLinkPrototype = new WeakMap<PatchableGraphLink, GraphRenderer>();
  private graphLeafControllers = new WeakMap<GraphLeaf, GraphLeafController>();
  private colorGroups: GraphColorGroup[] = [];
  private combinedFolderPathsByNodeId = new Map<string, string[]>();
  private nodePluginColorsById = new Map<string, GraphColor>();
  private iWorkPackageFilesByPath = new Map<string, IWorkPackageFile>();
  private iWorkPackageFilesByBasename = new Map<string, IWorkPackageFile[]>();
  private patchedVault: PatchableVault | null = null;
  private originalVaultGetFiles: PatchableVault["getFiles"] | null = null;
  private patchedVaultGetFiles: PatchableVault["getFiles"] | null = null;
  private patchedMetadataCache: PatchableMetadataCache | null = null;
  private originalGetFirstLinkpathDest: PatchableMetadataCache["getFirstLinkpathDest"] | null = null;
  private patchedGetFirstLinkpathDest: PatchableMetadataCache["getFirstLinkpathDest"] | null = null;
  private originalFileToLinktext: PatchableMetadataCache["fileToLinktext"] | null = null;
  private patchedFileToLinktext: PatchableMetadataCache["fileToLinktext"] | null = null;
  private patchedIWorkFileExplorerItems = new Set<FileExplorerItemLike>();
  private iWorkFileExplorerDecorationTimeouts: number[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();
    this.refreshIWorkPackageFileSupport(false);
    await this.loadBundledFolder2GraphIfNeeded();
    await this.refreshColorGroups();
    this.addSettingTab(new FolderAndGraphsPlusSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.refreshGraphLeaves();
        this.queueIWorkPackageFileExplorerDecoration();
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshGraphLeaves();
        this.queueIWorkPackageFileExplorerDecoration();
      })
    );

    const refreshIWorkPackages = (): void => {
      this.refreshIWorkPackageFileSupport();
    };

    this.registerEvent(this.app.vault.on("create", refreshIWorkPackages));
    this.registerEvent(this.app.vault.on("rename", refreshIWorkPackages));
    this.registerEvent(this.app.vault.on("delete", refreshIWorkPackages));

    this.registerInterval(
      window.setInterval(() => {
        void this.refreshColorGroups().then(() => this.refreshGraphLeaves(false));
      }, 2000)
    );

    this.refreshGraphLeaves();
    this.queueIWorkPackageFileExplorerDecoration();
    if (this.settings.combineSameNameFolders || this.settings.graphFilters.enabled) {
      this.refreshGraphsAfterSettingsChange();
    }
  }

  onunload(): void {
    if (this.patchedPrototype && this.originalGetFillColor) {
      this.patchedPrototype.getFillColor = this.originalGetFillColor;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetFillColor;
    }
    if (this.patchedPrototype && this.originalGetDisplayText) {
      this.patchedPrototype.getDisplayText = this.originalGetDisplayText;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetDisplayText;
    }

    this.restoreAllGraphLabelStyles();
    this.restoreGraphNodeRenderMethods();
    this.restoreGraphLinkRenderMethods();
    this.clearIWorkFileExplorerDecorationTimeout();
    this.restoreIWorkPackageFileSupport(false);
    this.patchedPrototype = null;
    this.originalGetFillColor = null;
    this.patchedGetFillColor = null;
    this.originalGetDisplayText = null;
    this.patchedGetDisplayText = null;
    this.unpatchGraphLeafControllers();
    void this.unloadBundledFolder2Graph();
    this.requestGraphRedraw();
  }

  private refreshGraphLeaves(requestRedraw = true): void {
    void this.refreshColorGroups();

    for (const leaf of this.getGraphLeaves()) {
      const renderer = leaf.view?.renderer;
      if (!renderer) {
        continue;
      }

      this.ensureGraphLeafController(leaf);

      const firstNode = this.objectValues(renderer.nodes)[0];
      if (firstNode) {
        this.patchNodePrototype(firstNode);
      }

      this.patchGraphLinkRendering(renderer);
      if (requestRedraw) {
        renderer.changed?.();
      }
    }
  }

  private requestGraphRedraw(): void {
    for (const leaf of this.getGraphLeaves()) {
      leaf.view?.renderer?.changed?.();
    }
  }

  private getGraphLeaves(): GraphLeaf[] {
    return this.app.workspace
      .getLeavesOfType("graph")
      .filter((leaf): leaf is GraphLeaf => leaf?.view?.getViewType?.() === "graph");
  }

  private ensureGraphLeafController(leaf: GraphLeaf): void {
    const controller = this.graphLeafControllers.get(leaf) ?? {};
    this.graphLeafControllers.set(leaf, controller);
    this.ensureGraphDataPatch(leaf, controller);
  }

  private patchNodePrototype(node: unknown): void {
    const prototype = Object.getPrototypeOf(node) as PatchableGraphNode | null;
    if (!prototype || typeof prototype.getFillColor !== "function") {
      return;
    }

    if (
      this.patchedPrototype === prototype &&
      prototype.getFillColor === this.patchedGetFillColor &&
      (!this.patchedGetDisplayText || prototype.getDisplayText === this.patchedGetDisplayText)
    ) {
      this.patchGraphNodeRendering(prototype);
      return;
    }

    if (this.patchedPrototype && this.originalGetFillColor && this.patchedPrototype !== prototype) {
      this.patchedPrototype.getFillColor = this.originalGetFillColor;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetFillColor;
    }
    if (this.patchedPrototype && this.originalGetDisplayText && this.patchedPrototype !== prototype) {
      this.patchedPrototype.getDisplayText = this.originalGetDisplayText;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetDisplayText;
    }
    if (this.patchedPrototype && this.patchedPrototype !== prototype) {
      this.restoreAllGraphLabelStyles();
      this.restoreGraphNodeRenderMethods();
    }

    const original = prototype.getFillColor;
    this.patchedPrototype = prototype;
    this.originalGetFillColor = original;
    prototype.__folderAndGraphsPlusOriginalGetFillColor = original;

    const getColorForGraphNode = this.getColorForGraphNode.bind(this);
    const patchedGetFillColor = function patchedGetFillColor(this: PatchableGraphNode): GraphColor {
      const color = getColorForGraphNode(this);
      if (color) {
        return color;
      }

      return original.call(this);
    };

    this.patchedGetFillColor = patchedGetFillColor;
    prototype.getFillColor = patchedGetFillColor;

    if (typeof prototype.getDisplayText === "function") {
      const originalDisplayText = prototype.getDisplayText;
      this.originalGetDisplayText = originalDisplayText;
      prototype.__folderAndGraphsPlusOriginalGetDisplayText = originalDisplayText;

      const buildDisplayTextForGraphNode = this.buildDisplayTextForGraphNode.bind(this);
      const patchedGetDisplayText = function patchedGetDisplayText(this: PatchableGraphNode): string {
        const text = originalDisplayText.call(this);
        return buildDisplayTextForGraphNode(this, text);
      };

      this.patchedGetDisplayText = patchedGetDisplayText;
      prototype.getDisplayText = patchedGetDisplayText;
    } else {
      this.originalGetDisplayText = null;
      this.patchedGetDisplayText = null;
    }

    this.patchGraphNodeRendering(prototype);
  }

  private getColorForGraphNode(node: PatchableGraphNode): GraphColor | null {
    return this.getVisualForGraphNode(node)?.color ?? null;
  }

  private getVisualForGraphNode(
    node: PatchableGraphNode
  ): { color: GraphColor; colorLinks: boolean; boldLabel: boolean } | null {
    const folderPaths = this.getFolderPathsForGraphNode(node);
    if (folderPaths.length === 0) {
      return null;
    }

    return getFolderVisualForPaths(
      folderPaths,
      this.colorGroups,
      this.settings.folderColorRules,
      this.isFolderGraphNode(node) ? "folderNode" : "fileNode"
    );
  }

  private shouldBoldGraphNodeLabel(node: PatchableGraphNode): boolean {
    if (!this.isFolderGraphNode(node)) {
      return false;
    }

    return this.getVisualForGraphNode(node)?.boldLabel === true;
  }

  private buildDisplayTextForGraphNode(
    node: PatchableGraphNode,
    text: string
  ): string {
    if (!this.isFolderGraphNode(node)) {
      return text;
    }

    return buildFolderDisplayText(text, {
      showFolderEmoji: this.settings.showFolderEmoji
    });
  }

  private isFolderGraphNode(node: PatchableGraphNode): boolean {
    return node.type === FOLDER2GRAPH_NODE_TYPE;
  }

  private patchGraphNodeRendering(prototype: PatchableGraphNode): void {
    const originalMethods = prototype.__folderAndGraphsPlusOriginalNodeRenderMethods ?? {};
    if (Object.keys(originalMethods).length > 0) {
      return;
    }

    const applyFolderNodeDecorations = this.applyFolderNodeDecorations.bind(this);
    for (const methodName of ["render", "draw", "updateGraphics"] as const) {
      const original = prototype[methodName];
      if (typeof original !== "function") {
        continue;
      }

      originalMethods[methodName] = original;
      prototype[methodName] = function folderAndGraphsPlusNodeRenderPatch(
        this: PatchableGraphNode,
        ...args: unknown[]
      ): unknown {
        const result = original.apply(this, args);
        applyFolderNodeDecorations(this);
        return result;
      };
      break;
    }

    if (Object.keys(originalMethods).length > 0) {
      prototype.__folderAndGraphsPlusOriginalNodeRenderMethods = originalMethods;
    }
  }

  private restoreGraphNodeRenderMethods(): void {
    const prototype = this.patchedPrototype;
    const originalMethods = prototype?.__folderAndGraphsPlusOriginalNodeRenderMethods;
    if (!prototype || !originalMethods) {
      return;
    }

    for (const [methodName, original] of Object.entries(originalMethods) as [
      GraphNodeRenderMethodName,
      GraphNodeRenderMethod
    ][]) {
      prototype[methodName] = original;
    }

    delete prototype.__folderAndGraphsPlusOriginalNodeRenderMethods;
  }

  private applyFolderNodeDecorations(node: PatchableGraphNode): void {
    if (!this.isFolderGraphNode(node)) {
      return;
    }

    const labels = this.getGraphNodeLabels(node);
    if (this.shouldBoldGraphNodeLabel(node)) {
      labels.forEach((label) => this.applyGraphLabelBold(label));
    } else {
      labels.forEach((label) => this.restoreGraphLabelStyle(label));
    }
  }

  private getGraphNodeLabels(node: PatchableGraphNode): GraphLabelLike[] {
    const labels = new Set<GraphLabelLike>();
    const visit = (value: unknown, depth: number): void => {
      if (depth > 2 || typeof value !== "object" || value === null) {
        return;
      }

      if (this.isGraphLabel(value)) {
        labels.add(value);
      }

      const children = (value as GraphLabelLike).children;
      if (Array.isArray(children)) {
        children.forEach((child) => visit(child, depth + 1));
      }
    };

    for (const key of ["label", "text", "textSprite", "labelText", "displayText", "container"]) {
      visit((node as Record<string, unknown>)[key], 0);
    }

    return [...labels];
  }

  private isGraphLabel(value: unknown): value is GraphLabelLike {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const label = value as GraphLabelLike;
    return (
      typeof label.style === "object" &&
      label.style !== null &&
      (typeof label.text === "string" || typeof label._text === "string")
    );
  }

  private applyGraphLabelBold(label: GraphLabelLike): void {
    if (!label.style) {
      return;
    }

    if (!this.originalGraphLabelStyles.has(label)) {
      this.originalGraphLabelStyles.set(label, {
        hadFontWeight: Object.prototype.hasOwnProperty.call(label.style, "fontWeight"),
        fontWeight: label.style.fontWeight
      });
      this.styledGraphLabels.add(label);
    }

    Reflect.set(label.style, "fontWeight", "700");
    label.dirty = true;
    label.updateText?.();
  }

  private restoreAllGraphLabelStyles(): void {
    for (const label of this.styledGraphLabels) {
      this.restoreGraphLabelStyle(label);
    }

    this.styledGraphLabels.clear();
  }

  private restoreGraphLabelStyle(label: GraphLabelLike): void {
    const original = this.originalGraphLabelStyles.get(label);
    if (!original || !label.style) {
      return;
    }

    if (original.hadFontWeight) {
      Reflect.set(label.style, "fontWeight", original.fontWeight);
    } else {
      Reflect.deleteProperty(label.style, "fontWeight");
    }

    label.dirty = true;
    label.updateText?.();
    this.originalGraphLabelStyles.delete(label);
    this.styledGraphLabels.delete(label);
  }

  private patchGraphLinkRendering(renderer: GraphRenderer): void {
    for (const link of this.getRendererLinks(renderer)) {
      const prototype = Object.getPrototypeOf(link) as PatchableGraphLink | null;
      if (!prototype) {
        continue;
      }

      this.rendererByLinkPrototype.set(prototype, renderer);
      if (this.patchedLinkPrototypes.has(prototype)) {
        continue;
      }

      const originalMethods = prototype.__folderAndGraphsPlusOriginalLinkRenderMethods ?? {};
      const applyColorToGraphLink = this.applyColorToGraphLink.bind(this);

      for (const methodName of ["render", "draw", "updateGraphics"] as const) {
        const original = prototype[methodName];
        if (typeof original !== "function" || originalMethods[methodName]) {
          continue;
        }

        originalMethods[methodName] = original;
        prototype[methodName] = function folderAndGraphsPlusLinkRenderPatch(
          this: PatchableGraphLink,
          ...args: unknown[]
        ): unknown {
          const result = original.apply(this, args);
          applyColorToGraphLink(this);
          return result;
        };
      }

      if (Object.keys(originalMethods).length > 0) {
        prototype.__folderAndGraphsPlusOriginalLinkRenderMethods = originalMethods;
        this.patchedLinkPrototypes.add(prototype);
      }
    }
  }

  private restoreGraphLinkRenderMethods(): void {
    for (const prototype of this.patchedLinkPrototypes) {
      const originalMethods = prototype.__folderAndGraphsPlusOriginalLinkRenderMethods;
      if (!originalMethods) {
        continue;
      }

    for (const [methodName, original] of Object.entries(originalMethods) as [
        GraphLinkRenderMethodName,
        GraphLinkRenderMethod
      ][]) {
        prototype[methodName] = original;
      }

      delete prototype.__folderAndGraphsPlusOriginalLinkRenderMethods;
    }

    this.patchedLinkPrototypes.clear();
  }

  private getRendererLinks(renderer: GraphRenderer): PatchableGraphLink[] {
    const candidates = [
      renderer.links,
      renderer.edges,
      renderer.linkNodes,
      renderer.linkObjects,
      renderer.renderer?.links,
      renderer.renderer?.edges,
      renderer.graph?.links,
      renderer.graph?.edges
    ];

    const links: PatchableGraphLink[] = [];
    const seen = new Set<object>();

    for (const candidate of candidates) {
      const values = this.objectValues(candidate);
      for (const value of values) {
        if (this.isPatchableGraphLink(value) && !seen.has(value)) {
          links.push(value);
          seen.add(value);
        }
      }
    }

    return links;
  }

  private objectValues(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (value instanceof Map || value instanceof Set) {
      return [...value.values()];
    }

    if (typeof value === "object" && value !== null) {
      return Object.values(value as Record<string, unknown>);
    }

    return [];
  }

  private isPatchableGraphLink(value: unknown): value is PatchableGraphLink {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const link = value as PatchableGraphLink;
    return (
      (typeof link.render === "function" ||
        typeof link.draw === "function" ||
        typeof link.updateGraphics === "function") &&
      this.getGraphLinkEndpoints(link) !== null
    );
  }

  private applyColorToGraphLink(link: PatchableGraphLink): void {
    const endpoints = this.getGraphLinkEndpoints(link);
    if (!endpoints) {
      return;
    }

    const decision = getGraphLinkColorDecision(
      this.nodePluginColorsById.get(endpoints.sourceId),
      this.nodePluginColorsById.get(endpoints.targetId)
    );

    if (decision.type === "default") {
      return;
    }

    if (decision.type === "split" && this.drawSplitGraphLink(link, endpoints, decision.sourceColor, decision.targetColor)) {
      return;
    }

    const color = decision.type === "solid" ? decision.color : decision.sourceColor;
    for (const target of this.getLinkGraphicTargets(link)) {
      this.applyColorToPixiLine(target, color);
    }
  }

  private getGraphLinkEndpoints(link: PatchableGraphLink): GraphLinkEndpoints | null {
    const directedPairs: [unknown, unknown][] = [
      [link.source, link.target],
      [link.from, link.to],
      [link.sourceNode, link.targetNode]
    ];

    for (const [source, target] of directedPairs) {
      const sourceId = this.getGraphEndpointId(source);
      const targetId = this.getGraphEndpointId(target);
      if (sourceId && targetId) {
        return { sourceId, targetId, directed: true, source, target };
      }
    }

    const undirectedPairs: [unknown, unknown][] = [
      [link.node1, link.node2],
      [link.a, link.b]
    ];

    for (const [source, target] of undirectedPairs) {
      const sourceId = this.getGraphEndpointId(source);
      const targetId = this.getGraphEndpointId(target);
      if (sourceId && targetId) {
        return { sourceId, targetId, directed: false, source, target };
      }
    }

    return null;
  }

  private getGraphEndpointId(value: unknown): string | null {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }

    if (typeof value !== "object" || value === null) {
      return null;
    }

    const endpoint = value as { id?: unknown; node?: unknown };
    if (typeof endpoint.id === "string" && endpoint.id.length > 0) {
      return endpoint.id;
    }

    return this.getGraphEndpointId(endpoint.node);
  }

  private getLinkGraphicTargets(link: PatchableGraphLink): PixiLineLike[] {
    return [link.line, link.graphics, link.path, link.container, link.sprite, link]
      .filter((target): target is PixiLineLike => typeof target === "object" && target !== null);
  }

  private applyColorToPixiLine(target: PixiLineLike, color: GraphColor): void {
    target.tint = color.rgb;

    if (typeof target.lineStyle === "function") {
      const width = typeof target.lineWidth === "number"
        ? target.lineWidth
        : typeof target.width === "number"
          ? target.width
          : 1;
      target.lineStyle(width, color.rgb, color.a ?? target.alpha ?? 1);
    }
  }

  private drawSplitGraphLink(
    link: PatchableGraphLink,
    endpoints: GraphLinkEndpoints,
    sourceColor: GraphColor,
    targetColor: GraphColor
  ): boolean {
    const sourcePoint =
      this.getGraphEndpointPoint(endpoints.source) ??
      this.getLinkEndpointPoint(link, "source") ??
      this.getRendererNodePoint(link, endpoints.sourceId);
    const targetPoint =
      this.getGraphEndpointPoint(endpoints.target) ??
      this.getLinkEndpointPoint(link, "target") ??
      this.getRendererNodePoint(link, endpoints.targetId);
    if (!sourcePoint || !targetPoint) {
      return false;
    }

    const target = this.getLinkGraphicTargets(link).find((graphic) => (
      typeof graphic.clear === "function" &&
      typeof graphic.lineStyle === "function" &&
      typeof graphic.moveTo === "function" &&
      typeof graphic.lineTo === "function"
    ));
    if (!target) {
      return false;
    }

    const middle = {
      x: (sourcePoint.x + targetPoint.x) / 2,
      y: (sourcePoint.y + targetPoint.y) / 2
    };
    const width = this.getLineWidth(target);

    target.clear?.();
    target.lineStyle?.(width, sourceColor.rgb, sourceColor.a ?? target.alpha ?? 1);
    target.moveTo?.(sourcePoint.x, sourcePoint.y);
    target.lineTo?.(middle.x, middle.y);
    target.lineStyle?.(width, targetColor.rgb, targetColor.a ?? target.alpha ?? 1);
    target.moveTo?.(middle.x, middle.y);
    target.lineTo?.(targetPoint.x, targetPoint.y);
    return true;
  }

  private getGraphEndpointPoint(value: unknown): GraphPoint | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const endpoint = value as { x?: unknown; y?: unknown; node?: unknown };
    if (typeof endpoint.x === "number" && typeof endpoint.y === "number") {
      return { x: endpoint.x, y: endpoint.y };
    }

    return this.getGraphEndpointPoint(endpoint.node);
  }

  private getLinkEndpointPoint(link: PatchableGraphLink, endpoint: "source" | "target"): GraphPoint | null {
    const x = endpoint === "source" ? link.x1 ?? link.sourceX : link.x2 ?? link.targetX;
    const y = endpoint === "source" ? link.y1 ?? link.sourceY : link.y2 ?? link.targetY;

    return typeof x === "number" && typeof y === "number" ? { x, y } : null;
  }

  private getRendererNodePoint(link: PatchableGraphLink, nodeId: string): GraphPoint | null {
    const renderer = this.getLinkRenderer(link);
    const node = this.getRendererNode(renderer, nodeId);
    return this.getGraphEndpointPoint(node);
  }

  private getLinkRenderer(link: PatchableGraphLink): GraphRenderer | null {
    if (this.isGraphRenderer(link.renderer)) {
      return link.renderer;
    }

    const prototype = Object.getPrototypeOf(link) as PatchableGraphLink | null;
    return prototype ? this.rendererByLinkPrototype.get(prototype) ?? null : null;
  }

  private isGraphRenderer(value: unknown): value is GraphRenderer {
    return typeof value === "object" && value !== null && (
      Array.isArray((value as GraphRenderer).nodes) ||
      (value as GraphRenderer).nodes instanceof Set ||
      Boolean((value as GraphRenderer).renderer) ||
      Boolean((value as GraphRenderer).graph)
    );
  }

  private getRendererNode(renderer: GraphRenderer | null, nodeId: string): unknown {
    if (!renderer) {
      return null;
    }

    const rendererWithLookup = renderer as GraphRenderer & {
      nodeLookup?: Record<string, unknown> | Map<string, unknown>;
      renderer?: GraphRenderer & { nodeLookup?: Record<string, unknown> | Map<string, unknown> };
      graph?: GraphRenderer & { nodeLookup?: Record<string, unknown> | Map<string, unknown> };
    };

    return (
      this.getNodeFromLookup(rendererWithLookup.nodeLookup, nodeId) ??
      this.getNodeFromLookup(rendererWithLookup.renderer?.nodeLookup, nodeId) ??
      this.getNodeFromLookup(rendererWithLookup.graph?.nodeLookup, nodeId) ??
      this.getNodeFromCollection(renderer.nodes, nodeId) ??
      this.getNodeFromCollection(rendererWithLookup.renderer?.nodes, nodeId) ??
      this.getNodeFromCollection(rendererWithLookup.graph?.nodes, nodeId)
    );
  }

  private getNodeFromLookup(lookup: Record<string, unknown> | Map<string, unknown> | undefined, nodeId: string): unknown {
    if (lookup instanceof Map) {
      return lookup.get(nodeId) ?? null;
    }

    return lookup?.[nodeId] ?? null;
  }

  private getNodeFromCollection(nodes: unknown[] | Set<unknown> | undefined, nodeId: string): unknown {
    return this.objectValues(nodes).find((node) => this.getGraphEndpointId(node) === nodeId) ?? null;
  }

  private getLineWidth(target: PixiLineLike): number {
    return typeof target.lineWidth === "number"
      ? target.lineWidth
      : typeof target.width === "number"
        ? target.width
        : 1;
  }

  private getFolderPathsForGraphNode(node: PatchableGraphNode): string[] {
    if (typeof node.id !== "string" || node.id.length === 0 || node.type === "tag") {
      return [];
    }

    if (node.type === FOLDER2GRAPH_NODE_TYPE) {
      const folderPath = folderPathFromNodeId(node.id);
      return this.combinedFolderPathsByNodeId.get(`/${folderPath}`) ?? [folderPath];
    }

    const nodePath = folderPathFromNodeId(node.id.split("#")[0]);
    if (!nodePath) {
      return [];
    }

    const file = this.resolveVaultFile(nodePath);
    if (file) {
      return [this.getParentFolderPath(file)];
    }

    const folder = this.app.vault.getAbstractFileByPath(nodePath);
    if (folder) {
      return folder instanceof TFolder ? [folder.isRoot() ? "" : folder.path] : [];
    }

    const slashIndex = nodePath.lastIndexOf("/");
    return slashIndex < 0 ? [] : [nodePath.slice(0, slashIndex)];
  }

  private resolveVaultFile(path: string): TAbstractFile | null {
    return (
      this.app.vault.getAbstractFileByPath(path) ??
      this.app.metadataCache.getFirstLinkpathDest(path, "") ??
      this.app.metadataCache.getFirstLinkpathDest(path.replace(/\.md$/i, ""), "")
    );
  }

  private getParentFolderPath(file: TAbstractFile): string {
    const parent = file instanceof TFolder ? file : file.parent;
    return !parent || parent.isRoot() ? "" : parent.path;
  }

  private async loadBundledFolder2GraphIfNeeded(): Promise<void> {
    if (this.isExternalFolder2GraphEnabled()) {
      return;
    }

    if (!Folder2GraphPlugin) {
      console.error("folderandgraphs-plus: bundled Folder2Graph module did not export a plugin.");
      return;
    }

    const bundled = new Folder2GraphPlugin(this.app, {
      ...this.manifest,
      id: "folderandgraphs-plus-bundled-folders2graph",
      name: "Bundled Folder2Graph",
      version: "1.2.0",
      minAppVersion: "1.4.16",
      author: "ratibus11",
      description: "Bundled copy of Folder2Graph used by Folder and Graphs Plus."
    });

    const bridge = bundled as Folder2GraphRuntimePlugin;

    bridge.loadData = async () => this.settings.folder2graph ?? {};
    bridge.saveData = async (data: unknown) => {
      this.settings.folder2graph = this.parseFolder2GraphSettings(data);
      await this.saveSettings();
    };
    bridge.addSettingTab = () => {};

    this.bundledFolder2Graph = bundled;
    await bundled.onload();
  }

  private async unloadBundledFolder2Graph(): Promise<void> {
    if (!this.bundledFolder2Graph) {
      return;
    }

    try {
      this.bundledFolder2Graph.onunload();
    } finally {
      this.bundledFolder2Graph = null;
    }
  }

  isExternalFolder2GraphEnabled(): boolean {
    const appWithPlugins = this.app as typeof this.app & {
      plugins?: {
        enabledPlugins?: Set<string>;
        getPlugin?: (id: string) => unknown;
      };
    };

    return (
      appWithPlugins.plugins?.enabledPlugins?.has("folders2graph") === true ||
      Boolean(appWithPlugins.plugins?.getPlugin?.("folders2graph"))
    );
  }

  private ensureGraphDataPatch(leaf: GraphLeaf, controller: GraphLeafController): void {
    const renderer = leaf.view?.renderer;
    controller.dataPatch = installGraphDataPatch(controller.dataPatch, renderer, (data) => {
      const graphOptions = this.getGraphOptions(leaf);
      const iWorkData = this.settings.iWorkPackages.enabled
        ? this.addIWorkPackageFilesToGraphData(
            normalizeIWorkPackageGraphData(data, (nodeId, node) => this.isFolderNode(nodeId, node)) as GraphData,
            graphOptions.showOrphans
          )
        : data;
      const nextData = this.settings.combineSameNameFolders
        ? this.mergeSameNameFolderNodes(iWorkData)
        : this.rememberSeparateFolderPaths(iWorkData);
      const filteredData = applyGraphFilters(
        nextData,
        this.settings.graphFilters,
        (nodeId, node) => this.isFolderNode(nodeId, node)
      ) as GraphData;
      const rootlessData = removeRootFolderNode(
        filteredData,
        (nodeId, node) => this.isFolderNode(nodeId, node)
      ) as GraphData;

      this.rememberNodePluginColors(rootlessData);
      return rootlessData;
    });
  }

  private getGraphOptions(leaf: GraphLeaf): { showOrphans: boolean } {
    const rawOptions = leaf.view?.dataEngine?.getOptions?.();
    if (typeof rawOptions !== "object" || rawOptions === null) {
      return { showOrphans: true };
    }

    const options = rawOptions as Record<string, unknown>;
    return {
      showOrphans: options.showOrphans !== false
    };
  }

  private addIWorkPackageFilesToGraphData(data: GraphData, showOrphans: boolean): GraphData {
    if (!data.nodes || this.iWorkPackageFilesByPath.size === 0) {
      return data;
    }

    const nodes: Record<string, GraphNodeData> = {};
    for (const [nodeId, node] of Object.entries(data.nodes)) {
      nodes[nodeId] = {
        ...node,
        links: { ...(node.links ?? {}) }
      };
    }

    let changed = false;
    for (const packageFile of this.iWorkPackageFilesByPath.values()) {
      if (nodes[packageFile.path]) {
        continue;
      }

      const sourceNodeIds = this.getIWorkPackageGraphSourceNodeIds(packageFile.path, nodes);
      if (!showOrphans && sourceNodeIds.length === 0) {
        continue;
      }

      nodes[packageFile.path] = {
        links: Object.fromEntries(sourceNodeIds.map((sourceNodeId) => [sourceNodeId, true]))
      };

      for (const sourceNodeId of sourceNodeIds) {
        nodes[sourceNodeId].links = {
          ...(nodes[sourceNodeId].links ?? {}),
          [packageFile.path]: true
        };
      }

      changed = true;
    }

    return changed ? { ...data, nodes } : data;
  }

  private getIWorkPackageGraphSourceNodeIds(
    packagePath: string,
    nodes: Record<string, GraphNodeData>
  ): string[] {
    const sourceNodeIds = new Set<string>();
    for (const [sourcePath, targets] of Object.entries(this.app.metadataCache.resolvedLinks)) {
      if (!targets || typeof targets !== "object" || !Object.prototype.hasOwnProperty.call(targets, packagePath)) {
        continue;
      }

      const sourceNodeId = this.resolveGraphFileNodeId(sourcePath, nodes);
      if (sourceNodeId) {
        sourceNodeIds.add(sourceNodeId);
      }
    }

    return [...sourceNodeIds];
  }

  private resolveGraphFileNodeId(
    filePath: string,
    nodes: Record<string, GraphNodeData>
  ): string | null {
    if (nodes[filePath]) {
      return filePath;
    }

    const extensionlessPath = filePath.endsWith(".md") ? filePath.slice(0, -3) : filePath;
    return nodes[extensionlessPath] ? extensionlessPath : null;
  }

  private unpatchGraphLeafControllers(): void {
    for (const leaf of this.getGraphLeaves()) {
      const controller = this.graphLeafControllers.get(leaf);
      if (controller) {
        restoreGraphDataPatch(controller.dataPatch);
        controller.dataPatch = undefined;
      }
    }
  }

  private rememberSeparateFolderPaths(data: GraphData): GraphData {
    this.combinedFolderPathsByNodeId = new Map();

    for (const nodeId of Object.keys(data.nodes ?? {})) {
      const node = data.nodes?.[nodeId];
      if (this.isFolderNode(nodeId, node)) {
        this.combinedFolderPathsByNodeId.set(nodeId, [folderPathFromNodeId(nodeId)]);
      }
    }

    return data;
  }

  private reloadGraphLeaf(leaf: GraphLeaf): void {
    const view = leaf.view;
    const options = view?.dataEngine?.getOptions?.();
    this.ensureGraphLeafController(leaf);
    view?.renderer?.changed?.();
    view?.unload?.();
    view?.load?.();
    if (options !== undefined) {
      view?.dataEngine?.setOptions?.(options);
    }
    view?.renderer?.changed?.();
  }

  private rememberNodePluginColors(data: GraphData): void {
    this.nodePluginColorsById = getGraphNodePluginColors(
      data.nodes,
      this.settings.folderColorRules,
      (nodeId) => this.getFolderPathsForGraphNodeId(nodeId, data.nodes?.[nodeId]),
      (nodeId) => this.isFolderNode(nodeId, data.nodes?.[nodeId])
    );
  }

  private mergeSameNameFolderNodes(data: GraphData): GraphData {
    const nodes = this.cloneGraphNodes(data.nodes);
    this.combinedFolderPathsByNodeId = new Map();

    if (!nodes) {
      return data;
    }

    const groups = new Map<string, string[]>();

    for (const [nodeId, node] of Object.entries(nodes)) {
      if (!this.isFolderNode(nodeId, node) || nodeId === "/") {
        continue;
      }

      const basename = this.getFolderBasename(nodeId);
      if (!basename) {
        continue;
      }

      const group = groups.get(basename) ?? [];
      group.push(nodeId);
      groups.set(basename, group);
    }

    for (const [nodeId, node] of Object.entries(nodes)) {
      if (this.isFolderNode(nodeId, node)) {
        this.combinedFolderPathsByNodeId.set(nodeId, [folderPathFromNodeId(nodeId)]);
      }
    }

    for (const folderIds of groups.values()) {
      if (folderIds.length < 2) {
        continue;
      }

      const canonicalId = folderIds[0];
      const duplicateIds = new Set(folderIds.slice(1));
      const canonicalNode = nodes[canonicalId];
      if (!canonicalNode) {
        continue;
      }

      this.combinedFolderPathsByNodeId.set(
        canonicalId,
        folderIds.map((folderId) => folderPathFromNodeId(folderId))
      );

      for (const duplicateId of duplicateIds) {
        const duplicateNode = nodes[duplicateId];
        if (duplicateNode?.links) {
          canonicalNode.links = { ...canonicalNode.links, ...duplicateNode.links };
        }
      }

      for (const node of Object.values(nodes)) {
        if (!node.links) {
          continue;
        }

        for (const duplicateId of duplicateIds) {
          if (node.links[duplicateId]) {
            delete node.links[duplicateId];
            if (node !== canonicalNode) {
              node.links[canonicalId] = true;
            }
          }
        }
      }

      if (canonicalNode.links) {
        for (const folderId of folderIds) {
          delete canonicalNode.links[folderId];
        }
      }

      for (const duplicateId of duplicateIds) {
        delete nodes[duplicateId];
        this.combinedFolderPathsByNodeId.delete(duplicateId);
      }
    }

    return { ...data, nodes };
  }

  private cloneGraphNodes(nodes: GraphData["nodes"]): GraphData["nodes"] {
    if (!nodes) {
      return undefined;
    }

    const clone: Record<string, GraphNodeData> = {};

    for (const [nodeId, node] of Object.entries(nodes)) {
      clone[nodeId] = {
        ...node,
        links: node.links ? { ...node.links } : node.links
      };
    }

    return clone;
  }

  private isFolderNode(nodeId: string, node: GraphNodeData | undefined): boolean {
    return nodeId.startsWith("/") && node?.type === FOLDER2GRAPH_NODE_TYPE;
  }

  private getFolderPathsForGraphNodeId(nodeId: string, node: GraphNodeData | undefined): string[] {
    return this.getFolderPathsForGraphNode({ id: nodeId, type: node?.type });
  }

  private getFolderBasename(nodeId: string): string {
    const folderPath = folderPathFromNodeId(nodeId);
    const parts = folderPath.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    this.settings = this.parseSettings(await this.loadData());
  }

  private parseSettings(value: unknown): FolderAndGraphsPlusSettings {
    if (typeof value !== "object" || value === null) {
      return createDefaultSettings();
    }

    const raw = value as Record<string, unknown>;
    return {
      combineSameNameFolders:
        typeof raw.combineSameNameFolders === "boolean"
          ? raw.combineSameNameFolders
          : DEFAULT_SETTINGS.combineSameNameFolders,
      showFolderEmoji:
        typeof raw.showFolderEmoji === "boolean"
          ? raw.showFolderEmoji
          : DEFAULT_SETTINGS.showFolderEmoji,
      iWorkPackages: normalizeIWorkPackageSettings(raw.iWorkPackages),
      graphFilters: normalizeGraphFilterSettings(raw.graphFilters),
      folderColorRules: this.parseFolderColorRules(raw.folderColorRules, raw.combinedFolderColorOverrides),
      folder2graph: this.parseFolder2GraphSettings(raw.folder2graph)
    };
  }

  private parseFolderColorRules(value: unknown, legacyOverrides: unknown): FolderColorRule[] {
    if (!Array.isArray(value)) {
      return this.parseLegacyCombinedFolderColorOverrides(legacyOverrides);
    }

    const rules: FolderColorRule[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const raw = item as Record<string, unknown>;
      if (
        typeof raw.target !== "string" ||
        typeof raw.color !== "string" ||
        (raw.type !== "folder" && raw.type !== "combined")
      ) {
        continue;
      }

      rules.push({
        type: raw.type,
        target: raw.target,
        color: parseHexGraphColor(raw.color) ? raw.color : DEFAULT_FOLDER_RULE_COLOR,
        inheritToChildren: typeof raw.inheritToChildren === "boolean" ? raw.inheritToChildren : true,
        colorLinks: typeof raw.colorLinks === "boolean" ? raw.colorLinks : true,
        boldLabel: normalizeFolderRuleBoldLabel(raw.boldLabel, raw.parentMarker),
        children: this.parseFolderColorChildRules(raw.children)
      });
    }

    return rules;
  }

  private parseLegacyCombinedFolderColorOverrides(value: unknown): FolderColorRule[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const rules: FolderColorRule[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const raw = item as Record<string, unknown>;
      if (typeof raw.folderName !== "string" || typeof raw.color !== "string") {
        continue;
      }

      rules.push({
        type: "combined",
        target: raw.folderName,
        color: parseHexGraphColor(raw.color) ? raw.color : DEFAULT_FOLDER_RULE_COLOR,
        inheritToChildren: true,
        colorLinks: true,
        boldLabel: false,
        children: []
      });
    }

    return rules;
  }

  private parseFolderColorChildRules(value: unknown): FolderColorChildRule[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const rules: FolderColorChildRule[] = [];
    for (const item of value) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const raw = item as Record<string, unknown>;
      if (typeof raw.target !== "string" || (raw.type !== "folder" && raw.type !== "combined")) {
        continue;
      }

      rules.push({
        type: raw.type,
        target: raw.target,
        boldLabel: normalizeFolderRuleBoldLabel(raw.boldLabel, raw.parentMarker),
        colorLinks: typeof raw.colorLinks === "boolean" ? raw.colorLinks : true,
        children: this.parseFolderColorChildRules(raw.children)
      });
    }

    return rules;
  }

  private parseFolder2GraphSettings(value: unknown): Folder2GraphSettings {
    if (typeof value !== "object" || value === null) {
      return this.createDefaultFolder2GraphSettings();
    }

    const raw = value as Record<string, unknown>;
    const defaults = this.createDefaultFolder2GraphSettings();
    return {
      showFolderNodes: typeof raw.showFolderNodes === "boolean" ? raw.showFolderNodes : defaults.showFolderNodes,
      hideRootNode: true,
      nodeColor: typeof raw.nodeColor === "string" && parseHexGraphColor(raw.nodeColor) ? raw.nodeColor : defaults.nodeColor,
      showHeadingNodes: typeof raw.showHeadingNodes === "boolean" ? raw.showHeadingNodes : defaults.showHeadingNodes,
      headingNodeColor: typeof raw.headingNodeColor === "string" && parseHexGraphColor(raw.headingNodeColor) ? raw.headingNodeColor : defaults.headingNodeColor,
      headingLinkAnchorMode: this.normalizeFolder2GraphHeadingLinkAnchorMode(raw.headingLinkAnchorMode),
      hiddenNodes: this.parseFolder2GraphHiddenNodes(raw.hiddenNodes),
      weightNodesBySubtree: typeof raw.weightNodesBySubtree === "boolean" ? raw.weightNodesBySubtree : defaults.weightNodesBySubtree,
      folderFilterMode: raw.folderFilterMode === "include" ? "include" : "exclude",
      folderFilterList: this.parseFolder2GraphFolderFilterList(raw.folderFilterList),
      folderFilterHideFiles: typeof raw.folderFilterHideFiles === "boolean" ? raw.folderFilterHideFiles : defaults.folderFilterHideFiles
    };
  }

  private createDefaultFolder2GraphSettings(): Folder2GraphSettings {
    return {
      ...DEFAULT_FOLDER2GRAPH_SETTINGS,
      hiddenNodes: { ...DEFAULT_FOLDER2GRAPH_SETTINGS.hiddenNodes },
      folderFilterList: [...DEFAULT_FOLDER2GRAPH_SETTINGS.folderFilterList]
    };
  }

  private normalizeFolder2GraphHeadingLinkAnchorMode(value: unknown): Folder2GraphHeadingLinkAnchorMode {
    return (
      value === "file-file" ||
      value === "file-heading" ||
      value === "heading-file" ||
      value === "heading-heading"
    )
      ? value
      : DEFAULT_FOLDER2GRAPH_SETTINGS.headingLinkAnchorMode;
  }

  private parseFolder2GraphHiddenNodes(value: unknown): Record<string, boolean> {
    if (typeof value !== "object" || value === null) {
      return {};
    }

    const hiddenNodes: Record<string, boolean> = {};
    for (const [nodeId, hidden] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nodeId === "string" && nodeId.length > 0 && hidden === true) {
        hiddenNodes[nodeId] = true;
      }
    }

    return hiddenNodes;
  }

  private parseFolder2GraphFolderFilterList(value: unknown): string[] {
    const entries = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/\n/)
        : [];
    const folders = new Set<string>();

    for (const entry of entries) {
      if (typeof entry !== "string") {
        continue;
      }

      const normalized = entry.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      if (normalized.length > 0) {
        folders.add(normalized);
      }
    }

    return [...folders];
  }

  async saveFolder2GraphSettings(refreshGraphs = true): Promise<void> {
    this.settings.folder2graph = this.parseFolder2GraphSettings(this.settings.folder2graph);
    const runtime = this.bundledFolder2Graph as Folder2GraphRuntimePlugin | null;
    if (runtime?.settings) {
      Object.assign(runtime.settings, this.settings.folder2graph);
      runtime.settings.hiddenNodes = { ...this.settings.folder2graph.hiddenNodes };
      runtime.settings.folderFilterList = [...this.settings.folder2graph.folderFilterList];
    }

    await this.saveSettings();
    if (refreshGraphs) {
      this.refreshGraphsAfterSettingsChange();
    }
  }

  refreshIWorkPackageFileSupport(refreshViews = true): void {
    if (!this.settings.iWorkPackages.enabled) {
      this.restoreIWorkPackageFileSupport(refreshViews);
      return;
    }

    this.installIWorkPackageFilePatches();
    this.rebuildIWorkPackageFileIndex();
    if (refreshViews) {
      this.refreshFileExplorerLeaves();
      this.refreshGraphsAfterSettingsChange();
    }
  }

  private installIWorkPackageFilePatches(): void {
    this.installIWorkPackageVaultPatch();
    this.installIWorkPackageMetadataPatch();
  }

  private restoreIWorkPackageFileSupport(refreshViews = true): void {
    this.iWorkPackageFilesByPath.clear();
    this.iWorkPackageFilesByBasename.clear();
    this.restoreIWorkPackageMetadataPatch();
    this.restoreIWorkPackageVaultPatch();
    this.restoreIWorkPackageFileExplorerItems();
    if (refreshViews) {
      this.refreshFileExplorerLeaves();
      this.refreshGraphsAfterSettingsChange();
    }
  }

  private installIWorkPackageVaultPatch(): void {
    const vault = this.app.vault as PatchableVault;
    if (this.patchedVault === vault && vault.getFiles === this.patchedVaultGetFiles) {
      return;
    }

    this.restoreIWorkPackageVaultPatch();

    const originalGetFiles = vault.getFiles;
    const getIWorkPackageFiles = (): IWorkPackageFile[] => [...this.iWorkPackageFilesByPath.values()];
    const patchedGetFiles: PatchableVault["getFiles"] = function folderAndGraphsPlusGetFilesPatch(): TFile[] {
      const files = originalGetFiles.call(vault);
      const paths = new Set(files.map((file) => file.path));
      const packageFiles = getIWorkPackageFiles().filter((file) => !paths.has(file.path));
      return [...files, ...packageFiles];
    };

    vault.getFiles = patchedGetFiles;
    this.patchedVault = vault;
    this.originalVaultGetFiles = originalGetFiles;
    this.patchedVaultGetFiles = patchedGetFiles;
  }

  private restoreIWorkPackageVaultPatch(): void {
    if (this.patchedVault && this.originalVaultGetFiles && this.patchedVault.getFiles === this.patchedVaultGetFiles) {
      this.patchedVault.getFiles = this.originalVaultGetFiles;
    }

    this.patchedVault = null;
    this.originalVaultGetFiles = null;
    this.patchedVaultGetFiles = null;
  }

  private installIWorkPackageMetadataPatch(): void {
    const metadataCache = this.app.metadataCache as PatchableMetadataCache;
    if (
      this.patchedMetadataCache === metadataCache &&
      metadataCache.getFirstLinkpathDest === this.patchedGetFirstLinkpathDest &&
      metadataCache.fileToLinktext === this.patchedFileToLinktext
    ) {
      return;
    }

    this.restoreIWorkPackageMetadataPatch();

    const originalGetFirstLinkpathDest = metadataCache.getFirstLinkpathDest;
    const originalFileToLinktext = metadataCache.fileToLinktext;
    const resolveIWorkPackageLinkpath = this.resolveIWorkPackageLinkpath.bind(this);
    const isSyntheticIWorkPackageFile = this.isSyntheticIWorkPackageFile.bind(this);

    const patchedGetFirstLinkpathDest: PatchableMetadataCache["getFirstLinkpathDest"] =
      function folderAndGraphsPlusGetFirstLinkpathDestPatch(
        linkpath: string,
        sourcePath: string
      ): TFile | null {
        return (
          originalGetFirstLinkpathDest.call(metadataCache, linkpath, sourcePath) ??
          resolveIWorkPackageLinkpath(linkpath, sourcePath)
        );
      };

    const patchedFileToLinktext: PatchableMetadataCache["fileToLinktext"] =
      function folderAndGraphsPlusFileToLinktextPatch(
        file: TFile,
        sourcePath: string,
        omitMdExtension?: boolean
      ): string {
        if (isSyntheticIWorkPackageFile(file)) {
          return file.path;
        }

        return originalFileToLinktext.call(metadataCache, file, sourcePath, omitMdExtension);
      };

    metadataCache.getFirstLinkpathDest = patchedGetFirstLinkpathDest;
    metadataCache.fileToLinktext = patchedFileToLinktext;
    this.patchedMetadataCache = metadataCache;
    this.originalGetFirstLinkpathDest = originalGetFirstLinkpathDest;
    this.patchedGetFirstLinkpathDest = patchedGetFirstLinkpathDest;
    this.originalFileToLinktext = originalFileToLinktext;
    this.patchedFileToLinktext = patchedFileToLinktext;
  }

  private restoreIWorkPackageMetadataPatch(): void {
    if (this.patchedMetadataCache) {
      if (
        this.originalGetFirstLinkpathDest &&
        this.patchedMetadataCache.getFirstLinkpathDest === this.patchedGetFirstLinkpathDest
      ) {
        this.patchedMetadataCache.getFirstLinkpathDest = this.originalGetFirstLinkpathDest;
      }
      if (
        this.originalFileToLinktext &&
        this.patchedMetadataCache.fileToLinktext === this.patchedFileToLinktext
      ) {
        this.patchedMetadataCache.fileToLinktext = this.originalFileToLinktext;
      }
    }

    this.patchedMetadataCache = null;
    this.originalGetFirstLinkpathDest = null;
    this.patchedGetFirstLinkpathDest = null;
    this.originalFileToLinktext = null;
    this.patchedFileToLinktext = null;
  }

  private rebuildIWorkPackageFileIndex(): void {
    const packageFilesByPath = new Map<string, IWorkPackageFile>();
    const packageFilesByBasename = new Map<string, IWorkPackageFile[]>();

    for (const file of this.app.vault.getAllLoadedFiles()) {
      if (!(file instanceof TFolder) || file.isRoot() || !isIWorkPackagePath(file.path)) {
        continue;
      }

      const packageFile = this.createIWorkPackageFile(file);
      packageFilesByPath.set(packageFile.path, packageFile);
      const basenameMatches = packageFilesByBasename.get(packageFile.basename) ?? [];
      basenameMatches.push(packageFile);
      packageFilesByBasename.set(packageFile.basename, basenameMatches);
    }

    for (const matches of packageFilesByBasename.values()) {
      matches.sort((a, b) => a.path.localeCompare(b.path));
    }

    this.iWorkPackageFilesByPath = packageFilesByPath;
    this.iWorkPackageFilesByBasename = packageFilesByBasename;
  }

  private createIWorkPackageFile(folder: TFolder): IWorkPackageFile {
    const extension = getPathExtension(folder.path);
    const basename = extension.length > 0
      ? folder.name.slice(0, -(extension.length + 1))
      : folder.name;
    const folderStat = (folder as Partial<{ stat: unknown }>).stat;
    const file = Object.create(TFile.prototype) as IWorkPackageFile;

    file.vault = this.app.vault;
    file.path = folder.path;
    file.name = folder.name;
    file.parent = folder.parent;
    file.basename = basename;
    file.extension = extension;
    file.stat = this.toFileStats(folderStat);
    file.__folderAndGraphsPlusIWorkPackageFile = true;
    file.__folderAndGraphsPlusPackageFolder = folder;

    void this.app.vault.adapter.stat(folder.path).then((stat) => {
      const current = this.iWorkPackageFilesByPath.get(folder.path);
      if (current?.__folderAndGraphsPlusPackageFolder === folder && stat) {
        current.stat = this.toFileStats(stat);
      }
    });

    return file;
  }

  private resolveIWorkPackageLinkpath(linkpath: string, sourcePath: string): IWorkPackageFile | null {
    const normalizedLinkpath = this.normalizeIWorkPackageLinkpath(linkpath);
    if (!normalizedLinkpath) {
      return null;
    }

    const exact = this.iWorkPackageFilesByPath.get(normalizedLinkpath);
    if (exact) {
      return exact;
    }

    const sourceFolder = this.getSourceFolderPath(sourcePath);
    if (sourceFolder) {
      const relative = this.iWorkPackageFilesByPath.get(`${sourceFolder}/${normalizedLinkpath}`);
      if (relative) {
        return relative;
      }
    }

    const basename = this.getIWorkLinkBasename(normalizedLinkpath);
    const matches = this.iWorkPackageFilesByBasename.get(basename) ?? [];
    return matches.length === 1 ? matches[0] : null;
  }

  private normalizeIWorkPackageLinkpath(linkpath: string): string {
    return getLinkpath(linkpath)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
  }

  private getSourceFolderPath(sourcePath: string): string {
    const normalizedSourcePath = sourcePath.replace(/\\/g, "/");
    const slashIndex = normalizedSourcePath.lastIndexOf("/");
    return slashIndex >= 0 ? normalizedSourcePath.slice(0, slashIndex) : "";
  }

  private getIWorkLinkBasename(path: string): string {
    const slashIndex = path.lastIndexOf("/");
    const name = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
    const extension = getPathExtension(name);
    return extension.length > 0 ? name.slice(0, -(extension.length + 1)) : name;
  }

  private isSyntheticIWorkPackageFile(file: TFile): file is IWorkPackageFile {
    return (file as Partial<IWorkPackageFile>).__folderAndGraphsPlusIWorkPackageFile === true;
  }

  private toFileStats(value: unknown): FileStats {
    if (typeof value !== "object" || value === null) {
      return {
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
      };
    }

    const stat = value as Partial<FileStats>;
    return {
      ctime: typeof stat.ctime === "number" ? stat.ctime : Date.now(),
      mtime: typeof stat.mtime === "number" ? stat.mtime : Date.now(),
      size: typeof stat.size === "number" ? stat.size : 0
    };
  }

  private refreshFileExplorerLeaves(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view as FileExplorerLike | undefined;
      view?.requestRefresh?.();
      view?.refresh?.();
      view?.requestSort?.();
      view?.update?.();
    }

    this.queueIWorkPackageFileExplorerDecoration();
  }

  private queueIWorkPackageFileExplorerDecoration(): void {
    this.clearIWorkFileExplorerDecorationTimeout();
    this.decorateIWorkPackageFileExplorerLeaves();
    for (const delay of [100, 500, 1500, 3000, 6000]) {
      const timeout = window.setTimeout(() => {
        this.iWorkFileExplorerDecorationTimeouts = this.iWorkFileExplorerDecorationTimeouts.filter(
          (queuedTimeout) => queuedTimeout !== timeout
        );
        this.decorateIWorkPackageFileExplorerLeaves();
      }, delay);
      this.iWorkFileExplorerDecorationTimeouts.push(timeout);
    }
  }

  private clearIWorkFileExplorerDecorationTimeout(): void {
    for (const timeout of this.iWorkFileExplorerDecorationTimeouts) {
      window.clearTimeout(timeout);
    }

    this.iWorkFileExplorerDecorationTimeouts = [];
  }

  private decorateIWorkPackageFileExplorerLeaves(): void {
    if (!this.settings.iWorkPackages.enabled) {
      return;
    }

    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view as FileExplorerLike | undefined;
      const items = view?.fileItems;
      if (!items) {
        continue;
      }

      for (const item of Object.values(items)) {
        const file = item.file;
        if (!(file instanceof TFolder) || file.isRoot() || !isIWorkPackagePath(file.path)) {
          continue;
        }

        this.decorateIWorkPackageFileExplorerItem(item, file);
      }

      this.decorateVisibleIWorkFileExplorerTags(leaf);
    }
  }

  private decorateVisibleIWorkFileExplorerTags(leaf: WorkspaceLeaf): void {
    const containerEl = leaf.view?.containerEl;
    if (!containerEl) {
      return;
    }

    for (const rowEl of Array.from(containerEl.querySelectorAll<HTMLElement>("[data-path]"))) {
      const path = rowEl.getAttribute("data-path");
      if (!path || !isIWorkPackagePath(path)) {
        continue;
      }

      this.decorateIWorkFileExplorerTag(rowEl, path);
      this.decorateIWorkFileExplorerIcon(rowEl);
    }
  }

  private decorateIWorkPackageFileExplorerItem(item: FileExplorerItemLike, folder: TFolder): void {
    item.setCollapsed?.(true);
    item.el?.removeClasses(["nav-folder", "is-collapsed"]);
    item.el?.addClasses(["nav-file", "folderandgraphs-plus-iwork-package-item"]);
    item.selfEl?.addClasses(["nav-file-title", "tappable", "is-unsupported", "folderandgraphs-plus-iwork-package"]);
    item.selfEl?.removeClasses(["nav-folder-title", "mod-collapsible"]);
    const folderTitleContentEl = item.selfEl?.querySelector(".nav-folder-title-content");
    folderTitleContentEl?.removeClass("nav-folder-title-content");
    folderTitleContentEl?.addClass("nav-file-title-content");
    this.decorateIWorkFileExplorerIcon(item.selfEl);
    this.decorateIWorkFileExplorerTag(item.selfEl, folder.path);
    item.collapseEl?.addClass("folderandgraphs-plus-iwork-package-collapse");
    item.childrenEl?.addClass("folderandgraphs-plus-iwork-package-children");

    if (item.__folderAndGraphsPlusOriginalOnSelfClick) {
      return;
    }

    item.__folderAndGraphsPlusOriginalOnSelfClick = item.onSelfClick;
    const getPackageFile = (): IWorkPackageFile | null => this.iWorkPackageFilesByPath.get(folder.path) ?? null;
    item.onSelfClick = function folderAndGraphsPlusIWorkPackageClick(event: FileExplorerClickEvent): void {
      if (event instanceof MouseEvent && event.button !== 0 && event.button !== 1) {
        return;
      }

      const packageFile = getPackageFile();
      if (!packageFile) {
        return;
      }

      if (item.view?.tree?.handleItemSelection?.(event, item)) {
        return;
      }

      const workspace = item.view?.app?.workspace;
      const leaf = workspace?.getLeaf?.(event instanceof MouseEvent && (event.metaKey || event.ctrlKey));
      void leaf?.openFile(packageFile);
      workspace?.setActiveLeaf?.(workspace.getMostRecentLeaf?.() ?? leaf ?? null, { focus: true });
    };
    this.patchedIWorkFileExplorerItems.add(item);
  }

  private decorateIWorkFileExplorerIcon(selfEl: HTMLElement | undefined): void {
    const sidekickIconEl = selfEl?.querySelector<HTMLElement>(".iconic-sidekick.iconic-icon");
    if (!sidekickIconEl) {
      return;
    }

    const currentIconEl = sidekickIconEl.querySelector<SVGElement>("svg");
    if (
      !currentIconEl?.classList.contains("lucide-folder") &&
      !currentIconEl?.classList.contains("lucide-folder-open")
    ) {
      return;
    }

    setIcon(sidekickIconEl, "file");
  }

  private decorateIWorkFileExplorerTag(selfEl: HTMLElement | undefined, path: string): void {
    if (!selfEl) {
      return;
    }

    const tagText = this.getIWorkPackageExplorerTagText(path);
    let tagEl =
      selfEl.querySelector<HTMLElement>(".folderandgraphs-plus-iwork-package-tag") ??
      selfEl.querySelector<HTMLElement>(".nav-file-tag");

    if (!tagEl) {
      tagEl = document.createElement("div");
      selfEl.appendChild(tagEl);
    }

    tagEl.addClasses(["nav-file-tag", "folderandgraphs-plus-iwork-package-tag"]);
    if (tagEl.textContent !== tagText) {
      tagEl.textContent = tagText;
    }
  }

  private getIWorkPackageExplorerTagText(path: string): string {
    switch (getPathExtension(path)) {
      case "key":
        return "KEYNOTE";
      case "numbers":
        return "NUMBERS";
      case "pages":
        return "PAGES";
      default:
        return getPathExtension(path).toUpperCase();
    }
  }

  private restoreIWorkPackageFileExplorerItems(): void {
    for (const item of this.patchedIWorkFileExplorerItems) {
      if (item.__folderAndGraphsPlusOriginalOnSelfClick) {
        item.onSelfClick = item.__folderAndGraphsPlusOriginalOnSelfClick;
        delete item.__folderAndGraphsPlusOriginalOnSelfClick;
      }

      item.selfEl?.removeClasses(["nav-file-title", "tappable", "is-unsupported", "folderandgraphs-plus-iwork-package"]);
      item.selfEl?.addClasses(["nav-folder-title", "mod-collapsible"]);
      item.el?.removeClasses(["nav-file", "folderandgraphs-plus-iwork-package-item"]);
      item.el?.addClass("nav-folder");
      item.collapseEl?.removeClass("folderandgraphs-plus-iwork-package-collapse");
      item.childrenEl?.removeClass("folderandgraphs-plus-iwork-package-children");
      item.selfEl?.querySelector<HTMLElement>(".folderandgraphs-plus-iwork-package-tag")?.remove();
    }

    this.patchedIWorkFileExplorerItems.clear();
  }

  refreshGraphsAfterSettingsChange(): void {
    this.restoreAllGraphLabelStyles();
    for (const leaf of this.getGraphLeaves()) {
      this.reloadGraphLeaf(leaf);
    }

    this.refreshGraphLeaves();
  }

  private async refreshColorGroups(): Promise<void> {
    const fromGraphView = this.readColorGroupsFromGraphViews();
    if (fromGraphView.length > 0) {
      this.colorGroups = fromGraphView;
      return;
    }

    const fromGraphJson = await this.readColorGroupsFromGraphJson();
    if (fromGraphJson.length > 0) {
      this.colorGroups = fromGraphJson;
      return;
    }

    this.colorGroups = [];
  }

  private readColorGroupsFromGraphViews(): GraphColorGroup[] {
    for (const leaf of this.getGraphLeaves()) {
      const options = leaf.view?.dataEngine?.getOptions?.();
      const groups = this.extractColorGroups(options);
      if (groups.length > 0) {
        return groups;
      }
    }

    return [];
  }

  private async readColorGroupsFromGraphJson(): Promise<GraphColorGroup[]> {
    const configDir = this.app.vault.configDir;
    const graphConfigPath = `${configDir}/graph.json`;

    try {
      const raw = await this.app.vault.adapter.read(graphConfigPath);
      return this.extractColorGroups(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  private extractColorGroups(value: unknown): GraphColorGroup[] {
    if (
      typeof value === "object" &&
      value !== null &&
      Array.isArray((value as { colorGroups?: unknown }).colorGroups)
    ) {
      return (value as { colorGroups: GraphColorGroup[] }).colorGroups;
    }

    return [];
  }

  getFolderColorSuggestions(query: string): FolderColorSuggestion[] {
    const suggestions: FolderColorSuggestion[] = [];
    const basenameGroups = new Map<string, TFolder[]>();

    const folders = this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder && !file.isRoot());

    for (const folder of folders) {
      const group = basenameGroups.get(folder.name) ?? [];
      group.push(folder);
      basenameGroups.set(folder.name, group);

      suggestions.push({
        type: "folder",
        target: folder.path,
        label: folder.path,
        detail: "Folder"
      });
    }

    for (const [basename, folders] of basenameGroups.entries()) {
      if (folders.length < 2) {
        continue;
      }

      suggestions.unshift({
        type: "combined",
        target: basename,
        label: `${basename} (combined)`,
        detail: `${folders.length} folders named ${basename}`
      });
    }

    const search = query.trim();
    if (!search) {
      return suggestions.slice(0, 100);
    }

    const fuzzySearch = prepareFuzzySearch(search);
    return suggestions
      .filter((suggestion) => fuzzySearch(suggestion.label) || fuzzySearch(suggestion.target))
      .slice(0, 100);
  }
}

class FolderColorSuggest extends AbstractInputSuggest<FolderColorSuggestion> {
  constructor(
    private plugin: FolderAndGraphsPlusPlugin,
    inputEl: HTMLInputElement,
    private onChooseFolderColorSuggestion: (suggestion: FolderColorSuggestion) => Promise<void>
  ) {
    super(plugin.app, inputEl);
  }

  protected getSuggestions(query: string): FolderColorSuggestion[] {
    return this.plugin.getFolderColorSuggestions(query);
  }

  renderSuggestion(value: FolderColorSuggestion, el: HTMLElement): void {
    el.createDiv({ text: value.label });
    el.createDiv({ text: value.detail, cls: "suggestion-note" });
  }

  selectSuggestion(value: FolderColorSuggestion, evt: MouseEvent | KeyboardEvent): void {
    this.setValue(value.target);
    void this.onChooseFolderColorSuggestion(value);
    this.close();
  }
}

type FolderAndGraphsPlusSettingsTabId = "plus" | "folder2graph";

class FolderAndGraphsPlusSettingTab extends PluginSettingTab {
  plugin: FolderAndGraphsPlusPlugin;
  private activeTab: FolderAndGraphsPlusSettingsTabId = "plus";
  private folder2GraphFilterListRefreshTimer: number | null = null;

  constructor(app: FolderAndGraphsPlusPlugin["app"], plugin: FolderAndGraphsPlusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.renderSettingsShell();
  }

  hide(): void {
    if (this.folder2GraphFilterListRefreshTimer !== null) {
      window.clearTimeout(this.folder2GraphFilterListRefreshTimer);
      this.folder2GraphFilterListRefreshTimer = null;
    }
  }

  private renderSettingsShell(): void {
    const { containerEl } = this;
    containerEl.empty();

    const tabContainer = containerEl.createDiv({ cls: "folderandgraphs-plus-settings-tabs" });
    this.renderSettingsTabButton(tabContainer, "plus", "Folder and Graphs Plus");
    this.renderSettingsTabButton(tabContainer, "folder2graph", "Folder2Graph");

    const bodyEl = containerEl.createDiv({ cls: "folderandgraphs-plus-settings-tab-body" });
    if (this.activeTab === "folder2graph") {
      this.renderFolder2GraphSettings(bodyEl);
    } else {
      this.renderSettings(bodyEl);
    }
  }

  private renderSettingsTabButton(
    containerEl: HTMLElement,
    tabId: FolderAndGraphsPlusSettingsTabId,
    label: string
  ): void {
    const button = containerEl.createEl("button", {
      text: label,
      cls: "folderandgraphs-plus-settings-tab-button"
    });
    button.type = "button";
    button.toggleClass("is-active", this.activeTab === tabId);
    button.addEventListener("click", () => {
      this.activeTab = tabId;
      this.renderSettingsShell();
    });
  }

  private renderSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Combine folders with the same name")
      .setDesc("Show folders that share the same basename as one combined graph node. When disabled, Folder2Graph keeps each full folder path separate.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.combineSameNameFolders)
          .onChange(async (value) => {
            this.plugin.settings.combineSameNameFolders = value;
            await this.plugin.saveSettings();
            this.plugin.refreshGraphsAfterSettingsChange();
            this.renderSettingsShell();
          });
      });

    new Setting(containerEl)
      .setName("Show folder emoji in graph")
      .setDesc("Prefix every Folder2Graph folder node label with the standard folder emoji.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showFolderEmoji)
          .onChange(async (value) => {
            this.plugin.settings.showFolderEmoji = value;
            await this.plugin.saveSettings();
            this.plugin.refreshGraphsAfterSettingsChange();
          });
      });

    new Setting(containerEl).setName("File type support").setHeading();

    new Setting(containerEl)
      .setName("Recognise iWork packages as files")
      .setDesc("Treat .pages, .key, and .numbers packages as file attachments instead of folders in File Explorer and Graph View. In Obsidian's Files and Links settings, turn on Detect all file extensions for .pages, .key, and .numbers files to appear.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.iWorkPackages.enabled)
          .onChange(async (value) => {
            this.plugin.settings.iWorkPackages.enabled = value;
            await this.plugin.saveSettings();
            this.plugin.refreshIWorkPackageFileSupport();
            this.renderSettingsShell();
          });
      });

    new Setting(containerEl).setName("Attachment filtering").setHeading();

    new Setting(containerEl)
      .setName("Enable attachment filtering")
      .setDesc("Filter attachment nodes from Graph View by file extension.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.graphFilters.enabled)
          .onChange(async (value) => {
            this.plugin.settings.graphFilters.enabled = value;
            await this.saveAndRefresh();
            this.renderSettingsShell();
          });
      });

    new Setting(containerEl)
      .setName("Attachment extension mode")
      .setDesc("Choose whether the extension list is removed from Graph View or is the only attachment list shown.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("hide-custom", "Hide listed extensions")
          .addOption("custom", "Show only listed extensions")
          .setValue(
            this.plugin.settings.graphFilters.attachmentMode === "custom"
              ? "custom"
              : "hide-custom"
          )
          .onChange(async (value) => {
            this.plugin.settings.graphFilters.attachmentMode = value === "custom" ? "custom" : "hide-custom";
            await this.saveAndRefresh();
          });
      });

    new Setting(containerEl)
      .setName("Attachment extensions")
      .setDesc("Comma or space separated extensions, such as .jpg, .png, pdf.")
      .addText((text) => {
        text
          .setPlaceholder(".jpg, .png, .pdf")
          .setValue(this.plugin.settings.graphFilters.attachmentExtensions.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.graphFilters.attachmentExtensions = normalizeGraphFilterSettings({
              ...this.plugin.settings.graphFilters,
              attachmentExtensions: value
            }).attachmentExtensions;
            await this.saveAndRefresh();
          });
      });

    new Setting(containerEl).setName("Folder colours").setHeading();

    for (const [index, rule] of this.plugin.settings.folderColorRules.entries()) {
      this.renderFolderColorRule(containerEl, rule, this.plugin.settings.folderColorRules, index);
    }

    new Setting(containerEl)
      .setName("Add folder colour")
      .addButton((button) => {
        button
          .setIcon("plus")
          .setTooltip("Add")
          .onClick(async () => {
            this.plugin.settings.folderColorRules.push({
              type: "folder",
              target: "",
              color: DEFAULT_FOLDER_RULE_COLOR,
              inheritToChildren: true,
              colorLinks: true,
              boldLabel: false,
              children: []
            });
            await this.saveAndRefresh();
            this.renderSettingsShell();
          });
      });
  }

  private renderFolder2GraphSettings(containerEl: HTMLElement): void {
    const settings = this.plugin.settings.folder2graph ?? DEFAULT_FOLDER2GRAPH_SETTINGS;
    const externalFolder2GraphEnabled = this.plugin.isExternalFolder2GraphEnabled();

    if (externalFolder2GraphEnabled) {
      new Setting(containerEl)
        .setName("External Folder2Graph is enabled")
        .setDesc("These controls apply to the bundled Folder2Graph runtime used by Folder and Graphs Plus. Disable the separate Folder2Graph plugin if you want these settings to control folder-node injection.");
    }

    new Setting(containerEl).setName("Folders").setHeading();

    new Setting(containerEl)
      .setName("Show folders")
      .setDesc("Display the vault folder structure in Graph View.")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.showFolderNodes)
          .onChange(async (value) => {
            settings.showFolderNodes = value;
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl)
      .setName("Folder node colour")
      .setDesc("Colour used for Folder2Graph folder nodes before Folder and Graphs Plus colour rules override matching nodes.")
      .addColorPicker((colorPicker) => {
        colorPicker
          .setValue(settings.nodeColor)
          .onChange(async (value) => {
            settings.nodeColor = value;
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl).setName("Headings").setHeading();

    new Setting(containerEl)
      .setName("Show heading nodes")
      .setDesc("Display note headings as graph nodes.")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.showHeadingNodes)
          .onChange(async (value) => {
            settings.showHeadingNodes = value;
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl)
      .setName("Heading node colour")
      .setDesc("Colour used for Folder2Graph heading nodes.")
      .addColorPicker((colorPicker) => {
        colorPicker
          .setValue(settings.headingNodeColor)
          .onChange(async (value) => {
            settings.headingNodeColor = value;
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl)
      .setName("Heading link anchoring")
      .setDesc("Choose which graph node is used for wikilinks that point to headings.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("file-file", "File -> file")
          .addOption("file-heading", "File -> heading")
          .addOption("heading-file", "Heading -> file")
          .addOption("heading-heading", "Heading -> heading")
          .setValue(settings.headingLinkAnchorMode)
          .onChange(async (value) => {
            settings.headingLinkAnchorMode = value as Folder2GraphHeadingLinkAnchorMode;
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl).setName("Folder filtering").setHeading();

    new Setting(containerEl)
      .setName("Folder filter mode")
      .setDesc("Include only the listed folders, or exclude the listed folders.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("exclude", "Exclude")
          .addOption("include", "Include")
          .setValue(settings.folderFilterMode)
          .onChange(async (value) => {
            settings.folderFilterMode = value === "include" ? "include" : "exclude";
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl)
      .setName("Folder filter list")
      .setDesc("One vault-relative folder path per line.")
      .addTextArea((textArea) => {
        textArea
          .setValue(settings.folderFilterList.join("\n"))
          .onChange((value) => {
            settings.folderFilterList = this.parseFolder2GraphFilterListInput(value);
            void this.plugin.saveFolder2GraphSettings(false);
            if (this.folder2GraphFilterListRefreshTimer !== null) {
              window.clearTimeout(this.folder2GraphFilterListRefreshTimer);
            }
            this.folder2GraphFilterListRefreshTimer = window.setTimeout(() => {
              this.folder2GraphFilterListRefreshTimer = null;
              this.plugin.refreshGraphsAfterSettingsChange();
            }, 600);
          });
      });

    new Setting(containerEl)
      .setName("Hide filtered-out files")
      .setDesc("Hide files and headings inside folders excluded by the folder filter.")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.folderFilterHideFiles)
          .onChange(async (value) => {
            settings.folderFilterHideFiles = value;
            await this.saveFolder2GraphSettings();
          });
      });

    new Setting(containerEl).setName("Weighting").setHeading();

    new Setting(containerEl)
      .setName("Weight nodes by descendants")
      .setDesc("Increase node size based on visible descendants.")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.weightNodesBySubtree)
          .onChange(async (value) => {
            settings.weightNodesBySubtree = value;
            await this.saveFolder2GraphSettings();
          });
      });
  }

  private renderFolderColorRule(
    containerEl: HTMLElement,
    rule: FolderColorRule | FolderColorChildRule,
    siblings: (FolderColorRule | FolderColorChildRule)[],
    index: number,
    depth = 0,
    isChild = false
  ): void {
    const rowEl = containerEl.createDiv();
    rowEl.addClass("folderandgraphs-plus-rule-row");
    rowEl.setCssStyles({ marginLeft: `${depth * 18}px` });

    const setting = new Setting(rowEl)
      .setName(this.getFolderRuleName(rule, index, isChild))
      .setDesc(this.getFolderRuleDescription(rule, isChild));
    setting.settingEl.addClass("folderandgraphs-plus-rule-setting");
    setting.controlEl.addClass("folderandgraphs-plus-rule-controls");

    setting.addSearch((search) => {
      search.inputEl.addClass("folderandgraphs-plus-folder-search-input");
      search.inputEl.parentElement?.addClass("folderandgraphs-plus-folder-search");
      search
        .setPlaceholder(isChild ? "Search child folders" : "Search folders")
        .setValue(rule.target)
        .onChange(async (value) => {
          rule.type = "folder";
          rule.target = value;
          await this.saveAndRefresh();
        });

      new FolderColorSuggest(this.plugin, search.inputEl, async (suggestion) => {
        rule.type = suggestion.type;
        rule.target = suggestion.target;
        await this.saveAndRefresh();
        this.renderSettingsShell();
      });
    });

    this.addControlDivider(setting);

    if (!isChild) {
      const topLevelRule = rule as FolderColorRule;
      setting.addColorPicker((colorPicker) => {
        colorPicker
          .setValue(topLevelRule.color)
          .onChange(async (value) => {
            topLevelRule.color = value;
            await this.saveAndRefresh();
          });
      });

      this.addControlDivider(setting);
      this.addToggleTag(setting, "Children");
      setting.addToggle((toggle) => {
        toggle
          .setTooltip("Notes of child folders have parent colour")
          .setValue(topLevelRule.inheritToChildren)
          .onChange(async (value) => {
            topLevelRule.inheritToChildren = value;
            await this.saveAndRefresh();
          });
      });

    }

    this.addControlDivider(setting);
    this.addToggleTag(setting, "Bold");
    setting.addToggle((toggle) => {
      toggle
        .setTooltip("Bold this exact folder node label in Graph View")
        .setValue(rule.boldLabel)
        .onChange(async (value) => {
          rule.boldLabel = value;
          await this.saveAndRefresh();
        });
    });

    this.addControlDivider(setting);
    this.addToggleTag(setting, "Lines");
    setting.addToggle((toggle) => {
      toggle
        .setTooltip(isChild ? "Colour graph lines for this nested folder rule" : "Colour graph lines that touch this folder colour")
        .setValue(rule.colorLinks)
        .onChange(async (value) => {
          rule.colorLinks = value;
          await this.saveAndRefresh();
        });
    });

    this.addControlDivider(setting);
    setting.addButton((button) => {
      button
        .setIcon("plus")
        .setTooltip("Add child folder")
        .onClick(async () => {
          rule.children.push({
            type: "folder",
            target: "",
            boldLabel: false,
            colorLinks: true,
            children: []
          });
          await this.saveAndRefresh();
          this.renderSettingsShell();
        });
    });

    this.addControlDivider(setting);
    setting.addButton((button) => {
      button
        .setIcon("trash")
        .setTooltip("Remove")
        .onClick(async () => {
          siblings.splice(index, 1);
          await this.saveAndRefresh();
          this.renderSettingsShell();
        });
    });

    for (const [childIndex, childRule] of rule.children.entries()) {
      this.renderFolderColorRule(containerEl, childRule, rule.children, childIndex, depth + 1, true);
    }
  }

  private getFolderRuleName(
    rule: FolderColorRule | FolderColorChildRule,
    index: number,
    isChild: boolean
  ): string {
    if (!isChild) {
      return `Folder colour ${index + 1}`;
    }

    return rule.type === "combined" ? `Combined child folder ${index + 1}` : `Child folder ${index + 1}`;
  }

  private getFolderRuleDescription(rule: FolderColorRule | FolderColorChildRule, isChild: boolean): string {
    if (isChild) {
      return rule.type === "combined"
        ? "Nested combined folder, inherits parent colour"
        : "Nested folder, inherits parent colour";
    }

    return rule.type === "combined" ? "Combined same-name folder" : "Folder and descendants";
  }

  private async saveAndRefresh(): Promise<void> {
    await this.plugin.saveSettings();
    this.plugin.refreshGraphsAfterSettingsChange();
  }

  private async saveFolder2GraphSettings(): Promise<void> {
    await this.plugin.saveFolder2GraphSettings();
  }

  private parseFolder2GraphFilterListInput(value: string): string[] {
    const folders = new Set<string>();
    for (const entry of value.split("\n")) {
      const normalized = entry.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      if (normalized.length > 0) {
        folders.add(normalized);
      }
    }

    return [...folders];
  }

  private addToggleTag(setting: Setting, text: string): void {
    setting.controlEl.createSpan({
      text,
      cls: "folderandgraphs-plus-toggle-tag"
    });
  }

  private addControlDivider(setting: Setting): void {
    setting.controlEl.createSpan({
      cls: "folderandgraphs-plus-control-divider"
    });
  }
}
