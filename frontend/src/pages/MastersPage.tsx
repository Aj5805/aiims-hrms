import { useState, useEffect } from 'react';
import { departmentsApi, designationsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';

interface Dept { id: string; code: string; name: string; managing_office?: string }
interface Desg { id: string; name: string; grade_pay_level?: string; category_code?: string }

export default function MastersPage() {
  const [tab, setTab] = useState<'dept' | 'desg'>('dept');
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin/Estab', to: '/admin' }, { label: 'Master Settings' }]}
        title="Masters Configuration"
        description="Manage system departments and designations."
        rightContent={
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              id="tab-departments"
              onClick={() => setTab('dept')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${tab === 'dept' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Departments
            </button>
            <button
              id="tab-designations"
              onClick={() => setTab('desg')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${tab === 'desg' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Designations
            </button>
          </div>
        }
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          {tab === 'dept' ? <DepartmentTab /> : <DesignationTab />}
        </div>
      </div>
    </div>
  );
}

function DepartmentTab() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [office, setOffice] = useState('');

  const load = async () => {
    const { data } = await departmentsApi.list();
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {depts.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-mono text-xs text-gray-600">{d.code}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                <td className="px-6 py-4 text-gray-500">{d.managing_office || '-'}</td>
              </tr>
            ))}
            {depts.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400 bg-gray-50/50">No departments configured.</td></tr>
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
    const { data } = await designationsApi.list();
    setDesgs(data);
  };
  useEffect(() => { load(); }, []);

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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {desgs.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                <td className="px-6 py-4 text-gray-500">{d.grade_pay_level || '-'}</td>
                <td className="px-6 py-4 text-gray-500">
                  {d.category_code ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      {d.category_code}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {desgs.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400 bg-gray-50/50">No designations configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}