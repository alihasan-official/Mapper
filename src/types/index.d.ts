// Basic application types
interface AppMarker {
  id?: string;
  type: 'marker';
  lat: number;
  lng: number;
  title: string;
  description?: string;
  category?: string;
  timestamp?: number;
}

interface AppShape {
  id?: string;
  type: 'shape';
  shapeType: string;
  geoJSON: GeoJSON.GeoJsonObject;
  style?: {
    color?: string;
    weight?: number;
    fillColor?: string;
    fillOpacity?: number;
  };
  timestamp?: number;
}

interface AppUser {
  uid: string;
  name?: string;
  imgsrc?: string;
  color?: string;
  active?: boolean;
  view?: [number, number];
  zoom?: number;
}

// Nominatim search result (simplified)
interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  importance?: number;
}

// Firebase data wrapper
interface FirebaseFeature {
  [key: string]: unknown;
}
