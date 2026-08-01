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
const { getAllAudioUrls } = require('google-tts-api');

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

  player.on(AudioPlayerStatus.Idle, () => processQueue(guildId));
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

  try {
    const resource = createAudioResource(next.url, { inlineVolume: false });
    s.player.play(resource);
  } catch (err) {
    console.error('Error playing audio resource:', err.message);
    processQueue(guildId);
  }
}

/**
 * Queue a TTS announcement in a voice channel. Joins if needed.
 * @param {import('discord.js').VoiceBasedChannel} voiceChannel
 * @param {string} text
 */
async function speak(voiceChannel, text) {
  const s = await ensureSession(voiceChannel);

  // Chunk text to TTS-friendly segments; each chunk is one URL/audio segment.
  const urls = getAllAudioUrls(sanitize(text), {
    lang: 'en',
    slow: false,
    host: 'https://translate.google.com',
  });

  for (const { url } of urls) {
    s.queue.push({ url });
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
