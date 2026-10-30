# Contributing

Thank you for wanting to help. This is a small project with a few firm habits.

## Running the tests

```
node drafter/tests/run.js
```

That runs every test. It needs Node.js and nothing else: no `npm install`. All of them must pass before and after your change.

The desktop program has its own end-to-end check, which starts the real app:

```
cd desktop
npm install
npm run smoke
```

Its drag and worker checks depend on timing and can fail once on a busy machine. Run it a second time before believing a failure there.

A new feature comes with tests. A test file is any `drafter/tests/*.test.js` that exports a list of `{ name, fn }`; `fn` may return a promise. Tests load the shipped code itself: `harness.js` pulls named functions out of the app script, and `boot-child.js` starts the whole app in a stand-in page.

## How changes are made

- **One real feature at a time**, tested in Node before it is offered.
- **Work in batches, one commit per batch.** A batch is one thing that can be described in a sentence. The commit message is that sentence: what the program does now, not what was typed.
- Keep a pull request to one subject. Say in it what to try by hand.
- Write code that reads like the code around it. The page must keep opening from a double-clicked file, so scripts stay classic scripts (no modules, no build step).
- No state may be shown by color alone.

## What must not come in

**Contributions must not include assets or code from commercial pattern software.** That means no icons, pictures, screenshots, avatars, fabrics, presets, sample files, help texts or code taken from such a program, and nothing obtained by decompiling one. Describe a feature by what it does, in your own words.

Also:

- **No third-party assets** without a license that allows them here (the project is GPL-3.0-or-later). The only models in the repository are the two preset avatars (see `ATTRIBUTION.md`). New third-party material is listed in `ATTRIBUTION.md`, and a dependency that ships in `THIRD-PARTY-NOTICES.md`.
- **Nothing that gets round encryption or protection.** The importer refuses protected files and must stay that way.
- No project files of other programs in the repository, also not as test data. Tests make the files they need.

## License of contributions

By contributing you agree that your contribution is licensed under the GNU General Public License, version 3 or any later version, like the rest of the project (`LICENSE`), and that it is yours to give.
