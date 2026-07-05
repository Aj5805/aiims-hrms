import { useState, useEffect, useCallback } from 'react';
import { entitlementRulesApi, leaveTypesApi, workflowApi } from '../api/endpoints';
import { formatApiError, WORKFLOW_APPROVER_ROLES } from '../constants/roles';
import type { LeaveTypeRow } from './LeaveTypesPanel';

const CATEGORY_CODES = ['FACULTY', 'NURSING', 'ADMIN', 'JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA'] as const;
const APPROVER_ROLES = WORKFLOW_APPROVER_ROLES;

type WorkflowStepRow = {
  id: string;
  step_order: number;
  approver_role: string;
  approver_office?: string | null;
  sla_hours?: number;
  is_final_authority?: boolean;
  skip_if_self_applicant?: boolean;
};

type WorkflowConfigRow = {
  id: string;
  config_name: string;
  category_id?: string | null;
  leave_type_id?: string | null;
  category_code?: string | null;
  leave_type_code?: string | null;
  min_days?: number;
  max_days?: number | null;
  is_active?: boolean;
  steps?: WorkflowStepRow[];
};

type WorkflowConfigDraft = {
  config_name: string;
  category_id: string;
  leave_type_id: string;
  min_days: string;
  max_days: string;
  is_active: boolean;
};

type WorkflowStepDraft = {
  step_order: string;
  approver_role: string;
  approver_office: string;
  sla_hours: string;
  is_final_authority: boolean;
  skip_if_self_applicant: boolean;
};

function configToDraft(cfg: WorkflowConfigRow): WorkflowConfigDraft {
  return {
    config_name: cfg.config_name,
    category_id: cfg.category_id || '',
    leave_type_id: cfg.leave_type_id || '',
    min_days: String(cfg.min_days ?? 1),
    max_days: cfg.max_days != null ? String(cfg.max_days) : '',
    is_active: cfg.is_active !== false,
  };
}

function stepToDraft(step: WorkflowStepRow): WorkflowStepDraft {
  return {
    step_order: String(step.step_order),
    approver_role: step.approver_role,
    approver_office: step.approver_office || '',
    sla_hours: String(step.sla_hours ?? 48),
    is_final_authority: Boolean(step.is_final_authority),
    skip_if_self_applicant: step.skip_if_self_applicant !== false,
  };
}

function emptyStepDraft(order: number): WorkflowStepDraft {
  return {
    step_order: String(order),
    approver_role: 'HOD',
    approver_office: '',
    sla_hours: '48',
    is_final_authority: false,
    skip_if_self_applicant: true,
  };
}

