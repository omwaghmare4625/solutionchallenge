'use client';

import { useState } from 'react';
import { API_BASE_URL } from '../../src/config/api';

const CATEGORIES = [
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'food', label: 'Food' },
  { key: 'shelter', label: 'Shelter' },
];

export default function SubmitPage() {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [category, setCategory] = useState('healthcare');
  const [severity, setSeverity] = useState('3');
  const [population, setPopulation] = useState('0');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!API_BASE_URL) {
      setMessage('Missing NEXT_PUBLIC_BACKEND_URL configuration.');
      return;
    }

    const formData = new FormData();
    formData.append('lat', lat);
    formData.append('lng', lng);
    formData.append('category_key', category);
    formData.append('severity', severity);
    formData.append('population_affected', population || '0');
    formData.append('description', description || '');

    if (photo) {
      formData.append('photo', photo);
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/reports/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Submit failed (${response.status})`);
      }

      setMessage('Report submitted successfully.');
      setPhoto(null);
      event.target.reset();
    } catch (error) {
      setMessage(error.message || 'Unable to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 680, margin: '32px auto', padding: 16, fontFamily: 'sans-serif' }}>
      <h1>Submit Field Report</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <input placeholder="Bearer token" value={token} onChange={(e) => setToken(e.target.value)} required />
        <input placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} required />
        <input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} required />

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>

        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={String(level)}>
              Severity {level}
            </option>
          ))}
        </select>

        <input
          placeholder="Population affected"
          type="number"
          min="0"
          value={population}
          onChange={(e) => setPopulation(e.target.value)}
        />

        <textarea
          placeholder="Description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </main>
  );
}
