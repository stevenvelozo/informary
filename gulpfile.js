'use strict';

const libBrowserify = require('browserify');
const libGulp = require('gulp');

const libVinylSourceStream = require('vinyl-source-stream');
const libVinylBuffer = require('vinyl-buffer');

const libBuble = require('gulp-buble');
const libSourcemaps = require('gulp-sourcemaps');
const libGulpUtil = require('gulp-util');

// Build the module for the browser, minified
libGulp.task('minified',
	() => {
		var tmpBrowserify = libBrowserify(
		{
			entries: './source/Informary-Browser-Shim.js',
			debug: true
		});
		//tmpBrowserify.ignore('underscore');

		return tmpBrowserify.bundle()
			.pipe(libVinylSourceStream('informary.min.js'))
			.pipe(libVinylBuffer())
			.pipe(libSourcemaps.init({loadMaps: true}))
					.pipe(libBuble())
					.on('error', libGulpUtil.log)
			.pipe(libSourcemaps.write('./'))
			.pipe(libGulp.dest('./dist/'));
	});

// Build the module for the browser
libGulp.task('debug',
	() => {
		var tmpBrowserify = libBrowserify(
		{
			entries: './source/Informary-Browser-Shim.js',
			debug: true
		});

		return tmpBrowserify.bundle()
			.pipe(libVinylSourceStream('informary.js'))
			.pipe(libVinylBuffer())
					.pipe(libBuble())
					.on('error', libGulpUtil.log)
			.pipe(libGulp.dest('./dist/'));
	});

libGulp.task
(
	'build',
	['debug', 'minified']
);
