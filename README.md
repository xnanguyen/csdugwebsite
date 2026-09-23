# Brown CS DUG Website

## Run Locally

Install **Node.js 22+**. Node.js 24 LTS is recommended.

Open a terminal in the project folder and run:

```bash
npm ci
npm run dev
```

Open the URL shown in the terminal, usually:

```text
http://127.0.0.1:4173
```

The site will refresh as you edit files.

To stop the local server:

```bash
Ctrl + C
```

## Useful Commands

```bash
npm run check      # Check project files and config
npm test           # Run tests
npm run build      # Build the production site into dist/
npm run preview    # Preview the production build
```

> Do not edit files inside `dist/` directly. The folder is generated automatically when the project is built.
