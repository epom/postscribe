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

  describe('a double quote inside a single-quoted attribute value (#9)', () => {
    it('keeps the value, so JSON in a data attribute survives', async() => {
      const div = await write(`<div data-cfg='{"slot":"top","size":[300,250]}'>x</div>`);
      expect(div.firstChild.getAttribute('data-cfg')).to.be('{"slot":"top","size":[300,250]}');
      expect(div.firstChild.attributes.length).to.be(1);
    });
  });

  // A script that writes `pieces` one document.write call after another, as real tags do.
  function inPieces(...pieces) {
    return `<script>${pieces.map(p => `document.write(${JSON.stringify(p).replace(/<\//g, '<\\/')});`).join('')}</script>`;
  }

  describe('attribute names with a colon or other non-word characters (#10)', () => {
    it('keeps xlink:href and xmlns:xlink whole', async() => {
      const div = await write('<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"></use></svg>');
      const use = div.querySelector('use');
      expect(use.getAttribute('xlink:href')).to.be('#a');
      expect(div.firstChild.getAttribute('xmlns:xlink')).to.be('http://www.w3.org/1999/xlink');
    });

    it('keeps framework-style names', async() => {
      const div = await write('<button @click="go()" :class="c" x-on:keyup.enter="k()">b</button>');
      const b = div.firstChild;
      expect([b.getAttribute('@click'), b.getAttribute(':class'), b.getAttribute('x-on:keyup.enter')]).to.eql(['go()', 'c', 'k()']);
    });
  });

  describe('a repeated attribute (#11)', () => {
    it('keeps the first value, as the browser does', async() => {
      const div = await write('<div title="first" title="second">x</div>');
      expect(div.firstChild.getAttribute('title')).to.be('first');
    });
  });

  describe('a write ending inside a quoted value (#12)', () => {
    it('waits for the rest of the tag instead of ending it at a > in the value', async() => {
      const div = await write(inPieces('<div title="a >', ' b">x</div>'));
      expect(div.querySelector('div').getAttribute('title')).to.be('a > b');
      expect(div.querySelector('div').textContent).to.be('x');
    });
  });

  describe('a textarea, noscript or iframe split across writes (#13)', () => {
    it('keeps the textarea content as text', async() => {
      const div = await write(inPieces('<textarea><b>not', ' bold</b></textarea>'));
      expect(div.querySelector('textarea').value).to.be('<b>not bold</b>');
    });

    it('still writes one left unterminated at the end of the stream', async() => {
      const div = await write('<p>a</p><textarea>open');
      expect(div.querySelector('textarea').value).to.be('open');
    });
  });

  describe('a comment split across writes (#14)', () => {
    it('stays a comment', async() => {
      const div = await write(inPieces('<', '!-- ', '<div>n', 'ot a div</div', '> -->x'));
      const comments = Array.from(div.childNodes).filter(n => n.nodeType === 8).map(n => n.data);
      expect(comments).to.eql([' <div>not a div</div> ']);
      expect(div.querySelector('div')).to.be(null);
    });
  });

  describe('<?xml ?> and <![CDATA[ ]]> (#15)', () => {
    it('are kept as comments, as the browser does, while a doctype is dropped', async() => {
      const div = await write('<!DOCTYPE html><?xml version="1.0"?><![CDATA[x]]><p>p</p>');
      const comments = Array.from(div.childNodes).filter(n => n.nodeType === 8).map(n => n.data);
      expect(comments).to.eql(['?xml version="1.0"?', '[CDATA[x]]']);
    });
  });

  describe('a template written in many small pieces (#16)', () => {
    it('comes out whole, without doubled tags', async() => {
      const html = '<template id="t16"><p>inside</p><table><tr><td>x</td></tr></table></template><i>after</i>';
      const div = await write(inPieces(...html.split('')));
      expect(document.getElementById('t16').innerHTML).to.be('<p>inside</p><table><tbody><tr><td>x</td></tr></tbody></table>');
      expect(div.querySelectorAll('p').length).to.be(0);
      expect(div.querySelector('i').textContent).to.be('after');
    });
  });

  describe('CR LF line endings (#17)', () => {
    it('become LF in script and style text, as in the browser', async() => {
      await write('<style id="s17">\r\n.x{}\r\n</style><script id="j17">\r\nwindow.__crlf = 1;\r\n</script>');
      expect(document.getElementById('s17').textContent).to.be('\n.x{}\n');
      expect(document.getElementById('j17').text).to.be('\nwindow.__crlf = 1;\n');
    });

    it('give one newline when the CR and the LF arrive in different writes', async() => {
      const div = await write(inPieces('<p>a\r', '\nb</p>'));
      expect(div.querySelector('p').textContent).to.be('a\nb');
    });
  });

  describe('style type (#18)', () => {
    it('is not added', async() => {
      await write('<style id="s18">.x{}</style>');
      expect(document.getElementById('s18').hasAttribute('type')).to.be(false);
    });
  });

  describe('a character reference split across writes (#19)', () => {
    it('is completed by the next write, as in the browser', async() => {
      const div = await write(inPieces('<p>&cop', 'y; &#83', '64;</p>'));
      expect(div.querySelector('p').textContent).to.be('© €');
    });

    it('stays text when nothing completes it', async() => {
      const div = await write('<p>a &amp b &</p><i>x &cop');
      expect(div.querySelector('p').textContent).to.be('a & b &');
      expect(div.querySelector('i').textContent).to.be('x &cop');
    });
  });

  describe('xmp, noembed, noframes and title (#20)', () => {
    it('keep their content as raw text', async() => {
      const div = await write('<xmp><b>raw</b></xmp><noembed><i>e</i></noembed>');
      expect(div.querySelector('xmp').textContent).to.be('<b>raw</b>');
      expect(div.querySelector('noembed').textContent).to.be('<i>e</i>');
      expect(div.querySelector('b')).to.be(null);
    });
  });

  describe('noscript (#21)', () => {
    it('is written with its content', async() => {
      const div = await write('<noscript><img src="data:image/png,"></noscript>x');
      expect(div.querySelector('noscript').textContent).to.be('<img src="data:image/png,">');
    });
  });

  describe('stray and misnested end tags (#22)', () => {
    it('drops an end tag of nothing open instead of closing the parent', async() => {
      const div = await write('<div>a</span>b</div>');
      expect(div.innerHTML.replace(/ data-ps-id="?\d+"?/g, '')).to.be('<div>ab</div>');
    });

    it('reopens a formatting element closed out of order', async() => {
      const div = await write('<b><i>x</b>y</i>');
      expect(div.innerHTML.replace(/ data-ps-id="?\d+"?/g, '')).to.be('<b><i>x</i></b><i>y</i>');
    });

    it('makes an empty p of a stray </p>', async() => {
      const div = await write('a</p>b');
      expect(div.innerHTML.replace(/ data-ps-id="?\d+"?/g, '')).to.be('a<p></p>b');
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
