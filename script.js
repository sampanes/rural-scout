const sheet_data_url = "https://script.google.com/macros/s/AKfycby0-PiqADl27Q1cfwSMc1gq4s6yhgBtlPd-RlLXRn2XZWbUSoXMEnIn-zydqCfquaEYkA/exec"

const cityHeuristics = [
  { maxMinutes: 9, minResults: 5, status: "🧠 Looks like you're IN a city" },
  { maxMinutes: 23, minResults: 5, status: "🧠 You're NEAR a city" },
  { maxMinutes: 39, minResults: 4, status: "🧠 Close to civilization" },
  { maxMinutes: 39, minResults: 2, status: "🧠 Outskirts of civilization" },
  { maxMinutes: Infinity, minResults: 0, status: "🧠 You're in the BOONIES" },
];

const sheet_tabs_references = {
    "axolotls": `${sheet_data_url}?view=axolotls`,
    "2a": `${sheet_data_url}?view=2a`
}

let axolotlData = {};
let gunData = {};

window.addEventListener("DOMContentLoaded", () => {
  loadAxolotlRules();
  load2ARules();
});

async function load2ARules() {
    try {
        const res = await fetch(sheet_tabs_references["2a"]);
        const data = await res.json();

        gunData = Object.fromEntries(
            data.map(entry => {
                return [entry.State, {
                    Rank: entry.Rank,
                    Comment: entry.Comment
                }];
            })
        );
        console.log("✅ 2A rules loaded and parsed:", gunData);
    } catch (err) {
        console.log("❌ Failed to load 2A rules:", err);
    }
}

async function loadAxolotlRules() {
  try {
    const res = await fetch(sheet_tabs_references["axolotls"]);
    const data = await res.json();

    axolotlData = Object.fromEntries(
      data.map(entry => {
        // console.log(`↪️ Parsing ${entry.State}: G2G =`, entry.G2G, ", Note =", entry.Note);
        return [entry.State, {
          G2G: entry.G2G === true || entry.G2G === "TRUE" || entry.G2G === "true" || entry.G2G === 1,
          Note: entry.Note || ""
        }];
      })
    );

    console.log("✅ Axolotl rules loaded and parsed:", axolotlData);
  } catch (err) {
    console.error("❌ Failed to load Axolotl rules:", err);
  }
}

function display2ARank(stateName) {
    const barContainer = document.getElementById("gun-bar-container");
    const marker = document.getElementById("gun-marker");
    console.log("Display 2A Rank for:", stateName);
    if (!gunData || !gunData[stateName]) {
      console.warn("No 2A data for:", stateName);
      barContainer.style.display = "none";
      return;
    }
  
    const { Rank, Comment } = gunData[stateName];
    const rank = parseInt(Rank);
  
    if (isNaN(rank)) {
      console.warn("Invalid rank for", stateName);
      barContainer.style.display = "none";
      return;
    }
  
    // Calculate position percentage (1-50 mapped to 0%-100%)
    const percent = ((rank - 1) / 49) * 100;
    marker.style.left = `${percent}%`;
    marker.textContent = `🔫#${rank}`;
  
    marker.onclick = () => {
      const modal = document.getElementById("gun-modal");
      const modalText = document.getElementById("gun-modal-text");
      modalText.textContent = Comment
  ? `#${rank} state for gun ownership: ${Comment} (2024)`
  : "No comment available.";
      modal.style.display = "flex";
    };
  
    barContainer.style.display = "block";
  }
  
  // Optional: modal close logic
  document.getElementById("gun-modal-close").onclick = () => {
    document.getElementById("gun-modal").style.display = "none";
  };
  
  document.getElementById("gun-modal").addEventListener("click", (e) => {
    if (e.target.id === "gun-modal") {
      document.getElementById("gun-modal").style.display = "none";
    }
  });

