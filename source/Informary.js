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
		this._Dependencies.moment = require('moment');
		this._Dependencies.jquery = require('jquery');
		this._Dependencies.underscore = require('underscore');

		this._Settings = this._Dependencies.underscore.extend(JSON.parse(JSON.stringify(require('./Informary-Settings-Default.js'))), pSettings);

		// This has behaviors similar to bunyan, for consistency
		this._Log = new (require('./Informary-Log.js'))(this._Dependencies, this._Settings);
		this.log = this._Log;
	}

	marshalDataToForm (pRecordObject, fCallback, pParentPropertyAddress)
	{
		let tmpOperationTime = this.log.getTimeStamp();
		if (this._Settings.DebugLog)
		{
			this.log.debug(`Informary Data->Form marshalling recursive entry...`);
		}
		// Guard against bad record objects being passed in
		if (typeof(pRecordObject) !== 'object')
		{
			this.log.error('Invalid record object passed in!');
			return fCallback('Invalid record object passed in!');
		}

		let tmpParentPropertyAddress = (typeof(pParentPropertyAddress) === 'string') ? pParentPropertyAddress : false;
		if (this._Settings.DebugLog)
		{
			this.log.debug(`Informary Data->Form found parent address [${tmpParentPropertyAddress}] and is parsing properties`);
		}

		this._Dependencies.async.eachOfSeries(pRecordObject,
			(pValue, pKey, fRecursiveCallback)=>
			{
				let tmpPropertyAddress = (tmpParentPropertyAddress.length > 0) ? `${pParentPropertyAddress}.${pKey}` : pKey;

				if (this._Settings.DebugLog)
				{
					this.log.debug(`Informary Data->Form parent address [${pParentPropertyAddress}] parsing property [${tmpPropertyAddress}]`);
				}

				switch (typeof(pValue))
				{
					// TODO: Something special with Arrays?  Maybe.
					// If it's an object, recurse.
					case 'object':
						return this.marshalDataToForm(pValue, fRecursiveCallback, tmpPropertyAddress);
						break;
					// Ignore undefined properties
					case 'undefined':
						return fRecursiveCallback();
						break;
					// Otherwise marshal it into the form
					default:
						let tmpFormElement = this._Dependencies.jquery(`
								input[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"], 
								select[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"],
								textarea[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"]
							`);
						if (tmpFormElement.length > 0) {
							// set the text area to the text content
							if (this._Dependencies.jquery(tmpFormElement)[0].tagName === 'TEXTAREA') {
								this._Dependencies.jquery(tmpFormElement)[0].textContent = pValue;
							// set the correct option to 'selected' for select tags
							} else if (this._Dependencies.jquery(tmpFormElement)[0].tagName === 'SELECT') {
								this._Dependencies.jquery(tmpFormElement + ` option[value="${pValue}"]`).prop('selected', true);
							// otherwise just set the value for input
							} else {
								this._Dependencies.jquery(tmpFormElement).val(pValue);
							}
						}	

						return fRecursiveCallback();
						break;
				}
				return fRecursiveCallback();
			},
			(pError)=>
			{
				if (this._Settings.DebugLog)
				{
					this.log.logTimeDelta(`Informary Data->Form parent address [${pParentPropertyAddress}] parsing complete`);
					this.log.debug(`Informary Data->Form recursive parsing exit [${pParentPropertyAddress}]`);
				}
				if (pError)
				{
					this.log.error(pError);
					return fCallback(pError);
				}

				// Recursive tail.
				return fCallback();
			});
	}

	marshalFormToData (pRecordObject, fCallback)
	{
		let tmpOperationTime = this.log.getTimeStamp();
		if (this._Settings.DebugLog)
		{
			this.log.debug(`Informary Form->Data marshalling recursive entry...`);
		}
		// Guard against bad record objects being passed in
		if (typeof(pRecordObject) !== 'object')
		{
			this.log.error('Invalid record object passed in!  Informary needs a Javascript object to put values into.');
			return fCallback('Invalid record object passed in!  Informary needs a Javascript object to put values into.');
		}

		debugger;
		let tmpFormValues = this._Dependencies.jquery(`
				input[data-i-form=${this._Settings.Form}],
				select[data-i-form=${this._Settings.Form}],
				textarea[data-i-form=${this._Settings.Form}]
			`);

		let tmpUnknownValueIndex = 0;

		let setValueAtAddress = (pObject, pAddress, pValue) =>
		{
			// Make sure pObject is an object
			if (!typeof(pObject) === 'object') return false;
			// Make sure pAddress is a string
			if (!typeof(pAddress) === 'string') return false;

			let tmpSeparatorIndex = pAddress.indexOf('.');

			if (tmpSeparatorIndex === -1)
			{
				// Now is the time to set the value in the object
				pObject[pAddress] = pValue;
				return true;
			}
			else
			{
				let tmpSubObjectName = pAddress.substring(0, tmpSeparatorIndex);
				let tmpNewAddress = pAddress.substring(tmpSeparatorIndex+1);

				// If there is an object property already named for the sub object, but it isn't an object
				// then the system can't set the value in there.  Error and abort!
				if (pObject.hasOwnProperty(tmpSubObjectName) && typeof(pObject[tmpSubObjectName]) !== 'object')
				{
					if (!pObject.hasOwnProperty('__ERROR'))
						pObject['__ERROR'] = {};
					// Put it in an error object so data isn't lost
					pObject['__ERROR'][pAddress] = pValue;
					return false;
				}
				else if (pObject.hasOwnProperty(tmpSubObjectName))
				{
					// If there is already a subobject pass that to the recursive thingy
					return setValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress, pValue);
				}
				else
				{
					// Create a subobject and then pass that
					pObject[tmpSubObjectName] = {};
					return setValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress, pValue);
				}
			}
		};

		this._Dependencies.async.eachOfSeries(tmpFormValues,
			(pValue, pKey, fRecursiveCallback)=>
			{
				let tmpFormValueAddress = this._Dependencies.jquery(pKey).attr('data-i-datum');
				let tmpFormValue;
				// check to see which element type this is before trying to collect the value
				if (this._Dependencies.jquery(pValue).tagName === 'TEXTAREA') {
					tmpFormValue = this._Dependencies.jquery(pValue).textContent;
				} else {
					tmpFormValue = this._Dependencies.jquery(pValue).val();
				}
				// If the value is non existant, set it to null
				if (typeof(tmpFormValue) === 'undefined')
				{
					tmpFormValue = null;
				}
				
				if (typeof(tmpFormValueAddress) === 'undefined')
				{
					tmpFormValueAddress = '__ERROR.UnsetDatum.'+tmpUnknownValueIndex;
					tmpUnknownValueIndex++;
				}
				setValueAtAddress(pRecordObject, tmpFormValueAddress, tmpFormValue);
				return fRecursiveCallback();
			},
			(pError)=>
			{
				if (this._Settings.DebugLog)
				{
					this.log.logTimeDelta(`Informary Form->Data parsing complete`);
				}
				if (pError)
				{
					this.log.error(pError);
					return fCallback(pError);
				}

				// Recursive tail.
				return fCallback();
			});
	}
};

module.exports = Informary;