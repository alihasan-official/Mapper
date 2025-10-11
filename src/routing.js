// Routing Engine for Multi-Modal Navigation System
// Handles both full route and local route calculations

class NavigationRouter {
  constructor(map, api) {
    this.map = map;
    this.api = api;
    this.currentRoutes = [];
    this.routeMode = 'full'; // 'full' or 'local'
    this.transportTypes = ['bus', 'metro', 'taxi', 'rickshaw'];
  }

  // Main route calculation function
  async calculateRoute(origin, destination, mode = 'full', transportTypes = null) {
    try {
      this.routeMode = mode;
      if (transportTypes) {
        this.transportTypes = transportTypes;
      }

      // Clear existing routes
      this.clearRoutes();

      if (mode === 'full') {
        return await this.calculateFullRoute(origin, destination);
      } else {
        return await this.calculateLocalRoute(origin, destination);
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      throw error;
    }
  }

  // Full route calculation (point-to-point)
  async calculateFullRoute(origin, destination) {
    const coords = [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ];

    const routeData = await this.api.fetchOSRMRoute(coords, 'driving');
    
    if (!routeData.routes || routeData.routes.length === 0) {
      throw new Error('No route found between the selected points.');
    }

    const route = routeData.routes[0];
    const geometry = routeData.routes[0].geometry;
    
    // Create route polyline
    const routePolyline = L.polyline(geometry.coordinates.map(coord => [coord[1], coord[0]]), {
      color: '#4890E8',
      weight: 6,
      opacity: 0.8,
      className: 'route-line'
    }).addTo(this.map);

    // Add route info
    const routeInfo = {
      type: 'full',
      distance: route.distance,
      duration: route.duration,
      geometry: geometry,
      polyline: routePolyline,
      steps: route.legs[0].steps || []
    };

    this.currentRoutes.push(routeInfo);
    
    // Fit map to route
    this.map.fitBounds(routePolyline.getBounds(), { padding: [20, 20] });

    return routeInfo;
  }

  // Local route calculation (multi-modal)
  async calculateLocalRoute(origin, destination) {
    const maxWalkDistance = 2000; // 2km max walking distance
    const hubSearchRadius = 1000; // 1km radius for hub search

    // Step 1: Find transport hubs near origin
    const originHubs = await this.api.findNearestTransportHubs(
      origin, 
      hubSearchRadius, 
      this.transportTypes
    );

    // Step 2: Find transport hubs near destination
    const destinationHubs = await this.api.findNearestTransportHubs(
      destination, 
      hubSearchRadius, 
      this.transportTypes
    );

    if (originHubs.length === 0 && destinationHubs.length === 0) {
      // No transport hubs found, fall back to walking route
      return await this.calculateWalkingRoute(origin, destination);
    }

    // Step 3: Calculate possible route combinations
    const routeOptions = [];

    // Direct walking route
    const walkingRoute = await this.calculateWalkingRoute(origin, destination);
    if (walkingRoute.distance <= maxWalkDistance) {
      routeOptions.push({
        type: 'walking',
        distance: walkingRoute.distance,
        duration: walkingRoute.duration,
        segments: [walkingRoute],
        transfers: 0
      });
    }

    // Routes with transport hubs
    for (const originHub of originHubs.slice(0, 3)) {
      for (const destHub of destinationHubs.slice(0, 3)) {
        try {
          const route = await this.calculateHubToHubRoute(origin, originHub, destHub, destination);
          if (route) {
            routeOptions.push(route);
          }
        } catch (error) {
          console.warn('Failed to calculate hub-to-hub route:', error);
        }
      }
    }

    // Sort routes by total duration
    routeOptions.sort((a, b) => a.duration - b.duration);

    // Take top 3 routes
    const topRoutes = routeOptions.slice(0, 3);

    if (topRoutes.length === 0) {
      throw new Error('No suitable routes found. Try adjusting your destination or transport preferences.');
    }

    // Render all route options
    this.renderRouteOptions(topRoutes);

    return topRoutes;
  }

  // Calculate route from origin to hub to destination hub to destination
  async calculateHubToHubRoute(origin, originHub, destHub, destination) {
    const segments = [];
    let totalDistance = 0;
    let totalDuration = 0;

    try {
      // Segment 1: Origin to origin hub (walking)
      const walkToOriginHub = await this.calculateWalkingRoute(origin, {
        lat: originHub.lat,
        lng: originHub.lng
      });
      segments.push({
        type: 'walking',
        ...walkToOriginHub,
        description: `Walk to ${originHub.name}`,
        icon: '🚶'
      });

      // Segment 2: Origin hub to destination hub (transport)
      const transportSegment = await this.calculateTransportSegment(originHub, destHub);
      segments.push({
        type: 'transport',
        transportType: originHub.type,
        ...transportSegment,
        description: `Take ${this.getTransportName(originHub.type)} to ${destHub.name}`,
        icon: this.getTransportIcon(originHub.type),
        hub: originHub,
        destinationHub: destHub
      });

      // Segment 3: Destination hub to destination (walking)
      const walkFromDestHub = await this.calculateWalkingRoute({
        lat: destHub.lat,
        lng: destHub.lng
      }, destination);
      segments.push({
        type: 'walking',
        ...walkFromDestHub,
        description: `Walk to destination`,
        icon: '🚶'
      });

      // Calculate totals
      totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
      totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

      return {
        type: 'multi-modal',
        distance: totalDistance,
        duration: totalDuration,
        segments: segments,
        transfers: 1,
        originHub: originHub,
        destinationHub: destHub
      };
    } catch (error) {
      console.warn('Error calculating hub-to-hub route:', error);
      return null;
    }
  }

  // Calculate walking route between two points
  async calculateWalkingRoute(origin, destination) {
    const coords = [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ];

    const routeData = await this.api.fetchOSRMRoute(coords, 'foot');
    
    if (!routeData.routes || routeData.routes.length === 0) {
      throw new Error('Walking route not available');
    }

    const route = routeData.routes[0];
    const geometry = routeData.routes[0].geometry;

    return {
      distance: route.distance,
      duration: route.duration,
      geometry: geometry,
      coordinates: geometry.coordinates.map(coord => [coord[1], coord[0]])
    };
  }

  // Calculate transport segment with proper route calculation
  async calculateTransportSegment(originHub, destHub) {
    try {
      // Try to get actual route using OSRM
      const coords = [
        [originHub.lng, originHub.lat],
        [destHub.lng, destHub.lat]
      ];

      // Use driving profile for most transport types
      const profile = this.getTransportProfile(originHub.type);
      const routeData = await this.api.fetchOSRMRoute(coords, profile);
      
      if (routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];
        return {
          distance: route.distance,
          duration: route.duration,
          coordinates: route.geometry.coordinates.map(coord => [coord[1], coord[0]])
        };
      }
    } catch (error) {
      console.warn('Failed to get transport route, using fallback:', error);
    }

    // Fallback to direct line calculation
    const distance = this.api.calculateDistance(
      originHub.lat, originHub.lng,
      destHub.lat, destHub.lng
    ) * 1000; // Convert to meters

    // Estimate transport speed based on type
    const speeds = {
      'bus_station': 25, // km/h
      'metro': 40,
      'taxi': 30,
      'rickshaw': 20,
      'bus_stop': 25,
      'transport_hub': 25
    };

    const speed = speeds[originHub.type] || 25;
    const duration = (distance / 1000) / speed * 3600; // Convert to seconds

    return {
      distance: distance,
      duration: duration,
      coordinates: [
        [originHub.lng, originHub.lat],
        [destHub.lng, destHub.lat]
      ]
    };
  }

