---
name: replicate-assessment
description: >
  Replicate forced-choice ("三选二") personality/behavioral assessments as single-page HTML applications.
  Use when the user asks to "replicate an assessment", "copy a test", "clone a quiz format", "复刻测评",
  "做测评题", "仿造测试", or describes an assessment with "most like / least like" (最符合/最不符合) picks.
  Supports customizable question banks, scoring dimensions, company matching profiles, drag-and-drop UI,
  countdown timers, speed detection, and GitHub Pages deployment. Always use this skill when the user
  mentions forced-choice assessments, personality tests with drag interaction, or 北森/Beisen-style tests.
---

# Replicate Forced-Choice Assessment

Build single-page HTML/CSS/JS applications that replicate forced-choice ("三选二") behavioral assessments — the kind used by Beisen (北森), SHL, and other enterprise assessment platforms.

## When to Use

- User describes an assessment format: "pick most like and least like from 3 options"
- User wants to "copy/复刻" a test they took (campus recruitment, personality test, etc.)
- User mentions: 迫选, 三选二, 最符合最不符合, 北森, 性格测评, 98题
- User wants matching to company culture profiles (互联网大厂匹配)

## Architecture (5 files)

```
project/
├── index.html          # Welcome page + assessment page + report page
├── css/style.css       # All styles (responsive, full-width)
├── js/
│   ├── data.js         # Question bank + dimensions + company profiles
│   ├── scoring.js      # Scoring engine + consistency check + matching
│   └── app.js          # UI controller (drag/click, timer, toast, report)
```

## Step-by-Step Build Order

### Step 1: Define the data layer (data.js)

Three data structures drive everything:

```js
// 1. DIMENSIONS: each dimension maps to an aspect (5 aspects × 6 dims = 30 total)
const DIMENSIONS = {
  "抗压性": { aspect: "情绪适应", high: "压力耐受度高...", low: "对压力敏感..." },
  // ... N dimensions
};

// 2. QUESTION_BANK: N question groups, each with 3 options mapped to dimensions
const QUESTION_BANK = [
  { id: 1, options: [
    { text: "能在压力下工作", dims: ["抗压性"] },
    { text: "能发现信息间的关联", dims: ["洞察的"] },
    { text: "能在期限前完成工作", dims: ["责任感"] }
  ]},
  // ... N questions
];

// 3. COMPANY_PROFILES: ideal score ranges [min, max] per dimension per company
const COMPANY_PROFILES = {
  "字节跳动": {
    notes: "创业者文化：自驱+坦诚+极致+拥抱变化",
    profile: { "抗压性": [65,95], "创新的": [65,95], ... }
  },
  // ... M companies
};

// 4. ASSESSMENT_TIPS: practical advice shown in report footer
const ASSESSMENT_TIPS = [
  { title: "展现'工作中'的你", content: "..." },
  // ... tips
];
```

**Key rules for dimension mapping:**
- Each option should map to 1-3 dimensions
- Ensure all dimensions are covered across the question bank (at least 3 hits each)
- Balance: options within a question should come from different aspects for better discrimination

### Step 2: Build the scoring engine (scoring.js)

Core algorithm:

```js
function calculateRawScores(mostLikeAnswers, leastLikeAnswers) {
  // mostLike: +2 weight per associated dimension (split if multiple dims)
  // leastLike: -1 weight per associated dimension
  // Initial score: 0 (neutral)
}

function toPercentile(rawScores) {
  // Sigmoid normalization: 100 / (1 + e^(-k * (score - mid)))
  // k = 0.35, mid = 5 → maps raw scores to 1-100
}

function checkConsistency(rawData) {
  // Count dimensions with BOTH high most-like AND high least-like hits
  // contradictionCount > threshold → flag inconsistency
}

function determineType(percentiles) {
  // Map 5 aspect scores to personality type labels (e.g., "开拓者·分析师")
}

function calculateCompanyMatch(percentiles) {
  // Weighted Euclidean distance to company ideal ranges
  // dimension weight = 100 - range_width (tighter ranges = more important)
}
```

### Step 3: Build the HTML with three pages

**Page 1: Welcome (`#page-welcome`)**
- Title + subtitle
- Preview card showing sample result (type label + aspect bars + company ranking)
- Assessment instructions (question count, pick rules)
- "开始测评" button
- Resume hint for incomplete progress

**Page 2: Assessment (`#page-assessment`)**
- Top bar: title, progress bar, counter (N/total), countdown timer
- Instruction text: `「点击」或「拖拽」选项到右侧选框内`
- Main area: CSS Grid `65% 35%` split
  - Left: card pool (2×1+1 grid: A+B side-by-side, C below left)
  - Right: two drop zones (最符合 top, 最不符合 bottom) with labels above
- Footer: "下一题" button (right-aligned, enabled only when both zones filled)

