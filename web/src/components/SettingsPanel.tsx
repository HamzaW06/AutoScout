import { useState, useEffect, useCallback } from 'react';
import { fetchSettings, saveSettings } from '../api';

interface SettingsValues {
  [key: string]: string;
}

interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'number';
  placeholder?: string;
}

interface SectionDef {
  title: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    title: 'Location',
    fields: [
      { key: 'user_city', label: 'City', placeholder: 'Boston' },
      { key: 'user_state', label: 'State', placeholder: 'MA' },
      { key: 'user_lat', label: 'Latitude', type: 'number', placeholder: '42.3601' },
      { key: 'user_lng', label: 'Longitude', type: 'number', placeholder: '-71.0589' },
      { key: 'search_radius', label: 'Search Radius (miles)', type: 'number', placeholder: '50' },
    ],
  },
  {
    title: 'API Keys',
    fields: [
      { key: 'marketcheck_api_key', label: 'MarketCheck API Key', type: 'password' },
      { key: 'google_ai_api_key', label: 'Google AI API Key', type: 'password' },
      { key: 'google_places_api_key', label: 'Google Places API Key', type: 'password' },
    ],
  },
  {
    title: 'Notifications',
    fields: [
      { key: 'discord_webhook', label: 'Discord Webhook URL', type: 'password' },
      { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
      { key: 'smtp_from', label: 'SMTP From Address', placeholder: 'alerts@example.com' },
    ],
  },
  {
    title: 'Preferences',
    fields: [
      { key: 'mechanic_labor_rate', label: 'Mechanic Labor Rate ($/hr)', type: 'number', placeholder: '120' },
      { key: 'max_concurrent_scrapers', label: 'Max Concurrent Scrapers', type: 'number', placeholder: '3' },
      { key: 'request_delay_ms', label: 'Request Delay (ms)', type: 'number', placeholder: '1500' },
    ],
  },
];

const S = {
  container: {
    padding: '24px',
    color: '#fff',
    maxWidth: '760px',
    margin: '0 auto',
    overflowY: 'auto' as const,
    height: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  heading: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '4px',
    color: '#fff',
  } as React.CSSProperties,
  subheading: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '28px',
  } as React.CSSProperties,
  section: {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    marginBottom: '20px',
    overflow: 'hidden',
  } as React.CSSProperties,
  sectionHeader: {
    padding: '12px 20px',
    borderBottom: '1px solid #374151',
    fontSize: '12px',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    background: '#111827',
  } as React.CSSProperties,
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    padding: '20px',
  } as React.CSSProperties,
  fieldWrap: {} as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#d1d5db',
    marginBottom: '6px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingTop: '8px',
  } as React.CSSProperties,
  btnSave: {
    padding: '9px 24px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
  } as React.CSSProperties,
  savedMsg: {
    fontSize: '13px',
    color: '#10b981',
    fontWeight: 600,
  } as React.CSSProperties,
  errorBox: {
    background: '#ef444422',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#ef4444',
    marginBottom: '16px',
  } as React.CSSProperties,
};

export function SettingsPanel() {
  const [values, setValues] = useState<SettingsValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setValues(data ?? {});
    } catch {
      // Start with empty values if settings endpoint not yet available
      setValues({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleChange(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ ...S.container, paddingTop: '60px', textAlign: 'center', color: '#9ca3af' }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div style={S.container}>
      <h1 style={S.heading}>Settings</h1>
      <p style={S.subheading}>Configure your location, API keys, and scraper preferences.</p>

      {error && <div style={S.errorBox}>{error}</div>}

      {SECTIONS.map(section => (
        <div key={section.title} style={S.section}>
          <div style={S.sectionHeader}>{section.title}</div>
          <div style={S.fieldGrid}>
            {section.fields.map(field => (
              <div key={field.key} style={S.fieldWrap}>
                <label style={S.label}>{field.label}</label>
                <input
                  style={S.input}
                  type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                  placeholder={field.placeholder ?? ''}
                  value={values[field.key] ?? ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={S.footer}>
        <button style={S.btnSave} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span style={S.savedMsg}>Saved!</span>}
      </div>
    </div>
  );
}

export default SettingsPanel;
