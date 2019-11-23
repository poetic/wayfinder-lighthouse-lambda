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

const {
    CHROME_FLAGS,
    ONLY_CATEGORIES
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
    } = _.get(params, "cmd");

    await checkJsonRequestForCustomProcessingOnLighthouse(onlyChromeFlags, onlyCategories);

    const results = await launchChromeAndRunLighthouse(url);

    const payload = {
        url,
        webhook,
        testId,
        testType: "lighthouse",
        results
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

    if (onlyCategories) {
        lighthouseConfig.settings.onlyCategories = onlyCategories;
    }
}

async function launchChromeAndRunLighthouse(url) {
    console.log("Launch Chrome And Run Lighthouse");

    try {
        const chrome = await chromeLauncher.launch({ chromeFlags, chromePath });
        lighthouseFlags.port = chrome.port;
        const results = await lighthouse(url, lighthouseFlags, lighthouseConfig);
        await chrome.kill();
        return results;
    } catch (error) {
        console.error(error);
        throw error;
    }
}