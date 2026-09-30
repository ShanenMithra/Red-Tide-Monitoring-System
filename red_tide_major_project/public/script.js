let map;
let infoWindow;
let shapes = [];
let environmentalNodes = [];
let usgsMarkers = [];
let usgsFeatureMatrix = [];
let gcnProbabilities = [];

document.getElementById("run-gcn").addEventListener("click", function() {

  if (usgsFeatureMatrix.length === 0) {
    alert("No station data loaded yet.");
    return;
  }

  // Collect latitudes & longitudes
  const latitudes = usgsMarkers.map(m => m.getPosition().lat());
  const longitudes = usgsMarkers.map(m => m.getPosition().lng());

  // Convert null stations into safe fallback values
const validFeatures = usgsFeatureMatrix.map(f => {
  if (!f) return [0, 0, 0];
  return f;
});

fetch("/api/predict-bloom", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    features: validFeatures,
    latitudes: latitudes,
    longitudes: longitudes
  })
})

  .then(res => res.json())
  .then(data => {
    gcnProbabilities = data.bloom_probabilities;
    alert("Bloom risk prediction completed!");
    console.log("GCN probabilities:", gcnProbabilities);
  })
  .catch(err => {
    console.error("GCN error:", err);
  });

});



///////////USGS///////////
function loadUSGSData() {

  if (map.getZoom() < 10) {
    console.log("Zoom in further to load USGS data");
    return;
  }

  const bounds = map.getBounds();
  if (!bounds) return;

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const width = Math.abs(ne.lng() - sw.lng());
  const height = Math.abs(ne.lat() - sw.lat());

  //if (width > 1.1 || height > 1.1) {
   // console.log("Bounding box too large — zoom in more");
    //return;
  //}

  const bbox = [
  sw.lng().toFixed(4),
  sw.lat().toFixed(4),
  ne.lng().toFixed(4),
  ne.lat().toFixed(4)
].join(",");
  console.log("Using bbox:", bbox);

  fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00010,00300,00400&siteStatus=active`)

  .then(res => {
    console.log("Status:", res.status);

    if (!res.ok) {
      throw new Error("USGS request failed");
    }

    return res.json();
  })
  .then(data => {
    console.log("Returned series:", data.value.timeSeries.length);

  // Clear old markers first
  
usgsMarkers.forEach(marker => marker.setMap(null));
usgsMarkers = [];
usgsFeatureMatrix = [];

  const allSeries = data.value.timeSeries;
  const siteData = {};

  allSeries.forEach(series => {

    const siteName = series.sourceInfo.siteName;
    const lat = series.sourceInfo.geoLocation.geogLocation.latitude;
    const lng = series.sourceInfo.geoLocation.geogLocation.longitude;
    const variableName = series.variable.variableName;
    const parameterCode = series.variable.variableCode[0].value;


    let measurements = [];

    for (let set of series.values) {
      if (set.value && set.value.length > 0) {
        measurements = set.value;
        break;
      }
    }

    if (measurements.length === 0) return;

    const latest = measurements[measurements.length - 1];

    if (!siteData[siteName]) {
      siteData[siteName] = {
        lat,
        lng,
        variables: {}
      };
    }

    siteData[siteName].variables[parameterCode] = {
      value: latest.value,
      time: latest.dateTime
    };
  });

  Object.keys(siteData).forEach((siteName, index) => {

  const site = siteData[siteName];

  const hasTemp = site.variables["00010"];
const hasDO = site.variables["00300"];
const hasPH = site.variables["00400"];
if (hasTemp) {

  const temp = parseFloat(site.variables["00010"].value);

  const doVal = hasDO
    ? parseFloat(site.variables["00300"].value)
    : 7;   // normal oxygen fallback

  const ph = hasPH
    ? parseFloat(site.variables["00400"].value)
    : 8;   // neutral fallback

  usgsFeatureMatrix.push([temp, doVal, ph]);

} else {

  usgsFeatureMatrix.push(null);

}


  let iconColor = "blue";

  if (hasTemp && hasDO && hasPH) {
    iconColor = "green";
  } else if (hasTemp && (hasDO || hasPH)) {
    iconColor = "yellow";
  }

  const position = new google.maps.LatLng(
    parseFloat(site.lat),
    parseFloat(site.lng)
  );

  const marker = new google.maps.Marker({
    position: position,
    map: map,
    title: siteName,
    icon: {
      url: `https://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png`
    }
  });

  usgsMarkers.push(marker);

  // 🔥 THIS IS THE PART YOU WERE MISSING
  marker.addListener("click", function() {

  const clickedIndex = usgsMarkers.indexOf(marker);

  fetch("/api/similarity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      features: usgsFeatureMatrix,
      target_index: clickedIndex
    })
  })
  .then(res => res.json())
  .then(result => {

    const similar = result.similar_indices;

    // Reset all marker icons
    usgsMarkers.forEach(m => {
      m.setIcon({
        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
      });
    });

    // Highlight similar stations
    similar.forEach(i => {
      if (usgsMarkers[i]) {
        usgsMarkers[i].setIcon({
          url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
        });
      }
    });

    // -----------------------------
    // BUILD INFO WINDOW CONTENT
    // -----------------------------

    let content = `<h3>${siteName}</h3>`;

    const expectedVariables = {
      "00010": "Temp (&deg;C)",
      "00300": "Dissolved Oxygen (mg/L)",
      "00400": "pH"
    };

    Object.keys(expectedVariables).forEach(code => {

      const label = expectedVariables[code];

      if (site.variables[code]) {
        content += `
          <p><b>${label}:</b>
          ${site.variables[code].value}</p>
        `;
      } else {
        content += `
          <p><b>${label}:</b> Not available</p>
        `;
      }

    });

    // Add similar station names
    content += `<h4>🔍 Similar Stations:</h4><ul>`;

similar.forEach(i => {
  if (usgsMarkers[i]) {
    const name = usgsMarkers[i].getTitle();
    content += `
      <li>
        <a href="#" onclick="focusOnStation(${i}); return false;">
          ${name}
        </a>
      </li>
    `;
  }
});

content += `</ul>`;
// 🔮 Add GCN prediction if available
if (gcnProbabilities.length > clickedIndex) {
  const probability = gcnProbabilities[clickedIndex];
  const percent = (probability * 100).toFixed(2);

  content += `
    <hr>
    <p><b>GCN Bloom Risk:</b> ${percent}%</p>
  `;
}

    infoWindow.setContent(content);
    infoWindow.open(map, marker);

  });

});


  });

});


}



