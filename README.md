# Folder and Graphs Plus

An Obsidian helper plugin that colours Folder2Graph folder nodes with matching native Graph View group colours.

## Requirements

- Obsidian 1.4.16 or newer.
- Folder2Graph is bundled into this plugin. You do not need to install the original Folder2Graph / Folders to Graph plugin separately.
- If the original `folders2graph` plugin is already enabled, this plugin detects it and only applies the extra colour and same-name-folder behavior, avoiding a second folder-node injector.

## Behaviour

- Detects Folder2Graph synthetic folder nodes with `type === "f2g_node"`.
- Uses the bundled Folder2Graph implementation when the original plugin is not enabled.
- Derives the full folder path from the node id. For example, `/Wiki/Dustcore` becomes `Wiki/Dustcore`.
- Reads native graph `colorGroups` from an open graph view when available, then falls back to `.obsidian/graph.json`.
- Applies the first matching group colour.
- Optionally combines folder nodes that share the same basename.
- Applies colour and same-name-folder changes only to the graph view's render data. It does not rename, move, merge, or rewrite vault files or folders.
- Falls back to Folder2Graph's existing/default folder colour when no group matches.

## Usage

1. Create native Obsidian graph groups that use `path:` queries.
2. Enable Folder and Graphs Plus.
3. Open the graph view.

Folder2Graph folder nodes whose full folder path matches a native graph group will use that group's colour.

The plugin settings include **Combine folders with the same name**. It is disabled by default, so folders remain separate by full path. When enabled, folders that share a basename are shown as one graph node while preserving colour matching against their original full paths.

Persistent plugin settings are stored by Obsidian in this plugin's hidden `.obsidian/plugins/folderandgraphs-plus/data.json` file. Runtime graph-node rewiring used for visual display is not written back to vault notes, folders, or Obsidian graph config.

## Mobile

Folder and Graphs Plus is marked as mobile-compatible and avoids Electron, shell, and filesystem APIs. Core graph-node creation, graph-group colouring, and same-name-folder combining are intended to work on Obsidian desktop and mobile.

Some bundled Folders to Graph interactions are keyboard-modifier based. On mobile, those interactions require a hardware keyboard or may be unavailable, but the graph rendering and colour matching do not depend on them.

## Matching

The plugin supports path-focused graph group queries:

- `path:People`
- `path:Dev`
- `path:Projects`
- `path:Projects/Web`
- `path:"Wiki/Dustcore"`
- simple negation such as `path:Projects -path:Projects/Archive`

It intentionally does not try to fully reimplement Obsidian's complete graph search language for synthetic folder nodes. Complex non-path group queries continue to apply to native file nodes only.

## Manual installation

Copy the following files into `.obsidian/plugins/folderandgraphs-plus/` in your vault:

- `main.js`
- `manifest.json`

Then reload Obsidian and enable the plugin in community plugin settings.

## Bundled Folder2Graph archive

The original Folder2Graph files are kept in `vendor/folders2graph/` for archival purposes. The runtime build imports `src/vendor/folders2graph/main.js`, which is a copy of the original Folder2Graph `main.js` bundle.

Folders to Graph is copyright (c) 2024 Lucas Bastian and licensed under the MIT License. See `THIRD_PARTY_NOTICES.md` for the full notice.

## Development

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

## Testing

Run:

```bash
npm test
```

## Credits

Developed by the bltrsh© team, @pilafdob.

Visit us at https://bubbletrash.com.
