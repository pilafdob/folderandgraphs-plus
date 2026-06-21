# Changelog

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
