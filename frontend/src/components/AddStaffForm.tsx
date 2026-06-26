import React, { useState, useEffect } from 'react';
import { employeesApi, departmentsApi, designationsApi } from '../api/endpoints';

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
  category_code: string;
}

interface AddStaffFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

export default function AddStaffForm({ onSaved, onCancel }: AddStaffFormProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    emp_code: '',
    name: '',
    gender: 'MALE',
    dob: '',
    doj: '',
    department_code: '',
    designation_name: '',
    email: '',
    personal_email: '',
    has_institutional_email: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, desigRes] = await Promise.all([
          departmentsApi.list(),
          designationsApi.list(),
        ]);
        setDepartments(deptRes.data || []);
        setDesignations(desigRes.data || []);
      } catch (err) {
        setError('Failed to load master data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    // Find category from designation to send to backend
    const selectedDesig = designations.find(d => d.name === form.designation_name);
    const category_code = selectedDesig?.category_code || '';

    try {
      await employeesApi.create({
        ...form,
        category_code,
      });
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create employee');
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading master data...</div>;

  const selectedDesig = designations.find(d => d.name === form.designation_name);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Onboard New Staff</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select a designation to automatically assign the correct leave scheme. A user account will be generated automatically.
        </p>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code *</label>
            <input 
              required
              value={form.emp_code} 
              onChange={e => setForm({...form, emp_code: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. AIIMS-1234"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input 
              required
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Dr. John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
            <select 
              required
              value={form.gender} 
              onChange={e => setForm({...form, gender: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining *</label>
            <input 
              required
              type="date"
              value={form.doj} 
              onChange={e => setForm({...form, doj: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
            <select 
              required
              value={form.department_code} 
              onChange={e => setForm({...form, department_code: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Department...</option>
              {departments.map(d => (
                <option key={d.id} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
            <select 
              required
              value={form.designation_name} 
              onChange={e => setForm({...form, designation_name: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Designation...</option>
              {designations.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            {selectedDesig && (
              <p className="mt-1 text-xs text-blue-600 font-medium">
                Auto-assigned category: {selectedDesig.category_code}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Official Email</label>
            <input 
              type="email"
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@aiims.edu"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
            <input 
              type="email"
              value={form.personal_email} 
              onChange={e => setForm({...form, personal_email: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input 
              type="date"
              value={form.dob} 
              onChange={e => setForm({...form, dob: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center pt-6">
            <input 
              type="checkbox"
              id="has_inst_email"
              checked={form.has_institutional_email} 
              onChange={e => setForm({...form, has_institutional_email: e.target.checked})}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="has_inst_email" className="ml-2 block text-sm text-gray-700">
              Institutional Email Verified
            </label>
          </div>
        </div>

        <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-4 mt-8 flex justify-end gap-3 rounded-b-lg border-t border-gray-200">
          <button 
            type="button" 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={saving || !selectedDesig}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Onboarding...' : 'Onboard Staff'}
          </button>
        </div>
      </form>
    </div>
  );
}
