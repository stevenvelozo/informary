/**
* @license MIT
* @author <steven@velozo.com>
*/

/**
* Informary browser sync library
*
* @class Informary
*/
class Informary
{
	constructor(pSettings, pScope)
	{
		this._Dependencies = {};
		this._Dependencies.async = require('async');
		this._Dependencies.underscore = require('underscore');
		this._Dependencies.moment = require('moment');

		this._Settings = this._Dependencies.underscore.extend(JSON.parse(JSON.stringify(require('./Informary-Settings-Default.js'))), pSettings);

		// This has behaviors similar to bunyan, for consistency
		this._Log = new (require('./Informary-Log.js'))(this._Dependencies, this._Settings);
		this.log = this._Log;
	}


	getData (pRecordObject, fCallback)
	{
		this.putRecordToServer(pRecordObject, fCallback);
	}
};

module.exports = Informary;