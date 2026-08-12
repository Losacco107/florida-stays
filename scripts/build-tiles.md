# Building and hosting the Florida PMTiles basemap

One-off procedure — re-run only when Protomaps cuts a new planet build you want to pick up.
Until this is done, the app falls back to Protomaps' public demo tiles and logs a warning
(see `components/map/use-map-instance.ts`).

## 1. Extract the Florida slice

```bash
npm install -g pmtiles
pmtiles extract https://build.protomaps.com/<latest>.pmtiles florida.pmtiles \
  --bbox=-87.7,24.3,-79.8,31.1 --maxzoom=14
```

Find `<latest>` at https://maps.protomaps.com/builds/ — pick the newest date.

## 2. Create the R2 bucket

1. Cloudflare dashboard → R2 → **Create bucket**, e.g. `florida-stays-tiles`.
2. Make it public (Settings → Public access → Allow), or attach a custom domain — a custom
   domain is preferred so the URL survives a bucket rename.
3. Settings → Custom Domains → add `tiles.<yourdomain>` and follow the DNS prompt. R2 has zero
   egress fees and sits behind Cloudflare's CDN, which is what makes PMTiles' HTTP range
   requests fast.

## 3. Upload

```bash
npx wrangler r2 object put florida-stays-tiles/florida-2026-08.pmtiles \
  --file florida.pmtiles --content-type application/octet-stream
```

Name the file with the build date (`florida-YYYY-MM.pmtiles`) — PMTiles files are immutable
per URL, so a new extract gets a new filename rather than overwriting the old one in place.

## 4. Point the app at it

```
NEXT_PUBLIC_TILES_URL=https://tiles.<yourdomain>/florida-2026-08.pmtiles
```

Set this in `.env.local` for development and in the Vercel project's environment variables
for production (see `specs/08-deploy.md`). No code change needed — `use-map-instance.ts` reads
this at runtime and patches `public/map-style.json`'s source URL.

## Verifying

```bash
curl -sI "$NEXT_PUBLIC_TILES_URL" | grep -i accept-ranges
```

Should return `accept-ranges: bytes` — if it does not, PMTiles range requests will fail and
the map will either not load or fetch the entire archive per tile.
