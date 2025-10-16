import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './AdminSpielseite.css';

// Leaflet default icons fix
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const API_BASE = (import.meta?.env?.VITE_API_BASE) || '';

export default function AdminLiveMap() {
  const { roomCode: roomCodeParam } = useParams();
  // Session/room is selected via route param only (no manual input)
  const roomCode = (roomCodeParam || '').toUpperCase();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [route, setRoute] = useState([]);
  const [pois, setPois] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const routeTimer = useRef(null);
  const playersTimer = useRef(null);
  const pointsTimer = useRef(null);
  const locationTimer = useRef(null);
  const [points, setPoints] = useState(null);
  const [playerLocation, setPlayerLocation] = useState(null); // [lat, long]
  const mapRef = useRef(null);

  // Load POIs (admin page endpoint returns array)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/page/adminspielseite/pois`);
        if (res.ok) {
          const list = await res.json();
          if (mounted) setPois(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load players for room
  const fetchPlayers = async (code) => {
    if (!code) return;
    try {
      const res = await fetch(`${API_BASE}/api/page/adminspielseite/players?roomCode=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const data = await res.json();
      setPlayers(Array.isArray(data?.players) ? data.players : []);
    } catch (e) {
      // ignore
    }
  };

  // Load route for selected player
  const fetchRoute = async (code, groupId) => {
    if (!code || !groupId) { setRoute([]); return; }
    try {
      const res = await fetch(`${API_BASE}/api/page/adminspielseite/players/${encodeURIComponent(groupId)}/route?roomCode=${encodeURIComponent(code)}`);
      if (!res.ok) { setRoute([]); return; }
      const data = await res.json();
      const r = Array.isArray(data?.route) ? data.route : [];
      setRoute(r);
    } catch (e) {
      setRoute([]);
    }
  };

  // Handle roomCode changes and polling (roomCode comes from URL param)
  useEffect(() => {
    if (!roomCode) return;
    setLoading(true);
    fetchPlayers(roomCode).finally(() => setLoading(false));
    if (playersTimer.current) clearInterval(playersTimer.current);
    playersTimer.current = setInterval(() => fetchPlayers(roomCode), 5000);
    return () => { if (playersTimer.current) clearInterval(playersTimer.current); };
  }, [roomCode]);

  // Poll route for selected player
  useEffect(() => {
    if (!roomCode || !selectedPlayer) { if (routeTimer.current) clearInterval(routeTimer.current); return; }
    fetchRoute(roomCode, selectedPlayer.id);
    if (routeTimer.current) clearInterval(routeTimer.current);
    routeTimer.current = setInterval(() => fetchRoute(roomCode, selectedPlayer.id), 4000);
    return () => { if (routeTimer.current) clearInterval(routeTimer.current); };
  }, [roomCode, selectedPlayer]);

  // Helper: fetch points for selected player from sessiongroups
  const fetchPoints = async (code, groupId) => {
    if (!code || !groupId) { setPoints(null); return; }
    try {
      const res = await fetch(`${API_BASE}/api/sessiongroups?roomCode=${encodeURIComponent(code)}`);
      if (!res.ok) { setPoints(null); return; }
      const body = await res.json();
      const sgs = Array.isArray(body) ? body : (body.sessiongroups || []);
      const row = sgs.find(s => String(s.group_id) === String(groupId));
      setPoints(row ? Number(row.points || 0) : 0);
    } catch (e) {
      setPoints(null);
    }
  };

  // Fetch only location (lat/long) for selected player
  const fetchLocation = async (code, groupId) => {
    if (!code || !groupId) { setPlayerLocation(null); return; }
    try {
      const res = await fetch(`${API_BASE}/api/sessiongroups?roomCode=${encodeURIComponent(code)}`);
      if (!res.ok) { setPlayerLocation(null); return; }
      const body = await res.json();
      const sgs = Array.isArray(body) ? body : (body.sessiongroups || []);
      const row = sgs.find(s => String(s.group_id) === String(groupId));
      if (row && row.lat != null && row.long != null) {
        const latNum = Number(row.lat);
        const lonNum = Number(row.long);
        if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
          setPlayerLocation([latNum, lonNum]);
          return;
        }
      }
      setPlayerLocation(null);
    } catch (e) {
      setPlayerLocation(null);
    }
  };

  // Poll points every 10 seconds for selected player
  useEffect(() => {
    if (!roomCode || !selectedPlayer) { if (pointsTimer.current) clearInterval(pointsTimer.current); setPoints(null); return; }
    // initial fetch
    fetchPoints(roomCode, selectedPlayer.id);
    if (pointsTimer.current) clearInterval(pointsTimer.current);
    pointsTimer.current = setInterval(() => fetchPoints(roomCode, selectedPlayer.id), 10000);
    return () => { if (pointsTimer.current) clearInterval(pointsTimer.current); };
  }, [roomCode, selectedPlayer]);

  // Poll location every 30 seconds for selected player (throttled)
  useEffect(() => {
    if (!roomCode || !selectedPlayer) { if (locationTimer.current) clearInterval(locationTimer.current); setPlayerLocation(null); return; }
    // initial fetch
    fetchLocation(roomCode, selectedPlayer.id);
  if (locationTimer.current) clearInterval(locationTimer.current);
  locationTimer.current = setInterval(() => fetchLocation(roomCode, selectedPlayer.id), 10000);
    return () => { if (locationTimer.current) clearInterval(locationTimer.current); };
  }, [roomCode, selectedPlayer]);

  const center = useMemo(() => {
    if (playerLocation && playerLocation.length === 2) return [playerLocation[0], playerLocation[1]];
    if (route.length > 0) return [Number(route[route.length - 1].lat) || 52.52, Number(route[route.length - 1].lng) || 13.405];
    if (pois[0]?.lat && pois[0]?.lng) return [Number(pois[0].lat), Number(pois[0].lng)];
    return [52.52, 13.405];
  }, [route, pois, playerLocation]);

  // Fly to live location when it updates
  useEffect(() => {
    try {
      if (mapRef.current && playerLocation && playerLocation.length === 2) {
        mapRef.current.flyTo(playerLocation, mapRef.current.getZoom(), { duration: 0.5 });
      }
    } catch {}
  }, [playerLocation]);

  return (
    <div className="admin-shell">
      {/* Fullscreen map background */}
      <div id="admin-map-root">
        <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }} whenCreated={(m) => { mapRef.current = m; }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {/* POIs as red markers */}
          {pois.map(p => (
            <Marker key={`poi-${p.id}`} position={[Number(p.lat), Number(p.lng)]} icon={redIcon} />
          ))}
          {/* Route polyline and last position marker */}
          {route.length > 0 && (
            <>
              <Polyline positions={route.map(r => [Number(r.lat), Number(r.lng)])} pathOptions={{ color: '#0078d4', weight: 4 }} />
              <Marker position={[Number(route[route.length - 1].lat), Number(route[route.length - 1].lng)]} />
            </>
          )}
          {/* Live player location (if available) */}
          {playerLocation && (
            <Marker position={playerLocation} icon={greenIcon}>
              {selectedPlayer && (
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false} sticky>
                  {selectedPlayer.name}
                </Tooltip>
              )}
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Right-side toolset panel */}
      <aside className="admin-panel" aria-label="Admin Live-Tracking Panel">
        <div className="panel-actions" style={{ marginBottom: 8 }}>
          <button type="button" onClick={() => {
            try {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/admin');
              }
            } catch (e) {
              navigate('/admin');
            }
          }}>Zurück</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Admin Live-Tracking</h3>
          {roomCode && (
            <button type="button" onClick={() => navigate(`/admin/end/${encodeURIComponent(roomCode)}`)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#444', color: '#fff' }}>Auswertung</button>
          )}
        </div>
        <div className="small" style={{ marginBottom: 6 }}>Raum-Code: {roomCode ? <b>{roomCode}</b> : <span className="muted">—</span>}</div>
        {!roomCode && <div className="muted">Bitte diese Seite über den „Live-Tracking“-Knopf in der Admin-Ansicht öffnen.</div>}
        {loading && <div className="muted">Lade…</div>}
        {players.length === 0 && roomCode && !loading && (
          <div className="muted">Keine Spieler für diesen Raum gefunden.</div>
        )}

        <div className="poi-list" style={{ marginTop: 8 }}>
          {players.map(p => (
            <div
              key={p.id}
              className={`poi-item ${selectedPlayer?.id === p.id ? 'active' : ''}`}
              style={{ alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setSelectedPlayer(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlayer(p); }}
            >
              <div className="poi-info">
                <strong>{p.name}</strong>
                <div className="small">ID: {p.id}</div>
              </div>
              <div className="poi-actions" style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPlayer(p); }}>Route</button>
              </div>
            </div>
          ))}
          {players.length === 0 && roomCode && !loading && <div className="muted">Keine Spieler</div>}
        </div>

        {selectedPlayer && (
          <>
            <hr />
            <h4 style={{ margin: '8px 0' }}>Route von {selectedPlayer.name}</h4>
            <div className="small">Punkte: {points != null ? points : '—'}</div>
            <div className="small">Live-Position: {playerLocation ? `${playerLocation[0].toFixed(5)}, ${playerLocation[1].toFixed(5)}` : '—'}</div>
          </>
        )}
      </aside>
    </div>
  );
}
