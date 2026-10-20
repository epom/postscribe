import terser from '@rollup/plugin-terser';
import {readFileSync} from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const banner = `/**
 * @file postscribe
 * @description Asynchronously write javascript, even with document.write.
 * @version v${pkg.version}
 * @see {@link https://github.com/epom/postscribe}
 * @license MIT
 * @author Derek Brans
 * @copyright 2016 Krux Digital, Inc; Epom
 */`;

const output = {format: 'umd', name: 'postscribe', exports: 'default', banner};

export default {
  input: 'src/main.js',
  output: [
    {...output, file: 'dist/postscribe.js'},
    {...output, file: 'dist/postscribe.min.js', plugins: [terser({format: {comments: /@license/}})]}
  ]
};
