import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { VehicleDetail } from './components/VehicleDetail';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[var(--bg-base)]">
        {/* Sidebar - collapsed */}
        <aside className="w-12 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col items-center py-4 gap-4">
          {/* Logo */}
          <div className="w-8 h-8 rounded flex items-center justify-center bg-[var(--gold)]/10 text-[var(--gold)] font-bold text-sm select-none">
            AS
          </div>

          {/* Nav icons */}
          <nav className="flex flex-col items-center gap-3 mt-4">
            <NavIcon label="Dashboard" icon="⊞" active />
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
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

function NavIcon({
  label,
  icon,
  active = false,
}: {
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <button
      title={label}
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
