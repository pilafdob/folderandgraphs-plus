import {
  AbstractInputSuggest,
  Plugin,
  PluginSettingTab,
  Setting,
  TFolder,
  prepareFuzzySearch,
  type TAbstractFile,
  type WorkspaceLeaf
} from "obsidian";
import {
  type FolderColorRule,
  type FolderColorChildRule,
  type FolderColorRuleType,
  type GraphColor,
  type GraphColorGroup,
  DEFAULT_FOLDER_GLOW_STRENGTH,
  MAX_FOLDER_GLOW_STRENGTH,
  MIN_FOLDER_GLOW_STRENGTH,
  folderPathFromNodeId,
  getFolderVisualForPaths,
  getGraphLinkColorDecision,
  getGraphNodePluginColors,
  normalizeFolderGlowStrength,
  parseHexGraphColor
} from "./graphGroups";
import Folder2GraphPlugin from "./vendor/folders2graph/main";

const FOLDER2GRAPH_NODE_TYPE = "f2g_node";
const DEFAULT_FOLDER_RULE_COLOR = "#5c8af5";

type FolderAndGraphsPlusSettings = {
  combineSameNameFolders: boolean;
  folderColorRules: FolderColorRule[];
  folder2graph?: Record<string, unknown>;
};

const DEFAULT_SETTINGS: FolderAndGraphsPlusSettings = {
  combineSameNameFolders: false,
  folderColorRules: []
};

type GraphRenderer = {
  nodes?: unknown[];
  links?: unknown;
  edges?: unknown;
  linkNodes?: unknown;
  linkObjects?: unknown;
  renderer?: Record<string, unknown>;
  graph?: Record<string, unknown>;
  changed?: () => void;
  setData?: (data: GraphData) => unknown;
  originalSetData?: (data: GraphData) => unknown;
  __folderAndGraphsPlusDataPatch?: {
    key: "setData" | "originalSetData";
    original: (data: GraphData) => unknown;
    wrapper: (data: GraphData) => unknown;
  };
};

type GraphLeaf = WorkspaceLeaf & {
  view?: {
    getViewType?: () => string;
    renderer?: GraphRenderer;
    dataEngine?: {
      getOptions?: () => unknown;
      setOptions?: (options: unknown) => void;
    };
    unload?: () => void;
    load?: () => void;
  };
};

type PatchableGraphNode = {
  id?: unknown;
  type?: unknown;
  circle?: unknown;
  graphics?: unknown;
  radius?: unknown;
  r?: unknown;
  alpha?: unknown;
  __folderAndGraphsPlusGlowBaseGeometry?: { x: number; y: number; radius: number };
  __folderAndGraphsPlusGlowSignature?: string;
  __folderAndGraphsPlusOriginalGetFillColor?: () => GraphColor;
  __folderAndGraphsPlusOriginalNodeRenderMethods?: Partial<Record<GraphRenderMethodName, GraphNodeRenderMethod>>;
  getFillColor?: () => GraphColor;
  render?: GraphNodeRenderMethod;
  draw?: GraphNodeRenderMethod;
  updateGraphics?: GraphNodeRenderMethod;
};

type GraphRenderMethodName = "render" | "draw" | "updateGraphics";

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
  __folderAndGraphsPlusOriginalLinkRenderMethods?: Partial<Record<GraphRenderMethodName, GraphLinkRenderMethod>>;
  render?: GraphLinkRenderMethod;
  draw?: GraphLinkRenderMethod;
  updateGraphics?: GraphLinkRenderMethod;
};

type GraphLinkRenderMethod = (this: PatchableGraphLink, ...args: unknown[]) => unknown;

type PixiLineLike = {
  tint?: number;
  alpha?: number;
  lineWidth?: number;
  width?: number;
  clear?: () => void;
  moveTo?: (x: number, y: number) => void;
  lineTo?: (x: number, y: number) => void;
  lineStyle?: (width?: number, color?: number, alpha?: number) => void;
};

type PixiCircleLike = PixiLineLike & {
  x?: number;
  y?: number;
  radius?: number;
  r?: number;
  drawCircle?: (x: number, y: number, radius: number) => void;
  arc?: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void;
  beginFill?: (color?: number, alpha?: number) => void;
  closePath?: () => void;
  endFill?: () => void;
  getLocalBounds?: () => { x: number; y: number; width: number; height: number };
};

