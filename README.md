# Aquarium Parameter Tracker

A single-page, fully local aquarium tracking app. No install, no server, no
account &mdash; your data lives only in your browser.

## Getting started

Just open `index.html` in your browser (double-click it, or drag it into a
browser window). That's it.

For the most reliable experience (some browsers restrict local-file
features), you can also serve the folder locally, e.g.:

```
npx http-server .
```

then visit the printed `http://localhost:...` address.

## What it does

- **Multiple tanks** &mdash; track as many tanks as you want, each with its
  own profile: setup date (auto-computed age), size, filter, CO2, substrate,
  plants, and stocking list.
- **Target ranges** &mdash; set your own target temp/pH/GH/KH/nitrate ranges
  per tank so feedback is tailored to your setup and species, not generic
  advice.
- **Water test logging** &mdash; log temperature, pH, ammonia, nitrite,
  nitrate, GH, KH, and phosphate over time, either one at a time or by
  **importing a CSV** exported from a test-strip app or spreadsheet.
- **Water change log** &mdash; track when and how much water you changed.
- **Feedback** &mdash; a rules-based engine flags danger/warning/info items
  based on your latest test, your target ranges, tank age (cycling), and
  water change recency.
- **Charts** &mdash; a simple trend chart per parameter.
- **Ask Claude**
  - **Export Summary**: generates a plain-text summary of the tank profile,
    recent tests, water changes, and computed feedback that you can copy or
    download and paste into any Claude conversation.
  - **Direct Chat (optional)**: lets you paste your own Anthropic API key
    (stored only in your browser's local storage) to ask Claude questions
    about the tank directly from the app. This calls `api.anthropic.com`
    straight from your browser and may not work in every browser depending
    on its network/security settings &mdash; the Export Summary option
    always works as a fallback.

## Data & backups

All data is stored in your browser's `localStorage`, scoped to wherever you
opened `index.html` from. Nothing is sent anywhere except the optional
direct Claude chat feature, which only talks to `api.anthropic.com` and only
if you supply your own API key.

Because `localStorage` is local to a browser (and can behave inconsistently
for `file://` pages across different browsers/profiles), use **Export
Backup (.json)** in the top bar regularly, and **Import Backup** to restore
it, or to move your data to another computer/browser.

## Files

- `index.html` &mdash; page structure
- `style.css` &mdash; styling (supports light/dark based on OS preference)
- `app.js` &mdash; all application logic (state, rendering, feedback engine,
  CSV import/export, chart rendering, Claude integration)

No build step, no dependencies, no external network calls except the
optional direct Claude chat.
