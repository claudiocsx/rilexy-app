import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

const CONFIG_ID = 'config';

export default function Alcance() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [lat, setLat] = useState('-7.234');
  const [lng, setLng] = useState('-39.409');
  const [radius, setRadius] = useState('30');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'adminConfig', CONFIG_ID));
      if (snap.exists()) {
        const d = snap.data();
        setEnabled(d.locationFilterEnabled || false);
        setLat(String(d.centerLat || -7.234));
        setLng(String(d.centerLng || -39.409));
        setRadius(String(d.allowedRadiusKm || 30));
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, 'adminConfig', CONFIG_ID), {
      locationFilterEnabled: enabled,
      centerLat: parseFloat(lat),
      centerLng: parseFloat(lng),
      allowedRadiusKm: parseFloat(radius),
      updatedAt: new Date(),
      updatedBy: user.uid,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="page-title">Alcance</h1>
      <p className="page-subtitle">Configurar o raio geográfico permitido para o app</p>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label className="toggle-label">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Filtrar por localização</span>
          </label>
        </div>

        {enabled && (
          <>
            <div className="form-group">
              <label>Latitude (centro)</label>
              <input className="input" type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-7.234" />
            </div>
            <div className="form-group">
              <label>Longitude (centro)</label>
              <input className="input" type="text" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-39.409" />
            </div>
            <div className="form-group">
              <label>Raio permitido (km)</label>
              <input className="input" type="number" min="1" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="30" />
            </div>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
              Centro definido como: {lat}, {lng} — Raio de {radius} km
            </p>
          </>
        )}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
