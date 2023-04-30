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

suite
(
	'Advanced - Recovery',
	()=>
	{
		setup(()=>{});
		suite(
			'Recovery Scenarios',
			()=>
			{
				test
				(
					'Checking Deltas...',
					(fDone)=>
					{
						let tmpDOM = new JSDOM(tmpHarnessHTML);
						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

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

								fDone();
							});
					}
				);
				test
				(
					'Shifting Data from Delta to Delta...',
					(fDone)=>
					{
						// jsDOM must be instantiated with a url for the localStorage to work.
						let tmpDOM = new JSDOM(tmpHarnessHTML, { url: "https://test.informary.org/" });

						let tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

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
			}
		)
	}
);