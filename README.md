# postscribe

[![check](https://github.com/epom/postscribe/actions/workflows/check.yml/badge.svg)](https://github.com/epom/postscribe/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Asynchronously write javascript, even with `document.write`.

Ad tags and other third-party snippets often call `document.write`, which only works while the page is still
loading. postscribe lets you inject such a snippet at any time, after the page has loaded, into any element,
without changing the snippet. It overrides `document.write`, runs the snippet's scripts in order, and writes their
output where it belongs.

## How it works, and thanks

Writing third-party HTML after the page has loaded looks like it needs an HTML parser as good as the browser's: where
does `<div>A<script>document.write("B</div>C")</script>D` put C and D? postscribe's answer, from Derek Brans, is
that it doesn't need one. Every chunk is written into a detached copy of everything written so far, stripped of
attributes (the "proxy history"); the browser builds the structure there by its own rules, and postscribe moves each
new node to the matching place in the real page. Scripts run one at a time in between, with `document.write`
pointing back into the stream, so nested and remote writes land where the browser would have put them.

That idea is why a library last released in 2016 still writes today's ad creatives correctly, and why every fix in
3.0 took a few dozen lines rather than a rewrite. Thank you to Derek Brans, Nick Sullivan, Joshua Newman, Seth Yates,
Ambroos Vaes and everyone at Krux who built postscribe and prescribe, wrote the test suite that still guards them,
and ran them for years on The New York Times, The Wall Street Journal, NBCUniversal and hundreds of other sites
([AUTHORS](AUTHORS), [CONTRIBUTORS](CONTRIBUTORS)). The 3.x fork is maintained at [Epom](https://epom.com) by
[Anton Ruin](https://github.com/ruin).

## This fork

postscribe was written at [Krux](https://github.com/krux/postscribe). Its last release was 2.0.8 in November 2016,
and the repository was archived in 2024, with its open bugs still open and a build that no longer runs.
[Epom](https://epom.com) runs postscribe in its ad server to write advertisers' creatives into publisher pages, so
we brought it back to life here as **3.0**: same API, same MIT license, a drop-in for 2.0.8, with

- the bugs reported upstream that hit real creatives fixed,
- the HTML tokenizer ([prescribe](https://github.com/krux/prescribe), archived too) maintained in the same repository,
- a current toolchain (rollup, ESLint, Web Test Runner on Playwright) in place of gulp, webpack 1, Babel 6, Karma and
  PhantomJS,
- the original test suite running again, all of it, in headless Chromium on every push, plus a test for every fix.

Fixed so far (details in [CHANGELOG.md](CHANGELOG.md)):

| | Upstream report |
|---|---|
| Scripts inside a `<template>` ran, the template came out empty, and an external script in one stalled everything ([#1](https://github.com/epom/postscribe/issues/1)) | not reported |
| A `<script type="text/plain" src>` (consent managers) stopped the stream ([#2](https://github.com/epom/postscribe/issues/2)) | [krux#513](https://github.com/krux/postscribe/issues/513) |
| A script written through `document.write(el.outerHTML)` requested a URL with `&amp;` ([#3](https://github.com/epom/postscribe/issues/3)) | [krux#346](https://github.com/krux/postscribe/issues/346) |
| A `>` inside a quoted attribute value ended the tag ([#4](https://github.com/epom/postscribe/issues/4)) | [krux#509](https://github.com/krux/postscribe/issues/509) |
| `<!DOCTYPE>` or `<?xml?>` stopped the stream ([#5](https://github.com/epom/postscribe/issues/5)) | [krux#358](https://github.com/krux/postscribe/issues/358) |
| No way to pass a CSP nonce; added the `nonce` option ([#6](https://github.com/epom/postscribe/issues/6)) | [krux#512](https://github.com/krux/postscribe/pull/512) |
| A stray `</embed>`, `</img>` or `</br>` closed the enclosing element ([#7](https://github.com/epom/postscribe/issues/7)) | upstream's own skipped test |

Found another one? [Open an issue](https://github.com/epom/postscribe/issues/new) with the smallest markup that
reproduces it.

## Installation

### Browser

```html
<script src="https://cdn.jsdelivr.net/gh/epom/postscribe@v3.0.1/dist/postscribe.min.js"></script>
```

This defines a global `postscribe`. Or take [`dist/postscribe.js`](dist/postscribe.js) /
[`dist/postscribe.min.js`](dist/postscribe.min.js) into your own bundle. Both are UMD builds with the HTML tokenizer
included and no dependencies.

### npm

```console
npm install github:epom/postscribe#v3.0.1
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

### In React, Vue or Angular

Give postscribe an element the framework renders once and never touches again, and call it after that element is in
the DOM. It needs a real DOM, so not during server-side rendering.

```jsx
// React
function Ad({tag}) {
  const ref = useRef(null);
  useEffect(() => {
    const stream = postscribe(ref.current, tag);
    return () => stream.cancel();
  }, [tag]);
  return <div ref={ref} />;
}
```

```vue
<!-- Vue 3 -->
<script setup>
import {onMounted, onBeforeUnmount, ref} from 'vue';
import postscribe from 'postscribe';
const props = defineProps(['tag']);
const box = ref(null);
let stream;
onMounted(() => { stream = postscribe(box.value, props.tag); });
onBeforeUnmount(() => stream && stream.cancel());
</script>
<template><div ref="box"></div></template>
```

```ts
// Angular
@Component({selector: 'app-ad', template: '<div #box></div>'})
export class AdComponent implements AfterViewInit {
  @Input() tag = '';
  @ViewChild('box') box!: ElementRef<HTMLElement>;
  ngAfterViewInit() { postscribe(this.box.nativeElement, this.tag); }
}
```

## FAQ

**Does it work with frameworks?** Yes: it has no dependencies and does not conflict with them. See
[In React, Vue or Angular](#in-react-vue-or-angular) above.

**Can two tag writers run on one page?** No. postscribe overrides `document.write` while it works; another library
doing the same at the same time will interfere.

**Which browsers?** Current Chrome, Edge, Firefox and Safari, desktop and mobile. The build is ES2015+; transpile it
yourself if you still need ES5.

## Development

```console
npm ci
npx playwright install chromium
npm run lint
npm run build    # rollup: dist/postscribe.js and dist/postscribe.min.js from src/
npm test         # the original suite, the tokenizer's suite and test/epom/*.spec.js, in headless Chromium
npm run verify   # all of the above, and fails if the committed dist/ is not the build of src/
```

`dist/` is committed so the library can be used straight from the repository. Every fix comes with a spec under
[`test/epom/`](test/epom), and CI runs `npm run verify` on every push. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE).
