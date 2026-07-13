import { useEffect, useState } from 'react';
import { leaveAppApi } from '../api/endpoints';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TrailStep = {
  step_order: number;
  approver_role: string;
  role_label: string;
  step_status: string;
  expected_approver_name?: string | null;
  action?: string | null;
  action_label?: string | null;
  actor_name?: string | null;
  acted_at?: string | null;
  remarks?: string | null;
};

type TrailData = {
  application: {
    app_number: string;
    status: string;
    submitted_at?: string | null;
  };
  submitted_by: { name: string; acted_at?: string | null };
  current_with?: {
    step_order: number;
    approver_name?: string | null;
    role_label?: string | null;
    since?: string | null;
  } | null;
  steps: TrailStep[];
};

function stepDotClass(step: TrailStep, appStatus: string): string {
  if (step.action === 'REJECTED') return 'bg-red-500';
  if (step.action) return 'bg-emerald-500';
  if (step.step_status === 'current') return 'bg-amber-400 ring-2 ring-amber-200';
  if (step.step_status === 'skipped') return 'bg-slate-300';
  if (appStatus === 'APPROVED' && step.step_status === 'not_reached') return 'bg-slate-200';
  return 'bg-slate-300';
}

function stepStatusLabel(step: TrailStep): string {
  if (step.action_label) return step.action_label;
  if (step.step_status === 'current') return 'Pending — awaiting action';
  if (step.step_status === 'skipped') return 'Skipped';
  if (step.step_status === 'not_reached') return 'Not reached';
  return 'Pending';
}

export function ApprovalTrailPanel({ applicationId, compact }: { applicationId: string; compact?: boolean }) {
  const [trail, setTrail] = useState<TrailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    leaveAppApi
      .trail(applicationId)
      .then(({ data }) => {
        if (!cancelled) setTrail(data as TrailData);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTrail(null);
          setError(
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
              || 'Could not load approval trail',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (loading) {
    return <p className="text-xs text-slate-400 py-2">Loading movement trail…</p>;
  }
  if (error) {
    return <p className="text-xs text-red-600 py-2">{error}</p>;
  }
  if (!trail) return null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">Movement trail</h4>
        {trail.current_with && (
          <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            Currently with {trail.current_with.approver_name || trail.current_with.role_label}
            {trail.current_with.since ? ` · since ${formatDateTime(trail.current_with.since)}` : ''}
          </span>
        )}
      </div>

      <div className="relative pl-5 space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        <div className="relative">
          <div className="absolute -left-5 top-1 w-[18px] h-[18px] rounded-full bg-indigo-500 border-2 border-white" />
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <div className="font-medium text-slate-800">{trail.submitted_by.name}</div>
            <div className="text-slate-500 mt-0.5">
              Submitted application
              {trail.submitted_by.acted_at ? ` · ${formatDateTime(trail.submitted_by.acted_at)}` : ''}
            </div>
            {trail.steps[0]?.expected_approver_name && (
              <div className="text-slate-600 mt-1">
                Sent to {trail.steps[0].role_label}
                {trail.steps[0].expected_approver_name ? ` (${trail.steps[0].expected_approver_name})` : ''}
              </div>
            )}
          </div>
        </div>

        {trail.steps.map((step) => (
          <div key={step.step_order} className="relative">
            <div
              className={`absolute -left-5 top-1 w-[18px] h-[18px] rounded-full border-2 border-white ${stepDotClass(step, trail.application.status)}`}
            />
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                step.step_status === 'current'
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold text-slate-800">
                  Step {step.step_order}: {step.role_label}
                </span>
                <span
                  className={
                    step.action === 'REJECTED'
                      ? 'text-red-700 font-medium'
                      : step.action
                        ? 'text-emerald-700 font-medium'
                        : step.step_status === 'current'
                          ? 'text-amber-700 font-medium'
                          : 'text-slate-500'
                  }
                >
                  {stepStatusLabel(step)}
                </span>
              </div>

              {step.actor_name && (
                <div className="text-slate-600 mt-1">
                  By {step.actor_name}
                  {step.acted_at ? ` · ${formatDateTime(step.acted_at)}` : ''}
                </div>
              )}

              {!step.actor_name && step.step_status === 'current' && step.expected_approver_name && (
                <div className="text-slate-600 mt-1">With {step.expected_approver_name}</div>
              )}

              {!step.actor_name && step.step_status === 'pending' && step.expected_approver_name && (
                <div className="text-slate-500 mt-1">Expected: {step.expected_approver_name}</div>
              )}

              {step.remarks && (
                <p className="text-slate-500 italic mt-1 border-t border-slate-200/80 pt-1">
                  &ldquo;{step.remarks}&rdquo;
                </p>
              )}

              {step.action && step.step_order < trail.steps.length && (
                <div className="text-slate-600 mt-1">
                  {step.action === 'REJECTED'
                    ? 'Application rejected'
                    : `Forwarded to ${trail.steps[step.step_order]?.role_label || 'next approver'}`
                      + (trail.steps[step.step_order]?.expected_approver_name
                        ? ` (${trail.steps[step.step_order].expected_approver_name})`
                        : '')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
