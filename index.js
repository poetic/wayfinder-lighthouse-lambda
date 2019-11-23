//const log = require('lighthouse-logger');
const lighthouse = require('lighthouse');
const fetch = require('node-fetch');
const _ = require('lodash');
const chromeLauncher = require('chrome-launcher');

let chromePath = undefined;

// This lets us support invoke local
if (!process.env.IS_LOCAL) {
    chromePath = '/opt/bin/chromium';

    // https://github.com/alixaxel/chrome-aws-lambda/blob/3779715fdc197a245af662725977133b2d676bf9/source/index.js#L6
    // required for node10 support - makes sure fonts and shared libraries are loaded correctly
    if (process.env.FONTCONFIG_PATH === undefined) {
        process.env.FONTCONFIG_PATH = '/opt/lib';
    }

    if (
        process.env.LD_LIBRARY_PATH &&
        process.env.LD_LIBRARY_PATH.startsWith('/opt/lib:') !== true
    ) {
        process.env.LD_LIBRARY_PATH = [
            ...new Set(['/opt/lib', ...process.env.LD_LIBRARY_PATH.split(':')]),
        ].join(':');
    }
}

const { CHROME_FLAGS,
    ONLY_CATEGORIES,
    GET_STATISTICS
} = process.env;

let chromeFlags = CHROME_FLAGS.split(',');

let lighthouseFlags = {
    output: "json",
    disableDeviceEmulation: false,
    disableStorageReset: false,
    throttlingMethod: "simulate",
};

let lighthouseConfig = {
    extends: 'lighthouse:default',
    settings: {
        onlyCategories: ONLY_CATEGORIES.split(','),
    }
};

let AuditRequestedList = GET_STATISTICS.split(',');
let CategoryRequestedList = lighthouseConfig.settings.onlyCategories;


exports.handler = async (event) => {
    console.log("BEGIN LAMBDA");
    console.log(event.body);

    let params = {};
    params.cmd = JSON.parse(event.body);

    const {
        url,
        webhook,
        testId,
        onlyChromeFlags,
        onlyCategories,
        onlyAudits } = _.get(params, "cmd");

    await checkJsonRequestForCustomProcessingOnLighthouse(onlyChromeFlags, onlyCategories, onlyAudits);

    const fullResults = await launchChromeAndRunLighthouse(url);

    const filteredResults = await getSpecifiedDataFromLighthouseResults(fullResults);

    const payload = {
        url,
        webhook,
        testId,
        testType: "lighthouse",
        filteredResults
    };

    if (webhook) {
        console.log(`Sending payload to ${webhook}`);
        fetch(webhook, { method: 'POST', body: JSON.stringify(payload) });
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ message: `sent payload to ${webhook}` })
        };
    } else {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(payload)
        };
    }
}

async function checkJsonRequestForCustomProcessingOnLighthouse(onlyChromeFlags, onlyCategories, onlyAudits) {
    console.log("Check Json Request For Custom Processing On Lighthouse");

    if (onlyChromeFlags) {
        chromeFlags = onlyChromeFlags;
    }

    if (onlyAudits) {
        AuditRequestedList = onlyAudits;
    }

    if (onlyCategories) {
        lighthouseConfig.settings.onlyCategories = onlyCategories;
        CategoryRequestedList = onlyCategories;
    }
}

async function launchChromeAndRunLighthouse(url) {
    console.log("Launch Chrome And Run Lighthouse");

    try {
        console.log("BEGIN CHROME LAUNCH");
        const chrome = await chromeLauncher.launch({ chromeFlags, chromePath });
        lighthouseFlags.port = chrome.port;
        console.log("CHROME LAUNCHED");
        const results = await lighthouse(url, lighthouseFlags, lighthouseConfig);
        await chrome.kill();
        return results;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function getSpecifiedDataFromLighthouseResults(results) {
    console.log("Get Specified Data From Lighthouse Results");
    try {
        let audits = {};
        AuditRequestedList.forEach(element => {
            audits[element] = {
                title: results.lhr.audits[element].title,
                score: results.lhr.audits[element].score,
                displayValue: results.lhr.audits[element].displayValue,
                numericValue: results.lhr.audits[element].numericValue
            };
        });

        let categories = {};
        CategoryRequestedList.forEach(element => {
            categories[element] = {
                title: results.lhr.categories[element].title,
                score: results.lhr.categories[element].score
            };
        });

        return { audits, categories };
    } catch (error) {
        console.error(error);
        throw error;
    }
}
