'use strict';

const libBrowserify = require('browserify');
const libGulp = require('gulp');

const libVinylSourceStream = require('vinyl-source-stream');
const libVinylBuffer = require('vinyl-buffer');

const libTerser = require('gulp-terser');
const libBuble = require('gulp-buble');
const libSourcemaps = require('gulp-sourcemaps');
const libGulpUtil = require('gulp-util');
const libBabel = require('gulp-babel');

// Build the module for the browser
//   This gulp task is taken from the gulp recipe repository:
//   https://github.com/gulpjs/gulp/blob/master/docs/recipes/browserify-uglify-sourcemap.md
libGulp.task('minified',
() => {
	// set up the custom browserify instance for this task
	var tmpBrowserify = libBrowserify(
	{
		entries: './source/Informary-Browser-Shim.js',
		standalone: 'Informary',
		debug: true
	});

	return tmpBrowserify.bundle()
		.pipe(libVinylSourceStream('informary.min.js'))
		.pipe(libVinylBuffer())
		.pipe(libSourcemaps.init({loadMaps: true}))
				// Add transformation tasks to the pipeline here.
				.pipe(libBabel())
				.pipe(libTerser())
				.on('error', libGulpUtil.log)
		.pipe(libSourcemaps.write('./'))
		.pipe(libGulp.dest('./dist/'));
});

// Build the module for the browser
//   This gulp task is taken from the gulp recipe repository:
//   https://github.com/gulpjs/gulp/blob/master/docs/recipes/browserify-uglify-sourcemap.md
libGulp.task('debug',
	() => {
		// set up the custom browserify instance for this task
		var tmpBrowserify = libBrowserify(
		{
			entries: './source/Informary-Browser-Shim.js',
			standalone: 'Informary',
			debug: true
		});

		return tmpBrowserify.bundle()
			.pipe(libVinylSourceStream('informary.js'))
			.pipe(libVinylBuffer())
					.pipe(libBabel())
					.on('error', libGulpUtil.log)
			.pipe(libGulp.dest('./dist/'));
	});

libGulp.task
(
	'build',
	libGulp.series('debug', 'minified')
);
