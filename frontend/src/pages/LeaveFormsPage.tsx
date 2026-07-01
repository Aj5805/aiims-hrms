import { useState, useEffect, useMemo } from 'react';
import { leaveFormTemplatesApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';

type FormTemplate = {
  id: string;
  title: string;
  url: string;
  format: string;
  notes?: string;
  categories?: string[];
  leave_types?: string[];
  purposes?: string[];
  employee_groups?: string[];
};

const FORM_PURPOSES = ['APPLY', 'MEDICAL', 'ACADEMIC', 'DEPARTURE', 'REJOIN', 'MODIFICATION', 'CANCELLATION'] as const;
const FORM_CATEGORIES = ['FACULTY', 'NURSING', 'ADMIN', 'JR_ACAD', 'SR_ACAD', 'JR_NON_ACAD', 'SR_NON_ACAD'] as const;

export function LeaveFormsPage() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await leaveFormTemplatesApi.list();
        setTemplates(data.templates || []);
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (categoryFilter && !(t.categories || []).includes(categoryFilter)) return false;
      if (purposeFilter && !(t.purposes || []).includes(purposeFilter)) return false;
      if (term && !t.title.toLowerCase().includes(term) && !(t.notes || '').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [templates, categoryFilter, purposeFilter, search]);

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Leave Forms' }]}
        title="Leave Application Forms"
        description="Official AIIMS Bibinagar proformas — download, fill, then submit via Apply for Leave for workflow tracking."
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
        <p className="text-sm text-slate-600">
          These institutional forms are the reference for leave applications. Staff should use the form matching their category and leave type before submitting in the system.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label text-xs">Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="form-select text-sm py-1.5">
              <option value="">All categories</option>
              {FORM_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Purpose</label>
            <select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)} className="form-select text-sm py-1.5">
              <option value="">All purposes</option>
              {FORM_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="form-label text-xs">Search</label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Form title or notes…" className="form-input text-sm py-1.5" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading forms…</div>
      ) : filtered.length === 0 ? (
        <div className="card card-body text-sm text-slate-500">No forms match your filters.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => (
            <div key={t.id} className="card card-body text-sm space-y-2">
              <div className="font-semibold text-slate-800">{t.title}</div>
              {t.notes && <p className="text-slate-500 text-xs">{t.notes}</p>}
              <div className="flex flex-wrap gap-1">
                {(t.categories || []).map((c) => (
                  <span key={c} className="badge badge-slate text-[10px]">{c}</span>
                ))}
                {(t.leave_types || []).map((lt) => (
                  <span key={lt} className="badge badge-blue text-[10px]">{lt}</span>
                ))}
                {(t.purposes || []).map((p) => (
                  <span key={p} className="badge badge-amber text-[10px]">{p}</span>
                ))}
              </div>
              <div className="pt-1">
                {t.format === 'IN_APP' ? (
                  <span className="text-indigo-600 font-medium">Use My Applications in the portal</span>
                ) : t.url ? (
                  <a href={t.url} target="_blank" rel="noreferrer" className="text-indigo-600 font-medium hover:underline">
                    Download {t.format || 'form'} →
                  </a>
                ) : (
                  <span className="text-slate-400">Form link pending</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}