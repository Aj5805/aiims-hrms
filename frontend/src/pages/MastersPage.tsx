import { useState, useEffect } from 'react';
import { departmentsApi, designationsApi } from '../api/endpoints';

interface Dept { id: string; code: string; name: string; managing_office?: string }
interface Desg { id: string; name: string; grade_pay_level?: string; category_code?: string }

export default function MastersPage() {
  const [tab, setTab] = useState<'dept' | 'desg'>('dept');
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          id="tab-departments"
          onClick={() => setTab('dept')}
          className={`px-4 py-2 rounded text-sm font-medium ${tab === 'dept' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Departments
        </button>
        <button
          id="tab-designations"
          onClick={() => setTab('desg')}
          className={`px-4 py-2 rounded text-sm font-medium ${tab === 'desg' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Designations
        </button>
      </div>
      {tab === 'dept' ? <DepartmentTab /> : <DesignationTab />}
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
    <div>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input id="dept-code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="border rounded px-3 py-2 w-24" required />
        <input id="dept-name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" required />
        <input id="dept-office" placeholder="Office" value={office} onChange={(e) => setOffice(e.target.value)} className="border rounded px-3 py-2 w-40" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Add</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Code</th><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Office</th></tr></thead>
          <tbody>
            {depts.map((d) => (
              <tr key={d.id} className="border-t"><td className="px-4 py-2">{d.code}</td><td className="px-4 py-2">{d.name}</td><td className="px-4 py-2 text-gray-500">{d.managing_office || '-'}</td></tr>
            ))}
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
    <div>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input id="desg-name" placeholder="Designation Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" required />
        <input id="desg-pay" placeholder="Pay Level" value={payLevel} onChange={(e) => setPayLevel(e.target.value)} className="border rounded px-3 py-2 w-32" />
        <input id="desg-cat" placeholder="Category Code" value={catCode} onChange={(e) => setCatCode(e.target.value)} className="border rounded px-3 py-2 w-32" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Add</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Pay Level</th><th className="px-4 py-2 text-left">Category</th></tr></thead>
          <tbody>
            {desgs.map((d) => (
              <tr key={d.id} className="border-t"><td className="px-4 py-2">{d.name}</td><td className="px-4 py-2 text-gray-500">{d.grade_pay_level || '-'}</td><td className="px-4 py-2 text-gray-500">{d.category_code || '-'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}