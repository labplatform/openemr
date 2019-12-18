'use strict';

// modules
const browserSync = require('browser-sync');
const csso = require('gulp-csso');
const del = require('del');
const fs = require('fs');
const glob = require('glob');
const gap = require('gulp-append-prepend');
const replace = require('replace-in-file');
const gulp = require('gulp');
const argv = require('minimist')(process.argv.slice(2));
const gulpif = require('gulp-if');
const prefix = require('gulp-autoprefixer');
const reload = browserSync.reload;
const rename = require('gulp-rename');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const gulp_watch = require('gulp-watch');

// package.json
const packages = require('./package.json');

// configuration
let config = {
    all: [], // must always be empty

    // Command Line Arguments
    dev: argv['dev'],
    build: argv['b'],
    syncOnly: argv['sync-only'],
    proxy: argv['p'],
    install: argv['i'],

    // Source file locations
    src: {
        styles: {
            style_uni: 'interface/themes/style_*.scss',
            style_color: 'interface/themes/colors/*.scss',
            directional: 'interface/themes/directional.scss'
        }
    },
    dist: {
        assets: 'public/assets/'
    },
    dest: {
        themes: 'public/themes'
    }
};

// Clean up lingering static themes
function clean(done) {
    del.sync([config.dest.themes + "/*"]);
    done();
}

// Parses command line arguments
function ingest(done) {
    if (config.dev && typeof config.dev !== "boolean") {
        // allows for custom proxy to be passed into script
        config.proxy = config.dev;
        config.dev = true;
    }
    done();
}

// definition of header for all compiled css
const autoGeneratedHeader = `
/*! This style sheet was autogenerated using gulp + scss
 *  For usage instructions, see: https://github.com/openemr/openemr/blob/master/interface/README.md
 */
`;

// standard themes css compilation
function styles_style_uni() {
    return gulp.src(config.src.styles.style_uni)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gap.prependText(autoGeneratedHeader))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(!config.dev, sourcemaps.write()))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.dev && config.build, gulp.dest(config.dest.themes)))
        .pipe(gulpif(config.dev, reload({ stream: true })));
}

// color themes css compilation
function styles_style_color() {
    return gulp.src(config.src.styles.style_color)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gap.prependText(autoGeneratedHeader))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(!config.dev, sourcemaps.write()))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.dev && config.build, gulp.dest(config.dest.themes)))
        .pipe(gulpif(config.dev, reload({ stream: true })));
}

// compile themes
const styles = gulp.parallel(styles_style_uni, styles_style_color);

// rtl standard themes css compilation
function rtl_style_uni() {
    return gulp.src(config.src.styles.style_uni)
        .pipe(gap.prependText('@import "./rtl.scss";\n')) // watch out for this relative path!
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gap.prependText(autoGeneratedHeader))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(!config.dev, sourcemaps.write()))
        .pipe(rename({ prefix: "rtl_" }))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.dev && config.build, gulp.dest(config.dest.themes)))
        .pipe(gulpif(config.dev, reload({ stream: true })));
}

// rtl color themes css compilation
function rtl_style_color() {
    return gulp.src(config.src.styles.style_color)
        .pipe(gap.prependText('@import "../rtl.scss";\n')) // watch out for this relative path!
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gap.prependText(autoGeneratedHeader))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(!config.dev, sourcemaps.write()))
        .pipe(rename({ prefix: "rtl_" }))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.dev && config.build, gulp.dest(config.dest.themes)))
        .pipe(gulpif(config.dev, reload({ stream: true })));
}

// compile rtl themes
const rtl_styles = gulp.parallel(rtl_style_uni, rtl_style_color);

// append rtl css to all style themes
//  also, create list of all themes for style_list to use
function rtl_setup(done) {
    const uni = glob.sync(config.src.styles.style_uni);
    const colors = glob.sync(config.src.styles.style_color);
    config.all = uni.concat(colors);

    // backup and update directional file
    fs.copyFile(config.src.styles.directional, config.src.styles.directional + '.temp', (err) => {
        if (err) throw err;
        replace({
            files: config.src.styles.directional,
            from: /ltr \!default/g,
            to: 'rtl !default',
        }).then(done());
    });
}

function rtl_teardown(done) {
    replace({
        files: config.src.styles.directional,
        from: /rtl \!default/g,
        to: 'ltr !default',
    }).then(function () {
        fs.unlink(config.src.styles.directional + '.temp', (err) => {
            if (err) throw err;
        done();
        });
    });
}


// Copies (and distills, if possible) assets from node_modules to public/assets
function install(done) {
    // combine dependencies and napa sources into one object
    const dependencies = packages.dependencies;
    for (let key in packages.napa) {
        if (packages.napa.hasOwnProperty(key)) {
            dependencies[key] = packages.napa[key];
        }
    }

    for (let key in dependencies) {
        // check if the property/key is defined in the object itself, not in parent
        if (dependencies.hasOwnProperty(key)) {
            if (key == 'dwv') {
                // dwv is special and need to copy dist, decoders and locales
                gulp.src('node_modules/' + key + '/dist/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/dist'));
                gulp.src('node_modules/' + key + '/decoders/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/decoders'));
                gulp.src('node_modules/' + key + '/locales/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/locales'));
            } else if (key == 'bootstrap') {
                // bootstrap is special and need to copy dist and scss
                gulp.src('node_modules/' + key + '/dist/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/dist'));
                gulp.src('node_modules/' + key + '/scss/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/scss'));
            } else if (key == 'bootstrap-v4-rtl') {
                // bootstrap-v4-rtl is special and need to copy dist and scss
                gulp.src('node_modules/' + key + '/dist/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/dist'));
                gulp.src('node_modules/' + key + '/scss/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/scss'));
            } else if (fs.existsSync('node_modules/' + key + '/dist')) {
                // only copy dist directory, if it exists
                gulp.src('node_modules/' + key + '/dist/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/dist'));
            } else {
                // copy everything
                gulp.src('node_modules/' + key + '/**/*')
                    .pipe(gulp.dest(config.dist.assets + key));
            }
        }
    }

    done();
}

function watch() {
    // watch all changes and re-run styles
    gulp.watch('./interface/**/*.scss', { interval: 1000, mode: 'poll' }, styles);

    // watch all changes to css/php files in themes and copy to public
    return gulp_watch('./interface/themes/*.{css,php}', { ignoreInitial: false })
        .pipe(gulp.dest(config.dest.themes));
}

function sync_only(done) {
    browserSync.init({
        proxy: "127.0.0.1:" + config.proxy,
        open: false
    });
    done();
}

// Will start browser sync and/or watch changes to scss
//  = Runs task(styles) first
function sync() {
    if (config.proxy) {
        browserSync.init({
            proxy: "127.0.0.1:" + config.proxy
        });
    }

    // copy all leftover root-level components to the theme directory
    // hoping this is only temporary
    return gulp.src(['interface/themes/*.{css,php}'])
        .pipe(gulp.dest(config.dest.themes));
}

// Export watch task
exports.watch = watch;

// Export pertinent default task
// - Note that the default task runs if no other task is chosen,
//    which is generally how this script is always used (except in
//    rare case where the user is running the watch task).
if (config.install) {
    exports.default = gulp.series(install)
} else if (config.syncOnly && config.proxy) {
    exports.default = gulp.parallel(sync_only, watch)
} else {
    exports.default = gulp.series(clean, ingest, styles, sync, rtl_setup, rtl_styles, rtl_teardown);
}
