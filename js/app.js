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

  function readSavedLevel() {
    const saved = localStorage.getItem('lp_level');
    return saved === 'all' || LEVELS.includes(saved) ? saved : 'all';
  }

  // State
  const state = {
    sentences: [...SENTENCES],
    filtered: [...SENTENCES],
    currentIndex: -1,
    topic: readSavedTopic(),
    levelFilter: readSavedLevel(),
    repeat: readSavedRepeat(),
    playsDone: 0,
    speed: parseFloat(localStorage.getItem('lp_speed') || '0.75'),
    fontSize: parseInt(localStorage.getItem('lp_fontSize') || '18'),
    loopTimer: null,
    wordbook: JSON.parse(localStorage.getItem('lp_wordbook') || '[]'),
    stats: JSON.parse(localStorage.getItem('lp_stats') || '{"totalTime":0,"sessionsCount":0,"sentencesPlayed":0,"startTime":null}'),
    lang: localStorage.getItem('lp_lang') || 'en',
    showCn: localStorage.getItem('lp_showCn') === 'true',
    speakCn: localStorage.getItem('lp_speakCn') === 'true',
    accent: localStorage.getItem('lp_accent') || 'us',
    theme: localStorage.getItem('lp_theme') || 'dark',
    voiceName: localStorage.getItem('lp_voiceName') || 'Samantha',
    renderedCount: 0
  };

  const i18n = {
    en: {
      allTopics: "All topics", topicsTitle: "Choose a topic", topicsSub: "Pick a scene to practise",
      sceneDaily: "Daily life", sceneBusiness: "Business",
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
      tipWord: "Tip: tap a word in the highlighted line to look it up",
      menuTitle: "Me", profileSub: "Keep your ears warm",
      statsPlayed: "Plays", statsWords: "Saved words", statsTotal: "Library",
      groupListening: "Listening", groupDisplay: "Display",
      speakCnLabel: "Read Chinese aloud", speakCnHint: "After each English line, also play its Chinese translation.",
      speakCnOn: "Chinese read-aloud on", speakCnOff: "English only",
      themeLabel: "Theme", themeDark: "Dark", themeLight: "Light",
      fontLabel: "Text size",
      wordbookTitle: "Word Book", wordbookCount: n => `${n} saved`,
      noDef: "No definition available",
      noWords: "No words saved yet.<br>Tap a word in a sentence, then tap the star.",
      lvl_elementary: "Elementary", lvl_intermediate: "Intermediate", lvl_advanced: "Advanced",
      accentLabel: "Accent", accentUs: "US", accentUk: "UK",
      voiceLabel: "Voice", voiceDefault: "Auto (Recommended)", voiceLoading: "Loading voices…", voicePreviewTitle: "Preview Voice",
      voiceHint: "Used only when a sentence has no recorded audio.",
      installTitle: "Install App",
      installDescNative: "Add this app to your home screen for a faster fullscreen experience.",
      installDescIosSafari: "Tap Share, then choose Add to Home Screen.",
      installDescIosOther: "Open in Safari, tap Share, then choose Add to Home Screen.",
      installNow: "Install Now",
      installLater: "Later",
      language: "Language",
      logout: "Log out",
      titleMode: "Play mode", titlePrev: "Previous", titleNext: "Next", titlePlay: "Play / Pause", titleSpeed: "Speed"
    },
    zh: {
      allTopics: "全部话题", topicsTitle: "选择话题", topicsSub: "挑一个场景开始练习",
      sceneDaily: "日常生活", sceneBusiness: "职场商务",
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
      tipWord: "提示：点按高亮句子里的单词即可查词",
      menuTitle: "我的", profileSub: "每天听一点，耳朵会记住",
      statsPlayed: "练习句次", statsWords: "收藏生词", statsTotal: "句库总量",
      groupListening: "听力", groupDisplay: "显示",
      speakCnLabel: "朗读中文", speakCnHint: "每句英文读完后，再读一遍中文翻译。",
      speakCnOn: "已开启中文朗读", speakCnOff: "只读英文",
      themeLabel: "主题", themeDark: "深色", themeLight: "浅色",
      fontLabel: "字号",
      wordbookTitle: "生词本", wordbookCount: n => `已收藏 ${n} 个`,
      noDef: "暂无释义",
      noWords: "还没有收藏单词。<br>点按句子里的单词，再点星标即可收藏。",
      lvl_elementary: "入门级", lvl_intermediate: "进阶级", lvl_advanced: "高级",
      accentLabel: "口音", accentUs: "美音", accentUk: "英音",
      voiceLabel: "音色", voiceDefault: "自动（推荐）", voiceLoading: "加载音色中…", voicePreviewTitle: "试听音色",
      voiceHint: "仅在句子没有录制音频时使用系统语音。",
      installTitle: "添加到桌面",
      installDescNative: "将应用添加到桌面，获得更快的全屏使用体验。",
      installDescIosSafari: "点击下方分享按钮，再选择“添加到主屏幕”。",
      installDescIosOther: "请先在 Safari 打开，再点击分享并选择“添加到主屏幕”。",
      installNow: "立即安装",
      installLater: "稍后",
      language: "界面语言",
      logout: "退出登录",
      titleMode: "播放模式", titlePrev: "上一句", titleNext: "下一句", titlePlay: "播放 / 暂停", titleSpeed: "语速"
    }
  };
  const t = key => {
    const pack = i18n[state.lang] || i18n.en;
    return pack[key] !== undefined ? pack[key] : i18n.en[key];
  };

  const audio = new AudioEngine();
  let audioCatalog = null;

  function refreshAudioCatalog() {
    fetch('audio/catalog.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) audioCatalog = data; })
      .catch(() => {});
  }
  refreshAudioCatalog();
  setInterval(refreshAudioCatalog, 20000);

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
        // Record whether main playback was active before interrupting
        // const wasPlaying = audio.isPlaying;
        // const resumeIndex = state.currentIndex;
        // audio.stop(true); // silent stop — don't reset progress bar
        // clearLoopTimer();
        const accent = btn.dataset.accent === 'uk' ? 'uk' : 'us';
        btn.classList.add('speaking');
        audio.speakWord(word, () => {
          btn.classList.remove('speaking');
          // Resume sentence playback if it was running before
          // if (wasPlaying && resumeIndex === state.currentIndex) {
          //   playCurrent('loop');
          //   updatePlayBtn(true);
          // }
        }, { voiceVariant: accent });
      });
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

  // ---- Filter Logic ----
  function applyFilters() {
    state.filtered = sentencesInTopic(state.topic)
      .filter(s => state.levelFilter === 'all' || s.level === state.levelFilter);
    state.currentIndex = state.filtered.length > 0 ? 0 : -1;
    renderList(true, true);
    renderTopicHead();
    updateDisplay('none');
  }

  function stopForFilterChange() {
    audio.stop();
    clearLoopTimer();
    updatePlayBtn(false);
    closeWordPopup();
    closePopover();
  }

  function setTopic(topicId) {
    if (topicId !== 'all' && !topicById(topicId)) topicId = 'all';
    if (topicId === state.topic) return false;
    state.topic = topicId;
    localStorage.setItem('lp_topic', topicId);
    // Keep the chosen level if the new topic has it; otherwise fall back to all levels.
    if (state.levelFilter !== 'all' && !sentencesInTopic(topicId).some(s => s.level === state.levelFilter)) {
      state.levelFilter = 'all';
      localStorage.setItem('lp_level', 'all');
    }
    renderTopicRail();
    stopForFilterChange();
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'auto' });
    return true;
  }

  function setLevel(level) {
    if (level !== 'all' && !LEVELS.includes(level)) level = 'all';
    if (level === state.levelFilter) return;
    state.levelFilter = level;
    localStorage.setItem('lp_level', level);
    stopForFilterChange();
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ---- Topic Rail / Head / Sheet ----
  function renderTopicRail() {
    if (!topicRail) return;
    const chip = (id, icon, hue, label) => {
      const active = state.topic === id;
      return `<button class="chip${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-topic="${id}" style="--h:${hue}"><i class="${icon}"></i>${escapeHtml(label)}</button>`;
    };
    let html = chip('all', 'ri-stack-line', 258, t('allTopics'));
    let lastScene = null;
    visibleTopics.forEach(topic => {
      if (lastScene && topic.scene !== lastScene) html += '<span class="chip-divider" aria-hidden="true"></span>';
      lastScene = topic.scene;
      html += chip(topic.id, topic.icon, topic.hue, topicName(topic));
    });
    topicRail.innerHTML = html;
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
    $('topicHead').style.setProperty('--h', topic ? topic.hue : 258);
    $('topicHeadIcon').innerHTML = `<i class="${topic ? topic.icon : 'ri-stack-line'}"></i>`;
    $('topicTitle').textContent = topicName(topic);
    const count = t('unitSentences')(state.filtered.length);
    $('topicMeta').textContent = topic
      ? `${topicAltName(topic)} · ${count}`
      : `${t('unitTopics')(visibleTopics.length)} · ${count}`;
    $('levelLabel').textContent = state.levelFilter === 'all' ? t('allLevels') : LEVEL_CEFR[state.levelFilter];
    $('levelDot').className = `lvl-dot ${state.levelFilter === 'all' ? '' : state.levelFilter}`;
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
    const groups = [
      { label: t('sceneDaily'), items: visibleTopics.filter(tp => tp.scene !== 'business') },
      { label: t('sceneBusiness'), items: visibleTopics.filter(tp => tp.scene === 'business') }
    ];
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

  function renderMsg(li, s, index, isActive) {
    const speaker = speakerOf(s.text);
    const text = stripSpeakerLabel(s.text);
    li.className = `msg side-${speaker === 'B' ? 'b' : 'a'}${isActive ? ' active' : ''}`;
    li.dataset.index = index;
    const avatar = `<span class="msg-avatar" aria-hidden="true">${speaker || '•'}</span>`;
    if (!isActive) {
      li.innerHTML = `${avatar}<div class="msg-bubble"><p class="msg-text">${escapeHtml(text)}</p></div>`;
      return;
    }
    li.innerHTML = `${avatar}
      <div class="msg-bubble">
        <p class="msg-text">${buildWordsHtml(text)}</p>
        ${state.showCn && s.cn ? `<p class="msg-cn">${escapeHtml(stripSpeakerLabel(s.cn))}</p>` : ''}
        <div class="msg-tools">
          <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>${index + 1} / ${state.filtered.length}</span>
          <span class="msg-level ${s.level}">${LEVEL_CEFR[s.level] || escapeHtml(s.level)}</span>
          <span class="spacer"></span>
          <button class="msg-tool" data-action="replay" title="${escapeHtml(t('replay'))}" aria-label="${escapeHtml(t('replay'))}"><i class="ri-restart-line"></i></button>
          <button class="msg-tool${state.showCn ? ' on' : ''}" data-action="cn" title="${escapeHtml(t('translation'))}" aria-label="${escapeHtml(t('translation'))}" aria-pressed="${state.showCn}"><i class="ri-translate-2"></i></button>
        </div>
      </div>`;
  }

  function toggleActiveTranslation() {
    state.showCn = !state.showCn;
    localStorage.setItem('lp_showCn', state.showCn);
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
    const bottom = dock ? dock.getBoundingClientRect().top : window.innerHeight;
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

  // ---- Display Current Sentence ----
  function updateDisplay(follow = 'soft') {
    if (state.currentIndex < 0 || state.filtered.length === 0) {
      activeEl = null;
      updateLocatePill();
      return;
    }
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

  function buildMediaTracks(sentence, rates) {
    const enKey = state.accent === 'uk' ? 'en-gb' : 'en-us';
    const enSrc = `audio/${enKey}/${sentence.id}.m4a?v=2`;
    const zhSrc = `audio/zh/${sentence.id}.m4a?v=2`;
    const gap = 'audio/ui/gap-pass.m4a';
    const title = sentence.text;
    const tracks = [];
    const addSpeech = (src, rate) => tracks.push({ src, rate, title, critical: true });

    // One read per play: English; the Chinese translation follows only when "朗读中文" is on.
    addSpeech(enSrc, rates.first);
    if (state.speakCn) {
      tracks.push({ src: gap, rate: 1, title });
      tracks.push({
        src: zhSrc,
        rate: rates.chinese,
        title: sentence.cn || sentence.text,
        critical: true
      });
    }
    // Short beat between lines so the dialogue flows (gap-sentence.m4a was 2.6 s).
    tracks.push({ src: 'audio/ui/gap-line.m4a', rate: 1, title });
    return tracks;
  }

  // Called when one read of the current line finishes (file or speech).
  // Repeats the line until the chosen count is reached, then moves to the next line.
  function handleSentenceEnd(viaSpeech) {
    state.playsDone++;
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
    updatePlayBtn(false);
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

    state.stats.sentencesPlayed++;
    saveStats();

    const selectedSpeed = getSelectedSpeed();
    if (selectedSpeed !== state.speed) {
      state.speed = selectedSpeed;
      localStorage.setItem('lp_speed', state.speed);
    }
    audio.setRate(state.speed);
    const rates = getPlaybackRates(state.speed);
    // Repeats keep their count; any fresh start (tap, prev/next, play) begins at zero.
    if (playReason !== 'repeat' && playReason !== 'loop') state.playsDone = 0;
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
        tracks.unshift({ src: 'audio/ui/prompt.m4a', rate: 1, title: s.text });
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
    if (pct === 0 || audio.isPlaying) progressBar.style.width = pct + '%';
  }

  function clearLoopTimer() {
    if (state.loopTimer) { clearTimeout(state.loopTimer); state.loopTimer = null; }
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
    sentenceList.querySelectorAll('.word.looked').forEach(el => el.classList.remove('looked'));
  }

  function keepActiveAbovePopup() {
    // Nudge the page so the highlighted line stays readable above the word card.
    requestAnimationFrame(() => {
      if (!activeEl || !wordPopup.classList.contains('show')) return;
      const popupTop = window.innerHeight - wordPopup.offsetHeight;
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
      sentenceList.querySelectorAll('.word.looked').forEach(el => el.classList.remove('looked'));
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

  function openSheet(id) {
    const el = $(id);
    if (!el) return;
    closePopover();
    closeWordPopup();
    if (openSheetEl && openSheetEl !== el) openSheetEl.classList.remove('show');
    el.classList.add('show');
    scrim.classList.add('show');
    document.body.classList.add('sheet-open');
    openSheetEl = el;
    updateLocatePill();
  }

  function closeSheet() {
    if (!openSheetEl) return;
    openSheetEl.classList.remove('show');
    openSheetEl = null;
    scrim.classList.remove('show');
    document.body.classList.remove('sheet-open');
    const select = $('voiceSelect');
    if (select) select.classList.remove('open');
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
  function saveStats() {
    localStorage.setItem('lp_stats', JSON.stringify(state.stats));
  }

  function renderStats() {
    const s = state.stats;
    $('statTiles').innerHTML = `
      <div class="stat-tile"><div class="stat-value">${s.sentencesPlayed || 0}</div><div class="stat-label">${t('statsPlayed')}</div></div>
      <button class="stat-tile" type="button" data-open="wordbook"><div class="stat-value">${state.wordbook.length}</div><div class="stat-label">${t('statsWords')}<i class="ri-arrow-right-s-line"></i></div></button>
      <div class="stat-tile"><div class="stat-value">${SENTENCES.length}</div><div class="stat-label">${t('statsTotal')}</div></div>
    `;
  }

  // ---- Wordbook ----
  function updateWordbookBadge() {
    const badge = $('wordbookBadge');
    const n = state.wordbook.length;
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
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
        audio.speakWord(w, () => {
          btn.classList.remove('speaking');
          if (wasPlaying && resumeIndex === state.currentIndex) {
            playCurrent('loop');
            updatePlayBtn(true);
          }
        }, { voiceVariant: accent });
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

  // ---- Track Session Time ----
  function startSessionTimer() {
    state.stats.startTime = Date.now();
    setInterval(() => {
      if (state.stats.startTime) {
        state.stats.totalTime += 1;
        saveStats();
      }
    }, 60000); // Every minute
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
    updateWordbookBadge();
    if (openSheetEl && openSheetEl.id === 'topicSheet') renderTopicSheet();
    if (openSheetEl && openSheetEl.id === 'wordbookSheet') renderWordbook();

    // Re-render the highlighted line so its button labels follow the language.
    if (activeEl && activeEl.isConnected && state.filtered[state.currentIndex]) {
      renderMsg(activeEl, state.filtered[state.currentIndex], state.currentIndex, true);
    }

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
        populateVoiceSelect(); // refresh "Auto" option label
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
  }

  function setupPersonalization() {
    audio.setEnglishVariant(state.accent);
    const accentButtons = document.querySelectorAll('#accentControl .accent-btn');
    const syncAccentActive = () => {
      accentButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.accent === state.accent));
    };
    syncAccentActive();

    const speakCnSwitch = $('speakCnSwitch');
    const syncSpeakCn = () => speakCnSwitch.setAttribute('aria-checked', String(state.speakCn));
    syncSpeakCn();
    speakCnSwitch.addEventListener('click', () => {
      state.speakCn = !state.speakCn;
      localStorage.setItem('lp_speakCn', String(state.speakCn));
      syncSpeakCn();
      // Takes effect from the next line; the one playing keeps its queue.
      showToast(state.speakCn ? t('speakCnOn') : t('speakCnOff'), state.speakCn ? 'ri-volume-up-line' : 'ri-volume-mute-line');
    });

    $('btnMenu').addEventListener('click', () => {
      renderStats();
      openSheet('menuSheet');
    });
    $('statTiles').addEventListener('click', e => {
      if (e.target.closest('[data-open="wordbook"]')) showWordbook();
    });

    accentButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        state.accent = btn.dataset.accent === 'uk' ? 'uk' : 'us';
        localStorage.setItem('lp_accent', state.accent);
        // NOTE: accent only affects IPA display and lang tag (en-US / en-GB).
        // Voice selection is independent and controlled solely by the voice dropdown.
        syncAccentActive();
        // Refresh word popup pronunciations if open
        const popupWord = $('popupWord').textContent;
        if (wordPopup.classList.contains('show') && popupWord) {
          const dict = getDict();
          renderWordPronunciations(popupWord, (dict && dict[popupWord]) || null);
        }
      });
    });
  }

  // ---- Voice Select ----
  // Novelty / gimmick voice names to exclude from the list
  const NOVELTY_VOICE_BLACKLIST = [
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos',
    'deranged', 'good news', 'hysterical', 'jester', 'organ', 'pipe organ',
    'princess', 'trinoids', 'whisper', 'wobble', 'zarvox', 'superstar',
    'ralph', 'fred', 'junior', 'kathy', 'vicki', 'victoria',
    'ghost', 'creaky', 'alien', 'robot', 'ethereal', 'spooky'
  ];

  function isNormalVoice(voice) {
    const nameLc = voice.name.toLowerCase();
    return !NOVELTY_VOICE_BLACKLIST.some(kw => nameLc.includes(kw));
  }

  function populateVoiceSelect() {
    const container = $('voiceOptions');
    const triggerValue = document.querySelector('.select-value');
    if (!container) return;

    const langPack = i18n[state.lang] || i18n.en;
    const voices = audio.getAvailableVoices('en').filter(isNormalVoice);
    container.innerHTML = '';
    
    // Helper to create an option
    const createOption = (v) => {
      const opt = document.createElement('div');
      opt.className = 'custom-option';
      if (v.name === state.voiceName) opt.classList.add('selected');
      
      let displayName = v.name
        .replace(/Microsoft\s+/g, '')
        .replace(/Google\s+/g, '')
        .replace(/Apple\s+/g, '')
        .replace(/\s*-\s*English\s*\(.*\)/gi, '')
        .replace(/\s*\(.*\)/g, '')
        .trim();
        
      opt.textContent = v.localService ? displayName : (displayName + ' ☁');
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        state.voiceName = v.name;
        localStorage.setItem('lp_voiceName', v.name);
        audio.setVoiceByName(v.name);
        triggerValue.textContent = opt.textContent;
        $('voiceSelect').classList.remove('open');
        populateVoiceSelect(); // Refresh selected state
      });
      return opt;
    };

    // Auto option
    const autoOpt = document.createElement('div');
    autoOpt.className = 'custom-option';
    if (!state.voiceName) autoOpt.classList.add('selected');
    autoOpt.textContent = langPack.voiceDefault;
    autoOpt.addEventListener('click', (e) => {
      e.stopPropagation();
      state.voiceName = '';
      localStorage.removeItem('lp_voiceName');
      audio.setVoiceByName(null);
      triggerValue.textContent = langPack.voiceDefault;
      $('voiceSelect').classList.remove('open');
      populateVoiceSelect();
    });
    container.appendChild(autoOpt);
    
    // Grouped voices
    const usVoices = voices.filter(v => {
      const lc = v.lang.toLowerCase();
      return lc.startsWith('en-us') || lc.startsWith('en-ca');
    });
    const ukVoices = voices.filter(v => {
      const lc = v.lang.toLowerCase();
      return !lc.startsWith('en-us') && !lc.startsWith('en-ca');
    });

    if (usVoices.length) {
      const label = document.createElement('div');
      label.className = 'option-group-label';
      label.textContent = state.lang === 'zh' ? '🇺🇸 美式英语 (US)' : '🇺🇸 US English';
      container.appendChild(label);
      usVoices.forEach(v => container.appendChild(createOption(v)));
    }

    if (ukVoices.length) {
      const label = document.createElement('div');
      label.className = 'option-group-label';
      label.textContent = state.lang === 'zh' ? '🇬🇧 英式/其他 (UK)' : '🇬🇧 UK / Other';
      container.appendChild(label);
      ukVoices.forEach(v => container.appendChild(createOption(v)));
    }

    // Set initial trigger value
    if (state.voiceName) {
      const currentVoice = voices.find(v => v.name === state.voiceName);
      if (currentVoice) {
        let displayName = currentVoice.name.replace(/Microsoft\s+|Google\s+|Apple\s+/g, '').replace(/\s*-\s*English\s*\(.*\)/gi, '').replace(/\s*\(.*\)/g, '').trim();
        triggerValue.textContent = currentVoice.localService ? displayName : (displayName + ' ☁');
      } else {
        triggerValue.textContent = langPack.voiceDefault;
      }
    } else {
      triggerValue.textContent = langPack.voiceDefault;
    }
  }

  function setupVoiceSelect() {
    const select = $('voiceSelect');
    const trigger = select ? select.querySelector('.select-trigger') : null;
    const previewBtn = $('btnPreviewVoice');
    if (!select || !trigger) return;

    populateVoiceSelect();

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      select.classList.toggle('open');
      
      // Close other dropdowns if any
      if (select.classList.contains('open')) {
        const moreMenu = $('headerDropdown');
        if (moreMenu) moreMenu.classList.remove('show');
      }
    });

    document.addEventListener('click', () => {
      select.classList.remove('open');
    });

    // Re-populate when browser finishes loading all voices
    const synth = window.speechSynthesis;
    synth.onvoiceschanged = () => populateVoiceSelect();

    // Restore saved voice after engine is ready
    if (state.voiceName) {
      setTimeout(() => audio.setVoiceByName(state.voiceName), 400);
    }

    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const voices = synth.getVoices();
        const selVoice = state.voiceName ? voices.find(v => v.name === state.voiceName) : null;
        const utt = new SpeechSynthesisUtterance('Hello, this is a voice preview.');
        if (selVoice) utt.voice = selVoice;
        utt.lang = selVoice ? selVoice.lang : (state.accent === 'uk' ? 'en-GB' : 'en-US');
        utt.rate = 0.9;
        utt.pitch = 1;
        previewBtn.classList.add('speaking');
        utt.onend = utt.onerror = () => previewBtn.classList.remove('speaking');
        synth.cancel();
        synth.speak(utt);
      });
    }
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
      metaThemeColor.setAttribute('content', state.theme === 'light' ? '#f4f5f9' : '#0b0b12');
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
    setupScrollTracking();
    setupKeyboard();
    startSessionTimer();

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
      setTimeout(() => {
        setupVoiceSelect();
        setupInstallPrompt();
      }, 100);
    });
  }

  init();
})();
