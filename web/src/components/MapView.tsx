import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchListings, type Listing } from '../api';
import { FilterBar, type Filters } from './FilterBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(n: number | null): string {
  if (n == null) return '\u2014';
  return '$' + n.toLocaleString('en-US');
}

function fmtMi(n: number | null): string {
  if (n == null) return '\u2014';
  return n.toLocaleString('en-US') + ' mi';
}

// ---------------------------------------------------------------------------
// Marker icon factory
// ---------------------------------------------------------------------------

const ICON_CACHE = new Map<string, L.DivIcon>();

function createIcon(color: string): L.DivIcon {
  const cached = ICON_CACHE.get(color);
  if (cached) return cached;

  const icon = L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  ICON_CACHE.set(color, icon);
  return icon;
}

function ratingColor(rating: string | null): string {
  if (!rating) return '#888';
  switch (rating) {
    case 'STEAL':
    case 'GREAT':
      return '#4ade80';
    case 'GOOD':
    case 'FAIR':
      return '#60a5fa';
    case 'HIGH':
    case 'RIP-OFF':
      return '#e85454';
    default:
      return '#888';
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUSTON_CENTER: [number, number] = [29.76, -95.37];
const USER_LOCATION: [number, number] = [29.5111, -95.1313];
const SEARCH_RADIUS_MILES = 50;
const METERS_PER_MILE = 1609.34;

const emptyFilters: Filters = {
  make: '',
  model: '',
  yearMin: '',
  yearMax: '',
  priceMax: '',
  mileageMax: '',
  titleStatus: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapView() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '500' };
      if (filters.make) params.make = filters.make;
      if (filters.model) params.model = filters.model;
      if (filters.yearMin) params.year_min = filters.yearMin;
      if (filters.yearMax) params.year_max = filters.yearMax;
      if (filters.priceMax) params.price_max = filters.priceMax;
      if (filters.mileageMax) params.mileage_max = filters.mileageMax;
      if (filters.titleStatus) params.title_status = filters.titleStatus;

      const res = await fetchListings(params);
      setListings(res.listings);
    } catch (err) {
      console.error('Failed to load listings for map:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mappableListings = useMemo(
    () => listings.filter((l) => l.seller_lat != null && l.seller_lng != null),
    [listings],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={(f) => setFilters(f)}
      />

      {/* Map area */}
      <div className="flex-1 relative">
        {/* Listing count overlay */}
        <div className="absolute top-3 right-3 z-[1000] bg-[var(--bg-surface)]/90 backdrop-blur border border-[var(--border)] rounded px-3 py-1.5 text-sm">
          <span className="mono text-[var(--text-primary)] font-semibold">
            {mappableListings.length}
          </span>
          <span className="text-[var(--text-secondary)]">
            {' '}of{' '}
          </span>
          <span className="mono text-[var(--text-primary)]">
            {listings.length}
          </span>
          <span className="text-[var(--text-secondary)]"> on map</span>
        </div>

        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[var(--bg-base)]/60">
            <span className="text-[var(--text-secondary)]">Loading listings...</span>
          </div>
        )}

        <MapContainer
          center={HOUSTON_CENTER}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Search radius circle */}
          <Circle
            center={USER_LOCATION}
            radius={SEARCH_RADIUS_MILES * METERS_PER_MILE}
            pathOptions={{
              color: '#f0c040',
              fillColor: '#f0c040',
              fillOpacity: 0.04,
              weight: 1,
              dashArray: '6 4',
            }}
          />

          {/* Listing markers */}
          {mappableListings.map((l) => (
            <Marker
              key={l.id}
              position={[l.seller_lat!, l.seller_lng!]}
              icon={createIcon(ratingColor(l.value_rating))}
            >
              <Popup>
                <div style={{
                  background: '#111114',
                  color: '#f0f0f0',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  minWidth: '180px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {l.year} {l.make} {l.model}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {fmt$(l.asking_price)}
                    </span>
                  </div>
                  {l.value_rating && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase' as const,
                        background: ratingColor(l.value_rating) + '25',
                        color: ratingColor(l.value_rating),
                      }}>
                        {l.value_rating}
                      </span>
                    </div>
                  )}
                  <div style={{ color: '#888', fontSize: '12px' }}>
                    {fmtMi(l.mileage)}
                  </div>
                  <div
                    style={{
                      marginTop: '6px',
                      color: '#60a5fa',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    onClick={() => navigate(`/vehicle/${l.id}`)}
                  >
                    View details
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
