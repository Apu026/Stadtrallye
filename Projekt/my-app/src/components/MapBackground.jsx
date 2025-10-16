// MapBackground.jsx

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapBackground.css';
import figurIcon from '../assets/Figur_Route.svg';

const rallyeRoute = [
  [52.5155, 13.2877],
  [52.5077, 13.3433],
  [52.4751, 13.4316],
  [52.4856, 13.5272],
  [52.5402, 13.5761],
  [52.5736, 13.4531],
  [52.5607, 13.3411],
  [52.5300, 13.2856],
];

const flagIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});


const AnimatedMap = ({ route, movingIcon }) => {
  const map = useMap();
  const [movingPos, setMovingPos] = useState(route && route.length > 0 ? route[0] : [52.52, 13.405]);
  useEffect(() => {
    if (!route || route.length < 1) return;
    // if only one point, center once and stop
    if (route.length === 1) {
      try { map.setView(route[0], map.getZoom()); setMovingPos(route[0]); } catch (e) {}
      return;
    }
    // ensure map sizes are correct
    try { setTimeout(() => map.invalidateSize(), 100); } catch (e) {}

    let idx = 0, progress = 0;
    const stepCount = 80; // steps per segment
    const intervalMs = 50; // update rate
    let current = route[0], next = route[1];

    const interval = setInterval(() => {
      try {
        let lat, lng;
        if (progress <= stepCount) {
          lat = current[0] + (next[0] - current[0]) * (progress / stepCount);
          lng = current[1] + (next[1] - current[1]) * (progress / stepCount);
          setMovingPos([lat, lng]);
          // smooth follow without changing zoom
          map.panTo([lat, lng], { animate: true, duration: 0.4, easeLinearity: 0.25 });
          progress++;
        } else {
          // jump to next segment start
          setMovingPos(next);
          map.panTo(next, { animate: true, duration: 0.4, easeLinearity: 0.25 });
          idx = (idx + 1) % route.length;
          current = route[idx];
          next = route[(idx + 1) % route.length];
          progress = 0;
        }
      } catch (e) {
        // ignore paint errors
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [map, route]);
  return <Marker position={movingPos} icon={movingIcon} />;
};


const movingIcon = new L.Icon({
  iconUrl: figurIcon,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const MapBackground = () => (
  <div className="map-background">
    <MapContainer
      center={[52.52, 13.405]}
      zoom={13}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      style={{ height: '100vh', width: '100vw' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Polyline positions={rallyeRoute} color="#ff0000ff" weight={5} opacity={0.7} />
      {rallyeRoute.map((pos, idx) => (
        <Marker key={idx} position={pos} icon={flagIcon} />
      ))}
      <AnimatedMap route={rallyeRoute} movingIcon={movingIcon} />
    </MapContainer>
  </div>
);

export default MapBackground;
