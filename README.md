# Sorava

Sorava is a lightweight browser-based observation support app for astronomy events.

The current MVP focuses on:

- Sky view on smartphone browsers
- Moon and planet positions calculated on the client
- Target guidance from the Sky center
- Host / Guest session sharing
- Target sharing, sharing OFF, and direction sharing

## Local Development

```bash
npm install
npm run server
npm run dev
```

## Build Check

```bash
npx tsc -b
npm run build
```

## Test Deployment

Deployment notes for the club test are in:

- [docs/deploy.md](docs/deploy.md)
- [docs/test-checklist.md](docs/test-checklist.md)

## Important Notes

- The frontend can be hosted on GitHub Pages.
- The WebSocket/API server must be hosted separately, such as Render Free.
- Do not add a Service Worker before the club test to avoid cache issues.
