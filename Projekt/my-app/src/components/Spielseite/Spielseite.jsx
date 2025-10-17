import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Scoreboard from '../Scoreboard';
import MapPane from './MapPane';
import POIQuestionModal from './POIQuestionModal';
import LeaveConfirmModal from './LeaveConfirmModal';
import { haversineMeters, shuffle, formatTime } from './utils';
import '../Spielseite.css';

function useQuery() { return new URLSearchParams(useLocation().search); }

export default function Spielseite() {
  const { roomCode, groupName } = useParams();
  const query = useQuery();
  const rallyeId = Number(query.get('rallye_id')) || 1;
  const navigate = useNavigate();

  // NEU: einmalig bestimmen, damit überall verfügbar
  const rc = roomCode || query.get('room') || query.get('roomCode');
  const gn = groupName || query.get('groupName') || query.get('group');

  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [pois, setPois] = useState([]);
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mode, setMode] = useState('gps');
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60);

  const mapRef = useRef(null);
  const geoWatchRef = useRef(null);
  const posRef = useRef(null);
  posRef.current = position;

  const activePoi = pois[index] || null;
  const WASD_STEP = 75;

  // POIs + Fragen laden
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/pois');
        const data = await res.json();
        const list = Array.isArray(data?.pois) ? data.pois : (Array.isArray(data) ? data : []);
        const filtered = shuffle(list).filter(p => Number(p.rallye_id ?? p.rallyeId ?? 0) === rallyeId);

        const withQuestions = await Promise.all(filtered.map(async (p) => {
          let qs = [];
          try {
            const qRes = await fetch(`/api/questions?poi_id=${encodeURIComponent(p.id ?? p.poi_id ?? '')}`);
            if (qRes.ok) {
              const j = await qRes.json();
              qs = Array.isArray(j?.questions) ? j.questions : (Array.isArray(j) ? j : []);
            }
          } catch (e) { console.warn('Fragen laden fehlgeschlagen:', e); }
          const lat = Number(p.lat ?? p.latitude ?? (Array.isArray(p.coords) ? p.coords[0] : undefined));
          const lon = Number(p.long ?? p.lng ?? p.longitude ?? (Array.isArray(p.coords) ? p.coords[1] : undefined));
          return {
            ...p,
            coords: Array.isArray(p.coords) ? p.coords : (Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null),
            radiusMeters: Number(p.radiusMeters ?? p.radius ?? 50),
            questions: qs,
          };
        }));

        if (alive) {
          setPois(withQuestions);
          setIndex(0);
        }
      } catch (e) {
        console.error(e);
        if (alive) setError('POIs konnten nicht geladen werden');
      }
    })();
    return () => { alive = false; };
  }, [rallyeId]);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // GPS
  useEffect(() => {
    if (geoWatchRef.current !== null) {
      try { navigator.geolocation.clearWatch(geoWatchRef.current); } catch {}
      geoWatchRef.current = null;
    }
    if (mode !== 'gps') return;
    if (!navigator.geolocation) { setError('Geolocation nicht verfügbar'); return; }

    const id = navigator.geolocation.watchPosition(
      (p) => setPosition([p.coords.latitude, p.coords.longitude]),
      (e) => setError(e.message || 'Fehler beim Ermitteln des Standorts'),
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

  // WASD
  useEffect(() => {
    if (mode !== 'wasd') return;
    function onKey(e) {
      if (!posRef.current) return;
      let [lat, lon] = posRef.current;
      const latStep = WASD_STEP / 111320;
      const lonStep = WASD_STEP / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
      if (e.key === 'w' || e.key === 'ArrowUp') lat += latStep;
      if (e.key === 's' || e.key === 'ArrowDown') lat -= latStep;
      if (e.key === 'a' || e.key === 'ArrowLeft') lon -= lonStep;
      if (e.key === 'd' || e.key === 'ArrowRight') lon += lonStep;
      setPosition([lat, lon]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // Position an Server: sofort + alle 10s
  useEffect(() => {
    // nutzt rc/gn von oben

    async function pushImmediate() {
      try {
        if (!position || !rc || !gn) return;
        await fetch('/api/sessiongroups/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: rc, groupName: gn, lat: position[0], long: position[1] })
        });
      } catch (e) { console.warn('Location upload (immediate) error', e); }
    }
    pushImmediate();

    let timer = null;
    async function push() {
      try {
        const p = posRef.current;
        if (!p || !rc || !gn) return;
        await fetch('/api/sessiongroups/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: rc, groupName: gn, lat: p[0], long: p[1] })
        });
      } catch (e) { console.warn('Location upload error', e); }
    }
    push();
    timer = setInterval(push, 10000);
    return () => { if (timer) clearInterval(timer); };
  }, [position, roomCode, groupName, query]);

  const isNearby = useCallback((poi, userPos) => {
    if (!poi || !userPos || !poi.coords) return false;
    const rad = Number(poi.radiusMeters ?? 50);
    return haversineMeters(poi.coords, userPos) <= rad;
  }, []);

  function handlePoiClick() {
    if (!activePoi) return;
    setModalOpen(true);
  }

  function toggleMode() {
    setModalOpen(false);
    setMode((m) => (m === 'gps' ? 'wasd' : 'gps'));
    if (mode === 'gps' && !position && activePoi?.coords) setPosition(activePoi.coords);
  }

  async function handleAnswered(qId, given, wasCorrect) {
    const currentPoi = pois[index];
    if (!currentPoi) return;
    const already = currentPoi.questions?.some(q => q.id === qId && q.userAnswers?.length);
    if (already) return;

    const updated = pois.map((poi, i) => {
      if (i !== index) return poi;
      return {
        ...poi,
        questions: poi.questions.map(q => q.id === qId ? { ...q, userAnswers: [...(q.userAnswers || []), given] } : q)
      };
    });
    setPois(updated);

    // Punkte nur bei richtiger Antwort melden
    if (wasCorrect && rc && gn) {
      try {
        await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: rc,
            groupName: gn,
            poiId: currentPoi.id,
            questionId: qId,
            correct: true
          })
        });
      } catch (e) {
        console.warn('Punkte-Upload fehlgeschlagen', e);
      }
    }

    const allAnswered = updated[index].questions.every(q => q.userAnswers?.length);
    if (allAnswered) {
      setModalOpen(false);
      if (index < pois.length - 1) setTimeout(() => setIndex(index + 1), 300);
    }
  }

  return (
    <div className="ss-root">
      <MapPane
        center={position || (activePoi?.coords || [52.516276, 13.377702])}
        position={position}
        activePoi={activePoi}
        onPoiClick={handlePoiClick}
        onMapReady={(m) => (mapRef.current = m)}
      />

      <div className="ss-timer">Zeit verbleibend: {formatTime(timeLeft)}</div>

      <div className="ss-actions">
        <div className="ss-actions-row">
          <button onClick={toggleMode} className="ss-btn ss-btn-primary">
            {mode === 'gps' ? 'Modus: GPS' : 'Modus: WASD'}
          </button>
          <button onClick={() => setLeaveOpen(true)} className="ss-btn ss-btn-danger">Rallye beenden</button>
        </div>
      </div>

      <Scoreboard roomCode={rc} currentGroupName={gn} pollMs={5000} />

      {mode === 'wasd' && (
        <div className="ss-wasd">
          <b>WASD-Steuerung aktiv:</b> <span className="ss-mono">W/A/S/D</span> oder Pfeiltasten bewegen dich auf der Karte.
        </div>
      )}

      {error && <div className="ss-error">{error}</div>}

      <POIQuestionModal
        poi={activePoi}
        open={modalOpen}
        isNearby={isNearby(activePoi, position)}
        onAnswered={handleAnswered}
        onClose={() => setModalOpen(false)}
      />

      <LeaveConfirmModal
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={async () => {
          setLeaveOpen(false);
          try {
            if (rc) await fetch(`/api/rooms/${encodeURIComponent(rc)}/finish`, { method: 'POST' });
          } catch (e) { console.warn('Failed to notify server to finish session', e); }
          navigate(`/endseite/${encodeURIComponent(roomCode || '')}/${encodeURIComponent(gn || '')}`, { replace: true });
        }}
      />
    </div>
  );
}