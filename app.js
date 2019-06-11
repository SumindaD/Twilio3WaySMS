const express = require('express');
const app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
const path = require('path');
const Twilio = require('twilio');
const dotenv = require('dotenv');

dotenv.config();

const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MessagingResponse = Twilio.twiml.MessagingResponse;

const port = 3000
app.use(express.static(path.join(__dirname, 'public')));
//app.listen(port, () => console.log(`Example app listening on port ${port}!`))

var hostCookMap = new Map();

app.get('/CreateSMSChannel', (req, res) => {
  hostCookMap.set(req.query.from, req.query.to);

  sendSMS('You can start texting with ' + req.query.chatwith + ' via this number... ' + process.env.TWILIO_NUMBER, process.env.TWILIO_NUMBER, req.query.from);

  res.send({
    message: 'SMS initiation text sent to your number.'
  });
});

app.post('/RecievedSMS', (req, res) => {

  console.log("Recieved SMS");
  
  client.messages.list({limit: 1}).then(messages => messages.forEach(
    m => console.log(m.body)
  ));

  client.messages.list({limit: 1}).then(messages => messages.forEach(
    m => {
      io.sockets.emit("RecievedSMS", { message: m.body, from: m.from, to: m.to });
      console.log('Redirecting SMS to: ' + hostCookMap.get(m.from) + ' From: ' + process.env.TWILIO_NUMBER);
      sendSMS(m.body, process.env.TWILIO_NUMBER, hostCookMap.get(m.from));
    }
  ));

  

  //sendSMS('You can start texting with ' + req.query.chatwith + ' via this number... ' + process.env.TWILIO_NUMBER, process.env.TWILIO_NUMBER, req.query.from);

  // const twiml = new MessagingResponse();

  // twiml.message('The Robots are coming! Head for the hills!');

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end();
});

server.listen(port, () => console.log(`Example app listening on port ${port}!`));

io.on('connection', function(client) {
  console.log('Client connected. Id:' + client.id);

  client.on('disconnect', function () {
      console.log('Client disconnected. Id: ' + client.id);
  });
});

function sendSMS(message, from, to){
  client.messages
  .create({
      body: message,
      from: from,
      to: to
    })
  .then(message => console.log(message.sid));
};