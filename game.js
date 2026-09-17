/**
 * 飛升 Gold Gold! — Level 1
 * Jump across 18 clouds by answering mixed quizzes (math / IQ / animal / math-riddle);
 * +1 coin per hop (+ tree bonus).
 */
(() => {
  "use strict";

  const TOTAL_CLOUDS = 18;
  const LEVEL_SECONDS = 180; // 3 minutes; pauses during quiz
  const START_HEARTS = 3;
  const STREAK_FOR_HEART = 3; // consecutive correct → +1 heart
  const WRONG_STREAK_FOR_PENALTY = 2; // consecutive wrongs → −5s + alarm
  const WRONG_STREAK_TIME_PENALTY = 5;
  const TREE_BONUS_COINS = 1; // +1 at golden tree so clear ≈ 18 coins
  const SAVE_KEY = "feishengGoldGold.save";
  // Coins: +1 per successful hop (17 hops cloud1→18) + TREE_BONUS_COINS at win.

  // --- Quiz generation (math + IQ + animal + mathRiddle, 3 choices) ---
  function randInt(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function packChoices(answer, distractors) {
    return shuffle([answer, ...distractors]);
  }

  function makeMathProblem(seedIndex) {
    // Mix ops; keep results 1–100; division exact; 3 choices
    const ops = ["+", "-", "×", "÷"];
    const op = ops[seedIndex % 4];
    let a, b, answer, text;

    if (op === "+") {
      a = randInt(1, 50);
      b = randInt(1, 50);
      answer = a + b;
      if (answer > 100) {
        a = randInt(1, 40);
        b = randInt(1, 40);
        answer = a + b;
      }
      text = `${a} + ${b}`;
    } else if (op === "-") {
      a = randInt(10, 99);
      b = randInt(1, Math.min(a - 1, 40));
      answer = a - b;
      text = `${a} − ${b}`;
    } else if (op === "×") {
      a = randInt(2, 12);
      b = randInt(2, 10);
      answer = a * b;
      text = `${a} × ${b}`;
    } else {
      // exact division
      b = randInt(2, 12);
      answer = randInt(2, 12);
      a = b * answer;
      if (a > 100) {
        b = randInt(2, 10);
        answer = randInt(2, 10);
        a = b * answer;
      }
      text = `${a} ÷ ${b}`;
    }

    const wrongs = new Set();
    while (wrongs.size < 2) {
      let w = answer + randInt(-12, 12);
      if (w === answer || w < 0 || w > 120) continue;
      // prefer near misses
      if (Math.random() < 0.4) w = answer + (Math.random() < 0.5 ? 1 : -1) * randInt(1, 5);
      if (w === answer || w < 0) continue;
      wrongs.add(w);
    }

    return {
      type: "math",
      text,
      answer,
      choices: packChoices(answer, [...wrongs]),
    };
  }

  function makeBankProblem(type, item) {
    return {
      type,
      text: item.text,
      answer: item.answer,
      choices: packChoices(item.answer, item.distractors.slice(0, 2)),
    };
  }

  function balancedTypePlan(n) {
    // Roughly equal mix of math / iq / animal / mathRiddle across the run
    // 17 hops → ~5 math, ~4 iq, ~4 animal, ~4 mathRiddle
    const types = ["math", "iq", "animal", "mathRiddle"];
    const plan = [];
    for (let i = 0; i < n; i++) plan.push(types[i % 4]);
    return shuffle(plan);
  }

  function generateLevelProblems() {
    // clouds 2..18 → 17 problems; no repeat of bank types until exhausted
    const bank = window.FeishengQuestionBank || { iq: [], animal: [], mathRiddle: [] };
    const iqPool = shuffle((bank.iq || []).map((q) => ({ ...q, distractors: q.distractors.slice() })));
    const animalPool = shuffle(
      (bank.animal || []).map((q) => ({ ...q, distractors: q.distractors.slice() }))
    );
    const mathRiddlePool = shuffle(
      (bank.mathRiddle || []).map((q) => ({ ...q, distractors: q.distractors.slice() }))
    );
    const iqUsed = [];
    const animalUsed = [];
    const mathRiddleUsed = [];

    function takeFrom(pool, used, type) {
      if (pool.length === 0) {
        // bank exhausted — reshuffle used cards for remaining slots
        pool.push(...shuffle(used.splice(0, used.length)));
      }
      const item = pool.pop();
      used.push(item);
      return makeBankProblem(type, item);
    }

    const n = TOTAL_CLOUDS - 1;
    const plan = balancedTypePlan(n);
    const list = [];
    let mathSeed = 0;
    for (let i = 0; i < n; i++) {
      const t = plan[i];
      if (t === "math") {
        list.push(makeMathProblem(mathSeed++));
      } else if (t === "iq") {
        list.push(takeFrom(iqPool, iqUsed, "iq"));
      } else if (t === "animal") {
        list.push(takeFrom(animalPool, animalUsed, "animal"));
      } else {
        list.push(takeFrom(mathRiddlePool, mathRiddleUsed, "mathRiddle"));
      }
    }
    return list;
  }

  // --- DOM ---
  const screens = {
    start: document.getElementById("start-screen"),
    game: document.getElementById("game-screen"),
    win: document.getElementById("win-screen"),
    lose: document.getElementById("lose-screen"),
  };
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  // Full cover art (tree + both angels) for start/win/goal landmark
  const cherubsImg = new Image();
  cherubsImg.src = "assets/cherubs.png?v=1789580500";
  // Transparent cut-out sprites (character only, true alpha)
  const angelBoyImg = new Image();
  angelBoyImg.src = "assets/angel-boy.png?v=1789580500";
  const angelGirlImg = new Image();
  angelGirlImg.src = "assets/angel-girl.png?v=1789580500";
  function angelSprite(gender) {
    return gender === "girl" ? angelGirlImg : angelBoyImg;
  }
  const timerEl = document.getElementById("timer");
  const cloudProgEl = document.getElementById("cloud-progress");
  const coinsEl = document.getElementById("coins");
  const livesEl = document.getElementById("lives");
  const streakEl = document.getElementById("streak");
  const winHeartsEl = document.getElementById("win-hearts");
  const quizPanel = document.getElementById("quiz-panel");
  const quizQ = document.getElementById("quiz-question");
  const quizChoices = document.getElementById("quiz-choices");
  const quizCloudNum = document.getElementById("quiz-cloud-num");
  const quizFeedback = document.getElementById("quiz-feedback");
  const failToast = document.getElementById("fail-toast");
  const loseReason = document.getElementById("lose-reason");
  const winCoinsEl = document.getElementById("win-coins");

  // --- Web Audio SFX (procedural, no CDN) ---
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

  /** Terrified short scream / yelp */
  function playScream() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // noisy yelp via filtered noise + falling pitch oscillator
    const dur = 0.55;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * 4.5) * (0.55 + 0.45 * Math.sin(t * 40));
      // band-ish scream noise
      data[i] = (Math.random() * 2 - 1) * env * 0.55;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(420, now + dur);
    bp.Q.value = 3.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.9, now);
    ng.gain.exponentialRampToValueAtTime(0.01, now + dur);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // tonal yelp on top
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22, now);
    og.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    osc.connect(lp);
    lp.connect(og);
    og.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  /** Heavy thud / impact */
  function playThud() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.85, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);

    // noise burst for impact body
    const dur = 0.22;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.7;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 280;
    const ng = ctx.createGain();
    ng.gain.value = 0.95;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.02);
  }

  function playFailSfx() {
    playScream();
    // thud slightly after scream starts
    setTimeout(playThud, 120);
  }

  /** Urgent alarm / siren warning (distinct from scream + thud) */
  function playAlarmSiren() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // three sharp warning beeps + short alternating siren wail
    const beepFreqs = [880, 880, 988];
    beepFreqs.forEach((freq, i) => {
      const t0 = now + i * 0.16;
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.11);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = 2.2;
      osc.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.13);
    });
    // siren wail after beeps
    const w0 = now + 0.5;
    const siren = ctx.createOscillator();
    siren.type = "sawtooth";
    siren.frequency.setValueAtTime(620, w0);
    siren.frequency.linearRampToValueAtTime(1100, w0 + 0.28);
    siren.frequency.linearRampToValueAtTime(520, w0 + 0.55);
    siren.frequency.linearRampToValueAtTime(980, w0 + 0.82);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, w0);
    sg.gain.exponentialRampToValueAtTime(0.18, w0 + 0.04);
    sg.gain.exponentialRampToValueAtTime(0.01, w0 + 0.9);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    siren.connect(lp);
    lp.connect(sg);
    sg.connect(ctx.destination);
    siren.start(w0);
    siren.stop(w0 + 0.95);
  }

  function playSuccessChime() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.28 + i * 0.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + 0.35 + i * 0.05);
    });
  }

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
    } catch (_) { /* ignore quota */ }
    return next;
  }

  function showScreen(name) {
    document.querySelectorAll("#app > .screen").forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    if (window.FeishengLevel2 && typeof window.FeishengLevel2.stop === "function") {
      // L1 screens take over — halt L2 loop if it was running
      const l2 = document.getElementById("level2-screen");
      if (!l2 || !l2.classList.contains("active")) {
        window.FeishengLevel2.stop();
      }
    }
    if (window.FeishengLevel3 && typeof window.FeishengLevel3.stop === "function") {
      const l3 = document.getElementById("level3-screen");
      if (!l3 || !l3.classList.contains("active")) {
        window.FeishengLevel3.stop();
      }
    }
    if (window.FeishengLevel4 && typeof window.FeishengLevel4.stop === "function") {
      const l4 = document.getElementById("level4-screen");
      if (!l4 || !l4.classList.contains("active")) {
        window.FeishengLevel4.stop();
      }
    }
  }

  // --- Game state ---
  let state = null;
  let raf = 0;
  let lastTs = 0;

  function layoutClouds(W, H) {
    // Ascending path across a wider world
    const clouds = [];
    const spacingX = 140;
    const baseY = H * 0.72;
    for (let i = 0; i < TOTAL_CLOUDS; i++) {
      const x = 120 + i * spacingX;
      const wave = Math.sin(i * 0.7) * 55 + Math.cos(i * 0.35) * 25;
      const rise = i * 8; // gentle climb
      const y = baseY - rise + wave;
      const cy = Math.max(H * 0.28, Math.min(H * 0.82, y));
      clouds.push({
        index: i + 1,
        x,
        y: cy,
        baseY: cy,
        bobPhase: i * 0.85,
        w: 110,
        h: 42,
      });
    }
    return clouds;
  }

  function createState() {
    const W = canvas.width;
    const H = canvas.height;
    const clouds = layoutClouds(W * 0.35 + TOTAL_CLOUDS * 140, H);
    // Fix: layout uses logical world width — recompute properly
    const worldW = 120 + (TOTAL_CLOUDS - 1) * 140 + 280;
    const clouds2 = [];
    const baseY = H * 0.7;
    for (let i = 0; i < TOTAL_CLOUDS; i++) {
      const x = 100 + i * 140;
      const wave = Math.sin(i * 0.85) * 50;
      const y = baseY - i * 6 + wave;
      const cy = Math.max(H * 0.32, Math.min(H * 0.78, y));
      clouds2.push({
        index: i + 1,
        x,
        y: cy,
        baseY: cy,
        bobPhase: i * 0.85,
        w: 108,
        h: 40,
      });
    }
    const start = clouds2[0];
    const decor = makeDecorClouds(worldW, H);
    return {
      clouds: clouds2,
      worldW,
      problems: generateLevelProblems(),
      currentCloud: 1, // 1-based
      coins: 0,
      hearts: START_HEARTS,
      streak: 0,
      wrongStreak: 0, // consecutive wrongs (separate from 連對 streak)
      streakBest: 0,
      timeLeft: LEVEL_SECONDS,
      timerAccum: 0,
      player: {
        x: start.x,
        y: start.y - 28,
        vx: 0,
        vy: 0,
        facing: 1,
        onGround: true,
        anim: 0,
        falling: false,
        fallTimer: 0,
        flailPhase: 0,
      },
      cameraX: 0,
      phase: "play", // play | quiz | jump | fall | win | lose
      pendingTarget: null,
      jumpAnim: null,
      keys: { left: false, right: false, jump: false },
      toastTimer: 0,
      sparkles: [],
      coinBursts: [], // gold coins thrown by sky cherubs on success
      pausedForQuiz: false,
      decorFar: decor.far,
      decorMid: decor.mid,
      flyCherubs: makeFlyingCherubs(worldW, H),
      animTime: 0,
      worldTime: 0,
      pendingLose: null,
    };
  }

  function resizeCanvas() {
    const wrap = document.getElementById("stage-wrap");
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(320, rect.width);
    const cssH = Math.max(280, rect.height);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: cssW, H: cssH };
  }

  function heartIcons(n) {
    const filled = Math.max(0, n);
    // Show all hearts (including above start max); empty slots only for depleted start set
    if (filled >= START_HEARTS) {
      return "♥".repeat(filled);
    }
    return "♥".repeat(filled) + "♡".repeat(START_HEARTS - filled);
  }

  function updateHUD() {
    if (!state) return;
    timerEl.textContent = String(Math.ceil(state.timeLeft));
    timerEl.classList.toggle("urgent", state.timeLeft <= 15);
    cloudProgEl.textContent = `${state.currentCloud} / ${TOTAL_CLOUDS}`;
    coinsEl.textContent = String(state.coins);
    livesEl.textContent = heartIcons(state.hearts);
    if (streakEl) {
      const toward = state.streak % STREAK_FOR_HEART;
      streakEl.textContent = `${toward} / ${STREAK_FOR_HEART}`;
    }
  }

  function bumpCoinsDisplay() {
    coinsEl.classList.remove("pop");
    void coinsEl.offsetWidth;
    coinsEl.classList.add("pop");
  }

  function showToast(msg, ms = 1400) {
    failToast.textContent = msg;
    failToast.classList.remove("hidden");
    state.toastTimer = ms / 1000;
  }

  // --- Quiz ---
  function openQuiz(targetCloudIndex) {
    // targetCloudIndex is 2..18
    state.phase = "quiz";
    state.pausedForQuiz = true;
    state.pendingTarget = targetCloudIndex;
    const problem = state.problems[targetCloudIndex - 2];
    quizCloudNum.textContent = String(targetCloudIndex);
    if (problem.type === "math") {
      quizQ.textContent = problem.text + " ＝ ?";
      quizQ.classList.remove("quiz-q-text");
    } else {
      quizQ.textContent = problem.text;
      quizQ.classList.add("quiz-q-text");
    }
    quizFeedback.textContent = "";
    quizFeedback.className = "quiz-feedback";
    quizChoices.innerHTML = "";
    quizChoices.classList.toggle("choices-text", problem.type !== "math");
    problem.choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = String(c);
      btn.dataset.choice = String(c);
      btn.addEventListener("click", () => onAnswer(c, problem.answer, btn));
      quizChoices.appendChild(btn);
    });
    quizPanel.classList.remove("hidden");
  }

  function closeQuiz() {
    quizPanel.classList.add("hidden");
    state.pausedForQuiz = false;
  }

  function onAnswer(chosen, correct, btn) {
    ensureAudio();
    const buttons = [...quizChoices.querySelectorAll(".choice-btn")];
    buttons.forEach((b) => (b.disabled = true));
    if (chosen === correct) {
      btn.classList.add("correct");
      quizFeedback.textContent = "答對了！跳上去～";
      quizFeedback.className = "quiz-feedback ok";
      setTimeout(() => {
        closeQuiz();
        startJumpTo(state.pendingTarget);
      }, 450);
    } else {
      btn.classList.add("wrong");
      buttons.forEach((b) => {
        if (b.dataset.choice === String(correct)) b.classList.add("correct");
      });
      quizFeedback.textContent = "答錯了！哎呀～";
      quizFeedback.className = "quiz-feedback bad";
      setTimeout(() => {
        closeQuiz();
        handleWrongAnswer();
      }, 700);
    }
  }

  function handleWrongAnswer() {
    playFailSfx();
    state.hearts -= 1;
    state.streak = 0; // reset consecutive correct (連對)
    state.wrongStreak = (state.wrongStreak || 0) + 1;

    let consecutivePenalty = false;
    if (state.wrongStreak >= WRONG_STREAK_FOR_PENALTY) {
      // every 2 consecutive wrongs → −5s + alarm; then reset counter
      state.wrongStreak = 0;
      state.timeLeft = Math.max(0, state.timeLeft - WRONG_STREAK_TIME_PENALTY);
      playAlarmSiren();
      consecutivePenalty = true;
    }

    updateHUD();

    if (consecutivePenalty && state.timeLeft <= 0) {
      showToast("連續答錯！倒數 −5 秒");
      endLose("時間到！再試一次，加油！");
      return;
    }

    // brief terrified fall then retry same jump (unless out of hearts)
    state.phase = "fall";
    state.player.falling = true;
    state.player.fallTimer = 1.05;
    state.player.vy = 220;
    state.player.flailPhase = 0;
    state.player.onGround = false;
    if (consecutivePenalty) {
      showToast("連續答錯！倒數 −5 秒");
    } else {
      showToast(state.hearts <= 0 ? "生命用完了…" : "哎呀！失足了～");
    }
    if (state.hearts <= 0) {
      // finish fall anim then lose
      state.pendingLose = "生命用完了！再試一次，加油！";
    }
  }

  function startJumpTo(targetIndex) {
    const from = state.clouds[state.currentCloud - 1];
    const to = state.clouds[targetIndex - 1];
    // Land on baseY (stable) so platform bob never makes hops unfair
    const landY = (to.baseY != null ? to.baseY : to.y) - 28;
    state.phase = "jump";
    state.jumpAnim = {
      fromX: state.player.x,
      fromY: state.player.y,
      toX: to.x,
      toY: landY,
      t: 0,
      dur: 0.55,
      targetIndex,
    };
    state.player.onGround = false;
    state.player.facing = to.x >= state.player.x ? 1 : -1;
  }

  function spawnCherubCoinRain() {
    // Sky cherubs scatter / throw gold coins as celebration
    const sources = state.flyCherubs.slice(0, 6);
    sources.forEach((a, si) => {
      const baseX = a.x + state.cameraX * (a.layer === "far" ? 0.12 : 0.35);
      for (let i = 0; i < 5; i++) {
        state.coinBursts.push({
          x: state.player.x + randInt(-40, 40) + (si - 2) * 18,
          y: state.player.y - 80 - randInt(0, 60),
          vx: randInt(-120, 120),
          vy: randInt(-40, 60) - 80,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 10,
          life: 0.9 + Math.random() * 0.55,
          maxLife: 1.2,
          size: 7 + Math.random() * 5,
        });
      }
    });
    // extra near player
    for (let i = 0; i < 12; i++) {
      state.coinBursts.push({
        x: state.player.x + randInt(-30, 30),
        y: state.player.y - 20 + randInt(-40, 10),
        vx: randInt(-160, 160),
        vy: randInt(-200, -40),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 12,
        life: 1.0 + Math.random() * 0.4,
        maxLife: 1.3,
        size: 8 + Math.random() * 4,
      });
    }
  }

  function awardSuccessCoin() {
    state.coins += 1;
    bumpCoinsDisplay();
  }

  function finishJump(targetIndex) {
    state.currentCloud = targetIndex;
    state.player.x = state.clouds[targetIndex - 1].x;
    state.player.y = state.clouds[targetIndex - 1].y - 28;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.falling = false;
    state.jumpAnim = null;
    state.phase = "play";

    // +1 coin per successful hop
    awardSuccessCoin();
    playSuccessChime();
    spawnCherubCoinRain();

    // streak → heart bonus every 3 consecutive corrects
    state.wrongStreak = 0; // correct breaks consecutive-wrong chain
    state.streak += 1;
    if (state.streak > state.streakBest) state.streakBest = state.streak;
    if (state.streak > 0 && state.streak % STREAK_FOR_HEART === 0) {
      state.hearts += 1;
      showToast(`連對 ${STREAK_FOR_HEART}！♡ +1 生命`);
    }

    updateHUD();

    // sparkles
    for (let i = 0; i < 10; i++) {
      state.sparkles.push({
        x: state.player.x + randInt(-20, 20),
        y: state.player.y + randInt(-30, 0),
        life: 0.6 + Math.random() * 0.4,
        vx: randInt(-40, 40),
        vy: randInt(-80, -20),
      });
    }

    if (targetIndex === TOTAL_CLOUDS) {
      // tree landing bonus so clear totals ~18 coins (17 hops + 1 bonus)
      state.coins += TREE_BONUS_COINS;
      bumpCoinsDisplay();
      updateHUD();
      endWin();
    }
  }

  function tryJumpNext() {
    if (!state || state.phase !== "play") return;
    if (state.currentCloud >= TOTAL_CLOUDS) return;
    const next = state.currentCloud + 1;
    openQuiz(next);
  }

  function endWin() {
    state.phase = "win";
    winCoinsEl.textContent = String(state.coins);
    if (winHeartsEl) winHeartsEl.textContent = String(state.hearts);
    // Persist for Level 2: bank remaining hearts (incl. streak extras), coins, streak best
    writeSave({
      heartsBanked: state.hearts,
      coins: state.coins,
      streakBest: Math.max(loadSave().streakBest, state.streakBest),
      level1Cleared: true,
    });
    cancelAnimationFrame(raf);
    // Brief win flash, then auto-enter Level 2
    setTimeout(() => {
      showScreen("win");
      if (window.FeishengLevel2 && window.FeishengLevel2.refreshMenuButtons) {
        window.FeishengLevel2.refreshMenuButtons();
      }
      const note = document.getElementById("l1-auto-l2-note");
      if (note) note.classList.remove("hidden");
      setTimeout(() => {
        stopLevel1();
        if (window.FeishengLevel2 && typeof window.FeishengLevel2.start === "function") {
          window.FeishengLevel2.start();
        }
      }, 1600);
    }, 400);
  }

  function endLose(reason) {
    state.phase = "lose";
    loseReason.textContent = reason;
    // Do NOT wipe previously banked Level-2 reserve from an earlier clear
    const prev = loadSave();
    writeSave({
      heartsBanked: prev.heartsBanked,
      coins: prev.coins,
      streakBest: Math.max(prev.streakBest, state ? state.streakBest : 0),
      level1Cleared: prev.level1Cleared,
      level2Cleared: prev.level2Cleared,
      level3Cleared: prev.level3Cleared,
      level4Cleared: prev.level4Cleared,
      skyChariotKey: prev.skyChariotKey,
      goldenArmor: prev.goldenArmor,
    });
    cancelAnimationFrame(raf);
    closeQuiz();
    showScreen("lose");
  }

  // --- Drawing helpers ---
  function drawSky(W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6bb8ff");
    g.addColorStop(0.45, "#a8d8ff");
    g.addColorStop(1, "#eef6ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // distant temples / columns (simple silhouettes)
    ctx.save();
    ctx.translate(-state.cameraX * 0.15, 0);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    drawTemple(W * 0.2, H * 0.55, 0.7);
    drawColumn(W * 1.1, H * 0.5, 0.85);
    drawTemple(W * 2.2, H * 0.52, 0.75);
    ctx.restore();

    // soft stars / sparkles (denser sky)
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97 + 40) % (W + 200)) - 20;
      const sy = ((i * 53) % (H * 0.5)) + 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.1 + (i % 3) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // faint golden motes
    ctx.fillStyle = "rgba(255, 215, 0, 0.35)";
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 131 + 70) % (W + 160)) - 30;
      const sy = ((i * 71) % (H * 0.4)) + 12;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDecorLayers(t) {
    if (!state) return;
    const { W, H } = getViewSize();
    // far parallax clouds — slow continuous bob + horizontal drift
    ctx.save();
    ctx.translate(-state.cameraX * 0.12, 0);
    state.decorFar.forEach((c) => {
      const ox = c.x + Math.sin(t * 0.22 + c.phase) * (c.drift * 2.2);
      const oy = c.y + Math.sin(t * 0.55 + c.phase * 1.3) * 10;
      drawDecorCloud(ox, oy, c.s, c.a);
    });
    // far flying cherubs
    state.flyCherubs.filter((a) => a.layer === "far").forEach((a) => {
      const px = a.x + Math.sin(t * 0.2 + a.phase) * 30;
      const py = a.baseY + Math.sin(t * 1.4 + a.phase) * a.bobAmp;
      drawFlyingCherub(px, py, a.s * 0.85, a.gender, t + a.phase, a.facing, a.pose || "float");
    });
    ctx.restore();

    // mid parallax clouds — slightly stronger calm drift
    ctx.save();
    ctx.translate(-state.cameraX * 0.35, 0);
    state.decorMid.forEach((c) => {
      const ox = c.x + Math.sin(t * 0.28 + c.phase) * (c.drift * 2.4);
      const oy = c.y + Math.sin(t * 0.65 + c.phase * 0.9) * 14;
      drawDecorCloud(ox, oy, c.s, c.a);
    });
    state.flyCherubs.filter((a) => a.layer === "mid").forEach((a) => {
      const px = a.x + Math.sin(t * 0.28 + a.phase) * 45 + t * a.speed * 0.15;
      // wrap gently within world
      const wrapped = ((px % (state.worldW + 120)) + (state.worldW + 120)) % (state.worldW + 120) - 40;
      const py = a.baseY + Math.sin(t * 1.6 + a.phase) * a.bobAmp;
      drawFlyingCherub(wrapped, py, a.s, a.gender, t + a.phase, a.facing, a.pose || "fly");
    });
    ctx.restore();
  }

  function drawTemple(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillRect(-60, 40, 120, 10);
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * 24 - 6, 0, 12, 40);
    }
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.lineTo(0, -30);
    ctx.lineTo(70, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawColumn(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillRect(-10, -80, 20, 100);
    ctx.fillRect(-18, -88, 36, 12);
    ctx.fillRect(-16, 20, 32, 10);
    ctx.restore();
  }

  /** Soft decorative puff cloud (background / midground filler — not platforms). */
  function drawDecorCloud(x, y, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const puff = (ox, oy, r) => {
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.fillStyle = "#ffffff";
    puff(-22, 2, 16);
    puff(0, -6, 20);
    puff(22, 2, 15);
    puff(-8, 6, 12);
    puff(12, 8, 11);
    ctx.beginPath();
    ctx.ellipse(0, 6, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Soft translucent wing flaps only (no flesh/limb sticks).
   * Drawn behind the PNG cut-out so painted arms/legs stay authoritative.
   */
  function drawSoftWingFlaps(g, destW, destH, wing) {
    g.save();
    g.globalAlpha *= 0.35;
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    g.strokeStyle = "rgba(200, 210, 230, 0.35)";
    g.lineWidth = 1;
    const wy = -destH * 0.55;
    const ww = destW * (0.38 + Math.abs(wing) * 0.1);
    const wh = destH * 0.18;
    g.beginPath();
    g.ellipse(-destW * 0.28, wy, ww * (0.9 + wing * 0.22), wh, -0.35 + wing * 0.35, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(destW * 0.28, wy, ww * (0.9 - wing * 0.22), wh, 0.35 - wing * 0.35, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  /**
   * Whole-sprite motion only — PNG already includes painted arms/legs.
   * idle: soft bob + tiny sway; fly: bob + tilt + optional wing flaps;
   * jump: squash/stretch; fall: tumble/shake (caller may add extra tilt).
   */
  function cherubBodyMotion(mode, t, animPhase) {
    let bob = 0;
    let tilt = 0;
    let sx = 1;
    let sy = 1;
    let shakeX = 0;
    let wing = 0;
    let showWings = false;

    if (mode === "fall") {
      const f = animPhase || t;
      bob = Math.sin(f * 14) * 2.5;
      tilt = Math.sin(f * 6) * 0.45;
      shakeX = Math.sin(f * 22) * 3.5;
      sx = 1 + Math.sin(f * 16) * 0.04;
      sy = 1 - Math.sin(f * 16) * 0.04;
    } else if (mode === "jump") {
      const p = Math.max(0, Math.min(1, animPhase || 0));
      const pump = Math.sin(p * Math.PI);
      bob = -pump * 6;
      tilt = Math.sin(p * Math.PI * 2) * 0.08;
      // stretch up mid-jump, slight squash at start/end
      sx = 1 - pump * 0.12;
      sy = 1 + pump * 0.18;
    } else if (mode === "fly") {
      bob = Math.sin(t * 3.2) * 2.4;
      tilt = Math.sin(t * 2.4) * 0.08;
      wing = Math.sin(t * 7.5) * 0.55;
      showWings = true;
    } else {
      // idle — soft vertical bob + tiny sway
      bob = Math.sin(t * 3.4) * 2.2;
      tilt = Math.sin(t * 2.1) * 0.05;
    }

    return { bob, tilt, sx, sy, shakeX, wing, showWings };
  }

  /**
   * Draw transparent angel cut-out (full sprite, no scene crop).
   * (x, y) ≈ feet / stand point. Whole-body bob / tilt / squash — no limb overlays.
   */
  function drawCherubSprite(g, x, y, opts) {
    const {
      gender = "boy",
      scale = 1,
      facing = 1,
      alpha = 1,
      bob = 0,
      tilt = 0,
      sweat = false,
      mode = "idle",
      t = 0,
      animPhase = 0,
    } = opts || {};
    const img = angelSprite(gender);
    if (!img.complete || !img.naturalWidth) return false;
    const destH = 58 * scale; // smaller characters
    const destW = destH * (img.naturalWidth / img.naturalHeight);
    const motion = cherubBodyMotion(mode, t, animPhase);
    g.save();
    g.translate(x + motion.shakeX, y + bob + motion.bob);
    g.rotate(tilt + motion.tilt);
    g.scale(facing * motion.sx, motion.sy);
    g.globalAlpha = alpha;
    if (motion.showWings) {
      drawSoftWingFlaps(g, destW, destH, motion.wing);
    }
    g.drawImage(img, -destW / 2, -destH + 6, destW, destH);
    if (sweat) {
      g.fillStyle = "rgba(140, 210, 255, 0.95)";
      g.strokeStyle = "rgba(60, 100, 140, 0.55)";
      g.lineWidth = 1.2;
      const sx = destW * 0.22;
      const sy = -destH * 0.72;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + 7, sy + 8, sx + 1, sy + 14);
      g.quadraticCurveTo(sx - 5, sy + 8, sx, sy);
      g.fill();
      g.stroke();
    }
    g.restore();
    return true;
  }

  /**
   * Decorative sky cherub — transparent PNG + soft whole-body bob/tilt.
   */
  function drawFlyingCherub(x, y, scale, gender, t, facing, pose, c) {
    const g = c || ctx;
    drawCherubSprite(g, x, y, {
      gender: gender || "boy",
      scale: (scale || 1) * 0.38,
      facing: facing || 1,
      alpha: 0.55,
      mode: "fly",
      t: t || 0,
    });
  }

  function makeDecorClouds(worldW, H) {
    const far = [];
    const mid = [];
    // distant small clusters
    for (let i = 0; i < 22; i++) {
      far.push({
        x: (i * 187 + 40) % (worldW + 400) - 80,
        y: 28 + (i * 37) % Math.floor(H * 0.42),
        s: 0.35 + (i % 5) * 0.08,
        a: 0.28 + (i % 4) * 0.06,
        drift: 6 + (i % 3) * 2,
        phase: i * 0.7,
      });
    }
    // midground fuller clusters
    for (let i = 0; i < 16; i++) {
      mid.push({
        x: (i * 231 + 90) % (worldW + 200) - 40,
        y: H * 0.18 + (i * 49) % Math.floor(H * 0.38),
        s: 0.55 + (i % 4) * 0.12,
        a: 0.45 + (i % 3) * 0.1,
        drift: 10 + (i % 4) * 3,
        phase: i * 1.1,
      });
    }
    return { far, mid };
  }

  function makeFlyingCherubs(worldW, H) {
    const genders = ["boy", "girl", "boy", "girl", "girl", "boy"];
    const poses = ["fly", "float", "dive", "wave", "fly", "float"];
    const list = [];
    for (let i = 0; i < 6; i++) {
      list.push({
        x: 80 + i * Math.max(280, worldW / 7),
        y: 40 + (i % 3) * (H * 0.12) + (i % 2) * 18,
        baseY: 40 + (i % 3) * (H * 0.12) + (i % 2) * 18,
        s: 0.72 + (i % 3) * 0.14,
        gender: genders[i],
        pose: poses[i],
        facing: i % 2 === 0 ? 1 : -1,
        speed: 18 + (i % 4) * 8,
        bobAmp: 6 + (i % 3) * 3,
        phase: i * 1.7,
        layer: i % 2 === 0 ? "far" : "mid",
      });
    }
    return list;
  }

  function drawCloudPlatform(c, isGoal, isCurrent, isNext) {
    const { x, y, w, h } = c;
    // fluffy cloud
    ctx.save();
    ctx.translate(x, y);

    const puff = (ox, oy, r) => {
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // shadow
    ctx.fillStyle = "rgba(100,140,180,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.35, w * 0.55, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isGoal ? "#fff8dc" : "#ffffff";
    puff(-w * 0.28, 0, h * 0.55);
    puff(w * 0.28, 0, h * 0.55);
    puff(0, -h * 0.35, h * 0.65);
    puff(-w * 0.1, h * 0.05, h * 0.45);
    puff(w * 0.12, h * 0.08, h * 0.42);
    ctx.beginPath();
    ctx.ellipse(0, h * 0.15, w * 0.5, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // outline hint
    if (isCurrent) {
      ctx.strokeStyle = "rgba(255, 180, 40, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.52, h * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isNext) {
      ctx.strokeStyle = "rgba(100, 180, 255, 0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.52, h * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // number badge (apple-like for later clouds)
    const badgeR = 16;
    const by = -h * 0.85;
    if (isGoal) {
      // golden apple
      const ag = ctx.createRadialGradient(-4, by - 4, 2, 0, by, badgeR + 4);
      ag.addColorStop(0, "#fff2a8");
      ag.addColorStop(0.5, "#ffd700");
      ag.addColorStop(1, "#d4a017");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(0, by, badgeR + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3d8b37";
      ctx.fillRect(-2, by - badgeR - 6, 4, 8);
      ctx.beginPath();
      ctx.ellipse(6, by - badgeR - 2, 7, 4, -0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(90, 140, 220, 0.95)";
      ctx.beginPath();
      ctx.arc(0, by, badgeR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isGoal ? "#5a3e00" : "#ffffff";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(c.index), 0, by);

    ctx.restore();
  }

  function drawGoldenTree(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    // glow
    const glow = ctx.createRadialGradient(0, -40, 10, 0, -40, 100);
    glow.addColorStop(0, "rgba(255, 215, 0, 0.55)");
    glow.addColorStop(1, "rgba(255, 215, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -40, 100, 0, Math.PI * 2);
    ctx.fill();

    // trunk
    const tg = ctx.createLinearGradient(-12, 20, 12, -60);
    tg.addColorStop(0, "#b8860b");
    tg.addColorStop(1, "#ffd700");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-14, 30);
    ctx.quadraticCurveTo(-8, -10, -10, -50);
    ctx.lineTo(10, -50);
    ctx.quadraticCurveTo(8, -10, 14, 30);
    ctx.closePath();
    ctx.fill();

    // canopy
    const leaves = [
      [0, -70, 38],
      [-28, -55, 30],
      [28, -55, 30],
      [-18, -85, 26],
      [18, -85, 26],
      [0, -100, 28],
    ];
    leaves.forEach(([lx, ly, r], i) => {
      const lg = ctx.createRadialGradient(lx - 5, ly - 5, 2, lx, ly, r);
      lg.addColorStop(0, "#fff3a0");
      lg.addColorStop(0.6, "#ffd700");
      lg.addColorStop(1, "#c9a227");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // apples with tiny carved numbers
    const apples = [
      [-22, -60, 7],
      [8, -78, 18],
      [24, -52, 12],
      [-6, -92, 15],
    ];
    apples.forEach(([ax, ay, num]) => {
      const ag = ctx.createRadialGradient(ax - 3, ay - 3, 1, ax, ay, 11);
      ag.addColorStop(0, "#fff8c0");
      ag.addColorStop(0.5, "#ffcc00");
      ag.addColorStop(1, "#daa520");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(ax, ay, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a3e00";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(num), ax, ay);
    });

    ctx.restore();
  }

  function drawPlayer(p, t) {
    const falling = !!p.falling;
    const jumping = state && state.phase === "jump";
    let mode = "idle";
    let animPhase = 0;
    if (falling) {
      mode = "fall";
      animPhase = p.flailPhase || 0;
    } else if (jumping && state.jumpAnim) {
      mode = "jump";
      animPhase = Math.max(0, Math.min(1, state.jumpAnim.t || 0));
    }
    const ok = drawCherubSprite(ctx, p.x, p.y, {
      gender: p.gender || "boy",
      scale: 0.72,
      facing: p.facing || 1,
      alpha: 1,
      bob: 0,
      tilt: 0,
      sweat: falling,
      mode,
      t,
      animPhase,
    });
    // If PNG not ready yet, skip (never fall back to glasses chibi)
    if (!ok) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 215, 0, 0.35)";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCherubsNearTree(goalCloud, W, H) {
    const x = goalCloud.x;
    const y = goalCloud.y;
    const t = state.animTime || 0;
    const bob = Math.sin(t * 2.0) * 4;
    if (!cherubsImg.complete || !cherubsImg.naturalWidth) return;
    // Full concept art prominently at cloud 18 (cherubs + golden apple tree)
    const dw = 170;
    const dh = dw * (cherubsImg.naturalHeight / cherubsImg.naturalWidth);
    ctx.save();
    // soft gold glow behind landmark
    const glow = ctx.createRadialGradient(x, y - dh * 0.45 + bob, 20, x, y - dh * 0.45 + bob, dw * 0.55);
    glow.addColorStop(0, "rgba(255, 215, 0, 0.45)");
    glow.addColorStop(1, "rgba(255, 215, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - dh * 0.45 + bob, dw * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.98;
    ctx.drawImage(cherubsImg, x - dw / 2, y - dh - 8 + bob, dw, dh);
    ctx.restore();
  }

  function drawArrowHint(from, to) {
    if (state.phase !== "play") return;
    const mx = (from.x + to.x) / 2;
    const my = Math.min(from.y, to.y) - 50;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 160, 40, 0.85)";
    ctx.fillStyle = "rgba(255, 160, 40, 0.85)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - 30);
    ctx.quadraticCurveTo(mx, my, to.x, to.y - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    // tip
    ctx.beginPath();
    ctx.moveTo(to.x, to.y - 30);
    ctx.lineTo(to.x - 10, to.y - 40);
    ctx.lineTo(to.x - 4, to.y - 22);
    ctx.closePath();
    ctx.fill();

    // prompt bubble
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "#ffb300";
    ctx.lineWidth = 2;
    const bx = from.x + 70;
    const by = from.y - 70;
    roundRect(bx - 50, by - 18, 100, 36, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5a3e00";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("按 跳躍 答題", bx, by);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }


  /** Subtle live bob for platform clouds (±~2.5px) — fair to land on. */
  function platformBobOffset(c, t) {
    const phase = c.bobPhase != null ? c.bobPhase : (c.index || 0) * 0.85;
    return Math.sin(t * 0.85 + phase) * 2.4;
  }

  function syncPlatformBob(t) {
    if (!state || !state.clouds) return;
    state.clouds.forEach((c) => {
      const base = c.baseY != null ? c.baseY : c.y;
      c.baseY = base;
      c.y = base + platformBobOffset(c, t);
    });
  }

  // --- Update / render ---
  function getViewSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { W: canvas.width / dpr, H: canvas.height / dpr };
  }

  function update(dt) {
    if (!state || state.phase === "win" || state.phase === "lose") return;

    state.worldTime = (state.worldTime || 0) + dt;
    syncPlatformBob(state.worldTime);

    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) failToast.classList.add("hidden");
    }

    // timer only while playing / jumping / falling (not during quiz pause? — design: countdown continues for whole level)
    // Spec: countdown for whole level — keep ticking even in quiz for urgency, but pause during quiz is more kid-friendly.
    // We'll pause during quiz so kids aren't punished for reading.
    if (!state.pausedForQuiz && (state.phase === "play" || state.phase === "jump" || state.phase === "fall")) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateHUD();
        endLose("時間到！再試一次，加油！");
        return;
      }
      updateHUD();
    }

    const p = state.player;

    if (state.phase === "jump" && state.jumpAnim) {
      const ja = state.jumpAnim;
      ja.t += dt / ja.dur;
      const t = Math.min(1, ja.t);
      const ease = Math.sin((t * Math.PI) / 2);
      const arc = Math.sin(t * Math.PI) * 70;
      p.x = ja.fromX + (ja.toX - ja.fromX) * ease;
      p.y = ja.fromY + (ja.toY - ja.fromY) * ease - arc;
      if (t >= 1) finishJump(ja.targetIndex);
    } else if (state.phase === "fall") {
      p.fallTimer -= dt;
      p.flailPhase = (p.flailPhase || 0) + dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.flailPhase * 14) * 40 * dt; // wobble lose footing
      p.vy += 560 * dt;
      p.anim += dt;
      if (p.fallTimer <= 0) {
        if (state.pendingLose) {
          const reason = state.pendingLose;
          state.pendingLose = null;
          endLose(reason);
          return;
        }
        // reset to current cloud
        const c = state.clouds[state.currentCloud - 1];
        p.x = c.x;
        p.y = c.y - 28;
        p.vy = 0;
        p.falling = false;
        p.flailPhase = 0;
        p.onGround = true;
        state.phase = "play";
      }
    } else if (state.phase === "play") {
      // slight walk on current cloud for feel
      const c = state.clouds[state.currentCloud - 1];
      const speed = 90;
      if (state.keys.left) {
        p.x -= speed * dt;
        p.facing = -1;
      }
      if (state.keys.right) {
        p.x += speed * dt;
        p.facing = 1;
      }
      // clamp to cloud top
      const half = c.w * 0.35;
      p.x = Math.max(c.x - half, Math.min(c.x + half, p.x));
      p.y = c.y - 28;
      p.anim += dt;

      if (state.keys.jump) {
        state.keys.jump = false; // edge trigger
        tryJumpNext();
      }
    }

    // camera follow
    const { W } = getViewSize();
    const targetCam = p.x - W * 0.35;
    state.cameraX += (targetCam - state.cameraX) * Math.min(1, dt * 5);
    state.cameraX = Math.max(0, Math.min(state.worldW - W, state.cameraX));

    // sparkles
    state.sparkles = state.sparkles.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      return s.life > 0;
    });

    // cherub-thrown gold coins
    if (state.coinBursts) {
      state.coinBursts = state.coinBursts.filter((c) => {
        c.life -= dt;
        c.vy += 380 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.spin * dt;
        c.vx *= 0.98;
        return c.life > 0;
      });
    }
  }

  function render(ts) {
    const { W, H } = getViewSize();
    drawSky(W, H);

    if (!state) return;

    const t = ts / 1000;
    state.animTime = t;
    drawDecorLayers(t);

    ctx.save();
    ctx.translate(-state.cameraX, 0);

    // clouds
    state.clouds.forEach((c) => {
      const isGoal = c.index === TOTAL_CLOUDS;
      const isCurrent = c.index === state.currentCloud;
      const isNext = c.index === state.currentCloud + 1;
      drawCloudPlatform(c, isGoal, isCurrent, isNext);
      if (isGoal) {
        // Canvas tree only as fallback before PNG loads; landmark PNG drawn below
        if (!cherubsImg.complete || !cherubsImg.naturalWidth) {
          drawGoldenTree(c.x, c.y - 10);
        }
      }
    });

    // concept-art landmark (assets/cherubs.png) at goal cloud 18
    drawCherubsNearTree(state.clouds[TOTAL_CLOUDS - 1], W, H);

    // hint arrow
    if (state.currentCloud < TOTAL_CLOUDS && state.phase === "play") {
      drawArrowHint(state.clouds[state.currentCloud - 1], state.clouds[state.currentCloud]);
    }

    // sparkles
    state.sparkles.forEach((s) => {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // gold coin particles from cherub celebration
    (state.coinBursts || []).forEach((c) => {
      const a = Math.max(0, Math.min(1, c.life / (c.maxLife || 1)));
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = a;
      // coin disc
      const rg = ctx.createRadialGradient(-2, -2, 1, 0, 0, c.size);
      rg.addColorStop(0, "#fff8c0");
      rg.addColorStop(0.55, "#ffd700");
      rg.addColorStop(1, "#c9a227");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(0, 0, c.size, c.size * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a67c00";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#a67c00";
      ctx.font = `bold ${Math.max(8, c.size)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("¢", 0, 1);
      ctx.restore();
    });

    drawPlayer(state.player, ts / 1000);

    ctx.restore();

    // ground mist
    const mist = ctx.createLinearGradient(0, H * 0.85, 0, H);
    mist.addColorStop(0, "rgba(255,255,255,0)");
    mist.addColorStop(1, "rgba(255,255,255,0.55)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.85, W, H * 0.15);
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

  function startGame() {
    if (window.FeishengLevel2 && typeof window.FeishengLevel2.stop === "function") {
      window.FeishengLevel2.stop();
    }
    if (window.FeishengLevel4 && typeof window.FeishengLevel4.stop === "function") {
      window.FeishengLevel4.stop();
    }
    if (window.FeishengLevel3 && typeof window.FeishengLevel3.stop === "function") {
      window.FeishengLevel3.stop();
    }
    ensureAudio();
    resizeCanvas();
    state = createState();
    // re-layout clouds with actual view height
    const { W, H } = getViewSize();
    state.worldW = 100 + (TOTAL_CLOUDS - 1) * 140 + 320;
    const baseY = H * 0.7;
    state.clouds = [];
    for (let i = 0; i < TOTAL_CLOUDS; i++) {
      const x = 100 + i * 140;
      const wave = Math.sin(i * 0.85) * Math.min(50, H * 0.08);
      const y = baseY - i * Math.min(8, H * 0.012) + wave;
      const cy = Math.max(H * 0.34, Math.min(H * 0.78, y));
      state.clouds.push({
        index: i + 1,
        x,
        y: cy,
        baseY: cy,
        bobPhase: i * 0.85,
        w: 108,
        h: 40,
      });
    }
    const start = state.clouds[0];
    state.player.x = start.x;
    state.player.y = start.y - 28;
    {
      const decor = makeDecorClouds(state.worldW, H);
      state.decorFar = decor.far;
      state.decorMid = decor.mid;
      state.flyCherubs = makeFlyingCherubs(state.worldW, H);
    }
    updateHUD();
    closeQuiz();
    failToast.classList.add("hidden");
    showScreen("game");
    lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  // --- Input ---
  window.addEventListener("keydown", (e) => {
    if (!state) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      state.keys.left = true;
      e.preventDefault();
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      state.keys.right = true;
      e.preventDefault();
    }
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      if (state.phase === "play") state.keys.jump = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (!state) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = false;
  });

  function bindHold(btn, on, off) {
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
    document.getElementById("btn-left"),
    () => state && (state.keys.left = true),
    () => state && (state.keys.left = false)
  );
  bindHold(
    document.getElementById("btn-right"),
    () => state && (state.keys.right = true),
    () => state && (state.keys.right = false)
  );
  document.getElementById("btn-jump").addEventListener("click", (e) => {
    e.preventDefault();
    if (state && state.phase === "play") tryJumpNext();
  });

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-replay-win").addEventListener("click", startGame);
  document.getElementById("btn-replay-lose").addEventListener("click", startGame);
  document.getElementById("btn-home").addEventListener("click", () => {
    cancelAnimationFrame(raf);
    showScreen("start");
    if (window.FeishengLevel2 && window.FeishengLevel2.refreshMenuButtons) {
      window.FeishengLevel2.refreshMenuButtons();
    }
  });

  window.addEventListener("resize", () => {
    if (!screens.game.classList.contains("active") || !state) return;
    const prevCloud = state.currentCloud;
    const { W, H } = (() => {
      resizeCanvas();
      return getViewSize();
    })();
    state.worldW = 100 + (TOTAL_CLOUDS - 1) * 140 + 320;
    const baseY = H * 0.7;
    state.clouds = [];
    for (let i = 0; i < TOTAL_CLOUDS; i++) {
      const x = 100 + i * 140;
      const wave = Math.sin(i * 0.85) * Math.min(50, H * 0.08);
      const y = baseY - i * Math.min(8, H * 0.012) + wave;
      const cy = Math.max(H * 0.34, Math.min(H * 0.78, y));
      state.clouds.push({
        index: i + 1,
        x,
        y: cy,
        baseY: cy,
        bobPhase: i * 0.85,
        w: 108,
        h: 40,
      });
    }
    const c = state.clouds[prevCloud - 1];
    state.player.x = c.x;
    state.player.y = c.y - 28;
    {
      const decor = makeDecorClouds(state.worldW, H);
      state.decorFar = decor.far;
      state.decorMid = decor.mid;
      state.flyCherubs = makeFlyingCherubs(state.worldW, H);
    }
  });
  function stopLevel1() {
    cancelAnimationFrame(raf);
    raf = 0;
    state = null;
    try { closeQuiz(); } catch (_) {}
    if (failToast) failToast.classList.add("hidden");
  }

  window.FeishengL1 = {
    stop: stopLevel1,
    loadSave,
    writeSave,
    start: startGame,
    showStart: () => {
      stopLevel1();
      showScreen("start");
      if (window.FeishengLevel2 && window.FeishengLevel2.refreshMenuButtons) {
        window.FeishengLevel2.refreshMenuButtons();
      }
    },
  };

  // When entering L2 from win, stop L1 loop (button handled in level2.js)
  const btnEnterL2 = document.getElementById("btn-enter-l2");
  if (btnEnterL2) {
    btnEnterL2.addEventListener("click", () => stopLevel1());
  }

  showScreen("start");
  // refresh L2 menu visibility after L1 boots
  setTimeout(() => {
    if (window.FeishengLevel2 && window.FeishengLevel2.refreshMenuButtons) {
      window.FeishengLevel2.refreshMenuButtons();
    }
  }, 0);
})();
