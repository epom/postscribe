import postscribe from '../../src/postscribe.js';

// Fixes made in the Epom fork; each describe names its issue here and the upstream report it came from.
describe('epom fork', () => {
  let n = 0;

  // Writes html into a fresh container and resolves with it once the stream is done (rejects after 3s).
  function write(html, options = {}) {
    const div = document.createElement('div');
    div.id = `fork-${++n}`;
    document.body.appendChild(div);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('stream never finished')), 3000);
      postscribe(div, html, {
        ...options,
        done() {
          clearTimeout(timer);
          resolve(div);
        }
      });
    });
  }

  describe('<template> content is inert (#1)', () => {
    it('keeps the scripts inside a template unrun, and the content there for the next script', async() => {
      await write('<template id="t1"><script>window.__t1Fired = true;</script></template>' +
        '<script>window.__t1Seen = document.getElementById("t1").innerHTML;</script>');
      expect(window.__t1Seen).to.be('<script>window.__t1Fired = true;</script>');
      expect(window.__t1Fired).to.be(undefined);
    });

    it('does not wait for an external script inside a template', async() => {
      const div = await write('<template id="t2"><script async src="remote/set-global1.js"></script></template><p>after</p>');
      expect(div.querySelector('p').textContent).to.be('after');
      expect(document.getElementById('t2').content.querySelector('script').getAttribute('src')).to.be('remote/set-global1.js');
    });

    it('takes nested templates with the outer one and leaves no data-ps-id inside', async() => {
      await write('<TEMPLATE id="t3"><div><p>x</p><template><script>window.__t3Inner = 1;</script></template></div></TEMPLATE>');
      expect(document.getElementById('t3').innerHTML)
        .to.be('<div><p>x</p><template><script>window.__t3Inner = 1;</script></template></div>');
      expect(window.__t3Inner).to.be(undefined);
    });

    it('reassembles a template split across document.write calls', async() => {
      await write('<script>document.write(\'<div id="t4w">\'); document.write(\'<template id="t4"><scr\' + \'ipt>window.__t4 = 1;</scr\' + \'ipt>\');' +
        ' document.write(\'<i>i</i></template></div>\');</script>');
      const tpl = document.getElementById('t4');
      expect(tpl.innerHTML).to.be('<script>window.__t4 = 1;</script><i>i</i>');
      expect(tpl.parentNode.id).to.be('t4w');
      expect(window.__t4).to.be(undefined);
    });

    it('closes a template still open at the end of the stream', async() => {
      await write('<template id="t5"><script>window.__t5 = 1;</script><b>tail');
      expect(document.getElementById('t5').innerHTML).to.be('<script>window.__t5 = 1;</script><b>tail</b>');
      expect(window.__t5).to.be(undefined);
    });

    it('leaves "<template>" text inside a script alone', async() => {
      await write('<script>window.__t6 = \'<template id="t6fake"><b>x</b></template>\';</script>');
      expect(window.__t6).to.be('<template id="t6fake"><b>x</b></template>');
      expect(document.getElementById('t6fake')).to.be(null);
    });
  });

  describe('a script the browser does not run (#2, krux/postscribe#513)', () => {
    it('is written without stopping the stream, even with a src', async() => {
      const div = await write('<script type="text/plain" src="remote/set-global1.js"></script><p>after</p>');
      expect(div.querySelector('script').type).to.be('text/plain');
      expect(div.querySelector('p').textContent).to.be('after');
    });

    it('still runs the JavaScript types, in any case', async() => {
      await write('<script type="TEXT/JavaScript">window.__js2 = 1;</script>');
      expect(window.__js2).to.be(1);
    });

    it('treats a type with MIME parameters as not JavaScript, as the browser does', async() => {
      const div = await write('<script type="text/javascript; charset=utf-8" src="remote/set-global1.js"></script><p>after</p>');
      expect(div.querySelector('p').textContent).to.be('after');
    });
  });

  describe('entities in script and style attributes (#3, krux/postscribe#346)', () => {
    it('decodes them, so a script written through outerHTML keeps the & in its URL', async() => {
      const div = await write('<script>var s = document.createElement("script"); s.src = "remote/set-global1.js?a=1&b=2";' +
        ' s.id = "s3"; document.write(s.outerHTML);</script>');
      expect(div.querySelector('#s3').getAttribute('src')).to.be('remote/set-global1.js?a=1&b=2');
    });

    it('leaves static markup to the browser, which decodes it anyway', async() => {
      const div = await write('<div data-json="{&quot;a&quot;:1}"></div>');
      expect(div.firstChild.getAttribute('data-json')).to.be('{"a":1}');
    });
  });

  describe('a > inside a quoted attribute value (#4, krux/postscribe#509)', () => {
    it('does not end the tag', async() => {
      const div = await write('<img src="data:image/png," onerror="if (10 > 8) { window.__gt4 = 1; }">');
      expect(div.firstChild.getAttribute('onerror')).to.be('if (10 > 8) { window.__gt4 = 1; }');
      expect(div.firstChild.hasAttribute('data-ps-id')).to.be(false);
    });
  });

  describe('<!DOCTYPE> and <?xml?> (#5, krux/postscribe#358)', () => {
    it('are skipped, so a whole HTML document renders', async() => {
      const div = await write('<!DOCTYPE html><html><head><title>t</title></head><body><p>doc</p>' +
        '<script>window.__doc5 = 1;</script></body></html>');
      expect(div.querySelector('p').textContent).to.be('doc');
      expect(window.__doc5).to.be(1);
    });

    it('skips an XML declaration too', async() => {
      const div = await write('<?xml version="1.0"?><p>xml</p>');
      expect(div.querySelector('p').textContent).to.be('xml');
    });
  });

  describe('end tags of empty elements (#7, the skipped upstream selfclosing spec)', () => {
    it('drops a stray </embed> or </img> instead of closing the enclosing element', async() => {
      const div = await write('<div id="e7"><embed></embed><img src="data:image/png,"></img><p>inside</p></div><p>outside</p>');
      expect(document.querySelector('#e7 > p').textContent).to.be('inside');
      expect(div.lastChild.textContent).to.be('outside');
    });

    it('reads </br> as <br>, as the browser does', async() => {
      const div = await write('<div id="e7b">a</br>b</div>');
      expect(document.getElementById('e7b').innerHTML).to.be('a<br>b');
      expect(div.childNodes.length).to.be(1);
    });
  });

  describe('cancel() (#8, krux/postscribe#478)', () => {
    it('stops a running stream, fires none of its callbacks, and lets the next stream run', async() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const done = sinon.spy();
      const afterAsync = sinon.spy();
      const stream = postscribe(div, '<script src="remote/set-global1.js"></script><p>after</p>', {done, afterAsync});
      expect(() => stream.cancel()).to.not.throwException();

      const next = await write('<p>next</p>');
      expect(next.textContent).to.be('next');
      expect(div.querySelector('p')).to.be(null);
      expect(done.called).to.be(false);
      expect(afterAsync.called).to.be(false);
      expect(document.write.toString()).to.contain('[native code]');
    });

    it('drops a stream that has not started yet', async() => {
      const first = write('<script src="remote/set-global1.js"></script>');
      const div = document.createElement('div');
      document.body.appendChild(div);
      const done = sinon.spy();
      postscribe(div, '<p>queued</p>', {done}).cancel();
      await first;
      await write('');
      expect(div.innerHTML).to.be('');
    });
  });

  describe('nonce option (#6, krux/postscribe#512)', () => {
    it('puts the nonce on the scripts and styles it creates', async() => {
      await write('<style id="n6s">#n6 { color: red; }</style>' +
        '<script id="n6j">window.__n6 = document.currentScript.nonce;</script>', {nonce: 'abc'});
      expect(window.__n6).to.be('abc');
      expect(document.getElementById('n6s').nonce).to.be('abc');
    });

    it('sets none without the option', async() => {
      await write('<script>window.__n6none = document.currentScript.nonce;</script>');
      expect(window.__n6none).to.be('');
    });
  });
});
