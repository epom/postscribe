/**
 * Regression check for postscribe: writes creatives
 * through it in headless Chromium and asserts the resulting DOM. No server needed; example.com is stubbed.
 *
 * Usage (from the repo root; needs Playwright: npm i --no-save playwright && npx playwright install chromium):
 *   node test/epom/postscribe-check.cjs [path/to/postscribe.js]   (default dist/postscribe.js)
 * Exits non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { chromium } = require('playwright');
const source = fs.readFileSync(process.argv[2] || path.join(root, 'dist/postscribe.js'), 'utf8');

// Each case writes `html` into its own container; `check` runs in the page once the stream is done.
const CASES = [
    {
        name: 'template content stays inert and is there for the next script',
        html: '<template id="t1"><script>window.__fired=1;</script></template>'
            + '<script>window.__seen = document.getElementById("t1").innerHTML;</script>',
        check: () => window.__seen === '<script>window.__fired=1;</script>' && window.__fired === undefined,
    },
    {
        name: 'an external script inside a template neither loads nor stalls the stream',
        html: '<template id="t2"><script async src="https://example.com/tracker.js"></script></template><p id="after2">after</p>',
        check: () => !!document.getElementById('after2')
            && document.getElementById('t2').innerHTML === '<script async="" src="https://example.com/tracker.js"></script>',
        noRequestTo: 'tracker.js',
    },
    {
        name: 'nested templates travel with the outer one and leave no data-ps-id behind',
        html: '<TEMPLATE id="t3"><div><p>x</p><template><script>window.__inner=1</script></template></div></TEMPLATE>',
        check: () => document.getElementById('t3').innerHTML === '<div><p>x</p><template><script>window.__inner=1</script></template></div>'
            && window.__inner === undefined && !document.querySelector('#c3 [data-ps-id]'),
    },
    {
        name: 'a template split across document.write calls is put back together',
        html: '<script>document.write(\'<div id="w5">\');document.write(\'<template id="t5"><scr\'+\'ipt>window.__split=1</scr\'+\'ipt>\');'
            + 'document.write(\'<i>i</i></template></div>\');</script>',
        check: () => document.getElementById('t5').innerHTML === '<script>window.__split=1</script><i>i</i>'
            && document.getElementById('t5').parentNode.id === 'w5' && window.__split === undefined,
    },
    {
        name: 'an unterminated template is closed at the end, like a browser would',
        html: '<p>before</p><template id="t6"><script>window.__open=1</script><b>tail',
        check: () => document.getElementById('t6').innerHTML === '<script>window.__open=1</script><b>tail</b>' && window.__open === undefined,
    },
    {
        name: 'template text inside a script string is not a template',
        html: '<script>window.__str = \'<template id="fake"><b>x</b></template>\';</script>',
        check: () => window.__str === '<template id="fake"><b>x</b></template>' && !document.getElementById('fake'),
    },
    {
        name: 'a non-JavaScript <script type> is written but does not stop the stream (krux#513)',
        html: '<script type="text/plain" id="plain" src="https://example.com/consent.js"></script><p id="after513">after</p>',
        check: () => !!document.getElementById('after513') && document.getElementById('plain').type === 'text/plain',
        noRequestTo: 'consent.js',
    },
    {
        name: 'script attribute values are entity-decoded, so an outerHTML-written URL keeps its & (krux#346)',
        html: '<script>var s = document.createElement("script"); s.src = "https://example.com/amp.js?foo=bar&a=1";'
            + ' document.write(s.outerHTML);</script><div id="d346" data-json="{&quot;a&quot;:1}"></div>',
        check: () => document.getElementById('d346').getAttribute('data-json') === '{"a":1}',
        requestTo: 'amp.js?foo=bar&a=1',
    },
    {
        name: 'a > inside a quoted attribute value does not end the tag (krux#509)',
        html: '<img id="i509" src="data:image/png,x" onerror="if (10 > 8) { window.__gt = 1; }">',
        check: () => window.__gt === 1 && document.getElementById('i509').getAttribute('onerror') === 'if (10 > 8) { window.__gt = 1; }',
    },
    {
        name: 'a full HTML document as a creative still renders its body (krux#358)',
        html: '<!DOCTYPE html><html><head><title>t</title></head><body><p id="p358">doc</p><script>window.__doc=1</script></body></html>',
        check: () => !!document.getElementById('p358') && window.__doc === 1,
    },
    {
        name: 'with the nonce option, scripts and styles it creates pass a nonce-based CSP (krux#512)',
        html: '<style>#s512 { color: rgb(1, 2, 3); }</style><p id="s512">x</p><script>window.__csp = 1;</script>',
        options: { nonce: 'n0nce' },
        csp: "script-src 'nonce-n0nce'; style-src 'nonce-n0nce'",
        check: () => window.__csp === 1 && getComputedStyle(document.getElementById('s512')).color === 'rgb(1, 2, 3)',
    },
    {
        name: 'ordinary creatives still run scripts and document.write in order',
        html: '<div id="reg"><span>a</span><script src="https://example.com/ext.js"></script>'
            + '<script>document.write(\'<p id="dw">dw</p>\')</script><b>after</b></div>',
        check: () => document.getElementById('reg').innerHTML === '<span>a</span><script src="https://example.com/ext.js"></script>'
            + '<script>document.write(\'<p id="dw">dw</p>\')</script><p id="dw">dw</p><b>after</b>',
        requestTo: 'ext.js',
    },
];

(async () => {
    const browser = await chromium.launch();
    let failed = 0;
    try {
        for (const [i, c] of CASES.entries()) {
            const page = await browser.newPage();
            const requests = [];
            await page.route('https://example.com/**', (route) => {
                requests.push(route.request().url());
                route.fulfill({ body: '' });
            });
            if (c.csp) {
                // a real CSP header, so the page's own scripts need the nonce too
                await page.route('https://page.test/', (route) => route.fulfill({
                    contentType: 'text/html',
                    headers: { 'Content-Security-Policy': c.csp },
                    body: `<html><body><script nonce="${c.options.nonce}">${source}</script></body></html>`,
                }));
                await page.goto('https://page.test/');
            } else {
                await page.setContent('<html><body></body></html>');
                await page.addScriptTag({ content: source });
            }
            const done = await page.evaluate(([id, html, options]) => new Promise((resolve) => {
                const el = document.createElement('div');
                el.id = id;
                document.body.appendChild(el);
                postscribe(el, html, Object.assign({}, options, { done: () => resolve(true) }));
                setTimeout(() => resolve(false), 3000);
            }), ['c' + (i + 1), c.html, c.options || {}]);
            const ok = done
                && await page.evaluate(`(${c.check.toString()})()`)
                && (!c.noRequestTo || !requests.some((u) => u.includes(c.noRequestTo)))
                && (!c.requestTo || requests.some((u) => u.includes(c.requestTo)));
            console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}${done ? '' : ' (stream never finished)'}`);
            if (!ok) {
                failed++;
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
    process.exit(failed ? 1 : 0);
})();
