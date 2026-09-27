# log-ui web

React + TypeScript single-page app for log-ui, built with Vite, Tailwind and shadcn/ui components.
It talks only to the JSON API under `/api` (types in `src/types.ts` mirror `log_ui/api.py`).

```
npm ci
npm run dev         # http://localhost:5173, proxies /api to http://127.0.0.1:8765 (run `uv run log-ui` alongside)
npm test            # vitest
npm run typecheck
npm run lint        # oxlint
npm run build       # writes ../log_ui/static, which is committed and shipped in the wheel
```

Layout: `src/routes` (pages), `src/components` (charts, runs table, view panels, layout; `ui/` is generated
shadcn code), `src/lib` (API client, URL state, series helpers), `src/hooks`.
