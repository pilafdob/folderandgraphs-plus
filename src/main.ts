import { Plugin, PluginSettingTab, Setting, type WorkspaceLeaf } from "obsidian";
import {
  type GraphColor,
  type GraphColorGroup,
  folderPathFromNodeId,
  getFolderGroupColorForPaths
} from "./graphGroups";

const Folder2GraphBundle = require("./vendor/folders2graph/main.js") as {
  default?: new (app: FolderAndGraphsPlusPlugin["app"], manifest: FolderAndGraphsPlusPlugin["manifest"]) => Plugin;
};

const FOLDER2GRAPH_NODE_TYPE = "f2g_node";

type FolderAndGraphsPlusSettings = {
  combineSameNameFolders: boolean;
  folder2graph?: Record<string, unknown>;
};

const DEFAULT_SETTINGS: FolderAndGraphsPlusSettings = {
  combineSameNameFolders: false
};

type GraphRenderer = {
  nodes?: unknown[];
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
  __folderAndGraphsPlusOriginalGetFillColor?: () => GraphColor;
  getFillColor?: () => GraphColor;
};

type GraphNodeData = {
  type?: unknown;
  folderNode?: unknown;
  links?: Record<string, boolean>;
  [key: string]: unknown;
};

type GraphData = {
  nodes?: Record<string, GraphNodeData>;
  [key: string]: unknown;
};

export default class FolderAndGraphsPlusPlugin extends Plugin {
  settings: FolderAndGraphsPlusSettings = { ...DEFAULT_SETTINGS };
  private bundledFolder2Graph: Plugin | null = null;
  private patchedPrototype: PatchableGraphNode | null = null;
  private originalGetFillColor: (() => GraphColor) | null = null;
  private patchedGetFillColor: (() => GraphColor) | null = null;
  private colorGroups: GraphColorGroup[] = [];
  private combinedFolderPathsByNodeId = new Map<string, string[]>();

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
      return;
    }

    if (this.patchedPrototype && this.originalGetFillColor && this.patchedPrototype !== prototype) {
      this.patchedPrototype.getFillColor = this.originalGetFillColor;
      delete this.patchedPrototype.__folderAndGraphsPlusOriginalGetFillColor;
    }

    const original = prototype.getFillColor;
    this.patchedPrototype = prototype;
    this.originalGetFillColor = original;
    prototype.__folderAndGraphsPlusOriginalGetFillColor = original;

    const plugin = this;
    const patchedGetFillColor = function patchedGetFillColor(this: PatchableGraphNode): GraphColor {
      if (this.type === FOLDER2GRAPH_NODE_TYPE) {
        const folderPath = folderPathFromNodeId(this.id);
        const color = plugin.getColorForFolderPath(folderPath);
        if (color) {
          return color;
        }
      }

      return original.call(this);
    };

    this.patchedGetFillColor = patchedGetFillColor;
    prototype.getFillColor = patchedGetFillColor;
  }

  private getColorForFolderPath(folderPath: string): GraphColor | null {
    const folderPaths = this.combinedFolderPathsByNodeId.get(`/${folderPath}`) ?? [folderPath];
    return getFolderGroupColorForPaths(folderPaths, this.colorGroups);
  }

  private async loadBundledFolder2GraphIfNeeded(): Promise<void> {
    if (this.isExternalFolder2GraphEnabled()) {
      return;
    }

    const Folder2GraphPlugin = Folder2GraphBundle.default;
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
      this.settings.folder2graph =
        typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
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

    const plugin = this;
    const wrapper = function wrapper(this: GraphRenderer, data: GraphData): unknown {
      const nextData = plugin.settings.combineSameNameFolders
        ? plugin.mergeSameNameFolderNodes(data)
        : plugin.rememberSeparateFolderPaths(data);

      return original.call(this, nextData);
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

  private getFolderBasename(nodeId: string): string {
    const folderPath = folderPathFromNodeId(nodeId);
    const parts = folderPath.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
    const configDir = (this.app.vault as { configDir?: string }).configDir || ".obsidian";
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
}

class FolderAndGraphsPlusSettingTab extends PluginSettingTab {
  plugin: FolderAndGraphsPlusPlugin;

  constructor(app: FolderAndGraphsPlusPlugin["app"], plugin: FolderAndGraphsPlusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
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
          });
      });
  }
}