function initMap() {

  
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 27, lng: -82 },
    zoom: 10,
    gestureHandling: "greedy"
  });


  infoWindow = new google.maps.InfoWindow();

  setupSearch();
  enableBloomDrawing();
  enableUndoShortcuts();
  loadApprovedReports();
  let timeout;
map.addListener("idle", () => {
  clearTimeout(timeout);
  timeout = setTimeout(loadUSGSData, 500);
});



}

////////////////////////////////////////////////////
// 🔍 SEARCH
////////////////////////////////////////////////////

function setupSearch() {
  const input = document.getElementById("search-input");
  const autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry) return;

    map.setCenter(place.geometry.location);
    map.setZoom(10);
});
}


////////////////////////////////////////////////////
// 🔴 BLOOM DRAWING SYSTEM
////////////////////////////////////////////////////

function enableBloomDrawing() {

  map.addListener("click", function(event) {

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    const severity = prompt("Enter bloom severity (Low, Medium, High, Very High):");
    if (!severity) return;
    console.log("Sending report:", lat, lng, severity);

    // 🔵 SEND TO BACKEND
    fetch("/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        severity: severity,
        description: "User reported bloom"
      })
    })
    .then(res => res.json())
    .then(data => {
      alert("Report submitted for review!");
      console.log("Saved:", data);
    })
    .catch(err => console.error("Error:", err));

    // 🔴 OPTIONAL: draw temporary visual
    

  });
}


////////////////////////////////////////////////////
// 🎨 VISUAL SETTINGS
////////////////////////////////////////////////////

function getVisualProperties(level) {

  if (!level) return { color: "#0000FF", radius: 500 };

  level = level.trim().toLowerCase();

  if (level === "low") 
    return { color: "#FFFF00", radius: 400 };

  if (level === "medium") 
    return { color: "#FFA500", radius: 900 };

  if (level === "high") 
    return { color: "#FF0000", radius: 1800 };

  if (level === "very high") 
    return { color: "#8B0000", radius: 3000 };

  // 🔥 fallback so it NEVER crashes
  return { color: "#0000FF", radius: 500 };
}


////////////////////////////////////////////////////
// ℹ️ INFO WINDOW
////////////////////////////////////////////////////

function attachInfo(shape, level) {

  const time = new Date().toLocaleString();

  google.maps.event.addListener(shape, 'click', function(event) {
    infoWindow.setPosition(event.latLng);
    infoWindow.setContent(`
      <h3>Red Tide Alert</h3>
      <p><b>Bloom Level:</b> ${level}</p>
      <p><b>Reported On:</b> ${time}</p>
      <p><b>Type:</b> ${shape instanceof google.maps.Circle ? "Point Bloom" : "Coastal Region Bloom"}</p>
    `);
    infoWindow.open(map);
  });
}

////////////////////////////////////////////////////
// 🔄 UNDO + CLEAR
////////////////////////////////////////////////////

function undoLast() {
  if (shapes.length > 0) {
    const lastShape = shapes.pop();
    lastShape.setMap(null);
  }
}

function clearAll() {
  shapes.forEach(shape => shape.setMap(null));
  shapes = [];
}

function enableUndoShortcuts() {
  document.addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "z") {
      undoLast();
    }
  });
}
function loadApprovedReports() {

  fetch("/api/reports/approved")
    .then(res => res.json())
    .then(reports => {

      reports.forEach(report => {

        const { color, radius } = getVisualProperties(report.severity);

        const circle = new google.maps.Circle({
          strokeColor: color,
          fillColor: color,
          fillOpacity: 0.4,
          map: map,
          center: {
            lat: parseFloat(report.latitude),
            lng: parseFloat(report.longitude)
          },
          radius: radius
        });

        shapes.push(circle);
        attachInfo(circle, report.severity);

      });

    })
    .catch(err => console.error("Error loading approved:", err));
}

////////////////////////////////////////////////////
function focusOnStation(index) {

  const marker = usgsMarkers[index];
  if (!marker) return;

  map.panTo(marker.getPosition());
  map.setZoom(12);

  // Trigger marker click programmatically
  google.maps.event.trigger(marker, "click");
}


window.initMap = initMap;

