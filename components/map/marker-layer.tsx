'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import type { Poi } from '@/lib/types';
import { toFeatureCollection } from '@/lib/data/selectors';
import { registerMarkerImages, watchDevicePixelRatio } from './marker-images';
import { CLUSTER_COUNT_LAYER, CLUSTERS_LAYER } from './cluster-layer';
import { useSelection } from './use-selection';
import { MarkerTooltip } from './marker-tooltip';

const SOURCE_ID = 'pois';

const POI_MARKERS_LAYER: SymbolLayerSpecification = {
  id: 'poi-markers',
  type: 'symbol',
  source: SOURCE_ID,
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': ['concat', 'marker-', ['get', 'primary']],
    'icon-size': 1,
    'icon-allow-overlap': true,
    'icon-ignore-placement': false,
    'symbol-sort-key': ['get', 'sortKey'],
  },
  paint: {
    // Visited state — feature-state, because icon-opacity is a paint property (icon-image,
    // which carries the selected sprite, is layout and cannot read feature-state at all).
    'icon-opacity': ['case', ['boolean', ['feature-state', 'visited'], false], 0.85, 1],
  },
};

const POI_MARKER_SELECTED_LAYER: SymbolLayerSpecification = {
  id: 'poi-marker-selected',
  type: 'symbol',
  source: SOURCE_ID,
  filter: ['==', ['id'], -1],
  layout: {
    'icon-image': ['concat', 'marker-', ['get', 'primary'], '-selected'],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

interface MarkerLayerProps {
  mapRef: RefObject<maplibregl.Map | null>;
  ready: boolean;
  pois: Poi[];
}

export function MarkerLayer({ mapRef, ready, pois }: MarkerLayerProps) {
  const layersAddedRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || layersAddedRef.current) return;
    layersAddedRef.current = true;

    registerMarkerImages(map);
    const unwatchDpr = watchDevicePixelRatio(() => registerMarkerImages(map, true));

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: toFeatureCollection(pois),
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 12,
      // No promoteId — the id is already at the top level of each Feature (see
      // toFeatureCollection), and promoteId would blank it out with properties.<name> instead.
    });
    map.addLayer(CLUSTERS_LAYER);
    map.addLayer(CLUSTER_COUNT_LAYER);
    map.addLayer(POI_MARKERS_LAYER);
    map.addLayer(POI_MARKER_SELECTED_LAYER);

    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_E2E === 'true') {
      (window as unknown as { __map: maplibregl.Map }).__map = map;
    }

    return () => {
      unwatchDpr();
    };
    // pois is intentionally excluded — the effect below handles data updates via setData so
    // the source and layers are never removed and re-added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersAddedRef.current) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(pois));
  }, [mapRef, pois]);

  useSelection(mapRef, ready, pois);

  return <MarkerTooltip mapRef={mapRef} pois={pois} />;
}
