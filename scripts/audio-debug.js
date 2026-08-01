'use strict';
// Container audio pipeline diagnostic: node scripts/audio-debug.js
const { getAudioUrl } = require('google-tts-api');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const { Readable } = require('stream');

(async () => {
  const url = getAudioUrl('Order in the court. For the J R P, by the J R P.', { lang: 'en' });
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('1. TTS fetch:', res.status, buf.length, 'bytes');

  const ff = spawn(ffmpegPath, ['-i', 'pipe:0', '-f', 'opus', '-ar', '48000', '-ac', '2', 'pipe:1']);
  Readable.from(buf).pipe(ff.stdin);
  let out = 0;
  let err = '';
  ff.stdout.on('data', (d) => (out += d.length));
  ff.stderr.on('data', (d) => (err += d.toString()));
  ff.on('close', (code, signal) => {
    console.log('2. ffmpeg exit code:', code, 'signal:', signal);
    console.log('3. opus bytes out:', out, out > 10000 ? '✓ WORKS' : '✗ BROKEN');
    if (out <= 10000) console.log('stderr tail:', err.split('\n').slice(-6).join('\n'));
  });
})().catch((e) => console.error('FATAL:', e.message));
