# CSS Layout Templates

## Assessment Page: Full-Viewport Grid Layout

The assessment page fills the viewport with a precise grid. Key structure:

```
#page-assessment.active  (flex column, height: 100vh)
├── .assess-topbar       (flex-shrink: 0, height: 52px)
├── .assess-instruction  (flex-shrink: 0, padding: 14px 28px)
├── .assess-main         (grid: 65% 35%, height: 56vh)
│   ├── .card-pool       (grid: 48% 48%, rows: 1fr 1fr, height: 100%)
│   │   ├── .pool-card A  (row 1, col 1)
│   │   ├── .pool-card B  (row 1, col 2)
│   │   └── .pool-card C  (row 2, col 1) -- grid-row: 2; grid-column: 1
│   └── .drop-zones      (flex column, height: 100%)
│       ├── .drop-zone-wrap (flex: 1)
│       │   ├── .zone-label "最符合"
│       │   └── .drop-zone#zone-most
│       └── .drop-zone-wrap (flex: 1)
│           ├── .zone-label "最不符合"
│           └── .drop-zone#zone-least
└── .assess-footer       (flex-shrink: 0, flex-end)
    └── .btn-next
```

### Critical Height Alignment

Both `.card-pool` and `.drop-zones` must have `height: 100%` to fill their grid cell.
The grid cell itself is set by `.assess-main { height: 56vh }` (approximately 70% of the
space that `flex: 1` would give).

For the card pool rows: `grid-template-rows: 1fr 1fr` with `align-content: start` ensures
cards stretch proportionally and start at the top edge.

### Welcome Page Protection

The welcome page and assessment page share the same DOM. To prevent the assessment page
from rendering on the welcome page, use this selector:

```css
/* ✅ Correct — only applies when assessment page is active */
#page-assessment.active {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

/* ❌ Wrong — overrides .page { display: none } and makes assessment always visible */
#page-assessment {
  display: flex;
}
```

### Toast Notifications

```css
.toast-container {
  position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
  z-index: 1000; pointer-events: none;
}
.toast-item {
  padding: 12px 24px; border-radius: 8px; color: #fff;
  background: rgba(239,68,68,0.92); backdrop-filter: blur(8px);
  animation: toastIn 0.25s ease, toastOut 0.25s ease 2.6s forwards;
}
/* Types: .warn (orange), .info (blue) */
```

### Company Cards Grid

12 companies in 4 columns:

```css
.company-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.company-card { border: 1px solid var(--border); }
.company-card.best-match { border-color: var(--primary); border-width: 2px; }
```

### Responsive Breakpoints

```css
@media (max-width: 900px) {
  .assess-main { grid-template-columns: 1fr; }
  .card-pool { grid-template-columns: repeat(3, 1fr); }
  .company-cards { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .company-cards { grid-template-columns: repeat(2, 1fr); }
}
```
