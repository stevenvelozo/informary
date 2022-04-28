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
let tmpHarnessHTML = libFS.readFileSync(`${__dirname}/harness/informary_html_test_harness.html`);
let tmpHarnessDataObject = require(`./harness/informary_harness_data_1.json`);

let getFreshHarnessDataObject = JSON.parse(JSON.stringify(tmpHarnessDataObject));

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
					'Shifting Data from Delta to Delta...',
					(fDone)=>
					{
						// jsDOM must be instantiated with a url for the localStorage to work.
						var tmpDOM = new JSDOM(tmpHarnessHTML, { url: "https://test.informary.org/" });

						var tmpInformary = new libInformary({Form:"SampleForm", __VirtualDOM:tmpDOM.window, DebugLog:true}, 'Context-1');

						tmpInformary.setStorageProvider(tmpDOM.window.localStorage);
	
						var tmpDataObject = tmpHarnessDataObject;

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
								//console.log(JSON.stringify(tmpDataObject,null,4));
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