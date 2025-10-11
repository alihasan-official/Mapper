(function() {
  'use strict';

  // Global vars for libs loaded via CDN
  const L = window.L;
  const $ = window.jQuery;
  const firebase = window.firebase;
  const turf = window.turf;

  // Basic error handling wrapper
  function handleError(error, message = 'An error occurred') {
    console.error(message, error);
    // TODO: Show user-friendly toast in later steps
  }

  // Initialize map when DOM is ready
  $(document).ready(function() {
    try {
      const map = L.map('mapDiv').setView([51.505, -0.09], 13); // Default view (London)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Enable drawing tools using leaflet-geoman (loaded in HTML)
      map.pm.addControls({
        position: 'topleft',
        drawCircle: false, // Disable circle for now
        drawMarker: false, // Custom marker handling later
        drawPolyline: true,
        drawPolygon: true,
        cutPolygon: false,
        removalMode: true
      });

      // Basic event for drawing creation (placeholder for save to Firebase)
      map.on('pm:create', function(e) {
        console.log('Layer created:', e.layer);
        // TODO: Save to Firebase in auth step
      });

      // Zoom controls
      $('#zoom-in').on('click', function() { map.zoomIn(); });
      $('#zoom-out').on('click', function() { map.zoomOut(); });

      // Location control (geolocation)
      $('#location-control').on('click', function() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(position) {
            const latlng = [position.coords.latitude, position.coords.longitude];
            map.setView(latlng, 13);
            L.marker(latlng).addTo(map).bindPopup('You are here').openPopup();
          }, function() {
            handleError(new Error('Geolocation failed'), 'Could not get location');
          });
        }
      });

      // Drawing tools toggle (basic activation)
      $('.tool').on('click', function() {
        const toolId = $(this).attr('id');
        $('.tool').removeClass('tool-active');
        $(this).addClass('tool-active');
        console.log('Tool activated:', toolId);
        // TODO: Integrate with map.pm.enableDraw() in drawing step
        switch(toolId) {
          case 'pen-tool':
            // Enable polyline
            map.pm.enableDraw('Polyline', { color: '#222222' });
            break;
          case 'area-tool':
            // Enable polygon
            map.pm.enableDraw('Polygon', { color: '#222222' });
            break;
          case 'marker-tool':
            // Custom marker placement
            map.on('click', function(e) {
              L.marker(e.latlng).addTo(map).bindPopup('New marker');
              map.off('click');
            });
            break;
          case 'eraser-tool':
            map.pm.enableGlobalRemovalMode();
            break;
          default:
            map.pm.disableDraw();
            map.pm.disableGlobalRemovalMode();
        }
      });

      // Search box (basic Nominatim integration)
      let searchTimeout;
      $('#search-input').on('input', function() {
        clearTimeout(searchTimeout);
        const query = $(this).val();
        if (query.length < 3) return;
        searchTimeout = setTimeout(() => {
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
            .then(response => response.json())
            .then(data => {
              // Populate results in sidebar
              const resultsList = $('.results-list');
              resultsList.empty();
              data.forEach(result => {
                const item = $(`<div class="result-item" data-lat="${result.lat}" data-lon="${result.lon}">${result.display_name}</div>`);
                item.on('click', function() {
                  map.setView([result.lat, result.lon], 13);
                  $('#search-box').hide();
                  $('#search-results').hide();
                });
                resultsList.append(item);
              });
              $('#search-results').show();
            })
            .catch(err => handleError(err, 'Search failed'));
        }, 300); // Debounce 300ms
      });

      // Show search box on focus
      $('#search-input').on('focus', function() {
        $('#search-box').show();
      });

      // Auth (Google sign in)
      $('#google-signin').on('click', function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
          .then(result => {
            console.log('Signed in:', result.user);
            // Update UI for logged in state
            $('#popup').hide();
            $('#overlay').hide();
          })
          .catch(err => handleError(err, 'Sign in failed'));
      });

      $('#continue-guest').on('click', function() {
        firebase.auth().signInAnonymously()
          .then(() => {
            console.log('Guest mode');
            $('#popup').hide();
            $('#overlay').hide();
          })
          .catch(err => handleError(err, 'Guest mode failed'));
      });

      // Initial UI setup
      $('#overlay').show();
      $('#popup').show();

      // Hide sidebar sections initially if needed
      // TODO: More UI bindings in UX step

      console.log('Map initialized successfully');
    } catch (error) {
      handleError(error, 'Map initialization failed');
    }
  });

})();
