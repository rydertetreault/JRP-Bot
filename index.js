// Discloud entry point — loads env then starts the bot
require('dotenv').config({ path: require('path').join(__dirname, 'env.txt') });
require('dotenv').config();
require('./src/index.js');
