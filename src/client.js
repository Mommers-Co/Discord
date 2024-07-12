import { Client } from 'node-appwrite';

// Client side SDK
const client = new sdk.Client()
      .setEndpoint('https://cloud.appwrite.io/v1') // Your API Endpoint
      .setProject('5df5acd0d48c2') // Your project ID
      .setKey('919c2d18fb5d4...a2ae413da83346ad2'); // Your secret API key

    const messaging = new sdk.Messaging(client);

// Welcome Message
const welcomeMessageResponse = await messaging.createMessage(
  'main-entrance', // channel
  '<969241414561062946>', // channelId
  '<@user> joined the server!' // content
);

// Auditing Logs
const logResponse = await messaging.listMessageLogs(
  welcomeMessageResponse.$id, // messageId
  [] // queries (optional)
);

console.log(logResponse);