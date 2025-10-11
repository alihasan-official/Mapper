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
      $('#system-status').show();
      
      // Test API connectivity
      testAPIConnectivity();
      
    } catch (error) {
      console.error('Failed to initialize navigation system:', error);
      showSystemError('Navigation system failed to initialize. Some features may not work properly.');
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
    } catch (error) {
      console.warn('API connectivity test failed:', error.message);
    }
  }

  // Show system-level errors
  function showSystemError(message) {
    const errorHtml = `
      <div style="
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #ff5722; 
        color: white; 
        padding: 15px; 
        border-radius: 5px; 
        z-index: 10000;
        max-width: 300px;
        font-family: Inter;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        <strong>System Error:</strong><br>
        ${message}
        <br><br>
        <button onclick="this.parentElement.remove()" style="
          background: rgba(255,255,255,0.2); 
          border: none; 
          color: white; 
          padding: 5px 10px; 
          border-radius: 3px; 
          cursor: pointer;
        ">Dismiss</button>
      </div>
    `;
    
    $('body').append(errorHtml);
    
    // Auto-remove after 15 seconds
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
    $("#inner-color").css({background:color});
    toggleColor();
  }

  // Sanitizing input strings
  function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    return string.replace(reg, (match)=>(map[match]));
  }

  // Enhanced search with autocomplete
  function search() {
    const query = sanitize($("#search-input").val());
    if (!query.trim()) return;

    // Use the new API for geocoding
    if (navigationAPI) {
      navigationAPI.geocodeLocation(query, 5).then(data => {
        if (data && data.length > 0) {
          const result = data[0];
          map.panTo(new L.LatLng(result.lat, result.lon));
          
          // Add marker for search result
          const marker = L.marker([result.lat, result.lon]).addTo(map);
          marker.bindPopup(`<b>${result.display_name}</b>`).openPopup();
        }
      }).catch(error => {
        console.error('Search error:', error);
        // Fallback to original search
        $.get('https://nominatim.openstreetmap.org/search?q='+query+'&format=json', function(data) {
          if (data && data.length > 0) {
            map.panTo(new L.LatLng(data[0].lat, data[0].lon));
          }
        });
      });
    } else {
      // Fallback to original search
      $.get('https://nominatim.openstreetmap.org/search?q='+query+'&format=json', function(data) {
        if (data && data.length > 0) {
          map.panTo(new L.LatLng(data[0].lat, data[0].lon));
        }
      });
    }
  }

  // Find nearby
  function findNearby() {
    var locationtype = $(this).attr("data-type");
    var markercolor = $(this).attr("data-color");
    var coordinates = map.getBounds().getNorthWest().lng+','+map.getBounds().getNorthWest().lat+','+map.getBounds().getSouthEast().lng+','+map.getBounds().getSouthEast().lat;

    // Call Nominatim API to get places nearby the current view, of the amenity that the user has selected
    $.get('https://nominatim.openstreetmap.org/search?viewbox='+coordinates+'&format=geocodejson&limit=20&bounded=1&amenity='+locationtype+'&exclude_place_ids='+JSON.stringify(place_ids), function(data) {
      // Custom marker icon depending on the amenity
      var marker_icon = L.icon({
        iconUrl: 'assets/'+locationtype+'-marker.svg',
        iconSize:     [30, 30],
        iconAnchor:   [15, 30],
        shadowAnchor: [4, 62],
        popupAnchor:  [-3, -76]
      });
      data.features.forEach(function(place){
        // Create a marker for the place
        var marker = L.marker([place.geometry.coordinates[1], place.geometry.coordinates[0]], {icon:marker_icon, pane:"overlayPane", interactive:true}).addTo(map);

        // Create a popup with information about the place
        marker.bindTooltip('<h1>'+place.properties.geocoding.name+'</h1><div class="shape-data"><h3><img src="assets/marker-small-icon.svg">'+place.geometry.coordinates[1].toFixed(5)+', '+place.geometry.coordinates[0].toFixed(5)+'</h3></div><div class="arrow-down"></div>', {permanent: false, direction:"top", interactive:false, bubblingMouseEvents:false, className:"create-shape-flow", offset: L.point({x: 0, y: -35})});
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
        transportTypes.push($(this).val());
      });

      // Calculate route with timeout
      const routePromise = navigationRouter.calculateRoute(
        origin, 
        destination, 
        currentRouteMode, 
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
      });
    }

    routeHtml += `
        </div>
      </div>
    `;

    return routeHtml;
  }

  function toggleRouteDetails(index) {
    const segments = $(`.route-option:eq(${index}) .route-segments`);
    segments.toggle();
  }

  async function loadTransportHubs() {
    if (!navigationAPI) return;

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
        ['bus_station', 'taxi', 'public_transport']
      );

      transportHubs = hubs;
      displayTransportHubs(hubs);
    } catch (error) {
      console.error('Error loading transport hubs:', error);
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
      console.log('Place saved successfully');
    }
  }

  function cancelNearby() {
    const placeId = $(this).attr('data-id');
    const place = places.find(p => p.place_id === placeId);
    
    if (place) {
      place.marker.remove();
      places = places.filter(p => p.place_id !== placeId);
      place_ids = place_ids.filter(id => id !== placeId);
    }
  }

  function observationMode() {
    const userId = $(this).attr('data-user');
    const userName = $(this).attr('data-name');
    
    if (userId && userName) {
      observing.status = true;
      observing.id = userId;
      $("#outline").addClass("observing");
      $("#observing-name").text(`Observing ${userName}`);
      
      // Focus on user's cursor if available
      const userCursor = cursors.find(c => c.user === userId);
      if (userCursor) {
        map.setView([userCursor.lat, userCursor.lng], map.getZoom());
      }
    }
  }

  function normalMode() {
    stopObserving();
    cursorTool();
  }

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
          <div class="hub-info">
            <div class="hub-name">${hub.name}</div>
            <div class="hub-type">${hub.type.replace('_', ' ').toUpperCase()}</div>
          </div>
          <div class="hub-distance">${navigationRouter ? navigationRouter.formatDistance(hub.distance * 1000) : (hub.distance * 1000).toFixed(0) + 'm'}</div>
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
    }
  });
  map.addEventListener('mouseup', (event) => {
    mousedown = false;
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
  $(document).on("mouseup", "#map-description", focusMapDescription);
  $(document).on("focusout", "#map-description", stopEditingMapDescription);
  $(document).on("click", "#hide-annotations", toggleAnnotations);
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