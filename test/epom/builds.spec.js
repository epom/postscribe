import esm from '../../dist/postscribe.mjs';

// The shipped builds, not just src: the ES module and the UMD global.
describe('builds', () => {
  function writesWith(postscribe) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return new Promise(resolve => postscribe(div, '<p>x</p><script>document.write("<i>y</i>")</script>', {
      done: () => resolve(div.querySelector('p').textContent + div.querySelector('i').textContent)
    }));
  }

  it('dist/postscribe.mjs exports postscribe as its default', async() => {
    expect(await writesWith(esm)).to.be('xy');
  });

  it('dist/postscribe.js defines the postscribe global', async() => {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/dist/postscribe.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    expect(await writesWith(window.postscribe)).to.be('xy');
  });
});
