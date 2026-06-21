import assert from "node:assert/strict";
import test from "node:test";

import {
  folderPathFromNodeId,
  folderPathMatchesGroupQuery,
  getDeepestFolderColorForPaths,
  getFolderColorForPaths,
  getFolderColorRuleColor,
  getFolderColorRuleVisual,
  getFolderColorStackForPaths,
  getFolderVisualForPaths,
  getGraphLinkColorDecision,
  getGraphNodePluginColors,
  getFolderGroupColor,
  getFolderGroupColorForPaths,
  normalizeFolderGlowStrength,
  parseHexGraphColor
} from "../testable/graphGroups.mjs";

test("folder node id is normalized to full vault-relative path", () => {
  assert.equal(folderPathFromNodeId("/Wiki/Dustcore/"), "Wiki/Dustcore");
});

test("People matches path:People", () => {
  assert.equal(folderPathMatchesGroupQuery("People", "path:People"), true);
});

test("Dev matches path:Dev", () => {
  assert.equal(folderPathMatchesGroupQuery("Dev", "path:Dev"), true);
});

test("Projects/Web matches path:Projects", () => {
  assert.equal(folderPathMatchesGroupQuery("Projects/Web", "path:Projects"), true);
});

test("Projects/Web matches path:Projects/Web", () => {
  assert.equal(folderPathMatchesGroupQuery("Projects/Web", "path:Projects/Web"), true);
});

test("Wiki/Dustcore matches path:Wiki/Dustcore", () => {
  assert.equal(folderPathMatchesGroupQuery("Wiki/Dustcore", "path:Wiki/Dustcore"), true);
});

test("quoted path rules are supported", () => {
  assert.equal(folderPathMatchesGroupQuery("Wiki/Dustcore", 'path:"Wiki/Dustcore"'), true);
});

test("Archive does not match path:Dev", () => {
  assert.equal(folderPathMatchesGroupQuery("Archive", "path:Dev"), false);
});

test("first matching group wins", () => {
  const groups = [
    { query: "path:Projects", color: { a: 1, rgb: 111 } },
    { query: "path:Projects/Web", color: { a: 1, rgb: 222 } }
  ];

  assert.deepEqual(getFolderGroupColor("Projects/Web", groups), { a: 1, rgb: 111 });
});

test("combined folder paths still use first matching group", () => {
  const groups = [
    { query: "path:TeamB/Overview", color: { a: 1, rgb: 111 } },
    { query: "path:TeamA/Overview", color: { a: 1, rgb: 222 } }
  ];

  assert.deepEqual(getFolderGroupColorForPaths(["TeamA/Overview", "TeamB/Overview"], groups), { a: 1, rgb: 111 });
});

test("simple negated path terms exclude matches", () => {
  assert.equal(folderPathMatchesGroupQuery("Projects/Archive", "path:Projects -path:Projects/Archive"), false);
});

test("valid hex colours convert to Obsidian graph colours", () => {
  assert.deepEqual(parseHexGraphColor("#5c8af5"), { a: 1, rgb: 6064885 });
});

test("invalid hex colours are ignored", () => {
  assert.equal(parseHexGraphColor("5c8af5"), null);
  assert.equal(parseHexGraphColor("#12345"), null);
  assert.equal(parseHexGraphColor("#12345g"), null);
});

test("folder glow strength is clamped to the supported range", () => {
  assert.equal(normalizeFolderGlowStrength("3"), 3);
  assert.equal(normalizeFolderGlowStrength(-1), 1);
  assert.equal(normalizeFolderGlowStrength(99), 10);
  assert.equal(normalizeFolderGlowStrength("nope"), 3);
});

test("combined folder basename rule applies to matching folder paths", () => {
  const rules = [{ type: "combined", target: "Daily", color: "#ff0000" }];

  assert.deepEqual(
    getFolderColorRuleColor(["Projects/Daily", "Archive/Daily"], rules),
    { a: 1, rgb: 16711680 }
  );
});

test("combined folder basename rule applies to files inside same-name folders", () => {
  const rules = [{ type: "combined", target: "Daily", color: "#ff0000" }];

  assert.deepEqual(getFolderColorRuleColor(["Projects/Daily"], rules), { a: 1, rgb: 16711680 });
});

test("normal folder rule applies to descendants by full path", () => {
  const rules = [{ type: "folder", target: "Projects", color: "#00ff00" }];

  assert.deepEqual(getFolderColorRuleColor(["Projects/Daily"], rules), { a: 1, rgb: 65280 });
});

test("parent folder rule applies to child-folder file nodes when inheritance is enabled", () => {
  const rules = [{ type: "folder", target: "Physics", color: "#0000ff", inheritToChildren: true }];

  assert.deepEqual(getFolderColorRuleColor(["Physics/Studying"], rules, "fileNode"), { a: 1, rgb: 255 });
});

