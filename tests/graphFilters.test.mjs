import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GRAPH_FILTER_SETTINGS,
  applyGraphFilters,
  normalizeAttachmentExtensions,
  normalizeAttachmentFolderRules,
  normalizeGraphFilterSettings,
  removeRootFolderNode,
  shouldShowAttachmentFolder,
  shouldShowGraphNode
} from "../testable/graphFilters.mjs";

const isFolderNode = (nodeId, node) => nodeId.startsWith("/") && node?.type === "f2g_node";

test("disabled graph filters leave data untouched", () => {
  const data = {
    nodes: {
      "Notes/A.md": { links: { "Attachments/file.pdf": true } },
      "Attachments/file.pdf": { links: { "Notes/A.md": true } }
    }
  };

  assert.equal(applyGraphFilters(data, DEFAULT_GRAPH_FILTER_SETTINGS, isFolderNode), data);
});

test("root folder node is removed and links to it are cleaned independently of graph filters", () => {
  const data = {
    nodes: {
      "/": { type: "f2g_node", links: { "/Biology": true, "Notes/A.md": true } },
      "/Biology": { type: "f2g_node", links: { "/": true, "Notes/A.md": true } },
      "Notes/A.md": { links: { "/": true, "/Biology": true } }
    }
  };

  const filtered = removeRootFolderNode(data, isFolderNode);

  assert.deepEqual(Object.keys(filtered.nodes).sort(), ["/Biology", "Notes/A.md"]);
  assert.deepEqual(filtered.nodes["/Biology"].links, { "Notes/A.md": true });
  assert.deepEqual(filtered.nodes["Notes/A.md"].links, { "/Biology": true });
});

test("show-only attachment extensions keep only matching attachments and clean links", () => {
  const data = {
    nodes: {
      "/Attachments": { type: "f2g_node", links: { "Attachments/file.pdf": true, "Attachments/image.png": true } },
      "Notes/A.md": { links: { "Attachments/file.pdf": true, "Attachments/image.png": true } },
      "Attachments/file.pdf": { links: { "Notes/A.md": true } },
      "Attachments/image.png": { links: { "Notes/A.md": true } },
      "#school": { type: "tag", links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      showTags: false,
      attachmentMode: "custom",
      attachmentExtensions: ["pdf"]
    },
    isFolderNode
  );

  assert.deepEqual(Object.keys(filtered.nodes).sort(), [
    "/Attachments",
    "Attachments/file.pdf",
    "Notes/A.md"
  ]);
  assert.deepEqual(filtered.nodes["Notes/A.md"].links, { "Attachments/file.pdf": true });
  assert.deepEqual(filtered.nodes["/Attachments"].links, { "Attachments/file.pdf": true });
});

test("hide-listed attachment extensions remove matching attachments and clean links", () => {
  const data = {
    nodes: {
      "/Attachments": {
        type: "f2g_node",
        links: {
          "Attachments/file.pdf": true,
          "Attachments/image.png": true,
          "Attachments/photo.jpg": true
        }
      },
      "Notes/A.md": {
        links: {
          "Attachments/file.pdf": true,
          "Attachments/image.png": true,
          "Attachments/photo.jpg": true
        }
      },
      "Attachments/file.pdf": { links: { "Notes/A.md": true } },
      "Attachments/image.png": { links: { "Notes/A.md": true } },
      "Attachments/photo.jpg": { links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      attachmentMode: "hide-custom",
      attachmentExtensions: ["jpg", "png"]
    },
    isFolderNode
  );

  assert.deepEqual(Object.keys(filtered.nodes).sort(), [
    "/Attachments",
    "Attachments/file.pdf",
    "Notes/A.md"
  ]);
  assert.deepEqual(filtered.nodes["Notes/A.md"].links, { "Attachments/file.pdf": true });
  assert.deepEqual(filtered.nodes["/Attachments"].links, { "Attachments/file.pdf": true });
});

test("pdf attachment mode keeps pdf attachments only", () => {
  const data = {
    nodes: {
      "Notes/A.md": { links: { "Attachments/file.pdf": true, "Attachments/slides.pptx": true, "Attachments/image.png": true } },
      "Attachments/file.pdf": { links: { "Notes/A.md": true } },
      "Attachments/slides.pptx": { links: { "Notes/A.md": true } },
      "Attachments/image.png": { links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      attachmentMode: "pdf"
    },
    isFolderNode
  );

  assert.deepEqual(Object.keys(filtered.nodes).sort(), ["Attachments/file.pdf", "Notes/A.md"]);
});

test("empty attachment folder rules preserve current attachment filtering behavior", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "pdf",
    attachmentFolderRules: []
  };

  assert.equal(shouldShowGraphNode("Attachments/file.pdf", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Other/file.pdf", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/image.png", {}, settings, isFolderNode), false);
});

test("pdf attachment mode plus folder rules keeps only matching folder pdfs and cleans links", () => {
  const data = {
    nodes: {
      "Notes/A.md": {
        links: {
          "Attachments/file.pdf": true,
          "Attachments/image.png": true,
          "Other/file.pdf": true
        }
      },
      "Attachments/file.pdf": { links: { "Notes/A.md": true } },
      "Attachments/image.png": { links: { "Notes/A.md": true } },
      "Other/file.pdf": { links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      attachmentMode: "pdf",
      attachmentFolderRules: [{ type: "folder", target: "Attachments" }]
    },
    isFolderNode
  );

  assert.deepEqual(Object.keys(filtered.nodes).sort(), ["Attachments/file.pdf", "Notes/A.md"]);
  assert.deepEqual(filtered.nodes["Notes/A.md"].links, { "Attachments/file.pdf": true });
});

test("attachment folder path rules include descendants", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    attachmentFolderRules: [{ type: "folder", target: "Attachments" }]
  };

  assert.equal(shouldShowAttachmentFolder("Attachments/file.pdf", settings), true);
  assert.equal(shouldShowAttachmentFolder("Attachments/sub/file.pdf", settings), true);
  assert.equal(shouldShowAttachmentFolder("Other/Attachments/file.pdf", settings), false);
});

