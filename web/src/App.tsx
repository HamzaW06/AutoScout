import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { VehicleDetail } from './components/VehicleDetail';
import { DealerManager } from './components/DealerManager';
import { Analytics } from './components/Analytics';
import { PurchaseWorkflow } from './components/PurchaseWorkflow';
import { MapView } from './components/MapView';
import { CompareView } from './components/CompareView';
import { AuditDashboard } from './components/AuditDashboard';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="flex h-screen bg-[var(--bg-base)]">
      {/* Sidebar - collapsed */}
      <aside className="w-12 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col items-center py-4 gap-4">
        {/* Logo */}
        <div
          className="w-8 h-8 rounded flex items-center justify-center bg-[var(--gold)]/10 text-[var(--gold)] font-bold text-sm select-none cursor-pointer"
          onClick={() => navigate('/')}
        >
          AS
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-3 mt-4">
          <NavIcon
            label="Dashboard"
            icon="\u229e"
            active={path === '/' || path.startsWith('/vehicle')}
            onClick={() => navigate('/')}
          />
          <NavIcon
            label="Dealers"
            icon="\u2302"
            active={path === '/dealers'}
            onClick={() => navigate('/dealers')}
          />
          <NavIcon
            label="Analytics"
            icon="\u2261"
            active={path === '/analytics'}
            onClick={() => navigate('/analytics')}
          />
          <NavIcon
            label="Map"
            icon="\u2316"
            active={path === '/map'}
            onClick={() => navigate('/map')}
          />
          <NavIcon
            label="Compare"
            icon="\u2696"
            active={path === '/compare'}
            onClick={() => navigate('/compare')}
          />
          <NavIcon
            label="Audit"
            icon="\u2318"
            active={path === '/audit'}
            onClick={() => navigate('/audit')}
          />
        </nav>

        <div className="flex-1" />

        <div className="w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)]" />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-11 flex-shrink-0 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Auto
            </span>
            <span className="text-sm font-semibold text-[var(--gold)]">
              Scout
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Used car intelligence
          </div>
        </header>

        {/* Routes */}
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

function NavIcon({
  label,
  icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`w-8 h-8 rounded flex items-center justify-center text-sm cursor-pointer bg-transparent border-none transition-colors ${
        active
          ? 'text-[var(--gold)] bg-[var(--gold)]/10'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {icon}
    </button>
  );
}

export default App;
