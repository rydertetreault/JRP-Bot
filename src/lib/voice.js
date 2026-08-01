'use strict';

/**
 * Jeff Ray's voice — VC audio engine + TTS.
 *
 * Design:
 *  - One voice connection per guild, with an announcement queue so
 *    overlapping sentences/verdicts play in order.
 *  - TTS via Google Translate TTS (free, no key). Text is chunked to fit the
 *    ~200-char limit; chunks stream back-to-back through one ffmpeg pipeline.
 *  - Jeff Ray joins, speaks, and leaves after a short idle grace period.
 */

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
} = require('@discordjs/voice');
const { Readable } = require('stream');


// TikTok TTS proxy — deep narrator voice ("Story Time" / en_male_narration).
// Falls back to Google TTS if unavailable.
const { getAudioUrl } = require('google-tts-api');

const TIKTOK_TTS_ENDPOINT = 'https://tiktok-tts.weilnet.workers.dev/api/generation';
const TIKTOK_VOICE = process.env.TTS_VOICE || 'en_male_narration';
const TIKTOK_CHUNK = 280; // endpoint text limit ~300 chars

const IDLE_LEAVE_MS = 30 * 1000;

// guildId -> { connection, player, queue: [], playing, idleTimer, channelId }
const sessions = new Map();

function getSession(guildId) {
  return sessions.get(guildId) || null;
}

async function ensureSession(voiceChannel) {
  const guildId = voiceChannel.guild.id;
  let s = sessions.get(guildId);

  if (s && s.channelId === voiceChannel.id && s.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    return s;
  }
  if (s) destroySession(guildId);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  connection.subscribe(player);

  s = { connection, player, queue: [], playing: false, idleTimer: null, channelId: voiceChannel.id };
  sessions.set(guildId, s);

  player.on(AudioPlayerStatus.Idle, (oldS) => {
    const dur = oldS.resource?.playbackDuration ?? '?';
    console.log(`[voice] finished resource after ${dur}ms of audio`);
    processQueue(guildId);
  });
  player.on('stateChange', (oldS, newS) => {
    if (oldS.status !== newS.status) {
      console.log(`[voice] player: ${oldS.status} -> ${newS.status}`);
    }
  });
  player.on('error', (err) => {
    console.error('[voice] player error:', err.message);
    processQueue(guildId);
  });

  connection.on('stateChange', (oldS, newS) => {
    if (oldS.status !== newS.status) {
      console.log(`[voice] connection: ${oldS.status} -> ${newS.status}`);
    }
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      destroySession(guildId);
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  return s;
}

function destroySession(guildId) {
  const s = sessions.get(guildId);
  if (!s) return;
  if (s.idleTimer) clearTimeout(s.idleTimer);
  try {
    s.player.stop(true);
    s.connection.destroy();
  } catch {
    /* already gone */
  }
  sessions.delete(guildId);
}

function scheduleLeave(guildId) {
  const s = sessions.get(guildId);
  if (!s) return;
  if (s.idleTimer) clearTimeout(s.idleTimer);
  s.idleTimer = setTimeout(() => {
    const cur = sessions.get(guildId);
    if (cur && !cur.playing && cur.queue.length === 0) destroySession(guildId);
  }, IDLE_LEAVE_MS);
}

function processQueue(guildId) {
  const s = sessions.get(guildId);
  if (!s) return;

  const next = s.queue.shift();
  if (!next) {
    s.playing = false;
    scheduleLeave(guildId);
    return;
  }

  s.playing = true;
  if (s.idleTimer) clearTimeout(s.idleTimer);

  // Resolve the queue item to an audio buffer, then pipe bytes to the player.
  // (ffmpeg must only ever see piped stdin — static ffmpeg 7.x segfaults on
  // https URL inputs.)
  fetchAudio(next)
    .then((buf) => {
      console.log(`[voice] playing resource: ${buf.length} bytes (${next.engine})`);
      const stream = Readable.from(buf);
      const resource = createAudioResource(stream, { inlineVolume: false });
      s.player.play(resource);
    })
    .catch((err) => {
      console.error('Error playing audio resource:', err.message);
      processQueue(guildId);
    });
}

/** Resolve a queue item ({engine, ...}) to an audio Buffer. */
async function fetchAudio(item) {
  if (item.engine === 'tiktok') {
    try {
      const res = await fetch(TIKTOK_TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.text, voice: TIKTOK_VOICE }),
      });
      if (!res.ok) throw new Error(`TikTok TTS ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.data) throw new Error(`TikTok TTS: ${data.error || 'no audio'}`);
      return Buffer.from(data.data, 'base64');
    } catch (err) {
      // Endpoint down — fall back to Google for this chunk and log it.
      console.error(`[voice] TikTok TTS failed (${err.message}), falling back to Google`);
      
      const url = getAudioUrl(item.text.slice(0, 200), { lang: 'en', slow: false });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google TTS fallback ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
  }
  // google item
  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`TTS fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Split text into chunks below the TikTok endpoint limit, on sentence/word boundaries. */
function chunkText(text, max) {
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = Math.max(
      rest.lastIndexOf('. ', max),
      rest.lastIndexOf('! ', max),
      rest.lastIndexOf('? ', max)
    );
    if (cut < max * 0.3) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * Queue a TTS announcement in a voice channel. Joins if needed.
 * @param {import('discord.js').VoiceBasedChannel} voiceChannel
 * @param {string} text
 */
async function speak(voiceChannel, text) {
  const s = await ensureSession(voiceChannel);
  const clean = sanitize(text);

  // TikTok deep narrator is primary; fetchAudio falls back to Google per-chunk.
  for (const chunk of chunkText(clean, TIKTOK_CHUNK)) {
    s.queue.push({ engine: 'tiktok', text: chunk });
  }

  if (!s.playing) processQueue(voiceChannel.guild.id);
}

/** Strip markdown/mentions so TTS doesn't read asterisks and IDs. */
function sanitize(text) {
  return text
    .replace(/<@!?(\d+)>/g, 'the defendant') // raw mentions → generic
    .replace(/<#\d+>/g, 'the channel')
    .replace(/[*_~`#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { speak, getSession, destroySession, sanitize };
