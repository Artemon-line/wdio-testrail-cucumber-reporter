/**
 * @exports WdioTestRailCucumberReporter
 * @requires events
 * @requires ./test-rail
 * @requires mocha-testrail-reporter/dist/lib/shared
 * @requires mocha-testrail-reporter/dist/lib/testrail.interface
 * @returns chalk
 */

const events = require('events');
const TestRail = require('./test-rail');
const titleToCaseIds = require('mocha-testrail-reporter/dist/lib/shared').titleToCaseIds;
const Status = require('mocha-testrail-reporter/dist/lib/testrail.interface').Status;
const chalk = require('chalk');

/**
 * Class representing Cucumber reporter data and methods
 * @extends events.EventEmitter
 */
class WdioTestRailCucumberReporter extends events.EventEmitter {

    /**
     *  @constructor
     * @param {{}} baseReporter - Configured in wdio.conf file
     * @param {Object} config - wdio config proprties
     * @param {Object} config.testRailsOptions - wdio TestRail specifc configurations 
     * @param {string} config.testRailsOptions.domain - Domain for TestRail
     * @param {number} config.testRailsOptions.projectId - Project identifier
     * @param {Array.<number>} config.testRailsOptions.suiteId - List of suites identifiers
     * @param {number} [config.testRailsOptions.assignedToId] - User identifier
     * @param {string} config.testRailsOptions.username - User email
     * @param {string} config.testRailsOptions.password - User API key
     * @param {Boolean} config.testRailsOptions.includeAll - Flag to inlcude all tests from a suite in a run
     * @param {number} [config.testRailsOptions.updateRun] - Test run identifier for test run to update
     * @param {number} [config.testRailsOptions.updatePlan] - Test plan identifier for a test plan to update
     * @param {Object} [config.testRailsOptions.customStatuses] - Custom statuses map: Failed, Passed, Pending
     */
    constructor(baseReporter, config) {
        super();

        const options = config.testRailsOptions;
        this._results = [];
        this._passes = 0;
        this._fails = 0;
        this._pending = 0;
        this._out = [];
        this.scenarioCount = 1;
        this.featureCount = 1;
        this.customStatuses = [];
        this.testRail = new TestRail(options);

        this.on('suite:start', (suite) => {

            if (config.maxInstances == 1) {
                if (suite.parent && suite.parent != null) {
                    console.log(`${chalk.cyan.underline('   ' + this.featureCount++ + '. Scenario: ')} ${suite.title}`);
                } else {
                    console.log(`\n\n${chalk.yellow.underline(this.scenarioCount++ + '. Feature: ')} ${suite.title}`);
                }
            }
        });

        this.on('test:pending', (test) => {
            this._pending++;
            this._out.push(test.title + ': pending');
            let caseIds = titleToCaseIds(Array.from(test.tags).map(x => x.name).join(', '));
            const runnerKey = Object.keys(test.runner)[0];
            if (caseIds.length > 0) {
                let results = caseIds.map(caseId => {
                    return {
                        case_id: caseId,
                        status_id: (options.customStatuses) ? options.customStatuses.Pending : Status.Blocked,
                        comment: `${test.title}`,
                        runner: test.runner[runnerKey]
                    };
                });
                this._results.push(...results);
            }

        });

        this.on('test:pass', (test) => {
            this._passes++;
            this._out.push(test.title + ': pass');
            let caseIds = titleToCaseIds(Array.from(test.tags).map(x => x.name).join(', ')); //look in the parent for the testrail id (represents a scenario or scenario outline)
            const runnerKey = Object.keys(test.runner)[0];
            if (caseIds.length > 0) {
                let results = caseIds.map(caseId => {
                    return {
                        case_id: caseId,
                        status_id: (options.customStatuses) ? options.customStatuses.Passed : Status.Passed,
                        comment: `${test.title}`,
                        runner: test.runner[runnerKey]
                    };
                });
                this._results.push(...results);
            }
        });

        this.on('test:fail', (test) => {
            this._fails++;
            this._out.push(test.title + ': fail');
            let caseIds = titleToCaseIds(Array.from(test.tags).map(x => x.name).join(', '));
            const runnerKey = Object.keys(test.runner)[0];
            if (caseIds.length > 0) {
                let results = caseIds.map(caseId => {
                    return {
                        case_id: caseId,
                        status_id: (options.customStatuses) ? options.customStatuses.Failed : Status.Failed,
                        comment: `${test.title}
											${test.err.message}
											${test.err.stack}
										`,
                        runner: test.runner[runnerKey]
                    };
                });
                this._results.push(...results);
            }
        });

        this.on('end', (data) => {
            if (process.env.REPORT == 'true') {

                if (this._results.length == 0) {
                    console.warn("No testcases were matched. Ensure that your tests are declared correctly and matches TCxxx\n");
                    return;
                }

                const executionDateTime = new Date();
                const total = this._passes + this._fails + this._pending;
                const runName = options.runName || WdioTestRailReporter.reporterName;
                const name = `${runName}: ${executionDateTime}`;
                const description = `${name}
														Execution summary:
														Passes: ${this._passes}
														Fails: ${this._fails}
														Pending: ${this._pending}
														Total: ${total}
													`;

                this.testRail.publish(name, description, this._results, data.capabilities);
            } else {
                console.log(`Reporting environment variable is set to [REPORT= ${process.env.REPORT}] so results will not be pushed to TestRail.`);
            }
        });
    }
}

WdioTestRailCucumberReporter.reporterName = 'WebDriver.io Cucumber TestRail Reporter';

module.exports = WdioTestRailCucumberReporter;
