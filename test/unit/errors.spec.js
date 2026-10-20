import postscribe from '../../src/postscribe.js';

// Skipping these on IE for now to get back to wherte we were.
if (navigator.userAgent.indexOf('MSIE') === -1) {
  describe('errors', () => {
    function handlesError(html) {
      // Naming finish b/c the callback to postscribe is already called done
      return finish => {
        let oldOnError = window.onerror;
        window.onerror = null;

        const div = document.createElement('div');
        document.body.appendChild(div);

        // The stream goes on after an error, so done follows it: finish once, there, and require the report.
        let reported = false;
        postscribe(div, html, {
          error(err) {
            expect(err).to.be.ok();
            reported = true;
          },
          done() {
            window.onerror = oldOnError;
            expect(reported).to.be(true);
            finish();
          }
        });
      };
    }

    it('syntax error', handlesError('<script>va x</script>'));

    it('js exception', handlesError('<script>throw 1;</script>'));

    // IE cannot report remote script errors
    it('remote script malformed url', handlesError('<script src="404"></script>'));

    it('remote script 404', handlesError('<script src="http://cdn.krxd.net/not_found"></script>'));

    it('remote script exception', handlesError('<script src="remote/error.js"></script>'));
  });
}
