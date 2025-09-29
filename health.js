// script.js
let map, userMarker;
let userLatLng = null;
const placesListEl = document.getElementById('placesList');
const locEl = document.getElementById('loc');

function initMap() {
  map = L.map('map').setView([20.5937, 78.9629], 5); // fallback center (India)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

// Call on load
initMap();
detectLocationAndShow();

document.getElementById('refreshBtn').addEventListener('click', () => {
  if (userLatLng) {
    findNearbyPlaces(userLatLng.lat, userLatLng.lng);
  } else {
    detectLocationAndShow();
  }
});

document.getElementById('panicBtn').addEventListener('click', async () => {
  if (!userLatLng) {
    alert('Cannot find your location. Please allow location access and try again.');
    return;
  }

  const places = await queryOverpass(userLatLng.lat, userLatLng.lng, 2000, ['hospital','pharmacy','clinic']);
  const nearest = findNearestPlace(userLatLng, places);

  const payload = {
    user: { lat: userLatLng.lat, lon: userLatLng.lng, timestamp: new Date().toISOString() },
    nearest_place: nearest || null,
    note: 'Panic button pressed - demo alert'
  };

  try {
    const res = await fetch('/api/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert('🚨 Panic alert sent! Server response: ' + (data.message || 'ok'));
  } catch (e) {
    console.error(e);
    alert('Error sending alert to server. See console.');
  }
});

async function detectLocationAndShow() {
  locEl.innerText = 'Detecting...';
  if (!navigator.geolocation) {
    locEl.innerText = 'Geolocation not supported by your browser';
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    userLatLng = { lat, lng };
    locEl.innerHTML = `Latitude: ${lat.toFixed(6)}, Longitude: ${lng.toFixed(6)} <div class="small">Accuracy: ${pos.coords.accuracy} meters</div>`;

    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng]).addTo(map).bindPopup('You are here').openPopup();
    map.setView([lat, lng], 15);

    await findNearbyPlaces(lat, lng);
  }, (err) => {
    console.error(err);
    locEl.innerText = 'Location permission denied or unavailable';
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

async function queryOverpass(lat, lon, radius=2000, types=['hospital']) {
  const typeFilters = types.map(t => 
    `node(around:${radius},${lat},${lon})[amenity=${t}];way(around:${radius},${lat},${lon})[amenity=${t}];relation(around:${radius},${lat},${lon})[amenity=${t}];`
  ).join('');
  const q = `[out:json][timeout:25];(${typeFilters});out center;`;
  const url = 'https://overpass-api.de/api/interpreter';

  try {
    const resp = await fetch(url, { method: 'POST', body: q });
    const data = await resp.json();
    const places = (data.elements || []).map(el => {
      const latp = el.lat || (el.center && el.center.lat);
      const lonp = el.lon || (el.center && el.center.lon);
      return {
        id: el.id,
        type: el.tags && el.tags.amenity ? el.tags.amenity : 'place',
        name: (el.tags && (el.tags.name || el.tags['official_name'])) || 'Unknown',
        lat: latp,
        lon: lonp,
        tags: el.tags || {}
      };
    }).filter(p => p.lat && p.lon);
    return places;
  } catch (e) {
    console.error('Overpass query failed', e);
    return [];
  }
}

function findNearestPlace(user, places) {
  if (!places || places.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  places.forEach(p => {
    const d = distanceMeters(user.lat, user.lon, p.lat, p.lon);
    if (d < bestDist) {
      bestDist = d;
      best = { ...p, distance_m: Math.round(d) };
    }
  });
  return best;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function findNearbyPlaces(lat, lon) {
  placesListEl.innerHTML = 'Searching nearby hospitals & pharmacies...';

  const places = await queryOverpass(lat, lon, 3000, ['hospital','clinic','pharmacy']);

  map.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer !== userMarker) {
      map.removeLayer(layer);
    }
  });

  if (!places || places.length === 0) {
    placesListEl.innerHTML = '<li>No nearby places found within 3 km (demo).</li>';
    return;
  }

  placesListEl.innerHTML = '';
  places.sort((a,b) => distanceMeters(lat, lon, a.lat, a.lon) - distanceMeters(lat, lon, b.lat, b.lon));

  places.forEach((p, idx) => {
    const dist = Math.round(distanceMeters(lat, lon, p.lat, p.lon));
    const marker = L.marker([p.lat, p.lon]).addTo(map);
    marker.bindPopup(`<b>${p.name}</b><br>${p.type}<br>${dist} m away`);

    const li = document.createElement('li');
    li.innerHTML = `<b>${p.name}</b> <span class="small">(${p.type}) - ${dist} m</span>`;
    const btn = document.createElement('button');
    btn.textContent = 'Send to nearest';
    btn.style.marginLeft = '10px';
    btn.onclick = async () => {
      const payload = {
        user: { lat, lon, timestamp: new Date().toISOString() },
        nearest_place: p,
        note: 'Manual send of nearest place via list button'
      };
      try {
        const res = await fetch('/api/send-alert', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert('Sent to server: ' + (data.message || 'ok'));
      } catch(e) {
        console.error(e);
        alert('Error sending to server.');
      }
    };
    li.appendChild(btn);
    placesListEl.appendChild(li);

    if (idx === 0) {
      marker.openPopup();
      marker.bindPopup(`<b>${p.name} (Nearest)</b><br>${p.type}<br>${dist} m away`);
    }
  });
}