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

interface NavItem {
  label: string;
  path: string;
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: '🏠', section: 'main' },
  { label: 'Dealers', path: '/dealers', icon: '🏪', section: 'main' },
  { label: 'Add Dealers', path: '/dealers/onboard', icon: '➕', section: 'main' },
  { label: 'Analytics', path: '/analytics', icon: '📊', section: 'insights' },
  { label: 'Map View', path: '/map', icon: '🗺', section: 'insights' },
  { label: 'Compare', path: '/compare', icon: '⚖', section: 'insights' },
  { label: 'Scraper Health', path: '/scraper-health', icon: '💚', section: 'system' },
  { label: 'Audit', path: '/audit', icon: '🔍', section: 'system' },
  { label: 'Export', path: '/export', icon: '📥', section: 'tools' },
  { label: 'Transactions', path: '/transactions', icon: '📋', section: 'tools' },
  { label: 'Settings', path: '/settings', icon: '⚙', section: 'tools' },
];

const SECTION_LABELS: Record<string, string> = {
  main: 'MAIN',
  insights: 'INSIGHTS',
  system: 'SYSTEM',
  tools: 'TOOLS',
};

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [collapsed, setCollapsed] = useState(false);

  function isActive(item: NavItem) {
    if (item.path === '/') return path === '/' || path.startsWith('/vehicle');
    return path.startsWith(item.path);
  }

  // Group nav items by section
  const sections = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-[var(--bg-base)]">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-14' : 'w-52'} flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col transition-all duration-200`}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-[var(--border)]">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gold)]/15 text-[var(--gold)] font-bold text-sm select-none cursor-pointer flex-shrink-0"
            onClick={() => navigate('/')}
          >
            AS
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <span className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                Auto<span className="text-[var(--gold)]">Scout</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                Used car intelligence
              </span>
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer bg-transparent border-none text-xs"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="mb-3">
              {!collapsed && (
                <div className="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">
                  {SECTION_LABELS[section] || section}
                </div>
              )}
              {collapsed && <div className="border-b border-[var(--border)] mx-1 mb-2" />}
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 rounded-md text-left transition-colors cursor-pointer border-none mb-0.5 ${
                      collapsed ? 'px-2 py-2 justify-center' : 'px-2.5 py-2'
                    } ${
                      active
                        ? 'bg-[var(--gold)]/10 text-[var(--gold)]'
                        : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="text-sm flex-shrink-0 w-5 text-center">{item.icon}</span>
                    {!collapsed && (
                      <span className={`text-[13px] truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        {!collapsed && (
          <div className="px-3 py-3 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
            AutoScout v0.1.0
          </div>
        )}
      </aside>

      {/* Main content area */}
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

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
