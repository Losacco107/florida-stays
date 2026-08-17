import type { CircleLayerSpecification, SymbolLayerSpecification } from 'maplibre-gl';

// Deliberately neutral — a cluster mixes themes, so giving it a theme colour would lie.
export const CLUSTERS_LAYER: CircleLayerSpecification = {
  id: 'clusters',
  type: 'circle',
  source: 'pois',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#1a1a1c',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
    'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 25, 28, 50, 28],
  },
};

export const CLUSTER_COUNT_LAYER: SymbolLayerSpecification = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'pois',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 12,
  },
  paint: {
    'text-color': '#ffffff',
  },
};