function checkAxolotlStatus(stateName) {
  if (!axolotlData || Object.keys(axolotlData).length === 0) {
    console.warn("Axolotl data not loaded yet — skipping check.");
    return;
  }

  const stateInfo = axolotlData[stateName];

  if (!stateInfo) {
    console.warn("No axolotl info for state:", stateName);
    return;
  }

  if (stateInfo.G2G === true) {
    console.log(`✅ ${stateName} is axolotl-friendly!`);
    return;
  }

if (!stateInfo.Note || stateInfo.Note.trim() === "") {
  console.log(`⚠️ ${stateName} is not G2G but no note provided — skipping alert.`);
  return;
}

  // If G2G is false or missing
  alert(`⚠️ Axolotl warning for ${stateName}. ${stateInfo.Note || "(no info)"}`);
}

function getStateFromPlace(place) {
  if (!place || !place.address_components) return null;

  const stateComponent = place.address_components.find(comp =>
    comp.types.includes("administrative_area_level_1")
  );

  return stateComponent ? stateComponent.long_name : null;
}

// Listing links and addresses are parsed by listing.js (vacant lots, unit markers, tracking links).
function extractAddress(text) {
  return Listing.parseListing(text).query || text.trim();
}

// How precise a geocoder hit really is. An unknown street still comes back OK, as the town.
function placePrecision(place) {
  const has = (t) => (place.address_components || []).some(c => c.types.includes(t));
  if (has("street_number")) return "address";
  if (has("route")) return "street";
  if (has("locality")) return "city";
  if (has("postal_code")) return "ZIP";
  return "area";
}

// Try each geocoder query in turn (full line, without the ZIP, city, ZIP) and note when the pin is
// not the property itself.
async function geocodeFirst(parsed) {
  for (const { q, precision } of Listing.geocodeQueries(parsed)) {
    const place = await getGeocodedPlace(q, { quiet: true, expectNumber: precision === "address" });
    if (!place) continue;
    const got = placePrecision(place);
    if (got === "street" && parsed.vacant) {
      place.comment = "Vacant land (no street number): the pin is on the street, not the lot.";
    } else if (got !== "address" && got !== "street") {
      place.comment = "Street not found: the pin is the " + got + " center, so drive times are approximate.";
    }
    return place;
  }
  throw '[X] Could not find location.';
}
  
