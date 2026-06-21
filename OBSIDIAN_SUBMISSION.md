# Obsidian community plugin submission

Use this after the GitHub repository exists and the `0.3.0` release is public.

## `community-plugins.json` entry

```json
{
  "id": "folderandgraphs-plus",
  "name": "Folder and Graphs Plus",
  "author": "pilafdob",
  "description": "Colours Folder2Graph folder nodes with matching native Graph View group colours.",
  "repo": "pilafdob/folderandgraphs-plus"
}
```

## PR checklist notes

- Tested locally with `npm test`.
- Production bundle generated with `npm run build`.
- Static mobile compatibility audit found no Electron, shell, Node filesystem, or child-process runtime APIs.
- GitHub release must contain individual `main.js` and `manifest.json` files.
- GitHub release name/tag must be exactly `0.3.0`, without a `v` prefix.
- `manifest.json` id is `folderandgraphs-plus`.
- Project license is MIT in `LICENSE`.
- Bundled Folders to Graph code is MIT licensed and attributed in `README.md` and `THIRD_PARTY_NOTICES.md`.

## PR body starter

```markdown
# I am submitting a new Community Plugin

- [x] I attest that I have done my best to deliver a high-quality plugin, am proud of the code I have written, and would recommend it to others. I commit to maintaining the plugin and being responsive to bug reports. If I am no longer able to maintain it, I will make reasonable efforts to find a successor maintainer or withdraw the plugin from the directory.

## Repo URL

Link to my plugin: https://github.com/pilafdob/folderandgraphs-plus

## Release Checklist

- [ ] I have tested the plugin on
- [ ] Windows
- [x] macOS
- [ ] Linux
- [ ] Android
- [ ] iOS
- [x] My GitHub release contains all required files (as individual files, not just in the source.zip / source.tar.gz)
- [x] `main.js`
- [x] `manifest.json`
- [ ] `styles.css` _(optional)_
- [x] GitHub release name matches the exact version number specified in my manifest.json (_**Note:** Use the exact version number, don't include a prefix `v`_)
- [x] The `id` in my `manifest.json` matches the `id` in the `community-plugins.json` file.
- [x] My README.md describes the plugin's purpose and provides clear usage instructions.
- [ ] I have read the developer policies at https://docs.obsidian.md/Developer+policies, and have assessed my plugin's adherence to these policies.
- [ ] I have read the tips in https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines and have self-reviewed my plugin to avoid these common pitfalls.
- [x] I have added a license in the LICENSE file.
- [x] My project respects and is compatible with the original license of any code from other plugins that I'm using. I have given proper attribution to these other projects in my `README.md`.
```
