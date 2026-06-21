# Changelog

## 1.5.0

- Replace floating rings with a toggleable soft glow and 1-10 strength controls.
- Scope glow to exact folder nodes so it does not apply to child notes or descendants by default.
- Ignore legacy ring counts when loading saved folder colour rules.

## 1.4.0

- Add nested folder child customizations under folder colour rules.
- Allow nested child rows to inherit parent colours while overriding rings and graph line colouring.
- Fix floating node rings so they do not multiply on redraw and can inherit to child folder notes.

## 1.0.3

- Add per-folder floating node rings with a selectable ring count in folder colour settings.
- Preserve solid node colouring while rendering rings as outlines around matching graph nodes.

## 1.0.2

- Fix split line colouring for bidirectional graph links by resolving endpoint positions from graph nodes when needed.

## 1.0.1

- Replace `Vault#getFolderByPath` with a minAppVersion-compatible folder lookup.
- Avoid internal calls to the deprecated settings tab `display()` method.

## 1.0.0

- Address Obsidian community review warnings by replacing the source `require()` import with a typed ES import.
- Remove local `this` aliasing and tighten loaded settings validation.
- Read the active Obsidian configuration folder from `Vault#configDir`.
- Remove bundled Folder2Graph browser storage access.
- Add GitHub release notes and artifact attestation generation for release assets.

## 0.3.0

- Bundle Folders to Graph 1.2.0 so Folder and Graphs Plus can create folder nodes without requiring a separate plugin install.
- Detect an existing enabled `folders2graph` plugin and avoid running a second folder-node injector.
- Apply native Obsidian Graph View group colours to Folder2Graph folder nodes.
- Add optional same-basename folder combining in the graph view.
- Keep graph rewiring visual-only; vault files, folders, and graph configuration are not rewritten.

## 0.2.0

- Add same-basename folder combining support.
- Preserve colour matching against original full folder paths when folders are visually combined.

## 0.1.0

- Initial plugin implementation.
- Match Folder2Graph folder nodes against native Obsidian `path:` graph groups.
- Support quoted paths and simple negated path terms.
