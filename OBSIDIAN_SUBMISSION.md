# Obsidian community plugin submission

Obsidian no longer accepts community plugin submissions through pull requests to `obsidianmd/obsidian-releases`.
Submit the plugin through the Obsidian Community directory instead.

## Submission URL

Go to:

```text
https://community.obsidian.md
```

Then:

1. Sign in with an Obsidian account.
2. Link the GitHub account `pilafdob` to the Obsidian profile.
3. Open **Plugins** in the sidebar.
4. Select **New plugin**.
5. Submit this repository URL:

```text
https://github.com/pilafdob/folderandgraphs-plus
```

## Published release

The required GitHub release must be public before submitting:

```text
https://github.com/pilafdob/folderandgraphs-plus/releases/tag/v1.0.0
```

Release assets:

- `main.js`
- `manifest.json`

## Directory metadata

The directory reads `manifest.json` from the default branch and downloads release assets from the release tag. For this release, the GitHub tag is `v1.0.0` and the Obsidian manifest version remains `1.0.0`.

Current manifest:

```json
{
  "id": "folderandgraphs-plus",
  "name": "Folder and Graphs Plus",
  "version": "1.0.0",
  "minAppVersion": "1.4.16",
  "description": "Colours Folder2Graph folder nodes with matching native Graph View group colours.",
  "author": "pilafdob",
  "isDesktopOnly": false
}
```

## Before selecting Submit

- Read and agree to the developer policies shown in the community directory.
- Confirm that the plugin will continue to be supported.
- Confirm that the release assets are present on GitHub.
- Confirm that bundled Folders to Graph code is attributed in `README.md` and `THIRD_PARTY_NOTICES.md`.
