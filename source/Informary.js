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
	constructor(pSettings)
	{
		this._Dependencies = {};
		this._Dependencies.jquery = require('jquery');

		this._Settings = (typeof(pSettings) === 'object') ? pSettings : (
			{
				// The form we are dealing with (this is a hash set on the form itself)
				Form: 'UNSET_FORM_ID',

				// If this is true, show a whole lotta logs
				DebugLog: false
			});

		// This has behaviors similar to bunyan, for consistency
		this._Log = new (require('./Informary-Log.js'))(this._Settings);
		this.log = this._Log;
	}

	getValueAtAddress (pObject, pAddress)
	{
		// Make sure pObject is an object
		if (!typeof(pObject) === 'object') return false;
		// Make sure pAddress is a string
		if (!typeof(pAddress) === 'string') return false;

		let tmpSeparatorIndex = pAddress.indexOf('.');

		if (tmpSeparatorIndex === -1)
		{
			// Now is the time to return the value in the address
			return pObject[pAddress];
		}
		else
		{
			let tmpSubObjectName = pAddress.substring(0, tmpSeparatorIndex);
			let tmpNewAddress = pAddress.substring(tmpSeparatorIndex+1);

			// If there is an object property already named for the sub object, but it isn't an object
			// then the system can't set the value in there.  Error and abort!
			if (pObject.hasOwnProperty(tmpSubObjectName) && typeof(pObject[tmpSubObjectName]) !== 'object')
			{
				return false;
			}
			else if (pObject.hasOwnProperty(tmpSubObjectName))
			{
				// If there is already a subobject pass that to the recursive thingy
				return this.getValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress);
			}
			else
			{
				// Create a subobject and then pass that
				pObject[tmpSubObjectName] = {};
				return this.getValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress);
			}
		}
	}

	setValueAtAddress (pObject, pAddress, pValue)
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
				return this.setValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress, pValue);
			}
			else
			{
				// Create a subobject and then pass that
				pObject[tmpSubObjectName] = {};
				return this.setValueAtAddress(pObject[tmpSubObjectName], tmpNewAddress, pValue);
			}
		}
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

		let tmpParentPropertyAddress = (typeof(pParentPropertyAddress) !== 'undefined') ? pParentPropertyAddress : false;
		let tmpParentPropertyAddressString = (typeof(pParentPropertyAddress) !== 'undefined') ? pParentPropertyAddress : 'JSON OBJECT ROOT';
		if (this._Settings.DebugLog)
		{
			this.log.debug(`Informary Data->Form found parent address [${tmpParentPropertyAddress}] and is parsing properties`);
		}

		let tmpRecordObjectKeys = Object.keys(pRecordObject);
		tmpRecordObjectKeys.forEach(
			(pKey) =>
			{
				let tmpRecord = pRecordObject[pKey];
				let tmpPropertyAddress = (tmpParentPropertyAddress.length > 0) ? `${pParentPropertyAddress}.${pKey}` : pKey;

				if (this._Settings.DebugLog)
				{
					this.log.debug(`Informary Data->Form parent address [${tmpParentPropertyAddressString}] parsing property [${tmpPropertyAddress}]`);
				}

				switch (typeof(tmpRecord))
				{
					// If it's an object, check if we should be marshaling the whole value in or recursing.
					case 'object':
						// We've switched this to synchronous for safe browser mode
						// Leaving an empty callback in there in case we decide to switch back.
						return this.marshalDataToForm(tmpRecord, ()=>{}, tmpPropertyAddress);
						break;
					// Ignore undefined properties
					case 'undefined':
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
								this._Dependencies.jquery(tmpFormElement)[0].textContent = tmpRecord;
							// set the correct option to 'selected' for select tags
							} else if (this._Dependencies.jquery(tmpFormElement)[0].tagName === 'SELECT') {
								this._Dependencies.jquery(`select[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"] option[value="${tmpRecord}"]`).prop('selected', true);
							// otherwise just set the value for input
							} else {
								this._Dependencies.jquery(tmpFormElement).val(tmpRecord);
							}
						}	
						break;
				}
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

		let tmpFormValueElements = this._Dependencies.jquery(`
				input[data-i-form=${this._Settings.Form}],
				select[data-i-form=${this._Settings.Form}],
				textarea[data-i-form=${this._Settings.Form}]
			`);

		let tmpUnknownValueIndex = 0;

		this._Dependencies.jquery.each(tmpFormValueElements,
			(pRecordIndex, pRecordAddress) =>
			{
				let tmpFormValueAddress = this._Dependencies.jquery(pRecordAddress).attr('data-i-datum');
				let tmpFormValue;
				// check to see which element type this is before trying to collect the value
				if (this._Dependencies.jquery(pRecordAddress).tagName === 'TEXTAREA') {
					tmpFormValue = this._Dependencies.jquery(pRecordAddress).textContent;
				} else {
					tmpFormValue = this._Dependencies.jquery(pRecordAddress).val();
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
				this.setValueAtAddress(pRecordObject, tmpFormValueAddress, tmpFormValue);
			});

		return fCallback();
	}
};

module.exports = Informary;