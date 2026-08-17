import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __map?: import('maplibre-gl').Map;
  }
}

// window.__map is set once the 'pois' source and its layers are added (see marker-layer.tsx),
// which only happens after the map's 'load' event — a more reliable ready-signal here than
// isStyleLoaded(), which can flip transiently false again right after addSource/addLayer.
async function waitForMap(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__map != null, { timeout: 20_000 });
}

// Picks a rendered feature whose pixel sits clear of the floating search bar (top), the
// result sheet (bottom) and the FAB stack (bottom-right) — any of which would otherwise
// intercept the click/hover before it reaches the map canvas underneath.
async function pickSafePoint(page: import('@playwright/test').Page, layer: string) {
  return page.evaluate((layerId) => {
    const canvas = window.__map!.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const features = window.__map!.queryRenderedFeatures({ layers: [layerId] });
    for (const feature of features) {
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const p = window.__map!.project(coords);
      const clearOfChrome = p.y > 110 && p.y < h - 100 && p.x < w - 90;
      if (clearOfChrome) return { x: p.x, y: p.y, slug: feature.properties!.sortKey as string };
    }
    throw new Error(`no rendered feature in ${layerId} sits clear of the UI chrome`);
  }, layer);
}

async function pickSafeMarkerPoint(page: import('@playwright/test').Page) {
  return pickSafePoint(page, 'poi-markers');
}

// jumpTo is synchronous, but supercluster re-indexing for the new viewport happens on the
// worker and only then does a render pass make queryRenderedFeatures return anything.
async function jumpToAndSettle(
  page: import('@playwright/test').Page,
  center: [number, number],
  zoom: number,
) {
  await page.evaluate(
    ([c, z]) => window.__map!.jumpTo({ center: c, zoom: z }),
    [center, zoom] as const,
  );
  await page.waitForFunction(() => window.__map!.isSourceLoaded('pois') === true, {
    timeout: 10_000,
  });
  // isSourceLoaded flips true before the resulting frame is actually painted.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

test.describe('map markers and clustering', () => {
  test('renders every hotel in the source at a Florida-wide view', async ({ page, request }) => {
    await page.goto('/search');
    await waitForMap(page);

    const dataset = await request.get('/data/pois.v1.json').then((r) => r.json());

    const sourceFeatureCount = await page.evaluate(() => {
      const source = window.__map!.getSource('pois')!.serialize() as { data: GeoJSON.FeatureCollection };
      return source.data.features.length;
    });

    expect(sourceFeatureCount).toBe(dataset.pois.length);
  });

  test('clusters at low zoom, expands to individual markers on zoom in', async ({ page }) => {
    await page.goto('/search');
    await waitForMap(page);

    await jumpToAndSettle(page, [-81.6, 27.9], 6.2);
    const clusterCount = await page.evaluate(
      () => window.__map!.queryRenderedFeatures({ layers: ['clusters'] }).length,
    );
    expect(clusterCount).toBeGreaterThan(0);

    await jumpToAndSettle(page, [-81.4, 28.45], 13);
    const markerCount = await page.evaluate(
      () => window.__map!.queryRenderedFeatures({ layers: ['poi-markers'] }).length,
    );
    expect(markerCount).toBeGreaterThan(0);
  });

  test('tapping a cluster zooms in', async ({ page }) => {
    await page.goto('/search');
    await waitForMap(page);
    await jumpToAndSettle(page, [-81.6, 27.9], 6.2);

    const zoomBefore = await page.evaluate(() => window.__map!.getZoom());
    const point = await pickSafePoint(page, 'clusters');

    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(
      (prevZoom) => window.__map!.getZoom() > prevZoom,
      zoomBefore,
      { timeout: 10_000 },
    );
  });

  test('tapping a marker selects it via ?hotel=, tapping the background clears it', async ({
    page,
  }) => {
    await page.goto('/search');
    await waitForMap(page);
    await jumpToAndSettle(page, [-81.4, 28.45], 13);

    const point = await pickSafeMarkerPoint(page);

    await page.mouse.click(point.x, point.y);
    await expect(page).toHaveURL(/hotel=/);

    const selectedFilter = await page.evaluate(() =>
      JSON.stringify(window.__map!.getFilter('poi-marker-selected')),
    );
    expect(selectedFilter).not.toContain('-1');

    // Tap somewhere with no marker underneath — clear of the search bar (top ~100px) and
    // sheet (bottom ~90px), and verified clear of every other rendered marker too.
    const emptyPoint = await page.evaluate(() => {
      const markers = window.__map!.queryRenderedFeatures({ layers: ['poi-markers'] });
      const projected = markers.map((f) => {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        return window.__map!.project([lng, lat]);
      });
      const canvas = window.__map!.getCanvas();
      const candidates: { x: number; y: number }[] = [];
      for (let x = 20; x < canvas.clientWidth - 20; x += 40) {
        candidates.push({ x, y: canvas.clientHeight / 2 });
      }
      const clear = candidates.find(
        (c) => !projected.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 40),
      );
      if (!clear) throw new Error('could not find an empty point on the map');
      return clear;
    });
    await page.mouse.click(emptyPoint.x, emptyPoint.y);
    await expect(page).not.toHaveURL(/hotel=/);
  });

  test('desktop hover shows a tooltip with the hotel name; touch shows none', async ({
    page,
    request,
  }, testInfo) => {
    await page.goto('/search');
    await waitForMap(page);
    await jumpToAndSettle(page, [-81.4, 28.45], 13);

    const { x, y, slug } = await pickSafeMarkerPoint(page);
    const point = { x, y };
    const dataset = await request.get('/data/pois.v1.json').then((r) => r.json());
    const poi = dataset.pois.find((p: { slug: string }) => p.slug === slug);

    const isDesktop = testInfo.project.name === 'Desktop Chrome';
    // Steps produce intermediate mousemove events along the path — a single jump can land in
    // one browser paint tick without MapLibre's own move handling having caught up.
    await page.mouse.move(0, 0);
    await page.mouse.move(point.x, point.y, { steps: 10 });

    if (isDesktop) {
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible({ timeout: 5_000 });
      await expect(tooltip).toContainText(poi.name);
    } else {
      await page.waitForTimeout(300);
      expect(await page.getByRole('tooltip').count()).toBe(0);
    }
  });
});
