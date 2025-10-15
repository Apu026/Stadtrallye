import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import POIQuestionModal from './POIQuestionModal';
import samplePOIs from '../data/pois.sample.json';

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

// Hilfsfunktion zum Auslesen von Query-Parametern
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Spielseite() {
  const query = useQuery();
  const rallyeId = Number(query.get('rallye_id')) || 1;

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [pois, setPois] = useState([]);
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('gps');

  const mapRef = useRef(null);
  const geoWatchRef = useRef(null);

  const activePoi = pois[index] || null;

  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60);
  const [timerRunning, setTimerRunning] = useState(true);

  const WASD_STEP = 100;

  useEffect(() => {
    const filtered = shuffle(normalizePois(samplePOIs)).filter(poi => Number(poi.rallye_id) === rallyeId);
    setPois(filtered);
    setIndex(0);
  }, [rallyeId]);

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

  useEffect(() => {
    if (mode !== 'wasd') return;
    function handleKey(e) {
      if (!position) return;
      let [lat, lon] = position;
      const latStep = WASD_STEP / 111320;
      const lonStep = WASD_STEP / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
      if (e.key === 'w' || e.key === 'ArrowUp') lat += latStep;
      if (e.key === 's' || e.key === 'ArrowDown') lat -= latStep;
      if (e.key === 'a' || e.key === 'ArrowLeft') lon -= lonStep;
      if (e.key === 'd' || e.key === 'ArrowRight') lon += lonStep;
      setPosition([lat, lon]);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, position]);

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

  function handleAnswered(qId, given, wasCorrect) {
    const currentPoi = pois[index];
    if (!currentPoi) return;

    const updatedPois = pois.map((poi, i) => {
      if (i !== index) return poi;
      return {
        ...poi,
        questions: poi.questions.map(q =>
          q.id === qId
            ? { ...q, userAnswers: [...(q.userAnswers || []), given] }
            : q
        )
      };
    });
    setPois(updatedPois);

    const allAnswered = updatedPois[index].questions.every(q => q.userAnswers && q.userAnswers.length > 0);

    if (allAnswered) {
      setModalOpen(false);
      if (index < pois.length - 1) {
        setTimeout(() => setIndex(index + 1), 400);
      }
    }
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

      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2000 }}>
        <button onClick={toggleMode} style={{ padding: '8px 10px', borderRadius: 6, border: 'none', background: '#0078d4', color: '#fff', cursor: 'pointer' }}>
          {mode === 'gps' ? 'Modus: GPS' : 'Modus: WASD'}
        </button>
      </div>

      {mode === 'wasd' && (
        <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 2000, background: 'rgba(255,255,255,0.95)', padding: '8px 12px', borderRadius: 8 }}>
          <b>WASD-Steuerung aktiv:</b> <span style={{ fontFamily: 'monospace' }}>W/A/S/D</span> oder Pfeiltasten bewegen dich auf der Karte.
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', top: 70, left: 12, zIndex: 2000, background: 'rgba(255,255,255,0.95)', padding: '6px 8px', borderRadius: 6, color: 'crimson' }}>
          {error}
        </div>
      )}

      <POIQuestionModal
        poi={activePoi}
        open={modalOpen}
        isNearby={isNearby(activePoi, position)}
        onAnswered={handleAnswered}
        onClose={() => setModalOpen(false)}
      />
    </div> 
  );
} 
