// ==================== AUDIO ENGINE (Web Speech API TTS) ====================
class AudioEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.isPlaying = false;
    this.rate = 1;
    this.voice = null;
    this.voiceEn = null;
    this.voiceEnUs = null;
    this.voiceEnUk = null;
    this.voiceZh = null;
    this.englishVariant = 'us';
    this.onEnd = null;
    this.onProgress = null;
    this.onBoundary = null;
    this._progressTimer = null;
    this._startTime = 0;
    this._estDuration = 0;
    this._speakToken = 0;
    this._pendingSpeakTimer = null;
    this._transitionGapMs = 120;
    this.isPaused = false;
    this._media = null;
    this._queue = [];
    this._queueIndex = 0;
    this._queueToken = 0;
    this._activeToken = 0;
    this._queueHooks = null;
    this._userPaused = false;
    this._playedCritical = false;
    this._trackSettled = false;
    this._lastTime = 0;
    this._selfSeek = false;
    this._sessionBound = false;
    this.onPlaybackChange = null;
    this.onMediaPlay = null;
    this.onMediaPrev = null;
    this.onMediaNext = null;
    // Optional src -> ready URL mapping (offline downloads are played from blob: URLs).
    this.resolveSrc = null;
    this._clip = null;
    this._clipToken = 0;
    this._enablePlaybackSession();
    this._initVoice();
  }

  _enablePlaybackSession() {
    const session = navigator.audioSession;
    if (!session) return;
    try { session.type = 'playback'; } catch (e) {}
  }

  _initVoice() {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      this.voiceEnUs = this._pickVoice(
        voices,
        ['en-us'],
        ['samantha', 'ava', 'allison', 'karen', 'susan', 'zoe', 'google us english', 'enhanced', 'premium', 'natural']
      );
      this.voiceEnUk = this._pickVoice(
        voices,
        ['en-gb'],
        ['uk english male', 'serena', 'kate', 'moira', 'google uk english', 'enhanced', 'premium', 'natural']
      );
      this.voiceEn = this.voiceEnUs || this.voiceEnUk || this._pickVoice(
        voices,
        ['en-us', 'en-gb', 'en'],
        ['samantha', 'ava', 'uk english male', 'serena', 'kate', 'moira', 'allison', 'google us english', 'google uk english', 'enhanced', 'premium', 'natural']
      ) || voices[0];
      this.voiceZh = this._pickVoice(
        voices,
        ['zh-cn', 'zh-hk', 'zh-tw', 'zh'],
        ['mei-jia', 'tingting', 'xiaoxiao', 'xiaoyi', 'sin-ji', 'yunxi', 'siri', 'female', 'google 中文', 'google 普通话', 'enhanced', 'premium', 'natural']
      ) || this.voiceEn;
      this.voice = this.voiceEn;
    };
    loadVoices();
    this.synth.onvoiceschanged = loadVoices;
  }

  _pickVoice(voices, langPrefixes, preferredNames) {
    const byLang = voices.filter(v => langPrefixes.some(p => v.lang.toLowerCase().startsWith(p)));
    for (const name of preferredNames) {
      const found = byLang.find(v => v.name.toLowerCase().includes(name));
      if (found) return found;
    }
    return byLang[0] || null;
  }

  _getEnglishVoice(variant = this.englishVariant) {
    if (variant === 'uk') return this.voiceEnUk || this.voiceEnUs || this.voiceEn;
    return this.voiceEnUs || this.voiceEnUk || this.voiceEn;
  }

  speak(text, onEnd, options = {}) {
    this.stop(true);
    const speakToken = ++this._speakToken;
    this.onEnd = onEnd;
    const lang = options.lang || 'en-US';
    const rate = typeof options.rate === 'number' ? options.rate : this.rate;
    const pitch = typeof options.pitch === 'number' ? options.pitch : 1;
    const volume = typeof options.volume === 'number' ? options.volume : 1;
    const isEnglish = lang.toLowerCase().startsWith('en');
    const variant = options.voiceVariant || this.englishVariant;
    const voice = lang.startsWith('zh') ? this.voiceZh : (isEnglish ? this._getEnglishVoice(variant) : this.voiceEn);
    this.utterance = new SpeechSynthesisUtterance(text);
    if (voice) this.utterance.voice = voice;
    this.utterance.rate = rate;
    this.utterance.pitch = pitch;
    this.utterance.volume = volume;
    this.utterance.lang = lang;

    this._estDuration = (text.length * 150) / rate;

    this.utterance.onend = () => {
      if (this._speakToken !== speakToken) return;
      this.isPlaying = false;
      this._stopProgress();
      if (this.onProgress) this.onProgress(100);
      if (this.onEnd) this.onEnd();
    };

    this.utterance.onerror = () => {
      if (this._speakToken !== speakToken) return;
      this.isPlaying = false;
      this._stopProgress();
    };

    this.utterance.onboundary = (e) => {
      if (this._speakToken !== speakToken) return;
      if (this.onBoundary) this.onBoundary(e);
    };

    if (this._pendingSpeakTimer) {
      clearTimeout(this._pendingSpeakTimer);
      this._pendingSpeakTimer = null;
    }
    this._pendingSpeakTimer = setTimeout(() => {
      if (this._speakToken !== speakToken) return;
      this._startTime = Date.now();
      this.synth.speak(this.utterance);
      this.isPlaying = true;
      this._startProgress();
      this._pendingSpeakTimer = null;
    }, this._transitionGapMs);
  }

  _startProgress() {
    this._stopProgress();
    this._progressTimer = setInterval(() => {
      if (!this.isPlaying) return;
      const elapsed = Date.now() - this._startTime;
      const pct = Math.min((elapsed / this._estDuration) * 100, 95);
      if (this.onProgress) this.onProgress(pct);
    }, 50);
  }

  _stopProgress() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  // keepSource: playQueue() sets the next file straight away, so the element is only paused.
  stop(silent = false, keepSource = false) {
    if (this._pendingSpeakTimer) {
      clearTimeout(this._pendingSpeakTimer);
      this._pendingSpeakTimer = null;
    }
    this._speakToken++;
    this._queueToken++;
    this._queue = [];
    this._queueIndex = 0;
    this._queueHooks = null;
    this._userPaused = false;
    this._playedCritical = false;
    this.isPaused = false;
    if (this._media) {
      this._media.dataset.token = '0';
      this._media.pause();
      if (!keepSource) this._media.removeAttribute('src');
    }
    this.stopClip();
    this.synth.cancel();
    this.isPlaying = false;
    this._stopProgress();
    this._setSessionState('none');
    if (!silent && this.onProgress) this.onProgress(0);
  }

  pause() {
    if (this._queue.length && this._media) {
      this._userPaused = true;
      this.isPlaying = false;
      this.isPaused = true;
      this._media.pause();
      this._setSessionState('paused');
      this._notifyPlayback(false);
      return;
    }
    this.synth.pause();
    this.isPlaying = false;
    this.isPaused = true;
    this._notifyPlayback(false);
  }

  resume() {
    if (this._queue.length && this._media) {
      this._userPaused = false;
      this.isPaused = false;
      this.isPlaying = true;
      const track = this._queue[this._queueIndex];
      this._applyRate(track);
      const pending = this._media.play();
      if (pending && pending.catch) pending.catch(() => {});
      this._setSessionState('playing');
      this._notifyPlayback(true);
      return;
    }
    this.synth.resume();
    this.isPlaying = true;
    this.isPaused = false;
    this._notifyPlayback(true);
  }

  hasMediaQueue() {
    return this._queue.length > 0 && (this.isPlaying || this.isPaused);
  }

  playQueue(tracks, hooks = {}) {
    this.stop(true, true);
    this._queue = tracks.slice();
    this._queueIndex = 0;
    this._queueHooks = hooks;
    this._activeToken = ++this._queueToken;
    this._playedCritical = false;
    this._userPaused = false;
    this.isPaused = false;
    this.isPlaying = this._queue.length > 0;
    this._ensureMedia();
    const titled = this._queue.find(track => track.title);
    if (titled) this._updateSessionMetadata(titled);
    this._playTrack();
    this._notifyPlayback(this.isPlaying);
  }

  setRate(rate) {
    this.rate = rate;
  }

  setEnglishVariant(variant) {
    this.englishVariant = variant === 'uk' ? 'uk' : 'us';
  }

  _getSpokenSingleLetter(letter, variant = this.englishVariant) {
    const names = {
      a: 'ay',
      b: 'bee',
      c: 'see',
      d: 'dee',
      e: 'ee',
      f: 'ef',
      g: 'gee',
      h: 'aitch',
      i: 'eye',
      j: 'jay',
      k: 'kay',
      l: 'el',
      m: 'em',
      n: 'en',
      o: 'oh',
      p: 'pee',
      q: 'cue',
      r: 'ar',
      s: 'ess',
      t: 'tee',
      u: 'you',
      v: 'vee',
      w: 'double you',
      x: 'ex',
      y: 'why',
      z: variant === 'uk' ? 'zed' : 'zee'
    };
    return names[(letter || '').toLowerCase()] || letter;
  }

  _normalizeWordSpeechText(word, variant = this.englishVariant) {
    const raw = (word || '').trim();
    const lower = raw.toLowerCase();
    const compact = lower.replace(/[^a-z]/g, '');
    const aliasMap = {
      qa: 'Q and A',
      qna: 'Q and A',
      rd: 'R and D',
      ma: 'M and A'
    };

    if (lower === 'a') return 'uh';
    if (lower === 'i') return 'eye';
    if (aliasMap[lower]) return aliasMap[lower];
    if (aliasMap[compact] && compact.length <= 3) return aliasMap[compact];
    if (/^[a-z]$/i.test(raw)) return this._getSpokenSingleLetter(raw, variant);

    return raw;
  }

  speakWord(word, onEnd, options = {}) {
    if (this._pendingSpeakTimer) {
      clearTimeout(this._pendingSpeakTimer);
      this._pendingSpeakTimer = null;
    }
    this._speakToken++;
    this.synth.cancel();
    const variant = options.voiceVariant || this.englishVariant;
    const speakText = this._normalizeWordSpeechText(word, variant);
    const utt = new SpeechSynthesisUtterance(speakText);
    const voice = this._getEnglishVoice(variant);
    if (voice) utt.voice = voice;
    utt.rate = 0.8; // Speak words slowly for clarity
    utt.pitch = 1.02;
    utt.volume = 1;
    utt.lang = variant === 'uk' ? 'en-GB' : 'en-US';
    utt.onend = () => { if (onEnd) onEnd(); };
    utt.onerror = () => { if (onEnd) onEnd(); };
    this.synth.speak(utt);
  }

  // Plays one short recorded clip (a word) on its own element, so the sentence queue is untouched.
  // onEnd(true) when it finished, onEnd(false) if it could not be played.
  playClip(src, onEnd, options = {}) {
    if (!this._clip) {
      this._clip = new Audio();
      this._clip.preload = 'auto';
      this._clip.setAttribute('playsinline', '');
    }
    const el = this._clip;
    const token = ++this._clipToken;
    let guard = null;
    const done = ok => {
      if (token !== this._clipToken) return;
      this._clipToken++;
      clearTimeout(guard);
      el.onended = null;
      el.onerror = null;
      el.onloadedmetadata = null;
      if (onEnd) onEnd(ok);
    };
    el.onended = () => done(true);
    el.onerror = () => done(false);
    // Safety net: if 'ended' never arrives (stalled load, interrupted session), finish anyway
    // so callers waiting on the clip (shadowing, compare, word card) do not hang.
    guard = setTimeout(() => done(false), 10000);
    el.onloadedmetadata = () => {
      if (token !== this._clipToken || !Number.isFinite(el.duration)) return;
      clearTimeout(guard);
      guard = setTimeout(() => done(true), (el.duration / (el.playbackRate || 1)) * 1000 + 1500);
    };
    el.src = (this.resolveSrc && this.resolveSrc(src)) || src;
    const rate = typeof options.rate === 'number' ? Math.min(2, Math.max(0.5, options.rate)) : 1;
    try {
      el.preservesPitch = true;
      el.defaultPlaybackRate = rate;
      el.playbackRate = rate;
    } catch (e) {}
    const pending = el.play();
    if (pending && pending.catch) pending.catch(() => done(false));
  }

  stopClip() {
    if (!this._clip) return;
    this._clipToken++;
    this._clip.onended = null;
    this._clip.onerror = null;
    this._clip.onloadedmetadata = null;
    this._clip.pause();
  }

  playPromptSound(callback) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return callback();
      const ctx = new Ctx();
      
      const playNote = (freq, time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.start(time);
        osc.stop(time + 0.2);
      };
      
      playNote(880, ctx.currentTime); // A5 note
      playNote(1108.73, ctx.currentTime + 0.15); // C#6 note
      
      setTimeout(() => {
        ctx.close().catch(() => {});
        callback();
      }, 400); // Trigger callback after sound finishes
    } catch(e) {
      callback();
    }
  }

  _ensureMedia() {
    if (this._media) return this._media;
    let el = document.getElementById('bgPlayer');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'bgPlayer';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    // A clip that plays to its natural end closes the audio session in an iOS Home Screen web
    // app. In the background (switched to another app, not locked) iOS then refuses the next
    // play(), so playback stopped after one clip. With loop on, a clip never ends: it jumps
    // back to 0:00, and that jump (a 'seeking' event) is taken as the end of the clip. The next
    // file is set in the same event, while the session is still open. See WebKit bug 261858.
    el.loop = true;
    this._media = el;
    el.addEventListener('ended', () => this._onMediaEnded());
    el.addEventListener('seeking', () => this._onMediaSeeking());
    el.addEventListener('pause', () => this._onMediaPause());
    el.addEventListener('play', () => this._onMediaPlay());
    el.addEventListener('error', () => this._onMediaError());
    el.addEventListener('timeupdate', () => this._onMediaTime());
    document.addEventListener('visibilitychange', () => this._onVisibility());
    window.addEventListener('pagehide', () => this._onVisibility());
    this._bindMediaSession();
    return el;
  }

  _applyRate(track) {
    if (!this._media) return;
    const requested = track && typeof track.rate === 'number' ? track.rate : 1;
    const rate = Math.min(2, Math.max(0.5, requested));
    try {
      this._media.playbackRate = rate;
      this._media.preservesPitch = true;
    } catch (e) {}
  }

  _playTrack() {
    const token = this._activeToken;
    const track = this._queue[this._queueIndex];
    if (!track) {
      this._finishQueue();
      return;
    }
    this._trackSettled = false;
    this._lastTime = 0;
    this._selfSeek = false;
    const el = this._ensureMedia();
    el.dataset.token = String(token);
    if (track.title) this._updateSessionMetadata(track);
    // A downloaded copy (blob: URL) wins over the network file.
    const src = (this.resolveSrc && this.resolveSrc(track.src)) || track.src;
    const absolute = new URL(src, window.location.href).href;
    const start = () => {
      if (this._activeToken !== token) return;
      this._applyRate(track);
      const pending = el.play();
      this._setSessionState('playing');
      if (pending && pending.then) {
        pending.then(() => {
          if (this._activeToken !== token) return;
          this._applyRate(track);
          if (track.critical) this._playedCritical = true;
        }).catch(() => {
          if (this._activeToken !== token) return;
          this._onMediaError();
        });
      }
    };
    if (el.src === absolute) {
      // Same file again (the gap clip in a role-play turn): right after a wrap it is already
      // at the start. Otherwise rewind, and mark the seek so it is not taken for a wrap.
      if (el.currentTime > 0.05) {
        this._selfSeek = true;
        try { el.currentTime = 0; } catch (e) { this._selfSeek = false; }
      }
      start();
      return;
    }
    el.onloadedmetadata = () => {
      if (this._activeToken !== token) return;
      this._applyRate(track);
    };
    el.src = src;
    start();
  }

  _mediaEventIsCurrent() {
    if (this._activeToken !== this._queueToken) return false;
    if (!this._media || !this._queue.length) return false;
    return this._media.dataset.token === String(this._activeToken);
  }

  // The looping element jumped back to the start: the clip has finished (see _ensureMedia).
  // The player itself only seeks in _playTrack, and marks that seek.
  _onMediaSeeking() {
    if (this._selfSeek) {
      this._selfSeek = false;
      return;
    }
    this._onMediaEnded();
  }

  // The system paused the clip (another app's audio, a phone call). Without this the player
  // still counted as playing, so the lock-screen play button did nothing.
  _onMediaPause() {
    const el = this._media;
    if (!el || !el.paused) return; // playing again already: a switch to the next clip
    if (!this._mediaEventIsCurrent() || this._userPaused || !this.isPlaying) return;
    this._userPaused = true;
    this.isPlaying = false;
    this.isPaused = true;
    this._setSessionState('paused');
    this._notifyPlayback(false);
  }

  // The system resumed by itself after a short interruption.
  _onMediaPlay() {
    if (!this._mediaEventIsCurrent() || !this.isPaused || this._media.paused) return;
    this._userPaused = false;
    this.isPaused = false;
    this.isPlaying = true;
    this._setSessionState('playing');
    this._notifyPlayback(true);
  }

  // Also reached through _onMediaSeeking and _onMediaTime, as a looping clip never fires 'ended'.
  _onMediaEnded() {
    if (!this._mediaEventIsCurrent()) return;
    if (this._userPaused || this._trackSettled) return;
    this._trackSettled = true;
    const track = this._queue[this._queueIndex];
    if (track && track.critical) this._playedCritical = true;
    this._advanceQueue();
  }

  _onMediaError() {
    if (!this._mediaEventIsCurrent()) return;
    if (this._trackSettled) return;
    this._trackSettled = true;
    const track = this._queue[this._queueIndex];
    if (track && track.critical && !this._playedCritical) {
      const fallback = this._queueHooks && this._queueHooks.onFallback;
      this._queueToken++;
      this._queue = [];
      this._queueHooks = null;
      this.isPlaying = false;
      this.isPaused = false;
      if (this._media) this._media.pause();
      this._setSessionState('none');
      if (fallback) fallback();
      return;
    }
    this._advanceQueue();
  }

  _advanceQueue() {
    this._queueIndex += 1;
    if (this._queueIndex >= this._queue.length) {
      this._finishQueue();
      return;
    }
    this._playTrack();
  }

  _finishQueue() {
    const hooks = this._queueHooks;
    const token = this._queueToken;
    this._queue = [];
    this._queueHooks = null;
    this.isPlaying = false;
    this.isPaused = false;
    this._setSessionState('none');
    this._notifyPlayback(false);
    if (hooks && hooks.onEnd) hooks.onEnd();
    // The element loops, so the last clip would keep sounding. Pausing keeps the audio session
    // open; skip it when onEnd already started the next queue.
    if (this._queueToken === token && this._media) this._media.pause();
  }

  _onMediaTime() {
    const el = this._media;
    if (!el) return;
    const t = el.currentTime;
    if (this._selfSeek && !el.seeking && t > 0.05) this._selfSeek = false;
    // Backup for a wrap whose 'seeking' event did not arrive: the time went backwards.
    if (!this._selfSeek && !el.seeking && this._lastTime - t > 0.1) {
      this._lastTime = 0;
      this._onMediaEnded();
      return;
    }
    this._lastTime = t;
    if (!this.onProgress) return;
    const duration = el.duration;
    if (!duration || !Number.isFinite(duration)) return;
    this.onProgress(Math.min(100, (this._media.currentTime / duration) * 100));
  }

  _onVisibility() {
    if (!document.hidden) return;
    if (!this._queue.length || this._userPaused || !this.isPlaying) return;
    const el = this._media;
    if (!el || !el.paused || el.ended) return;
    const pending = el.play();
    if (pending && pending.catch) pending.catch(() => {});
  }

  _updateSessionMetadata(track) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'ListenPro',
      artist: 'ListenPro',
      album: 'English Listening'
    });
  }

  _setSessionState(state) {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = state; } catch (e) {}
  }

  _notifyPlayback(playing) {
    if (this.onPlaybackChange) this.onPlaybackChange(playing);
  }

  _bindMediaSession() {
    if (this._sessionBound || !('mediaSession' in navigator)) return;
    this._sessionBound = true;
    const session = navigator.mediaSession;
    const bind = (name, handler) => {
      try { session.setActionHandler(name, handler); } catch (e) {}
    };
    bind('play', () => {
      if (this._queue.length && this._media && this._media.paused) this.resume();
      else if (!this.isPlaying && this.onMediaPlay) this.onMediaPlay();
    });
    bind('pause', () => {
      if (this.isPlaying) this.pause();
    });
    bind('previoustrack', () => {
      if (this.onMediaPrev) this.onMediaPrev();
    });
    bind('nexttrack', () => {
      if (this.onMediaNext) this.onMediaNext();
    });
  }
}
