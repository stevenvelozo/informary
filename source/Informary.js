/**
* @license MIT
* @author <steven@velozo.com>
*/

let libObjectDiff = require('deep-object-diff');
let libCacheTraxx = require('cachetrax');
const { findAllByDisplayValue } = require('@testing-library/dom');

/**
* Informary browser sync library
*
* @class Informary
*/
class Informary
{
	constructor(pSettings, pContext, pContextGUID)
	{
		this._Dependencies = {};
		this._Dependencies.jqueryLibrary = require('jquery');

		this._Settings = (typeof(pSettings) === 'object') ? pSettings : (
			{
				// The form we are dealing with (this is a hash set on the form itself)
				Form: 'UNSET_HTML_FORM_ID',

				User: 0,

				// The number of undo levels available
				UndoLevels: 25,

				// If this is true, show a whole lotta logs
				DebugLog: false
			});

		if (this._Settings.__VirtualDOM)
		{
			// If a virtual dom was passed in for unit tests, use that.
			this._Dependencies.jquery = this._Dependencies.jqueryLibrary(this._Settings.__VirtualDOM);
		}
		else
		{
			this._Dependencies.jquery = this._Dependencies.jqueryLibrary;
		}

		if (!this._Settings.User)
		{
			// If no user was passed in, set a default of 0
			this._Settings.User = 0;
		}
		
		if (!this._Settings.Form)
		{
			this._Settings.Form = 'UNSET_HTML_FORM_ID';
		}

		// This has behaviors similar to bunyan, for consistency
		this._Log = new (require('./Informary-Log.js'))(this._Settings);
		this.log = this._Log;

		// This is lazily set so unit tests can set an external provider for harnesses
		this._LocalStorage = null;

		this._UndoKeys = [];
		this._UndoBuffer = new libCacheTraxx();
		// Default to 25 undo levels if it isn't passed in via settings
		this._UndoBuffer.maxLength = this._Settings.UndoLevels ? this._Settings.UndoLevels : 25;
		this._RedoKeys = [];
		this._RedoBuffer = new libCacheTraxx();
		this._RedoBuffer.maxLength = this._UndoBuffer.maxLength;

		// The initially loaded document state (filled out when pushed to form)
		this._SourceDocumentState = false;
		// The latest current document state
		this._CurrentDocumentState = false;

		// If no context is passed in, use `Context_0`
		// This could cause undo/redo leakage.
		this._Context = pContext ? pContext.toString() : 'InformaryDefaultContext';
		this._ContextGUID = pContextGUID ? pContextGUID.toString() : '0x000000001';
	}

	/******************************************************
	 * Storage Provider
	 * --
	 * This could be abstracted to another class
	 */
	setStorageProvider (pStorageProvider)
	{
		this._LocalStorage = pStorageProvider;
	}

	checkStorageProvider()
	{
		// When running in a browser, this likely won't be set.  If it isn't, 
		if (!this._LocalStorage)
		{
			this._LocalStorage = window.localStorage;
		}
	}

	getIndexKey(pValueType)
	{
		return `Informary_Index_User[${this._Settings.User.toString()}]_ValueType[${pValueType}]`;
	}

	getStorageKey(pValueType)
	{
		return `Informary_Data_User[${this._Settings.User.toString()}]_ValueType[${pValueType}]_Context[${this._Context}]_ContextGUID[${this._ContextGUID}]`;
	}

	// Read the whole index
	readIndex(pValueType)
	{
		this.checkStorageProvider();

		let tmpIndex = false;

		let tmpData = this._LocalStorage.getItem(this.getIndexKey(pValueType));

		if (tmpData)
		{
			try
			{
				tmpIndex = JSON.parse(tmpData);
			}
			catch(pError)
			{
				this.log.error(`Error parsing local storage index key [${this.getIndexKey(pValueType)}]`);
			}
		}

		if (!tmpIndex)
		{
			tmpIndex =
			{
				IndexCreateTime: Date.now(),
				IndexUser: this._Settings.User
			}
		}

		tmpIndex.IndexLastReadTime = Date.now();

		return tmpIndex;
	}

	// Read just the record key for the index
	readIndexValue(pValueType)
	{
		let tmpIndex = this.readIndex(pValueType);
		let tmpIndexKeyValue = tmpIndex[this.getStorageKey(pValueType)];

		// Rather than return undefined, return false if it's a miss
		return (tmpIndexKeyValue) ? tmpIndexKeyValue : false;
	}

