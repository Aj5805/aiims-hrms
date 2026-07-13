type WorkModeToggleProps = {
  mode: 'staff' | 'desk';
  onChange: (mode: 'staff' | 'desk') => void;
};

function StaffIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function DeskIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export function WorkModeToggle({ mode, onChange }: WorkModeToggleProps) {
  const inDeskMode = mode === 'desk';

  return (
    <div className="work-mode-toggle shrink-0" role="group" aria-label="Switch between Staff and Desk view">
      <div className="relative grid grid-cols-2 rounded-lg bg-slate-950/50 p-0.5 border border-slate-700/70">
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-indigo-600 shadow-md shadow-indigo-900/40 transition-transform duration-200 ease-out ${
            inDeskMode ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        <button
          type="button"
          onClick={() => onChange('staff')}
          className={`work-mode-toggle__btn ${!inDeskMode ? 'work-mode-toggle__btn--active' : ''}`}
          aria-pressed={!inDeskMode}
          title="Staff view — your personal HR pages"
        >
          <StaffIcon />
          <span className="hidden min-[380px]:inline">Staff</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('desk')}
          className={`work-mode-toggle__btn ${inDeskMode ? 'work-mode-toggle__btn--active' : ''}`}
          aria-pressed={inDeskMode}
          title="Desk view — nodal approvals and HR operations"
        >
          <DeskIcon />
          <span className="hidden min-[380px]:inline">Desk</span>
        </button>
      </div>
    </div>
  );
}
