import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { departmentsApi, designationsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import {
  LeaveTypesPanel,
  EntitlementRulesPanel,
  HolidayPanel,
  WorkflowPanel,
} from './Phase3Pages';
import { NodalAssignmentsPanel, HodAssignmentsPanel } from './RoleFeaturePages';

export const MASTER_TABS = [
  { id: 'dept', label: 'Departments' },
  { id: 'desg', label: 'Designations' },
  { id: 'assignments', label: 'Nodal Assignments' },
  { id: 'hod-assignments', label: 'HOD Assignments' },
  { id: 'leave-types', label: 'Leave Types' },
  { id: 'entitlements', label: 'Entitlements' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'workflows', label: 'Workflows' },
] as const;

export type MasterTabId = (typeof MASTER_TABS)[number]['id'];

const TAB_IDS = new Set<string>(MASTER_TABS.map((t) => t.id));

function resolveTab(raw: string | null): MasterTabId {
  if (raw && TAB_IDS.has(raw)) return raw as MasterTabId;
  return 'dept';
}

const TAB_DESCRIPTIONS: Record<MasterTabId, string> = {
  dept: 'Organisational departments used across HR and leave routing.',
  desg: 'Job titles linked to employee categories and pay levels.',
  assignments: 'Map nodal officers and nodal office staff to departments.',
  'hod-assignments': 'Assign the Head of Department for each department.',
  'leave-types': 'Core definitions for all available leave types.',
  entitlements: 'Annual credit and limits per category and leave type.',
  holidays: 'Institutional holiday calendar by year.',
  workflows: 'Approval chains and routing simulation.',
};

export default function MastersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveTab(searchParams.get('tab'));

  const setTab = (next: MasterTabId) => {
    setSearchParams({ tab: next }, { replace: true });
  };

  const activeLabel = MASTER_TABS.find((t) => t.id === tab)?.label ?? 'Masters';

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Masters' }, { label: activeLabel }]}
        title="Masters"
        description="All reference data for departments, designations, leave, and workflows in one place."
        rightContent={
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 max-w-full">
            {MASTER_TABS.map((t) => (
              <button
                key={t.id}
                id={`master-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition whitespace-nowrap ${
                  tab === t.id ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      <p className="text-sm text-slate-500 -mt-4 mb-2">{TAB_DESCRIPTIONS[tab]}</p>
      <div className="card p-5">
        {tab === 'dept' && <DepartmentTab />}
        {tab === 'desg' && <DesignationTab />}
        {tab === 'assignments' && <NodalAssignmentsPanel />}
        {tab === 'hod-assignments' && <HodAssignmentsPanel />}
        {tab === 'leave-types' && <LeaveTypesPanel />}
        {tab === 'entitlements' && <EntitlementRulesPanel />}
        {tab === 'holidays' && <HolidayPanel />}
        {tab === 'workflows' && <WorkflowPanel />}
      </div>
    </div>
  );
}

interface Dept { id: string; code: string; name: string; managing_office?: string; is_active?: boolean }
interface Desg { id: string; name: string; grade_pay_level?: string; category_code?: string; is_active?: boolean }

function DepartmentTab() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [office, setOffice] = useState('');

  const load = async () => {
    const { data } = await departmentsApi.list({ include_inactive: true });
    setDepts(data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    await departmentsApi.create({ code, name, managing_office: office || null });
    setCode(''); setName(''); setOffice('');
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

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Add New Department</h3>
        <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
            <input id="dept-code" placeholder="e.g. CS" value={code} onChange={(e) => setCode(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input id="dept-name" placeholder="Computer Science" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Managing Office</label>
            <input id="dept-office" placeholder="Dean's Office" value={office} onChange={(e) => setOffice(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 text-sm font-medium transition shadow-sm h-[38px]">Add</button>
        </form>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Code</th>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Managing Office</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {depts.map((d) => (
              <tr key={d.id} className={`hover:bg-gray-50 transition ${d.is_active === false ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4 font-mono text-xs text-gray-600">{d.code}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                <td className="px-6 py-4 text-gray-500">{d.managing_office || '-'}</td>
                <td className="px-6 py-4">{d.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                <td className="px-6 py-4">
                  <button type="button" onClick={() => void toggleActive(d)} className="text-xs font-bold text-blue-600 hover:underline">
                    {d.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {depts.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No departments configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DesignationTab() {
  const [desgs, setDesgs] = useState<Desg[]>([]);
  const [name, setName] = useState('');
  const [payLevel, setPayLevel] = useState('');
  const [catCode, setCatCode] = useState('');

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
    await designationsApi.create({ name, grade_pay_level: payLevel || null, category_code: catCode || null });
    setName(''); setPayLevel(''); setCatCode('');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Add New Designation</h3>
        <form onSubmit={create} className="flex flex-wrap gap-3 items-end">
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Designation Name *</label>
            <input id="desg-name" placeholder="Assistant Professor" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Pay Level</label>
            <input id="desg-pay" placeholder="Level 10" value={payLevel} onChange={(e) => setPayLevel(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Category Code</label>
            <input id="desg-cat" placeholder="FACULTY" value={catCode} onChange={(e) => setCatCode(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 text-sm font-medium transition shadow-sm h-[38px]">Add</button>
        </form>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Designation Name</th>
              <th className="px-6 py-3 text-left font-medium">Pay Level</th>
              <th className="px-6 py-3 text-left font-medium">Category Code</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {desgs.map((d) => (
              <tr key={d.id} className={`hover:bg-gray-50 transition ${d.is_active === false ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                <td className="px-6 py-4 text-gray-500">{d.grade_pay_level || '-'}</td>
                <td className="px-6 py-4 text-gray-500">
                  {d.category_code ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      {d.category_code}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-6 py-4">{d.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                <td className="px-6 py-4">
                  <button type="button" onClick={() => void toggleActive(d)} className="text-xs font-bold text-blue-600 hover:underline">
                    {d.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {desgs.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No designations configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
