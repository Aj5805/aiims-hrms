import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { departmentsApi, designationsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { LeaveTypesPanel } from './LeaveTypesPanel';
import { EntitlementRulesPanel } from './EntitlementRulesPanel';
import { HolidayPanel } from './HolidayPanel';
import { WorkflowPanel } from './WorkflowPanel';
import { NodalOfficesPanel, HodAssignmentsPanel } from './RoleFeaturePages';

export const MASTER_TABS = [
  { id: 'dept', label: 'Departments' },
  { id: 'desg', label: 'Designations' },
  { id: 'assignments', label: 'Nodal Offices' },
  { id: 'hod-assignments', label: 'HOD Assignments' },
  { id: 'leave-types', label: 'Leave Types' },
  { id: 'entitlements', label: 'Leave Policy' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'workflows', label: 'Workflows' },
] as const;

export type MasterTabId = (typeof MASTER_TABS)[number]['id'];

const TAB_IDS = new Set<string>(MASTER_TABS.map((t) => t.id));

function resolveTab(raw: string | null): MasterTabId {
  if (raw && TAB_IDS.has(raw)) return raw as MasterTabId;
  return 'dept';
}

export default function MastersPage() {
  const [searchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get('tab'));

  const activeLabel = MASTER_TABS.find((t) => t.id === tab)?.label ?? 'Masters';

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Masters' }, { label: activeLabel }]}
        hideTitle
      />
      <div className="card p-3 sm:p-4">
        {tab === 'dept' && <DepartmentTab />}
        {tab === 'desg' && <DesignationTab />}
        {tab === 'assignments' && <NodalOfficesPanel />}
        {tab === 'hod-assignments' && <HodAssignmentsPanel />}
        {tab === 'leave-types' && <LeaveTypesPanel />}
        {tab === 'entitlements' && (
          <EntitlementRulesPanel initialCategory={searchParams.get('category')} />
        )}
        {tab === 'holidays' && <HolidayPanel />}
        {tab === 'workflows' && <WorkflowPanel />}
      </div>
    </div>
  );
}

interface Dept { id: string; code: string; name: string; is_active?: boolean }
interface Desg { id: string; name: string; category_code?: string; is_active?: boolean }

const CATEGORY_CODES = ['FACULTY', 'NURSING', 'ADMIN', 'JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA'] as const;

function DepartmentTab() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    const { data } = await departmentsApi.list({ include_inactive: true });
    setDepts(data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    await departmentsApi.create({ code, name });
    setCode(''); setName('');
    setShowAddForm(false);
    load();
  };

  const toggleActive = async (dept: Dept) => {
    try {
      await departmentsApi.update(dept.id, { is_active: !dept.is_active });
      load();
    } catch {
      alert('Could not update department status.');
    }
  };

  const startEdit = (dept: Dept) => {
    setEditingId(dept.id);
    setEditName(dept.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (dept: Dept) => {
    if (!editName.trim()) return;
    try {
      await departmentsApi.update(dept.id, {
        name: editName.trim(),
      });
      cancelEdit();
      load();
    } catch {
      alert('Could not save department changes.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="btn-primary btn-sm"
        >
          {showAddForm ? 'Cancel' : '+ Add Department'}
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">New Department</h3>
          <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
              <input id="dept-code" placeholder="e.g. CS" value={code} onChange={(e) => setCode(e.target.value)} className="form-input" required />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input id="dept-name" placeholder="Computer Science" value={name} onChange={(e) => setName(e.target.value)} className="form-input" required />
            </div>
            <button type="submit" className="btn-primary h-[38px]">Add</button>
          </form>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <table className="min-w-full text-sm data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {depts.map((d) => (
              <tr key={d.id} className={d.is_active === false ? 'opacity-60' : ''}>
                <td className="font-mono text-xs text-gray-600">{d.code}</td>
                {editingId === d.id ? (
                  <>
                    <td colSpan={2}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="form-input py-1.5 text-sm" />
                    </td>
                    <td>{d.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      <button type="button" onClick={() => void saveEdit(d)} className="text-xs font-bold text-emerald-700 hover:underline">Save</button>
                      <button type="button" onClick={cancelEdit} className="text-xs font-bold text-slate-500 hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium text-gray-900">{d.name}</td>
                    <td>{d.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                    <td className="text-right space-x-3 whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(d)} className="text-xs font-bold text-indigo-600 hover:underline">Manage</button>
                      <button type="button" onClick={() => void toggleActive(d)} className="text-xs font-bold text-blue-600 hover:underline">
                        {d.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {depts.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No departments configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DesignationTab() {
  const [desgs, setDesgs] = useState<Desg[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCatCode, setEditCatCode] = useState('');

  const load = async () => {
    const { data } = await designationsApi.list({ include_inactive: true });
    setDesgs(data);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (desg: Desg) => {
    try {
      await designationsApi.update(desg.id, { is_active: !desg.is_active });
      load();
    } catch {
      alert('Could not update designation status.');
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await designationsApi.create({ name, category_code: catCode || null });
    setName(''); setCatCode('');
    setShowAddForm(false);
    load();
  };

  const startEdit = (desg: Desg) => {
    setEditingId(desg.id);
    setEditName(desg.name);
    setEditCatCode(desg.category_code || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCatCode('');
  };

  const saveEdit = async (desg: Desg) => {
    if (!editName.trim()) return;
    try {
      await designationsApi.update(desg.id, {
        name: editName.trim(),
        category_code: editCatCode.trim() || null,
      });
      cancelEdit();
      load();
    } catch {
      alert('Could not save designation changes.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="btn-primary btn-sm"
        >
          {showAddForm ? 'Cancel' : '+ Add Designation'}
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">New Designation</h3>
          <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Designation Name *</label>
              <input id="desg-name" placeholder="Assistant Professor" value={name} onChange={(e) => setName(e.target.value)} className="form-input" required />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Category Code</label>
              <select id="desg-cat" value={catCode} onChange={(e) => setCatCode(e.target.value)} className="form-select">
                <option value="">Select…</option>
                {CATEGORY_CODES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary h-[38px]">Add</button>
          </form>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <table className="min-w-full text-sm data-table">
          <thead>
            <tr>
              <th>Designation Name</th>
              <th>Category Code</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {desgs.map((d) => (
              <tr key={d.id} className={d.is_active === false ? 'opacity-60' : ''}>
                {editingId === d.id ? (
                  <>
                    <td>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="form-input py-1.5 text-sm" />
                    </td>
                    <td>
                      <select value={editCatCode} onChange={(e) => setEditCatCode(e.target.value)} className="form-select py-1.5 text-sm">
                        <option value="">—</option>
                        {CATEGORY_CODES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td>{d.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      <button type="button" onClick={() => void saveEdit(d)} className="text-xs font-bold text-emerald-700 hover:underline">Save</button>
                      <button type="button" onClick={cancelEdit} className="text-xs font-bold text-slate-500 hover:underline">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium text-gray-900">{d.name}</td>
                    <td className="text-gray-500">
                      {d.category_code ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {d.category_code}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{d.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                    <td className="text-right space-x-3 whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(d)} className="text-xs font-bold text-indigo-600 hover:underline">Manage</button>
                      <button type="button" onClick={() => void toggleActive(d)} className="text-xs font-bold text-blue-600 hover:underline">
                        {d.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {desgs.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No designations configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
