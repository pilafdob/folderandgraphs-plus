# Release checklist

This repo is being prepared for two steps:

1. Publish the plugin source and release artifacts on GitHub.
2. Submit the plugin to the Obsidian community plugin directory.

Nothing in this checklist has been published yet.

## Current blockers

- Manually test inside Obsidian on macOS, then decide whether to test Windows, Linux, Android, and iOS before submission.
- Submit through `https://community.obsidian.md` after signing in with an Obsidian account and linking GitHub account `pilafdob`.

## Local verification before first release

```bash
npm install
npm test
npm run build
node -e "const fs=require('fs'); const pkg=require('./package.json'); const manifest=require('./manifest.json'); const versions=require('./versions.json'); if (pkg.version !== manifest.version) throw new Error('package.json and manifest.json versions differ'); if (versions[manifest.version] !== manifest.minAppVersion) throw new Error('versions.json is missing the current manifest version'); for (const file of ['main.js', 'manifest.json']) { if (!fs.existsSync(file)) throw new Error(`${file} is missing`); }"
```

After `npm run build`, install or copy these files into a test vault under:

```text
.obsidian/plugins/folderandgraphs-plus/
```

Required files:

- `main.js`
- `manifest.json`

Optional file:

- `styles.css`, if the plugin later adds styles.

## Mobile compatibility checks

- `manifest.json` has `"isDesktopOnly": false`.
- Static runtime scan should not find Electron, shell, Node filesystem, or child-process APIs.
- Core rendering should be manually tested on at least one Obsidian mobile platform before the community PR marks Android or iOS as tested.
- Keyboard-modifier interactions from bundled Folders to Graph may require a hardware keyboard on mobile; core graph rendering and colour matching should still work without them.

## GitHub first release

Use the release tag `v1.0.0` for the current version.

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Action creates a draft release containing `main.js` and `manifest.json`.
Review the draft release, then publish it when ready.

## Obsidian community plugin submission

After the GitHub release is public, use `OBSIDIAN_SUBMISSION.md`.

Do not use the old pull request flow for `obsidianmd/obsidian-releases`; pull requests are disabled there.

Submit this repository URL in the web form:

```text
https://github.com/pilafdob/folderandgraphs-plus
```
