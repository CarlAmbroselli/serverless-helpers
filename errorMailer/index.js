const sendmail = require('sendmail')();

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
      senderEmail = senderEmail || process.env.ERROR_RECEIVER_EMAIL || "ErrorMailer";

      sendmail({
          from: senderEmail,
          to: receiverEmail,
          subject: 'Execution of ' + func.name + ' failed.',
          html: content,
        }, function(err, reply) {
          if (err || reply) {
            console.log(err && err.stack);
            console.dir(reply);
          }
          resolve(error, func, args);
      });
    })
}

function prettifyArgs(args) {
  let keys = Object.keys(args).sort();
  return keys.map(x => args[x]).join(", ");
}

function errorMailer(toWatch, additionalInfo, receiverEmail, senderEmail) {
  function replacement() {
    try {
      return toWatch.apply(this, arguments)
    } catch(e) {
      sendError(e, toWatch, arguments, additionalInfo, receiverEmail, senderEmail)
    }
  }
  return replacement
}

module.exports = {
  errorMailer
}