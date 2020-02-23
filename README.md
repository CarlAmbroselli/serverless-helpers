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

**When a function errors, receive the error via email**. This is first tries to send the email via Amazon SES. If that fails it will fallback to sendmail.

Usage:
```javascript
// Returns the return value of functionToWatch. If functionToWatch throws an error this will return a Promise.
// If errorHandler is supplied, it will be called once the error email has been sent and the promise will be resolved with the
// return value of errorHandler
errorMailer(functionToWatch, errorHandler, additionalInfo="", receiverEmail, senderEmail);

// alternatively you can read the environment variables of your function.
// receiverEmail defaults to process.env.ERROR_RECEIVER_EMAIL and senderEmail defaults to process.env.ERROR_SENDER_EMAIL
errorMailer(functionToWatch, errorHandler, additionalInfo="");
```

Example usage:
```javascript
const errorMailer = require('serverless-toolkit').errorMailer;

function iWillFail(argOne, argTwo) {
  throw new Error("This failed.")
}

// this function will be called once the error email has been sent with the same arguments
function errorHandler(argOne, argTwo) {
  return Promise.reject()
}

// Remember to update receiver and sender since @example.com will often get filtered to spam
var protected = errorMailer(iWillFail, errorHandler, "This is a test", "receiver@example.com", "sender@example.com")

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

## Dropbox storage

This is a library to easily store data in your dropbox account.

**Initialization**
```javascript
// accessToken can also be read from "process.env.DROPBOX_TOKEN"
Storage(accessToken)
```

**Reading Files**
```javascript
async fileExists(remoteFilePath)
async getTemporaryLink(remoteFilePath)
async getAllFilesInDir(remoteDirPath)
async getCsvAsObject(remoteFilePath)
async getFileAsString(remoteFilePath)

// To Filesystem
async downloadFile(remoteFilePath, localFilePath)
```

**Writing Files**
```javascript
async ensureDirectoryExists(remoteFilePath) // will use the dirname of the filePath / directoryPath
async uploadText(object, remoteFileDestination)
async uploadArrayAsCSV(array, remoteCsvDestination)
async appendToCsv(newContentObject, remoteCsvDestination) // appends a single object and checks that the object has the same keys as the remote csv, otherwise an error is thrown

// From URL
// Supply headers via the customHeaders parameter like 
// { "Authorization": "Bearer abc" }
async uploadFromUrl(url, remoteFileDestination, customHeaders) 

// From Filesystem
async mergeCsv(localFilePath, remoteFilePath, primaryKey, deduplicateInputFirst=false) // this will merge two csv files based on a primaryKey (or the whole row if primaryKey is undefined or not found in the input)
async uploadFile (localFilePath, remoteFilePath)
```

Sample usage:
```
const { Storage } = require('serverless-toolkit')
let storage = new Storage()
let obj = await storage.getCsvAsObject("/test.csv")
```