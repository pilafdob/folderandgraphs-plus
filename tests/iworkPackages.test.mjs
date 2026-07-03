import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_IWORK_PACKAGE_SETTINGS,
  getPathExtension,
  isIWorkPackagePath,
  moveIWorkPackagesFromFolderList,
  normalizeIWorkPackageGraphData,
  normalizeIWorkPackageSettings
} from "../testable/iworkPackages.mjs";

const isFolderNode = (nodeId, node) => nodeId.startsWith("/") && node?.type === "f2g_node";

test("iWork package paths are detected case-insensitively", () => {
  assert.equal(isIWorkPackagePath("English/report.pages"), true);
  assert.equal(isIWorkPackagePath("English/slides.KEY"), true);
  assert.equal(isIWorkPackagePath("English/budget.numbers"), true);
  assert.equal(isIWorkPackagePath("English/file.docx"), false);
  assert.equal(getPathExtension("English/report.pages/"), "pages");
});

test("iWork package settings default off unless explicitly enabled", () => {
  assert.deepEqual(normalizeIWorkPackageSettings(undefined), DEFAULT_IWORK_PACKAGE_SETTINGS);
  assert.deepEqual(normalizeIWorkPackageSettings({ enabled: true }), { enabled: true });
  assert.deepEqual(normalizeIWorkPackageSettings({ enabled: "yes" }), { enabled: false });
});

test("adapter folder lists expose iWork packages as files", () => {
  assert.deepEqual(moveIWorkPackagesFromFolderList({
    files: ["English/common mistakes.pdf"],
    folders: [
      "English/report.pages",
      "English/slides.key",
      "English/schoolwork"
    ]
  }), {
    files: [
      "English/common mistakes.pdf",
      "English/report.pages",
      "English/slides.key"
    ],
    folders: ["English/schoolwork"]
  });
});

test("graph package folder nodes are converted to attachment file nodes", () => {
  const data = {
    nodes: {
      "/English": {
        type: "f2g_node",
        links: {
          "/English/report.pages": true,
          "English/common mistakes.pdf": true
        }
      },
      "/English/report.pages": {
        type: "f2g_node",
        folderNode: true,
        links: {
          "/English": true,
          "/English/report.pages/Index.zip": true
        }
      },
      "/English/report.pages/Index.zip": {
        type: "f2g_node",
        links: {
          "/English/report.pages": true
        }
      },
      "English/common mistakes.pdf": {
        links: {
          "/English": true
        }
      }
    }
  };

  const normalized = normalizeIWorkPackageGraphData(data, isFolderNode);

  assert.deepEqual(Object.keys(normalized.nodes).sort(), [
    "/English",
    "English/common mistakes.pdf",
    "English/report.pages"
  ]);
  assert.equal(normalized.nodes["English/report.pages"].type, undefined);
  assert.equal(normalized.nodes["English/report.pages"].folderNode, undefined);
  assert.deepEqual(normalized.nodes["English/report.pages"].links, { "/English": true });
  assert.deepEqual(normalized.nodes["/English"].links, {
    "English/common mistakes.pdf": true,
    "English/report.pages": true
  });
});

test("existing native file nodes are merged with package folder node links", () => {
  const data = {
    nodes: {
      "/English": {
        type: "f2g_node",
        links: {
          "/English/report.pages": true
        }
      },
      "/English/report.pages": {
        type: "f2g_node",
        folderNode: true,
        links: {
          "/English": true
        }
      },
      "English/report.pages": {
        links: {
          "Notes/A.md": true
        }
      },
      "Notes/A.md": {
        links: {
          "English/report.pages": true
        }
      }
    }
  };

  const normalized = normalizeIWorkPackageGraphData(data, isFolderNode);

  assert.deepEqual(Object.keys(normalized.nodes).sort(), [
    "/English",
    "English/report.pages",
    "Notes/A.md"
  ]);
  assert.deepEqual(normalized.nodes["English/report.pages"].links, {
    "/English": true,
    "Notes/A.md": true
  });
});
