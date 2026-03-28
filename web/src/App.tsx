import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { VehicleDetail } from './components/VehicleDetail';
import { DealerManager } from './components/DealerManager';
import { Analytics } from './components/Analytics';
import { PurchaseWorkflow } from './components/PurchaseWorkflow';
import { MapView } from './components/MapView';
import { CompareView } from './components/CompareView';
import { AuditDashboard } from './components/AuditDashboard';
import DealerOnboarding from './components/DealerOnboarding';
import SettingsPanel from './components/SettingsPanel';
import { ScraperHealth } from './components/ScraperHealth';
import { ExportTools } from './components/ExportTools';
import { TransactionTracker } from './components/TransactionTracker';

/* ─── Navigation structure ─── */
interface NavItem {
  label: string;
  path: string;
  section: string;
  description?: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard',      path: '/',                section: 'core',    description: 'Listings & deals' },
  { label: 'Dealers',        path: '/dealers',         section: 'core',    description: 'Manage sources' },
  { label: 'Add Dealers',    path: '/dealers/onboard', section: 'core',    description: 'Import new dealers' },
  { label: 'Analytics',      path: '/analytics',       section: 'analyze', description: 'Market trends' },
  { label: 'Map',            path: '/map',             section: 'analyze', description: 'Geographic view' },
  { label: 'Compare',        path: '/compare',         section: 'analyze', description: 'Side by side' },
  { label: 'Scraper Health', path: '/scraper-health',  section: 'ops',     description: 'Scraper status' },
  { label: 'Audit',          path: '/audit',           section: 'ops',     description: 'Data quality' },
  { label: 'Export',         path: '/export',          section: 'manage',  description: 'Download data' },
  { label: 'Transactions',   path: '/transactions',    section: 'manage',  description: 'Purchase tracker' },
  { label: 'Settings',       path: '/settings',        section: 'manage',  description: 'Configuration' },
];

const SECTIONS: Record<string, string> = {
  core: 'Core',
  analyze: 'Analyze',
  ops: 'Operations',
  manage: 'Manage',
};

/* ─── Main layout ─── */
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (item: NavItem) =>
    item.path === '/'
      ? path === '/' || path.startsWith('/vehicle')
      : path.startsWith(item.path);

  const grouped = NAV.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="noise-bg flex h-screen bg-[var(--bg-base)]">
      {/* ── Sidebar ── */}
      <aside
        className={`${collapsed ? 'w-[52px]' : 'w-[220px]'} flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] transition-all duration-200 ease-out`}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 px-3 h-14 border-b border-[var(--border)] cursor-pointer select-none flex-shrink-0"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--amber)]/12 flex-shrink-0 relative">
            <span className="text-[var(--amber)] font-bold text-xs tracking-tight">AS</span>
            <div className="absolute inset-0 rounded-lg border border-[var(--amber)]/20" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold text-[var(--text-primary)] leading-none tracking-tight">
                Auto<span className="text-[var(--amber)]">Scout</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] leading-none mt-0.5 font-medium">
                Car Intelligence
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              {!collapsed && (
                <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--text-muted)]">
                  {SECTIONS[section]}
                </div>
              )}
              {collapsed && section !== 'core' && (
                <div className="mx-2 mb-2 border-t border-[var(--border)]" />
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      title={collapsed ? item.label : undefined}
                      className={`group w-full flex items-center rounded-lg text-left border-none cursor-pointer transition-all duration-150 ${
                        collapsed ? 'px-2.5 py-2.5 justify-center' : 'px-2.5 py-[7px] gap-2.5'
                      } ${
                        active
                          ? 'bg-[var(--amber)]/8 text-[var(--amber)]'
                          : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {/* Active indicator */}
                      {active && !collapsed && (
                        <div className="w-[3px] h-4 rounded-full bg-[var(--amber)] flex-shrink-0 -ml-0.5 mr-0.5" />
                      )}
                      {!collapsed && (
                        <span className={`text-[13px] truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                          {item.label}
                        </span>
                      )}
                      {collapsed && (
                        <span className="text-[11px] font-semibold">
                          {item.label.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="flex-shrink-0 border-t border-[var(--border)] p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer bg-transparent border-none text-[11px] font-medium"
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vehicle/:id" element={<VehicleDetail />} />
            <Route path="/vehicle/:id/purchase" element={<PurchaseWorkflow />} />
            <Route path="/dealers" element={<DealerManager />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/compare" element={<CompareView />} />
            <Route path="/audit" element={<AuditDashboard />} />
            <Route path="/dealers/onboard" element={<DealerOnboarding />} />
            <Route path="/settings" element={<SettingsPanel />} />
            <Route path="/scraper-health" element={<ScraperHealth />} />
            <Route path="/export" element={<ExportTools />} />
            <Route path="/transactions" element={<TransactionTracker />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
