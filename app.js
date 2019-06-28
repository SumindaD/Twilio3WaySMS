//This server needs to be publicly accessible by Twilio (To invoke RecievedSMS webhook). Use NGrok for dev purposes

const express = require('express');
const app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
const path = require('path');
const Twilio = require('twilio');
const dotenv = require('dotenv');

dotenv.config();

const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const port = 3000;
app.use(express.static(path.join(__dirname, 'public')));

var hostCookMap = new Map();

app.get('/RemoveAllParticipants', (req, res) => {
  client.proxy.services.list().then((services) => {

    if(services.length == 0){
      res.send({
        message: 'No services found'
      })
    }

    services.forEach((service) => {
      console.log('Found Proxy services');
      client.proxy.services(service.sid).sessions.list().then((sessions) => {

        if(sessions.length == 0){
          res.send({
            message: 'No sessions found'
          })
        }

        sessions.forEach((session) => {
          console.log('Found Sessions');
          client.proxy.services(service.sid).sessions(session.sid)
          .update(
                date_expiry=datetime(2018, 7, 31, 0, 0),
                status='closed'
          );

          res.send({
            message: 'Closed Sessions.'
          });
        });
      });
    });
  });
});

app.get('/RemoveAllParticipants', (req, res) => {
  client.proxy.services.list().then((services) => {

    if(services.length == 0){
      res.send({
        message: 'No services found'
      })
    }

    services.forEach((service) => {
      console.log('Found Proxy services');
      client.proxy.services(service.sid).sessions.list().then((sessions) => {

        if(sessions.length == 0){
          res.send({
            message: 'No sessions found'
          })
        }

        sessions.forEach((session) => {
          console.log('Found Sessions');
          client.proxy.services(service.sid).sessions(session.sid).participants.list().then((participants) => {

            if(participants.length == 0){
              res.send({
                message: 'No participants found'
              })
            }

            participants.forEach((participant) => {
              console.log('Found Participants');
              participant.remove().then(participant => console.log('Removed Participant'));
              res.send({
                message: 'Removed Participant.'
              });
            });
          });
        });
      });
    });
  });
});

app.get('/RetrieveChatHistory', (req, res) => {
  client.messages.list().then(messages => 
    res.send({
      chatHistory: messages
    })
  );
});

//Initiates the first SMS from Host or Cook
app.get('/CreateSMSChannel', (req, res) => {
  hostCookMap.set(req.query.from, req.query.to);

  sendSMS('You can start texting with ' + req.query.chatwith + ' via this number... ' + process.env.TWILIO_NUMBER, process.env.TWILIO_NUMBER, req.query.from);

  res.send({
    message: 'SMS initiation text sent to your number.'
  });
});

//Creates a proxy service for 3 way communication
app.get('/InitiateProxySession', (req, res) => {
  client.proxy.services.list().then((services) => {
    var participants = [{name: req.query.chatwith, no: req.query.to}, {name: req.query.whoAmI, no: req.query.from}];

    if(services.length == 0){
      console.log('No proxy services found. Creating one.');
      createProxyService(participants, res);
    }else{
      console.log('Found a proxy service.');
      services.forEach(s => getPhoneNumbers(s.sid, participants, res));
    }

  });
});

//This is the webhook for Twilio RecievedSMS event
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

function createProxyService(participants, res){
  client.proxy.services.create({uniqueName: 'TwilioProxyService'}).then((service) => {
    console.log('Created Proxy Service');
    getPhoneNumbers(service.sid, participants, res);
  });
}

function getProxySession(serviceSId, participants, res){
  client.proxy.services(serviceSId).sessions.list().then((sessions) => {
    if(sessions.length == 0){
      console.log('No session found. Creating one.');
      createProxySession(serviceSId, participants, res);
    }else{
      console.log('Found sessions');
      sessions.forEach(s => getParticipants(serviceSId, s.sid, participants, res));
    }
  });
}

function createProxySession(serviceSId, participants, res){
  client.proxy.services(serviceSId).sessions.create({uniqueName: 'TwilioProxySession'}).then((session) => {
    console.log('Created Proxy Session');
    getParticipants(serviceSId, session.sid, participants, res);
  });
}

function getParticipants(serviceSId, sessionSId, new_participants, res){
  client.proxy.services(serviceSId).sessions(sessionSId).participants.list().then((participants) => {
    if(participants.length == 0){ 
      console.log('No participants found. Creating one.');
      createParticipants(serviceSId, sessionSId, new_participants, res);
    }else{
      console.log('Found participants');

      participants.forEach(p => sendProxySMS(serviceSId, sessionSId, p.sid, 'You are connected!'));
    }
  });
}

function createParticipants(serviceSId, sessionSId, new_participants, res){

  new_participants.forEach((p) => {
    console.log('Creating participant ' + p.name);

    client.proxy.services(serviceSId).sessions(sessionSId).participants
            .create({friendlyName: p.name, identifier: p.no})
            .then((participant) => {
              console.log('Added participant: ' + participant.friendlyName);

              sendProxySMS(serviceSId, sessionSId, participant.sid, 'You are connected!');

            });
  });



  res.send({
    message: 'Finished configuring proxy.'
  });
}

function getPhoneNumbers(serviceSId, participants, res){
  client.proxy.services(serviceSId).phoneNumbers.list().then((phoneNumbers) => {
    if(phoneNumbers.length == 0){
      console.log('No phoneNumbers found. Creating one.');
      createPhoneNumber(serviceSId, participants, res);
    }else{
      console.log('Found phoneNumbers');
      getProxySession(serviceSId, participants, res);
    }
  });
}

function createPhoneNumber(serviceSId, participants, res){
  client.proxy.services(serviceSId).phoneNumbers.create({sid: process.env.TWILIO_NUMBER_SID}).then((phone_number) => {
    console.log('Created phone number');
    getProxySession(serviceSId, participants, res);
  });
}

function sendProxySMS(serviceSId, sessionSId, participantSId, message){
  console.log('Sending Proxy SMS' + message);
  client.proxy.services(serviceSId)
  .sessions(sessionSId)
  .participants(participantSId)
  .messageInteractions
  .create({body: message})
  .then(message_interaction => console.log('Sent Proxy SMS: ' + message_interaction.sid));
}