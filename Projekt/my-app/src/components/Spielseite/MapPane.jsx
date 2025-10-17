import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet-Icon-Fix
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
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function MapPane({ center, position, activePoi, onPoiClick, onMapReady }) {
  const handlePoiClick = (e) => {
    if (e?.originalEvent?.stopPropagation) e.originalEvent.stopPropagation();
    setTimeout(() => onPoiClick?.(), 0);
  };

  return (
    <MapContainer center={center} zoom={15} className="ss-map" whenCreated={(m) => onMapReady?.(m)}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      {position && <Marker position={position} />}
      {activePoi?.coords && (
        <Marker position={activePoi.coords} icon={redIcon} zIndexOffset={500} eventHandlers={{ click: handlePoiClick }} />
      )}
      {position && activePoi?.coords && (
        <>
          <Polyline positions={[position, activePoi.coords]} pathOptions={{ color: '#d9534f', weight: 4, opacity: 0.9 }} />
          <Circle
            center={activePoi.coords}
            radius={Number(activePoi.radiusMeters ?? 50)}
            pathOptions={{ color: '#d9534f', opacity: 0.35 }}
            interactive={true}
            bubblingMouseEvents={false}
            eventHandlers={{ click: handlePoiClick }}
          />
        </>
      )}
    </MapContainer>
  );
}