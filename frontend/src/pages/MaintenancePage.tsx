export function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-slate-100 p-6 shadow-sm">
            <svg className="h-16 w-16 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900">System Maintenance</h1>
        
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <p className="text-base text-slate-600 leading-relaxed">
            The AIIMS HRMS is currently undergoing scheduled maintenance to upgrade system capabilities.
            Please check back again later.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-500">
              Thank you for your patience.
            </p>
          </div>
        </div>
        
        <button
          onClick={() => window.location.href = '/'}
          className="rounded-full bg-slate-900 px-8 py-3 text-sm font-bold tracking-wide text-white hover:bg-slate-800 transition-colors shadow-sm"
        >
          RETRY CONNECTION
        </button>
      </div>
    </div>
  );
}
