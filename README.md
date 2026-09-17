# 飛升 Gold Gold! — Level 1 · 2 · 3 · 4

Kid-friendly browser game in Traditional Chinese (HK).

## How to open / run

### Option A — open the file
Open `/workspace/feisheng-gold-gold/index.html` in a modern browser.

### Option B — local static server (recommended)
```bash
cd /workspace/feisheng-gold-gold
python3 -m http.server 8765
```
Visit: **http://127.0.0.1:8765/** (or `http://localhost:8765/`)

No build step. Plain HTML + CSS + JS. Cache-bust: **`?v=1789580500`**.

## Persistence (`localStorage`)

Key: **`feishengGoldGold.save`**

```json
{
  "heartsBanked": 4,
  "coins": 40,
  "streakBest": 12,
  "level1Cleared": true,
  "level2Cleared": true,
  "level3Cleared": true,
  "goldenArmor": true
}
```

---

## Level 1 — 黃金蘋果樹之路
Jump **18** clouds via **3-choice** quizzes (math / IQ / animal / math-riddle). **180s** countdown. Hearts, streak bonus, consecutive-wrong −5s penalty. Clear → bank hearts → auto-enter Level 2.

### Controls (L1)
| Action | Keyboard | On-screen |
|--------|----------|-----------|
| Move | ← → / A D | ◀ ▶ |
| Jump (quiz) | Space / ↑ / W | 跳躍 |

---

## Level 2 — 黃金海浪（衝浪）
Surf on a golden leaf; dodge mermaids & octopi; shoot arrows; reach 黃金島城 → **黃金戰士套裝**.

### How to enter
1. Clear L1 → auto-enter (or「立即進入第二關」)
2. Start menu「第二關 · 黃金海浪」if `level1Cleared`

### Controls (L2)
| Action | Keyboard | On-screen |
|--------|----------|-----------|
| Dodge | ← → / ↑ ↓ / W S / A D | ▲ ▼ |
| Aim | Q / E / , . | ➶ ➴ |
| Shoot | Space / J / K | 射擊 |

---

## Level 3 — 生命之樹（砌金磚攀登）

Art: `assets/tree-of-life.png`, `assets/tree-branch.png` (leafy curved limbs), `assets/bird-nest.png`, `assets/fire-dragon.png`, `assets/gold-brick.png`.

Climb the super-giant **Tree of Life** by placing **金磚** ladder steps around the trunk. Reach the **黃金宮殿** at the top and claim **永恆生命泉水**.

### How to enter
1. **Clear Level 2** → brief win flash → auto `FeishengLevel3.start()` (or button「進入第三關」)
2. Start menu **「第三關 · 生命之樹」** if `level2Cleared` in save

Hearts: start with `heartsBanked` if available, else **3**. Uses gold armored angel sprites when `goldenArmor` / L2 cleared.

### Rules
- **倒數 5:00（300 秒）** for the whole climb.
- **砌磚:** place / rebuild **金磚** steps on the trunk to climb upward.
- **Weave-build:** place金磚 **一件搭一件** adjacent (↑ / ↖ / ↗) around **leafy curved branches** & **bird nests** — cannot stack only straight up through obstacles. **◀▶** aim the lane.
- **Red fire dragons** orbit and breathe fire — bricks near the blast **melt** into gaps.
- After a melt: **quickly rebuild** or move (short window). Rebuilding **slows ascent**.
- Fall through a gap / fail to rebuild → **墮下 −1♡**. **0 hearts = lose**.
- Reach palace / drink **永恆生命泉水** → win (zh-Hant HK). Saves `level3Cleared`.

### Controls (L3)
| Action | Keyboard | On-screen |
|--------|----------|-----------|
| Climb up / down | ↑ ↓ or W S | ▲ ▼ |
| Shift build side | ← → or A D | ◀ ▶ |
| Place 金磚 | Space | **砌磚** |

### HUD (zh-Hant)
倒數 · ♡ 生命 · 高度% · 金磚數 · 金幣

### Public API
`window.FeishengLevel3 = { start, stop, refreshMenuButtons }`

---

## Files
- `index.html` — screens / HUD / controls
- `styles.css` — sky / ocean / tree / palace themes
- `questions.js` — L1 quiz banks
- `game.js` — Level 1
- `level2.js` — Level 2
- `level3.js` — Level 3
- `level4.js` — Level 4 maze
- `assets/` — angel / cherub / mermaid / octopus art

## UI language
Traditional Chinese (Hong Kong): 倒數、♡ 生命、金幣、砌磚、墮下、永恆生命泉水、勝利、再試一次. Title: **飛升 Gold Gold!**.


## Level 4 · 黃金迷宮
Top-down golden-palace maze inside the palace.

- **One-way trail:** cells behind the angel seal (gold「封印」); player cannot reverse. Minotaur **can** walk sealed cells.
- **5:00** timer · hearts · coins · compass (top-right facing)
- **Peek:** NW/NE/SW/SE buttons (or keys 1–4) spend **1♡** to show that zone’s dashed solution path for **1.0s**
- **Minotaur** BFS chase (slower); hit −1♡ + invulnerability
- Win: left **E** exit → **金匙扣** (`assets/sky-chariot-gold-key.png`) for 巡天飛天馬車 · Lose: time out, 0♡, or soft-lock (no open moves)

`window.FeishengLevel4 = { start, stop, refreshMenuButtons }` · save key `feishengGoldGold.save` field `level4Cleared`

Test: hard-refresh `/?v=1789582600` on :8765 · set `level3Cleared:true` in localStorage · menu **第四關**, or finish L3 (auto-starts L4).