test("combined attachment folder rules match same-basename folders anywhere", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    attachmentFolderRules: [{ type: "combined", target: "ebooks" }]
  };

  assert.equal(shouldShowAttachmentFolder("Biology/ebooks/file.pdf", settings), true);
  assert.equal(shouldShowAttachmentFolder("English/ebooks/file.pdf", settings), true);
  assert.equal(shouldShowAttachmentFolder("Biology/documents/file.pdf", settings), false);
});

test("attachment mode none hides attachments even when folder rules exist", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "none",
    attachmentFolderRules: [{ type: "folder", target: "Attachments" }]
  };

  assert.equal(shouldShowGraphNode("Attachments/file.pdf", {}, settings, isFolderNode), false);
});

test("document and hide-media attachment modes keep useful non-media files", () => {
  const documentSettings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "documents"
  };
  const hideMediaSettings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "hide-media"
  };

  assert.equal(shouldShowGraphNode("Attachments/file.pdf", {}, documentSettings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/sheet.xlsx", {}, documentSettings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/image.png", {}, documentSettings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("Attachments/book.epub", {}, hideMediaSettings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/video.mp4", {}, hideMediaSettings, isFolderNode), false);
});

test("attachment mode none hides all non-note files but keeps canvases separately", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "none"
  };

  assert.equal(shouldShowGraphNode("Notes/A.md", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Boards/Map.canvas", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/file.pdf", {}, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("Attachments/image.png", {}, settings, isFolderNode), false);
});

test("empty hide-listed attachment list hides nothing", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "hide-custom",
    attachmentExtensions: []
  };

  assert.equal(shouldShowGraphNode("Attachments/file.pdf", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/image.png", {}, settings, isFolderNode), true);
});

test("empty show-only attachment list hides all attachments", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "custom",
    attachmentExtensions: []
  };

  assert.equal(shouldShowGraphNode("Notes/A.md", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Boards/Map.canvas", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("Attachments/file.pdf", {}, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("Attachments/image.png", {}, settings, isFolderNode), false);
});

test("saved disabled attachment filter values remain disabled", () => {
  const data = {
    nodes: {
      "Notes/A.md": { links: { "Attachments/file.pdf": true, "Attachments/image.png": true } },
      "Attachments/file.pdf": { links: { "Notes/A.md": true } },
      "Attachments/image.png": { links: { "Notes/A.md": true } }
    }
  };
  const settings = normalizeGraphFilterSettings({
    enabled: false,
    attachmentMode: "custom",
    attachmentExtensions: ".pdf"
  });

  assert.equal(settings.enabled, false);
  assert.equal(applyGraphFilters(data, settings, isFolderNode), data);
});

