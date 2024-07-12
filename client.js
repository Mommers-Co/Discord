const sdk = new appwrite.Client();
process.env = require('./config.json');

sdk
    .setEndpoint(process.env.appwrite.APPWRITE_ENDPOINT)
    .setProject(process.env.appwrite.APPWRITE_PROJECT_ID)
    .setKey(process.env.appwrite.APPWRITE_API_KEY);
