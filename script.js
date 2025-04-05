const API_KEY = 'AIzaSyBRQy3FxhEsW347s7LBfzG5WsDR_IE8RKA'; // placeholder

function extractAddress(text) {
  if (text.includes('zillow.com')) {
    const match = text.match(/\/([0-9a-zA-Z\-]+)-([a-zA-Z\-]+)-([a-zA-Z]{2})-(\d{5})/);
    if (match) {
      return match.slice(1).join(' ').replace(/-/g, ' ');
    }
  }
  return text.trim();
}

function lookup() {
    document.getElementById('loading').classList.add('visible');
    const rawInput = document.getElementById('input').value;
    const cleaned = extractAddress(rawInput);
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p>Looking up: <strong>${cleaned}</strong>...</p>`;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: cleaned }, (results, status) => {
        if (status !== 'OK' || !results.length) {
        resultsDiv.innerHTML = `<p>❌ Could not find location.</p>`;
        return;
        }

        const place = results[0];
        const location = place.geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        const fullAddr = place.formatted_address;

        resultsDiv.innerHTML = `
        <p>📍 <strong>${fullAddr}</strong></p>
        <a class="map-link" href="https://www.google.com/maps/place/${lat},${lng}" target="_blank">📌 View on Google Maps</a>
        <a class="map-link" href="https://www.google.com/maps/search/schools+near+${lat},${lng}" target="_blank">🏫 Schools Nearby</a>
        <a class="map-link" href="https://www.google.com/maps/search/hospitals+near+${lat},${lng}" target="_blank">🏥 Hospitals Nearby</a>
        `;

        document.getElementById('loading').classList.remove('visible');
        findNearestAnchor(location, resultsDiv);
    });
}

function findNearestAnchor(originLatLng, resultsDiv) {
    const anchorType = document.getElementById("anchorType").value;
  
    const map = new google.maps.Map(document.createElement('div'));
    const placesService = new google.maps.places.PlacesService(map);
  
    const request = {
      location: originLatLng,
      radius: 50000,
    };
    if (anchorType !== "any") {
      request.type = anchorType;
    }
  
    placesService.nearbySearch(request, (places, status) => {
      if (status !== 'OK' || !places.length) {
        resultsDiv.innerHTML += `<p>🚫 No nearby place found.</p>`;
        return;
      }
  
      const topPlaces = places.slice(0, 5);
      const destinations = topPlaces.map(p => p.geometry.location);
  
      const distanceService = new google.maps.DistanceMatrixService();
      distanceService.getDistanceMatrix(
        {
          origins: [originLatLng],
          destinations: destinations,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
            if (status !== 'OK') {
            resultsDiv.innerHTML += `<p>🚫 Failed to get drive times.</p>`;
            return;
            }

            const elements = response.rows[0].elements;
            const driveTimes = elements.map((e, i) => ({
                minutes: e.status === 'OK' ? e.duration.value / 60 : Infinity,
                durationText: e.status === 'OK' ? e.duration.text : 'n/a',
                place: topPlaces[i],
                index: i,
            }));

            // Sort by time, just to be sure
            driveTimes.sort((a, b) => a.minutes - b.minutes);

            // Simple city heuristic
            // Drive time clustering heuristic v2
            const validResults = driveTimes.filter(e => e.minutes < Infinity);
            const closest = driveTimes[0];

            let cityStatus = '';
            if (closest.minutes <= 7 && validResults.length >= 5) {
                cityStatus = "🧠 Looks like you're IN a city";
            } else if (closest.minutes <= 13 && validResults.length >= 3) {
                cityStatus = "🧠 You're NEAR a city";
            } else if (closest.minutes <= 29 && validResults.length >= 3) {
                cityStatus = "🧠 We're looking at the outskirts";    
            } else {
                cityStatus = "🧠 You're in the BOONIES";
            }
  
            const anchor = driveTimes[0];
            const anchorName = anchor.place.name;
            const anchorVicinity = anchor.place.vicinity;
            const driveTime = anchor.durationText;
    
            resultsDiv.innerHTML += `
                <div class="map-drive">
                <p>🚘 <strong>${driveTime}</strong> drive to <em>${anchorName}</em> (${anchorVicinity})</p>
                <p>🏙️ Closest anchor: ${anchorType === "any" ? "Any" : anchorType.replaceAll('_', ' ')}</p>
                <p>${cityStatus}</p>
                </div>
            `;
    
            setTimeout(() => {
                resultsDiv.scrollIntoView({ behavior: 'smooth' });
            }, 200);
        }
      );
    });
  }
