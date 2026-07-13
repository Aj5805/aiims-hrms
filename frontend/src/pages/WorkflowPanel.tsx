import { useState, useEffect, useCallback } from 'react';
import { entitlementRulesApi, leaveTypesApi, workflowApi } from '../api/endpoints';
import { formatApiError, formatHttpError, WORKFLOW_APPROVER_ROLES } from '../constants/roles';
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

type SimCriteria = {
  category_code?: string | null;
  leave_type_code?: string | null;
  days?: number;
};

type SimResult = {
  matched: boolean;
  eligible?: boolean;
  message?: string;
  config?: WorkflowConfigRow;
  criteria?: SimCriteria;
};

type EntitlementRuleRow = {
  category_code?: string;
  category_id?: string;
  leave_type_code?: string;
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

function formatDayRange(minDays?: number, maxDays?: number | null): string {
  const min = minDays ?? 1;
  if (maxDays == null) return `${min}+ days`;
  if (min === maxDays) return `${min} day${min === 1 ? '' : 's'}`;
  return `${min}–${maxDays} days`;
}

function formatScope(cfg: WorkflowConfigRow): string {
  const cat = cfg.category_code || 'all categories';
  const lt = cfg.leave_type_code || 'all leave types';
  return `${cat} · ${lt} · ${formatDayRange(cfg.min_days, cfg.max_days)}`;
}

function criteriaLabel(criteria?: SimCriteria): string {
  if (!criteria?.category_code || !criteria?.leave_type_code) return '';
  const days = criteria.days ?? 1;
  return `${criteria.category_code} · ${criteria.leave_type_code} · ${days} day${days === 1 ? '' : 's'}`;
}

function isTestWorkflow(cfg: WorkflowConfigRow): boolean {
  const name = cfg.config_name || '';
  return name.startsWith('E2E_') || name.startsWith('ASCII Test');
}

function sortWorkflowConfigs(configs: WorkflowConfigRow[]): WorkflowConfigRow[] {
  return [...configs].sort((a, b) => {
    const aActive = a.is_active !== false ? 0 : 1;
    const bActive = b.is_active !== false ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    const aSteps = (a.steps?.length || 0) > 0 ? 0 : 1;
    const bSteps = (b.steps?.length || 0) > 0 ? 0 : 1;
    if (aSteps !== bSteps) return aSteps - bSteps;

    return a.config_name.localeCompare(b.config_name);
  });
}

export function WorkflowPanel() {
  const [configs, setConfigs] = useState<WorkflowConfigRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [entitlementRules, setEntitlementRules] = useState<EntitlementRuleRow[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<WorkflowConfigDraft | null>(null);
  const [stepDrafts, setStepDrafts] = useState<Record<string, WorkflowStepDraft>>({});
  const [newStep, setNewStep] = useState<WorkflowStepDraft>(emptyStepDraft(1));
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simCat, setSimCat] = useState('');
  const [simLt, setSimLt] = useState('');
  const [simDays, setSimDays] = useState('3');
  const [simLoading, setSimLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const applyEditState = useCallback((cfg: WorkflowConfigRow) => {
    setEditingId(cfg.id);
    setConfigDraft(configToDraft(cfg));
    const drafts: Record<string, WorkflowStepDraft> = {};
    for (const step of cfg.steps || []) {
      drafts[step.id] = stepToDraft(step);
    }
    setStepDrafts(drafts);
    setNewStep(emptyStepDraft((cfg.steps?.length || 0) + 1));
  }, []);

  const load = useCallback(async (): Promise<WorkflowConfigRow[]> => {
    const [cfgRes, ltRes, rulesRes] = await Promise.all([
      workflowApi.list(),
      leaveTypesApi.list({ include_inactive: true }),
      entitlementRulesApi.list(),
    ]);
    const rows = cfgRes.data as WorkflowConfigRow[];
    setConfigs(rows);
    setLeaveTypes(ltRes.data as LeaveTypeRow[]);
    const rules = rulesRes.data as EntitlementRuleRow[];
    setEntitlementRules(rules);
    const map: Record<string, string> = {};
    for (const row of rules) {
      if (row.category_code && row.category_id) {
        map[row.category_code] = row.category_id;
      }
    }
    setCategoryIds(map);
    return rows;
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reloadEditing = async (configId: string) => {
    const rows = await load();
    const current = rows.find((c) => c.id === configId);
    if (current) applyEditState(current);
  };

  const startEdit = (cfg: WorkflowConfigRow) => {
    applyEditState(cfg);
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
      setMessage(formatHttpError(err, 'Failed to create workflow.'));
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
      await reloadEditing(editingId);
    } catch (err: unknown) {
      setMessage(formatHttpError(err, 'Failed to save workflow.'));
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
      await reloadEditing(editingId);
    } catch (err: unknown) {
      setMessage(formatHttpError(err, 'Failed to save step.'));
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
      await reloadEditing(editingId);
    } catch (err: unknown) {
      setMessage(formatHttpError(err, 'Failed to add step.'));
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
      await reloadEditing(editingId);
    } catch (err: unknown) {
      setMessage(formatHttpError(err, 'Failed to delete step.'));
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (!simCat || !simLt) {
      setSimResult({
        matched: false,
        eligible: false,
        message: 'Select both employee category and leave type.',
      });
      return;
    }
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data } = await workflowApi.simulate({
        category_code: simCat,
        leave_type_code: simLt,
        days: Number(simDays) || 1,
      });
      setSimResult(data as SimResult);
    } catch (err: unknown) {
      setSimResult({
        matched: false,
        message: formatHttpError(err, 'Simulation failed.'),
      });
    } finally {
      setSimLoading(false);
    }
  };

  const patchStepDraft = (stepId: string, partial: Partial<WorkflowStepDraft>) => {
    setStepDrafts((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...partial },
    }));
  };

  const activeLeaveTypes = leaveTypes.filter((lt) => lt.is_active !== false);
  const entitledLeaveCodes = new Set(
    entitlementRules
      .filter((r) => r.category_code === simCat && r.leave_type_code)
      .map((r) => r.leave_type_code as string),
  );
  const simLeaveTypeOptions = activeLeaveTypes.filter((lt) => entitledLeaveCodes.has(lt.code));
  const canSimulate = Boolean(simCat && simLt);
  const inactiveCount = configs.filter((c) => c.is_active === false).length;
  const visibleConfigs = sortWorkflowConfigs(
    showInactive ? configs : configs.filter((c) => c.is_active !== false),
  );
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

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <div className="border border-slate-200 rounded-lg p-5 space-y-3 max-h-[min(70vh,42rem)] overflow-y-auto app-scroll-y">
          <div className="flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 bg-white pb-2 -mt-1 pt-1">
            <h3 className="text-sm font-semibold text-slate-800">Workflow Chains</h3>
            {inactiveCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive ({inactiveCount})
              </label>
            )}
          </div>
          {visibleConfigs.map((c) => (
            <div key={c.id} className={`border rounded-lg ${editingId === c.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}`}>
              <div className="px-4 py-3 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                    <span>{c.config_name}</span>
                    {showInactive && isTestWorkflow(c) && (
                      <span className="badge text-[10px] bg-amber-100 text-amber-800">test</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate" title={formatScope(c)}>
                    {(c.steps?.length || 0)} steps · {formatScope(c)}
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
                    <div key={s.id} className="flex flex-wrap gap-2 text-slate-600">
                      <span className="font-mono text-slate-400">{s.step_order}.</span>
                      <span className="font-medium">{s.approver_role}</span>
                      {s.approver_office && <span className="text-slate-400">({s.approver_office})</span>}
                      {s.is_final_authority && <span className="badge badge-green text-[10px]">Final</span>}
                    </div>
                  ))}
                  {(c.steps?.length || 0) === 0 && (
                    <p className="text-slate-400">No approval steps — edit to add.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {visibleConfigs.length === 0 && (
            <p className="text-slate-400 text-sm">
              {configs.length === 0
                ? 'No workflows configured.'
                : 'No active workflows. Enable "Show inactive" to see test or retired configs.'}
            </p>
          )}
        </div>

        <div className="border border-slate-200 rounded-lg p-5 xl:sticky xl:top-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Simulate Routing</h3>
          <p className="text-xs text-slate-500 mb-4">
            Mirrors leave apply: only combinations configured in Entitlements for that staff category, then workflow rules.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <div>
              <label className="form-label">Category</label>
              <select
                value={simCat}
                onChange={(e) => {
                  setSimCat(e.target.value);
                  setSimLt('');
                  setSimResult(null);
                }}
                className="form-select"
              >
                <option value="">Select category…</option>
                {CATEGORY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Leave type</label>
              <select
                value={simLt}
                onChange={(e) => {
                  setSimLt(e.target.value);
                  setSimResult(null);
                }}
                className="form-select"
                disabled={!simCat}
              >
                <option value="">{simCat ? 'Select leave type…' : 'Choose category first'}</option>
                {simLeaveTypeOptions.map((lt) => (
                  <option key={lt.id} value={lt.code}>{lt.code}</option>
                ))}
              </select>
              {simCat && simLeaveTypeOptions.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">No leave types entitled for this category.</p>
              )}
            </div>
            <div>
              <label className="form-label">Days</label>
              <input
                type="number"
                value={simDays}
                onChange={(e) => setSimDays(e.target.value)}
                min={0.5}
                step={0.5}
                className="form-input"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void simulate()}
            disabled={simLoading || !canSimulate}
            className="btn-secondary w-full"
          >
            {simLoading ? 'Running…' : 'Run Simulation'}
          </button>
          {simResult && (
            <div className="mt-4 text-sm border-t border-slate-100 pt-4">
              {simResult.matched && simResult.config ? (
                <div>
                  {criteriaLabel(simResult.criteria) && (
                    <p className="text-xs text-slate-500 mb-2">Input: {criteriaLabel(simResult.criteria)}</p>
                  )}
                  <p className="text-emerald-700 font-semibold mb-1">
                    Matched: {simResult.config.config_name}
                  </p>
                  <p className="text-xs text-slate-500 mb-3">{formatScope(simResult.config)}</p>
                  <div className="space-y-2">
                    {(simResult.config.steps || []).map((s) => (
                      <div key={s.id} className="flex flex-wrap gap-2 text-slate-600">
                        <span className="font-mono text-slate-400">Step {s.step_order}</span>
                        <span className="font-medium">{s.approver_role}</span>
                        {s.approver_office && <span className="text-slate-400">({s.approver_office})</span>}
                        {s.is_final_authority && <span className="badge badge-green text-[10px]">Final</span>}
                        {s.skip_if_self_applicant && <span className="text-slate-400 text-xs">skip if self</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {simResult.criteria && criteriaLabel(simResult.criteria) && (
                    <p className="text-xs text-slate-500 mb-2">Input: {criteriaLabel(simResult.criteria)}</p>
                  )}
                  <p className="text-red-600">
                    {simResult.message || formatApiError(simResult.message) || 'No workflow matched for the given inputs.'}
                  </p>
                </div>
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
