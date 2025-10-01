import React, { useEffect, useState, useRef, useCallback } from 'react';
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

// 🔴 Rotes Marker-Icon für Zielorte
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_RADIUS = 50;
const WASD_STEP = 0.00012;

// Haversine
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

// Normalize POIs
function normalizePois(arr) {
  return (arr || []).map((p, i) => {
    const copy = { ...p };
    if (typeof copy.id !== 'number') {
      const parsed = Number(String(copy.id).replace(/\D/g, '')) || (i + 1);
      copy.id = parsed;
    }
    if (!Array.isArray(copy.questions)) {
      if (copy.question) {
        copy.questions = [{
          id: (copy.id * 1000) + 0,
          question: copy.question,
          answers: copy.answers ?? [],
          correctAnswerIndex: copy.correctAnswerIndex ?? null,
          userAnswers: []
        }];
        delete copy.question;
        delete copy.answers;
        delete copy.correctAnswerIndex;
      } else {
        copy.questions = [];
      }
    } else {
      copy.questions = copy.questions.map((q, qi) => ({
        id: typeof q.id === 'number' ? q.id : (copy.id * 1000) + (qi + 1),
        question: q.question ?? '',
        answers: q.answers ?? [],
        correctAnswerIndex: q.correctAnswerIndex ?? null,
        userAnswers: q.userAnswers ?? []
      }));
    }
    return copy;
  });
}

// Shuffle-Funktion
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

  // 🔄 POIs immer zufällig beim Laden
  const [pois, setPois] = useState(() => {
    const normalized = normalizePois(samplePOIs);
    return shuffle(normalized);
  });

  const [index, setIndex] = useState(0); // Immer beim ersten POI starten

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('gps');

  const mapRef = useRef(null);
  const geoWatchRef = useRef(null);

  const activePoi = pois && pois.length > 0 && index >= 0 && index < pois.length ? pois[index] : null;

  // Timer
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60);
  const [timerRunning, setTimerRunning] = useState(true);

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  useEffect(() => {
    if (!timerRunning) return;
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, timerRunning]);

  // GPS
  useEffect(() => {
    if (geoWatchRef.current !== null) {
      try { navigator.geolocation.clearWatch(geoWatchRef.current); } catch {}
      geoWatchRef.current = null;
    }
    if (mode !== 'gps') return;
    if (!navigator.geolocation) { setError('Geolocation nicht verfügbar'); return; }

    navigator.geolocation.getCurrentPosition(
      p => setPosition([p.coords.latitude, p.coords.longitude]),
      e => setError(e.message || 'Fehler beim Ermitteln des Standorts'),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    const id = navigator.geolocation.watchPosition(
      p => setPosition([p.coords.latitude, p.coords.longitude]),
      () => {},
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
      if (!position) {
        const start = activePoi?.coords || [52.516276, 13.377702];
        setPosition(start);
        return;
      }
      const [lat,lng] = position;
      let next = null;
      if (e.key==='w'||e.key==='ArrowUp') next=[lat+WASD_STEP,lng];
      if (e.key==='s'||e.key==='ArrowDown') next=[lat-WASD_STEP,lng];
      if (e.key==='a'||e.key==='ArrowLeft') next=[lat,lng-WASD_STEP];
      if (e.key==='d'||e.key==='ArrowRight') next=[lat,lng+WASD_STEP];
      if (next){
        setPosition(next);
        if(mapRef.current) mapRef.current.setView(next,mapRef.current.getZoom(),{animate:false});
      }
    }
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  }, [mode,position,activePoi]);

  const isNearby = useCallback((poi,userPos)=>{
    if(!poi||!userPos) return false;
    const rad=poi.radiusMeters??DEFAULT_RADIUS;
    return haversineMeters(poi.coords,userPos)<=rad;
  },[]);

  function handlePoiClick(){
    if(!activePoi) return;
    if(isNearby(activePoi,position)){
      setModalOpen(true);
    } else {
      const m = mapRef.current;
      if(m) m.flyTo(activePoi.coords,Math.max(m.getZoom(),16),{animate:true,duration:0.6});
    }
  }

  function handleQuestionAnswered(qId,given,wasCorrect){
    if(!activePoi) return;
    const copy = pois.slice();
    const p = {...copy[index]};
    p.questions = p.questions.map(q=>q.id===qId ? {...q,userAnswers:(q.userAnswers||[]).concat({at:new Date().toISOString(),pos:position,answer:given,correct:!!wasCorrect})} : q);
    copy[index]=p;
    setPois(copy);

    const allCorrect = p.questions.length>0 && p.questions.every(q=>(q.userAnswers||[]).some(u=>u.correct));
    if(allCorrect){
      const next=index+1;
      if(next<copy.length) setIndex(next);
      else setIndex(0);
      setModalOpen(false);
    }
  }

  function toggleMode(){
    setModalOpen(false);
    setMode(prev=>prev==='gps'?'wasd':'gps');
    if(mode==='gps' && !position && activePoi?.coords) setPosition(activePoi.coords);
  }

  return (
    <div style={{position:'fixed',inset:0}}>
      <MapContainer
        center={position||(activePoi?activePoi.coords:[52.516276,13.377702])}
        zoom={15}
        style={{height:'100%',width:'100%'}}
        whenCreated={m=>mapRef.current=m}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors"/>
        {position&&<Marker position={position}/>}
        {activePoi&&<Marker position={activePoi.coords} icon={redIcon} eventHandlers={{click:handlePoiClick}} />}
      </MapContainer>

      {/* Links: Timer + Spiel beenden */}
      <div style={{position:'absolute',top:12,left:60,zIndex:2000,display:'flex',flexDirection:'column',gap:8}}>
        <div style={{background:'rgba(255,255,255,0.9)',padding:'6px 8px',borderRadius:6,fontWeight:'bold'}}>
          ⏱️ {formatTime(timeLeft)}
        </div>

        <button onClick={()=>{
          if(window.confirm('Sind Sie sicher, dass Sie das Spiel frühzeitig beenden möchten?')){
            setModalOpen(false); setPois([]); setIndex(0); setTimerRunning(false); setPosition(null);
          }
        }} style={{padding:'8px 10px',borderRadius:6,border:'none',background:'#d9534f',color:'#fff',cursor:'pointer'}}>
          Spiel beenden
        </button>
      </div>

      {/* Rechts: Modus-Schalter */}
      <div style={{position:'absolute',top:12,right:12,zIndex:2000}}>
        <button onClick={toggleMode} style={{padding:'8px 10px',borderRadius:6,border:'none',background:'#0078d4',color:'#fff',cursor:'pointer'}}>
          {mode==='gps'?'Modus: GPS':'Modus: WASD'}
        </button>
      </div>

      {error && <div style={{position:'absolute',top:70,left:12,zIndex:2000,background:'rgba(255,255,255,0.95)',padding:'6px 8px',borderRadius:6,color:'crimson'}}>
        {error}
      </div>}

      <POIQuestionModal
        poi={activePoi}
        open={modalOpen}
        isNearby={isNearby(activePoi,position)}
        onAnswered={handleQuestionAnswered}
        onClose={()=>setModalOpen(false)}
      />
    </div>
  );
}
