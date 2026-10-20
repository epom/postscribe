import {playwrightLauncher} from '@web/test-runner-playwright';

export default {
  // npm run test:differential sets DIFFERENTIAL: the slow browser-vs-postscribe comparison over the whole corpus.
  files: process.env.DIFFERENTIAL
    ? ['test/epom/differential/**/*.spec.js']
    : ['test/unit/**/*.spec.js', 'test/bugs/**/*.spec.js', 'test/prescribe/**/*.spec.js', 'test/epom/*.spec.js'],
  testsFinishTimeout: process.env.DIFFERENTIAL ? 900000 : 120000,
  nodeResolve: true,
  concurrency: 4,
  // BROWSERS=chromium,firefox,webkit picks the engines; Chromium alone by default.
  browsers: (process.env.BROWSERS || 'chromium').split(',').map(product => playwrightLauncher({product})),
  // The suites use expect.js, sinon and jQuery as globals, as they did under karma.
  testRunnerHtml: testFramework => `<!doctype html>
<html><body>
  <script src="/node_modules/jquery/dist/jquery.js"></script>
  <script src="/node_modules/expect.js/index.js"></script>
  <script src="/node_modules/sinon/pkg/sinon.js"></script>
  <script type="module" src="${testFramework}"></script>
</body></html>`,
  middleware: [
    // Specs load fixtures as relative "remote/..." URLs, which resolve against the test page at "/".
    function remoteFixtures(context, next) {
      if (context.url.startsWith('/remote/')) {
        context.url = `/test${context.url}`;
      }
      return next();
    }
  ],
  testFramework: {config: {timeout: 10000}}
};
