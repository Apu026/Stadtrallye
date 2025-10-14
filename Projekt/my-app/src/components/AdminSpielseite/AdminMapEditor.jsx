import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function AdminMapEditor({ pois = [], onCreateLocal, onSelect, onMoveLocal }) {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const containerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    // restore last center/zoom if available to avoid re-centering on remounts
    const saved = window.__adminMapState || null;
    const initialCenter = saved && Array.isArray(saved.center) ? saved.center : [52.52, 13.405];
    const initialZoom = saved && typeof saved.zoom === "number" ? saved.zoom : 13;

    const map = L.map(container, {
      preferCanvas: true,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '' }).addTo(map);
    mapRef.current = map;

    // persist center/zoom on moveend so remounts keep the last view
    const onMoveEnd = () => {
      try {
        const c = map.getCenter();
        window.__adminMapState = { center: [c.lat, c.lng], zoom: map.getZoom() };
      } catch (e) {}
    };
    map.on("moveend", onMoveEnd);

    // click on map -> create local (tmp) POI only via callback
    map.on("click", (e) => {
      if (typeof onCreateLocal === "function") onCreateLocal(e.latlng.lat, e.latlng.lng);
    });

    // Recompute size on layout changes
    const ro = new ResizeObserver(() => { try { map.invalidateSize(); } catch (e) {} });
    ro.observe(container);

    // ensure initial rendering correct
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 200);

    return () => {
      try { map.off("moveend", onMoveEnd); } catch (e) {}
      try { ro.disconnect(); } catch (e) {}
      try { map.remove(); } catch (e) {}
      // store view one last time
      try {
        const c = map.getCenter();
        window.__adminMapState = { center: [c.lat, c.lng], zoom: map.getZoom() };
      } catch (e) {}
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [onCreateLocal]);

  // sync markers without recentering the map or calling server
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // remove markers that no longer exist
    Object.keys(markersRef.current).forEach((id) => {
      if (!pois.find(p => String(p.id) === String(id))) {
        try { map.removeLayer(markersRef.current[id]); } catch (e) {}
        delete markersRef.current[id];
      }
    });

    // add/update markers
    pois.forEach((p) => {
      const id = String(p.id);
      const lat = Number(p.lat) || 0;
      const lng = Number(p.lng) || 0;

      if (markersRef.current[id]) {
        // update position & tooltip text, do NOT change view/zoom
        try { markersRef.current[id].setLatLng([lat, lng]); } catch (e) {}
        try { markersRef.current[id].setTooltipContent(p.name || ""); } catch (e) {}
      } else {
        const m = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map);
        m.bindTooltip(p.name || "", { direction: "top", offset: [0, -10], permanent: false });
        m.on("click", () => { if (typeof onSelect === "function") onSelect(p); });
        m.on("dragend", (ev) => {
          const ll = ev.target.getLatLng();
          // update only locally via callback
          if (typeof onMoveLocal === "function") onMoveLocal(p.id, ll.lat, ll.lng);
          // persist last view so remount won't jump
          try {
            const c = map.getCenter();
            window.__adminMapState = { center: [c.lat, c.lng], zoom: map.getZoom() };
          } catch (e) {}
        });
        // show tooltip on hover
        m.on("mouseover", () => { try { m.openTooltip(); } catch (e) {} });
        m.on("mouseout", () => { try { m.closeTooltip(); } catch (e) {} });

        markersRef.current[id] = m;
      }
    });

    try { map.invalidateSize(); } catch (e) {}
  }, [pois, onSelect, onMoveLocal]);

  return <div ref={containerRef} id="admin-map-root" style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}