	// Touch the index for a value type
	touchIndex(pValueType)
	{
		this.checkStorageProvider();

		let tmpIndex = this.readIndex(pValueType);
		let tmpKey = this.getStorageKey(pValueType);

		tmpIndex[tmpKey] = {Time: Date.now(), ValueType: pValueType, User: this._Settings.User, Context: this._Context, ContextGUID: this._ContextGUID};

		// This relies on the readIndex above to initialize the localstorage provider
		this._LocalStorage.setItem(this.getIndexKey(pValueType), JSON.stringify(tmpIndex));
	}

	readData(pValueType)
	{
		// Check that the storage provider is initialized
		this.checkStorageProvider();

		let tmpData = this._LocalStorage.getItem(this.getStorageKey(pValueType));

		if (tmpData)
		{
			try
			{
				tmpData = JSON.parse(tmpData);
			}
			catch(pError)
			{
				this.log.error(`Error parsing local storage key [${this.getStorageKey(pValueType)}]`);
				tmpData = false;
			}
		}
		else
		{
			tmpData = false;
		}

		return tmpData;
	}

	writeData(pValueType, pData)
	{
		// Check that the storage provider is initialized
		this.checkStorageProvider();

		// Touch the index with a timestamp for the value
		this.touchIndex(pValueType);

		// set the actual item
		this._LocalStorage.setItem(this.getStorageKey(pValueType), JSON.stringify(pData));
	}

	deleteData(pValueType)
	{
		// Check that the storage provider is initialized
		this.checkStorageProvider();

		// Touch the index with a timestamp for the value.  Should we tell it it's a delete operation?  Hmmm..
		this.touchIndex(pValueType);

		// set the actual item
		this._LocalStorage.removeItem(this.getStorageKey(pValueType));
	}
	/*
	 * End of Storage Provider section
	 ******************************************************/

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

	setValueAtAddressInContainer(pRecordObject, pFormContainerAddress, pFormContainerIndex, pFormValueAddress, pFormValue)
	{
		// First see if there *is* a container object
		let tmpContainerObject = this.getValueAtAddress(pRecordObject, pFormContainerAddress);

		if (typeof(pFormContainerAddress) !== 'string') return false;

		let tmpFormContainerIndex = parseInt(pFormContainerIndex, 10);
		if (isNaN(tmpFormContainerIndex)) return false;

		if ((typeof(tmpContainerObject) !== 'object') || (!Array.isArray(tmpContainerObject)))
		{
			// Check if there is a value here and we want to store it in the "__OverwrittenData" thing
			tmpContainerObject = [];
			this.setValueAtAddress(pRecordObject, pFormContainerAddress, tmpContainerObject);
		}

		for (let i = 0; (tmpContainerObject.length + i) <= tmpFormContainerIndex; i++)
		{
			// Add objects to this container until it has enough
			tmpContainerObject.push({});
		}

		// Now set the value *in* the container object
		return this.setValueAtAddress(tmpContainerObject[tmpFormContainerIndex], pFormValueAddress, pFormValue);
	}

	// Write out source data
	storeSourceData(pData)
	{
		return this.writeData('Source', pData);
	}

	// Write out recovery data
	storeRecoveryData(fCallback)
	{
		let tmpCallback = (typeof(fCallback) == 'function') ? fCallback : ()=>{};
		
		let tmpRecoveryData = {};
		this.marshalFormToData(tmpRecoveryData, 
			()=>
			{
				this._RecoveryDocumentState = tmpRecoveryData;
				return tmpCallback(this.writeData('Recovery', this._RecoveryDocumentState));
			});
	}

	snapshotData()
	{
		let tmpNewUndoKey = Date.now().toString();

		// Check to see if there are any changes to the data to be stored
		let tmpOldRecoveryState = JSON.stringify(this._RecoveryDocumentState);

		this.storeRecoveryData(
			()=>
			{
				if (tmpOldRecoveryState != JSON.stringify(this._RecoveryDocumentState))
				{
					if (this._Settings.DebugLog)
					{
						this.log.debug(`Creating recovery snapshot at [${tmpNewUndoKey}]...`);
					}

					// Destroy all data in the redo ring, because this new snapshot invalidates it.
					while (this._RedoKeys.length > 0)
					{
						let tmpRedoKey = this._RedoKeys.pop();
						this._RedoBuffer.expire(tmpRedoKey);
					}

					this._UndoKeys.push(tmpNewUndoKey);
					this._UndoBuffer.put(this._RecoveryDocumentState, tmpNewUndoKey);

				}
				else
				{
					if (this._Settings.DebugLog)
					{
						this.log.debug(`Skipped creating recovery snapshot at [${tmpNewUndoKey}] because there were no changes to the recovery state...`);
					}
				}
			});
	}

