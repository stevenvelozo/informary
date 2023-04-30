/**
* Unit tests for Informary
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

const Chai = require("chai");
const Expect = Chai.expect;

const libFS = require("fs");

// Basic harness form HTML
const tmpHarnessHTML = libFS.readFileSync(`${__dirname}/harness/informary_html_test_harness.html`);
const tmpHarnessDataObject = require(`./harness/informary_harness_data_1.json`);

const libJquery = require("jquery");

const libJSDOM = require("jsdom");
const { JSDOM } = libJSDOM;

const libInformary = require('../source/Informary.js');


const _MockSettings = (
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
						let testScope = {};
						let testInformary = new libInformary(_MockSettings, testScope);
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
						let testInformary = new libInformary(_MockSettings);
						Expect(testInformary).to.be.an('object', 'Informary should initialize as an object directly from the require statement.');
						fDone();
					}
				);
				test
				(
					'Initialize with some basic settings',
					(fDone)=>
					{
						let testInformary = new libInformary(
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
						let testScope = {};
						let testInformary = new libInformary(_MockSettings, testScope);

						let tmpTestStart = testInformary.log.getTimeStamp();

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
						let tmpDOM = new JSDOM(tmpHarnessHTML);
						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						tmpInformary.nonFormData.SomeValue = 'Some Value';

						let tmpDataObject = {};
						tmpInformary.marshalFormToData(tmpDataObject,
							function(pError)
							{
								if (pError)
								{
									// The form marshalling had some kind of error!
									console.log('INFORMARY MARSHAL FROM FORM ERROR: '+pError);
									console.log(JSON.stringify(tmpDataObject,null,4));
								}

								Expect(tmpDataObject.Header.WorkDate).to.equal('2010-05-19');

								Expect(tmpDataObject.__InformaryNonHTMLState).to.be.an('object');

								fDone();
							});
					}
				);
				test
				(
					'Marshalling data to the form...',
					(fDone)=>
					{
						// jsDOM must be instantiated with a url for the localStorage to work.
						let tmpDOM = new JSDOM(tmpHarnessHTML, { url: "https://test.informary.org/" });

						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						tmpInformary.nonFormData.SomeValue = 'Some Value';

						tmpInformary.setStorageProvider(tmpDOM.window.localStorage);
	
						let tmpDataObject = tmpHarnessDataObject;

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

								let tmpJquery = libJquery(tmpDOM.window);
								//console.log(JSON.stringify(tmpDataObject,null,4));
								Expect(tmpJquery('#workDate').val()).to.equal('2020-11-09');
								Expect(tmpJquery('#row_equipment_1').val()).to.equal('Ford F450 Pickup');

								fDone();
							});
					}
				);
				test
				(
					'Marshalling data to the form with a null...',
					(fDone)=>
					{
						// jsDOM must be instantiated with a url for the localStorage to work.
						let tmpDOM = new JSDOM(tmpHarnessHTML, { url: "https://test.informary.org/" });

						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						tmpInformary.setStorageProvider(tmpDOM.window.localStorage);
	
						let tmpDataObject = JSON.parse(JSON.stringify(tmpHarnessDataObject));
						tmpDataObject.NullValue = null;

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

								let tmpJquery = libJquery(tmpDOM.window);
								//console.log(JSON.stringify(tmpDataObject,null,4));
								Expect(tmpJquery('#workDate').val()).to.equal('2020-11-09');
								Expect(tmpJquery('#row_equipment_1').val()).to.equal('Ford F450 Pickup');

								fDone();
							});
					}
				);
				test
				(
					'Marshalling data to the form with a null...',
					(fDone)=>
					{
						// jsDOM must be instantiated with a url for the localStorage to work.
						let tmpDOM = new JSDOM(tmpHarnessHTML, { url: "https://test.informary.org/" });

						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						tmpInformary.setStorageProvider(tmpDOM.window.localStorage);
	
						let tmpDataObject = JSON.parse(JSON.stringify(tmpHarnessDataObject));
						tmpDataObject.NullValue = null;

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

								let tmpJquery = libJquery(tmpDOM.window);
								//console.log(JSON.stringify(tmpDataObject,null,4));
								Expect(tmpJquery('#workDate').val()).to.equal('2020-11-09');
								Expect(tmpJquery('#row_equipment_1').val()).to.equal('Ford F450 Pickup');

								fDone();
							});
					}
				);
				test
				(
					'Pushing around data in the nonFormData property...',
					(fDone)=>
					{
						// jsDOM must be instantiated with a url for the localStorage to work.
						let tmpDOM = new JSDOM(tmpHarnessHTML, { url: "https://test.informary.org/" });

						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						console.log(`Default nonFormData: ${JSON.stringify(tmpInformary.nonFormData)}`);
						Expect(tmpInformary.nonFormData).to.be.an('object');

						tmpInformary.nonFormData.d = 4;
						console.log(`Some set value in nonFormData: ${JSON.stringify(tmpInformary.nonFormData)}`);
						Expect(tmpInformary.nonFormData.d).to.equal(4);

						let tmpTestObject = ( { a: 1, b: 2, c: 3 } );

						tmpInformary.nonFormData = tmpTestObject;
						console.log(`Assigning the object outright shouldn't work: ${JSON.stringify(tmpInformary.nonFormData)}`);
						Expect(tmpInformary.nonFormData.d).to.equal(4);

						tmpInformary.nonFormData.OtherValues = tmpTestObject;
						console.log(`Assigning a property should work: ${JSON.stringify(tmpInformary.nonFormData)}`);
						Expect(tmpInformary.nonFormData.OtherValues.c).to.equal(3);
						fDone();
					}
				)
			}
		)
	}
);