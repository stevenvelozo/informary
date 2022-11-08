/**
* @license MIT
* @author <steven@velozo.com>
*/

/**
* Informary browser shim loader
*/

// Load the informary module into the browser global automatically.
var libInformary = require('./Informary.js');

if (typeof(window) === 'object')
{
	window.Informary = libInformary;
}

module.exports = libInformary;
