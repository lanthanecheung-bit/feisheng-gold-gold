/**
 * 飛升 Gold Gold! — Level 4
 * Golden-palace top-down maze: angel flees a minotaur.
 * One-way trail: paths behind the player seal (player only);
 * minotaur can still cross sealed trail. Peek a zone's path for 1♥ / 1s.
 */
(() => {
  "use strict";

  const SAVE_KEY = "feishengGoldGold.save";
  const START_HEARTS = 3;
  const LEVEL_TIME = 300; // 5 minutes
  const SPRING_TIME_BONUS = 30; // 每瓶生命泉水 +30 秒
  const HAMMER_USES_PER = 3; // 一把金手搥可用 3 次破封印
  const DRILL_USES_PER = 3; // 一把破牆鑽可鑿 3 格實牆
  const BOMB_STUN_SEC = 10; // 炸彈炸中牛頭怪暫停秒數
  const CACHE_V = "1789588500";
  const GRID = 25; // odd, ~21–31
  const CELL = 28;
  const PLAYER_STEP_CD = 0.16;
  const MINO_STEP_CD = 0.42; // slower than player
  const INVULN_TIME = 1.6;
  const PEEK_DURATION = 1.0;
  const SOFTLOCK_LOSE_AFTER = 2.2;

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
    gameL4: document.getElementById("level4-screen"),
    winL4: document.getElementById("win-screen-l4"),
    loseL4: document.getElementById("lose-screen-l4"),
  };

  const canvas = document.getElementById("level4-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const livesEl = document.getElementById("l4-lives");
  const coinsEl = document.getElementById("l4-coins");
  const diamondsEl = document.getElementById("l4-diamonds");
  const hammersEl = document.getElementById("l4-hammers");
  const drillsEl = document.getElementById("l4-drills");
  const bombsEl = document.getElementById("l4-bombs");
  const timerEl = document.getElementById("l4-timer");
  const failToast = document.getElementById("l4-fail-toast");
  const winCoinsEl = document.getElementById("l4-win-coins");
  const winHeartsEl = document.getElementById("l4-win-hearts");
  const loseReason = document.getElementById("l4-lose-reason");
  const compassEl = document.getElementById("l4-compass-needle");

  const angelBoyGoldImg = new Image();
  angelBoyGoldImg.src = `assets/angel-boy-gold.png?v=${CACHE_V}`;
  const angelGirlGoldImg = new Image();
  angelGirlGoldImg.src = `assets/angel-girl-gold.png?v=${CACHE_V}`;
  const minotaurImg = new Image();
  minotaurImg.src = `assets/minotaur.png?v=${CACHE_V}`;
  const palaceBgImg = new Image();
  palaceBgImg.src = `assets/refs/palace-interior-ref-sm.png?v=${CACHE_V}`;
  const goldKeyImg = new Image();
  goldKeyImg.src = `assets/sky-chariot-gold-key.png?v=${CACHE_V}`;
  const treasureChestImg = new Image();
  treasureChestImg.src = `assets/treasure-chest.png?v=${CACHE_V}`;
  const goldHammerImg = new Image();
  goldHammerImg.src = `assets/gold-hammer.png?v=${CACHE_V}`;
  const wallDrillImg = new Image();
  wallDrillImg.src = `assets/wall-drill.png?v=${CACHE_V}`;
  const mazeBombImg = new Image();
  mazeBombImg.src = `assets/maze-bomb.png?v=${CACHE_V}`;
  const lifeSpringImg = new Image();
  lifeSpringImg.src = `assets/life-spring-bottle.png?v=${CACHE_V}`;
  const skyChariotImg = new Image();
  skyChariotImg.src = `assets/sky-chariot.png?v=${CACHE_V}`;

  function imgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function angelSprite(gender) {
    return gender === "girl" ? angelGirlGoldImg : angelBoyGoldImg;
  }

  function heartIcons(n) {
    const c = Math.max(0, Math.min(12, Math.floor(n)));
    return "♡".repeat(c) || "·";
  }

  function showScreen(el) {
    document.querySelectorAll("#app > .screen").forEach((s) => s.classList.remove("active"));
    if (el) el.classList.add("active");
  }

  function showToast(msg, ms) {
    if (!failToast) return;
    failToast.textContent = msg;
    failToast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => failToast.classList.add("hidden"), ms || 1800);
  }

  // --- Audio ---
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playTone(freq, dur, type, vol) {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol || 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function playStep() {
    playTone(420, 0.04, "triangle", 0.04);
  }
  function playSeal() {
    playTone(220, 0.12, "sine", 0.05);
    playTone(160, 0.18, "triangle", 0.04);
  }
  function playHit() {
    playTone(120, 0.2, "sawtooth", 0.08);
    playTone(80, 0.3, "square", 0.05);
  }
  function playCoin() {
    playTone(880, 0.08, "sine", 0.06);
    playTone(1320, 0.1, "triangle", 0.05);
  }
  function playPeek() {
    playTone(660, 0.15, "sine", 0.06);
    playTone(990, 0.2, "triangle", 0.04);
  }
  function playWinFanfare() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.22, "triangle", 0.07), i * 90);
    });
  }

  // --- Maze generation (perfect maze on odd cells) ---
  const DIRS = [
    { dx: 0, dy: -1, name: "N", opposite: "S" },
    { dx: 1, dy: 0, name: "E", opposite: "W" },
    { dx: 0, dy: 1, name: "S", opposite: "N" },
    { dx: -1, dy: 0, name: "W", opposite: "E" },
  ];

  function keyOf(x, y) {
    return x + "," + y;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateMaze(seed) {
    const rng = mulberry32(seed >>> 0);
    // grid: 1 = wall, 0 = passage
    const wall = Array.from({ length: GRID }, () => Array(GRID).fill(1));
    const cells = [];
    for (let y = 1; y < GRID; y += 2) {
      for (let x = 1; x < GRID; x += 2) {
        wall[y][x] = 0;
        cells.push({ x, y });
      }
    }

    const stack = [];
    const startCell = cells[Math.floor(rng() * cells.length)];
    const visited = new Set([keyOf(startCell.x, startCell.y)]);
    stack.push(startCell);

    while (stack.length) {
      const cur = stack[stack.length - 1];
      const neigh = [];
      for (const d of DIRS) {
        const nx = cur.x + d.dx * 2;
        const ny = cur.y + d.dy * 2;
        if (nx < 1 || ny < 1 || nx >= GRID - 1 || ny >= GRID - 1) continue;
        if (visited.has(keyOf(nx, ny))) continue;
        neigh.push({ x: nx, y: ny, wx: cur.x + d.dx, wy: cur.y + d.dy });
      }
      if (!neigh.length) {
        stack.pop();
        continue;
      }
      const pick = neigh[Math.floor(rng() * neigh.length)];
      wall[pick.wy][pick.wx] = 0;
      wall[pick.y][pick.x] = 0;
      visited.add(keyOf(pick.x, pick.y));
      stack.push({ x: pick.x, y: pick.y });
    }

    // Carve a few extra loops so peek/zone play is less brittle (still mostly perfect)
    const extraCuts = 10;
    for (let i = 0; i < extraCuts; i++) {
      const x = 2 + Math.floor(rng() * (GRID - 4));
      const y = 2 + Math.floor(rng() * (GRID - 4));
      if (wall[y][x] !== 1) continue;
      // only cut if both sides are passages (corridor wall between two cells)
      const horiz =
        wall[y][x - 1] === 0 && wall[y][x + 1] === 0 && wall[y - 1][x] === 1 && wall[y + 1][x] === 1;
      const vert =
        wall[y - 1][x] === 0 && wall[y + 1][x] === 0 && wall[y][x - 1] === 1 && wall[y][x + 1] === 1;
      if (horiz || vert) wall[y][x] = 0;
    }

    // Exit on left edge (E) — open outer wall at odd row near mid-upper
    let exitY = 5 + Math.floor(rng() * 5) * 2; // odd rows ~5–13
    if (exitY % 2 === 0) exitY += 1;
    exitY = Math.max(1, Math.min(GRID - 2, exitY));
    wall[exitY][0] = 0;
    wall[exitY][1] = 0;
    const exit = { x: 0, y: exitY };

    // Start opposite exit — right side passage
    let startY = exitY;
    // prefer a clear passage on the right
    let startX = GRID - 2;
    if (wall[startY][startX] === 1) {
      for (let y = 1; y < GRID - 1; y += 2) {
        if (wall[y][startX] === 0) {
          startY = y;
          break;
        }
      }
    }
    const start = { x: startX, y: startY };

    // Minotaur bottom-right
    let mx = GRID - 2;
    let my = GRID - 2;
    if (wall[my][mx] === 1) {
      outer: for (let y = GRID - 2; y >= GRID - 8; y--) {
        for (let x = GRID - 2; x >= GRID - 8; x--) {
          if (wall[y][x] === 0 && !(x === start.x && y === start.y)) {
            mx = x;
            my = y;
            break outer;
          }
        }
      }
    }
    const mino = { x: mx, y: my };

    // Treasure (optional coins) — top-right cul-de-sac-ish
    let tx = GRID - 4;
    let ty = 3;
    if (wall[ty][tx] === 1) {
      for (let y = 1; y < 9; y++) {
        for (let x = GRID - 8; x < GRID - 1; x++) {
          if (wall[y][x] === 0 && !(x === start.x && y === start.y)) {
            tx = x;
            ty = y;
          }
        }
      }
    }
    const treasure = { x: tx, y: ty };

    // Extra coin pickups along corridors
    const coins = [{
      x: treasure.x,
      y: treasure.y,
      value: 8,
      hearts: 2,
      diamonds: 2,
      spring: true,
      hammer: true,
      taken: false,
      treasure: true,
    }];
    for (let i = 0; i < 6; i++) {
      const cx = 1 + Math.floor(rng() * (GRID - 2));
      const cy = 1 + Math.floor(rng() * (GRID - 2));
      if (wall[cy][cx] !== 0) continue;
      if (cx === start.x && cy === start.y) continue;
      if (cx === exit.x && cy === exit.y) continue;
      if (cx === treasure.x && cy === treasure.y) continue;
      coins.push({ x: cx, y: cy, value: 1, taken: false, treasure: false });
    }

    // Starter 金手搥：開局放在起點旁邊（可見、一踏就拎）
    let starterHammerPlaced = false;
    for (const d of DIRS) {
      const hx = start.x + d.dx;
      const hy = start.y + d.dy;
      if (isWall(wall, hx, hy)) continue;
      if (hx === exit.x && hy === exit.y) continue;
      if (hx === treasure.x && hy === treasure.y) continue;
      if (hx === mino.x && hy === mino.y) continue;
      if (coins.some((c) => c.x === hx && c.y === hy)) continue;
      coins.push({ x: hx, y: hy, kind: "hammer", hammers: 1, taken: false, starter: true });
      starterHammerPlaced = true;
      break;
    }
    if (!starterHammerPlaced) {
      // 找不到鄰格就放喺起點（開局會自動拾取）
      coins.push({ x: start.x, y: start.y, kind: "hammer", hammers: 1, taken: false, starter: true });
    }

    // Extra scattered ♡ / 💎 / 生命泉水（手搥已喺起點旁）
    let extras = 0;
    let guard = 0;
    while (extras < 3 && guard++ < 100) {
      const cx = 1 + Math.floor(Math.random() * (GRID - 2));
      const cy = 1 + Math.floor(Math.random() * (GRID - 2));
      if (isWall(wall, cx, cy)) continue;
      if (cx === start.x && cy === start.y) continue;
      if (cx === exit.x && cy === exit.y) continue;
      if (cx === treasure.x && cy === treasure.y) continue;
      if (cx === mino.x && cy === mino.y) continue;
      if (coins.some((c) => c.x === cx && c.y === cy)) continue;
      if (extras === 0) coins.push({ x: cx, y: cy, kind: "heart", hearts: 1, taken: false });
      else if (extras === 1) coins.push({ x: cx, y: cy, kind: "diamond", diamonds: 1, taken: false });
      else coins.push({ x: cx, y: cy, kind: "spring", bottles: 1, taken: false });
      extras += 1;
    }


    // 途中破牆鑽（專鑿實牆）— 放 2 把喺通道
    let drillsPlaced = 0;
    let dguard = 0;
    while (drillsPlaced < 2 && dguard++ < 150) {
      const cx = 2 + Math.floor(Math.random() * (GRID - 4));
      const cy = 2 + Math.floor(Math.random() * (GRID - 4));
      if (isWall(wall, cx, cy)) continue;
      if (cx === start.x && cy === start.y) continue;
      if (cx === exit.x && cy === exit.y) continue;
      if (cx === treasure.x && cy === treasure.y) continue;
      if (cx === mino.x && cy === mino.y) continue;
      if (coins.some((c) => c.x === cx && c.y === cy)) continue;
      // prefer mid-map (途中)
      const distStart = Math.abs(cx - start.x) + Math.abs(cy - start.y);
      if (distStart < 5) continue;
      coins.push({ x: cx, y: cy, kind: "drill", drills: 1, taken: false });
      drillsPlaced += 1;
    }

    // 生命力寶箱（途中）— 打開大幅補♡
    let lifeChests = 0;
    let lguard = 0;
    while (lifeChests < 2 && lguard++ < 150) {
      const cx = 2 + Math.floor(Math.random() * (GRID - 4));
      const cy = 2 + Math.floor(Math.random() * (GRID - 4));
      if (isWall(wall, cx, cy)) continue;
      if (cx === start.x && cy === start.y) continue;
      if (cx === exit.x && cy === exit.y) continue;
      if (cx === treasure.x && cy === treasure.y) continue;
      if (cx === mino.x && cy === mino.y) continue;
      if (coins.some((c) => c.x === cx && c.y === cy)) continue;
      const distStart = Math.abs(cx - start.x) + Math.abs(cy - start.y);
      if (distStart < 4) continue;
      coins.push({
        x: cx,
        y: cy,
        kind: "lifeChest",
        hearts: 3,
        taken: false,
        treasure: false,
      });
      lifeChests += 1;
    }

    // 途中炸彈 — 可放通道炸牛頭怪
    let bombsPlaced = 0;
    let bguard = 0;
    while (bombsPlaced < 3 && bguard++ < 160) {
      const cx = 2 + Math.floor(Math.random() * (GRID - 4));
      const cy = 2 + Math.floor(Math.random() * (GRID - 4));
      if (isWall(wall, cx, cy)) continue;
      if (cx === start.x && cy === start.y) continue;
      if (cx === exit.x && cy === exit.y) continue;
      if (cx === treasure.x && cy === treasure.y) continue;
      if (cx === mino.x && cy === mino.y) continue;
      if (coins.some((c) => c.x === cx && c.y === cy)) continue;
      const distStart = Math.abs(cx - start.x) + Math.abs(cy - start.y);
      if (distStart < 5) continue;
      coins.push({ x: cx, y: cy, kind: "bomb", bombs: 1, taken: false });
      bombsPlaced += 1;
    }

    return { wall, exit, start, mino, treasure, coins, seed };
  }

  function isWall(wall, x, y) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
    return wall[y][x] === 1;
  }

  function neighborsPassable(wall, x, y) {
    const out = [];
    for (const d of DIRS) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (!isWall(wall, nx, ny)) out.push({ x: nx, y: ny, dir: d });
    }
    return out;
  }

  /** BFS path on base walls (ignores player seals). Returns array of {x,y} or null. */
  function bfsPath(wall, from, to) {
    const q = [from];
    const prev = new Map();
    prev.set(keyOf(from.x, from.y), null);
    while (q.length) {
      const cur = q.shift();
      if (cur.x === to.x && cur.y === to.y) break;
      for (const n of neighborsPassable(wall, cur.x, cur.y)) {
        const k = keyOf(n.x, n.y);
        if (prev.has(k)) continue;
        prev.set(k, cur);
        q.push({ x: n.x, y: n.y });
      }
    }
    const endKey = keyOf(to.x, to.y);
    if (!prev.has(endKey)) return null;
    const path = [];
    let c = to;
    while (c) {
      path.push({ x: c.x, y: c.y });
      c = prev.get(keyOf(c.x, c.y));
    }
    path.reverse();
    return path;
  }

  /** Next step toward target via BFS; null if stuck. */
  function bfsNextStep(wall, from, to) {
    if (from.x === to.x && from.y === to.y) return null;
    const path = bfsPath(wall, from, to);
    if (!path || path.length < 2) return null;
    return path[1];
  }

  function zoneOf(x, y) {
    const mid = (GRID - 1) / 2;
    const left = x <= mid;
    const top = y <= mid;
    if (top && left) return 0; // NW
    if (top && !left) return 1; // NE
    if (!top && left) return 2; // SW
    return 3; // SE
  }

  const ZONE_NAMES = ["西北", "東北", "西南", "東南"];

  // --- State ---
  let state = null;
  let raf = 0;
  let lastTs = 0;

  function createState() {
    const save = loadSave();
    const maze = generateMaze((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const solution = bfsPath(maze.wall, maze.start, maze.exit) || [];
    const hearts = Math.max(START_HEARTS, save.heartsBanked || START_HEARTS);
    return {
      phase: "play",
      maze,
      solution,
      player: {
        x: maze.start.x,
        y: maze.start.y,
        facing: "W", // toward exit side
        stepCd: 0,
        invuln: 0,
        gender: Math.random() < 0.5 ? "girl" : "boy",
      },
      mino: {
        x: maze.mino.x,
        y: maze.mino.y,
        stepCd: MINO_STEP_CD * 0.5,
        facing: "W",
        stunT: 0, // 炸彈暈眩剩餘秒
      },
      // cells sealed for the PLAYER only (left behind)
      sealed: new Set(),
      trail: [keyOf(maze.start.x, maze.start.y)],
      coins: maze.coins.map((c) => ({ ...c })),
      hearts,
      coinsCount: save.coins || 0,
      diamonds: 0,
      springOwned: false,
      springBottles: 0,
      hammerCount: 0,
      hammerCharges: 0,
      drillCount: 0,
      drillCharges: 0,
      bombCount: 0,
      placedBombs: [],
      timeLeft: LEVEL_TIME,
      worldTime: 0,
      peek: { zone: -1, t: 0 },
      softlockT: 0,
      keys: { up: false, down: false, left: false, right: false },
      camera: { x: 0, y: 0 },
      shake: 0,
    };
  }

  function resizeCanvas() {
    if (!canvas || !screens.gameL4) return;
    const wrap = document.getElementById("stage-wrap-l4");
    const w = wrap ? wrap.clientWidth : window.innerWidth;
    const h = wrap ? wrap.clientHeight : Math.floor(window.innerHeight * 0.7);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(320, Math.floor(w * dpr));
    canvas.height = Math.max(240, Math.floor(h * dpr));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getViewSize() {
    const wrap = document.getElementById("stage-wrap-l4");
    return {
      W: wrap ? wrap.clientWidth : 960,
      H: wrap ? wrap.clientHeight : 540,
    };
  }



  function collectPickupsAt(x, y, opts) {
    if (!state) return;
    const silent = opts && opts.silent;
    for (const c of state.coins) {
      if (c.taken || c.x !== x || c.y !== y) continue;
      c.taken = true;
      if (c.treasure) {
        // reuse move logic path — rare on start
        continue;
      }
      if (c.kind === "hammer") {
        const n = c.hammers != null ? c.hammers : 1;
        const uses = grantHammer(n);
        if (!silent) showToast("🔨 開局金手搥！可破封印 " + uses + " 次", 1600);
      } else if (c.kind === "drill") {
        const n = c.drills != null ? c.drills : 1;
        const uses = grantDrill(n);
        if (!silent) showToast("破牆鑽！可鑿實牆 " + uses + " 格", 1600);
      } else if (c.kind === "heart") {
        state.hearts = Math.min(12, state.hearts + (c.hearts || 1));
      } else if (c.kind === "diamond") {
        state.diamonds = (state.diamonds || 0) + (c.diamonds || 1);
      } else if (c.kind === "spring") {
        grantSpringBottle(c.bottles != null ? c.bottles : 1);
      } else if (c.value) {
        state.coinsCount += c.value;
      }
    }
    updateHUD();
  }

  function grantHammer(count) {
    const n = Math.max(1, count | 0);
    state.hammerCount = (state.hammerCount || 0) + n;
    state.hammerCharges = (state.hammerCharges || 0) + HAMMER_USES_PER * n;
    return HAMMER_USES_PER * n;
  }

  function grantDrill(count) {
    const n = Math.max(1, count | 0);
    state.drillCount = (state.drillCount || 0) + n;
    state.drillCharges = (state.drillCharges || 0) + DRILL_USES_PER * n;
    return DRILL_USES_PER * n;
  }

  function facingDelta(facing) {
    const map = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    return map[facing] || [0, 0];
  }

  /** 可否鑿呢格實牆（唔好鑿外框） */
  function canDrillWallAt(x, y) {
    if (!state) return false;
    if (x <= 0 || y <= 0 || x >= GRID - 1 || y >= GRID - 1) return false;
    return isWall(state.maze.wall, x, y);
  }

  /** 鑿面前／指定方向一格實牆；成功回 true */
  function drillSolidWall(dx, dy) {
    if (!state || state.phase !== "play") return false;
    if ((state.drillCharges || 0) <= 0) {
      showToast("沒有破牆鑽！途中搵鑽頭專鑿實牆", 1200);
      return false;
    }
    const p = state.player;
    let ddx = dx;
    let ddy = dy;
    if (ddx == null || ddy == null) {
      const f = facingDelta(p.facing);
      ddx = f[0];
      ddy = f[1];
    }
    const tx = p.x + ddx;
    const ty = p.y + ddy;
    if (!canDrillWallAt(tx, ty)) {
      if (tx <= 0 || ty <= 0 || tx >= GRID - 1 || ty >= GRID - 1) {
        showToast("外牆太厚，鑿唔開！", 1000);
      } else if (!isWall(state.maze.wall, tx, ty)) {
        showToast("前面唔係實牆", 900);
      } else {
        showToast("呢度鑿唔到", 900);
      }
      return false;
    }
    state.maze.wall[ty][tx] = 0;
    state.drillCharges -= 1;
    // 清走可能殘留封印
    state.sealed.delete(keyOf(tx, ty));
    state.shake = 0.25;
    try { playSeal(); } catch (_) {}
    updateHUD();
    showToast("破牆鑽鑿開實牆！剩 " + state.drillCharges + " 次", 1200);
    return true;
  }


  /** Click 換金手搥：扣 1♡，獲得一把（3 次破封印） */
  function buyHammerWithHeart() {
    if (!state || state.phase !== "play") return;
    if (state.hearts <= 0) {
      showToast("沒有生命力…", 900);
      return;
    }
    state.hearts -= 1;
    const uses = grantHammer(1);
    playPeek();
    updateHUD();
    showToast("🔨 用 −1♡ 換得金手搥！破封印 +" + uses + " 次", 1600);
    if (state.hearts <= 0) {
      endLose("生命耗盡…換金手搥後沒有♡了");
    }
  }

  /** Click 換破牆鑽：扣 1♡，獲得一把（3 次鑿實牆） */
  function buyDrillWithHeart() {
    if (!state || state.phase !== "play") return;
    if (state.hearts <= 0) {
      showToast("沒有生命力…", 900);
      return;
    }
    state.hearts -= 1;
    const uses = grantDrill(1);
    playPeek();
    updateHUD();
    showToast("破牆鑽用 −1♡ 換得！鑿實牆 +" + uses + " 次", 1600);
    if (state.hearts <= 0) {
      endLose("生命耗盡…換破牆鑽後沒有♡了");
    }
  }


  function placeBombOnPath() {
    if (!state || state.phase !== "play") return false;
    if ((state.bombCount || 0) <= 0) {
      showToast("沒有炸彈！途中拾取後可放通道", 1200);
      return false;
    }
    const p = state.player;
    if ((state.placedBombs || []).some((b) => b.x === p.x && b.y === p.y && !b.blown)) {
      showToast("呢格已有炸彈", 900);
      return false;
    }
    state.bombCount -= 1;
    state.placedBombs.push({ x: p.x, y: p.y, blown: false, fuse: 0 });
    updateHUD();
    showToast("炸彈已放喺通道！牛頭怪踩中會暫停 " + BOMB_STUN_SEC + " 秒", 1600);
    if (state.mino.x === p.x && state.mino.y === p.y) {
      detonateBombsAt(p.x, p.y);
    }
    return true;
  }

  function detonateBombsAt(x, y) {
    if (!state) return;
    let hit = false;
    for (const b of state.placedBombs || []) {
      if (b.blown) continue;
      if (b.x === x && b.y === y) {
        b.blown = true;
        hit = true;
      }
    }
    if (!hit) return;
    state.shake = 0.45;
    state.mino.stunT = BOMB_STUN_SEC;
    try { playHit(); } catch (_) {}
    showToast("炸彈爆炸！牛頭怪暫停 " + BOMB_STUN_SEC + " 秒", 2000);
    state.placedBombs = state.placedBombs.filter((b) => !b.blown);
  }

  function grantSpringBottle(count) {
    const n = Math.max(1, count | 0);
    state.springBottles = (state.springBottles || 0) + n;
    state.springOwned = true;
    state.timeLeft += SPRING_TIME_BONUS * n;
    return SPRING_TIME_BONUS * n;
  }

  function updateHUD() {
    if (!state) return;
    if (livesEl) livesEl.textContent = heartIcons(state.hearts);
    if (coinsEl) coinsEl.textContent = String(state.coinsCount);
    if (diamondsEl) diamondsEl.textContent = String(state.diamonds || 0);
    if (hammersEl) hammersEl.textContent = String(state.hammerCharges || 0);
    if (drillsEl) drillsEl.textContent = String(state.drillCharges || 0);
    if (bombsEl) bombsEl.textContent = String(state.bombCount || 0);
    if (timerEl) {
      const t = Math.max(0, Math.ceil(state.timeLeft));
      const m = Math.floor(t / 60);
      const s = t % 60;
      timerEl.textContent = m + ":" + String(s).padStart(2, "0");
      timerEl.classList.toggle("urgent", t <= 30);
    }
    updateCompass();
  }

  function updateCompass() {
    if (!compassEl || !state) return;
    const map = { N: 0, E: 90, S: 180, W: 270 };
    const deg = map[state.player.facing] || 0;
    compassEl.style.transform = `rotate(${deg}deg)`;
    const label = document.getElementById("l4-compass-label");
    if (label) label.textContent = state.player.facing;
  }

  function playerCanEnter(x, y) {
    if (!state) return false;
    if (isWall(state.maze.wall, x, y)) return false;
    if (state.sealed.has(keyOf(x, y))) return false;
    return true;
  }

  function legalPlayerMoves() {
    if (!state) return [];
    const p = state.player;
    const moves = [];
    const canBreak = (state.hammerCharges || 0) > 0;
    const canDrill = (state.drillCharges || 0) > 0;
    for (const d of DIRS) {
      const nx = p.x + d.dx;
      const ny = p.y + d.dy;
      if (isWall(state.maze.wall, nx, ny)) {
        if (canDrill && canDrillWallAt(nx, ny)) {
          moves.push({ x: nx, y: ny, dir: d, drill: true });
        }
        continue;
      }
      if (state.sealed.has(keyOf(nx, ny))) {
        if (canBreak) moves.push({ x: nx, y: ny, dir: d, breakSeal: true });
        continue;
      }
      moves.push({ x: nx, y: ny, dir: d });
    }
    return moves;
  }

  function tryMovePlayer(dx, dy, dirName) {
    if (!state || state.phase !== "play") return false;
    if (state.player.stepCd > 0) return false;
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    if (isWall(state.maze.wall, nx, ny)) {
      // 有破牆鑽 → 可鑿內牆再進入
      if ((state.drillCharges || 0) > 0 && canDrillWallAt(nx, ny)) {
        if (!drillSolidWall(dx, dy)) return false;
        // wall cleared; fall through to move
      } else {
        if ((state.drillCharges || 0) <= 0 && canDrillWallAt(nx, ny)) {
          showToast("實牆！搵破牆鑽先可鑿", 1000);
        }
        return false;
      }
    }
    const targetKey = keyOf(nx, ny);
    let brokeSeal = false;
    if (state.sealed.has(targetKey)) {
      if ((state.hammerCharges || 0) > 0) {
        state.sealed.delete(targetKey);
        state.hammerCharges -= 1;
        brokeSeal = true;
        updateHUD();
        showToast("🔨 金手搥破開封印！剩 " + state.hammerCharges + " 次", 1100);
      } else {
        showToast("退路已封印！搵金手搥可破（每把 3 次）", 1100);
        return false;
      }
    }
    // Seal the cell we are leaving (player only)
    const leftKey = keyOf(state.player.x, state.player.y);
    state.sealed.add(leftKey);
    state.trail.push(keyOf(nx, ny));
    state.player.x = nx;
    state.player.y = ny;
    state.player.facing = dirName;
    state.player.stepCd = PLAYER_STEP_CD;
    state.softlockT = 0;
    playStep();
    playSeal();

    // Coins / treasure chest loot
    for (const c of state.coins) {
      if (!c.taken && c.x === nx && c.y === ny) {
        c.taken = true;
        if (c.treasure) {
          // 寶箱：♡、鑽石、生命泉水、金幣
          const addHearts = c.hearts != null ? c.hearts : 2;
          const addDiamonds = c.diamonds != null ? c.diamonds : 2;
          const addCoins = c.value != null ? c.value : 8;
          const addSpring = c.spring !== false;
          const addHammer = c.hammer !== false;
          state.hearts = Math.min(12, state.hearts + addHearts);
          state.diamonds = (state.diamonds || 0) + addDiamonds;
          state.coinsCount += addCoins;
          let springBonus = 0;
          if (addSpring) {
            springBonus = grantSpringBottle(1);
          }
          let hammerUses = 0;
          if (addHammer) {
            hammerUses = grantHammer(1);
          }
          playCoin();
          try { if (typeof playPeek === "function") playPeek(); } catch (_) {}
          showToast(
            "寶箱！♡+" + addHearts +
              (springBonus ? " · 💧泉水 +" + springBonus + "秒" : "") +
              (hammerUses ? " · 🔨金手搥 +" + hammerUses + "次" : "") +
              " · 💎+" + addDiamonds + " · 🪙+" + addCoins,
            2400
          );
          updateHUD();
        } else if (c.kind === "lifeChest") {
          const addH = c.hearts != null ? c.hearts : 3;
          state.hearts = Math.min(12, state.hearts + addH);
          playCoin();
          try { if (typeof playPeek === "function") playPeek(); } catch (_) {}
          showToast("生命力寶箱！♡ +" + addH, 1800);
          updateHUD();
        } else if (c.kind === "heart") {
          state.hearts = Math.min(12, state.hearts + (c.hearts || 1));
          playCoin();
          showToast("♡ 生命 +" + (c.hearts || 1), 1000);
          updateHUD();
        } else if (c.kind === "diamond") {
          state.diamonds = (state.diamonds || 0) + (c.diamonds || 1);
          playCoin();
          showToast("💎 鑽石 +" + (c.diamonds || 1) + "（可擋牛擊）", 1100);
          updateHUD();
        } else if (c.kind === "spring") {
          const bottles = c.bottles != null ? c.bottles : 1;
          const bonus = grantSpringBottle(bottles);
          playCoin();
          showToast("💧 生命泉水 ×" + bottles + "！總時間 +" + bonus + " 秒", 1400);
          updateHUD();
        } else if (c.kind === "hammer") {
          const n = c.hammers != null ? c.hammers : 1;
          const uses = grantHammer(n);
          playCoin();
          showToast("🔨 金手搥 ×" + n + "！可破封印 " + uses + " 次（每把 3 次）", 1600);
          updateHUD();
        } else if (c.kind === "drill") {
          const n = c.drills != null ? c.drills : 1;
          const uses = grantDrill(n);
          playCoin();
          showToast("破牆鑽 ×" + n + "！可鑿實牆 " + uses + " 格（每把 3 次）", 1700);
          updateHUD();
        } else if (c.kind === "bomb") {
          const n = c.bombs != null ? c.bombs : 1;
          state.bombCount = (state.bombCount || 0) + n;
          playCoin();
          showToast("炸彈 ×" + n + "！放通道上可炸停牛頭怪 " + BOMB_STUN_SEC + " 秒", 1800);
          updateHUD();
        } else {
          state.coinsCount += c.value;
          playCoin();
          showToast("🪙 +" + c.value, 800);
        }
      }
    }

    // Exit?
    if (nx === state.maze.exit.x && ny === state.maze.exit.y) {
      endWin();
      return true;
    }
    return true;
  }

  function applyMoveFromKeys() {
    if (!state || state.phase !== "play") return;
    const k = state.keys;
    if (k.up) tryMovePlayer(0, -1, "N");
    else if (k.down) tryMovePlayer(0, 1, "S");
    else if (k.left) tryMovePlayer(-1, 0, "W");
    else if (k.right) tryMovePlayer(1, 0, "E");
  }

  function updateMinotaur(dt) {
    if (!state || state.phase !== "play") return;
    const m = state.mino;
    if (m.stunT > 0) {
      m.stunT -= dt;
      if (m.stunT < 0) m.stunT = 0;
      return; // 炸彈暈眩：暫停前進
    }
    m.stepCd -= dt;
    if (m.stepCd > 0) return;
    const next = bfsNextStep(
      state.maze.wall,
      { x: m.x, y: m.y },
      { x: state.player.x, y: state.player.y }
    );
    // Minotaur ignores sealed trail — chase on base maze only
    if (next) {
      const dx = next.x - m.x;
      const dy = next.y - m.y;
      if (dy < 0) m.facing = "N";
      else if (dy > 0) m.facing = "S";
      else if (dx > 0) m.facing = "E";
      else if (dx < 0) m.facing = "W";
      m.x = next.x;
      m.y = next.y;
      // 踩中通道炸彈
      detonateBombsAt(m.x, m.y);
    }
    m.stepCd = MINO_STEP_CD;
  }

  function checkMinotaurHit() {
    if (!state || state.phase !== "play") return;
    const p = state.player;
    if (p.invuln > 0) return;
    if (p.x === state.mino.x && p.y === state.mino.y) {
      p.invuln = INVULN_TIME;
      state.shake = 0.35;
      playHit();
      if ((state.diamonds || 0) > 0) {
        state.diamonds -= 1;
        updateHUD();
        showToast("💎 鑽石抵擋牛擊！剩 " + state.diamonds + " 顆", 1300);
        return;
      }
      state.hearts -= 1;
      updateHUD();
      showToast("牛頭怪撞擊！−1♡", 1200);
      if (state.hearts <= 0) {
        endLose("生命耗盡…被牛頭怪追上了");
      }
    }
  }

  function peekZone(zone) {
    if (!state || state.phase !== "play") return;
    if (zone < 0 || zone > 3) return;
    if (state.hearts <= 0) return;
    if (state.peek.t > 0) {
      showToast("路徑顯示中…", 600);
      return;
    }
    state.hearts -= 1;
    state.peek.zone = zone;
    state.peek.t = PEEK_DURATION;
    playPeek();
    updateHUD();
    showToast("顯示「" + ZONE_NAMES[zone] + "」區路徑 1 秒（−1♡）", 1100);
    if (state.hearts <= 0) {
      // peek spent last heart — lose after peek fades unless they exit
      // allow peek to finish; lose checked when peek ends if still 0 and not won
    }
  }

  function endWin() {
    if (!state || state.phase === "win") return;
    state.phase = "win";
    state.coinsCount += 15;
    playWinFanfare();
    writeSave({
      heartsBanked: state.hearts,
      coins: state.coinsCount,
      level1Cleared: true,
      level2Cleared: true,
      level3Cleared: true,
      level4Cleared: true,
      goldenArmor: true,
      skyChariotKey: true,
    });
    cancelAnimationFrame(raf);
    showToast("獲得金鎖匙！開啟巡天飛天馬車", 2200);
    setTimeout(() => {
      if (winCoinsEl) winCoinsEl.textContent = String(state.coinsCount);
      if (winHeartsEl) winHeartsEl.textContent = String(state.hearts);
      const keyImg = document.getElementById("l4-win-key");
      if (keyImg) keyImg.src = `assets/sky-chariot-gold-key.png?v=${CACHE_V}`;
      showScreen(screens.winL4);
      refreshMenuButtons();
    }, 500);
  }

  function endLose(reason) {
    if (!state || state.phase === "lose" || state.phase === "win") return;
    state.phase = "lose";
    const prev = loadSave();
    writeSave({
      heartsBanked: prev.heartsBanked,
      coins: prev.coins,
      level1Cleared: prev.level1Cleared,
      level2Cleared: prev.level2Cleared,
      level3Cleared: prev.level3Cleared,
      level4Cleared: prev.level4Cleared,
      goldenArmor: prev.goldenArmor,
      skyChariotKey: prev.skyChariotKey,
    });
    cancelAnimationFrame(raf);
    if (loseReason) loseReason.textContent = reason || "挑戰失敗";
    showScreen(screens.loseL4);
  }

  function update(dt) {
    if (!state || state.phase !== "play") return;
    state.worldTime += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endLose("時間到！未能逃出黃金迷宮");
      return;
    }

    if (state.player.stepCd > 0) state.player.stepCd -= dt;
    if (state.player.invuln > 0) state.player.invuln -= dt;
    if (state.shake > 0) state.shake -= dt;
    if (state.peek.t > 0) {
      state.peek.t -= dt;
      if (state.peek.t <= 0) {
        state.peek.t = 0;
        state.peek.zone = -1;
        if (state.hearts <= 0) {
          endLose("生命耗盡…");
          return;
        }
      }
    }

    applyMoveFromKeys();
    updateMinotaur(dt);
    checkMinotaurHit();

    // Soft-lock: no legal moves and not on exit
    const onExit =
      state.player.x === state.maze.exit.x && state.player.y === state.maze.exit.y;
    if (!onExit && legalPlayerMoves().length === 0) {
      state.softlockT += dt;
      if (state.softlockT > 0.4 && state.softlockT < 0.4 + dt + 0.01) {
        showToast("無路可退！退路已全部封印…", 1600);
      }
      if (state.softlockT >= SOFTLOCK_LOSE_AFTER) {
        endLose("無路可退，迷宮封印了你的退路！");
        return;
      }
    } else {
      state.softlockT = 0;
    }

    // Camera follow
    const { W, H } = getViewSize();
    const mazePx = GRID * CELL;
    const targetCX = state.player.x * CELL + CELL / 2 - W / 2;
    const targetCY = state.player.y * CELL + CELL / 2 - H / 2;
    const maxX = Math.max(0, mazePx - W);
    const maxY = Math.max(0, mazePx - H);
    state.camera.x += (Math.max(0, Math.min(maxX, targetCX)) - state.camera.x) * Math.min(1, dt * 8);
    state.camera.y += (Math.max(0, Math.min(maxY, targetCY)) - state.camera.y) * Math.min(1, dt * 8);

    updateHUD();
  }

  // --- Render ---
  function cellScreen(x, y) {
    return {
      sx: x * CELL - state.camera.x,
      sy: y * CELL - state.camera.y,
    };
  }

  function render() {
    if (!ctx || !state) return;
    const { W, H } = getViewSize();
    ctx.clearRect(0, 0, W, H);

    let shakeX = 0;
    let shakeY = 0;
    if (state.shake > 0) {
      shakeX = (Math.random() - 0.5) * 8 * state.shake;
      shakeY = (Math.random() - 0.5) * 8 * state.shake;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Palace vibe background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3e2723");
    g.addColorStop(0.4, "#5d4037");
    g.addColorStop(1, "#1a120e");
    ctx.fillStyle = g;
    ctx.fillRect(-4, -4, W + 8, H + 8);

    if (imgReady(palaceBgImg)) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(palaceBgImg, -state.camera.x * 0.15, -state.camera.y * 0.1, W * 1.3, H * 1.3);
      ctx.globalAlpha = 1;
    }

    // Visible cell range
    const x0 = Math.max(0, Math.floor(state.camera.x / CELL) - 1);
    const y0 = Math.max(0, Math.floor(state.camera.y / CELL) - 1);
    const x1 = Math.min(GRID - 1, Math.ceil((state.camera.x + W) / CELL) + 1);
    const y1 = Math.min(GRID - 1, Math.ceil((state.camera.y + H) / CELL) + 1);

    // Floor / walls
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const { sx, sy } = cellScreen(x, y);
        const sealed = state.sealed.has(keyOf(x, y));
        if (isWall(state.maze.wall, x, y)) {
          // Golden palace wall bricks
          const wg = ctx.createLinearGradient(sx, sy, sx + CELL, sy + CELL);
          wg.addColorStop(0, "#c9a227");
          wg.addColorStop(0.5, "#8d6e1a");
          wg.addColorStop(1, "#5c4408");
          ctx.fillStyle = wg;
          ctx.fillRect(sx, sy, CELL + 0.5, CELL + 0.5);
          ctx.strokeStyle = "rgba(255, 236, 179, 0.35)";
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, CELL - 1, CELL - 1);
        } else if (sealed) {
          // Sealed corridor behind player — darkened gold seal
          ctx.fillStyle = "#2a1f0e";
          ctx.fillRect(sx, sy, CELL + 0.5, CELL + 0.5);
          ctx.fillStyle = "rgba(184, 134, 11, 0.55)";
          ctx.fillRect(sx + 2, sy + 2, CELL - 4, CELL - 4);
          ctx.strokeStyle = "rgba(255, 215, 0, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 3, sy + 3, CELL - 6, CELL - 6);
          // seal glyph
          ctx.fillStyle = "rgba(255, 215, 0, 0.85)";
          ctx.font = "bold 12px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("封印", sx + CELL / 2, sy + CELL / 2);
        } else {
          // Open floor — warm marble
          const odd = (x + y) % 2 === 0;
          ctx.fillStyle = odd ? "#f3e5ab" : "#e8d48b";
          ctx.fillRect(sx, sy, CELL + 0.5, CELL + 0.5);
          ctx.strokeStyle = "rgba(121, 85, 72, 0.15)";
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, CELL - 1, CELL - 1);
        }
      }
    }

    // Zone quadrant guides — clear 4-zone composition (NW/NE/SW/SE)
    const mid = (GRID - 1) / 2;
    const mz = cellScreen(mid + 0.5, mid + 0.5);
    // Soft tint per quadrant so layout reads as 4 zones
    const half = (GRID - 1) / 2;
    const tint = [
      "rgba(100, 181, 246, 0.10)", // NW
      "rgba(255, 213, 79, 0.10)", // NE
      "rgba(129, 199, 132, 0.10)", // SW
      "rgba(240, 98, 146, 0.10)", // SE
    ];
    for (let z = 0; z < 4; z++) {
      const top = z < 2;
      const left = z % 2 === 0;
      const x0 = left ? 0 : Math.ceil(half + 0.01);
      const x1 = left ? Math.floor(half) : GRID - 1;
      const y0 = top ? 0 : Math.ceil(half + 0.01);
      const y1 = top ? Math.floor(half) : GRID - 1;
      const a = cellScreen(x0, y0);
      const b = cellScreen(x1, y1);
      ctx.fillStyle = tint[z];
      ctx.fillRect(a.sx, a.sy, b.sx + CELL - a.sx, b.sy + CELL - a.sy);
    }
    // Bold cross dividers
    ctx.strokeStyle = "rgba(255, 215, 0, 0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(mz.sx, -20);
    ctx.lineTo(mz.sx, H + 20);
    ctx.moveTo(-20, mz.sy);
    ctx.lineTo(W + 20, mz.sy);
    ctx.stroke();
    ctx.setLineDash([]);
    // Zone name badges
    const badges = [
      { z: 0, x: 1, y: 1, name: "①西北" },
      { z: 1, x: GRID - 3, y: 1, name: "②東北" },
      { z: 2, x: 1, y: GRID - 3, name: "③西南" },
      { z: 3, x: GRID - 3, y: GRID - 3, name: "④東南" },
    ];
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const b of badges) {
      const { sx, sy } = cellScreen(b.x, b.y);
      ctx.fillStyle = "rgba(62, 39, 35, 0.72)";
      ctx.fillRect(sx, sy, 52, 16);
      ctx.fillStyle = "#ffe082";
      ctx.fillText(b.name, sx + 3, sy + 2);
    }

    // Exit marker + 金鎖匙 prize
    {
      const e = state.maze.exit;
      const { sx, sy } = cellScreen(e.x, e.y);
      const glow = 0.55 + 0.25 * Math.sin(state.worldTime * 3);
      ctx.fillStyle = `rgba(76, 175, 80, ${0.55 + glow * 0.25})`;
      ctx.fillRect(sx + 1, sy + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, CELL - 4, CELL - 4);
      if (imgReady(goldKeyImg)) {
        const kw = CELL * 1.35;
        const kh = kw * (goldKeyImg.naturalHeight / Math.max(1, goldKeyImg.naturalWidth));
        ctx.save();
        ctx.translate(sx + CELL / 2, sy + CELL / 2);
        ctx.rotate(-0.35 + Math.sin(state.worldTime * 2) * 0.08);
        ctx.drawImage(goldKeyImg, -kw / 2, -kh / 2, kw, kh);
        ctx.restore();
      } else {
        ctx.fillStyle = "#ffd54f";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("鎖匙", sx + CELL / 2, sy + CELL / 2);
      }
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("E出口", sx + CELL / 2, sy + CELL - 11);
    }

    // Coins / treasure chest / ♡ / 💎
    for (const c of state.coins) {
      if (c.taken) continue;
      const { sx, sy } = cellScreen(c.x, c.y);
      if (c.treasure) {
        if (imgReady(treasureChestImg)) {
          const dw = CELL * 1.15;
          const dh = dw * (treasureChestImg.naturalHeight / Math.max(1, treasureChestImg.naturalWidth));
          ctx.drawImage(treasureChestImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = "#6d4c41";
          ctx.fillRect(sx + 4, sy + 8, CELL - 8, CELL - 12);
          ctx.fillStyle = "#ffd54f";
          ctx.fillRect(sx + 4, sy + 8, CELL - 8, 5);
          ctx.fillStyle = "#fffde7";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("寶箱", sx + CELL / 2, sy + CELL / 2 + 4);
        }
      } else if (c.kind === "lifeChest") {
        if (imgReady(treasureChestImg)) {
          const dw = CELL * 1.1;
          const dh = dw * (treasureChestImg.naturalHeight / Math.max(1, treasureChestImg.naturalWidth));
          ctx.drawImage(treasureChestImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = "#c62828";
          ctx.fillRect(sx + 4, sy + 8, CELL - 8, CELL - 12);
        }
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("♡", sx + CELL / 2, sy + CELL / 2 + 2);
        ctx.strokeStyle = "rgba(229, 57, 53, 0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 3, sy + 3, CELL - 6, CELL - 6);
      } else if (c.kind === "heart") {
        ctx.fillStyle = "#e53935";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("♡", sx + CELL / 2, sy + CELL / 2);
      } else if (c.kind === "diamond") {
        ctx.fillStyle = "#29b6f6";
        ctx.beginPath();
        const cx0 = sx + CELL / 2;
        const cy0 = sy + CELL / 2;
        ctx.moveTo(cx0, cy0 - 8);
        ctx.lineTo(cx0 + 7, cy0);
        ctx.lineTo(cx0, cy0 + 8);
        ctx.lineTo(cx0 - 7, cy0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (c.kind === "spring") {
        if (typeof lifeSpringImg !== "undefined" && imgReady(lifeSpringImg)) {
          const dw = CELL * 0.95;
          const dh = dw * (lifeSpringImg.naturalHeight / Math.max(1, lifeSpringImg.naturalWidth));
          ctx.drawImage(lifeSpringImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = "#4fc3f7";
          ctx.beginPath();
          ctx.arc(sx + CELL / 2, sy + CELL / 2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("泉", sx + CELL / 2, sy + CELL / 2);
        }
      } else if (c.kind === "hammer") {
        if (imgReady(goldHammerImg)) {
          const dw = CELL * 1.05;
          const dh = dw * (goldHammerImg.naturalHeight / Math.max(1, goldHammerImg.naturalWidth));
          ctx.drawImage(goldHammerImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = "#ffd54f";
          ctx.font = "bold 15px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🔨", sx + CELL / 2, sy + CELL / 2);
        }
      } else if (c.kind === "drill") {
        if (typeof wallDrillImg !== "undefined" && imgReady(wallDrillImg)) {
          const dw = CELL * 1.0;
          const dh = dw * (wallDrillImg.naturalHeight / Math.max(1, wallDrillImg.naturalWidth));
          ctx.drawImage(wallDrillImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = "#90a4ae";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("鑽", sx + CELL / 2, sy + CELL / 2);
        }
      } else if (c.kind === "bomb") {
        if (typeof mazeBombImg !== "undefined" && imgReady(mazeBombImg)) {
          const dw = CELL * 1.05;
          const dh = dw * (mazeBombImg.naturalHeight / Math.max(1, mazeBombImg.naturalWidth));
          ctx.drawImage(mazeBombImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = "#212121";
          ctx.beginPath();
          ctx.arc(sx + CELL / 2, sy + CELL / 2 + 1, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffd54f";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("彈", sx + CELL / 2, sy + CELL / 2 + 1);
        }
      } else {
        ctx.beginPath();
        ctx.arc(sx + CELL / 2, sy + CELL / 2, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd54f";
        ctx.fill();
        ctx.strokeStyle = "#f57f17";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Peek solution path (dashed) in zone
    if (state.peek.t > 0 && state.peek.zone >= 0 && state.solution.length > 1) {
      const alpha = Math.min(1, state.peek.t / 0.25) * Math.min(1, (PEEK_DURATION - state.peek.t + 0.25) > 0 ? 1 : state.peek.t);
      const fade = Math.min(1, state.peek.t * 2); // fade last 0.5s roughly via t
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.55 * Math.min(1, state.peek.t / 0.3);
      ctx.strokeStyle = "#e53935";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < state.solution.length; i++) {
        const p = state.solution[i];
        if (zoneOf(p.x, p.y) !== state.peek.zone) {
          started = false;
          continue;
        }
        const { sx, sy } = cellScreen(p.x, p.y);
        const cx = sx + CELL / 2;
        const cy = sy + CELL / 2;
        if (!started) {
          ctx.moveTo(cx, cy);
          started = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();
      // also connect edges that cross into zone from adjacent solution points
      ctx.beginPath();
      started = false;
      for (let i = 0; i < state.solution.length - 1; i++) {
        const a = state.solution[i];
        const b = state.solution[i + 1];
        const za = zoneOf(a.x, a.y);
        const zb = zoneOf(b.x, b.y);
        if (za !== state.peek.zone && zb !== state.peek.zone) {
          started = false;
          continue;
        }
        if (za !== state.peek.zone && zb === state.peek.zone) {
          // draw segment entering zone
          const sa = cellScreen(a.x, a.y);
          const sb = cellScreen(b.x, b.y);
          ctx.moveTo(sa.sx + CELL / 2, sa.sy + CELL / 2);
          ctx.lineTo(sb.sx + CELL / 2, sb.sy + CELL / 2);
          started = false;
          continue;
        }
        if (za === state.peek.zone) {
          const sa = cellScreen(a.x, a.y);
          const sb = cellScreen(b.x, b.y);
          if (!started) {
            ctx.moveTo(sa.sx + CELL / 2, sa.sy + CELL / 2);
            started = true;
          }
          ctx.lineTo(sb.sx + CELL / 2, sb.sy + CELL / 2);
          if (zb !== state.peek.zone) started = false;
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Placed bombs on path
    for (const b of state.placedBombs || []) {
      if (b.blown) continue;
      const { sx, sy } = cellScreen(b.x, b.y);
      const pulse = 0.85 + Math.sin(state.worldTime * 8) * 0.15;
      ctx.save();
      ctx.globalAlpha = pulse;
      if (typeof mazeBombImg !== "undefined" && imgReady(mazeBombImg)) {
        const dw = CELL * 0.95;
        const dh = dw * (mazeBombImg.naturalHeight / Math.max(1, mazeBombImg.naturalWidth));
        ctx.drawImage(mazeBombImg, sx + (CELL - dw) / 2, sy + (CELL - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = "#212121";
        ctx.beginPath();
        ctx.arc(sx + CELL / 2, sy + CELL / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffea00";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💣", sx + CELL / 2, sy + CELL / 2 + 1);
      }
      ctx.restore();
    }

    // Minotaur
    {
      const m = state.mino;
      const { sx, sy } = cellScreen(m.x, m.y);
      const bounce = Math.sin(state.worldTime * 6) * 1.5;
      if (imgReady(minotaurImg)) {
        const h = CELL * 1.15;
        const aspect = minotaurImg.naturalWidth / minotaurImg.naturalHeight;
        const w = h * aspect * 0.85;
        ctx.drawImage(minotaurImg, sx + CELL / 2 - w / 2, sy + CELL / 2 - h / 2 + bounce - 2, w, h);
        if (m.stunT > 0) {
          ctx.fillStyle = "rgba(100, 180, 255, 0.35)";
          ctx.fillRect(sx + 2, sy + 2, CELL - 4, CELL - 4);
          ctx.fillStyle = "#e3f2fd";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("Zz " + Math.ceil(m.stunT) + "s", sx + CELL / 2, sy + 2);
        }
      } else {
        ctx.fillStyle = "#f9a825";
        ctx.beginPath();
        ctx.arc(sx + CELL / 2, sy + CELL / 2 + bounce, CELL * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5d4037";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("M", sx + CELL / 2, sy + CELL / 2 + 3);
      }
    }

    // Player angel
    {
      const p = state.player;
      const { sx, sy } = cellScreen(p.x, p.y);
      const flash = p.invuln > 0 && Math.floor(state.worldTime * 16) % 2 === 0;
      if (!flash) {
        const img = angelSprite(p.gender);
        const h = CELL * 1.05;
        if (imgReady(img)) {
          const aspect = img.naturalWidth / img.naturalHeight;
          const w = h * Math.min(aspect, 0.85);
          ctx.save();
          // face direction: flip for W
          if (p.facing === "W") {
            ctx.translate(sx + CELL / 2, sy + CELL / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(img, -w / 2, -h / 2 - 2, w, h);
          } else {
            ctx.drawImage(img, sx + CELL / 2 - w / 2, sy + CELL / 2 - h / 2 - 2, w, h);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = "#fff59d";
          ctx.beginPath();
          ctx.arc(sx + CELL / 2, sy + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        // facing chevron
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        const cx = sx + CELL / 2;
        const cy = sy + 4;
        ctx.beginPath();
        if (p.facing === "N") {
          ctx.moveTo(cx, cy - 2);
          ctx.lineTo(cx - 4, cy + 4);
          ctx.lineTo(cx + 4, cy + 4);
        } else if (p.facing === "S") {
          ctx.moveTo(cx, sy + CELL - 2);
          ctx.lineTo(cx - 4, sy + CELL - 8);
          ctx.lineTo(cx + 4, sy + CELL - 8);
        } else if (p.facing === "E") {
          ctx.moveTo(sx + CELL - 2, sy + CELL / 2);
          ctx.lineTo(sx + CELL - 8, sy + CELL / 2 - 4);
          ctx.lineTo(sx + CELL - 8, sy + CELL / 2 + 4);
        } else {
          ctx.moveTo(sx + 2, sy + CELL / 2);
          ctx.lineTo(sx + 8, sy + CELL / 2 - 4);
          ctx.lineTo(sx + 8, sy + CELL / 2 + 4);
        }
        ctx.fill();
      }
    }

    ctx.restore();

    // Soft vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(30, 18, 8, 0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(0.05, dt);
    update(dt);
    render();
    if (state && state.phase !== "win" && state.phase !== "lose") {
      raf = requestAnimationFrame(loop);
    }
  }

  function stopLevel4() {
    cancelAnimationFrame(raf);
    raf = 0;
    state = null;
  }

  function startLevel4() {
    ensureAudio();
    if (window.FeishengLevel3 && typeof window.FeishengLevel3.stop === "function") {
      window.FeishengLevel3.stop();
    }
    if (window.FeishengLevel2 && typeof window.FeishengLevel2.stop === "function") {
      window.FeishengLevel2.stop();
    }
    if (window.FeishengL1 && typeof window.FeishengL1.stop === "function") {
      window.FeishengL1.stop();
    }
    showScreen(screens.gameL4);
    resizeCanvas();
    state = createState();
    // 若手搥喺起點格，開局即拎
    collectPickupsAt(state.player.x, state.player.y, { silent: true });
    updateHUD();
    if (failToast) failToast.classList.add("hidden");
    lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    showToast("開局旁有金手搥🔨（每把破封印 3 次）· 只能向前 · 出口奪金鎖匙", 2600);
  }

  function goHome() {
    stopLevel4();
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
    if (!state || !screens.gameL4 || !screens.gameL4.classList.contains("active")) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      state.keys.up = true;
      if (!e.repeat) tryMovePlayer(0, -1, "N");
      e.preventDefault();
    }
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      state.keys.down = true;
      if (!e.repeat) tryMovePlayer(0, 1, "S");
      e.preventDefault();
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      state.keys.left = true;
      if (!e.repeat) tryMovePlayer(-1, 0, "W");
      e.preventDefault();
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      state.keys.right = true;
      if (!e.repeat) tryMovePlayer(1, 0, "E");
      e.preventDefault();
    }
    // Peek hotkeys 1–4
    if (e.code === "Digit1" || e.code === "Numpad1") {
      peekZone(0);
      e.preventDefault();
    }
    if (e.code === "Digit2" || e.code === "Numpad2") {
      peekZone(1);
      e.preventDefault();
    }
    if (e.code === "Digit3" || e.code === "Numpad3") {
      peekZone(2);
      e.preventDefault();
    }
    if (e.code === "Digit4" || e.code === "Numpad4") {
      peekZone(3);
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (!state) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") state.keys.up = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") state.keys.down = false;
    if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = false;
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
    document.getElementById("btn-l4-up"),
    () => {
      if (!state) return;
      state.keys.up = true;
      tryMovePlayer(0, -1, "N");
    },
    () => state && (state.keys.up = false)
  );
  bindHold(
    document.getElementById("btn-l4-down"),
    () => {
      if (!state) return;
      state.keys.down = true;
      tryMovePlayer(0, 1, "S");
    },
    () => state && (state.keys.down = false)
  );
  bindHold(
    document.getElementById("btn-l4-left"),
    () => {
      if (!state) return;
      state.keys.left = true;
      tryMovePlayer(-1, 0, "W");
    },
    () => state && (state.keys.left = false)
  );
  bindHold(
    document.getElementById("btn-l4-right"),
    () => {
      if (!state) return;
      state.keys.right = true;
      tryMovePlayer(1, 0, "E");
    },
    () => state && (state.keys.right = false)
  );

  ["nw", "ne", "sw", "se"].forEach((id, i) => {
    const btn = document.getElementById("btn-l4-peek-" + id);
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        peekZone(i);
      });
    }
  });

  const btnStartL4 = document.getElementById("btn-start-l4");
  const btnBuyHammer = document.getElementById("btn-l4-buy-hammer");
  if (btnBuyHammer) {
    btnBuyHammer.addEventListener("click", (e) => {
      e.preventDefault();
      buyHammerWithHeart();
    });
  }
  const btnBuyDrill = document.getElementById("btn-l4-buy-drill");
  if (btnBuyDrill) {
    btnBuyDrill.addEventListener("click", (e) => {
      e.preventDefault();
      buyDrillWithHeart();
    });
  }
  const btnDrill = document.getElementById("btn-l4-drill");
  if (btnDrill) {
    btnDrill.addEventListener("click", (e) => {
      e.preventDefault();
      drillSolidWall();
    });
  }
  const btnDrillPad = document.getElementById("btn-l4-drill-pad");
  if (btnDrillPad) {
    btnDrillPad.addEventListener("click", (e) => {
      e.preventDefault();
      drillSolidWall();
    });
  }
  const btnPlaceBomb = document.getElementById("btn-l4-place-bomb");
  if (btnPlaceBomb) {
    btnPlaceBomb.addEventListener("click", (e) => {
      e.preventDefault();
      placeBombOnPath();
    });
  }
  const btnBombPad = document.getElementById("btn-l4-bomb-pad");
  if (btnBombPad) {
    btnBombPad.addEventListener("click", (e) => {
      e.preventDefault();
      placeBombOnPath();
    });
  }
  // 鍵盤 F / 空白：鑿面前實牆
  window.addEventListener("keydown", (e) => {
    if (!state || state.phase !== "play") return;
    if (e.code === "KeyF" || e.code === "Space") {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      // Space already used? only F for drill to avoid conflict — Space often jump elsewhere
      if (e.code === "KeyF") {
        e.preventDefault();
        drillSolidWall();
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        placeBombOnPath();
      }
    }
  });

  if (btnStartL4) btnStartL4.addEventListener("click", startLevel4);
  const btnEnterL4 = document.getElementById("btn-enter-l4");
  if (btnEnterL4) btnEnterL4.addEventListener("click", startLevel4);
  const btnReplayL4 = document.getElementById("btn-replay-l4");
  if (btnReplayL4) btnReplayL4.addEventListener("click", startLevel4);
  const btnReplayL4Lose = document.getElementById("btn-replay-l4-lose");
  if (btnReplayL4Lose) btnReplayL4Lose.addEventListener("click", startLevel4);
  const btnHomeL4 = document.getElementById("btn-home-l4");
  if (btnHomeL4) btnHomeL4.addEventListener("click", goHome);
  const btnHomeL4Lose = document.getElementById("btn-home-l4-lose");
  if (btnHomeL4Lose) btnHomeL4Lose.addEventListener("click", goHome);

  window.addEventListener("resize", () => {
    if (!screens.gameL4 || !screens.gameL4.classList.contains("active") || !state) return;
    resizeCanvas();
  });

  window.FeishengLevel4 = {
    start: startLevel4,
    stop: stopLevel4,
    loadSave,
    writeSave,
    refreshMenuButtons,
  };

  refreshMenuButtons();
})();
