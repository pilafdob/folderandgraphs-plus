# Changelog

## 3.0.1

- Add README installation and usage notes for Obsidian community review.
- Include `styles.css` in GitHub artifact attestation coverage.
- Replace scanner-flagged direct style assignment and global document access patterns.

## 3.0.0

- Add a global Graph View folder emoji toggle that prefixes every Folder2Graph folder node label with `📁`.
- Replace parent-marker settings with per-folder `Bold` label toggles for exact configured folder nodes.
- Migrate existing per-rule parent marker settings into the new bold-label setting.
- Keep folder label markers text-only; no drawn icons, rings, glows, or Pixi marker overlays are used.
- Add tests for global emoji labels, prefix cleanup, legacy parent-marker migration, exact bold matching, and child-rule bold behavior.

## 2.0.0

- Remove the unstable ring/glow rendering feature from folder colour rules and settings.
- Add plugin graph filters directly to Obsidian's native Graph View Filters panel under Attachments.
- Add attachment filter modes for all attachments, PDF only, document files, non-media files, custom extensions, and no attachments.
- Add native-panel toggles for Folder2Graph folder nodes and canvas files while keeping Obsidian's built-in Tags, Attachments, Existing files only, and Orphans filters in control.
- Rework Graph View integration around per-leaf renderer controllers that filter after native Obsidian filters and Folder2Graph injection.
- Add graph filter and renderer patch tests covering attachment filtering, link cleanup, folder/canvas visibility, native attachment filtering, method wrapping, reinstall, and unload restore behavior.

## 1.8.0

- Keep glow radius fixed at the current strength-10 size and use strength for opacity.
- Reduce glow drawing work by replacing stacked filled circles with two stroked glow bands.

## 1.7.0

- Increase the soft glow spread so high strength values produce a visibly larger halo.
- Draw glow with more layers while keeping opacity steady.

## 1.6.0

- Make glow strength increase glow spread instead of mostly changing opacity.
- Improve folder colour settings layout so folder names remain visible with many controls.
- Add visual dividers between folder colour controls.

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
