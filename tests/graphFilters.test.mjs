import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GRAPH_FILTER_SETTINGS,
  applyGraphFilters,
  normalizeAttachmentExtensions,
  normalizeGraphFilterSettings,
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

test("selected attachment extensions keep only matching attachments and clean links", () => {
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
  assert.deepEqual(normalizeGraphFilterSettings({
    enabled: true,
    showNotes: false,
    attachmentMode: "custom",
    attachmentExtensions: ".PDF, epub png",
    hideOrphans: true
  }), {
    ...DEFAULT_GRAPH_FILTER_SETTINGS,
    enabled: true,
    showNotes: false,
    attachmentMode: "custom",
    attachmentExtensions: ["epub", "pdf", "png"],
    hideOrphans: true
  });
  assert.equal(normalizeGraphFilterSettings({ attachmentMode: "selected" }).attachmentMode, "custom");
});
