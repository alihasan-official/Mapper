$(document).ready(function(){
  // Coordinates to center the map. Could let the user choose when creating a room & persist when sharing a link (via GET params)
  const lat = 22.35;
  const lon = 91.83;

  // Initialize the Leaflet map
  var map = L.map('mapDiv', {
    renderer: L.canvas({ tolerance: 10 })
  }).setView([lat, lon], 13);
  L.PM.setOptIn(true);

  // Initialize navigation system
  function initNavigation() {
    navigationAPI = new NavigationAPI();
    navigationRouter = new NavigationRouter(map, navigationAPI);
  }
  
  var mapname = "Multi-Modal Navigation";
  var mapdescription = "Explore routes and transport options worldwide";
  var editingname = false;
  var editingdescription = false;
  var dragging = false;
  var enteringdata = false;
  var cursorcoords = [0,0];
  var session = 0;
  var drawing = false;
  var erasing = false;
  var markerson = false;
  var lineon = false;
  var linelastcoord = [0,0];
  var observing = {status:false, id:0};
  var linedistance = 0;
  var mousedown = false;
  var objects = [];
  var currentid = 0;
  var color = "#634FF1";
  var cursors = [];
  var userlocation = "";
  var places = [];
  var place_ids = [];
  var room = "";

  // Navigation system variables
  var navigationAPI = null;
  var navigationRouter = null;
  var currentRouteMode = 'full';
  var transportHubs = [];
  var routeResults = [];

  // Available cursor colors
  var colors = ["#EC1D43", "#EC811D", "#ECBE1D", "#B6EC1D", "#1DA2EC", "#781DEC", "#CF1DEC", "#222222"];

  // Get URL params
  var params = new URLSearchParams(window.location.search);

  // Check if URL has the file GET parameter, use it to set the room. Could rewrite URL to be more fancy
  if (params.has('file')) {
    room = params.get('file');
    $("#share-url").val(window.location.href);
  }

  // Initialize navigation system with comprehensive error handling
  function initializeNavigationSystem() {
    try {
      // Check if required classes are available
      if (typeof NavigationAPI === 'undefined') {
        throw new Error('NavigationAPI class not found. Please check if api.js is loaded.');
      }
      
      if (typeof NavigationRouter === 'undefined') {
        throw new Error('NavigationRouter class not found. Please check if routing.js is loaded.');
      }

      // Initialize API and Router
      navigationAPI = new NavigationAPI();
      navigationRouter = new NavigationRouter(map, navigationAPI);

      console.log('Navigation system initialized successfully');
      
      // Show status indicator
      $('#system-status').sh    } catch (error) {
      console.error('Failed to initialize navigation system:', error);
      ErrorHandler.showSystemError('Navigation system failed to initialize. Some features may not work properly.', ErrorHandler.types.SYSTEM);
    }('Navigation system failed to initialize. Some features may not work properly.');
    }
  }

  // Test API connectivity
  async function testAPIConnectivity() {
    try {
      // Test Nominatim API
      const testResult = await navigationAPI.geocodeLocation('London', 1);
      if (testResult && testResult.length > 0) {
        console.log('Nominatim API: OK');
      } else {
        console.warn('Nominatim API: No results');
      }
  // Enhanced error handling system
  const ErrorHandler = {
    // Error types
    types: {
      NETWORK: 'network',
      API: 'api', 
      GEOLOCATION: 'geolocation',
      ROUTING: 'routing',
      SEARCH: 'search',
      SYSTEM: 'system'
    },

    // Show system-level errors
    showSystemError(message, type = 'system') {
      const errorId = 'error-' + Date.now();
      const errorHtml = `
        <div id="${errorId}" class="system-error" style="
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #ff5722; 
          color: white; 
          padding: 15px; 
          border-radius: 5px; 
          z-index: 10000;
          max-width: 320px;
          font-family: Inter;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: slideInRight 0.3s ease-out;
        ">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="font-size: 18px;">${this.getErrorIcon(type)}</div>
            <div style="flex: 1;">
              <strong>${this.getErrorTitle(type)}</strong><br>
              ${message}
            </div>
            <button onclick="ErrorHandler.dismissError('${errorId}')" style="
              background: rgba(255,255,255,0.2); 
              border: none; 
              color: white; 
              padding: 4px 8px; 
              border-radius: 3px; 
              cursor: pointer;
              font-size: 12px;
            ">✕</button>
          </div>
          ${this.getErrorActions(type)}
        </div>
      `;
      
      $('body').append(errorHtml);
      
      // Auto-remove after 15 seconds
      setTimeout(() => {
        this.dismissError(errorId);
      }, 15000);

      // Log error for debugging
      console.error(`[${type.toUpperCase()}] ${message}`);
    },

    // Get error icon based on type
    getErrorIcon(type) {
      const icons = {
        network: '🌐',
        api: '⚠️',
        geolocation: '📍',
        routing: '🗺️',
        search: '🔍',
        system: '⚙️'
      };
      return icons[type] || '⚠️';
    },

    // Get error title based on type
    getErrorTitle(type) {
      const titles = {
        network: 'Network Error',
        api: 'API Error',
        geolocation: 'Location Error',
        routing: 'Routing Error',
        search: 'Search Error',
        system: 'System Error'
      };
      return titles[type] || 'Error';
    },

    // Get error-specific actions
    getErrorActions(type) {
      const actions = {
        network: `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
            <button onclick="location.reload()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-right: 5px;">
              Reload Page
            </button>
            <button onclick="ErrorHandler.checkConnection()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
              Check Connection
            </button>
          </div>
        `,
        geolocation: `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
            <button onclick="ErrorHandler.requestLocation()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
              Try Again
            </button>
          </div>
        `
      };
      return actions[type] || '';
    },

    // Dismiss error
    dismissError(errorId) {
      $(`#${errorId}`).fadeOut(300, function() {
        $(this).remove();
      });
    },

    // Check network connection
    async checkConnection() {
      try {
        const response = await fetch('https://httpbin.org/status/200', { 
          method: 'HEAD',
          mode: 'no-cors'
        });
        showSuccessMessage('Connection is working. Please try your action again.');
      } catch (error) {
        this.showSystemError('No internet connection detected. Please check your network settings.', this.types.NETWORK);
      }
    },

    // Request location permission
    requestLocation() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            showSuccessMessage('Location access granted successfully!');
            // Update user location
            liveLocation();
          },
          (error) => {
            let message = 'Unable to access location. ';
            switch(error.code) {
              case error.PERMISSION_DENIED:
                message += 'Please allow location access in your browser settings.';
                break;
              case error.POSITION_UNAVAILABLE:
                message += 'Location information is unavailable.';
                break;
              case error.TIMEOUT:
                message += 'Location request timed out.';
                break;
            }
            this.showSystemError(message, this.types.GEOLOCATION);
          }
        );
      } else {
        this.showSystemError('Geolocation is not supported by this browser.', this.types.GEOLOCATION);
      }
    },

    // Handle API errors
    handleApiError(error, context = '') {
      let message = 'An API error occurred.';
      
      if (error.message) {
        if (error.message.includes('fetch')) {
          message = 'Unable to connect to services. Please check your internet connection.';
          this.showSystemError(message, this.types.NETWORK);
        } else if (error.message.includes('timeout')) {
          message = 'Request timed out. Please try again.';
          this.showSystemError(message, this.types.API);
        } else {
          message = error.message;
          this.showSystemError(message, this.types.API);
        }
      } else {
        this.showSystemError(message + (context ? ` Context: ${context}` : ''), this.types.API);
      }
    },

    // Handle routing errors
    handleRoutingError(error, origin, destination) {
      let message = 'Unable to calculate route.';
      
      if (error.message.includes('No route found')) {
        message = 'No route found between these locations. Try different points or transport options.';
      } else if (error.message.includes('timeout')) {
        message = 'Route calculation timed out. Please try again with closer locations.';
      } else if (error.message.includes('Invalid')) {
        message = 'Invalid location data. Please check your origin and destination.';
      }
      
      this.showSystemError(message, this.types.ROUTING);
    },

    // Handle search errors
    handleSearchError(error, query) {
      let message = `Unable to search for "${query}".`;
      
      if (error.message.includes('not found')) {
        message = `No results found for "${query}". Try a different search term.`;
      } else if (error.message.includes('network')) {
        message = 'Search failed due to network issues. Please try again.';
      }
      
      this.showSystemError(message, this.types.SEARCH);
    }
  };

  // Make ErrorHandler globally available
  window.ErrorHandler = ErrorHandler;

  // Legacy function for backward compatibility
  function showSystemError(message, type = 'system') {
    ErrorHandler.showSystemError(message, type);
  }ds
    setTimeout(() => {
      $('body > div:last-child').fadeOut(500, function() {
        $(this).remove();
      });
    }, 15000);
  }

  // Initialize navigation system
  initializeNavigationSystem();

  function initMap() {
    // Makimum bounds for zooming and panning
    map.setMaxBounds([[-90, -180], [90,180]]);

    // Set the tile layer. Could use Mapbox, OpenStreetMap, etc.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      zoomControl: false,
      minZoom:3,
      noWrap: true
    }).addTo(map);

    // Hide the default zoom control. I want a custom one!
    map.removeControl(map.zoomControl);

    // No idea why but Leaflet seems to place default markers on startup...
    $("img[src='https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png']").remove();
  }

  // Hints for drawing lines or polygons
  var followcursor = L.marker([0, 0], {pane: "overlayPane", interactive:false}).addTo(map);
  followcursor.setOpacity(0);
  var tooltip = followcursor.bindTooltip("", { permanent: true, offset:[5,25], sticky: true, className: "hints", direction:"right"}).addTo(map);
  followcursor.closeTooltip();

  // Show live location
  function liveLocation() {
    if (navigator.geolocation) {
      // Get initial location
      navigator.geolocation.getCurrentPosition(function(position){
        var icon = L.icon({
          iconUrl: 'assets/liveLocation.svg',
          iconSize:     [24, 24],
          iconAnchor:   [12, 12],
        });
        // Create a marker to show the user location
        userlocation = L.marker([position.coords.latitude, position.coords.longitude], {icon:icon, pane: "overlayPane"});
        userlocation.addTo(map);
      });
    }
  }

  function targetLiveLocation() {
    stopObserving();

    // Check if user has geolocation enabled
    if (navigator.geolocation) {
      if (userlocation != "") {
        // If current location is already set, fly there
        navigator.geolocation.getCurrentPosition(function(position){
          userlocation.setLatLng([position.coords.latitude, position.coords.longitude]);

          // Flies to the location (more fancy)
          map.flyTo(userlocation.getLatLng(), 18)
        });
      } else {
        // If the location is unknown, set it and fly there
        liveLocation();
        targetLiveLocation();
      }
    }
  }

  // Tooltips for UI elements
  function showTooltip() {
    if ($(this).attr("id") == "cursor-tool") {
      $(this).append('<div id="tooltip">Move (V)</div>');
    } else if ($(this).attr("id") == "pen-tool") {
      $(this).append('<div id="tooltip">Pencil (P)</div>');
    } else if ($(this).attr("id") == "eraser-tool") {
      $(this).append('<div id="tooltip">Eraser (E)</div>');
    } else if ($(this).attr("id") == "marker-tool") {
      $(this).append('<div id="tooltip">Marker (M)</div>');
    } else if ($(this).attr("id") == "area-tool") {
      $(this).append('<div id="tooltip">Area (A)</div>');
    } else if ($(this).attr("id") == "path-tool") {
      $(this).append('<div id="tooltip">Line (L)</div>');
    }
  }
  function hideTooltip() {
    $(this).find("#tooltip").remove();
  }

  // Reset tools (when switching tools)
  function resetTools() {
    drawing = false;
    erasing = false;
    markerson = false;
    lineon = false;
    map.pm.disableDraw();
    map.pm.disableGlobalRemovalMode();
    map.pm.disableGlobalDragMode();
  }

  // Enable cursor tool (default)
  function cursorTool() {
    resetTools();
    map.dragging.enable();
    $(".tool-active").removeClass("tool-active");
    $("#cursor-tool").addClass("tool-active");
  }

  // Enable pen tool
  function penTool() {
    resetTools();
    drawing = true;
    map.dragging.disable();
    $(".tool-active").removeClass("tool-active");
    $("#pen-tool").addClass("tool-active");
    showAnnotations();
  }

  // Enable eraser tool
  function eraserTool() {
    resetTools();
    erasing = true;
    $(".tool-active").removeClass("tool-active");
    $("#eraser-tool").addClass("tool-active");
    map.pm.enableGlobalRemovalMode();
    showAnnotations();
  }

  // Enable marker tool
  function markerTool() {
    resetTools();
    markerson = true;
    $(".tool-active").removeClass("tool-active");
    $("#marker-tool").addClass("tool-active");
    showAnnotations();
  }

  // Enable area tool
  function areaTool() {
    resetTools();
    $(".tool-active").removeClass("tool-active");
    $("#area-tool").addClass("tool-active");

    // Start creating an area
    map.pm.setGlobalOptions({ pinning: true, snappable: true });
    map.pm.setPathOptions({
      color: color,
      fillColor: color,
      fillOpacity: 0.4,
    });
    map.pm.enableDraw('Polygon', {
      tooltips: false,
      snappable: true,
      templineStyle: {color: color},
      hintlineStyle: {color: color, dashArray: [5, 5]},
      pmIgnore: false
    });
    showAnnotations();
  }

  // Enable line tool
  function pathTool() {
    resetTools();
    $(".tool-active").removeClass("tool-active");
    $("#path-tool").addClass("tool-active");

    // Start creating a line
    map.pm.setGlobalOptions({ pinning: true, snappable: true });
    map.pm.setPathOptions({
      color: color,
      fillColor: color,
      fillOpacity: 0.4,
    });
    map.pm.enableDraw('Line', {
      tooltips: false,
      snappable: true,
      templineStyle: {color: color},
      hintlineStyle: {color: color, dashArray: [5, 5]},
      pmIgnore: false,
      finishOn: 'dblclick',
    });
    showAnnotations();
  }

  // Show/hide color picker
  function toggleColor() {
    $("#color-list").toggleClass("color-enabled");
  }

  // Switch color (color picker)
  function switchColor(e) {
    e.stopPropagation();
    color = $(this).attr("data-color");
    $("#inner-color").css({background:colo  // Enhanced search with autocomplete
  let searchTimeout = null;
  let currentSuggestions = [];

  async function search(inputElement = null) {
    const query = inputElement ? $(inputElement).val() : sanitize($("#search-input").val());
    if (!query.trim()) return;

    try {
      // Use the new API for geocoding
      if (navigationAPI) {
        const data = await navigationAPI.geocodeLocation(query, 1);
        if (data && data.length > 0) {
          const result = data[0];
          map.setView([result.lat, result.lon], 16);
          
          // Add marker for search result
          const marker = L.marker([result.lat, result.lon]).addTo(map);
          marker.bindPopup(`<b>${result.display_name}</b>`).openPopup();
          
          // Clear search suggestions
          hideSuggestions();
        } else {
          showError('Location not found. Please try a different search term.');
        }
      } else {
        // Fallback to original search
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
          map.setView([data[0].lat, data[0].lon], 16);
          const marker = L.marker([data[0].lat, data[0].lon]).addTo(map);
          marker.bindPopup(`<b>${data[0].display_name}</b>`).openPopup();
        } else {
          showError('Location not found. Please try a different search term.');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      ErrorHandler.handleSearchError(error, query);
    }
  }

  // Enhanced autocomplete for search inputs
  async function handleSearchInput(inputElement, showSuggestions = true) {
    const query = $(inputElement).val().trim();
    
    if (query.length < 2) {
      hideSuggestions();
      return;
    }

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search requests
    searchTimeout = setTimeout(async () => {
      try {
        if (navigationAPI && showSuggestions) {
          const suggestions = await navigationAPI.geocodeLocation(query, 5);
          displaySuggestions(suggestions, inputElement);
        }
      } catch (error) {
        console.warn('Autocomplete failed:', error);
      }
    }, 300);
  }

  // Display search suggestions
  function displaySuggestions(suggestions, inputElement) {
    // Remove existing suggestions
    hideSuggestions();
    
    if (!suggestions || suggestions.length === 0) return;

    currentSuggestions = suggestions;
    
    // Create suggestions container
    const suggestionsContainer = $(`
      <div class="search-suggestions" id="search-suggestions">
      </div>
    `);

    // Add suggestions
    suggestions.forEach((suggestion, index) => {
      const suggestionElement = $(`
        <div class="search-suggestion" data-index="${index}">
          <span class="suggestion-icon">📍</span>
          <span class="suggestion-text">${suggestion.display_name}</span>
        </div>
      `);

      suggestionElement.on('click', function() {
        selectSuggestion(suggestion, inputElement);
      });

      suggestionsContainer.append(suggestionElement);
    });

    // Position and show suggestions
    const inputContainer = $(inputElement).parent();
    inputContainer.css('position', 'relative');
    inputContainer.append(suggestionsContainer);
  }

  // Select a suggestion
  function selectSuggestion(suggestion, inputElement) {
    $(inputElement).val(suggestion.display_name);
    hideSuggestions();
    
    // Pan map to selected location
    map.setView([suggestion.lat, suggestion.lon], 16);
    
    // Add temporary marker
    const marker = L.marker([suggestion.lat, suggestion.lon]).addTo(map);
    setTimeout(() => {
      map.removeLayer(marker);
    }, 3000);
  }

  // Hide search suggestions
  function hideSuggestions() {
    $('#search-suggestions').remove();
    $('.search-suggestions').remove();
  }

  // Enhanced From/To input handling
  function setupFromToInputs() {
    // Add autocomplete to origin input
    $('#origin-input').on('input', function() {
      handleSearchInput(this, true);
    });

    // Add autocomplete to destination input
    $('#destination-input').on('input', function() {
      handleSearchInput(this, true);
    });

    // Handle Enter key in inputs
    $('#origin-input, #destination-input').on('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        hideSuggestions();
        
        // If both inputs are filled, calculate route
        const origin = $('#origin-input').val().trim();
        const destination = $('#destination-input').val().trim();
        
        if (origin && destination) {
          calculateRoute();
        }
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });

    // Handle suggestion navigation with arrow keys
    $(document).on('keydown', '#origin-input, #destination-input', function(e) {
      const suggestions = $('.search-suggestion');
      if (suggestions.length === 0) return;

      let selectedIndex = suggestions.index($('.search-suggestion.selected'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % suggestions.length;
        updateSelectedSuggestion(selectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
        updateSelectedSuggestion(selectedIndex);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const suggestion = currentSuggestions[selectedIndex];
        if (suggestion) {
          selectSuggestion(suggestion, this);
        }
      }
    });
  }

  // Update selected suggestion highlight
  function updateSelectedSuggestion(index) {
    $('.search-suggestion').removeClass('selected');
    $(`.search-suggestion:eq(${index})`).addClass('selected');
  }

  // Initialize From/To inputs on page load
  setupFromToInputs();

  // Mobile responsiveness enhancements
  function initMobileFeatures() {
    // Add mobile sidebar toggle functionality
    if (window.innerWidth <= 768) {
      // Add touch handler for sidebar
      let startY = 0;
      let currentY = 0;
      let isDragging = false;

      $('#sidebar').on('touchstart', function(e) {
        startY = e.originalEvent.touches[0].clientY;
        isDragging = true;
      });

      $('#sidebar').on('touchmove', function(e) {
        if (!isDragging) return;
        
        currentY = e.originalEvent.touches[0].clientY;
        const deltaY = currentY - startY;
        
        // Only allow upward swipes to expand
        if (deltaY < -50 && !$(this).hasClass('expanded')) {
          $(this).addClass('expanded');
        } else if (deltaY > 50 && $(this).hasClass('expanded')) {
          $(this).removeClass('expanded');
        }
      });

      $('#sidebar').on('touchend', function(e) {
        isDragging = false;
      });

      // Click on sidebar handle to toggle
      $('#sidebar').on('click', function(e) {
        // Only toggle if clicking near the top (handle area)
        const rect = this.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        
        if (clickY < 60) {
          $(this).toggleClass('expanded');
        }
      });

      // Close sidebar when clicking on map
      $('#mapDiv').on('click', function() {
        $('#sidebar').removeClass('expanded');
      });
    }

    // Handle orientation changes
    $(window).on('orientationchange resize', function() {
      setTimeout(() => {
        // Refresh map size
        map.invalidateSize();
        
        // Adjust sidebar for new orientation
        if (window.innerWidth <= 768) {
          $('#sidebar').removeClass('expanded');
        }
      }, 100);
    });

    // Prevent zoom on double tap for iOS
    let lastTouchEnd = 0;
    $(document).on('touchend', function(e) {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    });

    // Add viewport meta tag if not present
    if (!$('meta[name="viewport"]').length) {
      $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
    }
  }

  // Initialize mobile features
  initMobileFeatures();t.lat, result.lon]).addTo(map);
          marker.bindPopup(`<b>${result.display_name}</b>`).openPopup();
        }
      }).catch(error => {
        console.error('Search error:', error);
        // Fallback to original search
        $.get('https://nominatim.openstreetmap.org/search?q='+query+'&format=json', function(data) {
          if (data && data.length > 0) {
   // Enhanced Find nearby with routing capabilities
  async function findNearby() {
    const locationtype = $(this).attr("data-type");
    const markercolor = $(this).attr("data-color");
    const otherTypes = $(this).attr("data-others")?.split(',') || [];
    
    if (!navigationAPI) {
      showError('Navigation system not initialized. Please refresh the page.');
      return;
    }

    // Show loading state
    const button = $(this);
    const originalContent = button.html();
    button.html('<div style="font-size: 10px;">Loading...</div>');
    button.prop('disabled', true);

    try {
      // Get current map center or user location
      let searchLocation;
      if (userlocation && userlocation.getLatLng) {
        searchLocation = userlocation.getLatLng();
      } else {
        searchLocation = map.getCenter();
      }

      // Find nearby places using enhanced API
      const places = await findNearbyPlaces(searchLocation, locationtype, otherTypes);
      
      if (places.length === 0) {
        showError(`No ${locationtype.replace('_', ' ')} found nearby. Try zooming out or moving to a different area.`);
        return;
      }

      // Clear existing markers of this type
      clearMarkersOfType(locationtype);

      // Add markers for found places
      places.forEach(place => {
        addPlaceMarker(place, locationtype, markercolor);
      });

      // Show success message
      const successMsg = `Found ${places.length} ${locationtype.replace('_', ' ')} nearby`;
      showSuccessMessage(successMsg);

    } catch (error) {
      console.error('Error finding nearby places:', error);
      ErrorHandler.handleApiError(error, `Finding ${locationtype.replace('_', ' ')}`);
    } finally {
      // Restore button
      button.html(originalContent);
      button.prop('disabled', false);
    }
  }

  // Find nearby places using multiple APIs
  async function findNearbyPlaces(location, primaryType, otherTypes = []) {
    const radius = 2000; // 2km search radius
    const allTypes = [primaryType, ...otherTypes];
    
    try {
      // Use Overpass API for more comprehensive results
      const bounds = navigationAPI.calculateBounds(location, radius);
      const overpassData = await navigationAPI.fetchOverpassTransport(bounds, allTypes);
      
      let places = [];
      
      if (overpassData.elements && overpassData.elements.length > 0) {
        places = overpassData.elements
          .filter(element => element.lat && element.lon && element.tags)
          .map(element => ({
            id: element.id,
            name: element.tags.name || element.tags.amenity || `${primaryType.replace('_', ' ')}`,
            lat: element.lat,
            lng: element.lon,
            amenity: element.tags.amenity || primaryType,
            distance: navigationAPI.calculateDistance(location.lat, location.lng, element.lat, element.lon),
            tags: element.tags
          }))
          .filter(place => place.distance <= radius / 1000) // Filter by radius
          .sort((a, b) => a.distance - b.distance) // Sort by distance
          .slice(0, 20); // Limit to 20 results
      }

      // Fallback to Nominatim if no results
      if (places.length === 0) {
        const coordinates = `${location.lng},${location.lat},${location.lng + 0.02},${location.lat + 0.02}`;
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?viewbox=${coordinates}&format=geocodejson&limit=20&bounded=1&amenity=${primaryType}`;
        
        try {
          const response = await fetch(nominatimUrl);
          const data = await response.json();
          
          if (data.features) {
            places = data.features.map(feature => ({
              id: feature.properties.geocoding.place_id,
              name: feature.properties.geocoding.name || `${primaryType.replace('_', ' ')}`,
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0],
              amenity: primaryType,
              distance: navigationAPI.calculateDistance(
                location.lat, location.lng,
                feature.geometry.coordinates[1], feature.geometry.coordinates[0]
              )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 20);
          }
        } catch (nominatimError) {
          console.warn('Nominatim fallback failed:', nominatimError);
        }
      }

      return places;
    } catch (error) {
      console.error('Error in findNearbyPlaces:', error);
      return [];
    }
  }

  // Add enhanced place marker with routing capabilities
  function addPlaceMarker(place, locationtype, markercolor) {
    // Create custom marker icon
    const marker_icon = L.icon({
      iconUrl: `assets/${locationtype}-marker.svg`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      shadowAnchor: [4, 62],
      popupAnchor: [-3, -76]
    });

    const marker = L.marker([place.lat, place.lng], {
      icon: marker_icon,
      pane: "overlayPane",
      interactive: true
    }).addTo(map);

    // Enhanced popup with routing options
    const distanceText = place.distance ? `${(place.distance * 1000).toFixed(0)}m away` : '';
    const popupContent = `
      <div class="place-popup">
        <h1>${place.name}</h1>
        <div class="place-info">
          <div class="place-distance">${distanceText}</div>
          <div class="place-coordinates">
            <img src="assets/marker-small-icon.svg">
            ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}
          </div>
        </div>
        <div class="place-actions">
          <button class="route-to-place" onclick="routeToPlace(${place.lat}, ${place.lng}, '${place.name.replace(/'/g, "\\'")}')">
            🧭 Get Directions
          </button>
          <button class="save-place" onclick="savePlace('${place.id}', '${place.name.replace(/'/g, "\\'")}', ${place.lat}, ${place.lng}, '${locationtype}', '${markercolor}')">
            💾 Save Place
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: "place-popup-container",
      maxWidth: 280,
      offset: L.point(0, -35)
    });

    // Store place data
    places.push({
      id: place.id,
      place_id: place.id,
      name: place.name,
      desc: place.tags?.description || '',
      lat: place.lat,
      lng: place.lng,
      trigger: marker,
      completed: true,
      marker: marker,
      m_type: locationtype,
      type: "marker",
      color: markercolor,
      distance: place.distance
    });

    if (place.id) {
      place_ids.push(place.id);
    }
  }

  // Clear existing markers of a specific type
  function clearMarkersOfType(type) {
    places = places.filter(place => {
      if (place.m_type === type) {
        if (place.marker) {
          map.removeLayer(place.marker);
        }
        return false;
      }
      return true;
    });
  }fset: L.point({x: 0, y: -35})});
        places.push({id: "", place_id:place.properties.geocoding.place_id, name:place.properties.geocoding.name, desc:"", lat:place.geometry.coordinates[1], lng:place.geometry.coordinates[0], trigger:marker, completed:true, marker:marker, m_type:locationtype, type:"marker", color:markercolor});
        place_ids.push(place.properties.geocoding.place_id);
      });
    });
  }

  // Mock user for compatibility (no authentication required)
  function getCurrentUser() {
    return {
      uid: 'anonymous_user',
      displayName: 'Anonymous User',
      photoURL: null
    };
  }

  // Collapse/expand objects in the sidebar
  function toggleLayer(e) {
    e.preventDefault();
    e.stopPropagation();
    if ($(this).hasClass("arrow-open")) {
      $(this).removeClass("arrow-open");
      $(this).parent().parent().find(".annotation-details").addClass("annotation-closed");
    } else {
      $(this).addClass("arrow-open");
      $(this).parent().parent().find(".annotation-details").removeClass("annotation-closed");
    }
  }

  // Highlight an object in the sidebar
  function focusLayer() {
    showAnnotations();
    if (!$(this).find(".annotation-name span").hasClass("annotation-focus")) {
      const id = $(this).attr("data-id");
      const inst = objects.find(x => x.id === id);

      // De-select any previously selected objects
      $(".annotation-focus").removeClass("annotation-focus");

      // Close any opened tooltips
      map.eachLayer(function(layer){
        if (layer.options.pane != "markerPane") {
          layer.closeTooltip();
        }
      });

      // Make layer name bold to show that it has been selected
      $(this).find(".annotation-name span").addClass("annotation-focus");

      // Pan to the annotation and trigger the associated popup
      if (inst.type == "line" || inst.type == "area") {
        map.panTo(inst.trigger.getLatLng());
        $(inst.trigger.getTooltip()._container).removeClass('tooltip-off');
        inst.trigger.openTooltip();
      } else if (inst.type == "marker") {
        map.panTo(inst.marker.getLatLng());
        $(inst.marker.getTooltip()._container).removeClass('tooltip-off');
        inst.marker.openTooltip();
      }
    }
  }

  // Render object in the sidebar
  function renderObjectLayer(object) {
    // Check that the object isn't already rendered in the list
    if ($(".annotation-item[data-id='"+object.id+"']").length == 0) {
      // Render the object in the list depending on the type (different data for each)
      if (object.type == "line") {
        const icon = '<svg class="annotation-icon" width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="23" height="23" rx="5" fill="'+object.color+'"/><path d="M14.5 8.5L8.5 14.5" stroke="white" stroke-width="1.5" stroke-linecap="square"/><path d="M15.8108 8.53378C16.7176 8.53378 17.4527 7.79868 17.4527 6.89189C17.4527 5.9851 16.7176 5.25 15.8108 5.25C14.904 5.25 14.1689 5.9851 14.1689 6.89189C14.1689 7.79868 14.904 8.53378 15.8108 8.53378Z" stroke="white" stroke-width="1.5"/><circle cx="6.89189" cy="15.8108" r="1.64189" stroke="white" stroke-width="1.5"/></svg>'
        $("#annotations-list").prepend('<div class="annotation-item" data-id="'+object.id+'"><div class="annotation-name"><img class="annotation-arrow" src="assets/arrow.svg">'+icon+'<span>'+object.name+'</span><img class="delete-layer" src="assets/delete.svg"></div><div class="annotation-details annotation-closed"><div class="annotation-description">'+object.desc+'</div><div class="annotation-data"><div class="annotation-data-field"><img src="assets/distance-icon.svg">'+object.distance+' km</div></div></div></div>');
      } else if (object.type == "area") {
        const icon = '<svg class="annotation-icon" width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="23" height="23" rx="5" fill="'+object.color+'"/><path d="M15.3652 8.5V13.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M8.5 15.3649H13.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M14.5303 9.03033C14.8232 8.73744 14.8232 8.26256 14.5303 7.96967C14.2374 7.67678 13.7626 7.67678 13.4697 7.96967L14.5303 9.03033ZM7.96967 13.4697C7.67678 13.7626 7.67678 14.2374 7.96967 14.5303C8.26256 14.8232 8.73744 14.8232 9.03033 14.5303L7.96967 13.4697ZM13.4697 7.96967L7.96967 13.4697L9.03033 14.5303L14.5303 9.03033L13.4697 7.96967Z" fill="white"/><circle cx="15.365" cy="6.85135" r="1.60135" stroke="white" stroke-width="1.5"/><circle cx="15.365" cy="15.3649" r="1.60135" stroke="white" stroke-width="1.5"/><circle cx="6.85135" cy="15.3649" r="1.60135" stroke="white" stroke-width="1.5"/></svg>';
        $("#annotations-list").prepend('<div class="annotation-item" data-id="'+object.id+'"><div class="annotation-name"><img class="annotation-arrow" src="assets/arrow.svg">'+icon+'<span>'+object.name+'</span><img class="delete-layer" src="assets/delete.svg"></div><div class="annotation-details annotation-closed"><div class="annotation-description">'+object.desc+'</div><div class="annotation-data"><div class="annotation-data-field"><img src="assets/area-icon.svg">'+object.area+' km&sup2;</div><div class="annotation-data-field"><img src="assets/perimeter-icon.svg">'+object.distance+' km</div></div></div></div>');
      } else if (object.type == "marker") {
        const icon = '<svg class="annotation-icon" width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="23" height="23" rx="5" fill="'+object.color+'"/><path d="M16.0252 11.2709C16.0252 14.8438 11.3002 17.9063 11.3002 17.9063C11.3002 17.9063 6.5752 14.8438 6.5752 11.2709C6.5752 10.0525 7.07301 8.8841 7.95912 8.0226C8.84522 7.16111 10.047 6.67712 11.3002 6.67712C12.5533 6.67712 13.7552 7.16111 14.6413 8.0226C15.5274 8.8841 16.0252 10.0525 16.0252 11.2709Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.2996 12.8021C12.1695 12.8021 12.8746 12.1166 12.8746 11.2709C12.8746 10.4252 12.1695 9.73962 11.2996 9.73962C10.4298 9.73962 9.72461 10.4252 9.72461 11.2709C9.72461 12.1166 10.4298 12.8021 11.2996 12.8021Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        $("#annotations-list").prepend('<div class="annotation-item" data-id="'+object.id+'"><div class="annotation-name"><img class="annotation-arrow" src="assets/arrow.svg">'+icon+'<span>'+object.name+'</span><img class="delete-layer" src="assets/delete.svg"></div><div class="annotation-details annotation-closed"><div class="annotation-description">'+object.desc+'</div><div class="annotation-data"><div class="annotation-data-field"><img src="assets/marker-small-icon.svg">'+object.lat.toFixed(5)+', '+object.lng.toFixed(5)+'</div></div></div></div>');
      }
    } else {
      // If the object already exists, update existing data
      const layer = $(".annotation-item[data-id='"+object.id+"']");
      if (object.type == "line") {
        layer.find(".annotation-name span").html(object.name);
        layer.find(".annotation-description").html(object.desc);
        layer.find(".annotation-data").html('<div class="annotation-data-field"><img src="assets/distance-icon.svg">'+object.distance+' km</div>');
      } else if (object.type == "area") {
        layer.find(".annotation-name span").html(object.name);
        layer.find(".annotation-description").html(object.desc);
        layer.find(".annotation-data").html('<div class="annotation-data-field"><img src="assets/area-icon.svg">'+object.area+' km&sup2;</div><div class="annotation-data-field"><img src="assets/perimeter-icon.svg">'+object.distance+' km</div>');
      } else if (object.type == "marker") {
        layer.find(".annotation-name span").html(object.name);
        layer.find(".annotation-description").html(object.desc);
        layer.find(".annotation-data").html('<div class="annotation-data-field"><img src="assets/marker-small-icon.svg">'+object.lat.toFixed(5)+', '+object.lng.toFixed(5)+'</div>');
      }
    }
  }

  // Delete an object from the sidebar
  function deleteLayer(e) {
    e.preventDefault();
    e.stopPropagation();
    const id = $(this).parent().parent().attr("data-id");
    const inst = objects.find(x => x.id === id);
    $(".annotation-item[data-id='"+id+"']").remove();
    if (inst.type != "marker") {
      inst.trigger.remove();
      inst.line.remove();
      objects = $.grep(objects, function(e){
           return e.id != inst.id;
      });
    } else {
      inst.marker.remove();
      objects = $.grep(objects, function(e){
           return e.id != inst.id;
      });
    }
  }

  // Editing the name of the map
  function editMapName(e) {
    if (e.which != 3) {
      return;
    }
    if (!editingname) {
      oldname = mapname;
      editingname = true;
      $("#map-name").prop("disabled", false);
      $("#map-name").addClass("map-editing");
    }
  }
  function focusMapName() {
    $("#map-name").select();
    $("#map-name").addClass("map-editing");
  }
  function stopEditingMapName() {
    editingname = false;
    $("#map-name").prop("disabled", true);
    $("#map-name").removeClass("map-editing");
    var name = sanitize($("#map-name").val());
    if (name.length == 0) {
      // Revert to the old name if its length is 0
      $("#map-name").val(oldname);
    } else {
      // Update the name locally
      mapname = name;
    }
  }

  // Editing the description of the map
  function editMapDescription() {
    if (!editingdescription) {
      olddescription = mapdescription;
      editingdescription = true;
      $("#map-description").prop("disabled", false);
      $("#map-description").addClass("map-editing");
    }
  }
  function focusMapDescription() {
    $("#map-description").select();
    $("#map-description").addClass("map-editing");
  }
  function stopEditingMapDescription() {
    editingdescription = false;
    $("#map-description").prop("disabled", true);
    $("#map-description").removeClass("map-editing");
    var name = sanitize($("#map-description").val());
    if (name.length == 0) {
      // Revert to the old description if its length is 0
      $("#map-description").val(olddescription);
    } else {
      // Update the description locally
      mapdescription = name;
    }
  }

  // Toggle annotation visibility
  function toggleAnnotations() {
    if (!$("#hide-annotations").hasClass("hidden-annotations")) {
      $(".leaflet-overlay-pane").css({"visibility": "hidden", "pointer-events":"none"});
      $(".leaflet-tooltip-pane").css({"visibility": "hidden", "pointer-events":"none"});
      $("#hide-annotations").addClass("hidden-annotations");
      $("#hide-annotations").html("Show all");
    } else {
      showAnnotations();
    }
  }
  function showAnnotations() {
    $(".leaflet-overlay-pane").css({"visibility": "visible", "pointer-events":"all"});
    $(".leaflet-tooltip-pane").css({"visibility": "visible", "pointer-events":"all"});
    $("#hide-annotations").removeClass("hidden-annotations");
    $("#hide-annotations").html("Hide all");
  }

  // Toggle dots menu
  function toggleMoreMenu() {
    if ($("#more-menu").hasClass("menu-show")) {
      $("#more-menu").removeClass("menu-show");
    } else {
      $("#more-menu").addClass("menu-show");
    }
  }

  // Show share popup
  function showSharePopup() {
    $("#share").addClass("share-show");
    $("#overlay").addClass("share-show");
  }

  // Close share popup
  function closeSharePopup() {
    if ($("#overlay").hasClass("share-show")) {
      $(".share-show").removeClass("share-show");
    }
  }

  // Copy share link
  function copyShareLink() {
    $("#share-url").focus();
    $("#share-url").select();
    document.execCommand('copy');
  }

  // Zoom in
  function zoomIn() {
    map.zoomIn();
  }

  // Zoom out
  function zoomOut() {
    map.zoomOut();
  }

  // Global click handler
  function handleGlobalClicks(e) {
    if ($("#more-menu").hasClass("menu-show") && $(e.target).attr("id") != "more-vertical" && $(e.target).parent().attr("id") != "more-vertical") {
      $("#more-menu").removeClass("menu-show");
    }
  }

  // Export GeoJSON
  function exportGeoJSON() {
    var tempgroup = new L.FeatureGroup();
    map.addLayer(tempgroup);
    map.eachLayer(function(layer) {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Polygon) {
        layer.addTo(tempgroup);
      }
    });

    // Download GeoJSON locally
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(tempgroup.toGeoJSON())], {type: "application/json"});
    a.href = URL.createObjectURL(file);
    a.download = "geojson";
    a.click();
  }

  // Navigation Functions
  function toggleRouteMode() {
    const mode = $(this).attr('id').replace('-mode', '').replace('-', '_');
    currentRouteMode = mode;
    
    // Update UI
    $('.mode-btn').removeClass('active');
    $(this).addClass('active');
    
    // Show/hide transport filters for local route mode
    if (mode === 'local_route') {
      $('#transport-filters').show();
    } else {
      $('#transport-filters').hide();
    }
  }

  async function useCurrentLocation() {
    if (!navigationAPI) {
      showError('Navigation system not initialized. Please refresh the page.');
      return;
    }

    // Show loading state
    const button = $('#use-current-location');
    const originalText = button.text();
    button.text('📍 Getting location...').prop('disabled', true);

    try {
      const location = await navigationAPI.getCurrentLocation();
      
      // Validate location
      if (!location || !location.lat || !location.lng) {
        throw new Error('Invalid location received.');
      }

      // Check accuracy
      if (location.accuracy && location.accuracy > 1000) {
        console.warn('Location accuracy is low:', location.accuracy + 'm');
      }

      // Set coordinates first
      $('#origin-input').val(`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
      
      // Try to get address with timeout
      try {
        const addressPromise = navigationAPI.reverseGeocode(location.lat, location.lng);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Address lookup timed out')), 10000)
        );

        const address = await Promise.race([addressPromise, timeoutPromise]);
        
        if (address && address.display_name) {
          $('#origin-input').val(address.display_name);
        }
      } catch (addressError) {
        console.warn('Could not get address, using coordinates:', addressError.message);
        // Keep coordinates as fallback
      }

      // Pan map to current location
      map.setView([location.lat, location.lng], 16);

    } catch (error) {
      console.error('Error getting current location:', error);
      
      let errorMessage = 'Unable to get current location. ';
      if (error.message.includes('not supported')) {
        errorMessage += 'Your browser does not support location services.';
      } else if (error.message.includes('permission')) {
        errorMessage += 'Please allow location access and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage += 'Location request timed out. Please try again.';
      } else {
        errorMessage += 'Please enter your location manually.';
      }
      
      showError(errorMessage);
    } finally {
      button.text(originalText).prop('disabled', false);
    }
  }

  async function calculateRoute() {
    const originText = $('#origin-input').val().trim();
    const destinationText = $('#destination-input').val().trim();
    
    if (!originText || !destinationText) {
      showError('Please enter both origin and destination.');
      return;
    }

    if (!navigationAPI || !navigationRouter) {
      showError('Navigation system not initialized. Please refresh the page.');
      return;
    }

    // Show loading
    $('#route-loading').show();
    $('#calculate-route').prop('disabled', true);
    $('#route-results-section').hide();

    try {
      // Validate inputs
      if (originText.length < 2 || destinationText.length < 2) {
        throw new Error('Please enter more specific location names.');
      }

      // Geocode origin and destination with timeout
      const geocodePromise = Promise.all([
        navigationAPI.geocodeLocation(originText, 1),
        navigationAPI.geocodeLocation(destinationText, 1)
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Location search timed out. Please try again.')), 15000)
      );

      const [originResults, destinationResults] = await Promise.race([
        geocodePromise,
        timeoutPromise
      ]);

      if (!originResults || !originResults.length) {
        throw new Error(`Could not find origin: "${originText}". Please try a different location.`);
      }

      if (!destinationResults || !destinationResults.length) {
        throw new Error(`Could not find destination: "${destinationText}". Please try a different location.`);
      }

      const origin = {
        lat: parseFloat(originResults[0].lat),
        lng: parseFloat(originResults[0].lon)
      };

      const destination = {
        lat: parseFloat(destinationResults[0].lat),
        lng: parseFloat(destinationResults[0].lon)
      };

      // Validate coordinates
      if (isNaN(origin.lat) || isNaN(origin.lng) || isNaN(destination.lat) || isNaN(destination.lng)) {
        throw new Error('Invalid coordinates received. Please try different locations.');
      }

      // Check if locations are too far apart (optional warning)
      const distance = navigationAPI.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
      if (distance > 1000) { // More than 1000km
        console.warn('Very long distance route requested:', distance + 'km');
      }

      // Get selected transport types
      const transportTypes = [];
      $('#transport-filters input[type="checkbox"]:checked').each(function() {
        transportTypes.push($(this).val(    } catch (error) {
      console.error('Route calculation error:', error);
      ErrorHandler.handleRoutingError(error, originText, destinationText);
    }urrentRouteMode, 
        transportTypes.length > 0 ? transportTypes : null
      );

      const routeTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Route calculation timed out. Please try again.')), 30000)
      );

      const routes = await Promise.race([
        routePromise,
        routeTimeoutPromise
      ]);

      if (!routes) {
        throw new Error('No routes found. Please try different locations or transport options.');
      }

      // Display results
      displayRouteResults(routes);

    } catch (error) {
      console.error('Route calculation error:', error);
      showError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      $('#route-loading').hide();
      $('#calculate-route').prop('disabled', false);
    }
  }

  // Enhanced error display function
  function showError(message) {
    // Remove any existing error messages
    $('.error-message').remove();
    
    // Create error message
    const errorHtml = `
      <div class="error-message" style="
        background: #ffebee; 
        color: #c62828; 
        padding: 12px; 
        margin: 10px 0; 
        border-radius: 5px; 
        border-left: 4px solid #c62828;
        font-family: Inter;
        font-size: 14px;
      ">
        <strong>Error:</strong> ${message}
      </div>
    `;
    
    // Insert error message after navigation controls
    $('#navigation-section .navigation-controls').after(errorHtml);
    
    // Auto-remove error after 10 seconds
    setTimeout(() => {
      $('.error-message').fadeOut(500, function() {
        $(this).remove();
      });
    }, 10000);
  }

  function displayRouteResults(routes) {
    const resultsContainer = $('#route-results');
    resultsContainer.empty();

    if (!Array.isArray(routes)) {
      routes = [routes];
    }

    routes.forEach((route, index) => {
      const routeElement = createRouteElement(route, index);
      resultsContainer.append(routeElement);
    });

    $('#route-results-section').show();
  }

  function createRouteElement(route, index) {
    const isExpanded = index === 0; // Expand first route by default
    
    let routeHtml = `
      <div class="route-option">
        <div class="route-option-header" onclick="toggleRouteDetails(${index})">
          <div class="route-option-title">Route ${index + 1}</div>
          <div class="route-option-summary">
            ${navigationRouter.formatDistance(route.distance)} • ${navigationRouter.formatDuration(route.duration)}
            ${route.transfers > 0 ? ` • ${route.transfers} transfer${route.transfers > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div class="route-segments" ${isExpanded ? '' : 'style="display: none;"'}>
    `;

    if (route.segments) {
      route.segments.forEach(segment => {
        routeHtml += `
          <div class="route-segment ${segment.type}">
            <div class="route-segment-icon">${segment.icon || '🚶'}</div>
            <div class="route-segment-info">
              <div class="route-segment-description">${segment.description}</div>
              <div class="route-segment-details">
                ${navigationRouter.formatDistance(segment.distance)} • ${navigationRouter.formatDuration(segment.duration)}
              </div>
            </div>
          </div>
        `;
      });  function displayTransportHubs(hubs) {
    const container = $('#transport-hubs-list');
    container.empty();

    if (hubs.length === 0) {
      container.html(`
        <div style="text-align: center; color: var(--text-grey); padding: 20px;">
          <div style="font-size: 18px; margin-bottom: 10px;">🚌</div>
          No transport hubs found in this area.
          <br><small>Try moving to a different location or increasing the search radius.</small>
          <br><button onclick="loadTransportHubs()" style="margin-top: 10px; padding: 5px 10px; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer;">
            Refresh
          </button>
        </div>
      `);
      return;
    }

    // Add header with count and refresh button
    const headerElement = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #E8E8E8;">
        <span style="font-size: 12px; color: var(--text-grey);">Found ${hubs.length} transport hubs</span>
        <button onclick="loadTransportHubs()" style="padding: 4px 8px; border: 1px solid #E8E8E8; border-radius: 3px; background: white; cursor: pointer; font-size: 11px;">
          🔄 Refresh
        </button>
      </div>
    `;
    container.append(headerElement);

    hubs.forEach((hub, index) => {
      const distance = hub.distance * 1000; // Convert to meters
      const distanceText = distance < 1000 ? 
        `${Math.round(distance)}m` : 
        `${(distance / 1000).toFixed(1)}km`;

      const hubElement = `
        <div class="transport-hub-item" onclick="focusTransportHub(${hub.lat}, ${hub.lng})" style="cursor: pointer;">
          <div class="hub-icon" style="color: ${getHubColor(hub.type)};">${getTransportIcon(hub.type)}</div>
          <div class="hub-info">
            <div class="hub-name" title="${hub.name}">${hub.name.length > 25 ? hub.name.substring(0, 25) + '...' : hub.name}</div>
            <div class="hub-type">${hub.type.replace('_', ' ').toUpperCase()}</div>
          </div>
          <div class="hub-actions">
            <div class="hub-distance">${distanceText}</div>
            <button onclick="event.stopPropagation(); routeToHub(${hub.lat}, ${hub.lng}, '${hub.name.replace(/'/g, "\\'")}')" 
                    style="padding: 2px 6px; border: 1px solid ${getHubColor(hub.type)}; border-radius: 3px; background: white; cursor: pointer; font-size: 10px; margin-top: 2px;">
              Route
            </button>
          </div>
        </div>
      `;
      container.append(hubElement);
    });

    // Add load more button if there are many hubs
    if (hubs.length >= 50) {
      const loadMoreElement = `
        <div style="text-align: center; padding: 15px; border-top: 1px solid #E8E8E8; margin-top: 10px;">
          <small style="color: var(--text-grey);">Showing nearest 50 transport hubs</small>
        </div>
      `;
      container.append(loadMoreElement);
    }
  }ort hubs:', error);
    }
  }

  function displayTransportHubs(hubs) {
    const container = $('#transport-hubs-list');
    container.empty();

    if (hubs.length === 0) {
      container.html('<div style="text-align: center; color: var(--text-grey); padding: 20px;">No transport hubs found in this area.</div>');
      return;
    }

    hubs.forEach(hub => {
      const hubElement = `
        <div class="transport-hub-item" onclick="focusTransportHub(${hub.lat}, ${hub.lng})">
          <div class="hub-icon">${getTransportIcon(hub.type)}</div>
          <div class="hub-info">
            <div class="hub-name">${hub.name}</div>
            <div class="hub-type">${hub.type.replace('_', ' ').toUpperCase()}</div>
          </div>
          <div class="hub-distance">${navigationRouter.formatDistance(hub.distance * 1000)}</div>
        </div>
      `;
      container.append(hubElement);
    });
  }

  function focusTransportHub(lat, lng) {
    map.setView([lat, lng], 16);
  }

  function getTransportIcon(type) {
    const icons = {
      'bus_station': '🚌',
      'metro': '🚇',
      'taxi': '🚕',
      'rickshaw': '🛺',
      'public_transport': '🚌'
    };
    return icons[type] || '🚌';
  }

  function addTransportHub() {
    // This would open a modal or form to add a new transport hub
    // For now, we'll use the existing marker tool
    markerTool();
    alert('Click on the map to add a transport hub. You can then edit its details.');
  }

  // Missing function definitions that were referenced but not implemented
  function saveNearby() {
    const placeId = $(this).attr('data-id');
    const place = places.find(p => p.place_id === placeId);
    
    if (place) {
      // Add to objects array for persistence
      const newObject = {
        id: 'place_' + Date.now(),
        name: place.name,
        desc: place.desc || '',
        lat: place.lat,
        lng: place.lng,
        type: 'marker',
        color: place.color,
        completed: true,
        marker: place.marker
      };
      
      objects.push(newObject);
      renderObjectLayer(newObject);
      
      // Close tooltip
      place.marker.closeTooltip();
      
      // Show success message
      co  // Enhanced loadTransportHubs function with user location priority
  async function loadTransportHubs() {
    if (!navigationAPI) {
      console.warn('Navigation API not initialized');
      return;
    }

    try {
      // Determine search center - prioritize user location
      let searchCenter;
      let searchRadius = 5000; // 5km default radius

      if (userlocation && userlocation.getLatLng) {
        // Use user's current location
        const userPos = userlocation.getLatLng();
        searchCenter = { lat: userPos.lat, lng: userPos.lng };
        searchRadius = 3000; // 3km for user location
      } else {
        // Fallback to map center
        const center = map.getCenter();
        searchCenter = { lat: center.lat, lng: center.lng };
        
        // Calculate radius based on map zoom
        const bounds = map.getBounds();
        const mapRadius = Math.max(
          center.distanceTo(bounds.getNorthEast()),
          center.distanceTo(bounds.getSouthWest())
        ) * 1000; // Convert to meters
        searchRadius = Math.min(mapRadius, 10000); // Max 10km
      }

      // Show loading state
      $('#transport-hubs-list').html(`
        <div style="text-align: center; color: var(--text-grey); padding: 20px;">
          <div class="spinner" style="margin: 0 auto 10px;"></div>
          Loading transport hubs...
        </div>
      `);

      const hubs = await navigationAPI.findNearestTransportHubs(
        searchCenter,
        searchRadius,
        ['bus_station', 'taxi', 'public_transport', 'metro', 'bus_stop']
      );

      // Sort hubs by distance and limit to reasonable number
      const sortedHubs = hubs
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50); // Limit to 50 nearest hubs

      transportHubs = sortedHubs;
      displayTransportHubs(sortedHubs);

      // Add hub markers to map
      addTransportHubMarkers(sortedHubs);

    } catch (error) {
      console.error('Error loading transport hubs:', error);
      // Show user-friendly error message
      $('#transport-hubs-list').html(`
        <div style="text-align: center; color: var(--text-grey); padding: 20px;">
          <div style="color: #e57373; margin-bottom: 10px;">⚠️ Unable to load transport hubs</div>
          <div style="font-size: 12px;">Please check your connection and try again</div>
          <button onclick="loadTransportHubs()" style="margin-top: 10px; padding: 5px 10px; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer;">
            Retry
          </button>
        </div>
      `);
    }
  }

  // Add transport hub markers to the map
  function addTransportHubMarkers(hubs) {
    // Clear existing hub markers
    clearTransportHubMarkers();

    hubs.slice(0, 20).forEach(hub => { // Only show markers for closest 20 hubs
      const hubIcon = L.divIcon({
        html: `<div class="transport-hub-marker" style="background: ${getHubColor(hub.type)}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${getTransportIcon(hub.type)}</div>`,
        iconSize: [24, 24],
        className: 'transport-hub-icon'
      });

      const marker = L.marker([hub.lat, hub.lng], { icon: hubIcon })
        .addTo(map)
        .bindPopup(`
          <div class="hub-popup">
            <h3>${hub.name}</h3>
            <p><strong>Type:</strong> ${hub.type.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Distance:</strong> ${(hub.distance * 1000).toFixed(0)}m</p>
            <button onclick="routeToHub(${hub.lat}, ${hub.lng}, '${hub.name.replace(/'/g, "\\'")}')">Get Directions</button>
          </div>
        `);

      // Store marker reference
      hub.marker = marker;
    });
  }

  // Clear transport hub markers
  function clearTransportHubMarkers() {
    transportHubs.forEach(hub => {
      if (hub.marker) {
        map.removeLayer(hub.marker);
        delete hub.marker;
      }
    });
  }

  // Get color for hub type
  function getHubColor(type) {
    const colors = {
      'bus_station': '#4CAF50',
      'bus_stop': '#4CAF50',
      'metro': '#2196F3',
      'taxi': '#FF9800',
      'public_transport': '#9C27B0',
      'transport_hub': '#607D8B'
    };
    return colors[type] || '#607D8B';
  }

  // Route to a transport hub
  async function routeToHub(lat, lng, hubName) {
    try {
      $('#destination-input').val(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      
      // Try to get address
      if (navigationAPI) {
        try {
          const address = await navigationAPI.reverseGeocode(lat, lng);
          if (address && address.display_name) {
            $('#destination-input').val(address.display_name);
          }
        } catch (error) {
          console.warn('Could not get address for hub');
        }
      }

      // Set origin if available
      if (userlocation && userlocation.getLatLng) {
        const currentPos = userlocation.getLatLng();
        $('#origin-input').val(`${currentPos.lat.toFixed(4)}, ${currentPos.lng.toFixed(4)}`);
      }

      // Calculate route
      await calculateRoute();
      showSuccessMessage(`Calculating route to ${hubName}...`);
      
    } catch (error) {
      console.error('Error routing to hub:', error);
      showError('Failed to calculate route to transport hub.');
    }
  }  }

  // Enhanced loadTransportHubs function
  async function loadTransportHubs() {
    if (!navigationAPI) {
      console.warn('Navigation API not initialized');
      return;
    }

    try {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const radius = Math.max(
        center.distanceTo(bounds.getNorthEast()),
        center.distanceTo(bounds.getSouthWest())
      );

      const hubs = await navigationAPI.findNearestTransportHubs(
        { lat: center.lat, lng: center.lng },
        radius,
        ['bus_station', 'taxi', 'public_transport', 'metro']
      );

      transportHubs = hubs;
      displayTransportHubs(hubs);
    } catch (error) {
      console.error('Error loading transport hubs:', error);
      // Show user-friendly error message
      $('#transport-hubs-list').html(`
        <div style="text-align: center; color: var(--text-grey); padding: 20px;">
          Unable to load transport hubs. Please try again later.
        </div>
      `);
    }
  }

  // Enhanced displayTransportHubs function
  function displayTransportHubs(hubs) {
    const container = $('#transport-hubs-list');
    container.empty();

    if (hubs.length === 0) {
      container.html(`
        <div style="text-align: center; color: var(--text-grey); padding: 20px;">
          No transport hubs found in this area.
          <br><small>Try zooming out or moving to a different location.</small>
        </div>
      `);
      return;
    }

    hubs.forEach(hub => {
      const hubElement = `
        <div class="transport-hub-item" onclick="focusTransportHub(${hub.lat}, ${hub.lng})">
          <div class="hub-icon">${getTransportIcon(hub.type)}</div>
  // Route to a specific place
  async function routeToPlace(lat, lng, placeName) {
    try {
      // Set destination
      $('#destination-input').val(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      
      // Try to get a proper address for the destination
      if (navigationAPI) {
        try {
          const address = await navigationAPI.reverseGeocode(lat, lng);
          if (address && address.display_name) {
            $('#destination-input').val(address.display_name);
          }
        } catch (error) {
          console.warn('Could not get address for destination');
        }
      }

      // Get current location for origin if available
      if (userlocation && userlocation.getLatLng) {
        const currentPos = userlocation.getLatLng();
        $('#origin-input').val(`${currentPos.lat.toFixed(4)}, ${currentPos.lng.toFixed(4)}`);
        
        // Try to get address for origin too
        if (navigationAPI) {
          try {
            const originAddress = await navigationAPI.reverseGeocode(currentPos.lat, currentPos.lng);
            if (originAddress && originAddress.display_name) {
              $('#origin-input').val(originAddress.display_name);
            }
          } catch (error) {
            console.warn('Could not get address for origin');
          }
        }
      } else {
        // Prompt user to set origin
        showError('Please set your current location first by clicking the location button or entering your origin manually.');
        return;
      }

      // Calculate route automatically
      await calculateRoute();
      
      // Show success message
      showSuccessMessage(`Calculating route to ${placeName}...`);
      
    } catch (error) {
      console.error('Error setting up route:', error);
      showError('Failed to set up route. Please try manually entering the destination.');
    }
  }

  // Save a place to the annotations
  function savePlace(placeId, placeName, lat, lng, type, color) {
    try {
      // Create new object for the saved place
      const newObject = {
        id: 'saved_place_' + Date.now(),
        name: placeName,
        desc: `Saved ${type.replace('_', ' ')}`,
        lat: lat,
        lng: lng,
        type: 'marker',
        color: color,
        completed: true,
        m_type: type
      };

      // Find the existing marker
      const existingPlace = places.find(p => p.place_id === placeId || p.id === placeId);
      if (existingPlace && existingPlace.marker) {
        newObject.marker = existingPlace.marker;
        newObject.trigger = existingPlace.marker;
      }

      // Add to objects array
      objects.push(newObject);
      renderObjectLayer(newObject);

      // Close any open popups
      map.closePopup();

      // Show success message
      showSuccessMessage(`${placeName} saved successfully!`);
      
    } catch (error) {
      console.error('Error saving place:', error);
      showError('Failed to save place. Please try again.');
    }
  }

  // Show success message
  function showSuccessMessage(message) {
    // Remove any existing messages
    $('.success-message').remove();
    
    // Create success message
    const successHtml = `
      <div class="success-message" style="
        background: #e8f5e8; 
        color: #2e7d32; 
        padding: 12px; 
        margin: 10px 0; 
        border-radius: 5px; 
        border-left: 4px solid #4caf50;
        font-family: Inter;
        font-size: 14px;
      ">
        <strong>Success:</strong> ${message}
      </div>
    `;
    
    // Insert success message after navigation controls
    $('#navigation-section .navigation-controls').after(successHtml);
    
    // Auto-remove success message after 5 seconds
    setTimeout(() => {
      $('.success-message').fadeOut(500, function() {
        $(this).remove();
      });
    }, 5000);
  }

  // Make functions globally available
  window.toggleRouteDetails = toggleRouteDetails;
  window.focusTransportHub = focusTransportHub;
  window.saveNearby = saveNearby;
  window.cancelNearby = cancelNearby;
  window.observationMode = observationMode;
  window.normalMode = normalMode;
  window.routeToPlace = routeToPlace;
  window.savePlace = savePlace;
  window.routeToHub = routeToHub;tance * 1000) : (hub.distance * 1000).toFixed(0) + 'm'}</div>
        </div>
      `;
      container.append(hubElement);
    });
  }

  // Enhanced addTransportHub function
  function addTransportHub() {
    // Switch to marker tool for adding transport hubs
    markerTool();
    
    // Show instruction to user
    const instruction = `
      <div style="background: #4890E8; color: white; padding: 10px; margin: 10px; border-radius: 5px; text-align: center;">
        Click on the map to add a transport hub. You can then edit its details.
      </div>
    `;
    
    // Add instruction to transport hubs section
    $('#transport-hubs-section').prepend(instruction);
    
    // Remove instruction after 5 seconds
    setTimeout(() => {
      $('#transport-hubs-section .instruction').remove();
    }, 5000);
  }

  // Make functions globally available
  window.toggleRouteDetails = toggleRouteDetails;
  window.focusTransportHub = focusTransportHub;
  window.saveNearby = saveNearby;
  window.cancelNearby = cancelNearby;
  window.observationMode = observationMode;
  window.normalMode = normalMode;

  // Map events
  map.addEventListener('mousedown', (event) => {
    mousedown = true;
    // Get mouse coordinates and save them locally
    let lat = Math.round(event.latlng.lat * 100000) / 100000;
    let lng = Math.round(event.latlng.lng * 100000) / 100000;
    cursorcoords = [lat,lng];
    if (drawing) {
      // If the pencil tool is enabled, start drawing
      startDrawing(lat,lng);
    }
  });
  map.addEventListener('click', (event) => {
    // Get mouse coordinates and save them locally
    let lat = Math.round(event.latlng.lat * 100000) / 100000;
    let lng = Math.round(event.latlng.lng * 100000) / 100000;
    cursorcoords = [lat,lng];
    // Create a marker if the marker tool is enabled
    createMarker(lat,lng);
    if (drawing) {
      // If the pencil tool is enabled, start drawing
      startDrawing(lat,lng);
   map.addEventListener('moveend', (event) => {
    dragging = false;
    
    // Refresh transport hubs when map moves significantly
    if (navigationAPI) {
      // Debounce the refresh to avoid too many API calls
      clearTimeout(window.hubRefreshTimeout);
      window.hubRefreshTimeout = setTimeout(() => {
        loadTransportHubs();
      }, 1000);
    }
  }); = false;
  })
  map.addEventListener('mousemove', (event) => {
    // Get cursor coordinates and save them locally
    let lat = Math.round(event.latlng.lat * 100000) / 100000;
    let lng = Math.round(event.latlng.lng * 100000) / 100000;
    cursorcoords = [lat,lng];

    // Make tooltip for line and area hints follow the cursor
    followcursor.setLatLng([lat,lng]);
    if (mousedown && drawing) {
      // If the pencil tool is enabled, draw to the mouse coordinates
      objects.filter(function(result){
        return result.id === currentid;
      })[0].line.addLatLng([lat,lng]);
    }

    // If drawing a line, show the distance of drawn line in the tooltip
    if (lineon) {
      followcursor.setTooltipContent(((linedistance+linelastcoord.distanceTo([lat,lng]))/1000).toFixed(2)+"km | Double click to finish");
    }
  });
  map.addEventListener('zoom', (event) => {
    stopObserving();
  });
  map.addEventListener('movestart', (event) => {
    dragging = true;
  });
  map.addEventListener('moveend', (event) => {
    dragging = false;
  });

  // Start free drawing
  function startDrawing(lat,lng) {
    var line = L.polyline([[lat,lng]], {color: color});

    // Create a new key for the line object
    currentid = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Save an object with all the defaults
    objects.push({id:currentid, line:line, local:true, completed:true, type:"draw"});
    line.addTo(map);

    // Event handling for lines
    objects.forEach(function(inst){
      inst.line.on("click", function(event){
        if (erasing) {
          inst.line.remove();
          objects = $.grep(objects, function(e){
               return e.id != inst.id;
          });
        }
      });
      inst.line.on("mouseover", function(event){
        if (erasing) {
          inst.line.setStyle({opacity: .3});
        }
      });
      inst.line.on("mouseout", function(event){
        inst.line.setStyle({opacity: 1});
      });
    });
  }

  // Create a new marker
  function createMarker(lat, lng) {
    if (markerson) {
      // Go back to cursor tool after creating a marker
      cursorTool();

      // Set custom marker icon
      var marker_icon = L.divIcon({
        html: '<svg width="30" height="30" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M23 44.0833C23 44.0833 40.25 32.5833 40.25 19.1666C40.25 14.5916 38.4326 10.204 35.1976 6.96903C31.9626 3.73403 27.575 1.91663 23 1.91663C18.425 1.91663 14.0374 3.73403 10.8024 6.96903C7.56741 10.204 5.75 14.5916 5.75 19.1666C5.75 32.5833 23 44.0833 23 44.0833ZM28.75 19.1666C28.75 22.3423 26.1756 24.9166 23 24.9166C19.8244 24.9166 17.25 22.3423 17.25 19.1666C17.25 15.991 19.8244 13.4166 23 13.4166C26.1756 13.4166 28.75 15.991 28.75 19.1666Z" fill="'+color+'"/>/svg>',
        iconSize:     [30, 30], // size of the icon
        iconAnchor:   [15, 30], // point of the icon which will correspond to marker's location
        shadowAnchor: [4, 62],  // the same for the shadow
        popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
      });
      var marker = L.marker([lat, lng], {icon:marker_icon, direction:"top", interactive:true, pane:"overlayPane"});

      // Create a popup to set the name and description of the marker
      marker.bindTooltip('<label for="shape-name">Name</label><input value="Marker" id="shape-name" name="shape-name" /><label for="shape-desc">Description</label><textarea id="shape-desc" name="description"></textarea><br><div id="buttons"><button class="cancel-button">Cancel</button><button class="save-button">Save</button></div><div class="arrow-down"></div>', {permanent: true, direction:"top", interactive:false, bubblingMouseEvents:false, className:"create-shape-flow create-form", offset: L.point({x: 0, y: -35})});
      marker.addTo(map);
      marker.openTooltip();

      // Create a new key for the marker
      currentid = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      var key = currentid;
      objects.push({id:currentid, marker:marker, color:color, name:"Marker", m_type:"none",  desc:"", lat:lat, lng:lng, trigger:marker, completed:true, type:"marker"});

      // Detect when the marker is clicked
      marker.on('click', function(e){
        if (!erasing) {
          // Open tooltip when the marker is clicked
          marker.openTooltip();
        } else {
          // If erasing, delete the marker
          marker.remove();
          objects = $.grep(objects, function(e){
               return e.id != key;
          });
        }
      })
    }
  }

  // Disable observation mode
  function stopObserving() {
    observing.status = false;
    $("#outline").css({"border": "none"});
    $("#outline").removeClass("observing");
  }

  // Keyboard shortcuts & more
  $(document).keyup(function(e) {
    if ($(e.target).is("input") || $(e.target).is("textarea")) {
      return;
    }
    if (e.key === "Escape") {
      normalMode();
    } else if (e.key === "Enter") {
      if (editingname) {
        stopEditingMapName();
      } else if (editingdescription) {
        stopEditingMapDescription();
      }
    } else if (e.which == 86) {
      cursorTool();
    } else if (e.which == 80) {
      penTool();
    } else if (e.which == 69) {
      eraserTool();
    } else if (e.which == 77) {
      markerTool();
    } else if (e.which == 76) {
      pathTool();
    } else if (e.which == 65) {
      areaTool();
    }
  });

  // Event handlers
  $(document).on("click", handleGlobalClicks);
  $(document).on("click", "#pen-tool", penTool);
  $(document).on("click", "#cursor-tool", cursorTool);
  $(document).on("click", "#eraser-tool", eraserTool);
  $(document).on("click", "#marker-tool", markerTool);
  $(document).on("click", "#area-tool", areaTool);
  $(document).on("click", "#path-tool", pathTool);
  $(document).on("click", ".color", switchColor);
  $(document).on("click", "#inner-color", toggleColor);
  $(document).on("mouseover", ".tool", showTooltip);
  $(document).on("mouseout", ".tool", hideTooltip);
  $(document).on("click", ".avatars", observationMode);
  $(document).on("click", ".annotation-arrow", toggleLayer);
  $(document).on("click", ".annotation-item", focusLayer);
  $(document).on("click", ".delete-layer", deleteLayer);
  $(document).on("mousedown", "#map-name", editMapName);
  $(document).on("mouseup", "#map-name", focusMapName);
  $(document).on("focusout", "#map-name", stopEditingMapName);
  $(document).on("mousedown", "#map-description", editMapDescription);
  $(document).on("mouseup", "#ma  // Enhanced search input handling
  $(document).on("input", "#search-input", function(){
    handleSearchInput(this, true);
  });

  // Search automatically when focused & pressing enter
  $(document).on("keydown", "#search-input", function(e){
    if (e.key === "Enter") {
      search();
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });Annotations);
  $(document).on("click", "#location-control", targetLiveLocation);
  $(document).on("click", ".find-nearby", findNearby);
  $(document).on("click", ".save-button-place", saveNearby);
  $(document).on("click", ".cancel-button-place", cancelNearby);
  $(document).on("click", "#more-vertical", toggleMoreMenu);
  $(document).on("click", "#geojson", exportGeoJSON);
  $(document).on("click", "#search-box img", search);
  $(document).on("click", "#share-button", showSharePopup);
  $(document).on("click", "#overlay", closeSharePopup);
  $(document).on("click", "#close-share", closeSharePopup);
  $(document).on("click", "#share-copy", copyShareLink);
  $(document).on("click", "#zoom-in", zoomIn);
  $(document).on("click", "#zoom-out", zoomOut);
  
  // Navigation event handlers
  $(document).on("click", "#full-route-mode", toggleRouteMode);
  $(document).on("click", "#local-route-mode", toggleRouteMode);
  $(document).on("click", "#use-current-location", useCurrentLocation);
  $(document).on("click", "#calculate-route", calculateRoute);
  $(document).on("click", "#add-transport-hub", addTransportHub);

  // Search automatically when focused & pressing enter
  $(document).on("keydown", "#search-input", function(e){
    if (e.key === "Enter") {
      search();
    }
  });

  // Initialize the map
  initMap();

  // Load transport hubs for current view (with delay to ensure map is ready)
  setTimeout(() => {
    if (navigationAPI) {
      loadTransportHubs();
    } else {
      console.warn('Navigation API not available, skipping transport hub loading');
    }
  }, 2000);

  // Get live location of the current user. Only if Geolocation is activated (local only)
  liveLocation();
});