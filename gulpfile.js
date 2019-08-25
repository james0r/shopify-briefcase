// Gulp 4
const { src, dest, watch, series } = require("gulp");
const sourcemaps = require("gulp-sourcemaps");
const sass = require("gulp-sass");
var sassGlob = require("gulp-sass-glob");
const concat = require("gulp-concat");
const uglify = require("gulp-uglify");
const postcss = require("gulp-postcss");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const babel = require("gulp-babel");
var gulpif = require("gulp-if");
const argv = require("yargs").argv;
const log = require("fancy-log");
const clean = require("gulp-clean");
const browserSync = require("browser-sync").create();
var rewriteCSS = require("gulp-rewrite-css");
var merge = require("merge-stream");
var atImport = require("postcss-import");
var notify = require("gulp-notify");
const zip = require("gulp-zip");

var is_production = argv.production === undefined ? false : true;

var project = {
  vendor: {
    files_to_watch: ["./vendor/**/*"],
    styles: ["./vendor/**/*.css", "./vendor/**/*.scss"],
    scripts: [
      "./vendor/jquery.js",
      "./vendor/rivets.bundled.min.js",
      "./vendor/slick/slick.js",
      "./vendor/window.js"
    ]
  },
  styles: {
    files_to_watch: ["./sass/**/*.scss", "./js/components/**/*.scss"],
    entry: ["./sass/style.scss"],
    dest: "./../assets/"
  },
  scripts: {
    files_to_watch: ["./js/**/*.js", "./js/components/**/*.html"],
    files: [
      "./js/_templates.js",
      "./js/services/*.js",
      "./js/components/**/*.js",
      "./js/directives/*.js",
      "./js/_settings.js",
      "./js/_global.js",
      "./js/**/*.js"
    ],
    templates: ["./js/components/**/*.html"],
    dest: "./../assets/"
  }
};

const allStyles = project.vendor.styles.concat(project.styles.entry);

if (is_production) {
  log.info("Running in Production Mode");
} else {
  log.info("Running in Development Mode");
}

function scssTask() {
  var prod = src(allStyles, { base: ".", allowEmpty: true, sourcemaps: true })
    .pipe(sassGlob())
    .pipe(
      sass({
        errLogToConsole: true
      })
    )
    .on("error", notify.onError())
    .pipe(rewriteCSS({ destination: project.styles.dest }))
    .pipe(postcss([autoprefixer(), atImport(), cssnano()]))
    .pipe(concat("_briefcase.min.scss.css"))
    .pipe(dest(project.styles.dest, { sourcemaps: "." }));

  var dev = src(allStyles, { base: ".", allowEmpty: true })
    .pipe(sassGlob())
    .pipe(
      sass({
        errLogToConsole: true
      })
    )
    .on("error", notify.onError())
    .pipe(postcss([autoprefixer(), atImport()]))
    .pipe(concat("_briefcase.expanded.scss.css"))
    .pipe(dest(project.styles.dest));

  browserSync.reload();

  return merge(prod, dev);
}

function jsTask() {
    var vendor = src(project.vendor.scripts, { allowEmpty: true });

    var authored = src(project.scripts.files, { allowEmpty: true })
      .pipe(concat("_briefcase.expanded.authored.bundle.js"))
      .pipe(
        babel({
          presets: ["@babel/preset-env"]
        })
      );

    browserSync.reload();

    merge(vendor, authored)
        .pipe(concat("_briefcase.expanded.bundle.js"))
        .pipe(dest(project.scripts.dest))

    return merge(vendor, authored)
      .pipe(concat("_briefcase.bundle.min.js"))
      .pipe(uglify())
      .pipe(dest(project.scripts.dest));
  }

function zipDev(cb) {
  src(["**/*.*", "!node_modules/", "!node_modules/**"])
    .pipe(zip("_briefcase.zip"))
    .pipe(dest(project.scripts.dest));

  cb();
}

function refreshBrowser(cb) {
  browserSync.reload();
  cb();
}

function process(cb) {
  scssTask();
  jsTask();
  cb();
}

function initBrowserSync(cb) {
  browserSync.init({
    server: {
      baseDir: "./../"
    }
  });
  cb();
}

function cleanupDev(cb) {
  return src(
    [
      "./../assets/_briefcase.expanded.scss.css",
      "./../assets/_briefcase.expanded.bundle.js"
    ],
    { allowEmpty: true }
  ).pipe(clean({ force: true }));
  cb();
}

function cleanupProd(cb) {
  return src(
    [
      "./../assets/_briefcase.min.scss.css",
      "./../assets/_briefcase.min.scss.css.map",
      "./../assets/_briefcase.bundle.js"
    ],
    { allowEmpty: true }
  ).pipe(clean({ force: true }));
  cb();
}

function watchFiles(cb) {
  watch(project.styles.files_to_watch, scssTask);
  watch(project.scripts.files_to_watch, jsTask);
  watch("./../**/*.*", refreshBrowser);
  cb();
}

exports.default = is_production
  ? series(process, cleanupDev, zipDev)
  : series(process, cleanupProd, initBrowserSync, watchFiles);
