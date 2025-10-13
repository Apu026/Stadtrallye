import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import POIQuestionModal from './POIQuestionModal';
import samplePOIs from '../data/pois.sample.json'; // sicherstellen, dass die Datei existiert

// Leaflet icon fix
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// Rotes Marker-Icon für Zielorte
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_RADIUS = 50;
const WASD_STEP = 0.00012;

function haversineMeters([lat1, lon1], [lat2, lon2]) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizePois(arr) {
  return (arr || []).map((p, i) => {
    const copy = { ...p };
    copy.id = typeof copy.id === 'number' ? copy.id : i + 1;
    copy.questions = copy.questions || [];
    return copy;
  });
}

function shuffle(array) {
  let a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Spielseite() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [pois, setPois] = useState(() => shuffle(normalizePois(samplePOIs || [])));
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('gps');
  const [rooms, setRooms] = useState([]);

  const mapRef = useRef(null);
  const geoWatchRef = useRef(null);

  const activePoi = pois[index] || null;

  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60);
  const [timerRunning, setTimerRunning] = useState(true);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (geoWatchRef.current !== null) {
      try { navigator.geolocation.clearWatch(geoWatchRef.current); } catch {}
      geoWatchRef.current = null;
    }
    if (mode !== 'gps') return;
    if (!navigator.geolocation) { setError('Geolocation nicht verfügbar'); return; }

    const id = navigator.geolocation.watchPosition(
      p => setPosition([p.coords.latitude, p.coords.longitude]),
      e => setError(e.message || 'Fehler beim Ermitteln des Standorts'),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    geoWatchRef.current = id;

    return () => {
      if (geoWatchRef.current !== null) {
        try { navigator.geolocation.clearWatch(geoWatchRef.current); } catch {}
        geoWatchRef.current = null;
      }
    };
  }, [mode]);

  const isNearby = useCallback((poi, userPos) => {
    if (!poi || !userPos) return false;
    const rad = poi.radiusMeters ?? DEFAULT_RADIUS;
    return haversineMeters(poi.coords, userPos) <= rad;
  }, []);

  function handlePoiClick() {
    if (!activePoi) return;
    if (isNearby(activePoi, position)) {
      setModalOpen(true);
    } else {
      mapRef.current?.flyTo(activePoi.coords, Math.max(mapRef.current.getZoom(), 16), { animate: true, duration: 0.6 });
    }
  }

  async function fetchRooms() {
    try {
      const res = await fetch('http://localhost:5000/api/rooms/all');
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Fehler beim Laden der Räume:', err);
    }
  }

  function toggleMode() {
    setModalOpen(false);
    setMode(prev => prev === 'gps' ? 'wasd' : 'gps');
    if (mode === 'gps' && !position && activePoi?.coords) setPosition(activePoi.coords);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <MapContainer
        center={position || (activePoi?.coords || [52.516276, 13.377702])}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        whenCreated={m => mapRef.current = m}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        {position && <Marker position={position} />}
        {activePoi && <Marker position={activePoi.coords} icon={redIcon} eventHandlers={{ click: handlePoiClick }} />}
      </MapContainer>

      <div style={{ position: 'absolute', top: 12, left: 60, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '6px 8px', borderRadius: 6, fontWeight: 'bold' }}>
          ⏱️ {formatTime(timeLeft)}
        </div>

        <button onClick={fetchRooms} style={{ padding: '8px 10px', borderRadius: 6, border: 'none', background: '#5cb85c', color: '#fff', cursor: 'pointer' }}>
          Räume laden
        </button>

        {rooms.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.9)', padding: '6px 8px', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
            {rooms.map(r => (
              <div key={r.id} style={{ marginBottom: 4 }}>
                <strong>{r.code}</strong> | Status: {r.status} | Rallye-ID: {r.rallye_id}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2000 }}>
        <button onClick={toggleMode} style={{ padding: '8px 10px', borderRadius: 6, border: 'none', background: '#0078d4', color: '#fff', cursor: 'pointer' }}>
          {mode === 'gps' ? 'Modus: GPS' : 'Modus: WASD'}
        </button>
      </div>

      {error && (
        <div style={{ position: 'absolute', top: 70, left: 12, zIndex: 2000, background: 'rgba(255,255,255,0.95)', padding: '6px 8px', borderRadius: 6, color: 'crimson' }}>
          {error}
        </div>
      )}

      <POIQuestionModal
        poi={activePoi}
        open={modalOpen}
        isNearby={isNearby(activePoi, position)}
        onAnswered={(qId, given, wasCorrect) => {}}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
