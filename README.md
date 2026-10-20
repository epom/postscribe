# postscribe

[![check](https://github.com/epom/postscribe/actions/workflows/check.yml/badge.svg)](https://github.com/epom/postscribe/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Asynchronously write javascript, even with `document.write`.

Ad tags and other third-party snippets often call `document.write`, which only works while the page is still
loading. postscribe lets you inject such a snippet at any time, after the page has loaded, into any element,
without changing the snippet. It overrides `document.write`, runs the snippet's scripts in order, and writes their
output where it belongs.

## This fork

postscribe was written at [Krux](https://github.com/krux/postscribe). Its last release was 2.0.8 in November 2016,
and the repository was archived in 2024, with its open bugs still open. [Epom](https://epom.com) runs postscribe
in its ad server to write advertisers' creatives into publisher pages, so we keep it alive here: same API, same
MIT license, drop-in for 2.0.8, plus fixes for the bugs reported upstream that hit real creatives.

Fixed so far (details in [CHANGELOG.md](CHANGELOG.md)):

| | Upstream report |
|---|---|
| Scripts inside a `<template>` ran, the template came out empty, and an external script in one stalled everything ([#1](https://github.com/epom/postscribe/issues/1)) | not reported |
| A `<script type="text/plain" src>` (consent managers) stopped the stream ([#2](https://github.com/epom/postscribe/issues/2)) | [krux#513](https://github.com/krux/postscribe/issues/513) |
| A script written through `document.write(el.outerHTML)` requested a URL with `&amp;` ([#3](https://github.com/epom/postscribe/issues/3)) | [krux#346](https://github.com/krux/postscribe/issues/346) |
| A `>` inside a quoted attribute value ended the tag ([#4](https://github.com/epom/postscribe/issues/4)) | [krux#509](https://github.com/krux/postscribe/issues/509) |
| `<!DOCTYPE>` or `<?xml?>` stopped the stream ([#5](https://github.com/epom/postscribe/issues/5)) | [krux#358](https://github.com/krux/postscribe/issues/358) |
| No way to pass a CSP nonce; added the `nonce` option ([#6](https://github.com/epom/postscribe/issues/6)) | [krux#512](https://github.com/krux/postscribe/pull/512) |

Found another one? [Open an issue](https://github.com/epom/postscribe/issues/new) with the smallest markup that
reproduces it.

## Installation

### Browser

```html
<script src="https://cdn.jsdelivr.net/gh/epom/postscribe@v2.0.8-epom.2/dist/postscribe.min.js"></script>
```

This defines a global `postscribe`. Or take [`dist/postscribe.js`](dist/postscribe.js) /
[`dist/postscribe.min.js`](dist/postscribe.min.js) into your own bundle. Both are UMD builds with the HTML tokenizer
([prescribe](https://github.com/krux/prescribe)) included and no dependencies.

### npm

```console
npm install github:epom/postscribe#v2.0.8-epom.2
```

```javascript
import postscribe from 'postscribe';           // ES modules
const postscribe = require('postscribe');      // CommonJS
define(['postscribe'], function (postscribe) {}); // AMD
```

## Usage

```javascript
postscribe(element, html, options);
```

- **element**: a DOM element, a jQuery object, or an id selector such as `'#ad'`.
- **html**: an HTML string, or a function that takes a `Document` and writes to it.
- **options** (all optional):
  - `done`: called when everything has been written, including what the snippet's scripts wrote.
  - `error(e)`: called when a write fails; the default throws `e.msg`.
  - `nonce`: the page's Content-Security-Policy nonce, put on every script and style postscribe creates.
  - `releaseAsync`: let scripts with an `async` attribute leave the queue without waiting for them. Default `false`.
  - `autoFix`: let the tokenizer close unclosed tags. Default `true`.
  - `beforeEnqueue`, `afterDequeue`, `afterStreamStart`: called around the stream's place in the queue.
  - `beforeWrite(html)` / `afterWrite(html)`: called around each chunk written by `document.write`; `beforeWrite` may
    return changed HTML.
  - `beforeWriteToken(token)`: called before each token is written; return it (changed or not), or nothing to drop it.
  - `afterAsync`: called when an async script has loaded.

Calls are queued: a second `postscribe(...)` starts when the first has finished. The return value has a
`cancel()` method that drops the stream if it has not finished.

### Render an ad after the page has loaded

Instead of a tag that writes during page load:

```html
<div id="ad">
  <script>document.write('<script src="https://ads.example.com/tag.js?slot=1"><\/script>');</script>
</div>
```

leave the container empty and inject the tag once the page is ready:

```html
<div id="ad"></div>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    postscribe('#ad', '<script src="https://ads.example.com/tag.js?slot=1"><\/script>', {
      done: function () { console.info('ad delivered'); }
    });
  });
</script>
```

## FAQ

**Does it work with jQuery, React, Vue and the like?** Yes. It has no dependencies and does not conflict with them.
For React or Vue, call it from an effect or `mounted` on an element the framework will not re-render. It needs a
real DOM, so not during server-side rendering.

**Can two tag writers run on one page?** No. postscribe overrides `document.write` while it works; another library
doing the same at the same time will interfere.

**Which browsers?** Current Chrome, Edge, Firefox and Safari, desktop and mobile. The build is ES5 and avoids newer
APIs, but only current browsers are tested.

## Development

The original gulp / karma / PhantomJS toolchain no longer installs on current Node. What ships is
[`dist/postscribe.js`](dist/postscribe.js): the npm 2.0.8 build with the fixes applied, each marked `Epom fork:`, and
mirrored in [`src/`](src). [`test/epom/postscribe-check.cjs`](test/epom/postscribe-check.cjs) writes sample creatives
through a build in headless Chromium and checks the resulting DOM:

```console
npm install --no-save --no-package-lock --ignore-scripts playwright esbuild prescribe@1.1.3
npx playwright install chromium
node test/epom/postscribe-check.cjs                        # dist/postscribe.js
node test/epom/postscribe-check.cjs dist/postscribe.min.js
```

CI runs it for `dist/postscribe.js`, `dist/postscribe.min.js` and the `src` bundle on every push. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

postscribe was created by Derek Brans and developed at Krux, with many contributors ([AUTHORS](AUTHORS),
[CONTRIBUTORS](CONTRIBUTORS)). This fork is maintained by [Epom](https://epom.com).

## License

MIT, see [LICENSE](LICENSE).
