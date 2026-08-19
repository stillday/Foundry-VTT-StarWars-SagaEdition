const fs = require('node:fs');
const path = require('node:path');
const gulp = require('gulp');
const sass = require('sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

/* ----------------------------------------- */
/*  Compile Sass
/* ----------------------------------------- */

/*
 * The old chain was `gulp-sass` driven by `node-sass`, prefixed by `gulp-autoprefixer@6`.
 * node-sass is a native binding that is only published for Node <= 16 (node-sass 8 targets Node 18
 * at the newest), so on the Node 24 this project is built with `npm run compile` died with
 * "Node Sass does not yet support your current environment".  gulp-autoprefixer@6 in turn pins
 * PostCSS 7, which is likewise unmaintained.
 *
 * dart-sass (`sass`) is the reference implementation and is pure JS, and PostCSS 8 + autoprefixer 10
 * are the maintained equivalents.  Both are used through their own APIs rather than through a gulp
 * plugin: the plugins are the part of the chain that keeps rotting, and there is exactly one entry
 * point to compile, so the vinyl stream bought nothing.
 */

const SCSS_DIR = path.join(__dirname, 'scss');
const CSS_DIR = path.join(__dirname, 'css');
const SYSTEM_SCSS = ['scss/**/*.scss'];

/** Entry points are every non-partial (not `_`-prefixed) stylesheet directly under scss/. */
function entryPoints() {
  return fs
    .readdirSync(SCSS_DIR)
    .filter((f) => f.endsWith('.scss') && !f.startsWith('_'))
    .map((f) => path.join(SCSS_DIR, f));
}

async function compileScss() {
  const prefixer = postcss([autoprefixer({ cascade: false })]);
  fs.mkdirSync(CSS_DIR, { recursive: true });

  for (const file of entryPoints()) {
    const out = path.join(CSS_DIR, path.basename(file, '.scss') + '.css');
    let compiled;
    try {
      compiled = sass.compile(file, { style: 'expanded', loadPaths: [SCSS_DIR] });
    } catch (err) {
      // Keep the previous behaviour of the `handleError` helper: report and carry on rather than
      // aborting the watch task on a syntax error.
      console.error(err.message ?? String(err));
      continue;
    }
    const prefixed = await prefixer.process(compiled.css, { from: file, to: out });
    prefixed.warnings().forEach((w) => console.warn(String(w)));
    fs.writeFileSync(out, prefixed.css.endsWith('\n') ? prefixed.css : prefixed.css + '\n');
    console.log(`css: ${path.relative(__dirname, file)} -> ${path.relative(__dirname, out)}`);
  }
}

const css = gulp.series(compileScss);

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(SYSTEM_SCSS, css);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(compileScss, watchUpdates);
exports.css = css;
