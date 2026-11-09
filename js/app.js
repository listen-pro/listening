// ==================== MAIN APPLICATION ====================
(function() {
  'use strict';

  // ---- Topics ----
  // TOPICS comes from js/topics.js. Sentences whose topic is missing or unknown
  // are collected under a generated "other" topic so they never disappear.
  const LEVELS = ['elementary', 'intermediate', 'advanced'];
  const LEVEL_CEFR = { elementary: 'A1–A2', intermediate: 'B1–B2', advanced: 'C1–C2' };
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
  const FONT_MIN = 14;
  const FONT_MAX = 26;

  const topicList = (typeof TOPICS !== 'undefined' && Array.isArray(TOPICS) ? TOPICS : []).slice();
  const topicIds = new Set(topicList.map(t => t.id));
  if (SENTENCES.some(s => !topicIds.has(s.topic))) {
    topicList.push({ id: 'other', scene: 'daily', icon: 'ri-more-line', hue: 230, name: { zh: '其他', en: 'Other' } });
    topicIds.add('other');
  }
  const topicOf = s => (topicIds.has(s.topic) ? s.topic : 'other');
  const topicCounts = {};
  SENTENCES.forEach(s => { const t = topicOf(s); topicCounts[t] = (topicCounts[t] || 0) + 1; });
  const visibleTopics = topicList.filter(t => topicCounts[t.id] > 0);
  const topicById = id => visibleTopics.find(t => t.id === id) || null;

  function readSavedTopic() {
    const saved = localStorage.getItem('lp_topic');
    return saved === 'all' || topicById(saved) ? saved : 'all';
  }

  // How many times each line plays before moving on. 1 = in order, 0 = repeat forever.
  const REPEAT_OPTIONS = [1, 2, 3, 5, 0];
  function readSavedRepeat() {
    const saved = parseInt(localStorage.getItem('lp_repeat'), 10);
    return REPEAT_OPTIONS.includes(saved) ? saved : 1;
  }

  // What happens after the last line. 'all' = go on to the next topic (the last topic
  // leads back to the first), 'topic' = start the current topic over.
  const LOOP_SCOPES = ['all', 'topic'];
  function readSavedLoopScope() {
    const saved = localStorage.getItem('lp_loopScope');
    return LOOP_SCOPES.includes(saved) ? saved : 'all';
  }

  function readSavedLevel() {
    const saved = localStorage.getItem('lp_level');
    return saved === 'all' || LEVELS.includes(saved) ? saved : 'all';
  }

  // Listening stats. listenedSec counts only time with audio actually playing; days holds
  // seconds per local date (YYYY-MM-DD) for "today" and the streak; heard lists line ids
  // that were played to the end at least once; sentencesPlayed counts finished reads.
  // Older saves (totalTime = minutes the page was open, sessionsCount) are dropped.
  function readSavedStats() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('lp_stats') || '{}') || {}; } catch (_) {}
    return {
      listenedSec: Number(saved.listenedSec) || 0,
      days: saved.days && typeof saved.days === 'object' ? saved.days : {},
      heard: Array.isArray(saved.heard) ? saved.heard : [],
      sentencesPlayed: Number(saved.sentencesPlayed) || 0
    };
  }

  // Last line reached in each topic ({ topicId: sentenceId }), so the app reopens where the
  // learner stopped. A topic that is played to the end is forgotten and starts from the top.
  const POSITIONS_KEY = 'lp_positions';
  function readSavedPositions() {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (_) {
      return {};
    }
  }

  // State
  const state = {
    sentences: [...SENTENCES],
    filtered: [...SENTENCES],
    currentIndex: -1,
    topic: readSavedTopic(),
    levelFilter: readSavedLevel(),
    repeat: readSavedRepeat(),
    loopScope: readSavedLoopScope(),
    playsDone: 0,
    positions: readSavedPositions(),
    speed: parseFloat(localStorage.getItem('lp_speed') || '0.75'),
    fontSize: parseInt(localStorage.getItem('lp_fontSize') || '18'),
    loopTimer: null,
    wordbook: JSON.parse(localStorage.getItem('lp_wordbook') || '[]'),
    stats: readSavedStats(),
    blind: localStorage.getItem('lp_blind') === 'true',
    revealedId: null,
    // Role play: the speaker the learner takes ('A' / 'B'), or null.
    role: ['A', 'B'].includes(localStorage.getItem('lp_role')) ? localStorage.getItem('lp_role') : null,
    practiceTab: localStorage.getItem('lp_practiceTab') === 'dictation' ? 'dictation' : 'shadow',
    lang: localStorage.getItem('lp_lang') || 'en',
    showCn: localStorage.getItem('lp_showCn') === 'true',
    speakCn: localStorage.getItem('lp_speakCn') === 'true',
    accent: localStorage.getItem('lp_accent') || 'us',
    theme: localStorage.getItem('lp_theme') || 'dark',
    renderedCount: 0
  };

  const i18n = {
    en: {
      allTopics: "All topics", topicsTitle: "Choose a topic", topicsSub: "Pick a scene to practise",
      sceneDaily: "Daily life", sceneBusiness: "Business", sceneIt: "IT",
      allLevels: "All levels", levelTitle: "Level",
      unitSentences: n => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
      unitTopics: n => `${n} topics`,
      speedTitle: "Speed",
      speedNames: { 0.5: "Very slow", 0.75: "Slow", 1: "Normal", 1.25: "Fast", 1.5: "Very fast" },
      speedNext: v => `${v}× from the next sentence`,
      modeTitle: "Playback", sequential: "Play in order", sequentialDesc: "Each line once, then the next",
      loopTimes: n => `Repeat each line ×${n}`, loopForever: "Repeat one forever",
      loopDesc: "Then moves to the next line", foreverDesc: "Stays on the current line",
      backToCurrent: "Now playing",
      replay: "Replay", translation: "Translation",
      emptyList: "No sentences here yet", emptyAction: "Show all levels",
      resumeAt: n => `Picking up at line ${n}`,
      tipWord: "Tip: tap a word in the highlighted line to look it up",
      menuTitle: "Me", profileSub: "Keep your ears warm",
      statsToday: "Today", statsStreak: "Day streak", statsHeard: "Lines heard", statsWords: "Saved words",
      unitMin: "min", unitDay: "days",
      statsTotals: (dur, n) => `${dur} listened in total · ${n} reads finished`,
      durationMin: m => `${m} min`, durationHourMin: (h, m) => `${h} h ${m} min`,
      groupListening: "Listening", groupDisplay: "Display",
      blindLabel: "Blind listening", blindShort: "Blind",
      blindHint: "Hide the English text. Listen first, then tap a line to check it.",
      blindOn: "Blind listening on: tap a line to show it", blindOff: "Text shown",
      revealText: "Tap to show the text",
      sleepLabel: "Sleep timer", sleepOff: "Off", sleepTopic: "End of topic",
      sleepMinutes: m => `${m} min`, sleepLeft: m => `${m} min left`, sleepTopicLeft: "Stops after this topic",
      sleepCancelled: "Sleep timer off", sleepDone: "Sleep timer: playback paused",
      offlineLabel: "Offline audio", offlineClear: "Delete all",
      offlineDownload: "Download this topic for offline listening", offlineResume: "Finish downloading this topic",
      offlineLoading: "Downloading…", offlineReady: "Downloaded. Plays without network",
      offlineDone: name => `${name} downloaded. It plays without network`,
      offlineFailed: n => `${n} files failed. Check the network and try again`,
      offlineRemoved: "Offline audio deleted",
      offlineConfirmRemove: name => `Delete the offline audio for ${name}?`,
      offlineConfirmClear: "Delete all offline audio?",
      offlineEmpty: "Nothing downloaded yet. Use the download button next to a topic's title.",
      offlineSummary: (size, topics) => `${size} used${topics.length ? ' · ' + topics.join(', ') : ''}`,
      offlineUnsupported: "This browser can't keep audio offline",
      offlineNoCatalog: "Open the app online once first",
      practiceTitle: "Practise this line", practiceShort: "Practise",
      shadowTab: "Shadowing", dictationTab: "Dictation",
      playOriginal: "Original", playMine: "My take", playCompare: "Compare",
      recHint: "Tap the mic: hear the line once, then say it",
      recListenFirst: "Listen first…", recRecording: "Recording… tap to stop",
      recDone: "Recorded. Tap Compare to hear the difference",
      recDenied: "Microphone access was denied", recUnsupported: "This browser can't record audio",
      dictPlay: "Play", dictSlow: "Slower", dictCheck: "Check", dictNext: "Next line",
      dictPlaceholder: "Type what you hear",
      dictScore: (c, n) => `${c} of ${n} words right`, dictExtra: "Extra words:",
      roleLabel: "Role play", roleOff: "Off", roleA: "I'm A", roleB: "I'm B",
      roleHint: "Your lines are not read aloud. Playback pauses so you can say them, then the dialogue goes on.",
      roleYourLine: "Your line", roleOn: r => `Role play: you are ${r}`, roleOffToast: "Role play off",
      speakCnLabel: "Read Chinese aloud", speakCnHint: "After each English line, also play its Chinese translation.",
      speakCnOn: "Chinese read-aloud on", speakCnOff: "English only",
      loopScopeLabel: "Loop", loopScopeTopic: "This topic",
      loopScopeHint: "All topics: when a topic ends, the next one starts, and the last leads back to the first. This topic: start the same topic over.",
      themeLabel: "Theme", themeDark: "Dark", themeLight: "Light",
      fontLabel: "Text size",
      wordbookTitle: "Word Book", wordbookCount: n => `${n} saved`,
      noDef: "No definition available",
      noWords: "No words saved yet.<br>Tap a word in a sentence, then tap the star.",
      lvl_elementary: "Elementary", lvl_intermediate: "Intermediate", lvl_advanced: "Advanced",
      accentLabel: "Accent", accentUs: "US", accentUk: "UK",
      installTitle: "Install App",
      installDescNative: "Add this app to your home screen for a faster fullscreen experience.",
      installDescIosSafari: "Tap Share, then choose Add to Home Screen.",
      installDescIosOther: "Open in Safari, tap Share, then choose Add to Home Screen.",
      installNow: "Install Now",
      installLater: "Later",
      language: "Language",
      logout: "Log out",
      keyPlay: "Play / Pause", keyNav: "Previous / Next",
      npLabel: "Current line", upNext: "Up next", lastLine: "This is the last line",
      speaker: s => `Speaker ${s}`, revealCn: "Click to show the translation",
      sideUserSub: "Settings & stats",
      titleMode: "Play mode", titlePrev: "Previous", titleNext: "Next", titlePlay: "Play / Pause", titleSpeed: "Speed"
    },
    zh: {
      allTopics: "全部话题", topicsTitle: "选择话题", topicsSub: "挑一个场景开始练习",
      sceneDaily: "日常生活", sceneBusiness: "职场商务", sceneIt: "IT",
      allLevels: "全部难度", levelTitle: "难度",
      unitSentences: n => `${n} 句`,
      unitTopics: n => `${n} 个话题`,
      speedTitle: "语速",
      speedNames: { 0.5: "很慢", 0.75: "慢速", 1: "正常", 1.25: "稍快", 1.5: "很快" },
      speedNext: v => `${v}× 从下一句开始生效`,
      modeTitle: "播放方式", sequential: "顺序播放", sequentialDesc: "每句读一遍，接着下一句",
      loopTimes: n => `单句循环 ${n} 遍`, loopForever: "单句无限循环",
      loopDesc: "读满后自动进入下一句", foreverDesc: "一直重复当前句",
      backToCurrent: "回到当前句",
      replay: "重播", translation: "译文",
      emptyList: "这里还没有句子", emptyAction: "查看全部难度",
      resumeAt: n => `从第 ${n} 句继续`,
      tipWord: "提示：点按高亮句子里的单词即可查词",
      menuTitle: "我的", profileSub: "每天听一点，耳朵会记住",
      statsToday: "今日收听", statsStreak: "连续天数", statsHeard: "已听句子", statsWords: "收藏生词",
      unitMin: "分钟", unitDay: "天",
      statsTotals: (dur, n) => `累计收听 ${dur} · 完成 ${n} 句次`,
      durationMin: m => `${m} 分钟`, durationHourMin: (h, m) => `${h} 小时 ${m} 分钟`,
      groupListening: "听力", groupDisplay: "显示",
      blindLabel: "盲听模式", blindShort: "盲听",
      blindHint: "隐藏英文原文。先听，再点按句子核对。",
      blindOn: "已开启盲听：点按句子显示原文", blindOff: "已显示原文",
      revealText: "点按显示原文",
      sleepLabel: "定时关闭", sleepOff: "关闭", sleepTopic: "本话题播完",
      sleepMinutes: m => `${m} 分钟`, sleepLeft: m => `还剩 ${m} 分钟`, sleepTopicLeft: "本话题播完后停止",
      sleepCancelled: "已取消定时", sleepDone: "定时已到，已暂停播放",
      offlineLabel: "离线音频", offlineClear: "全部删除",
      offlineDownload: "下载本话题，离线也能听", offlineResume: "继续下载本话题",
      offlineLoading: "正在下载…", offlineReady: "已下载，无网络也能播放",
      offlineDone: name => `「${name}」已下载，可离线播放`,
      offlineFailed: n => `${n} 个文件下载失败，请联网后重试`,
      offlineRemoved: "已删除离线音频",
      offlineConfirmRemove: name => `删除「${name}」的离线音频？`,
      offlineConfirmClear: "删除全部离线音频？",
      offlineEmpty: "还没有下载。点话题标题旁的下载按钮，离线也能听。",
      offlineSummary: (size, topics) => `已占用 ${size}${topics.length ? ' · ' + topics.join('、') : ''}`,
      offlineUnsupported: "当前浏览器不支持离线保存音频",
      offlineNoCatalog: "请先联网打开一次",
      practiceTitle: "练习这句", practiceShort: "练习",
      shadowTab: "跟读", dictationTab: "听写",
      playOriginal: "原声", playMine: "我的录音", playCompare: "对比",
      recHint: "点麦克风：先听一遍原声，再跟着说",
      recListenFirst: "先听原声…", recRecording: "录音中… 点击停止",
      recDone: "录好了，点「对比」听听差别",
      recDenied: "没有麦克风权限", recUnsupported: "当前浏览器不支持录音",
      dictPlay: "播放", dictSlow: "慢速", dictCheck: "核对", dictNext: "下一句",
      dictPlaceholder: "听到什么就写什么",
      dictScore: (c, n) => `${n} 个词写对 ${c} 个`, dictExtra: "多写的词：",
      roleLabel: "角色扮演", roleOff: "关闭", roleA: "我演 A", roleB: "我演 B",
      roleHint: "你的台词不播放，留出时间让你说，之后对话继续。",
      roleYourLine: "你的台词", roleOn: r => `角色扮演：你是 ${r}`, roleOffToast: "已关闭角色扮演",
      speakCnLabel: "朗读中文", speakCnHint: "每句英文读完后，再读一遍中文翻译。",
      speakCnOn: "已开启中文朗读", speakCnOff: "只读英文",
      loopScopeLabel: "循环范围", loopScopeTopic: "当前话题",
      loopScopeHint: "全部话题：一个话题播完自动进入下一个，最后一个播完回到第一个。当前话题：播完后从第一句重新开始。",
      themeLabel: "主题", themeDark: "深色", themeLight: "浅色",
      fontLabel: "字号",
      wordbookTitle: "生词本", wordbookCount: n => `已收藏 ${n} 个`,
      noDef: "暂无释义",
      noWords: "还没有收藏单词。<br>点按句子里的单词，再点星标即可收藏。",
      lvl_elementary: "入门级", lvl_intermediate: "进阶级", lvl_advanced: "高级",
      accentLabel: "口音", accentUs: "美音", accentUk: "英音",
      installTitle: "添加到桌面",
      installDescNative: "将应用添加到桌面，获得更快的全屏使用体验。",
      installDescIosSafari: "点击下方分享按钮，再选择“添加到主屏幕”。",
      installDescIosOther: "请先在 Safari 打开，再点击分享并选择“添加到主屏幕”。",
      installNow: "立即安装",
      installLater: "稍后",
      language: "界面语言",
      logout: "退出登录",
      keyPlay: "播放 / 暂停", keyNav: "上一句 / 下一句",
      npLabel: "当前句子", upNext: "下一句", lastLine: "已经是最后一句",
      speaker: s => `角色 ${s}`, revealCn: "点击显示译文",
      sideUserSub: "设置与统计",
      titleMode: "播放模式", titlePrev: "上一句", titleNext: "下一句", titlePlay: "播放 / 暂停", titleSpeed: "语速"
    }
  };
  const t = key => {
    const pack = i18n[state.lang] || i18n.en;
    return pack[key] !== undefined ? pack[key] : i18n.en[key];
  };

  const audio = new AudioEngine();
  // Offline downloads and lines fetched ahead are handed to the player as blob: URLs (see js/offline.js).
  const offline = typeof OfflineAudio !== 'undefined' && OfflineAudio.supported ? OfflineAudio : null;
  if (offline) audio.resolveSrc = src => offline.resolve(src);

  // The last catalog seen is kept so a cold start without network still knows which files exist.
  const CATALOG_KEY = 'lp_catalog';
  let audioCatalog = (() => {
    try { return JSON.parse(localStorage.getItem(CATALOG_KEY) || 'null'); } catch (_) { return null; }
  })();

  function refreshAudioCatalog() {
    fetch('audio/catalog.json', { cache: 'no-store' })
      .then(response => response.ok ? response.text() : null)
      .then(text => {
        if (!text) return;
        const data = JSON.parse(text);
        audioCatalog = data;
        if (localStorage.getItem(CATALOG_KEY) !== text) localStorage.setItem(CATALOG_KEY, text);
      })
      .catch(() => {});
  }
  refreshAudioCatalog();
  setInterval(refreshAudioCatalog, 20000);

  // Lock-screen play with nothing queued (for example after the line fell back to speech).
  audio.onMediaPlay = () => { if (!audio.isPlaying) togglePlay(); };
  audio.onMediaPrev = () => playPrev();
  audio.onMediaNext = () => playNext();
  audio.onPlaybackChange = playing => updatePlayBtn(playing);

  // DOM Elements
  const $ = id => document.getElementById(id);
  const sentenceList = $('sentenceList');
  const playIcon = $('playIcon');
  const progressBar = $('progressBar');
  const wordPopup = $('wordPopup');
  const topbar = $('topbar');
  const dock = $('dock');
  const topicRail = $('topicRail');
  const locatePill = $('btnLocate');
  const scrim = $('scrim');
  const toastEl = $('toast');
  // Keep in sync with the "WIDE" breakpoint in css/style.css (sidebar + current-line panel).
  const wideQuery = window.matchMedia('(min-width: 1024px)');
  const nowPanel = $('nowPanel');
  let deferredInstallPrompt = null;
  let installPromptEl = null;
  const INSTALL_DISMISS_KEY = 'lp_install_prompt_dismissed_v1';

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIosDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function isSafariBrowser() {
    const ua = window.navigator.userAgent || '';
    const isWebkit = /webkit/i.test(ua);
    const isExcluded = /crios|fxios|edgios|opios|mercury/i.test(ua);
    return isWebkit && !isExcluded;
  }

  function dismissInstallPrompt(persist = true) {
    if (installPromptEl) {
      installPromptEl.remove();
      installPromptEl = null;
    }
    if (persist) localStorage.setItem(INSTALL_DISMISS_KEY, 'true');
  }

  function shouldShowInstallPrompt() {
    const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === 'true';
    if (dismissed) return false;
    if (isStandaloneMode()) return false;
    return !!deferredInstallPrompt || isIosDevice();
  }

  function renderInstallPrompt() {
    if (!shouldShowInstallPrompt()) {
      dismissInstallPrompt(false);
      return;
    }
    const langPack = i18n[state.lang] || i18n.en;
    const ios = isIosDevice();
    const safari = isSafariBrowser();
    const canNativeInstall = !!deferredInstallPrompt;
    const desc = canNativeInstall
      ? langPack.installDescNative
      : (ios ? (safari ? langPack.installDescIosSafari : langPack.installDescIosOther) : langPack.installDescNative);
    const actionLabel = canNativeInstall ? langPack.installNow : langPack.installLater;
    if (!installPromptEl) {
      installPromptEl = document.createElement('div');
      installPromptEl.className = 'install-prompt';
      document.body.appendChild(installPromptEl);
    }
    installPromptEl.innerHTML = `
      <button class="install-close" aria-label="Close"><i class="ri-close-line"></i></button>
      <div class="install-prompt-title">${langPack.installTitle}</div>
      <div class="install-prompt-desc">${desc}</div>
      <div class="install-prompt-actions">
        <button class="install-action">${actionLabel}</button>
      </div>
    `;
    const actionBtn = installPromptEl.querySelector('.install-action');
    const closeBtn = installPromptEl.querySelector('.install-close');
    actionBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        dismissInstallPrompt(true);
        return;
      }
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (_) {}
      deferredInstallPrompt = null;
      dismissInstallPrompt(true);
    });
    closeBtn.addEventListener('click', () => dismissInstallPrompt(true));
  }

  function setupInstallPrompt() {
    if (isStandaloneMode()) return;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      renderInstallPrompt();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      dismissInstallPrompt(true);
    });
    setTimeout(() => {
      renderInstallPrompt();
    }, 500);
  }

  function getEnglishLang() {
    return state.accent === 'uk' ? 'en-GB' : 'en-US';
  }

  function getIpaText(entry, accent = state.accent) {
    if (!entry) return '';
    if (entry.ipa && typeof entry.ipa === 'object') {
      const text = accent === 'uk' ? entry.ipa.uk : entry.ipa.us;
      return text || entry.ipa.us || entry.ipa.uk || '';
    }
    if (entry.ipa && typeof entry.ipa === 'string') return entry.ipa;
    const fallback = accent === 'uk' ? entry.ipa_uk : entry.ipa_us;
    return fallback || entry.ipa_us || entry.ipa_uk || '';
  }

  function renderWordPronunciations(word, entry) {
    const holder = $('popupPronunciations');
    if (!entry) {
      holder.innerHTML = '';
      return;
    }
    const usIpa = getIpaText(entry, 'us');
    const ukIpa = getIpaText(entry, 'uk');
    holder.innerHTML = `
      <button class="pron-btn ${state.accent === 'us' ? 'active' : ''}" data-accent="us">
        <div class="pron-top">
          <span class="tag">${i18n[state.lang].accentUs}</span>
          <i class="ri-volume-up-fill"></i>
        </div>
        <span class="ipa">${usIpa || '-'}</span>
      </button>
      <button class="pron-btn ${state.accent === 'uk' ? 'active' : ''}" data-accent="uk">
        <div class="pron-top">
          <span class="tag">${i18n[state.lang].accentUk}</span>
          <i class="ri-volume-up-fill"></i>
        </div>
        <span class="ipa">${ukIpa || '-'}</span>
      </button>
    `;
    holder.querySelectorAll('.pron-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        interruptMainPlayback();
        const accent = btn.dataset.accent === 'uk' ? 'uk' : 'us';
        btn.classList.add('speaking');
        speakWordClip(word, accent, () => btn.classList.remove('speaking'));
      });
    });
  }

  // Say one word: the recorded clip from audio/words/ (or words-uk/) when it exists,
  // otherwise the system voice. The caller stops sentence playback first.
  function speakWordClip(word, accent, onEnd) {
    const src = wordClipSrc(word, accent);
    const viaSpeech = () => audio.speakWord(word, onEnd, { voiceVariant: accent });
    if (!src) {
      viaSpeech();
      return;
    }
    audio.playClip(src, ok => {
      if (ok) onEnd();
      else viaSpeech();
    });
  }

  // ---- Small helpers ----
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function speakerOf(text) {
    const match = /^\s*([A-Z])\s*[:：]/.exec(text || '');
    return match ? match[1] : '';
  }

  let toastTimer = null;
  function showToast(message, icon, duration = 1800) {
    if (!toastEl) return;
    toastEl.innerHTML = `${icon ? `<i class="${icon}"></i>` : ''}<span>${escapeHtml(message)}</span>`;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function maybeShowWordTip() {
    if (localStorage.getItem('lp_tip_word')) return;
    localStorage.setItem('lp_tip_word', '1');
    setTimeout(() => showToast(t('tipWord'), 'ri-lightbulb-flash-line', 4200), 700);
  }

  function topicName(topic) {
    if (!topic) return t('allTopics');
    return topic.name[state.lang] || topic.name.en;
  }

  function topicAltName(topic) {
    // Subtitle in the other language doubles as a light vocabulary hint.
    if (!topic) return '';
    return state.lang === 'zh' ? topic.name.en : topic.name.zh;
  }

  function sentencesInTopic(topicId) {
    return topicId === 'all' ? state.sentences : state.sentences.filter(s => topicOf(s) === topicId);
  }

  // ---- Saved position per topic ----
  function savePosition() {
    const s = state.filtered[state.currentIndex];
    if (!s) return;
    if (state.positions[state.topic] === s.id) return;
    state.positions[state.topic] = s.id;
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(state.positions));
  }

  function forgetPosition(topicId) {
    if (!(topicId in state.positions)) return;
    delete state.positions[topicId];
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(state.positions));
  }

  // ---- Filter Logic ----
  // resume: go back to the line last reached in this topic (if it passes the level filter).
  function applyFilters({ resume = true } = {}) {
    state.filtered = sentencesInTopic(state.topic)
      .filter(s => state.levelFilter === 'all' || s.level === state.levelFilter);
    let index = state.filtered.length > 0 ? 0 : -1;
    if (resume && index === 0) {
      const savedId = state.positions[state.topic];
      const found = savedId == null ? -1 : state.filtered.findIndex(s => s.id === savedId);
      if (found > 0) index = found;
    }
    state.currentIndex = index;
    renderList(true, true);
    renderTopicHead();
    updateDisplay('none');
    if (index > 0) {
      // Bring the resumed line into view once the list has laid out.
      requestAnimationFrame(() => followActive('force'));
      showToast(t('resumeAt')(index + 1), 'ri-history-line');
    }
  }

  function stopForFilterChange() {
    audio.stop();
    clearLoopTimer();
    updatePlayBtn(false);
    closeWordPopup();
    closePopover();
  }

  // fromStart: begin at the first line instead of where this topic was left
  // (used when playback rolls on into the next topic).
  function setTopic(topicId, { fromStart = false } = {}) {
    if (topicId !== 'all' && !topicById(topicId)) topicId = 'all';
    if (topicId === state.topic) return false;
    state.topic = topicId;
    localStorage.setItem('lp_topic', topicId);
    if (fromStart) forgetPosition(topicId);
    // Keep the chosen level if the new topic has it; otherwise fall back to all levels.
    if (state.levelFilter !== 'all' && !sentencesInTopic(topicId).some(s => s.level === state.levelFilter)) {
      state.levelFilter = 'all';
      localStorage.setItem('lp_level', 'all');
    }
    renderTopicRail();
    stopForFilterChange();
    window.scrollTo({ top: 0, behavior: 'auto' });
    applyFilters({ resume: !fromStart });
    return true;
  }

  function setLevel(level) {
    if (level !== 'all' && !LEVELS.includes(level)) level = 'all';
    if (level === state.levelFilter) return;
    state.levelFilter = level;
    localStorage.setItem('lp_level', level);
    stopForFilterChange();
    window.scrollTo({ top: 0, behavior: 'auto' });
    applyFilters();
  }

  // ---- Topic Rail / Head / Sheet ----
  // Topics stay in one list for playback order. The panel groups them by scene,
  // and IT is its own category so each conversation under it plays on its own.
  function sceneGroups() {
    const order = [
      { id: 'daily', label: t('sceneDaily') },
      { id: 'business', label: t('sceneBusiness') },
      { id: 'it', label: t('sceneIt') }
    ];
    return order
      .map(scene => ({
        label: scene.label,
        items: visibleTopics.filter(tp => (tp.scene || 'daily') === scene.id)
      }))
      .filter(group => group.items.length);
  }

  function renderTopicRail() {
    if (!topicRail) return;
    const chip = (id, icon, hue, label) => {
      const active = state.topic === id;
      return `<button class="chip${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-topic="${id}" style="--h:${hue}"><i class="${icon}"></i>${escapeHtml(label)}</button>`;
    };
    let html = chip('all', 'ri-stack-line', 'var(--all-h)', t('allTopics'));
    let lastScene = null;
    visibleTopics.forEach(topic => {
      if (lastScene && topic.scene !== lastScene) html += '<span class="chip-divider" aria-hidden="true"></span>';
      lastScene = topic.scene;
      html += chip(topic.id, topic.icon, topic.hue, topicName(topic));
    });
    topicRail.innerHTML = html;
    renderSidebar();
  }

  // Wide layout (iPad landscape / desktop) lists topics in a sidebar instead of the rail.
  function renderSidebar() {
    const nav = $('sideNav');
    if (!nav) return;
    const item = (id, icon, hue, label, count) => {
      const active = state.topic === id;
      return `<button class="side-item${active ? ' active' : ''}" data-topic="${id}" style="--h:${hue}"${active ? ' aria-current="page"' : ''}>
        <span class="side-icon"><i class="${icon}"></i></span>
        <span class="side-name">${escapeHtml(label)}</span>
        <span class="side-count">${count}</span>
      </button>`;
    };
    let html = item('all', 'ri-stack-line', 'var(--all-h)', t('allTopics'), state.sentences.length);
    const groups = sceneGroups();
    groups.forEach(group => {
      if (!group.items.length) return;
      html += `<h3 class="side-group">${escapeHtml(group.label)}</h3>`;
      html += group.items.map(tp => item(tp.id, tp.icon, tp.hue, topicName(tp), topicCounts[tp.id])).join('');
    });
    nav.innerHTML = html;
  }

  function scrollActiveChipIntoView(smooth = false) {
    const active = topicRail && topicRail.querySelector('.chip.active');
    if (!active) return;
    const railRect = topicRail.getBoundingClientRect();
    const chipRect = active.getBoundingClientRect();
    const delta = (chipRect.left + chipRect.width / 2) - (railRect.left + railRect.width / 2);
    topicRail.scrollBy({ left: delta, behavior: smooth ? 'smooth' : 'auto' });
  }

  function renderTopicHead() {
    const topic = state.topic === 'all' ? null : topicById(state.topic);
    const hue = topic ? topic.hue : 'var(--all-h)';
    $('topicHead').style.setProperty('--h', hue);
    $('nowPanel').style.setProperty('--h', hue);
    const icon = `<i class="${topic ? topic.icon : 'ri-stack-line'}"></i>`;
    $('topicHeadIcon').innerHTML = icon;
    $('topicHeadArt').innerHTML = icon;
    $('npTopic').textContent = topicName(topic);
    renderLevelSeg();
    $('topicTitle').textContent = topicName(topic);
    $('topbarTitle').textContent = topicName(topic);
    const count = t('unitSentences')(state.filtered.length);
    $('topicMeta').textContent = topic
      ? `${topicAltName(topic)} · ${count}`
      : `${t('unitTopics')(visibleTopics.length)} · ${count}`;
    $('levelLabel').textContent = state.levelFilter === 'all' ? t('allLevels') : LEVEL_CEFR[state.levelFilter];
    $('levelDot').className = `lvl-dot ${state.levelFilter === 'all' ? '' : state.levelFilter}`;
    syncOfflineButton();
  }

  function renderTopicSheet() {
    const check = '<i class="ri-checkbox-circle-fill"></i>';
    const card = topic => {
      const active = state.topic === topic.id;
      return `
        <button class="topic-card${active ? ' active' : ''}" data-topic="${topic.id}" style="--h:${topic.hue}">
          <span class="tc-icon"><i class="${topic.icon}"></i></span>
          <span class="tc-name">${escapeHtml(topicName(topic))}</span>
          <span class="tc-sub">${escapeHtml(topicAltName(topic))}</span>
          <span class="tc-count">${active ? check : topicCounts[topic.id]}</span>
        </button>`;
    };
    const allActive = state.topic === 'all';
    let html = `
      <button class="topic-card-all${allActive ? ' active' : ''}" data-topic="all">
        <span class="tc-icon"><i class="ri-stack-line"></i></span>
        <span class="tc-text">
          <span class="tc-name">${escapeHtml(t('allTopics'))}</span>
          <span class="tc-sub">${t('unitTopics')(visibleTopics.length)} · ${t('unitSentences')(state.sentences.length)}</span>
        </span>
        <span class="tc-count">${allActive ? check : ''}</span>
      </button>`;
    const groups = sceneGroups();
    groups.forEach(group => {
      if (!group.items.length) return;
      html += `<h3 class="sheet-group">${escapeHtml(group.label)}</h3><div class="topic-grid">${group.items.map(card).join('')}</div>`;
    });
    $('topicSheetBody').innerHTML = html;
  }

  // ---- Popovers (speed, level) ----
  let openPopoverState = null;

  function closePopover() {
    if (!openPopoverState) return;
    openPopoverState.el.classList.remove('show');
    openPopoverState.anchor.setAttribute('aria-expanded', 'false');
    openPopoverState = null;
  }

  function openPopover(el, anchor, placement, align = 'right') {
    if (openPopoverState && openPopoverState.el === el) {
      closePopover();
      return;
    }
    closePopover();
    const rect = anchor.getBoundingClientRect();
    if (align === 'left') {
      el.style.left = `${Math.max(12, rect.left)}px`;
      el.style.right = 'auto';
    } else {
      el.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
      el.style.left = 'auto';
    }
    const vertical = placement === 'above' ? 'bottom' : 'top';
    if (placement === 'above') {
      el.style.top = 'auto';
      el.style.bottom = `${window.innerHeight - rect.top + 12}px`;
    } else {
      el.style.bottom = 'auto';
      el.style.top = `${rect.bottom + 8}px`;
    }
    el.style.setProperty('--origin', `${vertical} ${align}`);
    el.classList.add('show');
    anchor.setAttribute('aria-expanded', 'true');
    openPopoverState = { el, anchor };
  }

  function renderSpeedPopover() {
    const names = t('speedNames');
    $('speedPopover').innerHTML = `<div class="pop-title">${escapeHtml(t('speedTitle'))}</div>` + SPEEDS.map(v => {
      const active = v === state.speed;
      return `
        <button class="pop-item${active ? ' active' : ''}" role="menuitemradio" aria-checked="${active}" data-speed="${v}">
          <b>${v}×</b><span>${escapeHtml(names[v] || '')}</span>
          <span class="pop-meta">${active ? '<i class="ri-check-line"></i>' : ''}</span>
        </button>`;
    }).join('');
  }

  function renderLevelPopover() {
    const pool = sentencesInTopic(state.topic);
    const counts = { all: pool.length };
    LEVELS.forEach(level => { counts[level] = pool.filter(s => s.level === level).length; });
    const item = level => {
      const active = state.levelFilter === level;
      const label = level === 'all' ? t('allLevels') : `${LEVEL_CEFR[level]} · ${t('lvl_' + level)}`;
      return `
        <button class="pop-item${active ? ' active' : ''}" role="menuitemradio" aria-checked="${active}" data-level="${level}"${counts[level] ? '' : ' disabled'}>
          <span class="lvl-dot ${level === 'all' ? '' : level}"></span>
          <span>${escapeHtml(label)}</span>
          <span class="pop-meta">${counts[level]}</span>
        </button>`;
    };
    $('levelPopover').innerHTML = `<div class="pop-title">${escapeHtml(t('levelTitle'))}</div>` + ['all', ...LEVELS].map(item).join('');
  }

  // Wide layout: the same level choices as the popover, laid out inline in the topic banner.
  function renderLevelSeg() {
    const pool = sentencesInTopic(state.topic);
    const btn = level => {
      const count = level === 'all' ? pool.length : pool.filter(s => s.level === level).length;
      const active = state.levelFilter === level;
      const label = level === 'all' ? t('allLevels') : LEVEL_CEFR[level];
      const title = level === 'all' ? '' : ` title="${escapeHtml(t('lvl_' + level))}"`;
      return `<button class="lvl-opt${active ? ' active' : ''}" type="button" role="radio" aria-checked="${active}" data-level="${level}"${title}${count ? '' : ' disabled'}>
        ${level === 'all' ? '' : `<span class="lvl-dot ${level}"></span>`}<span>${escapeHtml(label)}</span><span class="lvl-count">${count}</span>
      </button>`;
    };
    $('levelSeg').innerHTML = ['all', ...LEVELS].map(btn).join('');
  }

  // ---- Render Conversation (Lazy Loading) ----
  let listObserver = null;
  const LIST_BATCH_SIZE = 50;
  let activeEl = null;
  let enterTimer = null;

  function buildWordsHtml(text) {
    return (text || '').split(/\s+/).filter(Boolean).map(token => {
      const clean = token.replace(/[^a-zA-Z'-]/g, '').replace(/^['-]+|['-]+$/g, '').toLowerCase();
      if (!clean) return escapeHtml(token);
      return `<span class="word" data-word="${escapeHtml(clean)}">${escapeHtml(token)}</span>`;
    }).join(' ');
  }

  // Blind listening: is this line's English text currently uncovered?
  function isRevealed(s) {
    return !state.blind || (s && state.revealedId === s.id);
  }

  function renderMsg(li, s, index, isActive) {
    const speaker = speakerOf(s.text);
    const text = stripSpeakerLabel(s.text);
    const revealed = isActive && isRevealed(s);
    const mine = isMyLine(s);
    li.className = `msg side-${speaker === 'B' ? 'b' : 'a'}${isActive ? ' active' : ''}${revealed ? ' revealed' : ''}${mine ? ' mine' : ''}`;
    li.dataset.index = index;
    const avatar = `<span class="msg-avatar" aria-hidden="true">${speaker || '•'}</span>`;
    if (!isActive) {
      li.innerHTML = `${avatar}<div class="msg-bubble"><p class="msg-text">${escapeHtml(text)}</p></div>`;
      return;
    }
    const blindHint = state.blind && !revealed
      ? `<span class="blind-hint" data-action="reveal"><i class="ri-eye-line"></i>${escapeHtml(t('revealText'))}</span>`
      : '';
    li.innerHTML = `${avatar}
      <div class="msg-bubble">
        <div class="msg-text-wrap">
          <p class="msg-text">${buildWordsHtml(text)}</p>
          ${blindHint}
        </div>
        ${state.showCn && s.cn ? `<p class="msg-cn">${escapeHtml(stripSpeakerLabel(s.cn))}</p>` : ''}
        ${mine ? `<span class="turn-bar" aria-hidden="true"></span>` : ''}
        <div class="msg-tools">
          <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>${index + 1} / ${state.filtered.length}</span>
          ${mine
            ? `<span class="turn-tag"><i class="ri-mic-line"></i>${escapeHtml(t('roleYourLine'))}</span>`
            : `<span class="msg-level ${s.level}">${LEVEL_CEFR[s.level] || escapeHtml(s.level)}</span>`}
          <span class="spacer"></span>
          <button class="msg-tool" data-action="replay" title="${escapeHtml(t('replay'))}" aria-label="${escapeHtml(t('replay'))}"><i class="ri-restart-line"></i></button>
          <button class="msg-tool" data-action="practice" title="${escapeHtml(t('practiceTitle'))}" aria-label="${escapeHtml(t('practiceTitle'))}"><i class="ri-graduation-cap-line"></i></button>
          <button class="msg-tool${state.blind ? ' on' : ''}" data-action="blind" title="${escapeHtml(t('blindLabel'))}" aria-label="${escapeHtml(t('blindLabel'))}" aria-pressed="${state.blind}"><i class="ri-eye-off-line"></i></button>
          <button class="msg-tool${state.showCn ? ' on' : ''}" data-action="cn" title="${escapeHtml(t('translation'))}" aria-label="${escapeHtml(t('translation'))}" aria-pressed="${state.showCn}"><i class="ri-translate-2"></i></button>
        </div>
      </div>`;
  }

  function toggleActiveTranslation() {
    state.showCn = !state.showCn;
    localStorage.setItem('lp_showCn', state.showCn);
    syncStageTranslation();
    if (!activeEl) return;
    // Patch in place so the bubble does not replay its entrance animation.
    const s = state.filtered[state.currentIndex];
    const bubble = activeEl.querySelector('.msg-bubble');
    const existing = bubble && bubble.querySelector('.msg-cn');
    if (existing) existing.remove();
    if (bubble && state.showCn && s && s.cn) {
      const p = document.createElement('p');
      p.className = 'msg-cn';
      p.textContent = stripSpeakerLabel(s.cn);
      bubble.insertBefore(p, bubble.querySelector('.msg-tools'));
    }
    const btn = activeEl.querySelector('[data-action="cn"]');
    if (btn) {
      btn.classList.toggle('on', state.showCn);
      btn.setAttribute('aria-pressed', String(state.showCn));
    }
  }

  function renderList(reset = true, animate = false) {
    if (reset) {
      sentenceList.innerHTML = '';
      state.renderedCount = 0;
      activeEl = null;
      if (listObserver) {
        listObserver.disconnect();
        listObserver = null;
      }
      if (state.filtered.length === 0) {
        const action = state.levelFilter !== 'all'
          ? `<br><button type="button" data-action="reset-level">${escapeHtml(t('emptyAction'))}</button>`
          : '';
        sentenceList.innerHTML = `<li class="convo-empty"><i class="ri-chat-off-line"></i>${escapeHtml(t('emptyList'))}${action}</li>`;
        return;
      }
      if (animate) {
        sentenceList.classList.remove('entering');
        void sentenceList.offsetWidth;
        sentenceList.classList.add('entering');
        clearTimeout(enterTimer);
        enterTimer = setTimeout(() => sentenceList.classList.remove('entering'), 900);
      }
    }

    const start = state.renderedCount;
    const end = Math.min(start + LIST_BATCH_SIZE, state.filtered.length);
    if (start >= state.filtered.length) return;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const li = document.createElement('li');
      const isActive = i === state.currentIndex;
      renderMsg(li, state.filtered[i], i, isActive);
      if (isActive) activeEl = li;
      if (i < 14) li.style.setProperty('--i', i);
      fragment.appendChild(li);
    }
    sentenceList.appendChild(fragment);
    state.renderedCount = end;

    // Setup intersection observer for next batch
    if (end < state.filtered.length) {
      if (!listObserver) {
        listObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            listObserver.unobserve(entries[0].target);
            renderList(false);
          }
        }, { rootMargin: '400px' });
      } else {
        listObserver.disconnect();
      }
      if (sentenceList.lastElementChild) {
        listObserver.observe(sentenceList.lastElementChild);
      }
    }
  }

  function ensureIndexRendered(index) {
    if (index < 0) return;
    // If the index we want to show is not yet rendered, render up to that batch
    while (state.renderedCount <= index && state.renderedCount < state.filtered.length) {
      renderList(false);
    }
  }

  // ---- Follow the current sentence (lyrics-style) ----
  // 'soft'  : sequential advance; skipped for a few seconds after the user scrolls by hand
  // 'nav'   : prev / next / returning to the app; scrolls only if the line is out of the comfort zone
  // 'force' : the "now playing" pill; always centres the line
  let lastUserScrollAt = 0;

  function visibleBand() {
    const top = topbar ? topbar.getBoundingClientRect().bottom : 0;
    // In the wide layout the dock lives in the side panel, so the list has the full height.
    const bottom = dock && !wideQuery.matches ? dock.getBoundingClientRect().top : window.innerHeight;
    return { top, bottom };
  }

  function followActive(mode = 'soft') {
    if (!activeEl || !activeEl.isConnected || document.hidden) return;
    if (mode === 'soft' && Date.now() - lastUserScrollAt < 6000) return;
    const { top, bottom } = visibleBand();
    const rect = activeEl.getBoundingClientRect();
    const comfortable = rect.top >= top + 12 && rect.bottom <= top + (bottom - top) * 0.78;
    if (mode !== 'force' && comfortable) return;
    const target = window.scrollY + rect.top + rect.height / 2 - (top + (bottom - top) / 2);
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function updateLocatePill() {
    if (!locatePill) return;
    if (!activeEl || !activeEl.isConnected || document.body.classList.contains('sheet-open')) {
      locatePill.classList.remove('show');
      return;
    }
    const { top, bottom } = visibleBand();
    const rect = activeEl.getBoundingClientRect();
    const above = rect.bottom < top + 8;
    const below = rect.top > bottom - 8;
    locatePill.classList.toggle('show', above || below);
    $('locateIcon').className = above ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
  }

  // ---- Current-line stage (wide layout) ----
  // Hidden translations stay blurred in place so the learner can reveal them on demand.
  function syncStageTranslation() {
    const wrap = $('npCnWrap');
    const hidden = !state.showCn;
    wrap.classList.toggle('is-hidden', hidden);
    if (hidden) {
      wrap.setAttribute('role', 'button');
      wrap.tabIndex = 0;
    } else {
      wrap.removeAttribute('role');
      wrap.removeAttribute('tabindex');
    }
    $('npCnBtn').classList.toggle('on', state.showCn);
    $('npCnBtn').setAttribute('aria-pressed', String(state.showCn));
  }

  // Blind listening in the wide panel: the line (and "up next") stay blurred until revealed.
  function syncStageBlind() {
    const s = state.filtered[state.currentIndex];
    const hidden = state.blind && !!s && !isRevealed(s);
    const wrap = $('npTextWrap');
    wrap.classList.toggle('is-hidden', hidden);
    if (hidden) {
      wrap.setAttribute('role', 'button');
      wrap.tabIndex = 0;
    } else {
      wrap.removeAttribute('role');
      wrap.removeAttribute('tabindex');
    }
    nowPanel.classList.toggle('is-blind', state.blind);
    $('npBlindBtn').classList.toggle('on', state.blind);
    $('npBlindBtn').setAttribute('aria-pressed', String(state.blind));
  }

  // A voice-memo style waveform. Shape is seeded by the sentence id, so a line always
  // looks the same; the coloured copy is revealed by playback progress (--p).
  function renderWave(s) {
    let seed = (Number(s.id) || 1) * 2654435761 >>> 0;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const n = 44;
    let bars = '';
    for (let i = 0; i < n; i++) {
      const envelope = Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 0.55);
      const v = Math.max(0.12, envelope * (0.3 + 0.7 * rand()));
      bars += `<i style="--v:${v.toFixed(2)};--d:${(i % 7) * -0.13}s"></i>`;
    }
    $('npWave').innerHTML = `<div class="np-wave-base">${bars}</div><div class="np-wave-fill">${bars}</div>`;
  }

  let stageSentenceId = null;

  function renderStage() {
    const panel = nowPanel;
    const s = state.filtered[state.currentIndex];
    panel.classList.toggle('is-empty', !s);
    // A different line starts with an empty waveform; a re-render of the same line keeps its progress.
    const id = s ? s.id : null;
    if (id !== stageSentenceId) panel.style.setProperty('--p', '0%');
    stageSentenceId = id;
    if (!s) {
      $('npText').textContent = t('emptyList');
      $('npCn').textContent = '';
      $('npWave').innerHTML = '';
      $('npNextText').textContent = '';
      $('npNext').disabled = true;
      return;
    }
    const speaker = speakerOf(s.text) || 'A';
    const text = stripSpeakerLabel(s.text);
    panel.classList.toggle('side-b', speaker === 'B');
    $('npAvatar').textContent = speaker;
    $('npWho').textContent = isMyLine(s) ? `${t('speaker')(speaker)} · ${t('roleYourLine')}` : t('speaker')(speaker);
    panel.classList.toggle('is-mine', isMyLine(s));
    const level = $('npLevel');
    level.className = `msg-level ${s.level}`;
    level.textContent = LEVEL_CEFR[s.level] || s.level;
    const npText = $('npText');
    npText.innerHTML = buildWordsHtml(text);
    npText.classList.toggle('is-long', text.length > 90);
    syncStageBlind();
    // Fresh line: replay the entrance animation.
    if (panel.dataset.lineId !== String(s.id)) {
      panel.dataset.lineId = String(s.id);
      npText.classList.remove('enter');
      void npText.offsetWidth;
      npText.classList.add('enter');
    }
    $('npCn').textContent = stripSpeakerLabel(s.cn || '');
    $('npCnWrap').hidden = !s.cn;
    syncStageTranslation();
    $('npIndex').textContent = `${state.currentIndex + 1} / ${state.filtered.length}`;
    renderWave(s);
    const next = state.filtered[state.currentIndex + 1];
    $('npNext').disabled = !next;
    $('npNextText').textContent = next ? stripSpeakerLabel(next.text) : t('lastLine');
  }

  // ---- Display Current Sentence ----
  function updateDisplay(follow = 'soft') {
    renderStage();
    if (state.currentIndex < 0 || state.filtered.length === 0) {
      activeEl = null;
      updateLocatePill();
      return;
    }
    savePosition();
    prepareOfflineAhead();
    ensureIndexRendered(state.currentIndex);
    const li = sentenceList.children[state.currentIndex];
    if (activeEl && activeEl !== li && activeEl.isConnected) {
      const prevIndex = parseInt(activeEl.dataset.index, 10);
      if (state.filtered[prevIndex]) renderMsg(activeEl, state.filtered[prevIndex], prevIndex, false);
    }
    if (li && li !== activeEl) {
      renderMsg(li, state.filtered[state.currentIndex], state.currentIndex, true);
    }
    activeEl = li || null;
    if (follow !== 'none') followActive(follow);
    updateLocatePill();
  }

  // ---- Select Sentence ----
  function selectSentence(index) {
    audio.stop();
    clearLoopTimer();
    closeWordPopup();
    state.currentIndex = index;
    updateDisplay('none');
    updatePlayBtn(false);
    playCurrent();
  }

  // ---- Play Controls ----
  function getSelectedSpeed() {
    return Number.isFinite(state.speed) ? state.speed : 1;
  }

  function getPlaybackRates(baseSpeed) {
    // Pass 1: natural fluency at user-selected speed
    // Pass 2: moderately slowed, full sentence — clearer phrasing
    // Pass 3: slowest full-sentence read — deliberate but not word-by-word overhead
    // Chinese: comfortable comprehension speed
    const first  = Math.max(0.5,  Math.min(1.5,  baseSpeed));
    const second = Math.max(0.5,  Math.min(1.2,  baseSpeed - 0.15));
    const third  = Math.max(0.6,  Math.min(1.3,  baseSpeed - 0.1));
    const chinese = Math.max(0.6,  Math.min(1.1,  baseSpeed - 0.1));
    return { first, second, third, chinese };
  }

  function buildClearEnglishSpeechText(text) {
    // Keep speech clear but natural: pause by phrase, not by every single word.
    return (text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([,;:])\s*/g, '$1 ')
      .replace(/([.!?])\s*/g, '$1 ')
      .replace(/\s*[—-]\s*/g, ', ');
  }

  function getLetterSpeechName(letter) {
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
      z: state.accent === 'uk' ? 'zed' : 'zee'
    };
    return names[(letter || '').toLowerCase()] || letter;
  }

  function normalizeJoinedLetterSpeech(text) {
    // Expand letter abbreviations such as Q&A / R&D into stable spoken forms.
    return (text || '').replace(/\b(?:[A-Za-z]\s*&\s*)+[A-Za-z]\b/g, (match) => {
      const letters = match.match(/[A-Za-z]/g) || [];
      return letters.map(getLetterSpeechName).join(' and ');
    });
  }

  function stripSpeakerLabel(text) {
    // Dialogue lines start with a role marker ("A: ..." / "B：..."). Show it, but don't speak it.
    return (text || '').replace(/^\s*[A-Z]\s*[:：]\s*/, '');
  }

  function buildWordByWordStream(text) {
    return ((text || '').match(/[A-Za-z]+(?:['-][A-Za-z]+)*|[.,!?;:]/g) || []);
  }

  function speakWordByWordLikeSentence(text, rate, onEnd, index = 0, tokens = null) {
    const stream = tokens || buildWordByWordStream(normalizeJoinedLetterSpeech(stripSpeakerLabel(text)));
    if (index >= stream.length) {
      onEnd();
      return;
    }
    const token = stream[index];
    if (/^[.,!?;:]$/.test(token)) {
      speakWordByWordLikeSentence(text, rate, onEnd, index + 1, stream);
      return;
    }
    const lowerToken = token.toLowerCase();
    // Normalize standalone one-letter function words to avoid unstable TTS pronunciation.
    const speakToken = lowerToken === 'a' ? 'uh' : (lowerToken === 'i' ? 'eye' : token);
    // Use the given rate uniformly; avoid extra slowdown that causes swallowed sounds
    const tokenRate = Math.max(0.45, rate);
    audio.onProgress = setProgress;
    audio.speak(speakToken, () => {
      speakWordByWordLikeSentence(text, rate, onEnd, index + 1, stream);
      updatePlayBtn(true);
    }, { lang: getEnglishLang(), rate: tokenRate, pitch: 1.1, voiceVariant: state.accent });
  }

  function normalizeStandaloneArticleA(text) {
    return (text || '').replace(/\ba(?=\s*[.!?,;:]?\s*$)/gi, 'uh');
  }

  function wordClipSlug(token) {
    const lower = String(token || '').toLowerCase();
    const spoken = lower === 'a' ? 'uh' : (lower === 'i' ? 'eye' : lower);
    return spoken.replace(/[^a-z0-9-]+/g, '') || 'word';
  }

  function catalogHas(list, value) {
    return Array.isArray(list) && list.some(item => String(item) === String(value));
  }

  function canPlaySentenceFromFile(sentence) {
    if (!audioCatalog) return false;
    const enKey = state.accent === 'uk' ? 'en-gb' : 'en-us';
    if (!catalogHas(audioCatalog[enKey], sentence.id)) return false;
    return !state.speakCn || catalogHas(audioCatalog.zh, sentence.id);
  }

  // Audio file paths. Playback and offline downloads must use the exact same strings.
  const UI_SRC = {
    prompt: 'audio/ui/prompt.m4a',
    gapPass: 'audio/ui/gap-pass.m4a',
    gapLine: 'audio/ui/gap-line.m4a'
  };
  function accentDir(accent = state.accent) {
    return accent === 'uk' ? 'en-gb' : 'en-us';
  }
  function englishSrc(sentence, accent = state.accent) {
    return `audio/${accentDir(accent)}/${sentence.id}.m4a?v=4`;
  }
  function chineseSrc(sentence) {
    return `audio/zh/${sentence.id}.m4a?v=4`;
  }
  // Recorded single-word clip for the word card, or null when it was never generated.
  function wordClipSrc(word, accent = state.accent) {
    if (!audioCatalog) return null;
    const slug = wordClipSlug(word);
    const list = accent === 'uk' ? audioCatalog.wordsUk : audioCatalog.words;
    if (!catalogHas(list, slug)) return null;
    return `audio/${accent === 'uk' ? 'words-uk' : 'words'}/${slug}.m4a`;
  }
  // Same tokens as tools/audio/generate.mjs uses for audio/words/.
  function sentenceWordTokens(sentence) {
    return stripSpeakerLabel(sentence.text).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [];
  }

  function buildMediaTracks(sentence, rates) {
    const title = sentence.text;
    const tracks = [];
    const addSpeech = (src, rate) => tracks.push({ src, rate, title, critical: true });

    // One read per play: English; the Chinese translation follows only when "朗读中文" is on.
    addSpeech(englishSrc(sentence), rates.first);
    if (state.speakCn) {
      tracks.push({ src: UI_SRC.gapPass, rate: 1, title });
      tracks.push({
        src: chineseSrc(sentence),
        rate: rates.chinese,
        title: sentence.cn || sentence.text,
        critical: true
      });
    }
    // Short beat between lines so the dialogue flows (gap-sentence.m4a was 2.6 s).
    tracks.push({ src: UI_SRC.gapLine, rate: 1, title });
    return tracks;
  }

  // ---- Audio ahead of the player: the next few lines are held as blob: URLs ----
  // Downloaded files come from the cache, the rest from the network into memory. Without this
  // a phone waits for a request at every new clip (gap, then the next line) between two lines.
  const PREPARE_AHEAD = 4;
  function prepareOfflineAhead() {
    if (!offline || state.currentIndex < 0) return;
    const srcs = [UI_SRC.prompt, UI_SRC.gapPass, UI_SRC.gapLine];
    const addLine = s => {
      if (!s || isMyLine(s) || !canPlaySentenceFromFile(s)) return;
      srcs.push(englishSrc(s));
      if (state.speakCn) srcs.push(chineseSrc(s));
    };
    for (let i = state.currentIndex; i < Math.min(state.filtered.length, state.currentIndex + PREPARE_AHEAD); i++) {
      addLine(state.filtered[i]);
    }
    // Wrapping to the next topic: also get its first line ready.
    if (state.currentIndex >= state.filtered.length - PREPARE_AHEAD && state.loopScope === 'all') {
      const nextTopic = nextTopicAfter(state.topic);
      addLine(nextTopic && sentencesInTopic(nextTopic.id).find(s => state.levelFilter === 'all' || s.level === state.levelFilter));
    }
    offline.prepare(srcs);
  }

  // Everything a topic needs to play without network: each line's English read in the
  // current accent, its Chinese read, the word clips and the UI sounds. Only files listed in
  // audio/catalog.json are included.
  function offlineSourcesFor(topicId) {
    const srcs = new Set([UI_SRC.prompt, UI_SRC.gapPass, UI_SRC.gapLine]);
    if (!audioCatalog) return [];
    sentencesInTopic(topicId).forEach(s => {
      if (catalogHas(audioCatalog[accentDir()], s.id)) srcs.add(englishSrc(s));
      if (catalogHas(audioCatalog.zh, s.id)) srcs.add(chineseSrc(s));
      sentenceWordTokens(s).forEach(token => {
        const clip = wordClipSrc(token);
        if (clip) srcs.add(clip);
      });
    });
    return [...srcs];
  }

  // The topic after topicId in sidebar order (wrapping round) that has lines at the
  // chosen level. null for "all topics", or when no other topic has such lines.
  function nextTopicAfter(topicId) {
    const from = visibleTopics.findIndex(tp => tp.id === topicId);
    if (from < 0) return null;
    for (let step = 1; step < visibleTopics.length; step++) {
      const topic = visibleTopics[(from + step) % visibleTopics.length];
      if (sentencesInTopic(topic.id).some(s => state.levelFilter === 'all' || s.level === state.levelFilter)) return topic;
    }
    return null;
  }

  // Called when one read of the current line finishes (file or speech).
  // Repeats the line until the chosen count is reached, then moves to the next line.
  // After the last line it goes on to the next topic, or starts this topic over (state.loopScope).
  function handleSentenceEnd(viaSpeech) {
    endTurnUi();
    state.playsDone++;
    recordLineHeard(state.filtered[state.currentIndex]);
    // Sleep timer: stop between lines once the time is up (or at the end of the topic).
    if (sleepTimer.mode && sleepTimer.deadline && Date.now() >= sleepTimer.deadline) {
      finishSleepTimer();
      return;
    }
    const atTopicEnd = state.currentIndex >= state.filtered.length - 1
      && state.repeat !== 0 && state.playsDone >= state.repeat;
    if (atTopicEnd && sleepTimer.mode === 'topic') {
      finishSleepTimer();
      return;
    }
    const run = fn => {
      if (viaSpeech) state.loopTimer = setTimeout(fn, 600);
      else fn();
    };
    if (state.repeat === 0 || state.playsDone < state.repeat) {
      run(() => playCurrent('repeat'));
      updatePlayBtn(true);
      return;
    }
    if (state.currentIndex < state.filtered.length - 1) {
      state.currentIndex++;
      updateDisplay();
      run(() => playCurrent('sequential'));
      updatePlayBtn(true);
      return;
    }
    const nextTopic = state.loopScope === 'all' ? nextTopicAfter(state.topic) : null;
    if (nextTopic) {
      // This topic is done, so coming back to it later starts from the top.
      forgetPosition(state.topic);
      // Same path as tapping the topic, so the list, header and saved topic all follow.
      setTopic(nextTopic.id, { fromStart: true });
      scrollActiveChipIntoView(true);
      if (openSheetEl && openSheetEl.id === 'topicSheet') renderTopicSheet();
    } else {
      state.currentIndex = 0;
      updateDisplay();
    }
    if (state.currentIndex < 0) {
      updatePlayBtn(false);
      return;
    }
    run(() => playCurrent('sequential'));
    updatePlayBtn(true);
  }

  function playPasses(passes, onEnd, index = 0) {
    if (index >= passes.length) {
      onEnd();
      return;
    }
    const pass = passes[index];
    const handlePassEnd = () => {
      if (index >= passes.length - 1) {
        onEnd();
        return;
      }
      state.loopTimer = setTimeout(() => playPasses(passes, onEnd, index + 1), 2200);
      updatePlayBtn(true);
    };
    if (pass.mode === 'word_by_word') {
      speakWordByWordLikeSentence(pass.text, pass.rate, handlePassEnd);
      return;
    }
    audio.onProgress = setProgress;
    let spokenText = normalizeJoinedLetterSpeech(stripSpeakerLabel(pass.text));
    if (pass.normalizeA) spokenText = normalizeStandaloneArticleA(spokenText);
    if (pass.clearSpeech) spokenText = buildClearEnglishSpeechText(spokenText);
    audio.speak(spokenText, handlePassEnd, { lang: pass.lang, rate: pass.rate, pitch: pass.pitch || 1, volume: pass.volume || 1, voiceVariant: pass.voiceVariant });
  }

  function playCurrent(playReason = 'initial') {
    if (state.currentIndex < 0 || state.filtered.length === 0) return;
    const s = state.filtered[state.currentIndex];

    // A downloaded line whose blob: URL is not ready yet (first tap right after launch):
    // load it, then play, so it does not go to the network.
    if (offline && canPlaySentenceFromFile(s) && offline.has(englishSrc(s)) && !offline.resolve(englishSrc(s))) {
      const token = ++prepareToken;
      const srcs = [englishSrc(s), UI_SRC.prompt, UI_SRC.gapPass, UI_SRC.gapLine];
      if (state.speakCn) srcs.push(chineseSrc(s));
      updatePlayBtn(true);
      offline.prepare(srcs).then(() => {
        if (token !== prepareToken || state.filtered[state.currentIndex] !== s) return;
        if (!offline.resolve(englishSrc(s))) return startPlayback(s, playReason);
        playCurrent(playReason);
      });
      return;
    }
    startPlayback(s, playReason);
  }

  let prepareToken = 0;

  // ---- Role play: the learner's lines become a pause to say them ----
  function isMyLine(s) {
    return !!state.role && !!s && speakerOf(s.text) === state.role;
  }

  // Time to say a line: about half a second per word plus a moment to start,
  // stretched when the learner listens slowly.
  function turnSeconds(s) {
    const words = sentenceWordTokens(s).length;
    const sec = (1.5 + words * 0.45) / Math.min(1, Math.max(0.5, state.speed));
    return Math.min(14, Math.max(2.5, sec));
  }

  function endTurnUi() {
    document.body.classList.remove('your-turn');
  }

  // Silence fills the turn. It is played as audio (gap files) so the session keeps running
  // in the background and on the lock screen; without the files a timer is used.
  function startMyTurn(s, playReason) {
    const sec = turnSeconds(s);
    document.body.classList.add('your-turn');
    document.documentElement.style.setProperty('--turn', `${sec}s`);
    if (activeEl) {
      // Restart the countdown bar for this turn.
      activeEl.classList.remove('turn-run');
      void activeEl.offsetWidth;
      activeEl.classList.add('turn-run');
    }
    audio.onProgress = setProgress;
    if (audioCatalog) {
      const tracks = [];
      if (playReason === 'initial') tracks.push({ src: UI_SRC.prompt, rate: 1, title: s.text });
      const gapSec = 2.2; // length of audio/ui/gap-pass.m4a
      for (let i = 0; i < Math.ceil(sec / gapSec); i++) tracks.push({ src: UI_SRC.gapPass, rate: 1, title: s.text, critical: i === 0 });
      audio.playQueue(tracks, {
        onEnd: () => handleSentenceEnd(false),
        onFallback: () => { state.loopTimer = setTimeout(() => handleSentenceEnd(true), sec * 1000); }
      });
    } else {
      state.loopTimer = setTimeout(() => handleSentenceEnd(true), sec * 1000);
    }
    updatePlayBtn(true);
  }

  function startPlayback(s, playReason) {
    const selectedSpeed = getSelectedSpeed();
    if (selectedSpeed !== state.speed) {
      state.speed = selectedSpeed;
      localStorage.setItem('lp_speed', state.speed);
    }
    audio.setRate(state.speed);
    const rates = getPlaybackRates(state.speed);
    // Repeats keep their count; any fresh start (tap, prev/next, play) begins at zero.
    if (playReason !== 'repeat' && playReason !== 'loop') state.playsDone = 0;
    if (isMyLine(s)) {
      startMyTurn(s, playReason);
      return;
    }
    const passes = [
      { text: s.text, lang: getEnglishLang(), rate: rates.first, pitch: 1.1, clearSpeech: true, voiceVariant: state.accent }
    ];
    if (state.speakCn) passes.push({ text: s.cn || s.text, lang: 'zh-CN', rate: rates.chinese, pitch: 1.05, volume: 1 });

    const startSpeaking = () => {
      playPasses(passes, () => handleSentenceEnd(true));
    };

    if (canPlaySentenceFromFile(s)) {
      const tracks = buildMediaTracks(s, rates);
      if (playReason === 'initial') {
        tracks.unshift({ src: UI_SRC.prompt, rate: 1, title: s.text });
      }
      audio.onProgress = setProgress;
      audio.playQueue(tracks, {
        onEnd: () => handleSentenceEnd(false),
        onFallback: startSpeaking
      });
      updatePlayBtn(true);
      return;
    }

    if (playReason === 'initial') {
      audio.playPromptSound(startSpeaking);
    } else {
      startSpeaking();
    }
    updatePlayBtn(true);
  }

  function togglePlay() {
    if (audio.isPlaying) {
      if (audio.hasMediaQueue()) {
        audio.pause();
      } else {
        audio.stop();
        clearLoopTimer();
      }
      updatePlayBtn(false);
      return;
    }
    if (audio.isPaused && audio.hasMediaQueue()) {
      audio.resume();
      updatePlayBtn(true);
      return;
    }
    if (state.currentIndex < 0 && state.filtered.length > 0) state.currentIndex = 0;
    updateDisplay();
    playCurrent();
  }

  function updatePlayBtn(playing) {
    playIcon.className = playing ? 'ri-pause-fill' : 'ri-play-fill';
    document.body.classList.toggle('is-playing', !!playing);
  }

  // Late media events can fire after stop(); only a reset may move the bar then.
  function setProgress(pct) {
    if (pct === 0 || audio.isPlaying) {
      progressBar.style.width = pct + '%';
      nowPanel.style.setProperty('--p', pct + '%');
    }
  }

  function clearLoopTimer() {
    if (state.loopTimer) { clearTimeout(state.loopTimer); state.loopTimer = null; }
    prepareToken++; // a stop also cancels a line that is still waiting for its offline file
    endTurnUi();
  }

  function interruptMainPlayback() {
    audio.stop();
    clearLoopTimer();
    updatePlayBtn(false);
  }

  function playPrev() {
    if (state.filtered.length === 0) return;
    audio.stop(); clearLoopTimer();
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    closeWordPopup();
    updateDisplay('nav');
    playCurrent();
  }

  function playNext() {
    if (state.filtered.length === 0) return;
    audio.stop(); clearLoopTimer();
    state.currentIndex = Math.min(state.filtered.length - 1, state.currentIndex + 1);
    closeWordPopup();
    updateDisplay('nav');
    playCurrent();
  }

  // ---- Speed Control ----
  function syncSpeedUi() {
    $('speedLabel').textContent = `${state.speed}×`;
    renderSpeedPopover();
  }

  function setupSpeed() {
    if (!SPEEDS.includes(state.speed)) state.speed = 1;
    audio.setRate(state.speed);
    syncSpeedUi();
    $('btnSpeed').addEventListener('click', e => {
      e.stopPropagation();
      renderSpeedPopover();
      openPopover($('speedPopover'), $('btnSpeed'), 'above');
    });
    $('speedPopover').addEventListener('click', e => {
      const item = e.target.closest('[data-speed]');
      if (!item) return;
      e.stopPropagation();
      const next = parseFloat(item.dataset.speed);
      closePopover();
      if (next === state.speed) return;
      state.speed = next;
      audio.setRate(state.speed);
      localStorage.setItem('lp_speed', state.speed);
      syncSpeedUi();
      // Rates are fixed when a sentence starts, so a change mid-sentence lands on the next one.
      showToast(audio.isPlaying ? t('speedNext')(state.speed) : `${t('speedTitle')} ${state.speed}×`, 'ri-speed-line');
    });
  }

  // ---- Play Mode ----
  function repeatLabel(value) {
    if (value === 1) return t('sequential');
    return value === 0 ? t('loopForever') : t('loopTimes')(value);
  }

  function syncModeUi() {
    const loop = state.repeat !== 1;
    const btn = $('btnMode');
    $('modeIcon').className = loop ? 'ri-repeat-one-line' : 'ri-order-play-line';
    btn.classList.toggle('on', loop);
    const count = $('modeCount');
    count.hidden = !loop;
    count.textContent = state.repeat === 0 ? '∞' : String(state.repeat);
    btn.title = repeatLabel(state.repeat);
    btn.setAttribute('aria-label', btn.title);
  }

  function renderModePopover() {
    const item = value => {
      const active = state.repeat === value;
      const icon = value === 1 ? 'ri-order-play-line' : 'ri-repeat-one-line';
      const desc = value === 1 ? t('sequentialDesc') : (value === 0 ? t('foreverDesc') : t('loopDesc'));
      return `
        <button class="pop-item${active ? ' active' : ''}" role="menuitemradio" aria-checked="${active}" data-repeat="${value}">
          <i class="${icon}"></i>
          <span class="pop-stack"><span>${escapeHtml(repeatLabel(value))}</span><small>${escapeHtml(desc)}</small></span>
          <span class="pop-meta">${active ? '<i class="ri-check-line"></i>' : ''}</span>
        </button>`;
    };
    $('modePopover').innerHTML = `<div class="pop-title">${escapeHtml(t('modeTitle'))}</div>`
      + item(1)
      + `<div class="pop-divider"></div>`
      + REPEAT_OPTIONS.filter(v => v !== 1).map(item).join('');
  }

  function setupPlayMode() {
    syncModeUi();
    $('btnMode').addEventListener('click', e => {
      e.stopPropagation();
      renderModePopover();
      openPopover($('modePopover'), $('btnMode'), 'above', 'left');
    });
    $('modePopover').addEventListener('click', e => {
      const item = e.target.closest('[data-repeat]');
      if (!item) return;
      e.stopPropagation();
      closePopover();
      const next = parseInt(item.dataset.repeat, 10);
      if (next === state.repeat) return;
      state.repeat = next;
      // Count the read in progress toward the new setting.
      state.playsDone = Math.min(state.playsDone, Math.max(0, next - 1));
      localStorage.setItem('lp_repeat', String(next));
      syncModeUi();
      showToast(repeatLabel(next), next === 1 ? 'ri-order-play-line' : 'ri-repeat-one-line');
    });
  }

  // ---- Font Size ----
  function applyFontSize() {
    const size = Number.isFinite(state.fontSize) ? state.fontSize : 18;
    state.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
    document.documentElement.style.setProperty('--fs', `${state.fontSize}px`);
    $('fontValue').textContent = state.fontSize;
    $('btnFontDown').disabled = state.fontSize <= FONT_MIN;
    $('btnFontUp').disabled = state.fontSize >= FONT_MAX;
  }

  function setupFontSize() {
    applyFontSize();
    const step = delta => {
      state.fontSize += delta;
      applyFontSize();
      localStorage.setItem('lp_fontSize', state.fontSize);
    };
    $('btnFontDown').addEventListener('click', () => step(-2));
    $('btnFontUp').addEventListener('click', () => step(2));
  }

  // ---- Dictionary safe access (dictionary.js loads deferred / async) ----
  // NOTE: `const DICTIONARY` declared in dictionary.js does NOT attach to window,
  // but lives in the global declarative environment. `typeof` is TDZ-safe and
  // returns 'undefined' before dictionary.js has executed.
  function getDict() {
    try {
      return typeof DICTIONARY !== 'undefined' ? DICTIONARY : null;
    } catch (_) {
      return null;
    }
  }

  // ---- Word Popup ----
  function closeWordPopup() {
    wordPopup.classList.remove('show');
    document.body.classList.remove('popup-open');
    document.querySelectorAll('.word.looked').forEach(el => el.classList.remove('looked'));
  }

  function keepActiveAbovePopup() {
    // Nudge the page so the highlighted line stays readable above the word card.
    requestAnimationFrame(() => {
      // Wide layout: the card opens in the side panel and never covers the list.
      if (wideQuery.matches) return;
      if (!activeEl || !wordPopup.classList.contains('show')) return;
      // On tablet / desktop the card floats above the dock, so measure where it really is.
      const popupTop = wordPopup.getBoundingClientRect().top;
      const overlap = activeEl.getBoundingClientRect().bottom - (popupTop - 16);
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
    });
  }

  function showWordPopup(word, sourceEl) {
    if (!word) return;
    const dict = getDict();
    const entry = dict ? dict[word] : null;
    $('popupWord').textContent = word;

    if (entry) {
      renderWordPronunciations(word, entry);
      $('popupMeaning').innerHTML = `<strong>${escapeHtml(entry.pos)}</strong> ${escapeHtml(entry.cn)}`;
      $('popupExamples').innerHTML = (entry.ex || []).map(e => `<p>• ${escapeHtml(e)}</p>`).join('');
    } else {
      renderWordPronunciations(word, null);
      $('popupMeaning').innerHTML = `<em>${t('noDef')}</em>`;
      $('popupExamples').innerHTML = '';
      if (!dict && !window.__dictionaryReady) {
        window.__onDictionaryReady = function () {
          if (wordPopup.classList.contains('show') && $('popupWord').textContent === word) {
            showWordPopup(word);
          }
        };
      }
    }

    // Check if word is in wordbook
    const isSaved = state.wordbook.includes(word);
    $('popupFav').innerHTML = isSaved ? '<i class="ri-star-fill"></i>' : '<i class="ri-star-line"></i>';
    $('popupFav').classList.toggle('saved', isSaved);

    if (sourceEl) {
      document.querySelectorAll('.word.looked').forEach(el => el.classList.remove('looked'));
      sourceEl.classList.add('looked');
    }
    closePopover();
    document.body.classList.add('popup-open');
    wordPopup.classList.add('show');
    keepActiveAbovePopup();
  }

  function setupWordPopup() {
    $('popupClose').addEventListener('click', closeWordPopup);

    $('popupFav').addEventListener('click', () => {
      const word = $('popupWord').textContent;
      const idx = state.wordbook.indexOf(word);
      if (idx > -1) {
        state.wordbook.splice(idx, 1);
        $('popupFav').innerHTML = '<i class="ri-star-line"></i>';
        $('popupFav').classList.remove('saved');
      } else {
        state.wordbook.push(word);
        $('popupFav').innerHTML = '<i class="ri-star-fill"></i>';
        $('popupFav').classList.add('saved');
      }
      localStorage.setItem('lp_wordbook', JSON.stringify(state.wordbook));
      updateWordbookBadge();
    });
    // Close popup on outside click
    // composedPath() is captured at dispatch, so it still holds the popup even when a
    // handler has already swapped out the tapped element (e.g. the star icon).
    document.addEventListener('click', (e) => {
      if (!wordPopup.classList.contains('show')) return;
      const path = e.composedPath();
      if (path.includes(wordPopup)) return;
      if (path.some(node => node.classList && node.classList.contains('word'))) return;
      closeWordPopup();
    });
  }

  // ---- Sheets ----
  let openSheetEl = null;
  // Keep in sync with the "TABLET" breakpoint in css/style.css.
  const formSheetQuery = window.matchMedia('(min-width: 720px)');

  function openSheet(id) {
    const el = $(id);
    if (!el) return;
    closePopover();
    closeWordPopup();
    if (openSheetEl && openSheetEl !== el) {
      if (openSheetEl.id === 'practiceSheet') closePracticeAudio();
      openSheetEl.classList.remove('show');
    }
    el.classList.add('show');
    scrim.classList.add('show');
    document.body.classList.add('sheet-open');
    openSheetEl = el;
    updateLocatePill();
  }

  function closeSheet() {
    if (!openSheetEl) return;
    // Leaving practice: stop its audio and give the microphone back.
    if (openSheetEl.id === 'practiceSheet') closePracticeAudio();
    openSheetEl.classList.remove('show');
    openSheetEl = null;
    scrim.classList.remove('show');
    document.body.classList.remove('sheet-open');
    updateLocatePill();
  }

  function setupSheets() {
    scrim.addEventListener('click', closeSheet);
    document.querySelectorAll('[data-close-sheet]').forEach(btn => btn.addEventListener('click', closeSheet));
    // Drag the handle or header down to dismiss.
    document.querySelectorAll('.sheet').forEach(sheet => {
      let startY = 0;
      let dy = 0;
      let dragging = false;
      const onStart = e => {
        if (e.target.closest('button')) return;
        // From 720px up sheets are centred dialogs; swipe-to-dismiss is a phone gesture.
        if (formSheetQuery.matches) return;
        dragging = true;
        dy = 0;
        startY = e.touches[0].clientY;
        sheet.classList.add('dragging');
      };
      const onMove = e => {
        if (!dragging) return;
        dy = Math.max(0, e.touches[0].clientY - startY);
        sheet.style.transform = `translate(-50%, ${dy}px)`;
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        sheet.classList.remove('dragging');
        sheet.style.transform = '';
        if (dy > 90) closeSheet();
      };
      sheet.querySelectorAll('.sheet-handle, .sheet-head').forEach(zone => {
        zone.addEventListener('touchstart', onStart, { passive: true });
      });
      sheet.addEventListener('touchmove', onMove, { passive: true });
      sheet.addEventListener('touchend', onEnd);
      sheet.addEventListener('touchcancel', onEnd);
    });
  }

  // ---- Stats ----
  const STREAK_MIN_SEC = 60; // a day counts toward the streak after one minute of listening
  let heardSet = new Set(state.stats.heard.map(String));

  function saveStats() {
    state.stats.heard = [...heardSet];
    localStorage.setItem('lp_stats', JSON.stringify(state.stats));
  }

  function dayKey(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function recordLineHeard(s) {
    if (!s) return;
    state.stats.sentencesPlayed++;
    heardSet.add(String(s.id));
    saveStats();
  }

  // Days in a row with at least a minute of listening, ending today
  // (or yesterday, so the streak does not read 0 before today's practice).
  function streakDays() {
    const days = state.stats.days;
    const cursor = new Date();
    if ((days[dayKey(cursor)] || 0) < STREAK_MIN_SEC) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while ((days[dayKey(cursor)] || 0) >= STREAK_MIN_SEC) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function formatDuration(sec) {
    const minutes = Math.floor(sec / 60);
    if (minutes < 60) return t('durationMin')(minutes);
    return t('durationHourMin')(Math.floor(minutes / 60), minutes % 60);
  }

  function renderStats() {
    const s = state.stats;
    const todayMin = Math.floor((s.days[dayKey()] || 0) / 60);
    const heard = SENTENCES.filter(x => heardSet.has(String(x.id))).length;
    $('statTiles').innerHTML = `
      <div class="stat-tile"><div class="stat-value">${todayMin}<small>${escapeHtml(t('unitMin'))}</small></div><div class="stat-label">${t('statsToday')}</div></div>
      <div class="stat-tile"><div class="stat-value">${streakDays()}<small>${escapeHtml(t('unitDay'))}</small></div><div class="stat-label">${t('statsStreak')}</div></div>
      <div class="stat-tile"><div class="stat-value">${heard}<small>/ ${SENTENCES.length}</small></div><div class="stat-label">${t('statsHeard')}</div></div>
      <button class="stat-tile" type="button" data-open="wordbook"><div class="stat-value">${state.wordbook.length}</div><div class="stat-label">${t('statsWords')}<i class="ri-arrow-right-s-line"></i></div></button>
    `;
    $('statTotals').textContent = t('statsTotals')(formatDuration(s.listenedSec), s.sentencesPlayed);
  }

  // ---- Wordbook ----
  function updateWordbookBadge() {
    const n = state.wordbook.length;
    [$('wordbookBadge'), $('sideWordbookBadge')].forEach(badge => {
      badge.hidden = n === 0;
      badge.textContent = n > 99 ? '99+' : String(n);
    });
    $('wordbookSub').textContent = t('wordbookCount')(n);
  }

  function renderWordbook() {
    const list = $('wordbookList');
    if (state.wordbook.length === 0) {
      list.innerHTML = `<li class="wordbook-empty"><i class="ri-bookmark-3-line"></i>${t('noWords')}</li>`;
      return;
    }
    const dict = getDict() || {};
    list.innerHTML = state.wordbook.map(w => {
      const entry = dict[w];
      const usIpa = getIpaText(entry, 'us');
      const ukIpa = getIpaText(entry, 'uk');
      const meaning = entry ? entry.cn : '—';
      const safeWord = escapeHtml(w);
      return `
        <li class="wordbook-item">
          <div class="wb-header">
            <span class="wb-word">${safeWord}</span>
            <button class="wb-remove" data-word="${safeWord}" title="Remove"><i class="ri-delete-bin-line"></i></button>
          </div>
          <div class="wb-meaning">${escapeHtml(meaning)}</div>
          <div class="popup-pronunciations wb-pronunciations">
            <button class="pron-btn wb-speak ${state.accent === 'us' ? 'active' : ''}" data-accent="us" data-word="${safeWord}">
              <div class="pron-top">
                <span class="tag">${t('accentUs')}</span>
                <i class="ri-volume-up-fill"></i>
              </div>
              <span class="ipa">${usIpa || '-'}</span>
            </button>
            <button class="pron-btn wb-speak ${state.accent === 'uk' ? 'active' : ''}" data-accent="uk" data-word="${safeWord}">
              <div class="pron-top">
                <span class="tag">${t('accentUk')}</span>
                <i class="ri-volume-up-fill"></i>
              </div>
              <span class="ipa">${ukIpa || '-'}</span>
            </button>
          </div>
        </li>`;
    }).join('');

    list.querySelectorAll('.wb-speak').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.word;
        const accent = btn.dataset.accent;
        const wasPlaying = audio.isPlaying;
        const resumeIndex = state.currentIndex;
        audio.stop(true);
        clearLoopTimer();
        btn.classList.add('speaking');
        speakWordClip(w, accent, () => {
          btn.classList.remove('speaking');
          if (wasPlaying && resumeIndex === state.currentIndex) {
            playCurrent('loop');
            updatePlayBtn(true);
          }
        });
      });
    });

    list.querySelectorAll('.wb-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.word;
        state.wordbook = state.wordbook.filter(x => x !== w);
        localStorage.setItem('lp_wordbook', JSON.stringify(state.wordbook));
        updateWordbookBadge();
        renderWordbook();
      });
    });
  }

  function showWordbook() {
    renderWordbook();
    updateWordbookBadge();
    openSheet('wordbookSheet');
  }

  // ---- Track listening time (only while audio is playing) ----
  function startListeningTimer() {
    let last = Date.now();
    let unsaved = 0;
    const flush = () => {
      if (unsaved) saveStats();
      unsaved = 0;
    };
    setInterval(() => {
      const now = Date.now();
      // Background tabs may tick late; cap one tick so a suspended page does not count.
      const sec = Math.min(now - last, 65000) / 1000;
      last = now;
      if (!audio.isPlaying || audio.isPaused) return;
      const key = dayKey();
      state.stats.days[key] = (state.stats.days[key] || 0) + sec;
      state.stats.listenedSec += sec;
      unsaved += sec;
      if (unsaved >= 15) flush();
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
  }

  // ---- Language ----
  function updateI18n() {
    const dict = i18n[state.lang] || i18n.en;
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const value = dict[el.dataset.i18n];
      if (typeof value === 'string') el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const value = dict[el.dataset.i18nTitle];
      if (typeof value === 'string') {
        el.title = value;
        el.setAttribute('aria-label', value);
      }
    });

    document.querySelectorAll('#langControl .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langValue === state.lang);
    });

    renderTopicRail();
    renderTopicHead();
    renderSpeedPopover();
    renderLevelPopover();
    renderStats();
    syncModeUi();
    renderSleepControl();
    updateWordbookBadge();
    if (openSheetEl && openSheetEl.id === 'menuSheet') syncOfflineStatus();
    if (openSheetEl && openSheetEl.id === 'practiceSheet') renderPractice();
    if (openSheetEl && openSheetEl.id === 'topicSheet') renderTopicSheet();
    if (openSheetEl && openSheetEl.id === 'wordbookSheet') renderWordbook();

    // Re-render the highlighted line so its button labels follow the language.
    if (activeEl && activeEl.isConnected && state.filtered[state.currentIndex]) {
      renderMsg(activeEl, state.filtered[state.currentIndex], state.currentIndex, true);
    }
    renderStage();

    const popupWord = $('popupWord').textContent;
    if (wordPopup.classList.contains('show') && popupWord) {
      const wordDict = getDict();
      renderWordPronunciations(popupWord, (wordDict && wordDict[popupWord]) || null);
    }
    renderInstallPrompt();
  }

  function setupLanguage() {
    updateI18n();
    document.querySelectorAll('#langControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.langValue === 'zh' ? 'zh' : 'en';
        if (next === state.lang) return;
        state.lang = next;
        localStorage.setItem('lp_lang', state.lang);
        updateI18n();
      });
    });
  }

  // ---- Me sheet: profile, accent ----
  function setupProfile() {
    let name = '';
    try {
      const session = Auth.getSession();
      name = (session && session.username) || '';
    } catch (_) {}
    const initial = (name.trim().charAt(0) || 'L').toUpperCase();
    $('avatarInitial').textContent = initial;
    $('profileAvatar').textContent = initial;
    $('profileName').textContent = name || 'ListenPro';
    $('sideAvatar').textContent = initial;
    $('sideUserName').textContent = name || 'ListenPro';
  }

  function setupPersonalization() {
    audio.setEnglishVariant(state.accent);
    const accentButtons = document.querySelectorAll('#accentControl .accent-btn');
    const syncAccentActive = () => {
      accentButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.accent === state.accent));
    };
    syncAccentActive();

    // Read when a topic ends, so a change applies to the topic already playing.
    const loopScopeButtons = document.querySelectorAll('#loopScopeControl .seg-btn');
    const syncLoopScope = () => {
      loopScopeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.loopScope === state.loopScope));
    };
    syncLoopScope();
    loopScopeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.loopScope = btn.dataset.loopScope === 'topic' ? 'topic' : 'all';
        localStorage.setItem('lp_loopScope', state.loopScope);
        syncLoopScope();
      });
    });

    const speakCnSwitch = $('speakCnSwitch');
    const syncSpeakCn = () => speakCnSwitch.setAttribute('aria-checked', String(state.speakCn));
    syncSpeakCn();
    speakCnSwitch.addEventListener('click', () => {
      state.speakCn = !state.speakCn;
      localStorage.setItem('lp_speakCn', String(state.speakCn));
      syncSpeakCn();
      // Takes effect from the next line; the one playing keeps its queue.
      showToast(state.speakCn ? t('speakCnOn') : t('speakCnOff'), state.speakCn ? 'ri-volume-up-line' : 'ri-volume-mute-line');
      prepareOfflineAhead();
    });

    $('btnMenu').addEventListener('click', () => {
      renderStats();
      syncSleepStatus();
      syncOfflineStatus();
      openSheet('menuSheet');
    });
    $('statTiles').addEventListener('click', e => {
      if (e.target.closest('[data-open="wordbook"]')) showWordbook();
    });

    accentButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.accent = btn.dataset.accent === 'uk' ? 'uk' : 'us';
        localStorage.setItem('lp_accent', state.accent);
        syncAccentActive();
        // Downloads are per accent, so the topic's offline state can change.
        syncOfflineButton();
        syncOfflineStatus();
        prepareOfflineAhead();
        // Refresh word popup pronunciations if open
        const popupWord = $('popupWord').textContent;
        if (wordPopup.classList.contains('show') && popupWord) {
          const dict = getDict();
          renderWordPronunciations(popupWord, (dict && dict[popupWord]) || null);
        }
      });
    });
  }

  // ---- Theme ----
  function applyTheme(animate = false) {
    if (animate) {
      document.documentElement.classList.add('theme-transition');
      setTimeout(() => document.documentElement.classList.remove('theme-transition'), 500);
    }
    if (state.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', state.theme === 'light' ? '#f2f2f7' : '#0b0b12');
    }
    document.querySelectorAll('#themeControl .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeValue === state.theme);
    });
  }

  function setupTheme() {
    applyTheme(false);
    document.querySelectorAll('#themeControl .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.themeValue === 'light' ? 'light' : 'dark';
        if (next === state.theme) return;
        state.theme = next;
        localStorage.setItem('lp_theme', state.theme);
        applyTheme(true);
      });
    });
  }

  // ---- Topics, level, list interactions ----
  function setupTopics() {
    topicRail.addEventListener('click', e => {
      const chip = e.target.closest('[data-topic]');
      if (!chip) return;
      setTopic(chip.dataset.topic);
      scrollActiveChipIntoView(true);
    });

    $('sideNav').addEventListener('click', e => {
      const item = e.target.closest('[data-topic]');
      if (!item) return;
      setTopic(item.dataset.topic);
      scrollActiveChipIntoView(false);
    });

    $('btnTopicSheet').addEventListener('click', () => {
      renderTopicSheet();
      openSheet('topicSheet');
    });

    $('topicSheetBody').addEventListener('click', e => {
      const card = e.target.closest('[data-topic]');
      if (!card) return;
      setTopic(card.dataset.topic);
      closeSheet();
      scrollActiveChipIntoView(true);
    });

    $('btnLevel').addEventListener('click', e => {
      e.stopPropagation();
      renderLevelPopover();
      openPopover($('levelPopover'), $('btnLevel'), 'below');
    });

    $('levelSeg').addEventListener('click', e => {
      const opt = e.target.closest('[data-level]');
      if (!opt || opt.disabled) return;
      setLevel(opt.dataset.level);
    });

    $('levelPopover').addEventListener('click', e => {
      const item = e.target.closest('[data-level]');
      if (!item || item.disabled) return;
      e.stopPropagation();
      closePopover();
      setLevel(item.dataset.level);
    });

    document.addEventListener('click', e => {
      if (!openPopoverState) return;
      const path = e.composedPath();
      if (!path.includes(openPopoverState.el) && !path.includes(openPopoverState.anchor)) closePopover();
    });
    window.addEventListener('resize', closePopover);
  }

  function setupList() {
    sentenceList.addEventListener('click', e => {
      if (e.target.closest('[data-action="reset-level"]')) {
        setLevel('all');
        return;
      }
      const li = e.target.closest('.msg');
      if (!li) return;
      const index = parseInt(li.dataset.index, 10);
      if (isNaN(index)) return;
      const isActive = li.classList.contains('active');

      const tool = e.target.closest('.msg-tool');
      if (tool && isActive) {
        if (tool.dataset.action === 'replay') selectSentence(index);
        else if (tool.dataset.action === 'cn') toggleActiveTranslation();
        else if (tool.dataset.action === 'blind') setBlind(!state.blind);
        else if (tool.dataset.action === 'practice') openPractice();
        return;
      }

      // Blind listening: the first tap on the hidden line uncovers it.
      if (isActive && !li.classList.contains('revealed') && state.blind && e.target.closest('.msg-text-wrap')) {
        revealCurrentLine();
        return;
      }

      const wordEl = e.target.closest('.word');
      if (wordEl && isActive) {
        showWordPopup(wordEl.dataset.word, wordEl);
        return;
      }

      if (!isActive) {
        maybeShowWordTip();
        selectSentence(index);
      }
    });
  }

  function setupStage() {
    const panel = $('nowPanel');
    panel.addEventListener('click', e => {
      if (e.target.closest('#npTextWrap.is-hidden')) {
        revealCurrentLine();
        return;
      }
      const wordEl = e.target.closest('.word');
      if (wordEl) {
        showWordPopup(wordEl.dataset.word, wordEl);
        return;
      }
      const tool = e.target.closest('[data-np]');
      if (tool && state.currentIndex >= 0) {
        if (tool.dataset.np === 'replay') selectSentence(state.currentIndex);
        else if (tool.dataset.np === 'cn') toggleActiveTranslation();
        else if (tool.dataset.np === 'blind') setBlind(!state.blind);
        else if (tool.dataset.np === 'practice') openPractice();
        return;
      }
      if (e.target.closest('#npCnWrap.is-hidden')) {
        toggleActiveTranslation();
        return;
      }
      // Clicking the button (not playNext directly) keeps auth-guard's check in the loop.
      if (e.target.closest('#npNext') && !$('npNext').disabled) $('btnNext').click();
    });
    $('npTextWrap').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && $('npTextWrap').classList.contains('is-hidden')) {
        e.preventDefault();
        e.stopPropagation(); // Space must not also toggle playback
        revealCurrentLine();
      }
    });
    $('npCnWrap').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && $('npCnWrap').classList.contains('is-hidden')) {
        e.preventDefault();
        e.stopPropagation(); // Space must not also toggle playback
        toggleActiveTranslation();
      }
    });
    // Sidebar footer mirrors the top-bar buttons, which are hidden in the wide layout.
    $('btnSideUser').addEventListener('click', () => $('btnMenu').click());
    $('btnSideWordbook').addEventListener('click', () => $('btnWordbook').click());
  }

  function setupScrollTracking() {
    const markUserScroll = () => { lastUserScrollAt = Date.now(); };
    window.addEventListener('touchmove', markUserScroll, { passive: true });
    window.addEventListener('wheel', markUserScroll, { passive: true });

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (openPopoverState) closePopover();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        topbar.classList.toggle('scrolled', window.scrollY > 4);
        // Wide layout: the floating title capsule appears once the topic banner is gone.
        const head = $('topicHead');
        topbar.classList.toggle('show-title', window.scrollY > head.offsetTop + head.offsetHeight - 40);
        updateLocatePill();
      });
    }, { passive: true });
    window.addEventListener('resize', updateLocatePill);

    // Coming back from the lock screen / another app: bring the current line into view.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(() => followActive('nav'), 150);
    });

    locatePill.addEventListener('click', () => followActive('force'));
  }

  function setupKeyboard() {
    const scrollKeys = ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'];
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closePopover();
        closeWordPopup();
        closeSheet();
        return;
      }
      if (scrollKeys.includes(e.key)) lastUserScrollAt = Date.now();
      if (openSheetEl || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
      // Clicking the buttons (instead of calling the handlers) keeps auth-guard's checks in the loop.
      if (e.code === 'Space' && tag !== 'button') {
        e.preventDefault();
        $('btnPlay').click();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        $('btnPrev').click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        $('btnNext').click();
      }
    });
  }

  // ---- Blind listening ----
  function setBlind(on) {
    state.blind = !!on;
    state.revealedId = null;
    localStorage.setItem('lp_blind', String(state.blind));
    document.body.classList.toggle('blind', state.blind);
    $('blindSwitch').setAttribute('aria-checked', String(state.blind));
    if (state.blind) closeWordPopup();
    if (activeEl && activeEl.isConnected && state.filtered[state.currentIndex]) {
      renderMsg(activeEl, state.filtered[state.currentIndex], state.currentIndex, true);
    }
    syncStageBlind();
    showToast(state.blind ? t('blindOn') : t('blindOff'), state.blind ? 'ri-eye-off-line' : 'ri-eye-line');
  }

  function revealCurrentLine() {
    const s = state.filtered[state.currentIndex];
    if (!s) return;
    state.revealedId = s.id;
    if (activeEl && activeEl.isConnected) {
      // Patch in place so the bubble does not replay its entrance animation.
      activeEl.classList.add('revealed');
      const hint = activeEl.querySelector('.blind-hint');
      if (hint) hint.remove();
    }
    syncStageBlind();
  }

  function setupBlindMode() {
    document.body.classList.toggle('blind', state.blind);
    $('blindSwitch').setAttribute('aria-checked', String(state.blind));
    $('blindSwitch').addEventListener('click', () => setBlind(!state.blind));
  }

  // ---- Sleep timer ----
  // mode: null (off), a number of minutes, or 'topic' (stop when the current topic ends).
  const SLEEP_OPTIONS = [null, 15, 30, 45, 60, 'topic'];
  const sleepTimer = { mode: null, deadline: 0, timeout: null, ticker: null };

  function sleepOptionLabel(mode) {
    if (mode === null) return t('sleepOff');
    if (mode === 'topic') return t('sleepTopic');
    return t('sleepMinutes')(mode);
  }

  function renderSleepControl() {
    $('sleepControl').innerHTML = SLEEP_OPTIONS.map(mode => {
      const active = sleepTimer.mode === mode;
      return `<button class="chip-opt${active ? ' active' : ''}" type="button" role="radio" aria-checked="${active}" data-sleep="${mode === null ? 'off' : mode}">${escapeHtml(sleepOptionLabel(mode))}</button>`;
    }).join('');
    syncSleepStatus();
  }

  function syncSleepStatus() {
    let text = '';
    if (sleepTimer.mode === 'topic') text = t('sleepTopicLeft');
    else if (sleepTimer.mode) text = t('sleepLeft')(Math.max(1, Math.ceil((sleepTimer.deadline - Date.now()) / 60000)));
    $('sleepStatus').textContent = text;
  }

  function clearSleepTimer() {
    clearTimeout(sleepTimer.timeout);
    clearInterval(sleepTimer.ticker);
    sleepTimer.mode = null;
    sleepTimer.deadline = 0;
    sleepTimer.timeout = null;
    sleepTimer.ticker = null;
  }

  function setSleepTimer(mode) {
    clearSleepTimer();
    sleepTimer.mode = mode;
    if (typeof mode === 'number') {
      sleepTimer.deadline = Date.now() + mode * 60000;
      // Stops mid-line when the time is up; handleSentenceEnd also checks between lines in
      // case a background tab delays this timer.
      sleepTimer.timeout = setTimeout(finishSleepTimer, mode * 60000);
      sleepTimer.ticker = setInterval(syncSleepStatus, 30000);
    }
    renderSleepControl();
    showToast(mode === null ? t('sleepCancelled') : `${t('sleepLabel')} · ${sleepOptionLabel(mode)}`, 'ri-moon-clear-line');
  }

  function finishSleepTimer() {
    const wasPlaying = audio.isPlaying;
    clearSleepTimer();
    if (audio.hasMediaQueue()) audio.pause();
    else audio.stop();
    clearLoopTimer();
    updatePlayBtn(false);
    renderSleepControl();
    if (wasPlaying || state.currentIndex >= 0) showToast(t('sleepDone'), 'ri-moon-clear-line', 3000);
  }

  function setupSleepTimer() {
    renderSleepControl();
    $('sleepControl').addEventListener('click', e => {
      const opt = e.target.closest('[data-sleep]');
      if (!opt) return;
      const raw = opt.dataset.sleep;
      const mode = raw === 'off' ? null : (raw === 'topic' ? 'topic' : parseInt(raw, 10));
      if (mode === sleepTimer.mode && mode !== null) return;
      setSleepTimer(mode);
    });
  }

  // ---- Offline audio (download a topic) ----
  let offlineJob = null; // { topic, controller }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // 'none' | 'partial' | 'done' for the current topic in the current accent.
  function offlineStateFor(topicId) {
    if (!offline) return 'none';
    const srcs = offlineSourcesFor(topicId);
    if (!srcs.length) return 'none';
    const have = srcs.filter(src => offline.has(src)).length;
    if (have === srcs.length) return 'done';
    return have > 3 ? 'partial' : 'none'; // the 3 UI sounds alone do not count
  }

  function syncOfflineButton() {
    const btn = $('btnOffline');
    if (!offline) {
      btn.hidden = true;
      return;
    }
    const downloading = offlineJob && offlineJob.topic === state.topic;
    const status = downloading ? 'loading' : offlineStateFor(state.topic);
    btn.dataset.state = status;
    $('offlineIcon').className = status === 'done' ? 'ri-checkbox-circle-line'
      : (status === 'loading' ? 'ri-loader-4-line' : 'ri-download-cloud-2-line');
    const title = status === 'done' ? t('offlineReady')
      : (status === 'loading' ? t('offlineLoading') : (status === 'partial' ? t('offlineResume') : t('offlineDownload')));
    btn.title = title;
    btn.setAttribute('aria-label', title);
    if (!downloading) {
      $('offlinePct').textContent = '';
      btn.style.removeProperty('--dl');
    }
  }

  async function syncOfflineStatus() {
    if (!offline) {
      $('offlineStatus').textContent = t('offlineUnsupported');
      $('btnOfflineClear').hidden = true;
      return;
    }
    await offline.init();
    const count = offline.count();
    $('btnOfflineClear').hidden = count === 0;
    if (!count) {
      $('offlineStatus').textContent = t('offlineEmpty');
      return;
    }
    const bytes = await offline.size();
    const topics = visibleTopics.filter(tp => offlineStateFor(tp.id) === 'done').map(topicName);
    $('offlineStatus').textContent = t('offlineSummary')(formatBytes(bytes), topics);
  }

  async function downloadTopic(topicId) {
    if (!offline || offlineJob) return;
    if (!audioCatalog) {
      showToast(t('offlineNoCatalog'), 'ri-wifi-off-line', 2600);
      return;
    }
    const srcs = offlineSourcesFor(topicId);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    offlineJob = { topic: topicId, controller };
    syncOfflineButton();
    const btn = $('btnOffline');
    try {
      const { total, failed } = await offline.download(srcs, (done, all) => {
        if (state.topic !== topicId) return;
        const pct = Math.round((done / all) * 100);
        $('offlinePct').textContent = `${pct}%`;
        btn.style.setProperty('--dl', `${pct}%`);
      }, controller && controller.signal);
      offlineJob = null;
      if (failed) showToast(t('offlineFailed')(failed), 'ri-error-warning-line', 2800);
      else showToast(total ? t('offlineDone')(topicName(topicById(topicId))) : t('offlineReady'), 'ri-checkbox-circle-line', 2400);
    } catch (_) {
      offlineJob = null;
      showToast(t('offlineFailed')(srcs.length), 'ri-error-warning-line', 2800);
    }
    syncOfflineButton();
    prepareOfflineAhead();
    if (openSheetEl && openSheetEl.id === 'menuSheet') syncOfflineStatus();
  }

  async function removeTopicDownload(topicId) {
    if (!offline) return;
    // Keep files another downloaded topic still needs (the UI sounds and shared words).
    // Removing "all topics" removes everything it covers.
    const keep = new Set();
    if (topicId !== 'all') {
      visibleTopics.forEach(tp => {
        if (tp.id !== topicId && offlineStateFor(tp.id) === 'done') offlineSourcesFor(tp.id).forEach(src => keep.add(src));
      });
    }
    await offline.remove(offlineSourcesFor(topicId).filter(src => !keep.has(src)));
    syncOfflineButton();
    showToast(t('offlineRemoved'), 'ri-delete-bin-6-line');
  }

  function setupOffline() {
    if (!offline) {
      syncOfflineButton();
      return;
    }
    offline.init().then(() => {
      syncOfflineButton();
      prepareOfflineAhead();
    });
    $('btnOffline').addEventListener('click', () => {
      const status = $('btnOffline').dataset.state;
      if (status === 'loading') return;
      if (status === 'done') {
        const name = state.topic === 'all' ? t('allTopics') : topicName(topicById(state.topic));
        if (window.confirm(t('offlineConfirmRemove')(name))) removeTopicDownload(state.topic);
        return;
      }
      downloadTopic(state.topic);
    });
    $('btnOfflineClear').addEventListener('click', async () => {
      if (!window.confirm(t('offlineConfirmClear'))) return;
      await offline.clear();
      syncOfflineButton();
      syncOfflineStatus();
      showToast(t('offlineRemoved'), 'ri-delete-bin-6-line');
    });
  }

  // ---- Role play setting ----
  function syncRoleControl() {
    document.querySelectorAll('#roleControl .seg-btn').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.role === 'off' ? null : btn.dataset.role) === state.role);
    });
  }

  function setRole(role) {
    state.role = role === 'A' || role === 'B' ? role : null;
    if (state.role) localStorage.setItem('lp_role', state.role);
    else localStorage.removeItem('lp_role');
    syncRoleControl();
    // Re-mark whose lines are whose; the line playing now keeps going as it started.
    renderList(true, false);
    updateDisplay('none');
    showToast(state.role ? t('roleOn')(state.role) : t('roleOffToast'), 'ri-speak-line');
  }

  function setupRolePlay() {
    syncRoleControl();
    $('roleControl').addEventListener('click', e => {
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      const role = btn.dataset.role === 'off' ? null : btn.dataset.role;
      if (role === state.role) return;
      setRole(role);
    });
  }

  // ---- Practice sheet: shadowing and dictation on one line ----
  const practice = {
    s: null,          // the line being practised
    recorder: null,
    stream: null,
    chunks: [],
    mineUrl: null,
    stopTimer: null,
    token: 0          // bumps to cancel a running listen -> record sequence
  };

  function practiceCanRecord() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
  }

  // The current line's English read, from its recorded file when there is one.
  function playLineOnce(s, rate, onEnd) {
    const hasFile = audioCatalog && catalogHas(audioCatalog[accentDir()], s.id);
    const viaSpeech = () => audio.speak(
      buildClearEnglishSpeechText(normalizeJoinedLetterSpeech(stripSpeakerLabel(s.text))),
      onEnd,
      { lang: getEnglishLang(), rate: Math.max(0.5, rate * 0.95), pitch: 1.05, voiceVariant: state.accent }
    );
    if (!hasFile) {
      viaSpeech();
      return;
    }
    audio.playClip(englishSrc(s), ok => (ok ? onEnd() : viaSpeech()), { rate });
  }

  function stopPracticeAudio() {
    practice.token++;
    audio.stop(true);
  }

  function releaseMic() {
    clearTimeout(practice.stopTimer);
    practice.stopTimer = null;
    if (practice.recorder && practice.recorder.state !== 'inactive') {
      try { practice.recorder.stop(); } catch (_) {}
    }
    if (practice.stream) practice.stream.getTracks().forEach(track => track.stop());
    practice.stream = null;
  }

  function setRecordState(status, message) {
    $('btnRecord').dataset.state = status;
    $('recIcon').className = status === 'recording' ? 'ri-stop-fill'
      : (status === 'listening' ? 'ri-headphone-line' : 'ri-mic-fill');
    $('recStatus').textContent = message;
    const hasTake = !!practice.mineUrl;
    $('btnPlayMine').disabled = !hasTake || status !== 'idle';
    $('btnCompare').disabled = !hasTake || status !== 'idle';
  }

  function clearTake() {
    if (practice.mineUrl) URL.revokeObjectURL(practice.mineUrl);
    practice.mineUrl = null;
  }

  // Tap the mic: hear the line once, then record the learner saying it.
  // Recording stops on a second tap or after a generous maximum.
  function startShadowing() {
    const s = practice.s;
    if (!s) return;
    if (!practiceCanRecord()) {
      setRecordState('idle', t('recUnsupported'));
      return;
    }
    stopPracticeAudio();
    const token = practice.token;
    setRecordState('listening', t('recListenFirst'));
    playLineOnce(s, 1, () => {
      if (token !== practice.token) return;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        if (token !== practice.token) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        practice.stream = stream;
        practice.chunks = [];
        const recorder = new MediaRecorder(stream);
        practice.recorder = recorder;
        recorder.ondataavailable = e => { if (e.data && e.data.size) practice.chunks.push(e.data); };
        recorder.onstop = () => {
          if (practice.stream) practice.stream.getTracks().forEach(track => track.stop());
          practice.stream = null;
          if (token !== practice.token || !practice.chunks.length) return;
          clearTake();
          practice.mineUrl = URL.createObjectURL(new Blob(practice.chunks, { type: recorder.mimeType || 'audio/mp4' }));
          setRecordState('idle', t('recDone'));
        };
        recorder.start();
        setRecordState('recording', t('recRecording'));
        const maxSec = Math.min(20, turnSeconds(s) * 1.6 + 2);
        practice.stopTimer = setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, maxSec * 1000);
      }).catch(() => {
        if (token !== practice.token) return;
        setRecordState('idle', t('recDenied'));
      });
    });
  }

  function stopShadowing() {
    clearTimeout(practice.stopTimer);
    if (practice.recorder && practice.recorder.state === 'recording') practice.recorder.stop();
  }

  function playMine(onEnd) {
    if (!practice.mineUrl) return;
    audio.playClip(practice.mineUrl, () => { if (onEnd) onEnd(); });
  }

  // ---- Dictation ----
  // Words compared case-insensitively, ignoring punctuation; curly apostrophes count as straight.
  function dictationWords(text) {
    return stripSpeakerLabel(text || '')
      .replace(/[’‘]/g, "'")
      .toLowerCase()
      .match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) || [];
  }

  // Longest common subsequence between the answer and what was typed:
  // answer words on that path are correct, the rest are missed; leftover typed words are extra.
  function compareDictation(answerText, typedText) {
    const answer = dictationWords(answerText);
    const typed = dictationWords(typedText);
    const n = answer.length;
    const m = typed.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = answer[i] === typed[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const hit = new Array(n).fill(false);
    const used = new Array(m).fill(false);
    for (let i = 0, j = 0; i < n && j < m;) {
      if (answer[i] === typed[j]) { hit[i] = true; used[j] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    const correct = hit.filter(Boolean).length;
    return {
      hit,
      extra: typed.filter((_, j) => !used[j]),
      score: n ? Math.round((correct / n) * 100) : 0,
      correct,
      total: n
    };
  }

  // The answer with each word marked. Hits are matched in order against the display tokens.
  function renderDictationResult(s, typedText) {
    const result = compareDictation(s.text, typedText);
    const tokens = stripSpeakerLabel(s.text).split(/\s+/).filter(Boolean);
    let k = 0;
    const answerHtml = tokens.map(token => {
      const words = dictationWords(token);
      if (!words.length) return escapeHtml(token);
      // A token like "five-hundred" is one word; "Q&A" may split into several.
      // Read every flag (no short-circuit) so k stays aligned with the answer words.
      const ok = words.map(() => result.hit[k++]).every(Boolean);
      return `<span class="${ok ? 'dw-hit' : 'dw-miss'}">${escapeHtml(token)}</span>`;
    }).join(' ');
    const level = result.score === 100 ? 'perfect' : (result.score >= 70 ? 'good' : 'low');
    const extra = result.extra.length
      ? `<p class="dict-extra">${escapeHtml(t('dictExtra'))} ${result.extra.map(w => `<s>${escapeHtml(w)}</s>`).join(' ')}</p>`
      : '';
    const box = $('dictResult');
    box.hidden = false;
    box.innerHTML = `
      <div class="dict-score ${level}"><b>${result.score}%</b><span>${escapeHtml(t('dictScore')(result.correct, result.total))}</span></div>
      <p class="dict-answer">${answerHtml}</p>
      ${extra}
      ${s.cn ? `<p class="dict-cn">${escapeHtml(stripSpeakerLabel(s.cn))}</p>` : ''}`;
  }

  function resetDictation() {
    $('dictInput').value = '';
    $('dictResult').hidden = true;
    $('dictResult').innerHTML = '';
  }

  // ---- Practice sheet ----
  function renderPractice() {
    const s = practice.s;
    if (!s) return;
    $('practiceSub').textContent = `${t('speaker')(speakerOf(s.text) || 'A')} · ${state.currentIndex + 1} / ${state.filtered.length}`;
    document.querySelectorAll('#practiceTabs .seg-btn').forEach(btn => {
      const active = btn.dataset.practice === state.practiceTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    $('shadowPane').hidden = state.practiceTab !== 'shadow';
    $('dictationPane').hidden = state.practiceTab !== 'dictation';
    $('shadowText').textContent = stripSpeakerLabel(s.text);
    $('shadowCn').textContent = stripSpeakerLabel(s.cn || '');
    $('dictInput').placeholder = t('dictPlaceholder');
    if (!$('btnRecord').dataset.state || $('btnRecord').dataset.state === 'idle') {
      setRecordState('idle', practice.mineUrl ? t('recDone') : (practiceCanRecord() ? t('recHint') : t('recUnsupported')));
    }
  }

  function practiseLine(s) {
    if (practice.s !== s) {
      clearTake();
      resetDictation();
    }
    practice.s = s;
    renderPractice();
  }

  function openPractice() {
    const s = state.filtered[state.currentIndex];
    if (!s) return;
    interruptMainPlayback();
    practiseLine(s);
    openSheet('practiceSheet');
    if (state.practiceTab === 'dictation') {
      // Start with the audio: dictation begins by listening.
      setTimeout(() => playLineOnce(s, 1, () => {}), 250);
    }
  }

  function closePracticeAudio() {
    stopPracticeAudio();
    releaseMic();
    setRecordState('idle', practice.mineUrl ? t('recDone') : t('recHint'));
  }

  function setupPractice() {
    $('practiceTabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-practice]');
      if (!btn || btn.dataset.practice === state.practiceTab) return;
      closePracticeAudio();
      state.practiceTab = btn.dataset.practice === 'dictation' ? 'dictation' : 'shadow';
      localStorage.setItem('lp_practiceTab', state.practiceTab);
      renderPractice();
    });

    $('btnRecord').addEventListener('click', () => {
      const status = $('btnRecord').dataset.state;
      if (status === 'recording') stopShadowing();
      else if (status === 'listening') closePracticeAudio();
      else startShadowing();
    });
    $('btnPlayOriginal').addEventListener('click', () => {
      if (!practice.s || $('btnRecord').dataset.state !== 'idle') return;
      stopPracticeAudio();
      playLineOnce(practice.s, 1, () => {});
    });
    $('btnPlayMine').addEventListener('click', () => {
      stopPracticeAudio();
      playMine();
    });
    $('btnCompare').addEventListener('click', () => {
      if (!practice.s) return;
      stopPracticeAudio();
      const token = practice.token;
      playLineOnce(practice.s, 1, () => {
        if (token === practice.token) setTimeout(() => { if (token === practice.token) playMine(); }, 300);
      });
    });

    $('btnDictPlay').addEventListener('click', () => {
      if (!practice.s) return;
      stopPracticeAudio();
      playLineOnce(practice.s, 1, () => {});
    });
    $('btnDictSlow').addEventListener('click', () => {
      if (!practice.s) return;
      stopPracticeAudio();
      playLineOnce(practice.s, 0.7, () => {});
    });
    const check = () => {
      if (!practice.s) return;
      if (!$('dictInput').value.trim()) {
        $('dictInput').focus();
        return;
      }
      renderDictationResult(practice.s, $('dictInput').value);
    };
    $('btnDictCheck').addEventListener('click', check);
    $('dictInput').addEventListener('keydown', e => {
      // One line per answer: Enter checks it (Shift+Enter still adds a line break).
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        check();
      }
    });
    $('btnDictNext').addEventListener('click', () => {
      if (state.currentIndex >= state.filtered.length - 1) {
        showToast(t('lastLine'), 'ri-information-line');
        return;
      }
      stopPracticeAudio();
      state.currentIndex++;
      updateDisplay('nav');
      practiseLine(state.filtered[state.currentIndex]);
      $('dictInput').focus();
      playLineOnce(practice.s, 1, () => {});
    });
  }

  // ---- Initialize ----
  function init() {
    setupTheme();
    setupSheets();
    setupProfile();
    setupLanguage();
    setupPersonalization();
    setupTopics();
    setupSpeed();
    setupPlayMode();
    setupFontSize();
    setupWordPopup();
    setupList();
    setupStage();
    setupScrollTracking();
    setupKeyboard();
    setupBlindMode();
    setupSleepTimer();
    setupOffline();
    setupRolePlay();
    setupPractice();
    startListeningTimer();

    $('btnPlay').addEventListener('click', () => {
      maybeShowWordTip();
      togglePlay();
    });
    $('btnPrev').addEventListener('click', playPrev);
    $('btnNext').addEventListener('click', playNext);
    $('btnWordbook').addEventListener('click', showWordbook);

    // Initial render in the next frame to allow the UI shell to show first
    requestAnimationFrame(() => {
      applyFilters();
      scrollActiveChipIntoView(false);

      // Defer less critical setup to keep the main thread free for the first render
      setTimeout(setupInstallPrompt, 100);
    });
  }

  init();
})();
