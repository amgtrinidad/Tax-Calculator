# Tax Calculator (Annual • Quarterly • Persistent)

A lightweight web app for tracking monthly entries with quarterly views, live subtotals, PNG export, and offline support.

## Features
- Months **JAN–DEC**
- Columns:
  1) Month
  2) DDV IN
  3) DDV OPD
  4) BFD IN
  5) BFD OPD
  6) NGH
  7) TMCP
  8) OTHERS
  9) PROJECTS
  10) REMARKS
- Up to **7 entries per month per category** (columns 2–9)
- **Live quarterly subtotals** for columns 2–9
- **Quarter tabs** (Q1–Q4)
- **Save Quarter** (autosave + downloads a JSON backup)
- **Export Quarterly PNG** (no external libraries)
- **Annual Grand Total** button
- **PWA**: Works offline and installable to Home Screen

## GitHub Pages
1. Create a repo named `Tax-Calculator`.
2. Upload all files in this folder (keep structure).
3. Settings → Pages → Deploy from branch → `main` → `/` (root).
4. Open the Pages URL and **Add to Home Screen**.

## Data
- Stored locally in `localStorage` (per device/browser).
- Use “Save Quarter” to export JSON backups.

## License
MIT
