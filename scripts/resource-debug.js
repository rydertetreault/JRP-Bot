'use strict';
// Test the EXACT pipeline discord.js voice uses: createAudioResource -> prism ffmpeg -> opus
const { createAudioResource } = require('@discordjs/voice');
const { getAudioUrl } = require('google-tts-api');
const { Readable } = require('stream');

(async () => {
  const url = getAudioUrl('testing one two three', { lang: 'en' });
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('mp3 bytes:', buf.length);

  const resource = createAudioResource(Readable.from(buf));
  let packets = 0;
  resource.playStream.on('data', () => packets++);
  resource.playStream.on('end', () =>
    console.log('opus packets:', packets, packets > 50 ? '✓ RESOURCE OK' : '✗ DIES EARLY')
  );
  resource.playStream.on('error', (e) => console.log('stream error:', e.message));
  resource.playStream.on('close', () => console.log('closed. packets:', packets));
  setTimeout(() => { console.log('timeout. packets:', packets); process.exit(0); }, 12000);
})().catch((e) => console.error('FATAL:', e.message));