  // Get appropriate OSRM profile for transport type
  getTransportProfile(transportType) {
    const profiles = {
      'bus_station': 'driving',
      'metro': 'driving', // Metro routes are often underground, use driving as approximation
      'taxi': 'driving',
      'rickshaw': 'driving',
      'bus_stop': 'driving',
      'transport_hub': 'driving'
    };
    return profiles[transportType] || 'driving';
  }

  // Render multiple route options on the map
  renderRouteOptions(routes) {
    const colors = ['#4890E8', '#5EBE86', '#F29F51'];
    
    routes.forEach((route, index) => {
      if (route.type === 'walking') {
        // Single walking route
        const polyline = L.polyline(route.segments[0].coordinates, {
          color: colors[index],
          weight: 6,
          opacity: 0.8,
          dashArray: '10, 10'
        }).addTo(this.map);
        
        route.polyline = polyline;
      } else if (route.type === 'multi-modal') {
        // Multi-segment route
        const polylines = [];
        
        route.segments.forEach((segment, segIndex) => {
          const color = colors[index];
          const style = segment.type === 'walking' ? 
            { dashArray: '10, 10', weight: 4 } : 
            { weight: 6 };
          
          const polyline = L.polyline(segment.coordinates, {
            color: color,
            opacity: 0.8,
            ...style
          }).addTo(this.map);
          
          polylines.push(polyline);
          
          // Add waypoint markers for transport hubs
          if (segment.type === 'transport') {
            const hubIcon = L.divIcon({
              html: `<div class="transport-hub-marker" style="background: ${color}">${segment.icon}</div>`,
              iconSize: [30, 30],
              className: 'transport-hub-icon'
            });
            
            const marker = L.marker([segment.hub.lat, segment.hub.lng], { icon: hubIcon })
              .addTo(this.map)
              .bindPopup(`
                <div class="hub-popup">
                  <h3>${segment.hub.name}</h3>
                  <p>${segment.description}</p>
                </div>
              `);
            
            polylines.push(marker);
          }
        });
        
        route.polylines = polylines;
      }
      
      this.currentRoutes.push(route);
    });

    // Fit map to show all routes
    if (this.currentRoutes.length > 0) {
      const bounds = L.latLngBounds();
      this.currentRoutes.forEach(route => {
        if (route.polyline) {
          bounds.extend(route.polyline.getBounds());
        } else if (route.polylines) {
          route.polylines.forEach(polyline => {
            if (polyline.getBounds) {
              bounds.extend(polyline.getBounds());
            }
          });
        }
      });
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  // Clear all current routes from map
  clearRoutes() {
    this.currentRoutes.forEach(route => {
      if (route.polyline) {
        this.map.removeLayer(route.polyline);
      }
      if (route.polylines) {
        route.polylines.forEach(polyline => {
          this.map.removeLayer(polyline);
        });
      }
    });
    this.currentRoutes = [];
  }

  // Helper functions
  getTransportName(type) {
    const names = {
      'bus_station': 'Bus',
      'metro': 'Metro',
      'taxi': 'Taxi/CNG',
      'rickshaw': 'Rickshaw'
    };
    return names[type] || 'Transport';
  }

  getTransportIcon(type) {
    const icons = {
      'bus_station': '🚌',
      'metro': '🚇',
      'taxi': '🚕',
      'rickshaw': '🛺'
    };
    return icons[type] || '🚌';
  }

  // Format duration for display
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Format distance for display
  formatDistance(meters) {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }
}

// Export for use in other files
window.NavigationRouter = NavigationRouter;