test("custom attachment filters do not re-add attachments removed by native filters", () => {
  const data = {
    nodes: {
      "Notes/A.md": { links: { "Notes/B.md": true } },
      "Notes/B.md": { links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      attachmentMode: "pdf"
    },
    isFolderNode
  );

  assert.deepEqual(filtered, data);
});

test("filtered graph keeps empty link objects for Folder2Graph compatibility", () => {
  const data = {
    nodes: {
      "Notes/A.md": { links: { "Attachments/image.png": true } },
      "Notes/B.md": {},
      "Attachments/image.png": { links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      attachmentMode: "hide-custom",
      attachmentExtensions: ["png"]
    },
    isFolderNode
  );

  assert.deepEqual(filtered.nodes["Notes/A.md"].links, {});
  assert.deepEqual(filtered.nodes["Notes/B.md"].links, {});
});

test("attachment-like folder nodes from macOS packages obey attachment extension filters", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    attachmentMode: "custom",
    attachmentExtensions: ["pdf"]
  };

  assert.equal(shouldShowGraphNode("/English/report.pages", { type: "f2g_node" }, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("/English/report.pages/Metadata", { type: "f2g_node" }, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("/English/report.pdf", { type: "f2g_node" }, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("/English/schoolwork", { type: "f2g_node" }, settings, isFolderNode), true);
});

test("folder nodes and canvases can be hidden independently", () => {
  const settings = {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    showFolders: false,
    showCanvases: false
  };

  assert.equal(shouldShowGraphNode("/Biology", { type: "f2g_node" }, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("Boards/Map.canvas", {}, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("Notes/A.md", {}, settings, isFolderNode), true);
});

test("hide orphans removes nodes with no visible links after filtering", () => {
  const data = {
    nodes: {
      "Notes/A.md": { links: { "Notes/B.md": true, "Attachments/image.png": true } },
      "Notes/B.md": { links: { "Notes/A.md": true } },
      "Notes/C.md": {},
      "Attachments/image.png": { links: { "Notes/A.md": true } }
    }
  };

  const filtered = applyGraphFilters(
    data,
    {
      ...DEFAULT_GRAPH_FILTER_SETTINGS,
      enabled: true,
      attachmentMode: "none",
      hideOrphans: true
    },
    isFolderNode
  );

  assert.deepEqual(Object.keys(filtered.nodes).sort(), ["Notes/A.md", "Notes/B.md"]);
});

test("graph filter settings and extension lists are normalized", () => {
  assert.deepEqual(normalizeAttachmentExtensions([".PDF", "pdf", "png", "bad ext", 4]), ["pdf", "png"]);
  assert.deepEqual(normalizeAttachmentExtensions(".JPG, jpg .PNG bad-ext"), ["jpg", "png"]);
  assert.deepEqual(normalizeAttachmentExtensions(undefined), []);
  assert.deepEqual(normalizeAttachmentFolderRules([
    { type: "folder", target: "/Attachments/" },
    { type: "folder", target: "Attachments" },
    { type: "combined", target: "Biology/ebooks" },
    { type: "combined", target: "ebooks" },
    { type: "folder", target: "" },
    { type: "bad", target: "Attachments" },
    null
  ]), [
    { type: "folder", target: "Attachments" },
    { type: "combined", target: "ebooks" }
  ]);
  assert.deepEqual(normalizeGraphFilterSettings({
    enabled: true,
    showNotes: false,
    attachmentMode: "hide-custom",
    attachmentExtensions: ".PDF, epub png",
    attachmentFolderRules: [
      { type: "folder", target: "Attachments" },
      { type: "combined", target: "English/ebooks" }
    ],
    hideOrphans: true
  }), {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    showNotes: false,
    attachmentMode: "hide-custom",
    attachmentExtensions: ["epub", "pdf", "png"],
    attachmentFolderRules: [
      { type: "folder", target: "Attachments" },
      { type: "combined", target: "ebooks" }
    ],
    hideOrphans: true
  });
  assert.equal(normalizeGraphFilterSettings({ attachmentMode: "selected" }).attachmentMode, "custom");
  assert.equal(normalizeGraphFilterSettings({ attachmentMode: "hide-custom" }).attachmentMode, "hide-custom");
});

test("active saved filter controls do not force stale disabled state back on", () => {
  const data = {
    nodes: {
      "English/ebooks/book.pdf": { links: { "English/ebooks/archive.zip": true } },
      "English/homework/book.pdf": { links: { "English/ebooks/book.pdf": true } },
      "English/ebooks/archive.zip": { links: { "English/ebooks/book.pdf": true } }
    }
  };
  const settings = normalizeGraphFilterSettings({
    enabled: false,
    attachmentMode: "pdf",
    attachmentFolderRules: [{ type: "combined", target: "ebooks" }]
  });

  assert.equal(settings.enabled, false);
  assert.equal(applyGraphFilters(data, settings, isFolderNode), data);
});

test("enabled saved filter controls still apply when explicitly enabled", () => {
  const settings = normalizeGraphFilterSettings({
    enabled: true,
    attachmentMode: "pdf",
    attachmentFolderRules: [{ type: "combined", target: "ebooks" }]
  });

  assert.equal(settings.enabled, true);
  assert.equal(shouldShowGraphNode("English/ebooks/book.pdf", {}, settings, isFolderNode), true);
  assert.equal(shouldShowGraphNode("English/homework/book.pdf", {}, settings, isFolderNode), false);
  assert.equal(shouldShowGraphNode("English/ebooks/archive.zip", {}, settings, isFolderNode), false);
});