type GraphPoint = {
  x: number;
  y: number;
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

type Folder2GraphSettings = Record<string, unknown>;

type FolderColorSuggestion = {
  type: FolderColorRuleType;
  target: string;
  label: string;
  detail: string;
};

export default class FolderAndGraphsPlusPlugin extends Plugin {
  settings: FolderAndGraphsPlusSettings = { ...DEFAULT_SETTINGS };
  private bundledFolder2Graph: Plugin | null = null;
  private patchedPrototype: PatchableGraphNode | null = null;
  private originalGetFillColor: (() => GraphColor) | null = null;
  private patchedGetFillColor: (() => GraphColor) | null = null;
  private patchedLinkPrototypes = new Set<PatchableGraphLink>();
  private rendererByLinkPrototype = new WeakMap<PatchableGraphLink, GraphRenderer>();
  private colorGroups: GraphColorGroup[] = [];
  private combinedFolderPathsByNodeId = new Map<string, string[]>();
  private nodePluginColorsById = new Map<string, GraphColor>();

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.loadBundledFolder2GraphIfNeeded();
    await this.refreshColorGroups();
    this.addSettingTab(new FolderAndGraphsPlusSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.refreshGraphLeaves();
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshGraphLeaves();
      })
    );

    this.registerInterval(
      window.setInterval(() => {
        void this.refreshColorGroups().then(() => this.requestGraphRedraw());
      }, 2000)
    );

    this.refreshGraphLeaves();
    if (this.settings.combineSameNameFolders) {
      this.refreshGraphsAfterSettingsChange();
    }
  }

  onunload(): void {
    if (this.patchedPrototype && this.originalGetFillColor) {
      this.patchedPrototype.getFillColor = this.originalGetFillColor;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetFillColor;
    }

    this.restoreGraphNodeRenderMethods();
    this.restoreGraphLinkRenderMethods();
    this.patchedPrototype = null;
    this.originalGetFillColor = null;
    this.patchedGetFillColor = null;
    this.unpatchRendererData();
    void this.unloadBundledFolder2Graph();
    this.requestGraphRedraw();
  }

  private refreshGraphLeaves(): void {
    void this.refreshColorGroups();

    for (const leaf of this.getGraphLeaves()) {
      const renderer = leaf.view?.renderer;
      if (!renderer) {
        continue;
      }

      this.patchRendererData(renderer);

      if (Array.isArray(renderer.nodes) && renderer.nodes.length > 0) {
        this.patchNodePrototype(renderer.nodes[0]);
      }

      this.patchGraphLinkRendering(renderer);
      renderer.changed?.();
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

  private patchNodePrototype(node: unknown): void {
    const prototype = Object.getPrototypeOf(node) as PatchableGraphNode | null;
    if (!prototype || typeof prototype.getFillColor !== "function") {
      return;
    }

    if (this.patchedPrototype === prototype && prototype.getFillColor === this.patchedGetFillColor) {
      this.patchGraphNodeRenderMethods(prototype);
      return;
    }

    if (this.patchedPrototype && this.originalGetFillColor && this.patchedPrototype !== prototype) {
      this.patchedPrototype.getFillColor = this.originalGetFillColor;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetFillColor;
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
    this.patchGraphNodeRenderMethods(prototype);
  }

  private getColorForGraphNode(node: PatchableGraphNode): GraphColor | null {
    return this.getVisualForGraphNode(node)?.color ?? null;
  }

  private getVisualForGraphNode(
    node: PatchableGraphNode
  ): { color: GraphColor; glow: boolean; glowStrength: number } | null {
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

  private patchGraphNodeRenderMethods(prototype: PatchableGraphNode): void {
    const originalMethods = prototype.__folderAndGraphsPlusOriginalNodeRenderMethods ?? {};
    if (Object.keys(originalMethods).length > 0) {
      return;
    }

    const drawNodeGlow = this.drawNodeGlow.bind(this);
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
        drawNodeGlow(this);
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
      GraphRenderMethodName,
      GraphNodeRenderMethod
    ][]) {
      prototype[methodName] = original;
    }

    delete prototype.__folderAndGraphsPlusOriginalNodeRenderMethods;
  }

  private drawNodeGlow(node: PatchableGraphNode): void {
    const visual = this.getVisualForGraphNode(node);
    if (!visual?.glow) {
      node.__folderAndGraphsPlusGlowSignature = undefined;
      return;
    }

    const target = this.getNodeGlowTargets(node).find((candidate) => (
      (typeof candidate.beginFill === "function" || typeof candidate.lineStyle === "function") &&
      typeof candidate.drawCircle === "function"
    ));
    if (!target) {
      return;
    }

    const geometry = node.__folderAndGraphsPlusGlowBaseGeometry ?? this.getNodeCircleGeometry(node, target);
    if (!geometry) {
      return;
    }
    node.__folderAndGraphsPlusGlowBaseGeometry = geometry;

    const strength = normalizeFolderGlowStrength(visual.glowStrength);
    const glowSpread = 80;
    const alpha = 0.025 + (strength * 0.0125);
    const signature = [
      strength,
      visual.color.rgb,
      alpha,
      geometry.x,
      geometry.y,
      geometry.radius,
      glowSpread
    ].join(":");
    if (node.__folderAndGraphsPlusGlowSignature === signature) {
      return;
    }

    target.lineStyle?.(glowSpread, visual.color.rgb, alpha * 0.45);
    target.drawCircle?.(geometry.x, geometry.y, geometry.radius + 1 + (glowSpread / 2));
    target.lineStyle?.(glowSpread * 0.45, visual.color.rgb, alpha);
    target.drawCircle?.(geometry.x, geometry.y, geometry.radius + 1 + (glowSpread * 0.225));
    target.lineStyle?.(0, visual.color.rgb, 0);

    node.__folderAndGraphsPlusGlowSignature = signature;
  }

  private getNodeGlowTargets(node: PatchableGraphNode): PixiCircleLike[] {
    return [node.circle, node.graphics, node]
      .filter((target): target is PixiCircleLike => typeof target === "object" && target !== null);
  }

  private getNodeCircleGeometry(node: PatchableGraphNode, target: PixiCircleLike): { x: number; y: number; radius: number } | null {
    const explicitRadius = this.asNumber(node.radius) ?? this.asNumber(node.r) ?? this.asNumber(target.radius) ?? this.asNumber(target.r);
    if (explicitRadius && explicitRadius > 0) {
      return {
        x: this.asNumber(target.x) ?? 0,
        y: this.asNumber(target.y) ?? 0,
        radius: explicitRadius
      };
    }

    const bounds = target.getLocalBounds?.();
    if (
      bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.width > 0 &&
      bounds.height > 0
    ) {
      return {
        x: bounds.x + (bounds.width / 2),
        y: bounds.y + (bounds.height / 2),
        radius: Math.min(bounds.width, bounds.height) / 2
      };
    }

    return null;
  }

  private asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private isFolderGraphNode(node: PatchableGraphNode): boolean {
    return node.type === FOLDER2GRAPH_NODE_TYPE;
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
        GraphRenderMethodName,
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
      this.getNodeFromArray(renderer.nodes, nodeId) ??
      this.getNodeFromArray(rendererWithLookup.renderer?.nodes, nodeId) ??
      this.getNodeFromArray(rendererWithLookup.graph?.nodes, nodeId)
    );
  }

  private getNodeFromLookup(lookup: Record<string, unknown> | Map<string, unknown> | undefined, nodeId: string): unknown {
    if (lookup instanceof Map) {
      return lookup.get(nodeId) ?? null;
    }

    return lookup?.[nodeId] ?? null;
  }

  private getNodeFromArray(nodes: unknown[] | undefined, nodeId: string): unknown {
    return nodes?.find((node) => this.getGraphEndpointId(node) === nodeId) ?? null;
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

    const bridge = bundled as Plugin & {
      loadData: () => Promise<unknown>;
      saveData: (data: unknown) => Promise<void>;
    };

    bridge.loadData = async () => this.settings.folder2graph ?? {};
    bridge.saveData = async (data: unknown) => {
      this.settings.folder2graph = this.parseFolder2GraphSettings(data);
      await this.saveSettings();
    };

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

  private isExternalFolder2GraphEnabled(): boolean {
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

  private patchRendererData(renderer: GraphRenderer): void {
    if (renderer.__folderAndGraphsPlusDataPatch) {
      return;
    }

    const key = typeof renderer.originalSetData === "function" ? "originalSetData" : "setData";
    const original = renderer[key];

    if (typeof original !== "function") {
      return;
    }

    const shouldCombineSameNameFolders = () => this.settings.combineSameNameFolders;
    const mergeSameNameFolderNodes = this.mergeSameNameFolderNodes.bind(this);
    const rememberSeparateFolderPaths = this.rememberSeparateFolderPaths.bind(this);
    const rememberNodePluginColors = this.rememberNodePluginColors.bind(this);
    const wrapper = (data: GraphData): unknown => {
      const nextData = shouldCombineSameNameFolders()
        ? mergeSameNameFolderNodes(data)
        : rememberSeparateFolderPaths(data);

      rememberNodePluginColors(nextData);
      return original.call(renderer, nextData);
    };

    renderer.__folderAndGraphsPlusDataPatch = { key, original, wrapper };
    renderer[key] = wrapper;
  }

  private unpatchRendererData(): void {
    for (const leaf of this.getGraphLeaves()) {
      const renderer = leaf.view?.renderer;
      const patch = renderer?.__folderAndGraphsPlusDataPatch;
      if (!renderer || !patch) {
        continue;
      }

      if (renderer[patch.key] === patch.wrapper) {
        renderer[patch.key] = patch.original;
      } else if (renderer.originalSetData === patch.wrapper) {
        renderer.originalSetData = patch.original;
      }

      delete renderer.__folderAndGraphsPlusDataPatch;
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
      return { ...DEFAULT_SETTINGS };
    }

    const raw = value as Record<string, unknown>;
    return {
      combineSameNameFolders:
        typeof raw.combineSameNameFolders === "boolean"
          ? raw.combineSameNameFolders
          : DEFAULT_SETTINGS.combineSameNameFolders,
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
        glow: raw.glow === true,
        glowStrength: normalizeFolderGlowStrength(raw.glowStrength),
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
        glow: false,
        glowStrength: DEFAULT_FOLDER_GLOW_STRENGTH,
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
        colorLinks: typeof raw.colorLinks === "boolean" ? raw.colorLinks : true,
        glow: raw.glow === true,
        glowStrength: normalizeFolderGlowStrength(raw.glowStrength),
        children: this.parseFolderColorChildRules(raw.children)
      });
    }

    return rules;
  }

  private parseFolder2GraphSettings(value: unknown): Folder2GraphSettings {
    return typeof value === "object" && value !== null ? { ...(value as Folder2GraphSettings) } : {};
  }

  refreshGraphsAfterSettingsChange(): void {
    for (const leaf of this.getGraphLeaves()) {
      const view = leaf.view;
      const options = view?.dataEngine?.getOptions?.();
      view?.renderer?.changed?.();
      view?.unload?.();
      view?.load?.();
      if (options !== undefined) {
        view?.dataEngine?.setOptions?.(options);
      }
      view?.renderer?.changed?.();
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

class FolderAndGraphsPlusSettingTab extends PluginSettingTab {
  plugin: FolderAndGraphsPlusPlugin;

  constructor(app: FolderAndGraphsPlusPlugin["app"], plugin: FolderAndGraphsPlusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const { containerEl } = this;
    containerEl.empty();

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
            this.renderSettings();
          });
      });

    new Setting(containerEl).setName("Folder colours").setHeading();

    for (const [index, rule] of this.plugin.settings.folderColorRules.entries()) {
      this.renderFolderColorRule(containerEl, rule, this.plugin.settings.folderColorRules, index, 0, false);
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
              glow: false,
              glowStrength: DEFAULT_FOLDER_GLOW_STRENGTH,
              children: []
            });
            await this.saveAndRefresh();
            this.renderSettings();
          });
      });
  }

  private renderFolderColorRule(
    containerEl: HTMLElement,
    rule: FolderColorRule | FolderColorChildRule,
    siblings: (FolderColorRule | FolderColorChildRule)[],
    index: number,
    depth: number,
    isChild: boolean
  ): void {
    const rowEl = containerEl.createDiv();
    rowEl.addClass("folderandgraphs-plus-rule-row");
    rowEl.style.marginLeft = `${depth * 18}px`;

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
        this.renderSettings();
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
    this.addToggleTag(setting, "Glow");
    setting.addToggle((toggle) => {
      toggle
        .setTooltip("Show a soft glow around this folder node")
        .setValue(rule.glow)
        .onChange(async (value) => {
          rule.glow = value;
          await this.saveAndRefresh();
          this.renderSettings();
        });
    });

    this.addControlDivider(setting);
    this.addGlowStrengthControls(setting, rule);

    this.addControlDivider(setting);
    setting.addButton((button) => {
      button
        .setIcon("plus")
        .setTooltip("Add child folder")
        .onClick(async () => {
          rule.children.push({
            type: "folder",
            target: "",
            colorLinks: true,
            glow: false,
            glowStrength: DEFAULT_FOLDER_GLOW_STRENGTH,
            children: []
          });
          await this.saveAndRefresh();
          this.renderSettings();
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
          this.renderSettings();
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

  private addGlowStrengthControls(setting: Setting, rule: FolderColorRule | FolderColorChildRule): void {
    const strength = normalizeFolderGlowStrength(rule.glowStrength);

    setting.addButton((button) => {
      button
        .setIcon("minus")
        .setTooltip("Decrease glow strength")
        .setDisabled(!rule.glow || strength <= MIN_FOLDER_GLOW_STRENGTH)
        .onClick(async () => {
          rule.glowStrength = normalizeFolderGlowStrength(strength - 1);
          await this.saveAndRefresh();
          this.renderSettings();
        });
    });

    setting.controlEl.createSpan({
      text: String(strength),
      cls: "folderandgraphs-plus-strength-value"
    });

    setting.addButton((button) => {
      button
        .setIcon("plus")
        .setTooltip("Increase glow strength")
        .setDisabled(!rule.glow || strength >= MAX_FOLDER_GLOW_STRENGTH)
        .onClick(async () => {
          rule.glowStrength = normalizeFolderGlowStrength(strength + 1);
          await this.saveAndRefresh();
          this.renderSettings();
        });
    });
  }

  private async saveAndRefresh(): Promise<void> {
    await this.plugin.saveSettings();
    this.plugin.refreshGraphsAfterSettingsChange();
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
