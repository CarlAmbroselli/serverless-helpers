# serverless-toolkit
[![npm version](https://badge.fury.io/js/serverless-toolkit.svg)](https://badge.fury.io/js/serverless-toolkit) ![npm bundle size](https://img.shields.io/bundlephobia/min/serverless-toolkit) ![npm license](https://img.shields.io/npm/l/serverless-toolkit)

A collection of useful functions for serverless development.

Installation:

**npm**
```bash
npm install --save serverless-toolkit
```

**yarn**
```bash
yarn add serverless-toolkit
```

## Error Mailer

**When a function errors, receive the error via email**.

Usage:
```javascript
errorMailer(functionToWatch, additionalInfo="", receiverEmail, senderEmail);

// alternatively you can read the environment variables of your function.
// receiverEmail defaults to process.env.ERROR_RECEIVER_EMAIL and senderEmail defaults to process.env.ERROR_RECEIVER_EMAIL
errorMailer(functionToWatch, additionalInfo="");
```

Example usage:
```javascript
const errorMailer = require('serverless-toolkit').errorMailer;

function iWillFail() {
  throw new Error("This failed.")
}

// Remember to update receiver and sender since @example.com will often get filtered to spam
var protected = errorMailer(iWillFail, "This is a test", "receiver@example.com", "sender@example.com")

protected("firstArg", "secondArg")
```

Example email:
```
An execution error occured!
Function: iWillFail

Error: This failed.
Arguments: firstArg, secondArg


Error: This failed.
    at iWillFail (/Users/example/sample/test.js:4:9)
    at replacement (/Users/example/sample/node_modules/serverless-toolkit/errorMailer/index.js:45:22)
    at Object. (/Users/example/sample/test.js:9:1)
    at Module._compile (internal/modules/cjs/loader.js:955:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:991:10)
    at Module.load (internal/modules/cjs/loader.js:811:32)
    at Function.Module._load (internal/modules/cjs/loader.js:723:14)
    at Function.Module.runMain (internal/modules/cjs/loader.js:1043:10)
    at internal/main/run_main_module.js:17:11
"This is a test"
```
