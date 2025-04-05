const cityHeuristics = [
  { maxMinutes: 9, minResults: 5, status: "🧠 Looks like you're IN a city" },
  { maxMinutes: 23, minResults: 5, status: "🧠 You're NEAR a city" },
  { maxMinutes: 39, minResults: 4, status: "🧠 Close to civilization" },
  { maxMinutes: 39, minResults: 2, status: "🧠 Outskirts of civilization" },
  { maxMinutes: Infinity, minResults: 0, status: "🧠 You're in the BOONIES" },
];

function extractAddress(text) {
    if (text.includes('zillow.com')) {
      const match = text.match(/\/([0-9a-zA-Z\-]+)-([a-zA-Z\-]+)-([a-zA-Z]{2})-(\d{5})/);
      if (match) {
        return match.slice(1).join(' ').replace(/-/g, ' ');
      }
    }
    return text.trim();
  }
  
  async function lookup() {
    document.getElementById('loading').classList.add('visible');
    const rawInput = document.getElementById('input').value;
    const cleaned = extractAddress(rawInput);
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p>Looking up: <strong>${cleaned}</strong>...</p>`;
  
    try {
      const place = await getGeocodedPlace(cleaned);
      renderInitialResults(place, resultsDiv);
      await findNearestAnchor(place.geometry.location, resultsDiv);
    } catch (err) {
      resultsDiv.innerHTML = `<p>${err}</p>`;
    } finally {
      document.getElementById('loading').classList.remove('visible');
    }
  }
  
  function getGeocodedPlace(address) {
    return new Promise((resolve, reject) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status !== 'OK' || !results.length) {
          reject('❌ Could not find location.');
        } else {
          resolve(results[0]);
        }
      });
    });
  }
  
  function renderInitialResults(place, resultsDiv) {
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
      <a class="map-link" href="https://www.google.com/maps/place/${lat},${lng}" target="_blank">📌 View on Google Maps</a>
      <a class="map-link" href="https://www.google.com/maps/search/${encodeURIComponent(typeName)}+near+${lat},${lng}" target="_blank">🔎 Nearby ${typeName}</a>
      <a class="map-link" href="https://www.google.com/maps/search/${fallbackType}+near+${lat},${lng}" target="_blank">🔎 Nearby ${fallbackType}</a>
    `;
  }
  
  async function findNearestAnchor(originLatLng, resultsDiv) {
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
  