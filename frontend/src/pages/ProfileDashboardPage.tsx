import { useState, useEffect } from 'react';

import { Link } from 'react-router-dom';

import { useAuthStore } from '../stores';

import api from '../api/client';

import { PageHeader } from '../components/PageHeader';



type EmployeeSummary = {

  name: string;

  emp_code: string;

  designation_name: string;

  department_name: string;

  category_name?: string;

  doj?: string;

  email?: string;

  mobile?: string;

  is_active: boolean;

};



export default function ProfileDashboardPage() {

  const user = useAuthStore((s) => s.user);

  const [emp, setEmp] = useState<EmployeeSummary | null>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    if (!user?.employee_id) {

      setLoading(false);

      return;

    }

    api.get(`/employees/${user.employee_id}`)

      .then((res) => setEmp(res.data))

      .catch(() => setEmp(null))

      .finally(() => setLoading(false));

  }, [user]);



  return (

    <div className="page space-y-4">

      <PageHeader

        breadcrumbs={[

          { label: 'Home', to: '/' },

          { label: 'Profile' },

        ]}

        hideTitle

      />



      {loading && <p className="text-sm text-slate-500">Loading profile…</p>}



      {emp && (

        <section className="card p-4">

          <h2 className="text-sm font-bold text-slate-800 mb-3">Profile summary</h2>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">

            <div><dt className="text-slate-500">Staff number</dt><dd className="font-semibold text-slate-900">{emp.emp_code}</dd></div>

            <div><dt className="text-slate-500">Category</dt><dd className="font-medium text-slate-800">{emp.category_name || '—'}</dd></div>

            <div><dt className="text-slate-500">Department</dt><dd className="font-medium text-slate-800">{emp.department_name}</dd></div>

            <div><dt className="text-slate-500">Designation</dt><dd className="font-medium text-slate-800">{emp.designation_name}</dd></div>

            <div><dt className="text-slate-500">Date of joining</dt><dd className="font-medium text-slate-800">{emp.doj || '—'}</dd></div>

            <div><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-800">{emp.is_active ? 'Active' : 'Inactive'}</dd></div>

            {emp.mobile && <div><dt className="text-slate-500">Mobile</dt><dd className="font-medium text-slate-800">{emp.mobile}</dd></div>}

            {emp.email && <div><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-800">{emp.email}</dd></div>}

          </dl>

          <div className="mt-4">

            <Link to="/profile" className="text-sm font-semibold text-indigo-700 hover:underline">Open full profile →</Link>

          </div>

        </section>

      )}



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <DashboardCard

          title="View Profile"

          desc="Contact, address, and self-service edits"

          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"

          to="/profile"

        />

        <DashboardCard

          title="Service Record"

          desc="Posting history and establishment data (under development)"

          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"

          to="/service-record"

        />

        <DashboardCard

          title="Family & Dependents"

          desc="EHS / LTC records (under development)"

          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"

          to="/dependents"

        />

      </div>

    </div>

  );

}



function DashboardCard({ title, desc, icon, to }: { title: string, desc?: string, icon: string, to: string }) {

  return (

    <Link to={to} className="flex items-start gap-4 group rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4">

      <div className="shrink-0 h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">

        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />

        </svg>

      </div>

      <div>

        <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{title}</h3>

        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}

      </div>

    </Link>

  );

}


