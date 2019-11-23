Run Lighthouse locally To See details in file
lighthouse https://www.google.com/ --output=json --output-path=./reportNew.json --save-assets

Run Locally (mockdata needs to be fixed)
sls invoke local -f "lighthouse_lambda" --path tests/mockdata.json

lighthouse Architecture:
https://github.com/GoogleChrome/lighthouse/blob/master/docs/architecture.md

lighthouse Configurations:
https://github.com/GoogleChrome/lighthouse/blob/master/docs/configuration.md

lighthouse Flags
https://github.com/GoogleChrome/lighthouse/blob/8f500e00243e07ef0a80b39334bedcc8ddc8d3d0/lighthouse-core/config/constants.js#L30-L48

//Chrome flags
https://peter.sh/experiments/chromium-command-line-switches/

Layer Source:
https://erezro.com/posts/2019-05-08-running-google-lighthouse-from-aws-lambda/
https://github.com/erezrokah/lighthouse-layer

Inspired By:
https://stuartsandine.com/lighthouse-lambda-parallel/