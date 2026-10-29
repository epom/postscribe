# Contributing

Bug reports and pull requests are welcome: [issues](https://github.com/epom/postscribe/issues).

- Reproduce with the smallest markup you can: what you pass to `postscribe(...)`, what you expected, what you got.
- A fix goes in `src/` (postscribe) or `src/prescribe/` (the HTML tokenizer) and comes with a spec in
  [`test/epom/fork.spec.js`](test/epom/fork.spec.js) that fails without it. Mark the change `Epom fork:` with a line on why.
- `npm run build` regenerates `dist/`; commit it with the change.
- `npm run verify` must pass: lint, build, `dist/` up to date, the original suites and ours in headless Chromium,
  and no Closure Compiler warnings on `dist/postscribe.js` (the Epom ad server minifies it with Closure; needs a
  JDK 11+). Closure rejects dotted `@param` names such as `options.autoFix`: document an options object with a
  record type, `@param {{autoFix: (boolean|undefined)}} options`.
  CI runs the same on every push and pull request.
- Add a line to [CHANGELOG.md](CHANGELOG.md), linking the issue (and the upstream krux/postscribe one, if any).
