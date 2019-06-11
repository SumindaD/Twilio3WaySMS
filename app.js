const express = require('express')
const app = express()
const path = require('path');
const Twilio = require('twilio');

// Access Token used for Video, IP Messaging, and Sync
const AccessToken = Twilio.jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;
const VideoGrant = AccessToken.VideoGrant;


const port = 3000
app.use(express.static(path.join(__dirname, 'public')));
app.listen(port, () => console.log(`Example app listening on port ${port}!`))


app.get('/token', (req, res) => {
    //const id = req.params.id;
    console.log('Recieved Request');
    // Create an access token which we will sign and return to the client
  const token = new AccessToken(
    'AC22ef054e6b6df50d0c743fbe6da35b10',
    'SK175ae5f54c9790d8ec08ac6c0eab28c3',
    'LOdXR8TLYAnZ8UcnGgo3hwI7v6FoWUuD'
  );

  // Assign the provided identity or generate a new one
  token.identity = 'Sumi';

  // Grant the access token Twilio Video capabilities
  const videoGrant = new VideoGrant();
  token.addGrant(videoGrant);

  if (true) {
    // Create a "grant" which enables a client to use IPM as a given user,
    // on a given device
    const chatGrant = new ChatGrant({
      serviceSid: 'ISb6a5669b038e4c83952f0155221b62f8'
    });
    token.addGrant(chatGrant);
  }

  console.log('Got Token : ' + token.toJwt());
  // Serialize the token to a JWT string and include it in a JSON response
  res.send({
    identity: token.identity,
    token: token.toJwt()
  });

});