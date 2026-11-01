// client/src/MapView.tsx — needs: npm i leaflet && npm i -D @types/leaflet   (free OpenStreetMap tiles, no API key)
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function MapView({ maids, center = [20.2961, 85.8245] }: { maids: any[]; center?: [number, number] }) {
  const el = useRef<HTMLDivElement>(null), map = useRef<L.Map>(), layer = useRef<L.LayerGroup>();
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView(center, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
  }, []);
  useEffect(() => {
    layer.current?.clearLayers();
    // Approximate locations only — never plot exact home addresses.
    maids.forEach(m => L.circleMarker([m.lat, m.lng], { radius: 9, color: "#087F5B", fillColor: m.verification === "VERIFIED" ? "#087F5B" : "#F4B942", fillOpacity: .8 })
      .bindPopup(`<b>${m.user?.name}</b><br/>₹${m.expectedSalary}/mo · ★${Number(m.rating).toFixed(1)}`).addTo(layer.current!));
  }, [maids]);
  return <div ref={el} style={{ height: 420, borderRadius: 16, overflow: "hidden" }} />;
}
// Usage on the discovery page: <MapView maids={rows} />
