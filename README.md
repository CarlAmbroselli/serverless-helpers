# serverless-toolkit

A collection of useful functions for serverless development.

[![npm version](https://badge.fury.io/js/serverless-toolkit.svg)](https://badge.fury.io/js/serverless-toolkit)

### Error Mailer

**When a function errors, receive the error via email**.

Usage:
```
ErrorMailer(functionToWatch, additionalInfo="", receiverEmail, senderEmail);

// alternatively you can read the environment variables of your function.
// receiverEmail defaults to process.env.ERROR_RECEIVER_EMAIL and senderEmail defaults to process.env.ERROR_RECEIVER_EMAIL
ErrorMailer(functionToWatch, additionalInfo="");
```

Example usage:
```
const errorMailer = require('serverless-toolkit').errorMailer;

function iWillFail() {
  throw new Error("This failed.")
}

var protected = errorMailer(iWillFail, "This is a test", "receiver@carl-ambroselli.de", "example@carl-ambroselli.de")

protected("firstArg", "secondArg")
```
