import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import POIQuestionModal from './POIQuestionModal';
import Scoreboard from './Scoreboard';
import './Spielseite.css';

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

// Hilfsfunktionen
function haversineMeters(pos1, pos2) {
  if (!pos1 || !pos2) return Infinity;
  const [lat1, lon1] = pos1;
  const [lat2, lon2] = pos2;

  const toRad = deg => deg * (Math.PI / 180);
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function shuffle(array) {
  let a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Spielseite() {
  const { roomCode, groupName } = useParams();
  const query = useQuery();
  const rallyeId = Number(query.get('rallye_id')) || 1;
  const navigate = useNavigate();
  const params = useParams();

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [pois, setPois] = useState([]);
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('gps');

  const mapRef = useRef(null);
  const geoWatchRef = useRef(null);
  const positionRef = useRef(null);

  const activePoi = pois[index] || null;

  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60);
  const [timerRunning, setTimerRunning] = useState(true);

  const WASD_STEP = 50;

  // POIs und deren Fragen laden
  useEffect(() => {
    const loadPois = async () => {
      try {
        const backendBase = 'http://localhost:5000'; // Backend-URL

        const res = await fetch(`${backendBase}/api/pois`);
        if (!res.ok) throw new Error(`Fehler: ${res.status}`);
        const data = await res.json();

        const poiArray = data.pois || [];
        const filtered = shuffle(poiArray).filter(poi => Number(poi.rallye_id) === rallyeId);

        const poisWithQuestions = await Promise.all(
          filtered.map(async poi => {
            try {
              const qRes = await fetch(`${backendBase}/api/questions?poi_id=${poi.id}`);
              if (!qRes.ok) throw new Error(`Fehler: ${qRes.status}`);
              const qData = await qRes.json();
              return { ...poi, questions: qData.questions || [] };
            } catch (err) {
              console.error(`Fehler beim Laden der Fragen für POI ${poi.id}:`, err);
              return { ...poi, questions: [] };
            }
          })
        );

        setPois(poisWithQuestions);
        setIndex(0);
      } catch (err) {
        console.error('Fehler beim Laden der POIs oder Fragen:', err);
        setError('POIs konnten nicht geladen werden');
      }
    };

    loadPois();
  }, [rallyeId]);

  // Timer
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimeLeft(prev => Math.max(prev - 1, 0)), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // GPS-Modus
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

  // Keep a ref with the latest position for steady interval uploads
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Push immediately once we have a fresh position
  useEffect(() => {
    async function pushOnce() {
      try {
        if (!position) return;
        const rc = params.roomCode || query.get('room') || query.get('roomCode');
        const gn = params.groupName || query.get('groupName') || query.get('group');
        if (!rc || !gn) return;
        const body = { roomCode: rc, groupName: gn, lat: position[0], long: position[1] };
        const resp = await fetch('/api/sessiongroups/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.warn('Location upload (immediate) failed', resp.status, t);
        }
      } catch (e) {
        console.warn('Location upload (immediate) error', e);
      }
    }
    pushOnce();
  }, [position]);

  // Periodically upload player coordinates to DB every 10 seconds
  useEffect(() => {
    let timer = null;
    const rc = params.roomCode || query.get('room') || query.get('roomCode');
    const gn = params.groupName || query.get('groupName') || query.get('group');
    async function pushLocation() {
      try {
        const pos = positionRef.current;
        if (!rc || !gn || !pos) return;
        const body = { roomCode: rc, groupName: gn, lat: pos[0], long: pos[1] };
        const resp = await fetch('/api/sessiongroups/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.warn('Location upload failed', resp.status, t);
        }
      } catch (e) {
        console.warn('Location upload error', e);
      }
    }
    pushLocation();
    timer = setInterval(pushLocation, 10000);
    return () => { if (timer) clearInterval(timer); };
  }, [params.roomCode, params.groupName]);

  // WASD-Modus
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
    const rad = poi.radiusMeters ?? 50;
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
    <div className="ss-root">
      <MapContainer
        center={position || (activePoi?.coords || [52.516276, 13.377702])}
        zoom={15}
        className="ss-map"
        whenCreated={m => mapRef.current = m}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        {position && <Marker position={position} />}
        {activePoi && <Marker position={activePoi.coords} icon={redIcon} eventHandlers={{ click: handlePoiClick }} />}

        {/* Rote Linie vom aktuellen Standort zum nächsten POI */}
        {position && activePoi && (
          <Polyline
            positions={[position, activePoi.coords]}
            pathOptions={{ color: '#d9534f', weight: 4, opacity: 0.9 }}
          />
        )}
      </MapContainer>

      {/* Timer oben links */}
      <div className="ss-timer">
        Zeit verbleibend: {formatTime(timeLeft)}
      </div>

      {/* Buttons oben rechts */}
      <div className="ss-actions">
        <div className="ss-actions-row">
          <button onClick={toggleMode} className="ss-btn ss-btn-primary">
            {mode === 'gps' ? 'Modus: GPS' : 'Modus: WASD'}
          </button>
          <button
            onClick={async () => {
              try {
                const rc = roomCode || query.get('room') || query.get('roomCode');
                if (rc) await fetch(`/api/rooms/${encodeURIComponent(rc)}/finish`, { method: 'POST' });
              } catch (e) {
                console.warn('Failed to notify server to finish session', e);
              }
              const gn = groupName || query.get('groupName') || query.get('group');
              navigate(`/endseite/${encodeURIComponent(roomCode || '')}/${encodeURIComponent(gn || '')}`);
            }}
            className="ss-btn ss-btn-danger"
          >
            Rallye beenden
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <Scoreboard
        roomCode={roomCode || query.get('room') || query.get('roomCode')}
        currentGroupName={groupName || query.get('groupName') || query.get('group')}
        pollMs={5000}
      />

      {mode === 'wasd' && (
        <div className="ss-wasd">
          <b>WASD-Steuerung aktiv:</b> <span className="ss-mono">W/A/S/D</span> oder Pfeiltasten bewegen dich auf der Karte.
        </div>
      )}

      {error && (
        <div className="ss-error">
          {error}
        </div>
      )}

      <POIQuestionModal
        poi={activePoi}
        open={modalOpen}
        isNearby={isNearby(activePoi, position)}
        onAnswered={handleAnswered}
        onClose={() => setModalOpen(false)}
        roomCode={roomCode}
        groupName={groupName}
      />
    </div>
  );
}
