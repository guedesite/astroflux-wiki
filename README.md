# Astroflux Wiki

This repository generates a static wiki for **Astroflux**.

The goal is simple: help players who reach the end of the first stage of the game and then wonder **"what am I supposed to do now?"** That is the main reason this project exists.

It is especially meant for players like me: people who enjoy the game, but need a clearer way to understand systems, bosses, artifacts, drops, progression paths, farming routes, and late-early / mid-game goals.

## What this project does

The project turns extracted game data into a browsable static website:

1. read game source files from `source\`
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

Expected rule:

- `source\` must exist locally if you want to run the full extraction pipeline
- `source\` stays outside version control
- contributors must not commit raw confidential source files

In practice:

- `npm run extract` **requires** `source\`
- `npm run build` rebuilds the static site from generated data already present in the repo
- `npm run check` validates generated output
- GitHub Actions publishes `dist\` to GitHub Pages, so `dist\` itself is not committed

## How it works

The real workflow is:

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

### 5. Local preview

```bash
npm run serve:dist
```

This serves the generated site locally for quick inspection.

## Project structure

| Path | Purpose |
| --- | --- |
| `source\` | Local confidential game source input, not tracked by git |
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
| `scripts\fetch-gamefs-assets.js` | Utility script for game asset retrieval |

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