async function lookup() {
  document.getElementById('loading').classList.add('visible');
  const rawInput = document.getElementById('input').value;
  const parsed = Listing.parseListing(rawInput);
  const cleaned = parsed.query || rawInput.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<p>Looking up: <strong>${cleaned}</strong>...</p>`;

  if (typeof google === 'undefined' || !google.maps) {
    resultsDiv.innerHTML = `
      <p>⚠️ Couldn't load the map. Please check your internet connection or  get John to check the API key.</p>
      <p>🗣️ if something breaks, blame John™</p>
      `;
    document.getElementById('loading').classList.remove('visible');
    return;
  }

  try {
    const place = await geocodeFirst(parsed);
    const elevation = await getElevation(place.geometry.location);

    if (parsed.url) {
      place.link = parsed.url; // tracking parameters dropped
    }
    place.scoutCommand = Listing.scoutCommand(rawInput);

    checkAxolotlStatus(getStateFromPlace(place));
    display2ARank(getStateFromPlace(place));

    renderInitialResults(place, elevation, resultsDiv);
    showFavoriteButton(place, elevation);
    await findNearestAnchor(place.geometry.location, elevation, resultsDiv);
  } catch (err) {
    resultsDiv.innerHTML = `<p>${err}</p>`;
  } finally {
    document.getElementById('loading').classList.remove('visible');
  }
}
  
// opts.quiet: resolve null instead of rejecting when nothing is found.
// opts.expectNumber: false skips the incomplete-address alert (vacant land, city or ZIP fallback).
function getGeocodedPlace(address, opts = {}) {
  const expectNumber = opts.expectNumber !== false;
  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results.length) {
        if (opts.quiet) resolve(null);
        else reject('[X] Could not find location.');
      } else {
        const place = results[0];
        const components = place.address_components || [];

        const hasStreetNumber = components.some(c => c.types.includes("street_number"));
        const hasRoute = components.some(c => c.types.includes("route"));

        if (expectNumber && (!hasStreetNumber || !hasRoute)) {
          let msg = "⚠️ Address may be incomplete:";
          if (!hasStreetNumber && !hasRoute) {
            msg += " missing street number *and* street name.";
          } else if (!hasStreetNumber) {
            msg += " missing street number.";
          } else {
            msg += " missing street name.";
          }
          alert(msg);
          place.comment = msg;
        }

        resolve(place);
      }
    });
  });
}
  
function renderInitialResults(place, elevation, resultsDiv) {
  const location = place.geometry.location;
  const lat = location.lat();
  const lng = location.lng();
  const fullAddr = place.formatted_address;

  const anchorType = document.getElementById("anchorType").value;
  const typeName = anchorType === "any" ? "points of interest" : anchorType.replaceAll('_', ' ');

  // Decide fallback
  const fallbackType = anchorType === "hospital" ? "schools" : "hospitals";

  resultsDiv.innerHTML = `
    <p>📍 <strong>${fullAddr}</strong></p>
    <p>🗻 Elevation: ${elevation ? elevation + " ft" : "N/A"}</p>
    <a class="map-link" href="https://www.google.com/maps/place/${lat},${lng}" target="_blank">📌 View on Google Maps</a>
    <a class="map-link" href="https://www.google.com/maps/search/${encodeURIComponent(typeName)}+near+${lat},${lng}" target="_blank">🔎 Nearby ${typeName}</a>
    <a class="map-link" href="https://www.google.com/maps/search/${fallbackType}+near+${lat},${lng}" target="_blank">🔎 Nearby ${fallbackType}</a>
  `;
  if (place.comment) {
    resultsDiv.innerHTML += `<p class="approx-note">${escapeHtml(place.comment)}</p>`;
  }
  if (place.scoutCommand) {
    resultsDiv.innerHTML += `
      <details class="scout-cmd">
        <summary>Exact parcel, flood zones, grade, zoning</summary>
        <p>Run in <a href="https://github.com/sampanes/compound-designer/blob/main/docs/scouting.md" target="_blank">compound-designer</a>:</p>
        <code>${escapeHtml(place.scoutCommand)}</code>
      </details>
    `;
  }
}

function showFavoriteButton(place, elevation) {
  let container = document.getElementById("favorite-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "favorite-container";
    document.getElementById("results").appendChild(container);
  }

  container.innerHTML = ""; // Clear old button

  const btn = document.createElement("button");
  btn.textContent = "💖 Add to Favorites";
  btn.style.margin = "1rem 0";
  btn.onclick = () => {
    const addr = place.formatted_address || "";
    const components = place.address_components || [];
    const location = place.geometry.location;

    const getComponent = (type) =>
      components.find((c) => c.types.includes(type))?.long_name || "";

    const city = getComponent("locality") || getComponent("sublocality") || getComponent("administrative_area_level_2");
    const state = getComponent("administrative_area_level_1");

    const data = {
      Link: place.link || "",
      Address: addr,
      City: city,
      State: state,
      Elevation: elevation != null ? elevation : "",
      Lat: location.lat(),
      Lon: location.lng(),
      Zestimate: "",
      Zacreage: "",
      Comment: place.comment || ""
    };

    fetch('https://script.google.com/macros/s/AKfycby0-PiqADl27Q1cfwSMc1gq4s6yhgBtlPd-RlLXRn2XZWbUSoXMEnIn-zydqCfquaEYkA/exec?view=favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // 🔥 Bypasses CORS preflight
      },
      body: JSON.stringify({
        link: data.Link,
        address: data.Address,
        city: data.City,
        state: data.State,
        elevation: data.Elevation,
        lat: data.Lat,
        lon: data.Lon,
        zestimate: data.Zestimate,
        zacreage: data.Zacreage,
        comment: data.Comment
      })
    })
      .then(response => response.json())
      .then(result => {
        alert("✅ Favorite saved!");
      })
      .catch(err => {
        console.error("❌ Failed to submit:", err);
        alert("❌ Failed to save favorite.");
      });

  };

  container.appendChild(btn);
}

async function findNearestAnchor(originLatLng, elevation, resultsDiv) {
  const anchorType = document.getElementById("anchorType").value;

  const map = new google.maps.Map(document.createElement("div"));
  const service = new google.maps.places.PlacesService(map);

  const request = {
    location: originLatLng,
    radius: 50000,
  };
  if (anchorType !== "any") {
    request.type = anchorType;
  }

  service.nearbySearch(request, (places, status) => {
    if (status !== "OK" || !places.length) {
      resultsDiv.innerHTML += `<p>🚫 No nearby place found.</p>`;
      return;
    }

    const topPlaces = places.slice(0, 5);
    const destinations = topPlaces.map((p) => p.geometry.location);

    const distanceService = new google.maps.DistanceMatrixService();
    distanceService.getDistanceMatrix(
      {
        origins: [originLatLng],
        destinations,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status !== "OK") {
          resultsDiv.innerHTML += `<p>🚫 Failed to get drive times.</p>`;
          return;
        }

        const elements = response.rows[0].elements;
        const driveTimes = elements.map((e, i) => ({
          minutes: e.status === "OK" ? e.duration.value / 60 : Infinity,
          durationText: e.status === "OK" ? e.duration.text : "n/a",
          place: topPlaces[i],
          index: i,
        }));

        driveTimes.sort((a, b) => a.minutes - b.minutes);
        const validResults = driveTimes.filter((e) => e.minutes < Infinity);
        const closest = driveTimes[0];

        let cityStatus = "🧠 Status unknown";
        for (const rule of cityHeuristics) {
          if (closest.minutes <= rule.maxMinutes && validResults.length >= rule.minResults) {
            cityStatus = rule.status;
            break;
          }
        }

        const anchor = driveTimes[0];
        const anchorName = anchor.place.name || "Unknown";
        const anchorVicinity = anchor.place.vicinity || "unknown";
        const driveTime = anchor.durationText;

        resultsDiv.innerHTML += `
          <div class="map-drive">
            <p>🚘 <strong>${driveTime}</strong> drive to <em>${anchorName}</em> (${anchorVicinity})</p>
            <p>🏙️ Closest anchor: ${anchorType === "any" ? "Any" : anchorType.replaceAll('_', ' ')}</p>
            <p>${cityStatus}</p>
          </div>
        `;

        renderMap(originLatLng, anchor.place.geometry.location);

        setTimeout(() => {
          resultsDiv.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    );
  });
}
  
function renderMap(originLatLng, destinationLatLng) {
  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";

  const map = new google.maps.Map(mapDiv, {
    center: originLatLng,
    zoom: 10,
  });

  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
  });

  directionsService.route(
    {
      origin: originLatLng,
      destination: destinationLatLng,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      } else {
        console.warn("🚫 Failed to draw route:", status);
      }
    }
  );
}
  
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function getElevation(latlng) {
  return new Promise((resolve, reject) => {
    const elevator = new google.maps.ElevationService();
    elevator.getElevationForLocations({ locations: [latlng] }, (results, status) => {
      if (status === "OK" && results.length) {
        const meters = results[0].elevation;
        const feet = Math.round(meters * 3.28084);
        resolve(feet); // return in feet!
      } else {
        resolve(null); // Gracefully handle failure
      }
    });
  });
}

function onGoogleMapsReady() {
  console.log("✅ Google Maps API loaded!");
  document.querySelector("button").addEventListener("click", lookup);
}

setTimeout(() => {
  if (typeof google === 'undefined' || !google.maps) {
    document.getElementById('results').innerHTML = `
      <p>⚠️ Google Maps API not loaded. Did you forget to ./fill the API key?</p>
      <p>🗣️ if something breaks, blame John™</p>
    `;
  }
}, 4000); // 4 seconds should be enough