**Page 3: Report (`#page-report`)**
- AI disclaimer (top + bottom)
- Type badge + summary
- 5 aspect score cards
- Radar chart (Chart.js CDN)
- Per-aspect dimension breakdown with color-coded tags
- Company matching grid (4 columns for ≤12 companies)
- Consistency report
- Development advice
- Assessment tips

### Step 4: Style with precision (style.css)

Critical layout rules:

```css
/* Welcome: centered container with max-width */
.welcome-container { max-width: 680px; margin: 0 auto; }

/* Assessment: full-viewport, precise grid */
#page-assessment.active { display: flex; flex-direction: column; height: 100vh; }
.assess-main {
  flex: 0 0 auto; height: 56vh;
  display: grid; grid-template-columns: 65% 35%;
}
.card-pool {
  display: grid;
  grid-template-columns: 48% 48%;
  grid-template-rows: 1fr 1fr;
  row-gap: 24px;
  height: 100%;
}
.drop-zones { height: 100%; display: flex; flex-direction: column; }
.drop-zone-wrap { flex: 1; }

/* Pool cards: gray background, no labels */
.pool-card { background: #F5F5F5; border: 1px solid #E5E5E5; }

/* Drop zones: blue dashed empty, blue solid filled */
.drop-zone { border: 2px dashed #3B82F6; }
.drop-zone.filled { border-style: solid; background: #EFF6FF; }

/* CRITICAL: prevent assessment page from showing on welcome page */
.page { display: none; }
/* Use #page-assessment.active (not #page-assessment alone) to avoid specificity issues */
#page-assessment.active { display: flex; ... }
```

### Step 5: Wire interactions (app.js)

**State management:**
```js
let state = {
  currentIdx: 0,           // current question 0-(N-1)
  mostLike: {},            // { groupId: "A"|"B"|"C" }
  leastLike: {},           // { groupId: "A"|"B"|"C" }
  completed: false,
  timeRemaining: 3600,     // 60 minutes
  questionStartTime: Date.now(),
  speedWarnings: 0,        // count of <5s responses
};
```

**Key interactions:**
- `clickPoolCard(key)` — first click → mostLike slot, second click → leastLike slot; guarded by `page-assessment.active` check
- `placeInZone(key, zoneType)` — move card; auto-clear other zone if same key
- `removeFromZone(zoneType)` — return card to pool
- Drag-and-drop via HTML5 DnD API (ondragstart/ondragover/ondrop)
- `nextQuestion()` — speed check (<5s → toast), advance or complete

**Timer:**
- 60-minute countdown, last 5 min yellow pulse, last 1 min red pulse
- Time-up → auto-submit with force-filled remaining answers

**Toast:**
- Fixed-position, slide-in/slide-out animation
- Speed warnings at 1-2 occurrences, stern warning at 3+

**Persistence:**
- localStorage save after every answer change
- Resume detection on welcome page

### Step 6: Deploy to GitHub Pages

After project is built:
1. `git init && git add -A && git commit -m "initial"`
2. Create empty repo on GitHub (no README/gitignore)
3. `git remote add origin <url> && git branch -M main && git push -u origin main`
4. Enable Pages: Settings → Pages → Source: main, /(root) → Save
5. URL: `https://<user>.github.io/<repo>/`

If git can't reach GitHub (common in China), use PowerShell:
```powershell
powershell -Command "git -C '<project-path>' push -u origin main"
```

## Customization Guide

### Changing question count
- Modify `TOTAL` constant in app.js
- Adjust `QUESTION_BANK` array length in data.js
- Progress and counter auto-scale

### Changing dimensions
- Edit `DIMENSIONS` and `ASPECTS` objects in data.js
- Update `COMPANY_PROFILES` dimension keys to match
- Scoring engine references `Object.keys(DIMENSIONS)` — auto-adapts

### Changing companies
- Edit/add entries in `COMPANY_PROFILES`
- Update `icons` map in `renderCompanyCards()`
- Update `companyTips` in `generateAdvice()` (scoring.js)
- Grid auto-adapts (4 columns for ≤12, responsive 2→3 cols)

### Changing timer duration
- Modify `TIME_LIMIT` constant (seconds) in app.js

### Changing speed warning threshold
- Modify `SPEED_WARN` (ms) and `SPEED_WARN_LIMIT` (count) in app.js

## Common Pitfalls

1. **Assessment page visible on welcome**: Always use `#page-assessment.active` CSS selector, never `#page-assessment` alone. The ID selector beats `.page { display: none }` in specificity.
2. **Left/right height mismatch**: Both `.card-pool` and `.drop-zones` must have `height: 100%` inside the `.assess-main` grid.
3. **Cards not aligned**: Use `grid-template-rows: 1fr 1fr` with `align-content: start`, NOT `align-content: center`.
4. **Button placement**: Footer uses `justify-content: flex-end` for bottom-right button.
5. **Console-only push**: If `git push` fails in bash but browser works, use PowerShell which inherits Windows system proxy.
