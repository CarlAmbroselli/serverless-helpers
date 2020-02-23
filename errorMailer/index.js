const sendmail = require('sendmail')();
const AWS = require('aws-sdk');

function awsSendMail(subject, body, sender, receiver) {
  AWS.config.update({region: 'eu-west-1'});
  var params = {
    Destination: {
      CcAddresses: [],
      ToAddresses: [
        receiver,
      ]
    },
    Message: {
      Body: {
        Html: {
         Charset: "UTF-8",
         Data: body
        },
       },
       Subject: {
        Charset: 'UTF-8',
        Data: subject
       }
      },
    Source: sender,
    ReplyToAddresses: [],
  };

  var sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

  return sendPromise.then(() => {
    console.log("Error report sent via email.")
  });
}

function sendError(error, func, args, additionalInfo, receiverEmail, senderEmail) {
    return new Promise((resolve) => {
      var content = `
      <html>
        <head></head>
        <body>
          <h4 style="color: #CF0B36">An execution error occured!</h4>
          <p>Function: <b>${func.name}<b></p>
          <pre>${error}</pre>
          <p>Arguments: <b>${prettifyArgs(args)}<b></p>
          <br />
          <pre>${error.stack}</pre>
          <p>${additionalInfo ? JSON.stringify(additionalInfo, null, 2) : ''}</p>
        </body>
      </html>`;

      receiverEmail = receiverEmail || process.env.ERROR_RECEIVER_EMAIL;
      senderEmail = senderEmail || process.env.ERROR_SENDER_EMAIL || receiverEmail || "ErrorMailer";
      subject = 'Execution of ' + func.name + ' failed.';

      return awsSendMail(subject, content, senderEmail, receiverEmail).catch((error) => {
        console.log("Error sending using AWS, will fallback to sendmail.")
        sendmail({
          from: senderEmail,
          to: receiverEmail,
          subject: subject,
          html: content,
        }, function(err, reply) {
          if (err || reply) {
            console.log(err && err.stack);
            console.dir(reply);
          }
          resolve(error, func, args);
        });
      })
    })
}

function prettifyArgs(args) {
  let keys = Object.keys(args).sort();
  return keys.map(x => args[x]).join(", ");
}

function errorMailer(toWatch, errorHandler, additionalInfo, receiverEmail, senderEmail) {
  function replacement() {
    try {
      process.on('unhandledRejection', (reason) => {
        sendError(reason, toWatch, arguments, additionalInfo, receiverEmail, senderEmail)
      });
      return toWatch.apply(this, arguments)
    } catch(e) {
      let senderPromise = sendError(e, toWatch, arguments, additionalInfo, receiverEmail, senderEmail)
      if (errorHandler) {
        return senderPromise.then(() => errorHandler.apply(this, arguments))
      } else {
        return senderPromise.then(() => {
          throw new Error(e)
        })
      }
    }
  }
  return replacement
}

module.exports = {
  errorMailer
}