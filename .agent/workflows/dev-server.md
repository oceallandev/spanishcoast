---
description: Start a live-reload dev server to test changes instantly in the browser
---

# Live Dev Server

This workflow launches a local dev server with **automatic browser reload** whenever you save a file.

// turbo-all

1. Start the live-reload server (opens the browser automatically):

```bash
cd /Users/adrianchiscop/Projects/Spanish\ Coast\ Properties\ A1 && npx -y live-server --port=8080 --no-browser
```

1. Open a specific page to test:
   - Properties: <http://localhost:8080/properties.html>
   - Businesses: <http://localhost:8080/businesses.html>
   - New Builds: <http://localhost:8080/new-builds.html>

The server watches all files and auto-refreshes the browser when any file changes. No need to manually refresh.

Press `Ctrl+C` in the terminal to stop the server.