test("inherited parent folder colour beats combined child folder colour for file nodes", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000", inheritToChildren: true },
    { type: "combined", target: "studying", color: "#00ff00", inheritToChildren: true }
  ];

  assert.deepEqual(getFolderColorRuleColor(["Biology/studying"], rules, "fileNode"), { a: 1, rgb: 16711680 });
});

test("parent folder rule does not apply to child-folder file nodes when inheritance is disabled", () => {
  const rules = [{ type: "folder", target: "Physics", color: "#0000ff", inheritToChildren: false }];

  assert.equal(getFolderColorRuleColor(["Physics/Studying"], rules, "fileNode"), null);
});

test("direct file parent folder colour applies when inheritance is disabled", () => {
  const rules = [{ type: "folder", target: "Physics", color: "#0000ff", inheritToChildren: false }];

  assert.deepEqual(getFolderColorRuleColor(["Physics"], rules, "fileNode"), { a: 1, rgb: 255 });
});

test("normal folder rule does not match same basename elsewhere", () => {
  const rules = [{ type: "folder", target: "Projects/Daily", color: "#00ff00" }];

  assert.equal(getFolderColorRuleColor(["Archive/Daily"], rules), null);
});

test("first duplicate folder colour rule wins", () => {
  const rules = [
    { type: "combined", target: "Daily", color: "#111111" },
    { type: "combined", target: "Daily", color: "#222222" }
  ];

  assert.deepEqual(
    getFolderColorRuleColor(["Projects/Daily", "Archive/Daily"], rules),
    { a: 1, rgb: 1118481 }
  );
});

