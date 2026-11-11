# Astroflux Wiki

This repository generates a static wiki for **Astroflux**.

The goal is simple: help players who reach the end of the first stage of the game and then wonder **"what am I supposed to do now?"** That is the main reason this project exists.

It is especially meant for players like me: people who enjoy the game, but need a clearer way to understand systems, bosses, artifacts, drops, progression paths, farming routes, and late-early / mid-game goals.

## What this project does

The project turns extracted game data into a browsable static website:

1. rebuild `source\` from the live game (data, textures, sounds, UI images)
2. normalize and index the data
3. generate Markdown content
4. build the final static site in `dist\`

The result is a wiki with:

- systems and map navigation
- bodies, stations, enemies, bosses, spawners
- drops, items, weapons, artifacts
- guide pages for travel, farming, combat, and progression research

## Important: `source\` is required

The project depends on a local `source\` folder.

That folder is **not committed to git**, for **confidentiality reasons**.

The Steam build of Astroflux is an Electron shell that loads the live HTML5 client from `astroflux.net`; it does not bundle the game data. The `source\` folder mirrors what the live client downloads:

| Path | Contents |
| --- | --- |
| `source\binaryData\cache_json.json` | game database (`data/cache.json`) |
| `source\binaryData\lang_json.json` | localization tables (`data/lang.json`) |
| `source\gamefs\textures\` | texture atlases (`.png` + `.xml`) |
| `source\gamefs\audio\` | sounds referenced by the cache |
| `source\images\` | UI / font images used by the site |

Expected rule:

- `source\` must exist locally if you want to run the full extraction pipeline
- `source\` stays outside version control
- contributors must not commit the raw source files

In practice:

- `npm run fetch:assets` rebuilds `source\` from the live game
- `npm run extract` **requires** `source\`
- `npm run build` rebuilds the static site from generated data already present in the repo
- `npm run check` validates generated output
- GitHub Actions runs `fetch:assets` (to get textures/sounds/UI images) and then `build`, and publishes `dist\` to GitHub Pages, so `dist\` itself is not committed

## How it works

The real workflow is:

### 0. Fetch the live game data

```bash
npm run fetch:assets
```

This downloads the current game files from `astroflux.net` (falling back to the legacy PlayerIO gamefs host) into `source\`. The database (`cache_json.json` / `lang_json.json`) is always refreshed; pass `--force` to also re-download textures, sounds and UI images that already exist. Run this first whenever the game ships a new version.

### 1. Extract

```bash
npm run extract
```

This script reads the game files from `source\binaryData\` and regenerates:

- `data\raw\`
- `data\index\`
- `content\`

### 2. Build

```bash
npm run build
```

This script reads the indexed data and generates the static website in:

- `dist\`

It also generates the root `index.html`, which redirects to `dist\` for local previews.

### 3. Validate

```bash
npm run check
```

This validates:

- generated JSON
- generated Markdown frontmatter
- generated HTML links
- the root redirect page

### 4. Full common workflow

```bash
npm run wiki
```

This runs:

```bash
npm run extract && npm run build
```

To refresh everything from the current game version, use:

```bash
npm run update
```

which runs `fetch:assets`, `extract`, and `build` in sequence.

### 5. Local preview

```bash
npm run serve:dist
```

This serves the generated site locally for quick inspection.

## Project structure

| Path | Purpose |
| --- | --- |
| `source\` | Local mirror of the live game data/assets, rebuilt by `fetch:assets`, not tracked by git |
| `data\raw\` | Generated raw JSON output |
| `data\index\` | Generated normalized indexes and manifests |
| `content\` | Generated Markdown content |
| `dist\` | Local build output and GitHub Pages artifact, not tracked by git |
| `scripts\` | Extraction, build, validation, and utility scripts |
| `scripts\lib\` | Shared helpers used by the generator |

## Main scripts

| Script | Role |
| --- | --- |
| `scripts\extract-wiki-data.js` | Reads source data and regenerates raw/index/content data |
| `scripts\build-static-site.js` | Builds the final static wiki |
| `scripts\check-generated-output.js` | Validates generated files |
| `scripts\serve-dist.js` | Serves `dist\` locally |
| `scripts\compare-dist-output.js` | Compares a rebuilt `dist\` against a baseline output |
| `scripts\fetch-gamefs-assets.js` | Rebuilds `source\` from the live game (data, atlases, sounds, UI images) |

## Contributing

Contributions are welcome.

### Recommended way to contribute

1. clone the repository
2. add your local `source\` folder if you need full regeneration
3. make changes in `scripts\` or `scripts\lib\`
4. regenerate output
5. validate before opening a PR

Recommended commands:

```bash
npm test
npm run extract
npm run build
npm run check
```

If your change is only about the static renderer or documentation, you may not always need the full extraction step, but the intended full workflow still depends on `source\`.

### Contribution rules

- **Do not commit `source\`**
- **Do not commit `dist\`**; GitHub Actions builds and publishes it
- prefer changing generator scripts instead of editing generated output by hand
- treat `data\raw\`, `data\index\`, and `content\` as generated inputs for the static build
- if a page is wrong, fix the generation logic first
- keep the project focused on helping players understand progression, systems, and useful game data

## Why this wiki exists

This wiki is not only a data dump.

It is meant to answer practical player questions such as:

- where should I go after the early game?
- which system, boss, or spawner matters next?
- where can I farm useful items or artifacts?
- how do weapons, enemies, and drops connect together?

The project exists because the game becomes much more interesting once the data is readable, linked, and searchable.

## Notes

- the site is generated as a static website
- the repository uses plain Node.js scripts and currently has no external npm dependencies
- some generated data comes from confidential local source material, which is why `source\` is excluded from git

