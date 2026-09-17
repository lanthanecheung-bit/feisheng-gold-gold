/**
 * 飛升 Gold Gold! — Level 3
 * Climb the Tree of Life by placing golden brick ladder steps;
 * dodge red fire dragons; rebuild melted bricks; reach the golden palace
 * and claim 永恆生命泉水.
 */
(() => {
  "use strict";

  const SAVE_KEY = "feishengGoldGold.save";
  const START_HEARTS = 3;
  const GOLD_APPLE_HEARTS = 1; // 樹枝金蘋果補生命
  const MAX_HEARTS = 12;
  const LEVEL_TIME = 300; // 5 minutes
  const GOAL_H = 110; // brick steps to palace (~5 min with rebuild delays)
  const BRICK_STEP = 44; // world px between steps
  const BUILD_CD = 0.28;
  const MOVE_SPEED = 3.2; // steps per second when climbing
  const FALL_SPEED = 9;
  const REBUILD_URGENCY = 2.2; // seconds after standing brick melts before fall
  const DRAGON_COUNT = 3;
  const CACHE_V = "1789586200";
  const CHAR_SCALE = 0.7;
  const ANGEL_DRAW_H = 52;
  const SIDE_OFFSET = 42; // px left/right of trunk center per side unit
  const TRUNK_W = 56; // narrowed Jianmu body
  const MELT_ANIM = 0.95;
  const FIRE_MELT_RADIUS = 1.15; // step distance
  const FIRE_JET_LIFE = 1.2;
  const BRANCH_LEAF_DENSE = 1; // lush foliage on obstacle branches
  const CLIMB_STEP_CD = 0.2; // discrete step onto next brick
  const BRICK_H = 14; // gold brick draw height (feet on top)

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
    gameL3: document.getElementById("level3-screen"),
    winL3: document.getElementById("win-screen-l3"),
    loseL3: document.getElementById("lose-screen-l3"),
  };

  const canvas = document.getElementById("level3-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const livesEl = document.getElementById("l3-lives");
  const coinsEl = document.getElementById("l3-coins");
  const timerEl = document.getElementById("l3-timer");
  const progressEl = document.getElementById("l3-progress");
  const bricksEl = document.getElementById("l3-bricks");
  const failToast = document.getElementById("l3-fail-toast");
  const winCoinsEl = document.getElementById("l3-win-coins");
  const winHeartsEl = document.getElementById("l3-win-hearts");
  const loseReason = document.getElementById("l3-lose-reason");

  const angelBoyImg = new Image();
  angelBoyImg.src = `assets/angel-boy.png?v=${CACHE_V}`;
  const angelGirlImg = new Image();
  angelGirlImg.src = `assets/angel-girl.png?v=${CACHE_V}`;
  const angelBoyGoldImg = new Image();
  angelBoyGoldImg.src = `assets/angel-boy-gold.png?v=${CACHE_V}`;
  const angelGirlGoldImg = new Image();
  angelGirlGoldImg.src = `assets/angel-girl-gold.png?v=${CACHE_V}`;
  const fireDragonImg = new Image();
  fireDragonImg.src = `assets/fire-dragon.png?v=${CACHE_V}`;
  const treeOfLifeImg = new Image();
  treeOfLifeImg.src = `assets/tree-of-life.png?v=${CACHE_V}`;
  const birdNestImg = new Image();
  birdNestImg.src = `assets/bird-nest.png?v=${CACHE_V}`;
  const treeBranchImg = new Image();
  treeBranchImg.src = `assets/tree-branch.png?v=${CACHE_V}`;
  const goldAppleImg = new Image();
  goldAppleImg.src = `assets/gold-apple.png?v=${CACHE_V}`;
  const goldBrickImg = new Image();
  goldBrickImg.src = `assets/gold-brick.png?v=${CACHE_V}`;
  const treeHoleImg = new Image();
  treeHoleImg.src = `assets/tree-hole.png?v=${CACHE_V}`;
  const goldenPalaceImg = new Image();
  goldenPalaceImg.src = `assets/golden-palace.png?v=${CACHE_V}`;
  const eternalSpringImg = new Image();
  eternalSpringImg.src = `assets/eternal-spring.png?v=${CACHE_V}`;

  function imgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function useGoldArmor() {
    const save = loadSave();
    return !!save.goldenArmor || !!save.level2Cleared;
  }

  function angelSprite(gender) {
    const gold = useGoldArmor();
    if (gold) return gender === "girl" ? angelGirlGoldImg : angelBoyGoldImg;
    return gender === "girl" ? angelGirlImg : angelBoyImg;
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

  function playBuild() {
    playTone(520, 0.08, "triangle", 0.07);
    playTone(780, 0.1, "sine", 0.05);
  }
  function playMelt() {
    playTone(180, 0.25, "sawtooth", 0.06);
    playTone(90, 0.35, "square", 0.04);
  }
  function playFall() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.45);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.52);
  }
  function playDragon() {
    playTone(140, 0.2, "sawtooth", 0.05);
    playTone(220, 0.15, "square", 0.04);
  }
  function playWinFanfare() {
    const ac = ensureAudio();
    if (!ac) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      const t0 = ac.currentTime + i * 0.12;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.09, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  }
  function playTickLow() {
    playTone(880, 0.05, "square", 0.04);
  }

  // --- Canvas ---
  // CSS pixel size used by drawing (ctx is scaled by DPR). Never use canvas.width/height here.
  let viewCssW = 960;
  let viewCssH = 540;

  function getViewSize() {
    return { W: viewCssW, H: viewCssH };
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = document.getElementById("stage-wrap-l3");
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 960, height: 540 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.max(320, Math.floor(rect.width));
    const cssH = Math.max(280, Math.floor(rect.height));
    viewCssW = cssW;
    viewCssH = cssH;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let state = null;
  let raf = 0;
  let lastTs = 0;
  let tryStepUpToast = 0;

  function brickKey(h, side) {
    return `${Math.round(h)}:${side}`;
  }

  function getBrick(h, side) {
    if (!state) return null;
    return state.brickMap.get(brickKey(Math.round(h), side)) || null;
  }

  function addBrick(h, side) {
    const key = brickKey(h, side);
    if (state.brickMap.has(key)) return state.brickMap.get(key);
    const b = { h, side, melted: false, meltT: 0, burn: 0, dripSeed: 0, fresh: 0.25 };
    state.brickMap.set(key, b);
    state.bricksPlaced += 1;
    return b;
  }

  function isBlocked(h, side) {
    // Obstacles block placing/standing on that side at that height
    return state.obstacles.some(
      (o) => Math.round(o.h) === Math.round(h) && o.side === side
    );
  }

  function canStand(h, side) {
    if (isBlocked(Math.round(h), side)) return false;
    const b = getBrick(h, side);
    return b && !b.melted;
  }


  function isGrounded(p) {
    if (!p || p.falling) return false;
    const hi = Math.round(p.h);
    return canStand(hi, p.side) && Math.abs(p.h - hi) < 0.2;
  }

  function startFall(p) {
    if (!p || p.falling) return;
    p.falling = true;
    p.vy = Math.min(p.vy || 0, -0.5);
    p.fallUrgency = 0;
    state._fallStartH = p.h;
  }

  /** Side-step only onto a solid brick at the same height; empty air → fall. */
  function tryStepSide(delta) {
    if (!state || state.phase !== "play") return;
    const p = state.player;
    if (p.falling) return;
    const nh = Math.round(p.h);
    const ns = Math.max(-1, Math.min(1, p.side + delta));
    if (ns === p.side) return;
    if (canStand(nh, ns)) {
      p.side = ns;
      p.h = nh;
      p.displayH = nh;
      p.fallUrgency = 0;
    } else {
      // step off the ladder into empty air
      p.side = ns;
      startFall(p);
      showToast("腳下無金磚！", 900);
    }
  }

  function nearestStandable(fromH) {
    let best = null;
    let bestDist = 1e9;
    for (const b of state.brickMap.values()) {
      if (b.melted) continue;
      if (b.h > fromH + 0.2) continue;
      const d = fromH - b.h;
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }

  function makeObstacles() {
    const list = [];
    /**
     * Climb difficulty in 3 bands (by height %):
     *  0–30%: sparse branches/nests — tutorial weave
     *  30–60%: more 树洞 hollows
     *  60–80%: denser branches + nests
     *  80%+: branches linked with hollows (connected pairs)
     * Always leave ≥1 open lane at each row.
     */
    function pctOf(h) {
      return h / GOAL_H;
    }
    function sidesAt(hh) {
      const sides = new Set();
      for (const o of list) {
        if (Math.round(o.h) === Math.round(hh)) sides.add(o.side);
      }
      return sides;
    }
    function pushBranch(h, side, lean, opts) {
      opts = opts || {};
      const satellite = !!opts.satellite;
      // 部份主枝掛生命力金蘋果（衛星小枝唔掛）
      const goldApple = !satellite && Math.random() < 0.38;
      list.push({
        h,
        side,
        kind: "branch",
        lean: lean || (side >= 0 ? 1 : -1),
        leafScale: (opts.leafScale != null ? opts.leafScale : 1) * (0.85 + Math.random() * 0.4),
        curve: 0.5 + Math.random() * 0.5,
        satellite,
        onBranch: false,
        linked: !!opts.linked,
        goldApple,
        appleTaken: false,
      });
    }
    function pushNest(h, side, lean, onBranch) {
      list.push({
        h,
        side,
        kind: "nest",
        lean: lean != null ? lean : side === 0 ? 1 : side,
        onBranch: !!onBranch,
        linked: false,
      });
    }
    function pushHole(h, side, lean, linked) {
      const occ = sidesAt(h);
      if (occ.has(side) || occ.size >= 2) return false;
      // Keep ≥1 open lane
      const next = new Set(occ);
      next.add(side);
      if (next.size >= 3) return false;
      list.push({
        h,
        side,
        kind: "hole",
        lean: lean != null ? lean : side === 0 ? (Math.random() < 0.5 ? 1 : -1) : side,
        linked: !!linked,
      });
      return true;
    }

    let h = 6;
    let preferLean = 1;
    while (h < GOAL_H - 6) {
      const p = pctOf(h);
      // Step gap shrinks as you climb (more obstacles upward)
      let step;
      if (p < 0.3) step = 5 + Math.floor(Math.random() * 2); // 5–6
      else if (p < 0.6) step = 4 + Math.floor(Math.random() * 2); // 4–5
      else if (p < 0.8) step = 3 + Math.floor(Math.random() * 2); // 3–4
      else step = 2 + Math.floor(Math.random() * 2); // 2–3 — densest

      // How many sides to block with branch/nest (never all 3)
      let blocked;
      if (p < 0.3) {
        // Easy: mostly single center or one side
        blocked = Math.random() < 0.55 ? [0] : [preferLean];
      } else if (p < 0.6) {
        // Medium: center often, sometimes center+side
        blocked = Math.random() < 0.45 ? [0, preferLean] : [0];
      } else if (p < 0.8) {
        // Harder branches: often two sides
        blocked = Math.random() < 0.7 ? [0, preferLean] : [preferLean, 0];
      } else {
        // Top: two sides frequently; linked hole added below
        blocked = Math.random() < 0.85 ? [0, preferLean] : [preferLean];
      }
      preferLean *= -1;
      const lean = blocked.includes(-1) ? -1 : 1;

      // Nest chance rises with height
      const nestChance = p < 0.3 ? 0.35 : p < 0.6 ? 0.5 : p < 0.8 ? 0.7 : 0.85;
      const kind = Math.random() < nestChance ? (Math.random() < 0.4 ? "nest" : "branch") : "branch";

      for (let i = 0; i < blocked.length; i++) {
        const side = blocked[i];
        const isMain = i === 0;
        if (isMain && kind === "nest") {
          pushBranch(h, side, lean, { leafScale: 0.9, satellite: true });
          pushNest(h, side, lean, false);
        } else {
          pushBranch(h + (i === 1 ? 1 : 0), side, lean, { satellite: !isMain });
        }
      }
      if (kind === "branch" && Math.random() < nestChance) {
        const nestSide = blocked[blocked.length - 1];
        pushNest(h, nestSide, nestSide === 0 ? lean : nestSide, true);
      }

      // --- 30%+: more 树洞 ---
      if (p >= 0.3 && p < 0.8) {
        // Hole density: every ~other cluster at 30–60%, more at 60–80%
        const holeChance = p < 0.6 ? 0.55 : 0.35; // 60%+ focuses on branches; still some holes
        if (Math.random() < holeChance) {
          const occ = sidesAt(h);
          let holeSide = 0;
          if (occ.has(0)) {
            const open = [-1, 0, 1].filter((s) => !occ.has(s));
            if (open.length) holeSide = open[0];
            else holeSide = null;
          }
          if (holeSide != null) {
            // Prefer placing hole 1 step off the branch row so weave is clear
            const hh = h + (Math.random() < 0.5 ? 0 : 1);
            pushHole(hh, holeSide, holeSide === 0 ? lean : holeSide, false);
          }
        }
      }

      // Extra holes band 30–60%: dedicated denser hollows between clusters
      if (p >= 0.3 && p < 0.6 && Math.random() < 0.4) {
        const mid = h + Math.floor(step / 2);
        const open = [-1, 0, 1].filter((s) => !sidesAt(mid).has(s));
        if (open.length) {
          const hs = open.includes(0) ? 0 : open[Math.floor(Math.random() * open.length)];
          pushHole(mid, hs, hs === 0 ? preferLean : hs, false);
        }
      }

      // --- 60%+: extra branch satellite / second nest ---
      if (p >= 0.6 && Math.random() < 0.55) {
        const extraSide = preferLean;
        if (!sidesAt(h + 1).has(extraSide) && sidesAt(h + 1).size < 2) {
          pushBranch(h + 1, extraSide, extraSide, { leafScale: 0.85, satellite: false });
          if (Math.random() < 0.5) pushNest(h + 1, extraSide, extraSide, true);
        }
      }

      // --- 80%+: 樹枝樹洞連接 — linked branch + hole pair ---
      if (p >= 0.8) {
        const linkLean = lean;
        // Hole on center (or free lane), branch growing from adjacent side same/near height
        const occ = sidesAt(h);
        let holeSide = [0, -1, 1].find((s) => !occ.has(s));
        if (holeSide != null && sidesAt(h).size < 2) {
          pushHole(h, holeSide, linkLean, true);
          // Connected branch on neighboring side at h or h+1
          const nbrs = [-1, 0, 1].filter((s) => s !== holeSide);
          let branchSide = nbrs.find((s) => !sidesAt(h).has(s) && s !== holeSide);
          if (branchSide == null) {
            branchSide = nbrs[0];
            // place one step up if same row full
            if (sidesAt(h).has(branchSide) || sidesAt(h).size >= 2) {
              if (!sidesAt(h + 1).has(branchSide) && sidesAt(h + 1).size < 2) {
                pushBranch(h + 1, branchSide, branchSide === 0 ? linkLean : branchSide, {
                  leafScale: 1.05,
                  linked: true,
                });
                pushNest(h + 1, branchSide, branchSide === 0 ? linkLean : branchSide, true);
              }
            } else {
              pushBranch(h, branchSide, branchSide === 0 ? linkLean : branchSide, {
                leafScale: 1.05,
                linked: true,
              });
              if (Math.random() < 0.75) {
                pushNest(h, branchSide, branchSide === 0 ? linkLean : branchSide, true);
              }
            }
          } else if (!sidesAt(h).has(branchSide) && sidesAt(h).size < 2) {
            pushBranch(h, branchSide, branchSide === 0 ? linkLean : branchSide, {
              leafScale: 1.05,
              linked: true,
            });
            pushNest(h, branchSide, branchSide === 0 ? linkLean : branchSide, true);
          }
          // Optional second hollow one step up toward the branch — reads as connected
          if (Math.random() < 0.45) {
            const h2 = h + 2;
            const open2 = [-1, 0, 1].filter((s) => !sidesAt(h2).has(s));
            if (open2.length && sidesAt(h2).size < 2) {
              const hs2 = open2.includes(holeSide) ? holeSide : open2[0];
              pushHole(h2, hs2, linkLean, true);
            }
          }
        }
      }

      h += step;
    }

    return list;
  }

  function makeDragons() {
    const ds = [];
    for (let i = 0; i < DRAGON_COUNT; i++) {
      ds.push({
        id: i,
        angle: (Math.PI * 2 * i) / DRAGON_COUNT,
        orbitR: 118 + i * 22,
        baseH: 18 + i * 28,
        speed: 0.55 + i * 0.12,
        breathCd: 3.5 + i * 1.8,
        breathing: 0,
        targetH: 0,
        targetSide: 0,
        fireX: 0,
        fireY: 0,
      });
    }
    return ds;
  }

  function createState() {
    const save = loadSave();
    const hearts = save.heartsBanked > 0 ? save.heartsBanked : START_HEARTS;
    const { W } = getViewSize();
    const st = {
      phase: "play",
      hearts,
      coins: save.coins || 0,
      timeLeft: LEVEL_TIME,
      gender: Math.random() < 0.5 ? "girl" : "boy",
      bricksPlaced: 0,
      brickMap: new Map(),
      obstacles: [],
      dragons: [],
      fires: [],
      particles: [],
      player: {
        h: 2,
        side: 0,
        displayH: 2,
        vy: 0,
        falling: false,
        fallUrgency: 0,
        invuln: 0,
        buildCd: 0,
        climbCd: 0,
        bob: 0,
        climbSlow: 0, // slows after rebuild
      },
      keys: { up: false, down: false, left: false, right: false, build: false },
      cameraY: 0,
      worldTime: 0,
      toastTimer: 0,
      winFlash: 0,
      trunkCx: W * 0.5,
    };
    // starter ladder
    for (let h = 0; h <= 3; h++) {
      const key = brickKey(h, 0);
      st.brickMap.set(key, { h, side: 0, melted: false, meltT: 0, burn: 0, dripSeed: 0, fresh: 0 });
      st.bricksPlaced += 1;
    }
    st.obstacles = makeObstacles();
    st.dragons = makeDragons();
    return st;
  }

  function updateHUD() {
    if (!state) return;
    if (livesEl) livesEl.textContent = heartIcons(state.hearts);
    if (coinsEl) coinsEl.textContent = String(state.coins);
    if (timerEl) {
      const t = Math.max(0, Math.ceil(state.timeLeft));
      const mm = Math.floor(t / 60);
      const ss = String(t % 60).padStart(2, "0");
      timerEl.textContent = `${mm}:${ss}`;
      timerEl.classList.toggle("urgent", t <= 30);
    }
    if (progressEl) {
      const pct = Math.min(100, Math.floor((state.player.h / GOAL_H) * 100));
      progressEl.textContent = `${pct}%`;
    }
    if (bricksEl) bricksEl.textContent = String(state.bricksPlaced);
  }

  function worldY(h) {
    return h * BRICK_STEP;
  }

  function sideX(side, W) {
    const cx = W * 0.5;
    return cx + side * SIDE_OFFSET;
  }

  // --- Build ---
  /** True if (h,side) touches any solid brick (4-neighbor + diagonals up). */
  function touchesSolidBrick(h, side) {
    const neighbors = [
      [h - 1, side],
      [h, side - 1],
      [h, side + 1],
      [h - 1, side - 1],
      [h - 1, side + 1],
      [h + 1, side],
      [h + 1, side - 1],
      [h + 1, side + 1],
    ];
    for (const [nh, ns] of neighbors) {
      if (ns < -1 || ns > 1) continue;
      const b = getBrick(nh, ns);
      if (b && !b.melted) return true;
    }
    return false;
  }

  /**
   * Weave-build: place ONE brick adjacent to the brick underfoot
   * (up / up-left / up-right, or same-level side-step). ◀▶ aim the lane.
   * Cannot place on branch/nest cells — must route around.
   */
  function tryBuild() {
    if (!state || state.phase !== "play") return false;
    const p = state.player;
    if (p.buildCd > 0 || p.falling) return false;

    const base = Math.round(p.h);
    const standSide = p.side;
    // Aim: hold ◀▶ while building to choose up-left / up-right; else straight up
    const aimLeft = !!state.keys.left;
    const aimRight = !!state.keys.right;

    const clampSide = (s) => Math.max(-1, Math.min(1, s));
    let candidates = [];
    if (aimLeft && !aimRight) {
      candidates = [
        { h: base + 1, side: clampSide(standSide - 1) },
        { h: base, side: clampSide(standSide - 1) },
        { h: base + 1, side: standSide },
        { h: base + 1, side: clampSide(standSide + 1) },
      ];
    } else if (aimRight && !aimLeft) {
      candidates = [
        { h: base + 1, side: clampSide(standSide + 1) },
        { h: base, side: clampSide(standSide + 1) },
        { h: base + 1, side: standSide },
        { h: base + 1, side: clampSide(standSide - 1) },
      ];
    } else {
      // Default: try up, then diagonals — weave when center blocked
      candidates = [
        { h: base + 1, side: standSide },
        { h: base + 1, side: clampSide(standSide - 1) },
        { h: base + 1, side: clampSide(standSide + 1) },
        { h: base, side: clampSide(standSide - 1) },
        { h: base, side: clampSide(standSide + 1) },
      ];
    }
    // Rebuild melted underfoot / adjacent first if glowing gap
    candidates.unshift(
      { h: base, side: standSide },
      { h: base + 1, side: standSide }
    );

    // Deduplicate while preserving order
    const seen = new Set();
    candidates = candidates.filter((c) => {
      const k = `${c.h}:${c.side}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let blockedHint = false;
    for (const c of candidates) {
      if (c.h < 0 || c.h > GOAL_H + 2) continue;
      if (c.side < -1 || c.side > 1) continue;
      if (isBlocked(c.h, c.side)) {
        blockedHint = true;
        continue;
      }
      const existing = getBrick(c.h, c.side);
      if (existing && !existing.melted) continue;

      // Must attach to the connected brick chain (piece-by-piece)
      const attached =
        (existing && existing.melted) ||
        touchesSolidBrick(c.h, c.side) ||
        (Math.abs(c.h - base) + Math.abs(c.side - standSide) <= 2 &&
          canStand(base, standSide));
      if (!attached) continue;
      if (Math.abs(c.h - p.h) > 2.2) continue;

      if (existing && existing.melted) {
        existing.melted = false;
        existing.meltT = 0;
        existing.burn = 0;
        existing.fresh = 0.3;
        p.buildCd = BUILD_CD;
        p.climbSlow = Math.max(p.climbSlow, 0.85);
        playBuild();
        showToast("金磚重建！攀升稍緩");
        spawnGoldSparks(sideX(c.side, getViewSize().W), worldY(c.h));
        updateHUD();
        return true;
      }

      addBrick(c.h, c.side);
      p.buildCd = BUILD_CD;
      p.climbSlow = Math.max(p.climbSlow, 0.35);
      playBuild();
      const dir =
        c.side < standSide ? "↖繞左" : c.side > standSide ? "↗繞右" : "↑向上";
      if (blockedHint || c.side !== standSide) {
        showToast(`砌磚 ${dir}（繞過樹枝／鳥巢）`, 700);
      }
      spawnGoldSparks(sideX(c.side, getViewSize().W), worldY(c.h));
      updateHUD();
      return true;
    }
    if (!tryBuild._lastFail || performance.now() - tryBuild._lastFail > 1200) {
      showToast(
        blockedHint
          ? "前方有樹枝／鳥巢！◀▶ 繞道再砌"
          : "此處無法砌磚（需貼著金磚一件搭一件）",
        1100
      );
      tryBuild._lastFail = performance.now();
    }
    return false;
  }

  function spawnGoldSparks(x, wy) {
    for (let i = 0; i < 8; i++) {
      state.particles.push({
        x,
        y: wy,
        vx: (Math.random() - 0.5) * 80,
        vy: Math.random() * 60 + 20,
        life: 0.4 + Math.random() * 0.3,
        color: Math.random() < 0.5 ? "#ffd700" : "#fff3a0",
        r: 2 + Math.random() * 3,
      });
    }
  }

  function meltBrickAt(h, side) {
    const b = getBrick(Math.round(h), side);
    if (!b || b.melted) return false;
    b.melted = true;
    b.meltT = MELT_ANIM;
    b.burn = 1;
    b.dripSeed = Math.random() * 1000;
    playMelt();
    const { W } = getViewSize();
    const bx = sideX(side, W);
    const by = worldY(h);
    // Burning embers + molten drips
    for (let i = 0; i < 18; i++) {
      const drip = i < 8;
      state.particles.push({
        x: bx + (Math.random() - 0.5) * 36,
        y: by + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * (drip ? 40 : 120),
        vy: drip ? -(20 + Math.random() * 50) : Math.random() * 50,
        life: drip ? 0.7 + Math.random() * 0.5 : 0.45 + Math.random() * 0.35,
        color: drip
          ? (Math.random() < 0.5 ? "#ff6d00" : "#ffab00")
          : (i % 3 === 0 ? "#fff59d" : "#ff3d00"),
        r: drip ? 2 + Math.random() * 3.5 : 2 + Math.random() * 5,
        drip: drip,
      });
    }
    // If player standing on it, start urgency
    const p = state.player;
    if (Math.abs(p.h - h) < 0.55 && p.side === side && !p.falling) {
      p.fallUrgency = REBUILD_URGENCY;
      showToast("金磚熔化！快重建／移動", 1600);
    }
    return true;
  }

  function loseHeart(reason) {
    if (!state || state.player.invuln > 0) return;
    state.hearts -= 1;
    state.player.invuln = 1.6;
    playFall();
    showToast(reason || "墮下 −1♡");
    updateHUD();
    if (state.hearts <= 0) {
      endLose("生命耗盡…墮下生命之樹");
      return;
    }
    // Respawn on nearest safe brick
    const safe = nearestStandable(state.player.h);
    if (safe) {
      state.player.h = safe.h;
      state.player.displayH = safe.h;
      state.player.side = safe.side;
    } else {
      state.player.h = 0;
      state.player.displayH = 0;
      state.player.side = 0;
      if (!getBrick(0, 0)) addBrick(0, 0);
    }
    state.player.falling = false;
    state.player.fallUrgency = 0;
    state.player.vy = 0;
  }

  function endWin() {
    state.phase = "win";
    state.coins += 12;
    playWinFanfare();
    const prevWin = loadSave();
    writeSave({
      heartsBanked: state.hearts,
      coins: state.coins,
      level1Cleared: true,
      level2Cleared: true,
      level3Cleared: true,
      level4Cleared: !!prevWin.level4Cleared,
      goldenArmor: true,
      skyChariotKey: !!prevWin.skyChariotKey,
    });
    cancelAnimationFrame(raf);
    setTimeout(() => {
      if (winCoinsEl) winCoinsEl.textContent = String(state.coins);
      if (winHeartsEl) winHeartsEl.textContent = String(state.hearts);
      showScreen(screens.winL3);
      refreshMenuButtons();
      const note = document.getElementById("l3-auto-l4-note");
      if (note) note.classList.remove("hidden");
      // Direct transition to Level 4
      setTimeout(() => {
        if (window.FeishengLevel4 && typeof window.FeishengLevel4.start === "function") {
          window.FeishengLevel4.start();
        }
      }, 900);
    }, 600);
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
    showScreen(screens.loseL3);
  }

  // --- Update ---
  function updateDragons(dt) {
    const p = state.player;
    const { W } = getViewSize();
    for (const d of state.dragons) {
      // Orbit around trunk, height tracks near player with offset
      d.angle += d.speed * dt;
      const track = p.h + Math.sin(state.worldTime * 0.3 + d.id) * 10 + d.baseH * 0.15;
      d.baseH += (track - d.baseH) * Math.min(1, dt * 0.35);
      d.x = W * 0.5 + Math.cos(d.angle) * d.orbitR;
      d.y = worldY(d.baseH) + Math.sin(d.angle * 2) * 18;

      d.breathCd -= dt;
      if (d.breathing > 0) {
        d.breathing -= dt;
        // Keep fire jet origin glued to dragon mouth
        for (const f of state.fires) {
          if (f.dragonId === d.id) {
            f.fromX = d.x;
            f.fromY = d.y;
          }
        }
        // Spew flame billows along the column
        if (Math.random() < 0.65) {
          const { W } = getViewSize();
          const tx = sideX(d.targetSide, W);
          const ty = worldY(d.targetH);
          const t = Math.random();
          state.particles.push({
            x: d.x + (tx - d.x) * t + (Math.random() - 0.5) * 18,
            y: d.y + (ty - d.y) * t + (Math.random() - 0.5) * 12,
            vx: (tx - d.x) * 0.15 + (Math.random() - 0.5) * 40,
            vy: (ty - d.y) * 0.15 + (Math.random() - 0.5) * 30,
            life: 0.25 + Math.random() * 0.35,
            color: Math.random() < 0.35 ? "#fff176" : (Math.random() < 0.5 ? "#ff6d00" : "#ff3d00"),
            r: 4 + Math.random() * 7,
            drip: false,
          });
        }
        // Melt bricks near fire target while roaring jet hits
        if (d.breathing < 0.95 && d.breathing > 0.12) {
          const th = Math.round(d.targetH);
          meltBrickAt(th, d.targetSide);
          // splash melt neighbors (fire column width)
          if (Math.random() < 0.12) meltBrickAt(th, d.targetSide === 0 ? -1 : 0);
          if (Math.random() < 0.08) meltBrickAt(th + (Math.random() < 0.5 ? -1 : 1), d.targetSide);
        }
      } else if (d.breathCd <= 0) {
        // Aim at a brick near player
        const aimH = Math.round(p.h + (Math.random() * 4 - 1));
        let aimSide = p.side;
        const candidates = [];
        for (const b of state.brickMap.values()) {
          if (b.melted) continue;
          if (Math.abs(b.h - aimH) <= 3) candidates.push(b);
        }
        if (candidates.length) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          d.targetH = pick.h;
          d.targetSide = pick.side;
        } else {
          d.targetH = Math.max(1, aimH);
          d.targetSide = aimSide;
        }
        d.breathing = FIRE_JET_LIFE;
        d.breathCd = 4.2 + Math.random() * 3.5 - Math.min(2, p.h / GOAL_H) * 1.5;
        playDragon();
        // Roaring fire COLUMN / jet (not a thin laser)
        state.fires.push({
          fromX: d.x,
          fromY: d.y,
          toH: d.targetH,
          toSide: d.targetSide,
          life: FIRE_JET_LIFE,
          maxLife: FIRE_JET_LIFE,
          seed: Math.random() * 1000,
          dragonId: d.id,
        });
      }
    }
  }

  function update(dt) {
    if (!state || state.phase === "win" || state.phase === "lose") return;
    state.worldTime += dt;
    const p = state.player;
    const { W, H } = getViewSize();

    // Timer
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endLose("時間到！未能到達樹頂宮殿");
      return;
    }
    if (state.timeLeft <= 10 && Math.floor(state.timeLeft * 2) !== Math.floor((state.timeLeft + dt) * 2)) {
      playTickLow();
    }

    if (p.invuln > 0) p.invuln -= dt;

    // 樹枝金蘋果：放大拾取範圍 — 同側或鄰側、高度差 ≤2
    for (const o of state.obstacles) {
      if (o.kind !== "branch" || !o.goldApple || o.appleTaken || o.satellite) continue;
      const dh = Math.abs(Math.round(p.h) - Math.round(o.h));
      if (dh > 2) continue;
      if (Math.abs(p.side - o.side) > 1) continue;
      o.appleTaken = true;
      state.hearts = Math.min(MAX_HEARTS, state.hearts + GOLD_APPLE_HEARTS);
      try { playTone(880, 0.08, "sine", 0.08); playTone(1175, 0.12, "sine", 0.06); } catch (_) {}
      showToast("金蘋果！生命力 ♡ +" + GOLD_APPLE_HEARTS, 1300);
      updateHUD();
      spawnGoldSparks(sideX(o.side, W), worldY(o.h));
    }

    if (p.buildCd > 0) p.buildCd -= dt;
    if (p.climbSlow > 0) p.climbSlow -= dt;
    p.bob += dt;

    // Side shift handled on keydown / touch (discrete); no per-frame spam

    // Build
    if (state.keys.build) {
      tryBuild();
    }

    // --- Platforming: feet must be on solid gold bricks (no mid-air hover) ---
    if (p.climbCd > 0) p.climbCd -= dt;

    if (!p.falling) {
      const standH = Math.round(p.h);
      const grounded = canStand(standH, p.side);

      if (grounded) {
        // Snap feet onto brick top — cannot linger between rungs
        p.h = standH;
        p.vy = 0;

        const wantUp = state.keys.up;
        const wantDown = state.keys.down;
        const stepCd = CLIMB_STEP_CD * (p.climbSlow > 0 ? 1.85 : 1);

        if (wantUp && p.climbCd <= 0) {
          let stepped = false;
          // Climb only onto an existing solid brick above (same side, then neighbors)
          for (const s of [p.side, -1, 0, 1]) {
            if (canStand(standH + 1, s)) {
              p.h = standH + 1;
              p.side = s;
              p.climbCd = stepCd;
              stepped = true;
              break;
            }
          }
          if (!stepped) {
            // Must place a gold brick (Space) then step onto it — no mid-air climb
            if (state.keys.build) {
              tryBuild();
              for (const s of [p.side, -1, 0, 1]) {
                if (canStand(standH + 1, s)) {
                  p.h = standH + 1;
                  p.side = s;
                  p.climbCd = stepCd;
                  stepped = true;
                  break;
                }
              }
            }
            if (!stepped && wantUp && (!tryStepUpToast || performance.now() - tryStepUpToast > 900)) {
              showToast("腳踏金磚才能上升 — 先砌磚", 900);
              tryStepUpToast = performance.now();
            }
          }
        }

        if (wantDown && p.climbCd <= 0 && standH > 0) {
          for (const s of [p.side, 0, -1, 1]) {
            if (canStand(standH - 1, s)) {
              p.h = standH - 1;
              p.side = s;
              p.climbCd = stepCd * 0.85;
              break;
            }
          }
        }

        // Melt coyote: brief rebuild window only when brick melted under feet
        if (p.fallUrgency > 0) {
          if (canStand(standH, p.side)) {
            p.fallUrgency = 0;
          } else {
            p.fallUrgency -= dt;
            if (p.fallUrgency <= 0) startFall(p);
          }
        }
      } else {
        // No solid brick under feet → fall (coyote only if melt urgency active)
        if (p.fallUrgency > 0) {
          p.fallUrgency -= dt;
          if (p.fallUrgency <= 0) startFall(p);
        } else {
          startFall(p);
        }
      }
    }

    // Falling with gravity — land only on solid bricks
    if (p.falling) {
      p.vy -= FALL_SPEED * dt;
      p.h += p.vy * dt;
      // Catch a brick while falling downward
      let landed = null;
      const from = Math.ceil(p.h + 0.05);
      const to = Math.floor(p.h - 0.05);
      for (let hi = from; hi >= to - 1; hi--) {
        for (const s of [p.side, 0, -1, 1]) {
          if (canStand(hi, s) && p.h <= hi + 0.2 && p.vy <= 0) {
            landed = { h: hi, side: s };
            break;
          }
        }
        if (landed) break;
      }
      if (landed) {
        const drop = state._fallStartH != null ? state._fallStartH - landed.h : 3;
        p.falling = false;
        p.h = landed.h;
        p.side = landed.side;
        p.vy = 0;
        p.fallUrgency = 0;
        if (drop >= 1.2) {
          loseHeart("墮下 −1♡");
        }
        state._fallStartH = null;
      } else if (p.h <= 0) {
        p.falling = false;
        p.h = 0;
        p.side = 0;
        p.vy = 0;
        if (!canStand(0, 0)) addBrick(0, 0);
        loseHeart("墮下 −1♡");
        state._fallStartH = null;
      }
    }

    // Visual follow — snap hard when planted so feet stay on bricks
    const follow = p.falling ? 10 : 22;
    p.displayH += (p.h - p.displayH) * Math.min(1, dt * follow);
    if (!p.falling && isGrounded(p) && Math.abs(p.displayH - p.h) < 0.05) p.displayH = p.h;

    // Camera follows player (CSS-pixel H via getViewSize — must match render)
    const targetCam = worldY(p.displayH) - H * 0.62;
    const camLerp = p.falling ? 3.2 : 7;
    state.cameraY += (targetCam - state.cameraY) * Math.min(1, dt * camLerp);
    if (state.cameraY < -40) state.cameraY = -40;

    // Brick melt / burn anim
    for (const b of state.brickMap.values()) {
      if (b.meltT > 0) b.meltT -= dt;
      if (b.burn > 0) b.burn = Math.max(0, b.burn - dt * 0.85);
      if (b.fresh > 0) b.fresh -= dt;
    }

    updateDragons(dt);

    // Fires life
    state.fires = state.fires.filter((f) => {
      f.life -= dt;
      return f.life > 0;
    });

    // Particles
    state.particles = state.particles.filter((pt) => {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy -= 40 * dt;
      return pt.life > 0;
    });

    // Win check — reach palace standing on a brick
    if (p.h >= GOAL_H - 0.5 && !p.falling && isGrounded(p)) {
      endWin();
      return;
    }

    updateHUD();
  }

  // --- Draw ---
  function worldToScreen(wy, H) {
    return H - (wy - state.cameraY);
  }

  function drawSky(W, H) {
    // 藍天白雲 — clear blue sky with fluffy white clouds
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4fc3f7");
    g.addColorStop(0.35, "#81d4fa");
    g.addColorStop(0.7, "#b3e5fc");
    g.addColorStop(1, "#e1f5fe");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soft sun glow (upper)
    const hx = W * 0.72;
    const hy = H * 0.12;
    const halo = ctx.createRadialGradient(hx, hy, 8, hx, hy, W * 0.4);
    halo.addColorStop(0, "rgba(255,255,255,0.55)");
    halo.addColorStop(0.4, "rgba(255,248,225,0.22)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // Fluffy white clouds (parallax drift)
    function puff(x, y, rx, ry, a) {
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.55, y + ry * 0.15, rx * 0.55, ry * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + rx * 0.5, y + ry * 0.1, rx * 0.6, ry * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const t = state.worldTime;
    for (let i = 0; i < 7; i++) {
      const speed = 8 + i * 3;
      const cx = ((i * 173 + t * speed) % (W + 220)) - 110;
      const cy = 28 + (i * 53) % Math.floor(H * 0.72);
      const rx = 48 + (i % 4) * 12;
      const ry = 16 + (i % 3) * 5;
      puff(cx, cy, rx, ry, 0.78 - (i % 3) * 0.08);
    }
  }

  function drawGround(W, H) {
    const gy = worldToScreen(0, H);
    if (gy < H + 80) {
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(0, gy, W, H - gy + 40);
      ctx.fillStyle = "#689f38";
      ctx.fillRect(0, gy - 14, W, 22);
      // grass tufts
      ctx.strokeStyle = "#558b2f";
      ctx.lineWidth = 2;
      for (let x = 0; x < W; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + 3, gy - 10);
        ctx.moveTo(x + 6, gy);
        ctx.lineTo(x + 4, gy - 12);
        ctx.stroke();
      }
    }
  }

  function drawTrunk(W, H) {
    const cx = W * 0.5;
    const topWy = worldY(GOAL_H + 8);
    const botWy = -140;
    const topSy = worldToScreen(topWy, H);
    const botSy = worldToScreen(botWy, H);

    // Always paint a full-height braided Jianmu trunk so it never "disappears"
    // even if the art asset fails to decode on mobile.
    const tw = TRUNK_W * 1.05;
    const strands = 6;
    for (let i = 0; i < strands; i++) {
      const t = i / (strands - 1);
      const phase = state.worldTime * 0.35 + i * 0.9;
      ctx.beginPath();
      const steps = 28;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const wy = botWy + (topWy - botWy) * u;
        const sy = worldToScreen(wy, H);
        const swirl = Math.sin(u * Math.PI * 5 + phase) * (tw * 0.22);
        const x = cx + (t - 0.5) * tw * 0.55 + swirl;
        if (s === 0) ctx.moveTo(x, sy);
        else ctx.lineTo(x, sy);
      }
      const g = ctx.createLinearGradient(cx - tw, 0, cx + tw, 0);
      g.addColorStop(0, "#3e2723");
      g.addColorStop(0.35, "#8d6e63");
      g.addColorStop(0.5, "#d7ccc8");
      g.addColorStop(0.65, "#6d4c41");
      g.addColorStop(1, "#2e1a14");
      ctx.strokeStyle = g;
      ctx.lineWidth = tw * 0.28;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.92;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Cyan crevice glow (建木)
    ctx.strokeStyle = "rgba(100, 220, 255, 0.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let s = 0; s <= 24; s++) {
      const u = s / 24;
      const wy = botWy + (topWy - botWy) * u;
      const sy = worldToScreen(wy, H);
      const x = cx + Math.sin(u * Math.PI * 5 + state.worldTime * 0.4) * tw * 0.12;
      if (s === 0) ctx.moveTo(x, sy);
      else ctx.lineTo(x, sy);
    }
    ctx.stroke();

    // Jianmu art plate — MUST cover full screen height (portrait asset)
    if (imgReady(treeOfLifeImg)) {
      const nw = treeOfLifeImg.naturalWidth || 1;
      const nh = treeOfLifeImg.naturalHeight || 1;
      const aspect = nw / nh;
      // Force taller than viewport so trunk body is always on-screen
      const drawH = Math.max(H * 2.15, Math.abs(botSy - topSy) * 0.45);
      // Keep approved Jianmu look but narrower (~48% screen width)
      const drawW = Math.min(Math.max(drawH * aspect, W * 0.38), W * 0.48);
      const climbT = Math.max(0, Math.min(1, (state.cameraY + 80) / Math.max(1, worldY(GOAL_H))));
      // Scroll art upward as player climbs; keep a thick band of trunk in view
      const y = -climbT * (drawH - H * 0.92) - H * 0.08;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(treeOfLifeImg, cx - drawW / 2, y, drawW, drawH);
      ctx.restore();

      // Soft side fade only
      const edge = ctx.createLinearGradient(0, 0, W, 0);
      edge.addColorStop(0, "rgba(179,229,252,0.35)");
      edge.addColorStop(0.18, "rgba(179,229,252,0)");
      edge.addColorStop(0.82, "rgba(179,229,252,0)");
      edge.addColorStop(1, "rgba(179,229,252,0.35)");
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, W, H);
    }

    // Sparse sparkles
    ctx.fillStyle = "rgba(140, 230, 255, 0.4)";
    for (let wy = 0; wy < worldY(GOAL_H); wy += 100) {
      const sy = worldToScreen(wy, H);
      if (sy < -20 || sy > H + 20) continue;
      ctx.globalAlpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(state.worldTime * 2 + wy * 0.04));
      ctx.beginPath();
      ctx.arc(cx + Math.sin(wy * 0.08) * 16, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPalace(W, H) {
    const baseWy = worldY(GOAL_H);
    const sy = worldToScreen(baseWy, H);
    if (sy < -260 || sy > H + 120) return;
    const cx = W * 0.5;

    // Soft golden aura behind palace
    const aura = ctx.createRadialGradient(cx, sy - 90, 10, cx, sy - 90, 140);
    aura.addColorStop(0, "rgba(255, 236, 150, 0.75)");
    aura.addColorStop(0.45, "rgba(255, 193, 7, 0.28)");
    aura.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, sy - 90, 140, 0, Math.PI * 2);
    ctx.fill();

    // Gold platform / tree-top terrace
    const platG = ctx.createLinearGradient(cx - 90, sy, cx + 90, sy);
    platG.addColorStop(0, "#f9a825");
    platG.addColorStop(0.5, "#ffe082");
    platG.addColorStop(1, "#f9a825");
    ctx.fillStyle = platG;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 2, 95, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 215, 0, 0.55)";
    ctx.fillRect(cx - 88, sy - 10, 176, 12);

    if (imgReady(goldenPalaceImg)) {
      const destW = Math.min(W * 0.78, 280);
      const destH = destW * (goldenPalaceImg.naturalHeight / Math.max(1, goldenPalaceImg.naturalWidth));
      ctx.drawImage(goldenPalaceImg, cx - destW / 2, sy - destH + 6, destW, destH);
    } else {
      // Ornate Thai-inspired golden palace fallback (multi spires)
      const baseY = sy - 8;
      // main hall
      const hallG = ctx.createLinearGradient(cx - 70, baseY - 80, cx + 70, baseY);
      hallG.addColorStop(0, "#ffe57f");
      hallG.addColorStop(0.5, "#ffd54f");
      hallG.addColorStop(1, "#ff8f00");
      ctx.fillStyle = hallG;
      ctx.fillRect(cx - 70, baseY - 70, 140, 70);
      // arcade
      ctx.fillStyle = "#fff8e1";
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(cx + i * 24, baseY - 18, 9, Math.PI, 0);
        ctx.fill();
      }
      // multi-tier roofs + spires
      function spire(x, h, w) {
        ctx.fillStyle = "#ffc107";
        ctx.beginPath();
        ctx.moveTo(x, baseY - h);
        ctx.lineTo(x - w, baseY - h + 36);
        ctx.lineTo(x + w, baseY - h + 36);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ff6f00";
        ctx.fillRect(x - 3, baseY - h + 36, 6, 22);
        // tip
        ctx.fillStyle = "#fff59d";
        ctx.beginPath();
        ctx.moveTo(x, baseY - h - 18);
        ctx.lineTo(x - 5, baseY - h);
        ctx.lineTo(x + 5, baseY - h);
        ctx.closePath();
        ctx.fill();
      }
      // roofs
      ctx.fillStyle = "#ffb300";
      for (let t = 0; t < 3; t++) {
        const yy = baseY - 70 - t * 16;
        const ww = 78 - t * 10;
        ctx.beginPath();
        ctx.moveTo(cx - ww, yy);
        ctx.lineTo(cx, yy - 18);
        ctx.lineTo(cx + ww, yy);
        ctx.closePath();
        ctx.fill();
      }
      spire(cx, 150, 22);
      spire(cx - 48, 120, 16);
      spire(cx + 48, 120, 16);
      spire(cx - 78, 98, 12);
      spire(cx + 78, 98, 12);
    }

    // 永恆生命泉水 — fountain in front of palace door
    if (imgReady(eternalSpringImg)) {
      const sw = Math.min(W * 0.28, 110);
      const sh = sw * (eternalSpringImg.naturalHeight / Math.max(1, eternalSpringImg.naturalWidth));
      ctx.drawImage(eternalSpringImg, cx - sw / 2, sy - sh * 0.72, sw, sh);
    }
    const glow = ctx.createRadialGradient(cx, sy - 28, 2, cx, sy - 28, 42);
    glow.addColorStop(0, "rgba(185,242,255,0.85)");
    glow.addColorStop(0.4, "rgba(100,220,255,0.4)");
    glow.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, sy - 28, 42, 0, Math.PI * 2);
    ctx.fill();

    // sparkle
    ctx.fillStyle = "rgba(255,255,200,0.9)";
    for (let i = 0; i < 6; i++) {
      const a = state.worldTime * 2.2 + i * 1.1;
      const px = cx + Math.cos(a) * (40 + i * 8);
      const py = sy - 70 - Math.sin(a * 1.3) * 30 - i * 6;
      ctx.globalAlpha = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(a));
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#5d4037";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeText("金色宮殿 · 永恆生命泉水", cx, sy - 168);
    ctx.fillStyle = "#ff6f00";
    ctx.fillText("金色宮殿 · 永恆生命泉水", cx, sy - 168);
  }

  function drawLeafCluster(x, y, scale, phase) {
    const layers = [
      { dx: 0, dy: 0, rx: 26, ry: 16, c: "#1b5e20" },
      { dx: -14, dy: 4, rx: 18, ry: 12, c: "#2e7d32" },
      { dx: 16, dy: 2, rx: 17, ry: 11, c: "#388e3c" },
      { dx: -4, dy: -8, rx: 15, ry: 10, c: "#43a047" },
      { dx: 10, dy: -6, rx: 14, ry: 9, c: "#66bb6a" },
      { dx: -18, dy: -2, rx: 12, ry: 8, c: "#81c784" },
      { dx: 20, dy: -10, rx: 11, ry: 8, c: "#a5d6a7" },
      { dx: 0, dy: 8, rx: 13, ry: 7, c: "#33691e" },
      { dx: 8, dy: 10, rx: 10, ry: 6, c: "#558b2f" },
      { dx: -10, dy: 12, rx: 11, ry: 6, c: "#7cb342" },
    ];
    const bob = Math.sin(state.worldTime * 2.2 + phase) * 1.5;
    for (const L of layers) {
      ctx.fillStyle = L.c;
      ctx.beginPath();
      ctx.ellipse(
        x + L.dx * scale,
        y + L.dy * scale + bob,
        L.rx * scale,
        L.ry * scale,
        0.25 + phase * 0.05,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    // tiny highlight leaves
    ctx.fillStyle = "rgba(200,230,201,0.55)";
    ctx.beginPath();
    ctx.ellipse(x + 6 * scale, y - 10 * scale + bob, 7 * scale, 4 * scale, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHole(sx, sy, o, W) {
    const cx = W * 0.5;
    // Sit on trunk body (pull toward center slightly from side lane)
    const hx = sx * 0.28 + cx * 0.72;
    const hy = sy;
    if (imgReady(treeHoleImg)) {
      // Wider hollows — readable obstacle on phone
      const destW = Math.min(92, TRUNK_W * 1.55);
      const destH = destW * (treeHoleImg.naturalHeight / Math.max(1, treeHoleImg.naturalWidth));
      ctx.drawImage(treeHoleImg, hx - destW / 2, hy - destH / 2, destW, destH);
      return;
    }
    // Procedural cartoon 树洞: dark oval + bark rim + inner shadow (wider)
    ctx.save();
    ctx.translate(hx, hy);
    const rx = 32;
    const ry = 26;
    // Outer bark rim
    ctx.fillStyle = "#6d4c41";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx + 5, ry + 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mid bark ring
    ctx.fillStyle = "#5d4037";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx + 2.5, ry + 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dark hollow
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 2, ry);
    g.addColorStop(0, "#3e2723");
    g.addColorStop(0.45, "#1a120e");
    g.addColorStop(1, "#0a0705");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Subtle inner shadow crescent
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(3, 4, rx * 0.72, ry * 0.7, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Soft highlight on upper-left rim
    ctx.strokeStyle = "rgba(161,136,127,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-2, -3, rx * 0.85, ry * 0.85, -0.2, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();
  }

  function drawGoldApple(x, y, lean) {
    const bob = Math.sin(state.worldTime * 2.4 + x * 0.02) * 4;
    ctx.save();
    ctx.translate(x, y + bob);
    if (imgReady(goldAppleImg)) {
      const sz = 56; // 放大：易睇易取
      ctx.drawImage(goldAppleImg, -sz / 2, -sz / 2, sz, sz);
    } else {
      ctx.fillStyle = "#ffd54f";
      ctx.beginPath();
      ctx.arc(0, 2, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#66bb6a";
      ctx.beginPath();
      ctx.ellipse(10, -14, 10, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffde7";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♡", 0, 4);
    }
    ctx.restore();
  }

  function drawObstacles(W, H) {
    const cx = W * 0.5;
    // Pass 1: tree hollows ON the trunk (before branches/nests)
    for (const o of state.obstacles) {
      if (o.kind !== "hole") continue;
      const sy = worldToScreen(worldY(o.h), H);
      if (sy < -120 || sy > H + 120) continue;
      const sx = sideX(o.side, W);
      drawHole(sx, sy, o, W);
    }
    for (const o of state.obstacles) {
      if (o.kind === "hole") continue;
      const sy = worldToScreen(worldY(o.h), H);
      if (sy < -120 || sy > H + 120) continue;
      const sx = sideX(o.side, W);
      const lean = o.lean || (o.side >= 0 ? 1 : -1);
      // Face: positive lean / right side → branch grows right; flip for left
      const faceRight = lean >= 0;

      if (o.kind === "branch") {
        if (o.satellite) {
          // Light secondary foliage puff (main sprite drawn by primary entry)
          if (!imgReady(treeBranchImg)) {
            drawLeafCluster(sx, sy, 0.42 * (o.leafScale || 0.8), o.h + o.side);
          }
          continue;
        }

        if (imgReady(treeBranchImg)) {
          const destW = 118 + (o.leafScale || 1) * 36;
          const destH = destW * (treeBranchImg.naturalHeight / treeBranchImg.naturalWidth);
          // Anchor thick end at trunk, leafy tip outward
          const trunkJoinX = cx + (faceRight ? TRUNK_W * 0.28 : -TRUNK_W * 0.28);
          const drawY = sy - destH * 0.55;
          ctx.save();
          ctx.translate(trunkJoinX, drawY + destH * 0.55);
          ctx.scale(faceRight ? 1 : -1, 1);
          // Subtle idle sway
          const sway = Math.sin(state.worldTime * 1.6 + o.h * 0.3) * 0.03;
          ctx.rotate(sway);
          ctx.drawImage(treeBranchImg, 0, -destH * 0.55, destW, destH);
          ctx.restore();
          // Extra leaf density near tip + mid (massive foliage read)
          const tipX = trunkJoinX + (faceRight ? 1 : -1) * destW * 0.78;
          const midX = trunkJoinX + (faceRight ? 1 : -1) * destW * 0.42;
          drawLeafCluster(tipX, sy - destH * 0.22, 0.55 * (o.leafScale || 1), o.h);
          drawLeafCluster(midX, sy - destH * 0.35, 0.48 * (o.leafScale || 1), o.h + 2.2);
          drawLeafCluster(tipX - (faceRight ? 18 : -18), sy + 6, 0.4, o.h + 4.1);
          if (o.goldApple && !o.appleTaken) {
            // 掛近樹幹／攀爬線，唔喺枝尖外圍
            const appleX = trunkJoinX + (faceRight ? 1 : -1) * destW * 0.30;
            const appleY = sy - destH * 0.08;
            drawGoldApple(appleX, appleY, faceRight ? 1 : -1);
          }
        } else {
          // Procedural fallback: thick curve + dense leaves
          const tipX = sx + lean * 42;
          const tipY = sy + 10;
          const curve = o.curve || 0.6;
          ctx.lineCap = "round";
          ctx.strokeStyle = "rgba(33,19,13,0.55)";
          ctx.lineWidth = 16;
          ctx.beginPath();
          ctx.moveTo(cx, sy + 4);
          ctx.quadraticCurveTo((cx + tipX) / 2, sy - 28 * curve, tipX, tipY + 3);
          ctx.stroke();
          ctx.strokeStyle = "#5d4037";
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(cx, sy);
          ctx.quadraticCurveTo((cx + tipX) / 2, sy - 32 * curve, tipX, tipY);
          ctx.stroke();
          const sc = (o.leafScale || 1);
          drawLeafCluster(tipX, tipY - 6, 0.95 * sc, o.h);
          drawLeafCluster(tipX - lean * 22, tipY - 18, 0.72 * sc, o.h + 1.7);
          drawLeafCluster((cx + tipX) / 2 + lean * 8, sy - 26 * curve, 0.8 * sc, o.h + 3.1);
          drawLeafCluster(tipX + lean * 14, tipY - 28, 0.55 * sc, o.h + 4.4);
          drawLeafCluster(tipX - lean * 8, tipY + 8, 0.5 * sc, o.h + 5.2);
          if (o.goldApple && !o.appleTaken) {
            const appleX = cx + lean * 22; // 近樹幹
            const appleY = sy - 6;
            drawGoldApple(appleX, appleY, lean);
          }
        }
      }

      if (o.kind === "nest") {
        const tipX = sx + lean * (o.onBranch ? 52 : 10);
        const tipY = sy + (o.onBranch ? -6 : 8);
        if (!o.onBranch) {
          // Short stub + leaves under standalone nest
          ctx.strokeStyle = "#5d4037";
          ctx.lineWidth = 10;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx, sy);
          ctx.quadraticCurveTo((cx + tipX) / 2, sy - 22, tipX, tipY);
          ctx.stroke();
          drawLeafCluster(tipX - lean * 12, tipY - 8, 0.55, o.h + 2);
          drawLeafCluster(tipX + lean * 6, tipY - 18, 0.48, o.h + 3);
        }
        if (imgReady(birdNestImg)) {
          const nh = 50;
          const nw = nh * (birdNestImg.naturalWidth / birdNestImg.naturalHeight);
          ctx.drawImage(birdNestImg, tipX - nw / 2, tipY - nh * 0.78, nw, nh);
        } else {
          ctx.fillStyle = "#6d4c41";
          ctx.beginPath();
          ctx.ellipse(tipX, tipY, 22, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffcc80";
          ctx.beginPath();
          ctx.arc(tipX - 6, tipY - 4, 5, 0, Math.PI * 2);
          ctx.arc(tipX + 5, tipY - 5, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawLeafCluster(tipX - lean * 16, tipY + 6, 0.4, o.h + 9);
      }
    }
  }

  function drawBricks(W, H) {
    for (const b of state.brickMap.values()) {
      const sy = worldToScreen(worldY(b.h), H);
      if (sy < -50 || sy > H + 50) continue;
      const sx = sideX(b.side, W);
      // Stand surface = top of brick (matches player footY)
      const topY = sy - BRICK_H / 2;
      const destW = 56;
      const destH = imgReady(goldBrickImg)
        ? destW * (goldBrickImg.naturalHeight / goldBrickImg.naturalWidth)
        : 18;

      if (b.melted) {
        const a = Math.max(0, b.meltT / MELT_ANIM);
        const burn = Math.max(a, b.burn || 0);
        // Scorch gap after melt finishes
        if (a <= 0.08) {
          ctx.fillStyle = "rgba(40, 20, 10, 0.45)";
          ctx.beginPath();
          ctx.ellipse(sx, topY + 8, 18, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 87, 34, 0.25)";
          ctx.fillRect(sx - 12, topY + 4, 24, 6);
          continue;
        }
        // Burning melt: glow, warp, drip
        ctx.save();
        const squash = 1 + (1 - a) * 0.55;
        const flatten = Math.max(0.25, a);
        const wobble = Math.sin(state.worldTime * 18 + (b.dripSeed || 0)) * (1 - a) * 4;
        ctx.translate(sx + wobble, topY + destH * 0.35);
        ctx.scale(squash, flatten);
        ctx.translate(-sx, -(topY + destH * 0.35));

        // Heat glow behind brick
        const glow = ctx.createRadialGradient(sx, topY + 8, 2, sx, topY + 8, 40);
        glow.addColorStop(0, `rgba(255, 240, 100, ${0.55 * burn})`);
        glow.addColorStop(0.4, `rgba(255, 80, 0, ${0.4 * burn})`);
        glow.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, topY + 8, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = Math.min(1, a + 0.15);
        if (imgReady(goldBrickImg)) {
          ctx.filter = "hue-rotate(-40deg) saturate(2) brightness(1.25)";
          ctx.drawImage(goldBrickImg, sx - destW / 2, topY, destW, destH);
          ctx.filter = "none";
        } else {
          ctx.fillStyle = "#ff7043";
          ctx.fillRect(sx - destW / 2, topY, destW, BRICK_H);
        }
        // Orange-red lava overlay
        ctx.globalAlpha = 0.35 + (1 - a) * 0.45;
        ctx.fillStyle = "#ff3d00";
        ctx.fillRect(sx - destW / 2, topY + destH * 0.35, destW, destH * 0.65);
        ctx.restore();

        // Molten drips falling from brick
        const drips = 5;
        for (let i = 0; i < drips; i++) {
          const seed = (b.dripSeed || 1) + i * 17;
          const dx = ((seed * 13) % 37) - 18;
          const len = 8 + (1 - a) * (14 + (seed % 10));
          const dy = (1 - a) * (10 + (seed % 12)) + Math.sin(state.worldTime * 10 + seed) * 2;
          ctx.strokeStyle = i % 2 ? `rgba(255,160,0,${0.7 * a})` : `rgba(255,60,0,${0.75 * a})`;
          ctx.lineWidth = 3 + (i % 3);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(sx + dx, topY + destH * flatten + 2);
          ctx.quadraticCurveTo(sx + dx + 2, topY + destH + dy, sx + dx - 1, topY + destH + dy + len);
          ctx.stroke();
          ctx.fillStyle = `rgba(255, 200, 60, ${0.8 * a})`;
          ctx.beginPath();
          ctx.arc(sx + dx - 1, topY + destH + dy + len, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      // Shiny 999.9 gold bar / ingot sprite
      if (imgReady(goldBrickImg)) {
        ctx.drawImage(goldBrickImg, sx - destW / 2, topY, destW, destH);
      } else {
        const bw = 46;
        const bh = BRICK_H;
        const g = ctx.createLinearGradient(sx - bw / 2, topY, sx + bw / 2, topY + bh);
        g.addColorStop(0, "#fff59d");
        g.addColorStop(0.4, "#ffd700");
        g.addColorStop(1, "#f9a825");
        ctx.fillStyle = g;
        ctx.strokeStyle = "#e65100";
        ctx.lineWidth = 2;
        roundRect(sx - bw / 2, topY, bw, bh, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillRect(sx - bw / 2 + 4, topY + 2, bw * 0.35, 3);
      }
      if (b.fresh > 0) {
        ctx.strokeStyle = `rgba(255,255,200,${Math.min(1, b.fresh * 3)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - destW / 2 - 2, topY - 2, destW + 4, Math.min(destH, 24) + 4);
      }
    }
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

  function drawDragons(W, H) {
    for (const d of state.dragons) {
      const sy = worldToScreen(d.y, H);
      const sx = d.x;
      if (sy < -100 || sy > H + 100) continue;

      ctx.save();
      ctx.translate(sx, sy);
      // Sprite faces right; flip when orbiting left side
      const face = Math.cos(d.angle) >= 0 ? 1 : -1;
      ctx.scale(face, 1);
      const bob = Math.sin(state.worldTime * 4 + d.id) * 3;

      if (imgReady(fireDragonImg)) {
        const destH = 78;
        const destW = destH * (fireDragonImg.naturalWidth / fireDragonImg.naturalHeight);
        ctx.drawImage(fireDragonImg, -destW * 0.42, -destH * 0.55 + bob, destW, destH);
      } else {
        // fallback scribble if asset missing
        ctx.fillStyle = "#c62828";
        ctx.beginPath();
        ctx.ellipse(0, bob, 28, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e53935";
        ctx.beginPath();
        ctx.ellipse(22, -4 + bob, 14, 11, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Fire column VFX is drawn from state.fires (mouth-tracked in updateDragons)
    }
  }

  /** Thick roaring flame stream — fire column / jet, NOT a thin laser beam. */
  function drawFireColumn(x0, y0, x1, y1, intensity, seed) {
    const steps = 18;
    const face = x1 >= x0 ? 1 : -1;
    const mx = (x0 + x1) / 2 + face * 18;
    const my = (y0 + y1) / 2 - 36;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let layer = 0; layer < 4; layer++) {
      const width = (42 - layer * 9) * (0.55 + 0.45 * intensity);
      const colors = [
        `rgba(255, 40, 0, ${0.22 * intensity})`,
        `rgba(255, 120, 0, ${0.32 * intensity})`,
        `rgba(255, 200, 40, ${0.4 * intensity})`,
        `rgba(255, 255, 200, ${0.5 * intensity})`,
      ];
      ctx.strokeStyle = colors[layer];
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx, my, x1, y1);
      ctx.stroke();
    }
    // Billowing flame blobs along the jet
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const it = 1 - Math.pow(1 - t, 1.4);
      // quadratic bezier point
      const bx = (1 - it) * (1 - it) * x0 + 2 * (1 - it) * it * mx + it * it * x1;
      const by = (1 - it) * (1 - it) * y0 + 2 * (1 - it) * it * my + it * it * y1;
      const flicker = 0.75 + 0.25 * Math.sin(seed * 9 + i * 1.7 + state.worldTime * 22);
      const r = (10 + (1 - t) * 16 + Math.sin(seed + i) * 4) * flicker * intensity;
      const g = ctx.createRadialGradient(bx, by, 1, bx, by, r);
      g.addColorStop(0, `rgba(255,255,210,${0.65 * intensity})`);
      g.addColorStop(0.35, `rgba(255,160,0,${0.45 * intensity})`);
      g.addColorStop(0.7, `rgba(255,60,0,${0.25 * intensity})`);
      g.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bx, by, r * 0.85, r * 1.25, face * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Impact blaze on brick
    const blast = 16 + 22 * intensity;
    const bg = ctx.createRadialGradient(x1, y1, 2, x1, y1, blast);
    bg.addColorStop(0, `rgba(255,255,180,${0.85 * intensity})`);
    bg.addColorStop(0.4, `rgba(255,100,0,${0.55 * intensity})`);
    bg.addColorStop(1, "rgba(180,0,0,0)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x1, y1, blast, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFires(W, H) {
    for (const f of state.fires) {
      const tx = sideX(f.toSide, W);
      const ty = worldToScreen(worldY(f.toH), H);
      const a = Math.max(0.2, f.life / f.maxLife);
      const x0 = f.fromX;
      const y0 = worldToScreen(f.fromY, H);
      drawFireColumn(x0, y0, tx, ty, a, f.seed + state.worldTime);
    }
  }

  function drawPlayer(W, H) {
    const p = state.player;
    const sx = sideX(p.side, W);
    // Brick is centered on worldY(h); top surface is BRICK_H/2 above center in screen-down coords → subtract
    const brickMidY = worldToScreen(worldY(p.displayH), H);
    const footY = brickMidY - BRICK_H / 2; // feet planted on brick top
    const img = angelSprite(p.gender);
    const destH = 64; // readable on phone; feet locked to brick top
    const destW = destH * 0.78;
    // Subtle idle bob only when grounded — never float above brick
    const bob = (!p.falling && isGrounded(p)) ? Math.sin(p.bob * 5) * 1.1 : 0;

    // Contact shadow on brick
    if (!p.falling) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(sx, footY + 1, destW * 0.3, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, sx - destW / 2, footY - destH + bob, destW, destH);
    } else {
      // Fallback so player is never invisible while art loads
      ctx.fillStyle = "#ffe082";
      ctx.beginPath();
      ctx.arc(sx, footY - 28 + bob, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffde7";
      ctx.beginPath();
      ctx.ellipse(sx, footY - 48 + bob, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // fall urgency ring
    if (p.fallUrgency > 0) {
      ctx.strokeStyle = `rgba(255,60,0,${0.4 + p.fallUrgency / REBUILD_URGENCY})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, footY - destH / 2, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(W, H) {
    for (const pt of state.particles) {
      const sy = worldToScreen(pt.y, H);
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, sy, pt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHeightMarks(W, H) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    for (let h = 0; h <= GOAL_H; h += 20) {
      const sy = worldToScreen(worldY(h), H);
      if (sy < 0 || sy > H) continue;
      const pct = Math.round((h / GOAL_H) * 100);
      ctx.fillText(`${pct}%`, 8, sy);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(40, sy);
      ctx.lineTo(W - 40, sy);
      ctx.stroke();
    }
  }

  function render() {
    if (!ctx || !state) return;
    const { W: dw, H: dh } = getViewSize();

    ctx.clearRect(0, 0, dw, dh);
    drawSky(dw, dh);
    drawHeightMarks(dw, dh);
    drawTrunk(dw, dh);
    drawGround(dw, dh);
    drawPalace(dw, dh);
    drawObstacles(dw, dh);
    drawBricks(dw, dh);
    drawFires(dw, dh);
    drawDragons(dw, dh);
    drawPlayer(dw, dh);
    drawParticles(dw, dh);

    // Build range hint
    if (state.phase === "play") {
      const p = state.player;
      const hx = sideX(p.side, dw);
      const hy = worldToScreen(worldY(Math.round(p.h) + 1), dh);
      ctx.strokeStyle = "rgba(255,215,0,0.35)";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(hx - 24, hy - 8, 48, 16);
      ctx.setLineDash([]);
    }
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

  function stopLevel3() {
    cancelAnimationFrame(raf);
    raf = 0;
    state = null;
  }

  function startLevel3() {
    ensureAudio();
    if (window.FeishengLevel4 && typeof window.FeishengLevel4.stop === "function") {
      window.FeishengLevel4.stop();
    }
    if (window.FeishengLevel2 && typeof window.FeishengLevel2.stop === "function") {
      window.FeishengLevel2.stop();
    }
    if (window.FeishengL1 && typeof window.FeishengL1.stop === "function") {
      window.FeishengL1.stop();
    }
    showScreen(screens.gameL3);
    resizeCanvas();
    state = createState();
    updateHUD();
    if (failToast) failToast.classList.add("hidden");
    lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function goHome() {
    stopLevel3();
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
    if (!state || !screens.gameL3 || !screens.gameL3.classList.contains("active")) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      state.keys.up = true;
      e.preventDefault();
    }
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      state.keys.down = true;
      e.preventDefault();
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      if (!e.repeat) tryStepSide(-1);
      state.keys.left = true;
      e.preventDefault();
    }
    if (e.code === "ArrowRight" || e.code === "KeyD") {
      if (!e.repeat) tryStepSide(1);
      state.keys.right = true;
      e.preventDefault();
    }
    if (e.code === "Space") {
      state.keys.build = true;
      tryBuild();
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (!state) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") state.keys.up = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") state.keys.down = false;
    if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = false;
    if (e.code === "Space") state.keys.build = false;
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
    document.getElementById("btn-l3-up"),
    () => state && (state.keys.up = true),
    () => state && (state.keys.up = false)
  );
  bindHold(
    document.getElementById("btn-l3-down"),
    () => state && (state.keys.down = true),
    () => state && (state.keys.down = false)
  );
  bindHold(
    document.getElementById("btn-l3-left"),
    () => { tryStepSide(-1); },
    () => {}
  );
  bindHold(
    document.getElementById("btn-l3-right"),
    () => { tryStepSide(1); },
    () => {}
  );

  const btnBuild = document.getElementById("btn-l3-build");
  if (btnBuild) {
    btnBuild.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!state) return;
      state.keys.build = true;
      tryBuild();
    });
    btnBuild.addEventListener("pointerup", () => state && (state.keys.build = false));
    btnBuild.addEventListener("pointerleave", () => state && (state.keys.build = false));
  }

  const btnStartL3 = document.getElementById("btn-start-l3");
  if (btnStartL3) btnStartL3.addEventListener("click", startLevel3);
  const btnEnterL3 = document.getElementById("btn-enter-l3");
  if (btnEnterL3) btnEnterL3.addEventListener("click", startLevel3);
  const btnReplayL3 = document.getElementById("btn-replay-l3");
  if (btnReplayL3) btnReplayL3.addEventListener("click", startLevel3);
  const btnReplayL3Lose = document.getElementById("btn-replay-l3-lose");
  if (btnReplayL3Lose) btnReplayL3Lose.addEventListener("click", startLevel3);
  const btnHomeL3 = document.getElementById("btn-home-l3");
  if (btnHomeL3) btnHomeL3.addEventListener("click", goHome);
  const btnHomeL3Lose = document.getElementById("btn-home-l3-lose");
  if (btnHomeL3Lose) btnHomeL3Lose.addEventListener("click", goHome);

  window.addEventListener("resize", () => {
    if (!screens.gameL3 || !screens.gameL3.classList.contains("active") || !state) return;
    resizeCanvas();
  });

  window.FeishengLevel3 = {
    start: startLevel3,
    stop: stopLevel3,
    loadSave,
    writeSave,
    refreshMenuButtons,
  };

  refreshMenuButtons();
})();