	snapshotDataInitial()
	{
		let tmpNewUndoKey = Date.now().toString();

		if (this._UndoKeys.length > 0)
		{
			this.log.info(`Skipping creation of initial snapshot because one already exists.`);
			return false;
		}


		this.storeRecoveryData(
			()=>
			{
				if (this._Settings.DebugLog)
				{
					this.log.debug(`Creating recovery snapshot at [${tmpNewUndoKey}]...`);
				}

				this._UndoKeys.push(tmpNewUndoKey);
				this._UndoBuffer.put(this._RecoveryDocumentState, tmpNewUndoKey);
			});

		return true;
	}

	undoSnapshotCount()
	{
		// The initial snapshot is special to prevent confusing conditions when form data hasn't been edited.
		return this._UndoKeys.length;
	}

	redoSnapshotCount()
	{
		return this._RedoKeys.length;
	}

	revertToPreviousSnapshot(fCallback)
	{
		let tmpCallback = (typeof(fCallback) == 'function') ? fCallback : ()=>{};

		if (this._UndoKeys.length < 1)
		{
			this.log.info(`Not enough undo snapshots; skipping undo.`);
			return tmpCallback(false);
		}

		let tmpSnapshotKey = this._UndoKeys.pop();
		let tmpSnapshotData = this._UndoBuffer.read(tmpSnapshotKey);

		if (tmpSnapshotData)
		{
			// Add it to the redo buffer
			this._RedoKeys.push(tmpSnapshotKey);
			this._RedoBuffer.put(tmpSnapshotData, tmpSnapshotKey);

			// Check if the form data matches and if so advance back one step
			let tmpCurrentFormData = {};
			this.marshalFormToData(tmpCurrentFormData, 
				()=>
				{
					// Remove the expired snapshot of data from the Undu buffer
					this._UndoBuffer.expire(tmpSnapshotKey);

					this.marshalDataToForm(tmpSnapshotData,
						()=>
						{
							this._RecoveryDocumentState = tmpSnapshotData;

							this.log.info(`Informary reverted to snapshot ID ${tmpSnapshotKey}`);
							if ((JSON.stringify(tmpCurrentFormData) == JSON.stringify(tmpSnapshotData)) && this._UndoKeys.length > 0)
							{
								return this.revertToPreviousSnapshot(tmpCallback);
							}

							if (this._UndoKeys.length == 0)
							{
								this.log.info(`Snapshot Data Depleted -- Creating Extra Undo Snapshot`)
								this.snapshotDataInitial();
							}

							return tmpCallback(true);
						});
				});	
		}

		return tmpCallback(false);
	}


	reapplyNextRevertedSnapshot(fCallback)
	{
		let tmpCallback = (typeof(fCallback) == 'function') ? fCallback : ()=>{};

		let tmpSnapshotKey = this._RedoKeys.pop();
		let tmpSnapshotData = this._RedoBuffer.read(tmpSnapshotKey);

		if (tmpSnapshotData)
		{
			// Add it to the undo buffer
			this._UndoKeys.push(tmpSnapshotKey);
			this._UndoBuffer.put(tmpSnapshotData, tmpSnapshotKey);

			// Remove the expired snapshot of data from the Redo buffer
			this._RedoBuffer.expire(tmpSnapshotKey);

			// Check if the form data matches and if so advance back one step
			let tmpCurrentFormData = {};
			this.marshalFormToData(tmpCurrentFormData, 
				()=>
				{
					this.marshalDataToForm(tmpSnapshotData,
						()=>
						{
							this._RecoveryDocumentState = tmpSnapshotData;

							this.log.info(`Informary reapplied snapshot ID ${tmpSnapshotKey}`);
							if ((JSON.stringify(tmpCurrentFormData) == JSON.stringify(tmpSnapshotData)) && this._RedoKeys.length > 0)
							{
								// If the old form data matches the applied data, roll back farther
								return this.reapplyNextRevertedSnapshot(tmpCallback);
							}
							
							return tmpCallback(true);
						});
				});
		}

		return tmpCallback(false);
	}

	clearRecoveryData()
	{
		return this.deleteData('Recovery');
	}

