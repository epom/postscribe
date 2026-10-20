# postscribe

[![check](https://github.com/epom/postscribe/actions/workflows/check.yml/badge.svg)](https://github.com/epom/postscribe/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Asynchronously write javascript, even with `document.write`.

Ad tags and other third-party snippets often call `document.write`, which only works while the page is still
loading. postscribe lets you inject such a snippet at any time, after the page has loaded, into any element,
without changing the snippet:

```javascript
postscribe('#ad', '<script src="https://ads.example.com/tag.js"></script>');
```

It overrides `document.write` for the duration, runs the snippet's scripts in order, and puts everything they write
where the browser would have put it.

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
([AUTHORS](AUTHORS), [CONTRIBUTORS](CONTRIBUTORS)). The 3.x line is maintained at [Epom](https://epom.com) by
[Anton Ruin](https://github.com/ruin).

## What's new in 3.0

postscribe was written at [Krux](https://github.com/krux/postscribe). Its last release was 2.0.8 in November 2016,
and the repository was archived in 2024, with its open bugs still open and a build that no longer ran.
[Epom](https://epom.com) uses postscribe in its ad server to write advertisers' creatives into publisher pages, so
we brought it back to life as 3.0:

- **The bugs that hit real creatives are fixed** (below), each with a test.
- **The tokenizer lives here too.** [prescribe](https://github.com/krux/prescribe), the HTML tokenizer postscribe
  depends on, is archived as well; it is now `src/prescribe/`, with its own test suite.
- **It builds and tests again.** rollup, ESLint and Web Test Runner on Playwright replace gulp, webpack 1, Babel 6,
  Karma and PhantomJS. The original suites run in full in headless Chromium on every push, including the specs
  upstream had skipped.

| Fixed | Upstream report |
|---|---|
| Scripts inside a `<template>` ran, the template came out empty, and an external script in one stalled everything ([#1](https://github.com/epom/postscribe/issues/1)) | not reported |
| A `<script type="text/plain" src>` (consent managers) stopped the stream ([#2](https://github.com/epom/postscribe/issues/2)) | [krux#513](https://github.com/krux/postscribe/issues/513) |
| A script written through `document.write(el.outerHTML)` requested a URL with `&amp;` ([#3](https://github.com/epom/postscribe/issues/3)) | [krux#346](https://github.com/krux/postscribe/issues/346) |
| A `>` inside a quoted attribute value ended the tag ([#4](https://github.com/epom/postscribe/issues/4)) | [krux#509](https://github.com/krux/postscribe/issues/509) |
| `<!DOCTYPE>` or `<?xml?>` stopped the stream ([#5](https://github.com/epom/postscribe/issues/5)) | [krux#358](https://github.com/krux/postscribe/issues/358) |
| No way to pass a CSP nonce: added the `nonce` option ([#6](https://github.com/epom/postscribe/issues/6)) | [krux#512](https://github.com/krux/postscribe/pull/512) |
| A stray `</embed>`, `</img>` or `</br>` closed the enclosing element ([#7](https://github.com/epom/postscribe/issues/7)) | upstream's own skipped test |
| `cancel()` on a running stream threw and left every later stream stuck ([#8](https://github.com/epom/postscribe/issues/8)) | [krux#478](https://github.com/krux/postscribe/issues/478) |

**Upgrading from 2.0.8:** the API is the same; replace the file or the dependency. Two things to know: the build is
ES2015+ (transpile it if you still ship ES5), and the fixes above change output where 2.0.8 was wrong. The full list is
in [CHANGELOG.md](CHANGELOG.md).

## Installation

From a CDN, which defines a global `postscribe`:

```html
<script src="https://cdn.jsdelivr.net/gh/epom/postscribe@v3.0.1/dist/postscribe.min.js"></script>
```

From npm, straight from this repository:

```console
npm install github:epom/postscribe#v3.0.1
```

```javascript
import postscribe from 'postscribe';               // ES modules
const postscribe = require('postscribe');          // CommonJS
define(['postscribe'], function (postscribe) {});  // AMD
```

Or copy [`dist/postscribe.js`](dist/postscribe.js) or [`dist/postscribe.min.js`](dist/postscribe.min.js) into your
project: UMD builds with the tokenizer included and no dependencies.

## Usage

```javascript
const stream = postscribe(element, html, options);
```

- **element**: a DOM element, a jQuery object, or an id selector such as `'#ad'`.
- **html**: an HTML string, or a function that takes a `Document` and writes to it.
- **options** (all optional):

| Option | Default | |
|---|---|---|
| `done()` | | Called when everything has been written, including what the snippet's scripts wrote. |
| `error(e)` | throws `e.msg` | Called when a script fails to load or throws. The stream goes on. |
| `nonce` | | The page's Content-Security-Policy nonce, put on every script and style postscribe creates. |
| `releaseAsync` | `false` | Let scripts with an `async` attribute leave the queue without waiting for them. |
| `autoFix` | `true` | Let the tokenizer close unclosed tags, as the browser would. |
| `beforeWrite(html)`, `afterWrite(html)` | | Called around each chunk a script writes with `document.write`; `beforeWrite` may return changed HTML. |
| `beforeWriteToken(token)` | | Called before each token is written; return it, changed or not, or nothing to drop it. |
| `afterAsync()` | | Called when an async script has loaded. |
| `beforeEnqueue()`, `afterDequeue()`, `afterStreamStart()` | | Called around the stream's place in the queue. |

Calls are queued: a second `postscribe(...)` starts when the first has finished. `stream.cancel()` stops a stream,
running or still queued: nothing more is written, none of its callbacks fire, and the next stream starts.

## Examples

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

### React, Vue and Angular

Give postscribe an element the framework renders once and never touches again, call it after that element is in the
DOM, and cancel the stream when the component goes away. It needs a real DOM, so not during server-side rendering.

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
export class AdComponent implements AfterViewInit, OnDestroy {
  @Input() tag = '';
  @ViewChild('box') box!: ElementRef<HTMLElement>;
  private stream?: {cancel(): void};
  ngAfterViewInit() { this.stream = postscribe(this.box.nativeElement, this.tag); }
  ngOnDestroy() { this.stream?.cancel(); }
}
```

## FAQ

**Can two tag writers run on one page?** No. postscribe overrides `document.write` while it works; another library
doing the same at the same time will interfere.

**Which browsers?** Current Chrome, Edge, Firefox and Safari, desktop and mobile. The build is ES2015+; transpile it
if you still need ES5.

**Why is `done` not called after `cancel()`?** A cancelled stream fires none of its callbacks, so a component that
cancels on unmount never hears from it again.

## Contributing

Found a bug? [Open an issue](https://github.com/epom/postscribe/issues/new) with the smallest markup that reproduces
it: what you pass to `postscribe(...)`, what you expected, what you got. Pull requests are welcome; every fix comes with
a spec under [`test/epom/`](test/epom) that fails without it. See [CONTRIBUTING.md](CONTRIBUTING.md).

```console
npm ci
npx playwright install chromium
npm run build    # rollup: dist/postscribe.js and dist/postscribe.min.js from src/
npm test         # the original suites and ours, in headless Chromium
npm run verify   # lint, build, fail if the committed dist/ is stale, tests; CI runs this on every push
```

`dist/` is committed so the library can be used straight from the repository.

## License

MIT, see [LICENSE](LICENSE).
