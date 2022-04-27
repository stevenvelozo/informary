/**
* Unit tests for Informary
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

const { expect } = require("chai");
var Chai = require("chai");
var Expect = Chai.expect;

const libFS = require("fs");

// Basic harness form HTML
let tmpHarnessHTML = libFS.readFileSync(`${__dirname}/harness/informary_html_test_harness.html`)

const libJquery = require("jquery");

const libJSDOM = require("jsdom");
const { JSDOM } = libJSDOM;

var libInformary = require('../source/Informary.js');


var _MockSettings = (
{
	Product: 'Informary Test',
	ProductVersion: '0.0.0'
});

suite
(
	'Basic',
	()=>
	{
		setup(()=>{});

		suite
		(
			'Object Sanity',
			()=>
			{
				test
				(
					'The class should initialize itself into a happy little object.',
					(fDone)=>
					{
						var testScope = {};
						var testInformary = new libInformary(_MockSettings, testScope);
						Expect(testInformary).to.be.an('object', 'Informary should initialize as an object directly from the require statement.');
						Expect(testInformary._Settings)
							.to.be.a('object');
						fDone();
					}
				);
				test
				(
					'Try with a global scope...',
					(fDone)=>
					{
						var testInformary = new libInformary(_MockSettings);
						Expect(testInformary).to.be.an('object', 'Informary should initialize as an object directly from the require statement.');
						fDone();
					}
				);
				test
				(
					'Initialize with some basic settings',
					(fDone)=>
					{
						var testInformary = new libInformary(
							{
								Server:'https://my.server.com/1.0/',
								Entity:'Animal',
								Cached:false
							});
						Expect(testInformary).to.be.an('object', 'Informary should initialize as an object directly from the require statement.');
						Expect(testInformary._Settings.Entity)
							.to.equal('Animal');
						Expect(testInformary._Settings.Server)
							.to.equal('https://my.server.com/1.0/');
						fDone();
					}
				)
			}
		);
		suite
		(
			'Logging Tests',
			()=>
			{
				test
				(
					'Each log channel should work.',
					(fDone)=>
					{
						var testScope = {};
						var testInformary = new libInformary(_MockSettings, testScope);

						var tmpTestStart = testInformary.log.getTimeStamp();

						Expect(testInformary.log)
							.to.be.a('object');
						testInformary.log.trace('Test 1');
						testInformary.log.debug('Test 2');
						testInformary.log.info('Test 3');
						testInformary.log.warning('Test 4');
						testInformary.log.error('Test 5');


						testInformary.log.logTimeDelta(tmpTestStart);

						// Test time logging
						testInformary.log.logTime();
						testInformary.log.logTimeDelta(tmpTestStart);

						testInformary.log.logTime('Custom Timestamp Message');
						testInformary.log.logTimeDelta(tmpTestStart);

						// Exercise object logging
						testInformary.log.debug('Settings: ', testInformary.settings);

						testInformary.log.logTimeDelta(tmpTestStart, 'Test Complete');

						fDone();
					}
				);
			}
		);
		suite(
			'Basic Marshalling',
			()=>
			{
				test
				(
					'Marshalling data from the form...',
					(fDone)=>
					{
						var tmpDOM = new JSDOM(tmpHarnessHTML);
						var tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						var tmpDataObject = {};
						tmpInformary.marshalFormToData(tmpDataObject,
							function(pError)
							{
								if (pError)
								{
									// The form marshalling had some kind of error!
									console.log('INFORMARY MARSHAL FROM FORM ERROR: '+pError);
									console.log(JSON.stringify(tmpDataObject,null,4));
								}

								expect(tmpDataObject.Header.WorkDate).to.equal('2010-05-19');

								fDone();
							});
					}
				);
				test
				(
					'Marshalling data to the form...',
					(fDone)=>
					{
						var tmpDOM = new JSDOM(tmpHarnessHTML);
						var tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');
	
						var tmpDataObject = {
							"Header": {
								"WorkDate": "2020-11-09",
								"Inspector": "James Smith",
								"Location": {
									"Description": "SB I5 Milepost 678 near Redding",
									"Station": "Station 10+1.054 RT"
								},
								"WorkCompleted": "on"
							},
							"Rows": {
								"Row_1": {
									"PersonnelName": "Sally Suthers",
									"Contractor": "ABC Demolition",
									"LineItem": "1001 - Clearing and Grubbing",
									"Equipment": "Ford F450 Pickup",
									"Hours": "5",
									"Description": "Removing bulk landscape material"
								}
							}
						};
						tmpInformary.marshalDataToForm(tmpDataObject,
							function(pError)
							{
								if (pError)
								{
									// The form marshalling had some kind of error!
									console.log('INFORMARY MARSHAL TO FORM ERROR: '+pError);
									console.log(JSON.stringify(tmpDataObject,null,4));
								}

								console.log(JSON.stringify(tmpDataObject,null,4));

								var tmpJquery = libJquery(tmpDOM.window);

								console.log(JSON.stringify(tmpDataObject,null,4));
								expect(tmpJquery('#workDate').val()).to.equal('2020-11-09');
								expect(tmpJquery('#row_equipment_1').val()).to.equal('Ford F450 Pickup');

								fDone();
							});
					}
				);
			}
		)
	}
);