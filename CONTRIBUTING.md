# Contributing

Bug reports and pull requests are welcome: [issues](https://github.com/epom/postscribe/issues).

- Reproduce with the smallest markup you can: what you pass to `postscribe(...)`, what you expected, what you got.
- A fix changes both `src/` and `dist/postscribe.js` (the build that ships), marks the change `Epom fork:`, and adds a
  case to [`test/epom/postscribe-check.cjs`](test/epom/postscribe-check.cjs) that fails without it.
- Rebuild the minified file with
  `npx esbuild dist/postscribe.js --minify --legal-comments=inline --target=es5 --outfile=dist/postscribe.min.js`.
- `node test/epom/postscribe-check.cjs` must pass for `dist/postscribe.js`, `dist/postscribe.min.js` and the `src`
  bundle; CI runs all three.
- Add a line to [CHANGELOG.md](CHANGELOG.md), linking the issue (and the upstream krux/postscribe one, if any).
