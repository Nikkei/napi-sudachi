# napi-sudachi

napi-rs implementation of [Sudachi.rs](https://github.com/WorksApplications/sudachi.rs)

## TL;DR

Install package

```bash
npm install @nikkei/napi-sudachi
```

### Usage

```js
const sudachi = require('@nikkei/napi-sudachi')
const tokenizer = new sudachi.Tokenizer()
const mode = sudachi.SplitMode.c()

const testText = 'すもももももももものうち'
const morphemes = tokenizer.tokenize(testText, mode)

morphemes[0] >>
  {
    surface: 'すもも',
    partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
    normalizedForm: '李',
    dictionaryForm: 'すもも',
    readingForm: 'スモモ',
    dictionaryId: 0,
  }
```

## Setup

Setup must be done the same way as for Sudachi.rs.

- Download the Sudachi dictionary
- Non-dictionary configuration is already included in [resources](./resources/), which is a fork of `sudachi.rs/resources`

### Download a Sudachi Dictionary

You can use `yarn setup-dictionary / npm run setup-dictionary` to download a dictionary in `resources/` directory

Like `sudachi.rs/fetch_dictionary.sh`, this downloads the latest [SudachiDict](https://github.com/WorksApplications/SudachiDict).
You can also pass version and type as arguments.

```bash
yarn setup-dictionary 20241021 small
# or
npm run setup-dictionary -- 20241021 small
```

### Config

You can set environment variable for config in sudachi

- `SUDACHI_CONFIG_FILE`: `config.json` path
- `SUDACHI_RESOURCE_DIR`: `resources/` path
- `SUDACHI_DICT_PATH`: dictionary path
- `SUDACHI_USER_DICT`: user dictionary path (optional, if not set, user_dict will not be configured)

## For Developers

based on [napi-rs/package-template](https://github.com/napi-rs/package-template)

### Requirements

- the latest `Rust`
- `Node.js`
- `yarn`

### Build

After `yarn build` command, you can see `napi-sudachi.[darwin|win32|linux].node` file in project root.
This is the native addon built from [lib.rs](./src/lib.rs).

### Test in local

```bash
yarn
yarn build
yarn test
```

### CI

With GitHub Actions, each commit and pull request will be built and tested automatically.
For the list of supported Node.js versions and operating systems, please refer to [.github/workflows/CI.yml](.github/workflows/CI.yml).

### Release package

Releases are triggered by pushing a semver Git tag.

1. On a release branch, bump the version (updates platform packages via napi-rs hooks):

```bash
npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>] | from-git]
```

2. Open a PR with the version bump and merge it into `main`.

3. After the merge, tag the merge commit on `main` and push the tag (must match `package.json` version, with a `v` prefix):

```bash
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

GitHub actions will do the rest job for you.

> WARN: Don't run `npm publish` manually.

Copyright 2026 Nikkei Inc.
