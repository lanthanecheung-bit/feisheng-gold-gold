/**
 * 飛升 Gold Gold! — Level 2
 * Surf the open ocean on a huge golden leaf; dodge mermaid splash waves & octopus ink;
 * reach the golden island city → 黃金戰士套裝 armor transform.
 */
(() => {
  "use strict";

  const SAVE_KEY = "feishengGoldGold.save";
  const START_HEARTS = 3;
  const GOAL_DIST = 40000; // ~3.2 min at SURF_SPEED 210 // world units to island
  const SURF_SPEED = 210; // auto-forward px/s
  const STRAFE_SPEED = 380; // base vertical dodge
  const STRAFE_TAP_WINDOW = 0.32; // seconds between taps to count as a combo
  const STRAFE_TAP_BOOST = 0.28; // +28% speed per extra tap
  const STRAFE_TAP_MAX = 4; // max combo stacks → up to ~2.1x speed
  const STRAFE_BOOST_DECAY = 0.9; // seconds boost lasts after last tap
  const LANE_MIN = 0.28; // wide top (HUD no longer overlays canvas) // mid-water — never under top UI
  const LANE_MAX = 0.94; // allow lower near bottom // wide bottom above controls
  const MERMAID_SWIM = 175; // mermaids race toward the angel (world px/s left)
  const OCTOPUS_SWIM = 28; // octopuses crawl slowly (world px/s left)
  const SPAWN_MERMAID_AHEAD = 340; // extra px beyond screen edge
  const SPAWN_OCTOPUS_AHEAD = 520;
  const ISLAND_BONUS_COINS = 8;
  const KILL_COIN_REWARD = 3; // shoot enemy → coins only (no hearts)
  const CACHE_V = "1789585300";
  const BALANCE_MAX = 100;
  const ARROW_SPEED = 520;
  const SHOOT_COOLDOWN = 0.38;
  const SHOOT_COOLDOWN_BOOST = 0.14; // 射擊效果期間更快連射
  const PEARL_SHOOT_BONUS = 1; // 每枚白海貝珍珠 +1 秒射擊效果
  const PEARL_COIN = 1;
  const PEARL_SPACING = 920; // world px between shells
  const AIM_STEP = 0.9; // rad/s while holding aim up/down
  const AIM_MAX = 0.55; // max pitch for straight shots
  const MAX_HEARTS_SOFT = 12;
  const CHAR_SCALE = 0.48; // 第二關全體角色再縮小
  const HUD_TOP_SAFE = 12; // canvas no longer under HUD; small margin only
  const CTRL_BOTTOM_SAFE = 72; // less margin so angel can go lower // px — keep above touch controls + hint
  const ANGEL_DRAW_H = 36; // match drawSurfer destH
  const MERMAID_DRAW_H = 34;
  const OCTOPUS_DRAW_H = 30;
  const LEAF_SCALE = 0.48;

  // --- Save ---
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return {
          heartsBanked: 0,
          coins: 0,
          streakBest: 0,
          level1Cleared: false,
          level2Cleared: false,
          level3Cleared: false,
          level4Cleared: false,
          goldenArmor: false,
          skyChariotKey: false,
        };
      }
      const data = JSON.parse(raw);
      return {
        heartsBanked: Number(data.heartsBanked) || 0,
        coins: Number(data.coins) || 0,
        streakBest: Number(data.streakBest) || 0,
        level1Cleared: !!data.level1Cleared,
        level2Cleared: !!data.level2Cleared,
        level3Cleared: !!data.level3Cleared,
        level4Cleared: !!data.level4Cleared,
        goldenArmor: !!data.goldenArmor,
        skyChariotKey: !!data.skyChariotKey,
      };
    } catch (_) {
      return {
        heartsBanked: 0,
        coins: 0,
        streakBest: 0,
        level1Cleared: false,
        level2Cleared: false,
        level3Cleared: false,
        level4Cleared: false,
        goldenArmor: false,
        skyChariotKey: false,
      };
    }
  }

  function writeSave(partial) {
    const prev = loadSave();
    const next = { ...prev, ...partial };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch (_) { /* ignore */ }
    return next;
  }

  // --- DOM ---
  const screens = {
    start: document.getElementById("start-screen"),
    gameL1: document.getElementById("game-screen"),
    winL1: document.getElementById("win-screen"),
    loseL1: document.getElementById("lose-screen"),
    gameL2: document.getElementById("level2-screen"),
    winL2: document.getElementById("win-screen-l2"),
    loseL2: document.getElementById("lose-screen-l2"),
  };

  const canvas = document.getElementById("level2-canvas");
  const ctx = canvas.getContext("2d");
  const livesEl = document.getElementById("l2-lives");
  const coinsEl = document.getElementById("l2-coins");
  const progressEl = document.getElementById("l2-progress");
  const balanceFillEl = document.getElementById("l2-balance-fill");
  const balanceLabelEl = document.getElementById("l2-balance-label");
  const failToast = document.getElementById("l2-fail-toast");
  const winCoinsEl = document.getElementById("l2-win-coins");
  const winHeartsEl = document.getElementById("l2-win-hearts");
  const winArmorCanvas = document.getElementById("l2-armor-preview");
  const loseReason = document.getElementById("l2-lose-reason");

  const angelBoyImg = new Image();
  angelBoyImg.src = `assets/angel-boy.png?v=${CACHE_V}`;
  const angelGirlImg = new Image();
  angelGirlImg.src = `assets/angel-girl.png?v=${CACHE_V}`;
  const angelBoyGoldImg = new Image();
  angelBoyGoldImg.src = `assets/angel-boy-gold.png?v=${CACHE_V}`;
  const angelGirlGoldImg = new Image();
  angelGirlGoldImg.src = `assets/angel-girl-gold.png?v=${CACHE_V}`;
  const mermaidImg = new Image();
  mermaidImg.src = `assets/mermaid.png?v=${CACHE_V}`;
  const octopusImg = new Image();
  octopusImg.src = `assets/octopus.png?v=${CACHE_V}`;
  const skyCloudsImg = new Image();
  skyCloudsImg.src = `assets/sky-clouds.png?v=${CACHE_V}`;
  const goldenBowImg = new Image();
  goldenBowImg.src = `assets/golden-bow.png?v=${CACHE_V}`;
  const goldenArrowImg = new Image();
  goldenArrowImg.src = `assets/golden-arrow.png?v=${CACHE_V}`;
  const pearlShellImg = new Image();
  pearlShellImg.src = `assets/pearl-shell.png?v=${CACHE_V}`;

  function angelSprite(gender) {
    return gender === "girl" ? angelGirlImg : angelBoyImg;
  }

  /** Golden Cloth form — armor worn ON the cherub (Saint Seiya–style). */
  function angelGoldSprite(gender) {
    return gender === "girl" ? angelGirlGoldImg : angelBoyGoldImg;
  }

  // --- Audio ---
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playSplash() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const dur = 0.35;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / ac.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 9) * 0.7;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600;
    bp.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.7, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(ac.destination);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  function playInk() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    osc.connect(lp);
    lp.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.48);

    const dur = 0.3;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / ac.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.45;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const ng = ac.createGain();
    ng.gain.value = 0.5;
    src.connect(ng);
    ng.connect(ac.destination);
    src.start(now);
    src.stop(now + dur);
  }

  function playHit() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  function playBow() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.16);
    // string twang noise
    const dur = 0.08;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / ac.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.35;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const ng = ac.createGain();
    ng.gain.value = 0.5;
    src.connect(ng);
    ng.connect(ac.destination);
    src.start(now);
    src.stop(now + dur);
  }

  function playHeartGain() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ac.createGain();
      const t0 = now + i * 0.05;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.22);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
  }

  function playWinFanfare() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ac.createGain();
      const t0 = now + i * 0.09;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.35);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  }

  function showAllScreensOff() {
    document.querySelectorAll("#app > .screen").forEach((s) => s.classList.remove("active"));
  }

  function showScreen(el) {
    showAllScreensOff();
    if (el) el.classList.add("active");
  }

  function heartIcons(n) {
    const filled = Math.max(0, n);
    if (filled >= START_HEARTS) return "♥".repeat(filled);
    return "♥".repeat(filled) + "♡".repeat(START_HEARTS - filled);
  }

  function showToast(msg, ms = 1600) {
    if (!failToast) return;
    failToast.textContent = msg;
    failToast.classList.remove("hidden");
    if (state) state.toastTimer = ms / 1000;
  }

  // --- State ---
  let state = null;
  let raf = 0;
  let lastTs = 0;

  function resizeCanvas() {
    const wrap = document.getElementById("stage-wrap-l2");
    if (!wrap || !canvas) return { W: 960, H: 540 };
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Prefer a wide ocean playfield (landscape feel)
    const cssW = Math.max(420, rect.width);
    const cssH = Math.max(260, Math.min(rect.height, rect.width * 0.62));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: cssW, H: cssH };
  }

  function getViewSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { W: canvas.width / dpr, H: canvas.height / dpr };
  }

  function clampPlayerLane(lane) {
    const { H } = getViewSize();
    // Soft margins: head stays on canvas, feet above bottom controls — but band stays WIDE
    const minY = HUD_TOP_SAFE + ANGEL_DRAW_H;
    const maxY = Math.max(minY + 40, H - CTRL_BOTTOM_SAFE);
    let minLane = Math.max(LANE_MIN, minY / Math.max(1, H));
    let maxLane = Math.min(LANE_MAX, maxY / Math.max(1, H));
    if (minLane > maxLane - 0.08) {
      // ultra-short screens: still give at least ~8% travel
      const mid = (LANE_MIN + LANE_MAX) / 2;
      minLane = mid - 0.12;
      maxLane = mid + 0.12;
    }
    return Math.max(minLane, Math.min(maxLane, lane));
  }

  function registerStrafeTap(dir) {
    if (!state || !state.player) return;
    const p = state.player;
    // Same direction within window → stack boost; opposite / timeout → reset to 1
    if (p.tapDir === dir && p.tapTimer > 0) {
      p.tapCount = Math.min(STRAFE_TAP_MAX, (p.tapCount || 0) + 1);
    } else {
      p.tapCount = 1;
      p.tapDir = dir;
    }
    p.tapTimer = STRAFE_TAP_WINDOW;
    p.tapBoost = STRAFE_BOOST_DECAY;
    p.tapMul = 1 + (p.tapCount - 1) * STRAFE_TAP_BOOST;
  }


  function createState() {
    const save = loadSave();
    const hearts =
      save.heartsBanked > 0 ? save.heartsBanked : START_HEARTS;
    const { W, H } = getViewSize();
    const waterY = H * 0.58;
    return {
      phase: "play", // play | dunk | win | lose
      hearts,
      coins: save.coins || 0,
      progress: 0,
      elapsed: 0, // seconds in L2 for minute-based spawns
      surfSpeed: SURF_SPEED,
      spray: [],
      _seaSwell: 0,
      _sprayT: null,
      gender: Math.random() < 0.5 ? "girl" : "boy",
      player: {
        // screen-relative lateral (0..1 across water band as Y fraction)
        lane: 0.62, // mid, more room downward
        screenX: W * 0.10, // 再靠後少少（畫面偏左）
        bob: 0,
        facing: 1,
        invuln: 0,
        dunkTimer: 0,
        armored: false,
        balance: BALANCE_MAX * 0.85,
        lean: 0, // -1..1 visual lean
        shootCd: 0,
        shootBoost: 0, // 白海貝珍珠射擊效果剩餘秒數
        aimAngle: 0, // radians, 0 = forward/right
        inkSplash: 0, // visual: thin ink jets just hit angel
        hazardFailStreak: 0, // consecutive fail-to-dodge (mermaid/octopus)
        tapDir: 0, // -1 up / +1 down last tap
        tapCount: 0,
        tapTimer: 0,
        tapBoost: 0, // remaining boost time
        tapMul: 1,
      },
      keys: { left: false, right: false, shoot: false, aimUp: false, aimDown: false },
      arrows: [],
      pearls: [],
      nextPearlAt: 380,
      mermaids: [],
      octopi: [],
      waves: [], // splash hitboxes
      inks: [], // thin ink jet streams from octopi
      particles: [],
      spawnMermaidTimer: 2.2,
      spawnOctopusTimer: 5.5,
      difficulty: 0,
      toastTimer: 0,
      worldTime: 0,
      cameraX: 0,
      waterY,
      pendingLose: null,
      winCelebrating: false,
      transformT: 0,
    };
  }

  function updateHUD() {
    if (!state) return;
    if (livesEl) livesEl.textContent = heartIcons(state.hearts);
    if (coinsEl) coinsEl.textContent = String(state.coins);
    if (progressEl) {
      const pct = Math.min(100, Math.floor((state.progress / GOAL_DIST) * 100));
      const sec = Math.floor(state.elapsed || 0);
      const mm = Math.floor(sec / 60);
      const ss = String(sec % 60).padStart(2, "0");
      const boost = state.player.shootBoost || 0;
      const boostTxt = boost > 0 ? ` · ⚔${boost.toFixed(1)}s` : "";
      progressEl.textContent = `${pct}% · ${mm}:${ss}` + boostTxt;
    }
    const bal = Math.max(0, Math.min(BALANCE_MAX, state.player.balance));
    if (balanceFillEl) {
      balanceFillEl.style.width = `${(bal / BALANCE_MAX) * 100}%`;
      balanceFillEl.classList.toggle("warn", bal < 35);
      balanceFillEl.classList.toggle("ok", bal >= 70);
    }
    if (balanceLabelEl) {
      if (bal < 25) balanceLabelEl.textContent = "平衡！危險";
      else if (bal < 50) balanceLabelEl.textContent = "平衡：小心";
      else balanceLabelEl.textContent = "平衡";
    }
  }

  // --- Spawning ---
  function spawnMermaid() {
    const { W, H } = getViewSize();
    // Far spawn — more reaction depth before they rush in
    const ahead = state.cameraX + W + SPAWN_MERMAID_AHEAD + Math.random() * 220;
    const lane = LANE_MIN + Math.random() * (LANE_MAX - LANE_MIN);
    state.mermaids.push({
      x: ahead,
      lane,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      splashed: false,
      gone: false,
      hp: 1,
      swim: MERMAID_SWIM * (0.9 + Math.random() * 0.25),
    });
  }

  function spawnOctopus() {
    const { W, H } = getViewSize();
    // Even farther + slow crawl — tanky ink platforms
    const ahead = state.cameraX + W + SPAWN_OCTOPUS_AHEAD + Math.random() * 280;
    state.octopi.push({
      x: ahead,
      lane: LANE_MIN + 0.12 + Math.random() * (LANE_MAX - LANE_MIN - 0.24),
      age: 0,
      sprayed: false,
      gone: false,
      hp: 1,
      bodyHit: false,
      swim: OCTOPUS_SWIM * (0.85 + Math.random() * 0.3),
    });
  }

  function addWave(worldX, lane) {
    // telegraph then lethal
    state.waves.push({
      x: worldX,
      lane,
      age: 0,
      telegraph: 0.55,
      lethalDur: 0.7,
      hit: false,
      w: 70,
    });
  }

  function addInk(octopus) {
    // Thin ink jets from octopus toward the angel's lane (mini water-column streams).
    // Brief wind-up telegraph, then jets fire left toward the surfer.
    const targetLane = Math.max(
      LANE_MIN + 0.04,
      Math.min(LANE_MAX - 0.04, state.player.lane + (Math.random() - 0.5) * 0.04)
    );
    const jets = [];
    const n = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      jets.push({
        laneOff: (i - (n - 1) / 2) * 0.016 + (Math.random() - 0.5) * 0.008,
        phase: Math.random() * Math.PI * 2,
        thick: 1.6 + Math.random() * 1.8,
        curve: (Math.random() - 0.5) * 0.35,
      });
    }
    state.inks.push({
      x: octopus.x,
      originLane: octopus.lane,
      targetLane,
      age: 0,
      telegraph: 0.42,
      lethalDur: 0.72,
      hit: false,
      jets,
      reach: 420, // longer jets — octopi spawn farther away
      laneTol: 0.07,
    });
  }

  // --- Collision helpers ---
  function playerWorldX() {
    return state.cameraX + state.player.screenX;
  }

  function playerHit(hazardX, hazardW, hazardLane, laneTol) {
    const px = playerWorldX();
    const pl = state.player.lane;
    if (Math.abs(px - hazardX) > hazardW * 0.55) return false;
    if (Math.abs(pl - hazardLane) > laneTol) return false;
    return true;
  }

  function takeHit(kind) {
    if (!state || state.phase !== "play") return;
    if (state.player.invuln > 0) return;

    const isHazard = kind === "wave" || kind === "ink" || kind === "octopus";
    // balance tip is separate — does not count toward "避不開" streak
    if (isHazard) {
      state.player.hazardFailStreak = (state.player.hazardFailStreak || 0) + 1;
    }

    const doubleFail = isHazard && state.player.hazardFailStreak >= 2;
    const dmg = 1; // 避不開一次 −1♡

    state.hearts = Math.max(0, state.hearts - dmg);
    state.player.invuln = 1.55;
    state.player.balance = Math.min(BALANCE_MAX, state.player.balance + 25);
    playHit();

    if (doubleFail) {
      // 連續避不開兩次（美人魚或八爪魚）→ 墮海並扣 2 心
      state.player.hazardFailStreak = 0;
      playSplash();
      showToast("連續避唔開！墮海 −1♡");
      state.phase = "dunk";
      state.player.dunkTimer = 1.0;
      if (kind === "ink" || kind === "octopus") {
        state.player.inkSplash = 0.55;
        playInk();
      }
    } else if (kind === "wave") {
      playSplash();
      showToast("墮海！美人魚浪花 −1♡");
      state.phase = "dunk";
      state.player.dunkTimer = 0.85;
    } else if (kind === "balance") {
      playSplash();
      showToast("失平衡！墮海 −1♡");
      state.phase = "dunk";
      state.player.dunkTimer = 0.85;
    } else if (kind === "ink") {
      playInk();
      showToast("中墨！八爪魚墨水 −1♡");
      state.player.inkSplash = 0.7;
    } else if (kind === "octopus") {
      playInk();
      showToast("避唔開八爪魚！−1♡");
      state.player.inkSplash = 0.45;
    } else {
      playInk();
      showToast("避唔開！−1♡");
      state.player.inkSplash = 0.45;
    }

    updateHUD();
    if (state.hearts <= 0) {
      state.pendingLose = "生命用完了！再試一次，加油！";
      if (kind === "wave" || kind === "balance" || doubleFail) {
        // dunk path ends lose after dunk finishes if hearts 0 — keep pendingLose
        if (state.phase !== "dunk") endLose(state.pendingLose);
      } else {
        endLose(state.pendingLose);
      }
    }
  }

  function gainHeart(reason) {
    if (!state) return;
    if (state.hearts >= MAX_HEARTS_SOFT) {
      showToast("命中！♡ 已滿");
      playHeartGain();
      return;
    }
    state.hearts += 1;
    playHeartGain();
    showToast(reason || "命中！♡ +1");
    updateHUD();
  }

  function tryShoot(aimWorldY) {
    if (!state || state.phase !== "play") return;
    if (state.player.shootCd > 0) return;
    const { H } = getViewSize();
    const px = playerWorldX();
    const py = H * state.player.lane - 40;
    // Straight shot only along bow tip aim (no auto-aim / no seeking)
    let angle = state.player.aimAngle || 0;
    if (aimWorldY != null) {
      // optional tap-on-canvas sets aim then fires straight
      const dy = aimWorldY - py;
      const dx = 220;
      angle = Math.atan2(dy, dx);
    }
    angle = Math.max(-AIM_MAX, Math.min(AIM_MAX, angle));
    state.player.aimAngle = angle;
    const boosted = (state.player.shootBoost || 0) > 0;
    state.player.shootCd = boosted ? SHOOT_COOLDOWN_BOOST : SHOOT_COOLDOWN;
    state.player.facing = 1;
    state.player.balance = Math.max(0, state.player.balance - (boosted ? 2 : 4));
    const speed = ARROW_SPEED * (boosted ? 1.25 : 1);
    const life = boosted ? 1.7 : 1.4;
    function pushArrow(ang, yOff) {
      state.arrows.push({
        x: px + 28,
        y: py + (yOff || 0),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life,
        angle: ang,
        boosted: !!boosted,
      });
    }
    pushArrow(angle, 0);
    // 射擊效果：左右各多一枝小擴散
    if (boosted) {
      pushArrow(angle - 0.12, -4);
      pushArrow(angle + 0.12, 4);
    }
    playBow();
  }

  function onEnemyKilled(kind) {
    if (state && state.player) state.player.hazardFailStreak = 0;
    // Harder: shooting awards coins only — no hearts
    state.coins += KILL_COIN_REWARD;
    playHeartGain(); // reuse chime as reward SFX
    const who = kind === "mermaid" ? "美人魚" : "八爪魚";
    showToast(`射中${who}！金幣 +${KILL_COIN_REWARD}`);
    state.player.balance = Math.min(BALANCE_MAX, state.player.balance + 12);
    updateHUD();
  }

  function endWin() {
    state.phase = "win";
    state.player.armored = true;
    state.coins += ISLAND_BONUS_COINS;
    playWinFanfare();
    writeSave({
      heartsBanked: state.hearts,
      coins: state.coins,
      level1Cleared: true,
      level2Cleared: true,
      goldenArmor: true,
    });
    cancelAnimationFrame(raf);
    if (winCoinsEl) winCoinsEl.textContent = String(state.coins);
    if (winHeartsEl) winHeartsEl.textContent = String(state.hearts);
    drawArmorPreview();
    refreshMenuButtons();
    // Direct into Level 3 (no long win-screen wait)
    stopLevel2();
    if (window.FeishengLevel3 && typeof window.FeishengLevel3.start === "function") {
      window.FeishengLevel3.start();
    } else {
      // Fallback if L3 script missing
      showScreen(screens.winL2);
      const note = document.getElementById("l2-auto-l3-note");
      if (note) note.classList.remove("hidden");
    }
  }

  function endLose(reason) {
    state.phase = "lose";
    const prev = loadSave();
    writeSave({
      heartsBanked: prev.heartsBanked,
      coins: prev.coins,
      level1Cleared: prev.level1Cleared,
      level2Cleared: prev.level2Cleared,
      level3Cleared: prev.level3Cleared,
      level4Cleared: prev.level4Cleared,
      skyChariotKey: prev.skyChariotKey,
      goldenArmor: prev.goldenArmor,
    });
    cancelAnimationFrame(raf);
    if (loseReason) loseReason.textContent = reason || "挑戰失敗";
    showScreen(screens.loseL2);
  }

  // --- Drawing ---
  function imgReady(img) {
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  function drawOceanSky(W, H, t) {
    // 藍天白雲飄飄
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, "#4fc3f7");
    sky.addColorStop(0.45, "#81d4fa");
    sky.addColorStop(0.85, "#b3e5fc");
    sky.addColorStop(1, "#e1f5fe");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.55);

    // soft sun
    const sx = W * 0.78;
    const sy = H * 0.14;
    const sunG = ctx.createRadialGradient(sx, sy, 4, sx, sy, 55);
    sunG.addColorStop(0, "#fffde7");
    sunG.addColorStop(0.4, "rgba(255, 236, 179, 0.75)");
    sunG.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(sx, sy, 55, 0, Math.PI * 2);
    ctx.fill();

    // 新版卡通白雲（精靈圖 3×2；無圖時用蓬鬆 procedural）
    function cloudPuff(cx, cy, rx, ry, a) {
      ctx.globalAlpha = a;
      // soft peach underside
      const g = ctx.createRadialGradient(cx, cy + ry * 0.2, 2, cx, cy, rx * 1.2);
      g.addColorStop(0, "#fffef8");
      g.addColorStop(0.55, "#ffffff");
      g.addColorStop(1, "rgba(255, 224, 200, 0.85)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.55, cy + ry * 0.05, rx * 0.62, ry * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + rx * 0.48, cy + ry * 0.02, rx * 0.7, ry * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.1, cy - ry * 0.45, rx * 0.5, ry * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const cam0 = state ? state.cameraX : 0;
    // sheet: 3 cols × 2 rows
    const cols = 3;
    const rows = 2;
    const useSprite = imgReady(skyCloudsImg);
    const sw = useSprite ? skyCloudsImg.naturalWidth / cols : 0;
    const sh = useSprite ? skyCloudsImg.naturalHeight / rows : 0;
    for (let i = 0; i < 7; i++) {
      const speed = 10 + i * 3.5;
      const cx = ((i * 173 + t * speed + cam0 * 0.1) % (W + 280)) - 140;
      const cy = 22 + (i * 47) % Math.max(40, Math.floor(H * 0.36));
      const scale = 0.55 + (i % 4) * 0.12;
      if (useSprite) {
        const col = i % cols;
        const row = (i + (i > 3 ? 1 : 0)) % rows;
        const dw = sw * scale * 0.42;
        const dh = sh * scale * 0.42;
        ctx.globalAlpha = 0.92 - (i % 3) * 0.06;
        ctx.drawImage(
          skyCloudsImg,
          col * sw,
          row * sh,
          sw,
          sh,
          cx - dw / 2,
          cy - dh / 2,
          dw,
          dh
        );
        ctx.globalAlpha = 1;
      } else {
        const rx = 48 + (i % 4) * 14;
        const ry = 18 + (i % 3) * 5;
        cloudPuff(cx, cy, rx, ry, 0.82 - (i % 3) * 0.08);
      }
    }

    // horizon: blue sky meets gold sea
    const hz = ctx.createLinearGradient(0, H * 0.48, 0, H * 0.58);
    hz.addColorStop(0, "rgba(179, 229, 252, 0)");
    hz.addColorStop(0.55, "rgba(255, 236, 179, 0.25)");
    hz.addColorStop(1, "rgba(255, 193, 7, 0.4)");
    ctx.fillStyle = hz;
    ctx.fillRect(0, H * 0.48, W, H * 0.12);

    // Golden sea with gentle heave while surfing forward
    const seaTop = H * 0.52;
    const cam = state ? state.cameraX : 0;
    const swell =
      Math.sin(t * 1.35 + cam * 0.008) * 10 +
      Math.sin(t * 0.7 + cam * 0.003) * 6;
    const sea = ctx.createLinearGradient(0, seaTop + swell * 0.3, 0, H);
    sea.addColorStop(0, "#ffe082");
    sea.addColorStop(0.22, "#ffd54f");
    sea.addColorStop(0.55, "#f9a825");
    sea.addColorStop(0.82, "#ef6c00");
    sea.addColorStop(1, "#e65100");
    ctx.fillStyle = sea;
    ctx.fillRect(0, seaTop - 8 + swell * 0.15, W, H - seaTop + 16);

    // Rolling gold wave crests (起伏)
    for (let i = 0; i < 7; i++) {
      const yy = seaTop + 14 + i * ((H - seaTop) / 6.2) + swell * (0.35 + i * 0.08);
      const amp = 5 + i * 1.6 + Math.abs(Math.sin(t * 1.1 + i)) * 3;
      ctx.strokeStyle = `rgba(255, 248, 225, ${0.18 + (i % 2) * 0.1})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const wx = x + cam * (0.55 + i * 0.04);
        const y =
          yy +
          Math.sin(wx * 0.018 + t * 2.4 + i * 0.9) * amp +
          Math.sin(wx * 0.045 + t * 1.6) * (amp * 0.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.strokeStyle = `rgba(255, 213, 79, ${0.12 + (i % 3) * 0.04})`;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }

    // Sparkles on gold water
    ctx.fillStyle = "rgba(255, 255, 220, 0.35)";
    for (let k = 0; k < 14; k++) {
      const px = ((k * 97 + cam * 0.3 + t * 40) % (W + 40)) - 20;
      const py = seaTop + 30 + ((k * 53) % (H * 0.35)) + Math.sin(t * 3 + k) * 4;
      ctx.globalAlpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 5 + k));
      ctx.beginPath();
      ctx.arc(px, py, 1.6 + (k % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (state) state._seaSwell = swell;
  }

  function drawGoldenLeaf(g, x, y, scale, t) {
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.rotate(Math.sin(t * 3) * 0.04);
    // huge leaf board
    const lg = g.createLinearGradient(-50, -8, 50, 12);
    lg.addColorStop(0, "#ffe082");
    lg.addColorStop(0.4, "#ffd700");
    lg.addColorStop(0.7, "#f0b429");
    lg.addColorStop(1, "#c9a227");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(-55, 4);
    g.quadraticCurveTo(-20, -18, 10, -14);
    g.quadraticCurveTo(50, -8, 58, 6);
    g.quadraticCurveTo(40, 18, 5, 16);
    g.quadraticCurveTo(-30, 14, -55, 4);
    g.closePath();
    g.fill();
    g.strokeStyle = "#a67c00";
    g.lineWidth = 2;
    g.stroke();
    // veins
    g.strokeStyle = "rgba(166, 124, 0, 0.55)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-40, 2);
    g.quadraticCurveTo(0, -6, 45, 4);
    g.stroke();
    g.beginPath();
    g.moveTo(-10, 0);
    g.quadraticCurveTo(5, 8, 20, 10);
    g.stroke();
    // golden sea foam under leaf
    g.fillStyle = "rgba(255, 248, 225, 0.65)";
    g.beginPath();
    g.ellipse(5, 18, 42, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255, 213, 79, 0.35)";
    g.beginPath();
    g.ellipse(-8, 16, 18, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /** Subtle gold spray / 浪花 while surfing forward */
  function drawSurfSpray(W, H, t) {
    if (!state || !state.player) return;
    if (state.phase !== "play" && state.phase !== "dunk") return;
    const p = state.player;
    const x = p.screenX != null ? p.screenX : W * 0.10;
    const swell = state._seaSwell || 0;
    const dunk = state.phase === "dunk";
    const dunkSink = dunk ? (1 - Math.max(0, p.dunkTimer) / 0.85) * 28 : 0;
    const y = H * p.lane + 10 + dunkSink + swell * 0.25;
    const speed = state.surfSpeed * (dunk ? 0.35 : 1);
    if (!state.spray) state.spray = [];
    const last = state._sprayT == null ? t : state._sprayT;
    const dt = Math.min(0.05, Math.max(0.008, (t - last) || 0.016));
    state._sprayT = t;
    const spawnN = Math.min(4, 1 + Math.floor(speed / 120));
    for (let i = 0; i < spawnN; i++) {
      if (Math.random() > 0.5) continue;
      state.spray.push({
        x: x - 20 - Math.random() * 30,
        y: y + 6 + (Math.random() - 0.5) * 12,
        vx: -50 - Math.random() * 80 - speed * 0.1,
        vy: -30 - Math.random() * 45,
        life: 0.3 + Math.random() * 0.35,
        r: 1.4 + Math.random() * 2.6,
        gold: Math.random() > 0.3,
      });
    }
    const next = [];
    for (const s of state.spray) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 95 * dt;
      if (s.life <= 0) continue;
      next.push(s);
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 2.2));
      ctx.fillStyle = s.gold ? "rgba(255, 236, 179, 0.95)" : "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.55 + s.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    state.spray = next.slice(-90);
  }

  /**
   * Saint Seiya–style golden armor overlay on cherub sprite.
   * Drawn in local sprite space after image (feet at 0).
   */
  function drawGoldenArmorOverlay(g, destW, destH, t) {
    const shimmer = 0.55 + Math.sin(t * 6) * 0.15;
    g.save();
    g.globalAlpha = 0.92;

    // helmet / diadem
    const hg = g.createLinearGradient(-destW * 0.2, -destH * 0.95, destW * 0.2, -destH * 0.7);
    hg.addColorStop(0, "#fff8c0");
    hg.addColorStop(0.5, "#ffd700");
    hg.addColorStop(1, "#c9a227");
    g.fillStyle = hg;
    g.beginPath();
    g.moveTo(-destW * 0.28, -destH * 0.78);
    g.quadraticCurveTo(-destW * 0.22, -destH * 0.98, 0, -destH * 1.02);
    g.quadraticCurveTo(destW * 0.22, -destH * 0.98, destW * 0.28, -destH * 0.78);
    g.quadraticCurveTo(destW * 0.18, -destH * 0.72, 0, -destH * 0.74);
    g.quadraticCurveTo(-destW * 0.18, -destH * 0.72, -destW * 0.28, -destH * 0.78);
    g.fill();
    // crest spike
    g.beginPath();
    g.moveTo(0, -destH * 1.02);
    g.lineTo(-4, -destH * 1.14);
    g.lineTo(4, -destH * 1.14);
    g.closePath();
    g.fill();

    // shoulder pauldrons
    const drawPauldron = (side) => {
      g.save();
      g.translate(side * destW * 0.32, -destH * 0.58);
      g.fillStyle = hg;
      g.beginPath();
      g.ellipse(0, 0, destW * 0.18, destH * 0.1, side * 0.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#8a6a00";
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    };
    drawPauldron(-1);
    drawPauldron(1);

    // chest plate
    g.fillStyle = hg;
    g.beginPath();
    g.moveTo(-destW * 0.22, -destH * 0.55);
    g.lineTo(destW * 0.22, -destH * 0.55);
    g.lineTo(destW * 0.18, -destH * 0.28);
    g.quadraticCurveTo(0, -destH * 0.22, -destW * 0.18, -destH * 0.28);
    g.closePath();
    g.fill();
    g.strokeStyle = "#8a6a00";
    g.lineWidth = 1.5;
    g.stroke();
    // V emblem
    g.strokeStyle = `rgba(255, 248, 192, ${shimmer})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-destW * 0.08, -destH * 0.48);
    g.lineTo(0, -destH * 0.32);
    g.lineTo(destW * 0.08, -destH * 0.48);
    g.stroke();

    // belt / hip
    g.fillStyle = "#e6a800";
    g.fillRect(-destW * 0.16, -destH * 0.26, destW * 0.32, destH * 0.06);
    g.fillStyle = "#fff8c0";
    g.beginPath();
    g.arc(0, -destH * 0.23, 5, 0, Math.PI * 2);
    g.fill();

    // greaves
    const greave = (side) => {
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(side * destW * 0.06, -destH * 0.18);
      g.lineTo(side * destW * 0.16, -destH * 0.18);
      g.lineTo(side * destW * 0.14, -2);
      g.lineTo(side * destW * 0.04, -2);
      g.closePath();
      g.fill();
      g.strokeStyle = "#8a6a00";
      g.lineWidth = 1;
      g.stroke();
    };
    greave(-1);
    greave(1);

    // sparkles
    g.fillStyle = `rgba(255, 255, 200, ${shimmer})`;
    for (let i = 0; i < 5; i++) {
      const ang = t * 3 + i * 1.2;
      const rr = destW * (0.2 + (i % 3) * 0.08);
      g.beginPath();
      g.arc(Math.cos(ang) * rr, -destH * 0.5 + Math.sin(ang * 1.3) * destH * 0.15, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawBowInHand(g, destW, destH, aimAngle) {
    g.save();
    g.translate(destW * 0.28, -destH * 0.38);
    g.rotate(aimAngle || 0);
    if (imgReady(goldenBowImg)) {
      const bw = Math.round(54 * CHAR_SCALE / 0.62);
      const bh = bw * (goldenBowImg.naturalHeight / Math.max(1, goldenBowImg.naturalWidth));
      g.drawImage(goldenBowImg, -bw * 0.15, -bh / 2, bw, bh);
    } else {
      // fallback: ornate gold bow strokes
      g.strokeStyle = "#ffd54f";
      g.lineWidth = 4;
      g.lineCap = "round";
      g.beginPath();
      g.arc(10, 0, 24, -1.2, 1.2);
      g.stroke();
      g.strokeStyle = "#fff8e1";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(10, 0, 21, -1.15, 1.15);
      g.stroke();
      g.strokeStyle = "rgba(255, 236, 179, 0.95)";
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(10 + Math.cos(-1.2) * 24, Math.sin(-1.2) * 24);
      g.lineTo(10 + Math.cos(1.2) * 24, Math.sin(1.2) * 24);
      g.stroke();
      g.fillStyle = "#ffb300";
      g.beginPath();
      g.arc(8, 0, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawArrowProj(a) {
    const sx = a.x - state.cameraX;
    const sy = a.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a.angle);
    if (a.boosted) {
      ctx.shadowColor = "rgba(255, 236, 179, 0.95)";
      ctx.shadowBlur = 12;
    }
    if (imgReady(goldenArrowImg)) {
      const aw = a.boosted ? 36 : 30;
      const ah = aw * (goldenArrowImg.naturalHeight / Math.max(1, goldenArrowImg.naturalWidth));
      ctx.drawImage(goldenArrowImg, -aw * 0.55, -ah / 2, aw, ah);
    } else {
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 2.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.fillStyle = "#fff8e1";
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(8, -5);
      ctx.lineTo(8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffb300";
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-22, -5);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-22, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }


  function drawPearls(t) {
    if (!state || !state.pearls) return;
    const { H, W } = getViewSize();
    for (const pearl of state.pearls) {
      if (pearl.taken) continue;
      const sx = pearl.x - state.cameraX;
      if (sx < -80 || sx > W + 80) continue;
      const sy = H * pearl.lane + Math.sin(t * 2.2 + pearl.bob) * 5;
      const sz = 36;
      if (typeof imgReady === "function" && imgReady(pearlShellImg)) {
        ctx.drawImage(pearlShellImg, sx - sz / 2, sy - sz / 2, sz, sz);
      } else {
        ctx.fillStyle = "#fff8e1";
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e3f2fd";
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      // soft glow when shoot boost active nearby
      ctx.strokeStyle = "rgba(129, 212, 250, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 20 + Math.sin(t * 4 + pearl.bob) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSurfer(p, t, armored) {
    const { H } = getViewSize();
    const y = H * p.lane;
    const x = p.screenX;
    const useGold = !!(armored || p.armored);
    const img = useGold ? angelGoldSprite(state.gender) : angelSprite(state.gender);
    const dunk = state.phase === "dunk";
    const bob = Math.sin(t * 4) * 3 + (dunk ? Math.sin(t * 20) * 5 : 0);
    const dunkSink = dunk ? (1 - Math.max(0, p.dunkTimer) / 0.85) * 28 : 0;
    const lean = (p.lean || 0) * 0.22;

    const swellBob = state._seaSwell ? state._seaSwell * 0.28 : 0;
    drawGoldenLeaf(ctx, x, y + 5 + dunkSink + swellBob, LEAF_SCALE, t);

    if (!img.complete || !img.naturalWidth) {
      ctx.fillStyle = "rgba(255,215,0,0.5)";
      ctx.beginPath();
      ctx.arc(x, y - 14 + bob + dunkSink, 9, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const destH = (useGold ? ANGEL_DRAW_H + 2 : ANGEL_DRAW_H);
    const destW = destH * (img.naturalWidth / img.naturalHeight);
    ctx.save();
    ctx.translate(x, y + bob + dunkSink + swellBob);
    if (dunk) ctx.rotate(Math.sin(t * 12) * 0.25);
    else ctx.rotate(lean);
    if (p.invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.scale(p.facing || 1, 1);
    ctx.drawImage(img, -destW / 2, -destH + 4, destW, destH);
    // Gold sprite already has Saint Seiya Cloth worn on the cherub.
    // Soft sparkles only — no detached armor mannequin overlay.
    if (useGold) {
      const shimmer = 0.45 + Math.sin(t * 6) * 0.2;
      ctx.fillStyle = `rgba(255, 248, 180, ${shimmer})`;
      for (let i = 0; i < 4; i++) {
        const ang = t * 2.8 + i * 1.4;
        ctx.beginPath();
        ctx.arc(
          Math.cos(ang) * destW * 0.28,
          -destH * 0.55 + Math.sin(ang * 1.2) * destH * 0.12,
          2.2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    // Small ink splash on angel when hit by octopus jets
    if (p.inkSplash && p.inkSplash > 0) {
      const a = Math.min(1, p.inkSplash / 0.7);
      ctx.save();
      ctx.globalAlpha = 0.55 * a;
      for (let i = 0; i < 8; i++) {
        const ang = t * 9 + i * 0.9;
        const rr = 6 + (i % 4) * 4;
        ctx.fillStyle = i % 2 ? "rgba(35, 12, 50, 0.95)" : "rgba(80, 40, 110, 0.85)";
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(ang) * rr * 0.6,
          -destH * 0.45 + Math.sin(ang * 1.3) * rr,
          2.2,
          4.5,
          ang * 0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      // thin jet streaks across torso
      ctx.strokeStyle = `rgba(25, 8, 35, ${0.7 * a})`;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(destW * 0.15, -destH * (0.55 - i * 0.08));
        ctx.quadraticCurveTo(
          0,
          -destH * (0.5 - i * 0.08) + Math.sin(t * 20 + i) * 3,
          -destW * 0.2,
          -destH * (0.42 - i * 0.06)
        );
        ctx.stroke();
      }
      ctx.restore();
    }
    drawBowInHand(ctx, destW, destH, p.aimAngle || 0);
    ctx.restore();
  }

  function drawMermaid(m, t) {
    const { H, W } = getViewSize();
    const sx = m.x - state.cameraX;
    const sy = H * m.lane;
    if (sx < -100 || sx > W + 100) return;
    ctx.save();
    ctx.translate(sx, sy);
    const bob = Math.sin(t * 3 + m.phase) * 4;
    ctx.translate(0, bob);

    const img = mermaidImg;
    if (img.complete && img.naturalWidth) {
      const destH = MERMAID_DRAW_H;
      const destW = destH * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, -destW / 2, -destH * 0.72, destW, destH);
    } else {
      // cute fallback while loading
      const tailG = ctx.createLinearGradient(0, 0, 0, 50);
      tailG.addColorStop(0, "#5ce0c0");
      tailG.addColorStop(1, "#1a8a70");
      ctx.fillStyle = tailG;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(18, 30, 8, 52);
      ctx.quadraticCurveTo(-6, 40, -10, 55);
      ctx.quadraticCurveTo(-4, 28, 0, 8);
      ctx.fill();
      ctx.fillStyle = "#f0c8a0";
      ctx.beginPath();
      ctx.ellipse(0, -6, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c43a2a";
      ctx.beginPath();
      ctx.ellipse(-2, -22, 14, 12, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // splash telegraph ring if about to splash
    if (!m.splashed && m.age > 0.8) {
      ctx.strokeStyle = "rgba(100, 200, 255, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 22, 40 + Math.sin(t * 8) * 5, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("浪花！", 0, -58);
    }
    ctx.restore();
  }

  function drawOctopus(o, t) {
    const { H, W } = getViewSize();
    const sx = o.x - state.cameraX;
    const sy = H * o.lane;
    if (sx < -120 || sx > W + 120) return;
    ctx.save();
    ctx.translate(sx, sy + Math.sin(t * 2.5) * 3);

    const img = octopusImg;
    if (img.complete && img.naturalWidth) {
      const destH = OCTOPUS_DRAW_H;
      const destW = destH * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, -destW / 2, -destH * 0.55, destW, destH);
    } else {
      const og = ctx.createRadialGradient(-6, -10, 4, 0, 0, 36);
      og.addColorStop(0, "#c070b0");
      og.addColorStop(1, "#6a3080");
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, -8, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(-10, -12, 7, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(10, -12, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1020";
      ctx.beginPath();
      ctx.arc(-10, -11, 3.5, 0, Math.PI * 2);
      ctx.arc(10, -11, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ink telegraph
    if (!o.sprayed && o.age > 0.55) {
      ctx.fillStyle = "rgba(20, 10, 30, 0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 28, 30, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(80, 40, 100, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(0, 28, 34 + Math.sin(t * 9) * 3, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("墨水！", 0, -48);
    }
    ctx.restore();
  }

  function drawWaveHazard(w, t) {
    const { H, W } = getViewSize();
    const sx = w.x - state.cameraX;
    if (sx < -100 || sx > W + 100) return;
    const sy = H * w.lane;
    const lethal = w.age >= w.telegraph && w.age < w.telegraph + w.lethalDur;
    const tele = w.age < w.telegraph;
    ctx.save();
    if (tele) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 10) * 0.15;
      ctx.strokeStyle = "#7ec8ff";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(sx, sy, w.w * 0.6, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(120, 200, 255, 0.25)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, w.w * 0.5, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (lethal) {
      const rise = Math.min(1, (w.age - w.telegraph) / 0.15);
      ctx.fillStyle = "rgba(180, 230, 255, 0.75)";
      ctx.beginPath();
      ctx.ellipse(sx, sy - 10 * rise, w.w * 0.7, 22 * rise, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(
          sx - 30 + i * 12,
          sy - 8 - Math.sin(t * 8 + i) * 10 * rise,
          4 + (i % 3),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawInkHazard(ink, t) {
    const { H, W } = getViewSize();
    const ox = ink.x - state.cameraX;
    if (ox < -40 || ox > W + 160) return;
    const oy = H * ink.originLane;
    const ty = H * ink.targetLane;
    const lethal = ink.age >= ink.telegraph && ink.age < ink.telegraph + ink.lethalDur;
    const tele = ink.age < ink.telegraph;
    const life = lethal
      ? Math.min(1, (ink.age - ink.telegraph) / 0.12)
      : Math.max(0, ink.age / ink.telegraph);

    ctx.save();

    if (tele) {
      // Wind-up: pulsing beads at beak + dashed aim threads (not a black band)
      const pulse = 0.45 + Math.sin(t * 14) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "#3a2048";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(ox - 6 - i * 5, oy - 4 + Math.sin(t * 10 + i) * 2, 3 + i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(70, 30, 90, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      (ink.jets || []).forEach((j, ji) => {
        const endX = ox - ink.reach * 0.55;
        const endY = ty + j.laneOff * H;
        const midX = (ox + endX) / 2;
        const midY = (oy + endY) / 2 + Math.sin(t * 6 + j.phase) * 10 + j.curve * 24;
        ctx.beginPath();
        ctx.moveTo(ox - 4, oy);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("墨水柱！閃避", ox - 40, oy - 36);
    } else if (lethal) {
      // Active: several thin black/purple ink jets like mini water columns
      const extend = life;
      (ink.jets || []).forEach((j, ji) => {
        const endX = ox - ink.reach * extend;
        const endY = ty + j.laneOff * H;
        const midX = ox - ink.reach * 0.45 * extend;
        const midY =
          (oy + endY) / 2 +
          Math.sin(t * 8 + j.phase) * 12 * extend +
          j.curve * 28 * extend;

        // outer soft sheath
        ctx.strokeStyle = "rgba(55, 25, 80, 0.35)";
        ctx.lineWidth = j.thick + 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ox - 2, oy - 2);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();

        // core jet (dark ink)
        const grad = ctx.createLinearGradient(ox, oy, endX, endY);
        grad.addColorStop(0, "rgba(40, 18, 55, 0.95)");
        grad.addColorStop(0.55, "rgba(20, 8, 30, 0.9)");
        grad.addColorStop(1, "rgba(60, 30, 90, 0.55)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = j.thick;
        ctx.beginPath();
        ctx.moveTo(ox - 2, oy - 2);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();

        // flowing droplets along the jet (water-column feel)
        for (let k = 0; k < 4; k++) {
          const u = ((t * 2.8 + j.phase + k * 0.22) % 1) * extend;
          // quadratic Bezier point along jet
          const one = 1 - u;
          const bx = one * one * (ox - 2) + 2 * one * u * midX + u * u * endX;
          const by = one * one * (oy - 2) + 2 * one * u * midY + u * u * endY;
          ctx.fillStyle = k % 2 === 0 ? "rgba(30, 12, 40, 0.9)" : "rgba(90, 50, 120, 0.75)";
          ctx.beginPath();
          ctx.ellipse(bx, by, 1.6, 3.2, j.curve * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // tip splash bloom
        if (extend > 0.85) {
          ctx.fillStyle = "rgba(40, 15, 55, 0.45)";
          ctx.beginPath();
          ctx.arc(endX, endY, 6 + Math.sin(t * 16 + ji) * 2, 0, Math.PI * 2);
          ctx.fill();
          for (let d = 0; d < 3; d++) {
            const ang = t * 10 + ji + d * 2.1;
            ctx.beginPath();
            ctx.arc(
              endX + Math.cos(ang) * 8,
              endY + Math.sin(ang) * 5,
              2,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
      });
    }
    ctx.restore();
  }

  function drawIsland(W, H, t) {
    const islandWorldX = GOAL_DIST + 40;
    const sx = islandWorldX - state.cameraX;
    if (sx > W + 200 || sx < -300) return;

    ctx.save();
    // sand island
    const ig = ctx.createLinearGradient(sx, H * 0.5, sx, H * 0.85);
    ig.addColorStop(0, "#f0d878");
    ig.addColorStop(1, "#c9a84a");
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(sx + 60, H * 0.72, 160, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // golden city / castle
    const baseY = H * 0.62;
    const cx = sx + 40;
    const glow = ctx.createRadialGradient(cx, baseY - 40, 10, cx, baseY - 40, 100);
    glow.addColorStop(0, "rgba(255, 215, 0, 0.55)");
    glow.addColorStop(1, "rgba(255, 215, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, baseY - 40, 100, 0, Math.PI * 2);
    ctx.fill();

    const gold = ctx.createLinearGradient(cx - 40, baseY - 80, cx + 40, baseY);
    gold.addColorStop(0, "#fff3a0");
    gold.addColorStop(0.5, "#ffd700");
    gold.addColorStop(1, "#c9a227");
    ctx.fillStyle = gold;

    // main keep
    ctx.fillRect(cx - 35, baseY - 70, 70, 70);
    // towers
    ctx.fillRect(cx - 55, baseY - 55, 22, 55);
    ctx.fillRect(cx + 33, baseY - 55, 22, 55);
    // roofs / cones
    ctx.beginPath();
    ctx.moveTo(cx - 60, baseY - 55);
    ctx.lineTo(cx - 44, baseY - 85);
    ctx.lineTo(cx - 28, baseY - 55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 28, baseY - 55);
    ctx.lineTo(cx + 44, baseY - 85);
    ctx.lineTo(cx + 60, baseY - 55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 40, baseY - 70);
    ctx.lineTo(cx, baseY - 110);
    ctx.lineTo(cx + 40, baseY - 70);
    ctx.fill();

    // windows
    ctx.fillStyle = "#6a4a10";
    ctx.fillRect(cx - 18, baseY - 50, 10, 14);
    ctx.fillRect(cx + 8, baseY - 50, 10, 14);
    ctx.fillRect(cx - 8, baseY - 25, 16, 22);

    // flag
    ctx.strokeStyle = "#a67c00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 110);
    ctx.lineTo(cx, baseY - 130);
    ctx.stroke();
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 130);
    ctx.lineTo(cx + 18, baseY - 124 + Math.sin(t * 4) * 2);
    ctx.lineTo(cx, baseY - 116);
    ctx.fill();

    // label
    if (state.progress > GOAL_DIST * 0.75) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "#e6a800";
      ctx.lineWidth = 2;
      roundRect(ctx, sx - 10, H * 0.38, 140, 28, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5a3e00";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("黃金島城", sx + 60, H * 0.38 + 14);
    }
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawArmorPreview() {
    const winArmorImg = document.getElementById("l2-armor-img");
    if (winArmorImg) {
      const gender = state ? state.gender : "boy";
      const src = gender === "girl"
        ? `assets/angel-girl-gold.png?v=${CACHE_V}`
        : `assets/angel-boy-gold.png?v=${CACHE_V}`;
      winArmorImg.src = src;
      winArmorImg.alt = "黃金聖鬥士天使（鎧甲穿在身上）";
    }
    // Keep canvas as optional fallback / shimmer plate behind img if present
    if (!winArmorCanvas) return;
    const g = winArmorCanvas.getContext("2d");
    const W = winArmorCanvas.width;
    const H = winArmorCanvas.height;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#7ec8ff");
    bg.addColorStop(1, "#1e7cc4");
    const gender = state ? state.gender : "boy";
    const img = angelGoldSprite(gender);
    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      // soft glow
      const glow = g.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.5, 120);
      glow.addColorStop(0, "rgba(255, 215, 0, 0.45)");
      glow.addColorStop(1, "rgba(255, 215, 0, 0)");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(W / 2, H * 0.48, 120, 0, Math.PI * 2);
      g.fill();
      drawGoldenLeaf(g, W / 2, H * 0.88, 0.55, 0);
      if (img.complete && img.naturalWidth) {
        const destH = H * 0.78;
        const destW = destH * (img.naturalWidth / img.naturalHeight);
        g.save();
        g.translate(W / 2, H * 0.86);
        g.drawImage(img, -destW / 2, -destH + 4, destW, destH);
        g.restore();
      }
    };
    if (img.complete) draw();
    else img.onload = draw;
    let frames = 0;
    const tick = () => {
      draw();
      frames++;
      if (frames < 60 && screens.winL2 && screens.winL2.classList.contains("active")) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  // --- Update ---
  function update(dt) {
    if (!state || state.phase === "win" || state.phase === "lose") return;

    state.worldTime += dt;
    const t = state.worldTime;
    const { W, H } = getViewSize();

    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0 && failToast) failToast.classList.add("hidden");
    }

    if (state.player.invuln > 0) state.player.invuln -= dt;
    if (state.player.inkSplash > 0) state.player.inkSplash -= dt;

    // dunk recovery
    if (state.phase === "dunk") {
      state.player.dunkTimer -= dt;
      if (state.player.dunkTimer <= 0) {
        if (state.pendingLose) {
          const r = state.pendingLose;
          state.pendingLose = null;
          endLose(r);
          return;
        }
        state.phase = "play";
      }
    }

    if (state.phase === "play" || state.phase === "dunk") {
      // auto forward
      const speedMul = state.phase === "dunk" ? 0.35 : 1;
      state.progress += state.surfSpeed * speedMul * dt;
      state.cameraX = state.progress;
      if (state.phase === "play") state.elapsed = (state.elapsed || 0) + dt;

      // difficulty ramp
      state.difficulty = Math.min(1, state.progress / GOAL_DIST);

      // lateral dodge (← → changes lane = screen Y) + balance
      if (state.phase === "play") {
        let strafing = false;
        // tap-combo boost decay
        if (state.player.tapTimer > 0) state.player.tapTimer -= dt;
        if (state.player.tapBoost > 0) {
          state.player.tapBoost -= dt;
          if (state.player.tapBoost <= 0) {
            state.player.tapMul = 1;
            state.player.tapCount = 0;
            state.player.tapDir = 0;
          }
        }
        const spd = STRAFE_SPEED * (state.player.tapMul || 1);
        if (state.keys.left) {
          state.player.lane -= (spd / H) * dt;
          state.player.facing = 1; // still look forward while surfing
          state.player.lean = Math.max(-1, state.player.lean - 2.2 * dt);
          strafing = true;
        }
        if (state.keys.right) {
          state.player.lane += (spd / H) * dt;
          state.player.facing = 1;
          state.player.lean = Math.min(1, state.player.lean + 2.2 * dt);
          strafing = true;
        }
        state.player.lane = clampPlayerLane(state.player.lane);

        // balance: recover when steady; drain when strafing / difficulty wobble
        const wobble = (0.8 + state.difficulty * 2.2) * (0.5 + Math.abs(Math.sin(t * 1.7)));
        if (strafing) {
          state.player.balance -= (7 + state.difficulty * 10) * dt;
        } else {
          state.player.lean += (0 - state.player.lean) * Math.min(1, 3.5 * dt);
          state.player.balance += (22 - state.difficulty * 5) * dt;
        }
        state.player.balance -= wobble * 0.65 * dt;
        // near active splash telegraph drains balance
        state.waves.forEach((w) => {
          if (w.age < w.telegraph && Math.abs(playerWorldX() - w.x) < 120) {
            state.player.balance -= 8 * dt;
          }
        });
        state.player.balance = Math.max(0, Math.min(BALANCE_MAX, state.player.balance));

        if (state.player.balance <= 0) {
          takeHit("balance");
          return;
        }

        if (state.player.shootCd > 0) state.player.shootCd -= dt;
        // Bow tip aim up/down (straight shots follow this angle)
        if (state.keys.aimUp) {
          state.player.aimAngle = Math.max(-AIM_MAX, (state.player.aimAngle || 0) - AIM_STEP * dt);
        }
        if (state.keys.aimDown) {
          state.player.aimAngle = Math.min(AIM_MAX, (state.player.aimAngle || 0) + AIM_STEP * dt);
        }

        if (state.keys.shoot) {
          state.keys.shoot = false;
          tryShoot(null);
        }
      } else if (state.phase === "dunk") {
        state.player.lean = Math.sin(t * 14) * 0.8;
      }

      // arrows
      const { H: viewH } = getViewSize();
      state.arrows.forEach((a) => {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.life -= dt;
        // hit mermaids
        state.mermaids.forEach((m) => {
          if (m.gone || m.hp <= 0) return;
          const my = viewH * m.lane - 10;
          if (Math.abs(a.x - m.x) < 36 && Math.abs(a.y - my) < 40) {
            m.hp = 0;
            m.gone = true;
            a.life = 0;
            onEnemyKilled("mermaid");
          }
        });
        // hit octopi
        state.octopi.forEach((o) => {
          if (o.gone || o.hp <= 0) return;
          const oy = viewH * o.lane - 10;
          if (Math.abs(a.x - o.x) < 32 && Math.abs(a.y - oy) < 36) {
            o.hp = 0;
            o.gone = true;
            a.life = 0;
            onEnemyKilled("octopus");
          }
        });
      });
      state.arrows = state.arrows.filter((a) => a.life > 0);

      // spawns — minute 1 baseline; minute 2+ more mermaids; minute 3+ more octopi
      state.spawnMermaidTimer -= dt;
      state.spawnOctopusTimer -= dt;
      const el = state.elapsed || 0;
      const minute2 = el >= 60;  // 第2分鐘
      const minute3 = el >= 120; // 第3分鐘
      let mermaidInterval = 2.5 - state.difficulty * 0.6;
      let octopusInterval = 6.0 - state.difficulty * 1.2;
      if (minute2) mermaidInterval *= 0.55; // denser mermaids
      if (minute3) octopusInterval *= 0.45; // denser octopi
      if (state.spawnMermaidTimer <= 0 && state.progress < GOAL_DIST - 600) {
        spawnMermaid();
        if (minute2) spawnMermaid();
        if (minute2 && Math.random() < 0.45) spawnMermaid();
        if (minute3 && Math.random() < 0.35) spawnMermaid();
        state.spawnMermaidTimer = Math.max(0.55, mermaidInterval + Math.random() * 0.5);
      }
      if (state.spawnOctopusTimer <= 0 && state.progress < GOAL_DIST - 700) {
        spawnOctopus();
        if (minute3) spawnOctopus();
        if (minute3 && Math.random() < 0.4) spawnOctopus();
        state.spawnOctopusTimer = Math.max(0.9, octopusInterval + Math.random() * 0.7);
      }

      // update mermaids — fast swimmers closing the gap
      state.mermaids.forEach((m) => {
        m.age += dt;
        m.x -= (m.swim || MERMAID_SWIM) * dt;
        // splash when closing in on the angel (distance-based + age floor)
        const dist = m.x - playerWorldX();
        if (!m.splashed && m.hp > 0 && !m.gone && m.age >= 0.55 && dist < 220) {
          m.splashed = true;
          addWave(m.x + 10, m.lane);
          playSplash();
        }
        if (m.age > 5.5 || m.x < state.cameraX - 120) m.gone = true;
      });
      state.mermaids = state.mermaids.filter((m) => !m.gone && m.x > state.cameraX - 140);

      // update octopi — slow crawlers; ink jets still fire after wind-up
      state.octopi.forEach((o) => {
        o.age += dt;
        o.x -= (o.swim || OCTOPUS_SWIM) * dt;
        if (!o.sprayed && o.age >= 1.35 && o.hp > 0 && !o.gone) {
          o.sprayed = true;
          addInk(o);
          playInk();
        }
        if (o.age > 7.5 || o.x < state.cameraX - 140) o.gone = true;
      });
      state.octopi = state.octopi.filter((o) => !o.gone && o.x > state.cameraX - 160);

      // waves
      state.waves.forEach((w) => {
        w.age += dt;
        const lethal = w.age >= w.telegraph && w.age < w.telegraph + w.lethalDur;
        if (lethal && !w.hit && state.phase === "play") {
          if (playerHit(w.x, w.w, w.lane, 0.07)) {
            w.hit = true;
            takeHit("wave");
          }
        }
      });
      state.waves = state.waves.filter((w) => w.age < w.telegraph + w.lethalDur + 0.2);

      // ink jets — thin streams from octopus toward angel lane; dodge by changing lane
      state.inks.forEach((ink) => {
        ink.age += dt;
        const lethal = ink.age >= ink.telegraph && ink.age < ink.telegraph + ink.lethalDur;
        if (lethal && !ink.hit && state.phase === "play") {
          const px = playerWorldX();
          const pl = state.player.lane;
          const tipX = ink.x - ink.reach * Math.min(1, (ink.age - ink.telegraph) / 0.12);
          // jet corridor from octopus toward tip; strike near tip / along path near player
          const along = px <= ink.x + 20 && px >= tipX - 30;
          const laneHit = Math.abs(pl - ink.targetLane) <= (ink.laneTol || 0.065);
          if (along && laneHit) {
            ink.hit = true;
            takeHit("ink");
          }
        }
      });
      state.inks = state.inks.filter((i) => i.age < i.telegraph + i.lethalDur + 0.3);

      // Body contact: fail to avoid the octopus itself → −1 heart
      state.octopi.forEach((o) => {
        if (o.gone || o.hp <= 0 || state.phase !== "play") return;
        if (o.bodyHit) return;
        // generous but fair body hitbox near octopus
        if (playerHit(o.x, 70, o.lane, 0.09)) {
          o.bodyHit = true;
          takeHit("octopus");
        }
      });

      updateHUD();

      // win check
      if (state.progress >= GOAL_DIST && state.phase === "play") {
        endWin();
      }
    }
  }

  function render(ts) {
    const { W, H } = getViewSize();
    const t = ts / 1000;
    drawOceanSky(W, H, t);

    if (!state) return;

    drawIsland(W, H, t);

    state.mermaids.forEach((m) => drawMermaid(m, t));
    state.octopi.forEach((o) => drawOctopus(o, t));
    state.waves.forEach((w) => drawWaveHazard(w, t));
    state.inks.forEach((i) => drawInkHazard(i, t));
    (state.arrows || []).forEach((a) => drawArrowProj(a));

    drawPearls(t);
    drawSurfer(state.player, t, state.player.armored);
    drawSurfSpray(W, H, t);

    // progress hint near end
    if (state.progress > GOAL_DIST * 0.85 && state.phase === "play") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("快到黃金島城！", W / 2, 36);
    }
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(0.05, dt);
    update(dt);
    render(ts);
    if (state && state.phase !== "win" && state.phase !== "lose") {
      raf = requestAnimationFrame(loop);
    }
  }

  function stopLevel2() {
    cancelAnimationFrame(raf);
    raf = 0;
    state = null;
  }

  function startLevel2() {
    ensureAudio();
    // stop L1 / L3 if running
    if (window.FeishengL1 && typeof window.FeishengL1.stop === "function") {
      window.FeishengL1.stop();
    }
    if (window.FeishengLevel4 && typeof window.FeishengLevel4.stop === "function") {
      window.FeishengLevel4.stop();
    }
    if (window.FeishengLevel3 && typeof window.FeishengLevel3.stop === "function") {
      window.FeishengLevel3.stop();
    }
    showScreen(screens.gameL2);
    resizeCanvas();
    state = createState();
    state.player.lane = clampPlayerLane(state.player.lane);
    updateHUD();
    if (failToast) failToast.classList.add("hidden");
    lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function goHome() {
    stopLevel2();
    showScreen(screens.start);
    refreshMenuButtons();
  }

  function refreshMenuButtons() {
    // Dev / playtest: always show L2–L4 on the main menu
    for (const id of ["btn-start-l2", "btn-start-l3", "btn-start-l4", "btn-enter-l2", "btn-enter-l3", "btn-enter-l4"]) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove("hidden");
        el.disabled = false;
      }
    }
    for (const id of ["l2-menu-hint", "l3-menu-hint", "l4-menu-hint"]) {
      const el = document.getElementById(id);
      if (el) el.classList.remove("hidden");
    }
  }

  // --- Input ---
  window.addEventListener("keydown", (e) => {
    if (!state || !screens.gameL2 || !screens.gameL2.classList.contains("active")) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowUp" || e.code === "KeyW") {
      if (!state.keys.left) registerStrafeTap(-1);
      state.keys.left = true;
      e.preventDefault();
    }
    if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "ArrowDown" || e.code === "KeyS") {
      if (!state.keys.right) registerStrafeTap(1);
      state.keys.right = true;
      e.preventDefault();
    }
    if (e.code === "Space" || e.code === "KeyJ" || e.code === "KeyK") {
      state.keys.shoot = true;
      e.preventDefault();
    }
    if (e.code === "KeyQ" || e.code === "Comma") {
      state.keys.aimUp = true;
      e.preventDefault();
    }
    if (e.code === "KeyE" || e.code === "Period") {
      state.keys.aimDown = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (!state) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowUp" || e.code === "KeyW") state.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "ArrowDown" || e.code === "KeyS") state.keys.right = false;
    if (e.code === "KeyQ" || e.code === "Comma") state.keys.aimUp = false;
    if (e.code === "KeyE" || e.code === "Period") state.keys.aimDown = false;
  });

  function bindHold(btn, on, off) {
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      on();
    };
    const end = (e) => {
      e.preventDefault();
      off();
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointerleave", end);
    btn.addEventListener("pointercancel", end);
  }

  bindHold(
    document.getElementById("btn-l2-left"),
    () => {
      if (!state) return;
      registerStrafeTap(-1);
      state.keys.left = true;
    },
    () => state && (state.keys.left = false)
  );
  bindHold(
    document.getElementById("btn-l2-right"),
    () => {
      if (!state) return;
      registerStrafeTap(1);
      state.keys.right = true;
    },
    () => state && (state.keys.right = false)
  );
  bindHold(
    document.getElementById("btn-l2-aim-up"),
    () => state && (state.keys.aimUp = true),
    () => state && (state.keys.aimUp = false)
  );
  bindHold(
    document.getElementById("btn-l2-aim-down"),
    () => state && (state.keys.aimDown = true),
    () => state && (state.keys.aimDown = false)
  );

  const btnShoot = document.getElementById("btn-l2-shoot");
  if (btnShoot) {
    btnShoot.addEventListener("click", (e) => {
      e.preventDefault();
      tryShoot(null);
    });
  }

  if (canvas) {
    canvas.addEventListener("pointerdown", (e) => {
      if (!state || state.phase !== "play") return;
      if (!screens.gameL2 || !screens.gameL2.classList.contains("active")) return;
      const rect = canvas.getBoundingClientRect();
      const y = ((e.clientY - rect.top) / rect.height) * getViewSize().H;
      tryShoot(y);
      e.preventDefault();
    });
  }

  const btnStartL2 = document.getElementById("btn-start-l2");
  if (btnStartL2) btnStartL2.addEventListener("click", startLevel2);
  const btnEnterL2 = document.getElementById("btn-enter-l2");
  if (btnEnterL2) btnEnterL2.addEventListener("click", startLevel2);
  const btnReplayL2 = document.getElementById("btn-replay-l2");
  if (btnReplayL2) btnReplayL2.addEventListener("click", startLevel2);
  const btnReplayL2Lose = document.getElementById("btn-replay-l2-lose");
  if (btnReplayL2Lose) btnReplayL2Lose.addEventListener("click", startLevel2);
  const btnHomeL2 = document.getElementById("btn-home-l2");
  if (btnHomeL2) btnHomeL2.addEventListener("click", goHome);
  const btnHomeL2Lose = document.getElementById("btn-home-l2-lose");
  if (btnHomeL2Lose) btnHomeL2Lose.addEventListener("click", goHome);

  window.addEventListener("resize", () => {
    if (!screens.gameL2 || !screens.gameL2.classList.contains("active") || !state) return;
    resizeCanvas();
  });

  // Public API
  window.FeishengLevel2 = {
    start: startLevel2,
    stop: stopLevel2,
    loadSave,
    writeSave,
    refreshMenuButtons,
  };

  refreshMenuButtons();
})();