	readRecoveryData()
	{
		return this.readData('Recovery');
	}

	restoreRecoveryScenarioData(fCallback)
	{
		let tmpCallback = (typeof(fCallback) == 'function') ? fCallback : ()=>{};

		let tmpRecoveryScenarioData = this.readRecoveryScenario();

		if (tmpRecoveryScenarioData && tmpRecoveryScenarioData.ExistingRecovery)
		{
			this.marshalDataToForm(tmpRecoveryScenarioData.ExistingRecovery,
				()=>
				{
					this.clearRecoveryScenarioData();
					// Store a new recovery data
					//this.storeSourceData();
					return tmpCallback(true);
				});
		}

		return tmpCallback(false);
	}

	clearRecoveryScenarioData()
	{
		return this.deleteData('RecoveryScenario');
	}

	storeRecoveryScenarioData(pRecoveryScenarioData)
	{
		return this.writeData('RecoveryScenario', pRecoveryScenarioData);
	}

	readRecoveryScenario()
	{
		return this.readData('RecoveryScenario');
	}

	// Checks if there is a recovery record, and detailed data about what it might be
	checkRecoveryState(pSourceData)
	{
		let tmpRecoveryData = (
			{
				NewSource: pSourceData,
				ExistingSource: this.readData('Source'),
				ExistingRecovery: this.readData('Recovery')
			});

		if (!tmpRecoveryData.ExistingSource || !tmpRecoveryData.ExistingRecovery)
		{
			// There is either no source or no read data, so we are not in a recovery state
			return false;
		}
		else
		{
			// Now check the differences
			let tmpRecoveryDifferences = libObjectDiff.detailedDiff(tmpRecoveryData.ExistingSource, tmpRecoveryData.ExistingRecovery);

			if (JSON.stringify(tmpRecoveryDifferences) == JSON.stringify(libObjectDiff.detailedDiff({},{})))
			{
				// No differences -- we're good for now
				return false;
			}
			else
			{
				this._Log.info(`Informary found recovery data at ${this.getStorageKey('Recovery')}!`);
				// Put the recovery changes in the object for helpfulness
				tmpRecoveryData.Diffs = {};
				tmpRecoveryData.Diffs.ExistingRecovery_ExistingSource = tmpRecoveryDifferences;
				tmpRecoveryData.Diffs.ExistingSource_NewSource = libObjectDiff.detailedDiff(tmpRecoveryData.ExistingSource, tmpRecoveryData.NewSource);
				tmpRecoveryData.Diffs.ExistingRecovery_NewSource = libObjectDiff.detailedDiff(tmpRecoveryData.ExistingRecovery, tmpRecoveryData.NewSource);
				
				// Put the index data in the object for helpfulness
				tmpRecoveryData.Index = {};
				tmpRecoveryData.Index.ExistingSource = this.readIndexValue('Source');
				tmpRecoveryData.Index.ExistingRecovery = this.readIndexValue('Recovery');

				this.writeData('RecoveryScenario', tmpRecoveryData);

				return tmpRecoveryData;
			}
		}
	}

	compareCurrentStateToUndoAndRedo(fCallback)
	{
		let tmpCallBack = (typeof(fCallback) === 'function') ? fCallback : () => {};
		let tmpCurrentStateData = {};
		let tmpCurrentUndoObject = {};
		let tmpCurrentRedoObject = {};

		this.marshalFormToData(tmpCurrentStateData, 
			() =>
			{
				let tmpCurrentStateDataJSON = JSON.stringify(tmpCurrentStateData);

				if (this._UndoKeys.length > 0)
				{
					let tmpCurrentUndoBufferSnapshotKey = this._UndoKeys[this._UndoKeys.length - 1];
					tmpCurrentUndoObject = this._UndoBuffer.read(tmpCurrentUndoBufferSnapshotKey);
				}

				if (this._RedoKeys.length > 0)
				{
					// Because there can be duplication of records in the redo buffer that may include 
					// the current data in the form multiple times, we need to enumerate the redo buffer
					// until the JSON doesn't match the current data.
					let tmpFirstRedoIndexWithDifferences = this._RedoKeys.length - 1;
					for (let i = this._RedoKeys.length-1; i >= 0; i--)
					{
						let tmpRedoComparisonJSON = JSON.stringify(this._RedoBuffer.read(this._RedoKeys[i]));
						if (tmpRedoComparisonJSON != tmpCurrentStateDataJSON)
						{
							tmpFirstRedoIndexWithDifferences = i;
							// Once we have found a set of redo data that doesn't match, we don't want to keep looking
							break;
						}
					}
					tmpCurrentRedoObject = this._RedoBuffer.read(this._RedoKeys[tmpFirstRedoIndexWithDifferences]);
				}

				let tmpComparisonData = (
					{
						UndoDelta: libObjectDiff.detailedDiff(tmpCurrentStateData, tmpCurrentUndoObject),
						RedoDelta: libObjectDiff.detailedDiff(tmpCurrentStateData, tmpCurrentRedoObject)
					});

				tmpCallBack(tmpComparisonData);
			});
	}