test("old saved ring counts do not enable glow", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000", inheritToChildren: true, rings: 2 },
    { type: "combined", target: "studying", color: "#00ff00", inheritToChildren: true, rings: 5 }
  ];

  assert.deepEqual(getFolderColorRuleVisual(["Biology"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
});

test("top-level glow applies only to exact folder nodes", () => {
  const rules = [{
    type: "folder",
    target: "Biology",
    color: "#ff0000",
    inheritToChildren: true,
    glow: true,
    glowStrength: 7
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 7
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology"], rules, "fileNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
});

test("combined folder glow applies only to exact combined folder nodes", () => {
  const rules = [{
    type: "combined",
    target: "Studying",
    color: "#ff0000",
    inheritToChildren: true,
    glow: true,
    glowStrength: 4
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 4
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying/Exams"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
});

test("nested normal child rule matches only inside its parent scope", () => {
  const rules = [{
    type: "folder",
    target: "Biology",
    color: "#ff0000",
    inheritToChildren: true,
    glow: false,
    glowStrength: 3,
    children: [{ type: "folder", target: "Studying", colorLinks: true, glow: true, glowStrength: 5, children: [] }]
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying"], rules, "fileNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 5
  });
  assert.equal(getFolderColorRuleVisual(["Physics/Studying"], rules, "fileNode"), null);
});

test("nested combined child rule matches same basename only inside parent scope", () => {
  const rules = [{
    type: "folder",
    target: "Biology",
    color: "#ff0000",
    inheritToChildren: true,
    glow: false,
    glowStrength: 3,
    children: [{ type: "combined", target: "Studying", colorLinks: true, glow: true, glowStrength: 6, children: [] }]
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Archive/Studying"], rules, "fileNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology/Archive/Studying"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 6
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology/Archive/Reading"], rules, "fileNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
});

test("child under combined parent applies under each matching parent basename", () => {
  const rules = [{
    type: "combined",
    target: "Studying",
    color: "#ff0000",
    inheritToChildren: true,
    glow: false,
    glowStrength: 3,
    children: [{ type: "folder", target: "Schoolwork", colorLinks: true, glow: true, glowStrength: 6, children: [] }]
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying/Schoolwork"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 6
  });
  assert.deepEqual(getFolderColorRuleVisual(["Physics/Studying/Schoolwork"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 6
  });
});

test("nested grandchild rule controls its own exact glow and line colouring", () => {
  const rules = [{
    type: "folder",
    target: "Biology",
    color: "#ff0000",
    inheritToChildren: true,
    colorLinks: true,
    glow: false,
    glowStrength: 3,
    children: [{
      type: "folder",
      target: "Studying",
      colorLinks: true,
      glow: true,
      glowStrength: 5,
      children: [{ type: "folder", target: "Exams", colorLinks: false, glow: true, glowStrength: 8, children: [] }]
    }]
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying/Exams"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: false,
    glow: true,
    glowStrength: 8
  });
  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying/Exams/Final"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: false,
    glow: false,
    glowStrength: 3
  });
});

test("nested child rule inherits ancestor colour over global child folder colour", () => {
  const rules = [
    {
      type: "folder",
      target: "Biology",
      color: "#ff0000",
      inheritToChildren: true,
      glow: false,
      glowStrength: 3,
      children: [{ type: "folder", target: "Studying", colorLinks: true, glow: true, glowStrength: 5, children: [] }]
    },
    { type: "folder", target: "Biology/Studying", color: "#00ff00", inheritToChildren: true, glow: false, glowStrength: 3 }
  ];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying"], rules, "folderNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: true,
    glowStrength: 5
  });
});

test("explicit child rule can match when parent child-note inheritance is disabled", () => {
  const rules = [{
    type: "folder",
    target: "Biology",
    color: "#ff0000",
    inheritToChildren: false,
    glow: false,
    glowStrength: 3,
    children: [{ type: "folder", target: "Studying", colorLinks: true, glow: true, glowStrength: 5, children: [] }]
  }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology/Studying"], rules, "fileNode"), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
  assert.equal(getFolderColorRuleVisual(["Biology/Lab"], rules, "fileNode"), null);
});

test("folder colour rule visual defaults missing glow settings to off", () => {
  const rules = [{ type: "folder", target: "Biology", color: "#ff0000" }];

  assert.deepEqual(getFolderColorRuleVisual(["Biology"], rules), {
    color: { a: 1, rgb: 16711680 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
});

test("folder colour rules override native graph group colour", () => {
  const groups = [{ query: "path:Projects", color: { a: 1, rgb: 333 } }];
  const rules = [{ type: "folder", target: "Projects", color: "#ff0000" }];

  assert.deepEqual(getFolderColorForPaths(["Projects/Weekly"], groups, rules), { a: 1, rgb: 16711680 });
});

test("folder colour falls back to native graph group colour without rule match", () => {
  const groups = [{ query: "path:Projects", color: { a: 1, rgb: 333 } }];
  const rules = [{ type: "combined", target: "Daily", color: "#ff0000" }];

  assert.deepEqual(getFolderColorForPaths(["Projects/Weekly", "Archive/Weekly"], groups, rules), { a: 1, rgb: 333 });
});

test("folder visual fallback uses native colour with no glow", () => {
  const groups = [{ query: "path:Projects", color: { a: 1, rgb: 333 } }];
  const rules = [{ type: "combined", target: "Daily", color: "#ff0000", glow: true, glowStrength: 4 }];

  assert.deepEqual(getFolderVisualForPaths(["Projects/Weekly"], groups, rules), {
    color: { a: 1, rgb: 333 },
    colorLinks: true,
    glow: false,
    glowStrength: 3
  });
});

test("folder colour stack returns parent and child colours in hierarchy order", () => {
  const rules = [
    { type: "combined", target: "Studying", color: "#00ff00" },
    { type: "folder", target: "Biology", color: "#ff0000" }
  ];

  assert.deepEqual(getFolderColorStackForPaths(["Biology/Studying"], rules), [
    { a: 1, rgb: 16711680 },
    { a: 1, rgb: 65280 }
  ]);
});

test("folder colour stack includes multiple specified ancestors from parent to child", () => {
  const rules = [
    { type: "folder", target: "Biology/Studying", color: "#00ff00" },
    { type: "folder", target: "Biology", color: "#ff0000" },
    { type: "folder", target: "Biology/Studying/Audio", color: "#0000ff" }
  ];

  assert.deepEqual(getFolderColorStackForPaths(["Biology/Studying/Audio"], rules), [
    { a: 1, rgb: 16711680 },
    { a: 1, rgb: 65280 },
    { a: 1, rgb: 255 }
  ]);
});

test("folder colour stack collapses duplicate rule targets", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000" },
    { type: "folder", target: "Biology", color: "#00ff00" }
  ];

  assert.deepEqual(getFolderColorStackForPaths(["Biology/Studying"], rules), [
    { a: 1, rgb: 16711680 }
  ]);
});

test("solid folder colour uses nearest matching folder rule", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000" },
    { type: "combined", target: "Studying", color: "#00ff00" }
  ];

  assert.deepEqual(getFolderColorForPaths(["Biology/Studying"], [], rules), { a: 1, rgb: 65280 });
});

test("folder node colour ignores child-note inheritance toggle", () => {
  const rules = [{ type: "folder", target: "Biology", color: "#ff0000", inheritToChildren: false }];

  assert.deepEqual(getFolderColorForPaths(["Biology/Studying"], [], rules, "folderNode"), { a: 1, rgb: 16711680 });
});

test("deepest folder colour selects child-most rule", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000" },
    { type: "combined", target: "Studying", color: "#00ff00" }
  ];

  assert.deepEqual(getDeepestFolderColorForPaths(["Biology/Studying"], rules), { a: 1, rgb: 65280 });
});

test("graph node plugin colours use endpoint node colour rules", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000", inheritToChildren: true },
    { type: "folder", target: "Physics", color: "#0000ff", inheritToChildren: true },
    { type: "folder", target: "Uninherited", color: "#00ff00", inheritToChildren: false }
  ];
  const nodes = {
    "Biology/Studying/spoken exam.md": { links: { "Physics/Studying/forces.md": true } },
    "Physics/Studying/forces.md": { links: { "Biology/Studying/spoken exam.md": true } },
    "Uninherited/Child/plain.md": { links: { "Physics/Studying/forces.md": true } }
  };
  const folders = {
    "Biology/Studying/spoken exam.md": ["Biology/Studying"],
    "Physics/Studying/forces.md": ["Physics/Studying"],
    "Uninherited/Child/plain.md": ["Uninherited/Child"]
  };

  const colors = getGraphNodePluginColors(
    nodes,
    rules,
    (nodeId) => folders[nodeId] ?? [],
    () => false
  );

  assert.deepEqual(colors.get("Biology/Studying/spoken exam.md"), { a: 1, rgb: 16711680 });
  assert.deepEqual(colors.get("Physics/Studying/forces.md"), { a: 1, rgb: 255 });
  assert.equal(colors.has("Uninherited/Child/plain.md"), false);
});

