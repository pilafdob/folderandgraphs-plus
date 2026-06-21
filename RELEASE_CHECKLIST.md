# Release checklist

This repo is being prepared for two steps:

1. Publish the plugin source and release artifacts on GitHub.
2. Submit the plugin to the Obsidian community plugin directory.

Nothing in this checklist has been published yet.

## Current blockers

- Initialize a Git repository or move these files into the intended GitHub repository.
- Manually test inside Obsidian on macOS, then decide whether to test Windows, Linux, Android, and iOS before submission.
- Create the GitHub repository and confirm the final repo URL. The prepared submission assumes `pilafdob/folderandgraphs-plus`.

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

Use a tag that exactly matches `manifest.json` `version`; for the current version, use `0.3.0`, not `v0.3.0`.

```bash
git tag 0.3.0
git push origin 0.3.0
```

The GitHub Action creates a draft release containing `main.js` and `manifest.json`.
Review the draft release, then publish it when ready.

## Obsidian community plugin submission

After the GitHub release is public:

1. Fork `obsidianmd/obsidian-releases`.
2. Add the entry from `OBSIDIAN_SUBMISSION.md` to `community-plugins.json`:

```json
{
  "id": "folderandgraphs-plus",
  "name": "Folder and Graphs Plus",
  "author": "pilafdob",
  "description": "Colours Folder2Graph folder nodes with matching native Graph View group colours.",
  "repo": "pilafdob/folderandgraphs-plus"
}
```

3. Open a pull request using the community plugin template.
4. Confirm the release checklist in the PR:
   - Release assets include `main.js` and `manifest.json`.
   - Release title matches the exact manifest version.
   - README explains purpose and usage.
   - Plugin id matches `community-plugins.json`.
   - License is present.
   - Any borrowed code is attributed and license-compatible.
