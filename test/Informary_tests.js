/**
* Unit tests for Informary
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

var Chai = require("chai");
var Expect = Chai.expect;
var Assert = Chai.assert;
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
	}
);