test("graph node plugin colours can omit rules disabled for line colouring", () => {
  const rules = [
    { type: "folder", target: "Biology", color: "#ff0000", inheritToChildren: true, colorLinks: false },
    { type: "folder", target: "Physics", color: "#0000ff", inheritToChildren: true, colorLinks: true }
  ];
  const nodes = {
    "Biology/studying/spoken exam.md": { links: { "Physics/Studying/forces.md": true } },
    "Physics/Studying/forces.md": { links: { "Biology/studying/spoken exam.md": true } }
  };
  const folders = {
    "Biology/studying/spoken exam.md": ["Biology/studying"],
    "Physics/Studying/forces.md": ["Physics/Studying"]
  };

  const colors = getGraphNodePluginColors(
    nodes,
    rules,
    (nodeId) => folders[nodeId] ?? [],
    () => false
  );

  assert.equal(colors.has("Biology/studying/spoken exam.md"), false);
  assert.deepEqual(colors.get("Physics/Studying/forces.md"), { a: 1, rgb: 255 });
});

test("graph node plugin colours respect nested line-colouring overrides", () => {
  const rules = [{
    type: "folder",
    target: "Biology",
    color: "#ff0000",
    inheritToChildren: true,
    colorLinks: true,
    children: [{ type: "folder", target: "Studying", colorLinks: false, glow: false, glowStrength: 3, children: [] }]
  }];
  const nodes = {
    "Biology/Studying/spoken exam.md": { links: { "Biology/Lab/report.md": true } },
    "Biology/Lab/report.md": { links: { "Biology/Studying/spoken exam.md": true } }
  };
  const folders = {
    "Biology/Studying/spoken exam.md": ["Biology/Studying"],
    "Biology/Lab/report.md": ["Biology/Lab"]
  };

  const colors = getGraphNodePluginColors(
    nodes,
    rules,
    (nodeId) => folders[nodeId] ?? [],
    () => false
  );

  assert.equal(colors.has("Biology/Studying/spoken exam.md"), false);
  assert.deepEqual(colors.get("Biology/Lab/report.md"), { a: 1, rgb: 16711680 });
});

test("link colour decision splits different endpoint colours", () => {
  assert.deepEqual(
    getGraphLinkColorDecision({ a: 1, rgb: 16711680 }, { a: 1, rgb: 255 }),
    {
      type: "split",
      sourceColor: { a: 1, rgb: 16711680 },
      targetColor: { a: 1, rgb: 255 }
    }
  );
});

test("link colour decision uses solid colour for matching or single endpoint colours", () => {
  assert.deepEqual(
    getGraphLinkColorDecision({ a: 1, rgb: 16711680 }, { a: 1, rgb: 16711680 }),
    { type: "solid", color: { a: 1, rgb: 16711680 } }
  );
  assert.deepEqual(
    getGraphLinkColorDecision(null, { a: 1, rgb: 255 }),
    { type: "solid", color: { a: 1, rgb: 255 } }
  );
});

test("link colour decision leaves uncoloured links at default", () => {
  assert.deepEqual(getGraphLinkColorDecision(null, null), { type: "default" });
});