export function WorkflowPanel() {
  const [configs, setConfigs] = useState<WorkflowConfigRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<WorkflowConfigDraft | null>(null);
  const [stepDrafts, setStepDrafts] = useState<Record<string, WorkflowStepDraft>>({});
  const [newStep, setNewStep] = useState<WorkflowStepDraft>(emptyStepDraft(1));
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [simCat, setSimCat] = useState('');
  const [simLt, setSimLt] = useState('');
  const [simDays, setSimDays] = useState('3');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [cfgRes, ltRes, rulesRes] = await Promise.all([
      workflowApi.list(),
      leaveTypesApi.list({ include_inactive: true }),
      entitlementRulesApi.list(),
    ]);
    setConfigs(cfgRes.data as WorkflowConfigRow[]);
    setLeaveTypes(ltRes.data as LeaveTypeRow[]);
    const map: Record<string, string> = {};
    for (const row of rulesRes.data as { category_code?: string; category_id?: string }[]) {
      if (row.category_code && row.category_id) {
        map[row.category_code] = row.category_id;
      }
    }
    setCategoryIds(map);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (cfg: WorkflowConfigRow) => {
    setEditingId(cfg.id);
    setConfigDraft(configToDraft(cfg));
    const drafts: Record<string, WorkflowStepDraft> = {};
    for (const step of cfg.steps || []) {
      drafts[step.id] = stepToDraft(step);
    }
    setStepDrafts(drafts);
    setNewStep(emptyStepDraft((cfg.steps?.length || 0) + 1));
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setConfigDraft(null);
    setStepDrafts({});
  };

  const createCfg = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await workflowApi.create({ config_name: newName.trim() });
      setNewName('');
      setMessage('Workflow created. Click Edit to add matching rules and approval steps.');
      await load();
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Failed to create workflow.');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!editingId || !configDraft) return;
    setSaving(true);
    setMessage('');
    try {
      await workflowApi.update(editingId, {
        config_name: configDraft.config_name.trim(),
        category_id: configDraft.category_id || null,
        leave_type_id: configDraft.leave_type_id || null,
        min_days: Number(configDraft.min_days) || 1,
        max_days: configDraft.max_days.trim() ? Number(configDraft.max_days) : null,
        is_active: configDraft.is_active,
      });
      setMessage('Workflow settings saved.');
      await load();
      const refreshed = (await workflowApi.list()).data as WorkflowConfigRow[];
      const current = refreshed.find((c) => c.id === editingId);
      if (current) startEdit(current);
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  const saveStep = async (stepId: string) => {
    if (!editingId) return;
    const draft = stepDrafts[stepId];
    if (!draft) return;
    setSaving(true);
    setMessage('');
    try {
      await workflowApi.updateStep(editingId, stepId, {
        step_order: Number(draft.step_order),
        approver_role: draft.approver_role,
        approver_office: draft.approver_office.trim() || null,
        sla_hours: Number(draft.sla_hours) || 48,
        is_final_authority: draft.is_final_authority,
        skip_if_self_applicant: draft.skip_if_self_applicant,
      });
      setMessage('Step saved.');
      await load();
      const refreshed = (await workflowApi.list()).data as WorkflowConfigRow[];
      const current = refreshed.find((c) => c.id === editingId);
      if (current) startEdit(current);
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Failed to save step.');
    } finally {
      setSaving(false);
    }
  };

  const addStep = async () => {
    if (!editingId) return;
    setSaving(true);
    setMessage('');
    try {
      await workflowApi.addStep(editingId, {
        step_order: Number(newStep.step_order),
        approver_role: newStep.approver_role,
        approver_office: newStep.approver_office.trim() || null,
        sla_hours: Number(newStep.sla_hours) || 48,
        is_final_authority: newStep.is_final_authority,
        skip_if_self_applicant: newStep.skip_if_self_applicant,
      });
      setMessage('Step added.');
      await load();
      const refreshed = (await workflowApi.list()).data as WorkflowConfigRow[];
      const current = refreshed.find((c) => c.id === editingId);
      if (current) startEdit(current);
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Failed to add step.');
    } finally {
      setSaving(false);
    }
  };

  const deleteStep = async (stepId: string) => {
    if (!editingId || !confirm('Delete this approval step?')) return;
    setSaving(true);
    setMessage('');
    try {
      await workflowApi.deleteStep(editingId, stepId);
      setMessage('Step deleted.');
      await load();
      const refreshed = (await workflowApi.list()).data as WorkflowConfigRow[];
      const current = refreshed.find((c) => c.id === editingId);
      if (current) startEdit(current);
    } catch (err: unknown) {
      setMessage(formatApiError((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Failed to delete step.');
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    const { data } = await workflowApi.simulate({
      category_code: simCat,
      leave_type_code: simLt,
      days: Number(simDays) || 1,
    });
    setSimResult(data as Record<string, unknown>);
  };

  const patchStepDraft = (stepId: string, partial: Partial<WorkflowStepDraft>) => {
    setStepDrafts((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...partial },
    }));
  };

  const editingConfig = configs.find((c) => c.id === editingId);

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</div>
      )}

      <div className="flex gap-3">
        <input
          placeholder="New workflow config name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="form-input flex-1"
        />
        <button type="button" onClick={() => void createCfg()} disabled={saving} className="btn-primary">Create</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-slate-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Workflow Chains</h3>
          {configs.map((c) => (
            <div key={c.id} className={`border rounded-lg ${editingId === c.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}`}>
              <div className="px-4 py-3 flex justify-between items-start gap-3">
                <div>
                  <div className="font-medium text-sm">{c.config_name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {(c.steps?.length || 0)} steps
                    {c.category_code ? ` · ${c.category_code}` : ' · all categories'}
                    {c.leave_type_code ? ` · ${c.leave_type_code}` : ' · all leave types'}
                    {c.is_active === false ? ' · inactive' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (editingId === c.id ? cancelEdit() : startEdit(c))}
                  className="text-xs font-bold text-blue-600 hover:underline shrink-0"
                >
                  {editingId === c.id ? 'Close' : 'Edit'}
                </button>
              </div>
              {editingId !== c.id && (
                <div className="px-4 pb-3 text-xs space-y-1">
                  {(c.steps || []).map((s) => (
                    <div key={s.id} className="flex gap-2 text-slate-600">
                      <span className="font-mono text-slate-400">{s.step_order}.</span>
                      <span className="font-medium">{s.approver_role}</span>
                      {s.approver_office && <span className="text-slate-400">({s.approver_office})</span>}
                      {s.is_final_authority && <span className="badge badge-green text-[10px]">Final</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {configs.length === 0 && <p className="text-slate-400 text-sm">No workflows configured.</p>}
        </div>

        <div className="border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Simulate Routing</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <input placeholder="Category e.g. FACULTY" value={simCat} onChange={(e) => setSimCat(e.target.value)} className="form-input" />
            <input placeholder="Leave type e.g. EL" value={simLt} onChange={(e) => setSimLt(e.target.value)} className="form-input" />
            <input type="number" value={simDays} onChange={(e) => setSimDays(e.target.value)} min={1} className="form-input" />
          </div>
          <button type="button" onClick={() => void simulate()} className="btn-secondary w-full">Run Simulation</button>
          {simResult && (
            <div className="mt-4 text-sm border-t border-slate-100 pt-4">
              {simResult.matched ? (
                <div>
                  <p className="text-emerald-700 font-semibold mb-3">
                    Matched: {(simResult.config as Record<string, unknown>).config_name as string}
                  </p>
                  <div className="space-y-2">
                    {((simResult.config as Record<string, unknown>).steps as Record<string, unknown>[])?.map((s) => (
                      <div key={s.id as string} className="flex gap-3 text-slate-600">
                        <span className="font-mono text-slate-400">Step {s.step_order as number}</span>
                        <span className="font-medium">{s.approver_role as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-red-600">No workflow matched for the given inputs.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {editingId && configDraft && editingConfig && (
        <div className="border border-indigo-200 rounded-lg p-5 bg-white space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Edit Workflow — {editingConfig.config_name}</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="md:col-span-2">
                <label className="form-label">Config Name</label>
                <input
                  value={configDraft.config_name}
                  onChange={(e) => setConfigDraft({ ...configDraft, config_name: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Employee Category</label>
                <select
                  value={configDraft.category_id}
                  onChange={(e) => setConfigDraft({ ...configDraft, category_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">All categories</option>
                  {CATEGORY_CODES.map((code) => (
                    categoryIds[code] ? (
                      <option key={code} value={categoryIds[code]}>{code}</option>
                    ) : null
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Leave Type</label>
                <select
                  value={configDraft.leave_type_id}
                  onChange={(e) => setConfigDraft({ ...configDraft, leave_type_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">All leave types</option>
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.code} — {lt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Min Days</label>
                <input
                  type="number"
                  min={1}
                  value={configDraft.min_days}
                  onChange={(e) => setConfigDraft({ ...configDraft, min_days: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Max Days</label>
                <input
                  type="number"
                  min={1}
                  value={configDraft.max_days}
                  onChange={(e) => setConfigDraft({ ...configDraft, max_days: e.target.value })}
                  className="form-input"
                  placeholder="Blank = no upper limit"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={configDraft.is_active}
                    onChange={(e) => setConfigDraft({ ...configDraft, is_active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </div>
            <button type="button" onClick={() => void saveConfig()} disabled={saving} className="btn-primary mt-4">
              Save Workflow Settings
            </button>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Approval Steps</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="data-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Approver Role</th>
                    <th>Office</th>
                    <th>SLA (hrs)</th>
                    <th>Final</th>
                    <th>Skip Self</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(editingConfig.steps || []).map((step) => {
                    const draft = stepDrafts[step.id] || stepToDraft(step);
                    return (
                      <tr key={step.id}>
                        <td>
                          <input
                            type="number"
                            min={1}
                            value={draft.step_order}
                            onChange={(e) => patchStepDraft(step.id, { step_order: e.target.value })}
                            className="form-input w-16 py-1"
                          />
                        </td>
                        <td>
                          <select
                            value={draft.approver_role}
                            onChange={(e) => patchStepDraft(step.id, { approver_role: e.target.value })}
                            className="form-select py-1"
                          >
                            {APPROVER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            value={draft.approver_office}
                            onChange={(e) => patchStepDraft(step.id, { approver_office: e.target.value })}
                            className="form-input py-1"
                            placeholder="e.g. Department"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            value={draft.sla_hours}
                            onChange={(e) => patchStepDraft(step.id, { sla_hours: e.target.value })}
                            className="form-input w-20 py-1"
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={draft.is_final_authority}
                            onChange={(e) => patchStepDraft(step.id, { is_final_authority: e.target.checked })}
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={draft.skip_if_self_applicant}
                            onChange={(e) => patchStepDraft(step.id, { skip_if_self_applicant: e.target.checked })}
                          />
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button type="button" onClick={() => void saveStep(step.id)} disabled={saving} className="text-xs font-bold text-emerald-700 hover:underline mr-2">Save</button>
                          <button type="button" onClick={() => void deleteStep(step.id)} disabled={saving} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Add Step</h5>
              <div className="grid gap-3 md:grid-cols-6 items-end">
                <div>
                  <label className="form-label">Order</label>
                  <input type="number" min={1} value={newStep.step_order} onChange={(e) => setNewStep({ ...newStep, step_order: e.target.value })} className="form-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Role</label>
                  <select value={newStep.approver_role} onChange={(e) => setNewStep({ ...newStep, approver_role: e.target.value })} className="form-select">
                    {APPROVER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Office</label>
                  <input value={newStep.approver_office} onChange={(e) => setNewStep({ ...newStep, approver_office: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">SLA</label>
                  <input type="number" min={1} value={newStep.sla_hours} onChange={(e) => setNewStep({ ...newStep, sla_hours: e.target.value })} className="form-input" />
                </div>
                <div className="flex gap-4 items-center pb-2">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={newStep.is_final_authority} onChange={(e) => setNewStep({ ...newStep, is_final_authority: e.target.checked })} />Final</label>
                  <button type="button" onClick={() => void addStep()} disabled={saving} className="btn-secondary btn-sm">Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
