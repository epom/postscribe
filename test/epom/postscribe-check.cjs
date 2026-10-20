/**
 * Regression check for the Epom postscribe fork (dist/postscribe.js): writes creatives
 * through it in headless Chromium and asserts the resulting DOM. No server needed; example.com is stubbed.
 *
 * Usage (from the repo root; needs Playwright: npm i --no-save playwright && npx playwright install chromium):
 *   node test/epom/postscribe-check.cjs [path/to/postscribe.js]
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
            await page.setContent('<html><body></body></html>');
            await page.addScriptTag({ content: source });
            const done = await page.evaluate(([id, html]) => new Promise((resolve) => {
                const el = document.createElement('div');
                el.id = id;
                document.body.appendChild(el);
                postscribe(el, html, { done: () => resolve(true) });
                setTimeout(() => resolve(false), 3000);
            }), ['c' + (i + 1), c.html]);
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
