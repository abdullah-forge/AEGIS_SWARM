# TODO - AEGIS_SWARM UI Improvements

## Step 1: Verify styling foundations
- [x] Read `dashboard/app/globals.css` (glass-card, glow effects, background, scrollbar)
- [x] Confirm any missing keyframes used by UI (e.g., `fadeIn`)

## Step 2: Implement missing animation + small utility styles
- [x] Update `dashboard/app/globals.css`
  - [x] Add `@keyframes fadeIn`
  - [ ] (If needed) add small UI utility classes for consistent hover/section accents

## Step 3: Improve UI/UX for both modules (Text + QR)
- [x] Update `dashboard/app/page.tsx`
  - [x] Add skeleton/loading placeholders when `loading` / `qrLoading` are true
  - [x] Add empty-state helper text when results are null
  - [x] Add consistent verdict badges (HIGH/LOW) for text + QR
  - [x] Add simple confidence meter (progress bar) based on `confidence`
  - [x] Add accessibility improvements:
    - [x] Label textarea + file input (visually hidden is fine)
    - [x] Add `aria-live="polite"` region for results updates

## Step 4: Safety checks
- [x] Ensure formatting is robust if backend omits fields (e.g., confidence/model_used)
- [x] Do NOT change:
  - fetch URLs
  - request methods
  - request/response shapes
  - backend logic

## Step 5: Build/lint verification (optional but recommended)
- [ ] Run `dashboard` Next.js lint/build and fix any TS/ESLint issues if they appear
