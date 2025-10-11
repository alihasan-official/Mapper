// API Integration Layer for Multi-Modal Navigation System
// Handles all external API calls with rate limiting and error handling

class NavigationAPI {
  constructor() {
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Rate limiting helper
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  // Cache helper
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  // OSRM Routing API with enhanced error handling and fallbacks
  async fetchOSRMRoute(coords, profile = 'driving') {
    const cacheKey = `osrm_${profile}_${coords.join('_')}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimit();

    // Try multiple OSRM servers for redundancy
    const servers = [
      'https://router.project-osrm.org',
      'https://routing.openstreetmap.de'
    ];

    for (const server of servers) {
      try {
        const coordString = coords.map(coord => `${coord[1]},${coord[0]}`).join(';');
        const url = `${server}/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&steps=true`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'MultiModalNavigation/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`OSRM API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 'Ok') {
          throw new Error(`OSRM routing error: ${data.message}`);
        }

        this.setCache(cacheKey, data);
        return data;
      } catch (error) {
        console.warn(`OSRM server ${server} failed:`, error.message);
        if (server === servers[servers.length - 1]) {
          // Last server failed, create fallback route
          return this.createFallbackRoute(coords, profile);
        }
      }
    }
  }

  // Create fallback route when OSRM is unavailable
  createFallbackRoute(coords, profile) {
    const [start, end] = coords;
    const distance = this.calculateDistance(start[1], start[0], end[1], end[0]) * 1000; // meters
    
    // Estimate duration based on profile
    const speeds = {
      'driving': 50, // km/h
      'foot': 5,
      'cycling': 15
    };
    
    const speed = speeds[profile] || 50;
    const duration = (distance / 1000) / speed * 3600; // seconds
    
    return {
      code: 'Ok',
      routes: [{
        distance: distance,
        duration: duration,
        geometry: {
          type: 'LineString',
          coordinates: coords.map(coord => [coord[1], coord[0]])
        },
        legs: [{
          steps: [{
            distance: distance,
            duration: duration,
            geometry: {
              type: 'LineString',
              coordinates: coords.map(coord => [coord[1], coord[0]])
            }
          }]
        }]
      }]
    };
  }

  // Overpass API for transport amenities with enhanced error handling
  async fetchOverpassTransport(bounds, types = ['bus_station', 'taxi', 'public_transport']) {
    const cacheKey = `overpass_${bounds.join('_')}_${types.join('_')}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimit();

    // Try multiple Overpass servers
    const servers = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter'
    ];

    for (const server of servers) {
      try {
        const [north, west, south, east] = bounds;
        
        // Build Overpass QL query with timeout
        const amenityQueries = types.map(type => 
          `node["amenity"="${type}"](bbox:${south},${west},${north},${east});`
        ).join('\n');
        
        const publicTransportQuery = `node["public_transport"](bbox:${south},${west},${north},${east});`;
        
        const query = `[out:json][timeout:15];
(
  ${amenityQueries}
  ${publicTransportQuery}
);
out body;`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

        const response = await fetch(server, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'MultiModalNavigation/1.0'
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate response
        if (!data.elements) {
          throw new Error('Invalid Overpass response');
        }

        this.setCache(cacheKey, data);
        return data;
      } catch (error) {
        console.warn(`Overpass server ${server} failed:`, error.message);
        if (server === servers[servers.length - 1]) {
          // All servers failed, return empty result
          console.warn('All Overpass servers failed, returning empty transport data');
          return { elements: [] };
        }
      }
    }
  }

  // Nominatim Geocoding API
  async geocodeLocation(query, limit = 5) {
    const cacheKey = `geocode_${query}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimit();

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MultiModalNavigation/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Nominatim API Error:', error);
      throw new Error('Failed to search location. Please try again.');
    }
  }

  // Reverse geocoding
  async reverseGeocode(lat, lng) {
    const cacheKey = `reverse_${lat}_${lng}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.rateLimit();

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MultiModalNavigation/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Nominatim Reverse API Error:', error);
      throw new Error('Failed to get address. Please try again.');
    }
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Find nearest transport hubs within radius
  async findNearestTransportHubs(location, radius = 2000, types = ['bus_station', 'taxi', 'public_transport']) {
    try {
      const bounds = this.calculateBounds(location, radius);
      const transportData = await this.fetchOverpassTransport(bounds, types);
      
      if (!transportData.elements) return [];

      // Filter and sort by distance
      const hubs = transportData.elements
        .filter(element => element.lat && element.lon)
        .map(element => ({
          id: element.id,
          name: element.tags?.name || element.tags?.amenity || 'Transport Hub',
          type: this.determineTransportType(element.tags),
          lat: element.lat,
          lng: element.lon,
          tags: element.tags,
          distance: this.calculateDistance(location.lat, location.lng, element.lat, element.lon)
        }))
        .filter(hub => hub.distance <= radius / 1000) // Convert radius to km
        .sort((a, b) => a.distance - b.distance);

      return hubs;
    } catch (error) {
      console.error('Error finding transport hubs:', error);
      return [];
    }
  }

  // Calculate bounds for a location and radius
  calculateBounds(location, radius) {
    const lat = location.lat;
    const lng = location.lng;
    const latDelta = radius / 111000; // Rough conversion: 1 degree ≈ 111km
    const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
    
    return [
      lat + latDelta, // north
      lng - lngDelta, // west
      lat - latDelta, // south
      lng + lngDelta  // east
    ];
  }

  // Determine transport type from OSM tags
  determineTransportType(tags) {
    if (tags.amenity === 'bus_station') return 'bus_station';
    if (tags.amenity === 'taxi') return 'taxi';
    if (tags.public_transport === 'station') return 'metro';
    if (tags.public_transport === 'stop_position') return 'bus_stop';
    if (tags.highway === 'bus_stop') return 'bus_stop';
    return 'transport_hub';
  }

  // Get current location
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }
}

// Export for use in other files
window.NavigationAPI = NavigationAPI;