	createArrayContainers(pRecordObject, fCallback, pArrayPropertyAddress)
	{
		// Much simplified recursion that generates array containers
		if (this._Settings.DebugLog)
		{
			this.log.debug(`Informary Data->Form marshalling recursive entry...`);
		}
	}

	marshalDataToForm (pRecordObject, fCallback, pParentPropertyAddress, pContainerPropertyAddress, pContainerIndex)
	{
		// Because this is recursive, we only want to call this on the outermost call of the stack.
		let tmpRecoveryState = false;

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

		if (pRecordObject === null)
		{
			return fCallback();
		}

		if (pRecordObject === undefined)
		{
			return fCallback();
		}

		let tmpParentPropertyAddress = (typeof(pParentPropertyAddress) !== 'undefined') ? pParentPropertyAddress : false;
		let tmpParentPropertyAddressString = (typeof(pParentPropertyAddress) !== 'undefined') ? pParentPropertyAddress : 'JSON OBJECT ROOT';

		let tmpContainerPropertyAddress = (typeof(pContainerPropertyAddress) !== 'undefined') ? pContainerPropertyAddress : false;
		let tmpContainerPropertyIndex = (typeof(pContainerIndex) !== 'undefined') ? pContainerIndex : false; 

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
						// Check to see if it's an array, as we will put it into the extended object.
						if (Array.isArray(tmpRecord))
						{
							for (let i = 0; i < tmpRecord.length; i++)
							{
								this.marshalDataToForm(tmpRecord[i], ()=>{}, undefined, tmpPropertyAddress, i);
							}
						}
						else
						{
							// We've switched this to synchronous for safe browser mode
							// Leaving an empty callback in there in case we decide to switch back.
							return this.marshalDataToForm(tmpRecord, ()=>{}, tmpPropertyAddress, tmpContainerPropertyAddress, tmpContainerPropertyIndex);
						}
						break;
					// Ignore undefined properties
					case 'undefined':
						break;
					// Otherwise marshal it into the form
					default:
						let tmpFormElement = [];

						if (tmpContainerPropertyAddress && tmpContainerPropertyIndex)
						{
							// This is an array element
							tmpFormElement = this._Dependencies.jquery(`
								input[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"][data-i-container="${tmpContainerPropertyAddress}"][data-i-index="${tmpContainerPropertyIndex}"], 
								select[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"][data-i-container="${tmpContainerPropertyAddress}"][data-i-index="${tmpContainerPropertyIndex}"],
								textarea[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"][data-i-container="${tmpContainerPropertyAddress}"][data-i-index="${tmpContainerPropertyIndex}"]
							`);
						}
						else
						{
							tmpFormElement = this._Dependencies.jquery(`
								input[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"], 
								select[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"],
								textarea[data-i-form="${this._Settings.Form}"][data-i-datum="${tmpPropertyAddress}"]
							`);
						}
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
		
		if (!pParentPropertyAddress)
		{
			return fCallback(tmpRecoveryState);
		}
		else
		{
			return fCallback();
		}
	}

	marshalFormToData (pRecordObject, fCallback)
	{
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
				let tmpFormContainerAddress = this._Dependencies.jquery(pRecordAddress).attr('data-i-container');
				let tmpFormContainerIndex = this._Dependencies.jquery(pRecordAddress).attr('data-i-index');
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
				if (tmpFormContainerAddress && tmpFormContainerIndex)
				{
					this.setValueAtAddressInContainer(pRecordObject, tmpFormContainerAddress, tmpFormContainerIndex, tmpFormValueAddress, tmpFormValue);
				}
				else
				{
					this.setValueAtAddress(pRecordObject, tmpFormValueAddress, tmpFormValue);
				}
			});

		return fCallback();
	}
};

module.exports = Informary;