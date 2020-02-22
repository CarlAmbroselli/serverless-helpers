const sendmail = require('sendmail')();
const Catcher = require('./catcher');

export default class ErrorMailer {

  constructor(toWatch, additionalInfo, receiverEmail, senderEmail) {
    return new Promise((resolve) => {
      let catcher = new Catcher((error, func, args) => {
        var content = `
        <html>
          <head></head>
          <body>
            <h4 style="color: #CF0B36">An execution error occured!</h4>
            <p>Function: <b>${func.name}<b></p>
            <pre>${error}</pre>
            <p>Arguments: <b>${JSON.stringify(args)}<b></p>
            <br />
            <pre>${e.stack}</pre>
            <p>${additionalInfo ? JSON.stringify(additional_info, null, 2) : ''}</p>
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
      });

      catcher.catchAll(toWatch);
    })
  }

}