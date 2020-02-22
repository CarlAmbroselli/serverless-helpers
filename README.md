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
const ErrorMailer = require('serverless-toolkit').ErrorMailer;

function iWillFail() {
  throw new Error("This failed.")
}

var protected = new ErrorMailer(iWillFail, "This is a test", "receiver@example.com", "sender@example.com")

protected()

```
