--
-- PostgreSQL database dump
--

\restrict GbQ4wfQVbCwYqZXdQf5SGb8Op0Zgso1ctKk7TjrzzPTDmOmeYPThcyxMERiYQLq

-- Dumped from database version 14.22 (Homebrew)
-- Dumped by pg_dump version 14.22 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.workflow_steps DROP CONSTRAINT IF EXISTS fk_workflow_steps_specific_approver_id_users;
ALTER TABLE IF EXISTS ONLY public.workflow_steps DROP CONSTRAINT IF EXISTS fk_workflow_steps_config_id_workflow_configs;
ALTER TABLE IF EXISTS ONLY public.workflow_configs DROP CONSTRAINT IF EXISTS fk_workflow_configs_leave_type_id_leave_types;
ALTER TABLE IF EXISTS ONLY public.workflow_configs DROP CONSTRAINT IF EXISTS fk_workflow_configs_created_by_users;
ALTER TABLE IF EXISTS ONLY public.workflow_configs DROP CONSTRAINT IF EXISTS fk_workflow_configs_category_id_employee_categories;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS fk_users_employee_id_employees;
ALTER TABLE IF EXISTS ONLY public.token_blacklist DROP CONSTRAINT IF EXISTS fk_token_blacklist_user_id_users;
ALTER TABLE IF EXISTS ONLY public.payroll_export_log DROP CONSTRAINT IF EXISTS fk_payroll_export_log_exported_by_users;
ALTER TABLE IF EXISTS ONLY public.notification_queue DROP CONSTRAINT IF EXISTS fk_notification_queue_recipient_id_users;
ALTER TABLE IF EXISTS ONLY public.notification_queue DROP CONSTRAINT IF EXISTS fk_notification_queue_application_id_leave_applications;
ALTER TABLE IF EXISTS ONLY public.leave_entitlement_rules DROP CONSTRAINT IF EXISTS fk_leave_entitlement_rules_leave_type_id_leave_types;
ALTER TABLE IF EXISTS ONLY public.leave_entitlement_rules DROP CONSTRAINT IF EXISTS fk_leave_entitlement_rules_category_id_employee_categories;
ALTER TABLE IF EXISTS ONLY public.leave_documents DROP CONSTRAINT IF EXISTS fk_leave_documents_uploaded_by_users;
ALTER TABLE IF EXISTS ONLY public.leave_documents DROP CONSTRAINT IF EXISTS fk_leave_documents_application_id_leave_applications;
ALTER TABLE IF EXISTS ONLY public.leave_balances DROP CONSTRAINT IF EXISTS fk_leave_balances_leave_type_id_leave_types;
ALTER TABLE IF EXISTS ONLY public.leave_balances DROP CONSTRAINT IF EXISTS fk_leave_balances_employee_id_employees;
ALTER TABLE IF EXISTS ONLY public.leave_approvals DROP CONSTRAINT IF EXISTS fk_leave_approvals_step_id_workflow_steps;
ALTER TABLE IF EXISTS ONLY public.leave_approvals DROP CONSTRAINT IF EXISTS fk_leave_approvals_approver_id_users;
ALTER TABLE IF EXISTS ONLY public.leave_approvals DROP CONSTRAINT IF EXISTS fk_leave_approvals_application_id_leave_applications;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS fk_leave_applications_leave_type_id_leave_types;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS fk_leave_applications_employee_id_employees;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS fk_leave_applications_config_id_workflow_configs;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS fk_leave_applications_acting_arrangement_emp_id_employees;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS fk_employees_reporting_officer_id_employees;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS fk_employees_designation_id_designations;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS fk_employees_department_id_departments;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS fk_employees_category_id_employee_categories;
ALTER TABLE IF EXISTS ONLY public.employee_salary_assignments DROP CONSTRAINT IF EXISTS fk_employee_salary_assignments_structure_id_salary_structures;
ALTER TABLE IF EXISTS ONLY public.employee_salary_assignments DROP CONSTRAINT IF EXISTS fk_employee_salary_assignments_employee_id_employees;
ALTER TABLE IF EXISTS ONLY public.designations DROP CONSTRAINT IF EXISTS fk_designations_category_id_employee_categories;
ALTER TABLE IF EXISTS ONLY public.dept_nodal_assignments DROP CONSTRAINT IF EXISTS fk_dept_nodal_assignments_nodal_user_id_users;
ALTER TABLE IF EXISTS ONLY public.dept_nodal_assignments DROP CONSTRAINT IF EXISTS fk_dept_nodal_assignments_department_id_departments;
ALTER TABLE IF EXISTS ONLY public.dept_nodal_assignments DROP CONSTRAINT IF EXISTS fk_dept_nodal_assignments_assigned_by_users;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS fk_departments_parent_dept_id_departments;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS fk_audit_log_actor_id_users;
ALTER TABLE IF EXISTS ONLY public.attendance_raw DROP CONSTRAINT IF EXISTS fk_attendance_raw_employee_id_employees;
DROP TRIGGER IF EXISTS trg_audit_log_no_update ON public.audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON public.audit_log;
DROP INDEX IF EXISTS public.ix_token_blacklist_expires_at;
DROP INDEX IF EXISTS public.ix_dept_nodal_user_id;
DROP INDEX IF EXISTS public.ix_dept_nodal_dept_id;
DROP INDEX IF EXISTS public.ix_audit_log_entity;
DROP INDEX IF EXISTS public.ix_audit_log_created_at;
DROP INDEX IF EXISTS public.ix_audit_log_actor;
ALTER TABLE IF EXISTS ONLY public.workflow_steps DROP CONSTRAINT IF EXISTS uq_workflow_steps_config_id;
ALTER TABLE IF EXISTS ONLY public.workflow_configs DROP CONSTRAINT IF EXISTS uq_workflow_configs_config_name;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS uq_users_username;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS uq_users_employee_id;
ALTER TABLE IF EXISTS ONLY public.salary_structures DROP CONSTRAINT IF EXISTS uq_salary_structures_code;
ALTER TABLE IF EXISTS ONLY public.leave_types DROP CONSTRAINT IF EXISTS uq_leave_types_code;
ALTER TABLE IF EXISTS ONLY public.leave_entitlement_rules DROP CONSTRAINT IF EXISTS uq_leave_entitlement_rules_category_id;
ALTER TABLE IF EXISTS ONLY public.leave_balances DROP CONSTRAINT IF EXISTS uq_leave_balances_employee_id;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS uq_leave_applications_app_number;
ALTER TABLE IF EXISTS ONLY public.holiday_master DROP CONSTRAINT IF EXISTS uq_holiday_master_holiday_date;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS uq_employees_emp_code;
ALTER TABLE IF EXISTS ONLY public.employee_salary_assignments DROP CONSTRAINT IF EXISTS uq_employee_salary_assignments_employee_id;
ALTER TABLE IF EXISTS ONLY public.employee_categories DROP CONSTRAINT IF EXISTS uq_employee_categories_code;
ALTER TABLE IF EXISTS ONLY public.email_templates DROP CONSTRAINT IF EXISTS uq_email_templates_event_code;
ALTER TABLE IF EXISTS ONLY public.designations DROP CONSTRAINT IF EXISTS uq_designations_name;
ALTER TABLE IF EXISTS ONLY public.dept_nodal_assignments DROP CONSTRAINT IF EXISTS uq_dept_nodal;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS uq_departments_code;
ALTER TABLE IF EXISTS ONLY public.workflow_steps DROP CONSTRAINT IF EXISTS pk_workflow_steps;
ALTER TABLE IF EXISTS ONLY public.workflow_configs DROP CONSTRAINT IF EXISTS pk_workflow_configs;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS pk_users;
ALTER TABLE IF EXISTS ONLY public.token_blacklist DROP CONSTRAINT IF EXISTS pk_token_blacklist;
ALTER TABLE IF EXISTS ONLY public.salary_structures DROP CONSTRAINT IF EXISTS pk_salary_structures;
ALTER TABLE IF EXISTS ONLY public.payroll_export_log DROP CONSTRAINT IF EXISTS pk_payroll_export_log;
ALTER TABLE IF EXISTS ONLY public.notification_queue DROP CONSTRAINT IF EXISTS pk_notification_queue;
ALTER TABLE IF EXISTS ONLY public.leave_types DROP CONSTRAINT IF EXISTS pk_leave_types;
ALTER TABLE IF EXISTS ONLY public.leave_entitlement_rules DROP CONSTRAINT IF EXISTS pk_leave_entitlement_rules;
ALTER TABLE IF EXISTS ONLY public.leave_documents DROP CONSTRAINT IF EXISTS pk_leave_documents;
ALTER TABLE IF EXISTS ONLY public.leave_balances DROP CONSTRAINT IF EXISTS pk_leave_balances;
ALTER TABLE IF EXISTS ONLY public.leave_approvals DROP CONSTRAINT IF EXISTS pk_leave_approvals;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS pk_leave_applications;
ALTER TABLE IF EXISTS ONLY public.holiday_master DROP CONSTRAINT IF EXISTS pk_holiday_master;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS pk_employees;
ALTER TABLE IF EXISTS ONLY public.employee_salary_assignments DROP CONSTRAINT IF EXISTS pk_employee_salary_assignments;
ALTER TABLE IF EXISTS ONLY public.employee_categories DROP CONSTRAINT IF EXISTS pk_employee_categories;
ALTER TABLE IF EXISTS ONLY public.email_templates DROP CONSTRAINT IF EXISTS pk_email_templates;
ALTER TABLE IF EXISTS ONLY public.designations DROP CONSTRAINT IF EXISTS pk_designations;
ALTER TABLE IF EXISTS ONLY public.dept_nodal_assignments DROP CONSTRAINT IF EXISTS pk_dept_nodal_assignments;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS pk_departments;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS pk_audit_log;
ALTER TABLE IF EXISTS ONLY public.attendance_raw DROP CONSTRAINT IF EXISTS pk_attendance_raw;
ALTER TABLE IF EXISTS ONLY public.leave_applications DROP CONSTRAINT IF EXISTS no_overlapping_approved_leave;
ALTER TABLE IF EXISTS ONLY public.alembic_version DROP CONSTRAINT IF EXISTS alembic_version_pkc;
DROP TABLE IF EXISTS public.workflow_steps;
DROP TABLE IF EXISTS public.workflow_configs;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.token_blacklist;
DROP TABLE IF EXISTS public.salary_structures;
DROP TABLE IF EXISTS public.payroll_export_log;
DROP TABLE IF EXISTS public.notification_queue;
DROP TABLE IF EXISTS public.leave_types;
DROP TABLE IF EXISTS public.leave_entitlement_rules;
DROP TABLE IF EXISTS public.leave_documents;
DROP TABLE IF EXISTS public.leave_balances;
DROP TABLE IF EXISTS public.leave_approvals;
DROP TABLE IF EXISTS public.leave_applications;
DROP TABLE IF EXISTS public.holiday_master;
DROP TABLE IF EXISTS public.employees;
DROP TABLE IF EXISTS public.employee_salary_assignments;
DROP TABLE IF EXISTS public.employee_categories;
DROP TABLE IF EXISTS public.email_templates;
DROP TABLE IF EXISTS public.designations;
DROP TABLE IF EXISTS public.dept_nodal_assignments;
DROP TABLE IF EXISTS public.departments;
DROP TABLE IF EXISTS public.audit_log_2027;
DROP TABLE IF EXISTS public.audit_log_2026;
DROP TABLE IF EXISTS public.audit_log;
DROP TABLE IF EXISTS public.attendance_raw;
DROP TABLE IF EXISTS public.alembic_version;
DROP FUNCTION IF EXISTS public.audit_log_no_mutation();
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS btree_gist;
--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: audit_log_no_mutation(); Type: FUNCTION; Schema: public; Owner: aiims_hrms
--

CREATE FUNCTION public.audit_log_no_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only -- UPDATE and DELETE are not permitted';
        END;
        $$;


ALTER FUNCTION public.audit_log_no_mutation() OWNER TO aiims_hrms;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO aiims_hrms;

--
-- Name: attendance_raw; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.attendance_raw (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    punch_in timestamp with time zone,
    punch_out timestamp with time zone,
    source character varying(20) DEFAULT 'BIOMETRIC'::character varying,
    device_id character varying(50),
    imported_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.attendance_raw OWNER TO aiims_hrms;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    actor_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_log OWNER TO aiims_hrms;

--
-- Name: audit_log_2026; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.audit_log_2026 (
    id uuid DEFAULT public.uuid_generate_v4(),
    actor_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    action character varying(50),
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
)
INHERITS (public.audit_log);


ALTER TABLE public.audit_log_2026 OWNER TO aiims_hrms;

--
-- Name: audit_log_2027; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.audit_log_2027 (
    id uuid DEFAULT public.uuid_generate_v4(),
    actor_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    action character varying(50),
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
)
INHERITS (public.audit_log);


ALTER TABLE public.audit_log_2027 OWNER TO aiims_hrms;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(150) NOT NULL,
    parent_dept_id uuid,
    managing_office character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.departments OWNER TO aiims_hrms;

--
-- Name: dept_nodal_assignments; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.dept_nodal_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    department_id uuid NOT NULL,
    nodal_user_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);


ALTER TABLE public.dept_nodal_assignments OWNER TO aiims_hrms;

--
-- Name: designations; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.designations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    grade_pay_level character varying(20),
    category_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.designations OWNER TO aiims_hrms;

--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_code character varying(50) NOT NULL,
    subject_template text NOT NULL,
    body_template text NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_templates OWNER TO aiims_hrms;

--
-- Name: employee_categories; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.employee_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    leave_scheme character varying(20) NOT NULL,
    tenure_based boolean DEFAULT false,
    tenure_months integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_categories OWNER TO aiims_hrms;

--
-- Name: employee_salary_assignments; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.employee_salary_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    basic_pay numeric(10,2) NOT NULL,
    pay_level character varying(10) NOT NULL,
    grade_pay numeric(8,2),
    effective_from date NOT NULL,
    increment_due_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_salary_assignments OWNER TO aiims_hrms;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.employees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    emp_code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    gender character varying(10) NOT NULL,
    dob date,
    doj date NOT NULL,
    category_id uuid NOT NULL,
    department_id uuid NOT NULL,
    designation_id uuid NOT NULL,
    reporting_officer_id uuid,
    email character varying(255),
    has_institutional_email boolean DEFAULT false,
    personal_email character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employees OWNER TO aiims_hrms;

--
-- Name: holiday_master; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.holiday_master (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    year integer NOT NULL,
    holiday_date date NOT NULL,
    holiday_name character varying(200) NOT NULL,
    holiday_type character varying(20) NOT NULL,
    applicable_to character varying(20) DEFAULT 'ALL'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.holiday_master OWNER TO aiims_hrms;

--
-- Name: leave_applications; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.leave_applications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    app_number character varying(30) NOT NULL,
    config_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    applied_days numeric(5,2) NOT NULL,
    is_half_day boolean DEFAULT false,
    half_day_session character varying(10),
    reason text NOT NULL,
    address_during_leave text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    acting_arrangement_emp_id uuid,
    current_step_order integer DEFAULT 1,
    submitted_at timestamp with time zone,
    last_action_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leave_applications OWNER TO aiims_hrms;

--
-- Name: leave_approvals; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.leave_approvals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    step_id uuid NOT NULL,
    approver_id uuid NOT NULL,
    step_order integer NOT NULL,
    action character varying(20) NOT NULL,
    remarks text,
    modified_from_date date,
    modified_to_date date,
    modified_days numeric(5,2),
    acted_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leave_approvals OWNER TO aiims_hrms;

--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.leave_balances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    leave_year integer NOT NULL,
    year_start_date date NOT NULL,
    opening_balance numeric(6,2) DEFAULT '0'::numeric,
    credited numeric(6,2) DEFAULT '0'::numeric,
    availed numeric(6,2) DEFAULT '0'::numeric,
    lop_days numeric(6,2) DEFAULT '0'::numeric,
    closing_balance numeric(6,2) GENERATED ALWAYS AS (((opening_balance + credited) - availed)) STORED,
    last_updated timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leave_balances OWNER TO aiims_hrms;

--
-- Name: leave_documents; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.leave_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    doc_type character varying(30) NOT NULL,
    file_path text NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_size_kb integer,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leave_documents OWNER TO aiims_hrms;

--
-- Name: leave_entitlement_rules; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.leave_entitlement_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    year_ref character varying(20) NOT NULL,
    days_per_year numeric(5,2),
    prorata_rate numeric(4,2),
    year1_days numeric(5,2),
    year2_plus_days numeric(5,2),
    max_at_a_stretch integer,
    max_in_tenure numeric(5,2),
    carry_forward boolean DEFAULT false,
    special_rules jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leave_entitlement_rules OWNER TO aiims_hrms;

--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.leave_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    scheme character varying(20) NOT NULL,
    is_accumulating boolean DEFAULT false,
    max_accumulation integer,
    requires_mc boolean DEFAULT false,
    min_days_for_mc integer,
    count_holidays boolean DEFAULT true,
    is_half_day_allowed boolean DEFAULT false,
    carry_forward boolean DEFAULT false,
    encashable boolean DEFAULT false,
    validation_rules jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leave_types OWNER TO aiims_hrms;

--
-- Name: notification_queue; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.notification_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    channel character varying(10) NOT NULL,
    subject text,
    body text NOT NULL,
    status character varying(10) DEFAULT 'PENDING'::character varying,
    retry_count integer DEFAULT 0,
    scheduled_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notification_queue OWNER TO aiims_hrms;

--
-- Name: payroll_export_log; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.payroll_export_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    export_from date NOT NULL,
    export_to date NOT NULL,
    export_type character varying(20) NOT NULL,
    exported_by uuid NOT NULL,
    file_path text,
    record_count integer,
    summary jsonb,
    exported_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payroll_export_log OWNER TO aiims_hrms;

--
-- Name: salary_structures; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.salary_structures (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.salary_structures OWNER TO aiims_hrms;

--
-- Name: token_blacklist; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.token_blacklist (
    jti uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.token_blacklist OWNER TO aiims_hrms;

--
-- Name: users; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    employee_id uuid,
    role character varying(30) NOT NULL,
    is_active boolean DEFAULT true,
    must_change_password boolean DEFAULT false,
    tokens_valid_from timestamp with time zone DEFAULT now() NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone
);


ALTER TABLE public.users OWNER TO aiims_hrms;

--
-- Name: workflow_configs; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.workflow_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    config_name character varying(200) NOT NULL,
    category_id uuid,
    leave_type_id uuid,
    min_days integer DEFAULT 1,
    max_days integer,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_configs OWNER TO aiims_hrms;

--
-- Name: workflow_steps; Type: TABLE; Schema: public; Owner: aiims_hrms
--

CREATE TABLE public.workflow_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    config_id uuid NOT NULL,
    step_order integer NOT NULL,
    approver_role character varying(50) NOT NULL,
    approver_office character varying(50),
    specific_approver_id uuid,
    sla_hours integer DEFAULT 48,
    is_final_authority boolean DEFAULT false,
    skip_if_self_applicant boolean DEFAULT true,
    escalation_rule jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_steps OWNER TO aiims_hrms;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.alembic_version (version_num) FROM stdin;
0003_nodal_routing
\.


--
-- Data for Name: attendance_raw; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.attendance_raw (id, employee_id, punch_in, punch_out, source, device_id, imported_at) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.audit_log (id, actor_id, entity_type, entity_id, action, before_state, after_state, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: audit_log_2026; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.audit_log_2026 (id, actor_id, entity_type, entity_id, action, before_state, after_state, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: audit_log_2027; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.audit_log_2027 (id, actor_id, entity_type, entity_id, action, before_state, after_state, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.departments (id, code, name, parent_dept_id, managing_office, created_at) FROM stdin;
f3fa088d-b84c-4d1f-8dd1-f63406880764	TEST_DEPT	Test Department	\N	\N	2026-06-26 18:20:24.689199+05:30
cf79d117-70a1-433c-b1f0-2122ab76a133	TDEPT01	testDept1	\N	\N	2026-06-26 18:20:27.763714+05:30
ceaaf00e-635d-4872-862f-1c29dd43fcb4	TDEPT02	testDept2	\N	\N	2026-06-26 18:20:27.763714+05:30
c2b158e2-c0df-4db6-b12f-778edaa22ef0	TDEPT03	testDept3	\N	\N	2026-06-26 18:20:27.763714+05:30
13e6e41c-e084-48ab-8f94-de7b54e7c8df	TDEPT04	testDept4	\N	\N	2026-06-26 18:20:27.763714+05:30
49e1504b-1cd4-47c6-a340-7557a5f285bc	TDEPT05	testDept5	\N	\N	2026-06-26 18:20:27.763714+05:30
b4ba2298-016f-4942-86ad-a14f9f1ffe3f	TDEPT06	testDept6	\N	\N	2026-06-26 18:20:27.763714+05:30
c395bab5-6a5f-4a78-8302-46605404b1f6	TDEPT07	testDept7	\N	\N	2026-06-26 18:20:27.763714+05:30
c79aa4bd-417a-4719-9bcd-b6722ca0af85	TDEPT08	testDept8	\N	\N	2026-06-26 18:20:27.763714+05:30
be8d6a4f-8ecd-45b4-9b68-a7261c0f6810	TDEPT09	testDept9	\N	\N	2026-06-26 18:20:27.763714+05:30
d990c96c-ed05-4735-8ab2-0a095b2bbfa9	TDEPT10	testDept10	\N	\N	2026-06-26 18:20:27.763714+05:30
\.


--
-- Data for Name: dept_nodal_assignments; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.dept_nodal_assignments (id, department_id, nodal_user_id, is_active, assigned_at, assigned_by) FROM stdin;
7eb59304-d418-4a0c-a3b1-afbe3cfddd27	cf79d117-70a1-433c-b1f0-2122ab76a133	af422af2-5210-42a5-b228-426ecaaed680	t	2026-06-26 18:20:27.763714+05:30	\N
03e50373-49cf-45fe-8037-1c3e1688aa38	ceaaf00e-635d-4872-862f-1c29dd43fcb4	ee9b1b0c-2305-41bc-83af-4c95cf688110	t	2026-06-26 18:20:27.763714+05:30	\N
3dde237c-7b8e-4552-a706-3f12fb1f4bc6	c2b158e2-c0df-4db6-b12f-778edaa22ef0	fef71925-0d19-4cf5-968e-d64406c9c70a	t	2026-06-26 18:20:27.763714+05:30	\N
ff62bfdf-72bc-4bf2-9210-b66ae993d45f	13e6e41c-e084-48ab-8f94-de7b54e7c8df	672c14c3-52af-4963-a118-3f016b51e3e4	t	2026-06-26 18:20:27.763714+05:30	\N
c5f7923c-5d2f-44bf-b458-04f82a4e3e18	49e1504b-1cd4-47c6-a340-7557a5f285bc	17915ee7-673d-470f-8edd-084814efa5f8	t	2026-06-26 18:20:27.763714+05:30	\N
a505b5a0-37a4-481b-a548-96984d2bb78e	b4ba2298-016f-4942-86ad-a14f9f1ffe3f	fedcb133-7814-4e62-9264-41b2beeea60b	t	2026-06-26 18:20:27.763714+05:30	\N
7998371d-f528-4ec4-bf1c-158afeb8a174	c395bab5-6a5f-4a78-8302-46605404b1f6	bb9aa3df-1970-412f-a794-8d155a802295	t	2026-06-26 18:20:27.763714+05:30	\N
2fb23329-d057-4cbb-b58f-99e48d92cbf7	c79aa4bd-417a-4719-9bcd-b6722ca0af85	a1fd2c04-4a8a-43d9-b61b-00732b6994c2	t	2026-06-26 18:20:27.763714+05:30	\N
af2e4684-ec66-4be4-b123-3b41f6b29274	be8d6a4f-8ecd-45b4-9b68-a7261c0f6810	b78bff26-ac78-49aa-b9e3-6b7ad5a2eab3	t	2026-06-26 18:20:27.763714+05:30	\N
ca0d1571-ccf7-4a89-be88-c8fee404b2c4	d990c96c-ed05-4735-8ab2-0a095b2bbfa9	3dfa1116-d0b0-4266-b22c-a2047c17c901	t	2026-06-26 18:20:27.763714+05:30	\N
\.


--
-- Data for Name: designations; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.designations (id, name, grade_pay_level, category_id, created_at) FROM stdin;
bfbad695-d29d-48ee-a596-13a728885db1	Test Staff	Level 10	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:24.689199+05:30
0a5f2fc3-0655-44ec-970d-781105d07cef	testDesig1	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
b669cb2a-044d-4439-b8df-3b144f2cf512	testDesig2	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
7382592e-8de4-48ec-83a4-9cd181147c1b	testDesig3	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
8aac4d0d-61bc-4fd7-95eb-9516baa86a0c	testDesig4	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
2504e2d3-6d4e-4546-8a45-79aec0c64dcd	testDesig5	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
2bebcc06-247a-4c92-931b-e8552b10e47a	testDesig6	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
47d32d3a-4dcb-4b76-acef-60a1d4f65de6	testDesig7	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
fb19320f-13bc-4b53-82b5-cb37b4070ab1	testDesig8	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
a4199753-71a7-4763-b3f5-e64ce7ca51ca	testDesig9	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
6364679a-b84d-40fc-bd38-aa7bdfd8baa0	testDesig10	Level 7	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	2026-06-26 18:20:27.763714+05:30
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.email_templates (id, event_code, subject_template, body_template, is_active, updated_at) FROM stdin;
e3437cee-2592-4795-9f5a-d5cffd30184b	APP_SUBMITTED	Leave Application Submitted — {{app_number}}	<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been submitted successfully.</p><p><strong>Leave Type:</strong> {{leave_type}}<br><strong>Dates:</strong> {{from_date}} to {{to_date}} ({{days}} days)<br><strong>Status:</strong> {{status}}</p><p>You will be notified when your application is reviewed.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
7ca8d2e3-02a7-4c41-b9e3-52252468f169	APP_APPROVED	Leave Application Approved — {{app_number}}	<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been <strong>APPROVED</strong>.</p><p><strong>Leave Type:</strong> {{leave_type}}<br><strong>Dates:</strong> {{from_date}} to {{to_date}} ({{days}} days)</p><p>You may download your leave sanction copy from the HRMS portal.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
fbd54b7c-14b1-4b6b-8567-9412d7c08648	APP_REJECTED	Leave Application Rejected — {{app_number}}	<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been <strong>REJECTED</strong>.</p><p><strong>Remarks:</strong> {{remarks}}</p><p>Please contact your approving authority for further clarification.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
d575399a-1f1a-49dc-a824-f095db724b22	APP_MODIFIED	Leave Application Modified — {{app_number}}	<p>Dear {{employee_name}},</p><p>Your leave application <strong>{{app_number}}</strong> has been <strong>MODIFIED</strong> by the approving authority.</p><p><strong>Original Dates:</strong> {{original_from}} to {{original_to}}<br><strong>Modified Dates:</strong> {{modified_from}} to {{modified_to}}</p><p>Please review the changes on the HRMS portal.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
1871b9c1-44b7-4603-84f8-d157dfaafabf	APP_WITHDRAWN	Leave Application Withdrawn — {{app_number}}	<p>Dear Sir/Madam,</p><p>Leave application <strong>{{app_number}}</strong> submitted by <strong>{{employee_name}}</strong> has been <strong>WITHDRAWN</strong>.</p><p>No further action is required.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
575ed531-4fe4-4a09-9594-e4a5cccf18cd	APPROVAL_REQUEST	Leave Approval Request — {{app_number}} — {{employee_name}}	<p>Dear {{approver_name}},</p><p>A leave application requires your approval.</p><p><strong>Application:</strong> {{app_number}}<br><strong>Employee:</strong> {{employee_name}} ({{emp_code}})<br><strong>Leave Type:</strong> {{leave_type}}<br><strong>Dates:</strong> {{from_date}} to {{to_date}} ({{days}} days)<br><strong>Reason:</strong> {{reason}}</p><p>Please log in to the HRMS portal to take action.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
c31d4477-4208-41a8-956e-f8a850c0ec14	SLA_BREACH	ACTION REQUIRED — Leave Application {{app_number}} pending beyond SLA	<p>Dear {{approver_name}},</p><p>Leave application <strong>{{app_number}}</strong> from <strong>{{employee_name}}</strong> has been pending your approval for <strong>{{pending_hours}} hours</strong> (SLA: {{sla_hours}} hours).</p><p>Please take immediate action on the HRMS portal.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
12528d78-1d2e-443b-8d3f-b2e133c72d4d	BALANCE_LOW	Low Leave Balance Alert — {{leave_type}}	<p>Dear {{employee_name}},</p><p>Your <strong>{{leave_type}}</strong> balance is running low.</p><p><strong>Current Balance:</strong> {{balance}} days</p><p>Please plan your leave applications accordingly.</p><p>— AIIMS HRMS, Bibinagar</p>	t	2026-06-26 18:20:14.524589+05:30
\.


--
-- Data for Name: employee_categories; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.employee_categories (id, code, name, leave_scheme, tenure_based, tenure_months, created_at) FROM stdin;
7d99279a-fb9f-4356-89bf-ed11e4230624	FACULTY	Faculty	CCS	f	\N	2026-06-26 18:20:14.460034+05:30
009d6781-541f-453e-a607-683a8c7d5469	NURSING	Nursing Staff	CCS	f	\N	2026-06-26 18:20:14.460034+05:30
3eec8c76-a337-4bf9-a044-c892b4ccc2ab	ADMIN	Non-Faculty / Administration	CCS	f	\N	2026-06-26 18:20:14.460034+05:30
c10d5d48-df04-450a-a022-3a12cd76ae8c	JR_ACAD	Junior Resident (Academic)	RESIDENCY	t	36	2026-06-26 18:20:14.460034+05:30
a31b05bf-fb35-4111-b1ab-0c78d7642c7b	SR_ACAD	Senior Resident (Academic)	RESIDENCY	t	36	2026-06-26 18:20:14.460034+05:30
3b74d066-521e-4b52-bdd4-f9d36745678a	JR_NA	Junior Resident (Non-Academic)	RESIDENCY	t	6	2026-06-26 18:20:14.460034+05:30
fecbd44e-e3c1-4288-94f7-6ba09f19f10c	SR_NA	Senior Resident (Non-Academic)	RESIDENCY	t	6	2026-06-26 18:20:14.460034+05:30
\.


--
-- Data for Name: employee_salary_assignments; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.employee_salary_assignments (id, employee_id, structure_id, basic_pay, pay_level, grade_pay, effective_from, increment_due_date, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.employees (id, emp_code, name, gender, dob, doj, category_id, department_id, designation_id, reporting_officer_id, email, has_institutional_email, personal_email, is_active, created_at, updated_at) FROM stdin;
d2151ea7-9dc9-4009-a560-bbf33d604b1a	TEST_STAFF	Staff User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	staff@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
3d90ea83-a90f-4b96-a17e-5bb0994664ea	TEST_HOD	HOD User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	hod@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
802c8cce-d5a3-43b1-8131-e71ea96629a3	TEST_ESTAB	Estab User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	estab@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
e8808390-f6e4-4875-96fb-1a2905f37e0d	TEST_REGISTRAR	Registrar User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	registrar@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
8c3f58c6-7d42-4099-8055-e3db4c388934	TEST_DEAN	Dean User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	dean@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
f33aef5b-06ce-46d5-98e0-cf7efc18c6b4	TEST_DIRECTOR	Director User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	director@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
700b79a6-0214-48f8-ba60-a8c59e06a18d	TEST_ADMIN	Admin User	Other	\N	2020-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	f3fa088d-b84c-4d1f-8dd1-f63406880764	bfbad695-d29d-48ee-a596-13a728885db1	\N	admin@test.com	t	\N	t	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30
29c34c26-3313-4364-966f-bb0482529f11	THOD01	HOD User 1	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	cf79d117-70a1-433c-b1f0-2122ab76a133	0a5f2fc3-0655-44ec-970d-781105d07cef	\N	hod1@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
ad9ca074-5a51-4b8a-bf1e-ebf630efeafd	THOD02	HOD User 2	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	ceaaf00e-635d-4872-862f-1c29dd43fcb4	b669cb2a-044d-4439-b8df-3b144f2cf512	\N	hod2@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
96b5e3d0-cb19-43da-8607-a2b974f6b775	THOD03	HOD User 3	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c2b158e2-c0df-4db6-b12f-778edaa22ef0	7382592e-8de4-48ec-83a4-9cd181147c1b	\N	hod3@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
009423de-d6ba-4fa2-9321-d8716d7def36	THOD04	HOD User 4	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	13e6e41c-e084-48ab-8f94-de7b54e7c8df	8aac4d0d-61bc-4fd7-95eb-9516baa86a0c	\N	hod4@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
ac2ae1f8-1d4d-4103-a2f8-e67eb1c391ed	THOD05	HOD User 5	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	49e1504b-1cd4-47c6-a340-7557a5f285bc	2504e2d3-6d4e-4546-8a45-79aec0c64dcd	\N	hod5@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
8b7196f6-bf7e-4b75-999f-6c31959aab56	THOD06	HOD User 6	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	b4ba2298-016f-4942-86ad-a14f9f1ffe3f	2bebcc06-247a-4c92-931b-e8552b10e47a	\N	hod6@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
6bacdc08-af9c-4f0a-888c-837514cbb238	THOD07	HOD User 7	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c395bab5-6a5f-4a78-8302-46605404b1f6	47d32d3a-4dcb-4b76-acef-60a1d4f65de6	\N	hod7@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
cef59df6-3368-4158-a728-551ffcba72fc	THOD08	HOD User 8	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c79aa4bd-417a-4719-9bcd-b6722ca0af85	fb19320f-13bc-4b53-82b5-cb37b4070ab1	\N	hod8@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
b040d4e3-3dae-4c84-ad07-fc258c2ef9fa	THOD09	HOD User 9	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	be8d6a4f-8ecd-45b4-9b68-a7261c0f6810	a4199753-71a7-4763-b3f5-e64ce7ca51ca	\N	hod9@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
36603938-3ef9-4b71-83f7-c8e55c2514fb	THOD10	HOD User 10	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	d990c96c-ed05-4735-8ab2-0a095b2bbfa9	6364679a-b84d-40fc-bd38-aa7bdfd8baa0	\N	hod10@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
d2d3d271-5686-4d2e-a8a7-dc4690a04f6a	TNDL01	Nodal Officer 1	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	cf79d117-70a1-433c-b1f0-2122ab76a133	0a5f2fc3-0655-44ec-970d-781105d07cef	\N	nodal1@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
6e266c3a-c081-4da3-9815-bdef4aec6162	TNDL02	Nodal Officer 2	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	ceaaf00e-635d-4872-862f-1c29dd43fcb4	b669cb2a-044d-4439-b8df-3b144f2cf512	\N	nodal2@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
92c36345-43c2-4b40-b168-5aefe6895a17	TNDL03	Nodal Officer 3	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c2b158e2-c0df-4db6-b12f-778edaa22ef0	7382592e-8de4-48ec-83a4-9cd181147c1b	\N	nodal3@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
f0fccaa8-d333-4348-8e25-54ee9677b246	TNDL04	Nodal Officer 4	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	13e6e41c-e084-48ab-8f94-de7b54e7c8df	8aac4d0d-61bc-4fd7-95eb-9516baa86a0c	\N	nodal4@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
a38e570e-36c7-41ab-a3ac-a91ad7366a0a	TNDL05	Nodal Officer 5	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	49e1504b-1cd4-47c6-a340-7557a5f285bc	2504e2d3-6d4e-4546-8a45-79aec0c64dcd	\N	nodal5@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
40605b2c-e72f-4b07-b16d-cf50c3df526e	TNDL06	Nodal Officer 6	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	b4ba2298-016f-4942-86ad-a14f9f1ffe3f	2bebcc06-247a-4c92-931b-e8552b10e47a	\N	nodal6@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
18547112-8f4a-48dd-beea-323d7ed14612	TNDL07	Nodal Officer 7	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c395bab5-6a5f-4a78-8302-46605404b1f6	47d32d3a-4dcb-4b76-acef-60a1d4f65de6	\N	nodal7@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
1a1c5ba7-8732-4a1c-b22a-caddffe60332	TNDL08	Nodal Officer 8	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c79aa4bd-417a-4719-9bcd-b6722ca0af85	fb19320f-13bc-4b53-82b5-cb37b4070ab1	\N	nodal8@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
d5b89ff2-6412-4ee0-a0a0-803f842a9a50	TNDL09	Nodal Officer 9	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	be8d6a4f-8ecd-45b4-9b68-a7261c0f6810	a4199753-71a7-4763-b3f5-e64ce7ca51ca	\N	nodal9@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
94a4f78c-9e3d-49af-9351-67b5bf99cfe4	TNDL10	Nodal Officer 10	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	d990c96c-ed05-4735-8ab2-0a095b2bbfa9	6364679a-b84d-40fc-bd38-aa7bdfd8baa0	\N	nodal10@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
26a8919d-68eb-498d-9466-875738f168de	TSTAFF01	Staff User 1	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	cf79d117-70a1-433c-b1f0-2122ab76a133	0a5f2fc3-0655-44ec-970d-781105d07cef	\N	staff1@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
76887def-2ad1-4ab7-9d5d-92c98ff84a14	TSTAFF02	Staff User 2	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	ceaaf00e-635d-4872-862f-1c29dd43fcb4	b669cb2a-044d-4439-b8df-3b144f2cf512	\N	staff2@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
96605df7-62c6-4d2b-90e6-2d1656e49d2d	TSTAFF03	Staff User 3	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c2b158e2-c0df-4db6-b12f-778edaa22ef0	7382592e-8de4-48ec-83a4-9cd181147c1b	\N	staff3@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
8ccce077-d9aa-49ac-8af9-ff203344f996	TSTAFF04	Staff User 4	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	13e6e41c-e084-48ab-8f94-de7b54e7c8df	8aac4d0d-61bc-4fd7-95eb-9516baa86a0c	\N	staff4@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
e8e41ece-f076-4bf0-b284-a728fa80190d	TSTAFF05	Staff User 5	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	49e1504b-1cd4-47c6-a340-7557a5f285bc	2504e2d3-6d4e-4546-8a45-79aec0c64dcd	\N	staff5@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
393c6b48-eda9-40d7-8a4a-48025b0ae7f7	TSTAFF06	Staff User 6	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	b4ba2298-016f-4942-86ad-a14f9f1ffe3f	2bebcc06-247a-4c92-931b-e8552b10e47a	\N	staff6@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
cf5738df-4162-4ce0-bb31-5a5b8d3638b9	TSTAFF07	Staff User 7	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c395bab5-6a5f-4a78-8302-46605404b1f6	47d32d3a-4dcb-4b76-acef-60a1d4f65de6	\N	staff7@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
e00cec16-7212-4787-8970-71784f66fff8	TSTAFF08	Staff User 8	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	c79aa4bd-417a-4719-9bcd-b6722ca0af85	fb19320f-13bc-4b53-82b5-cb37b4070ab1	\N	staff8@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
5bff0e45-9ad6-4c8c-ac2d-1c4d893feb5d	TSTAFF09	Staff User 9	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	be8d6a4f-8ecd-45b4-9b68-a7261c0f6810	a4199753-71a7-4763-b3f5-e64ce7ca51ca	\N	staff9@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
7fb891be-2993-49c8-adf1-3d5061e6893c	TSTAFF10	Staff User 10	Other	\N	2022-01-01	3eec8c76-a337-4bf9-a044-c892b4ccc2ab	d990c96c-ed05-4735-8ab2-0a095b2bbfa9	6364679a-b84d-40fc-bd38-aa7bdfd8baa0	\N	staff10@test.aiims	t	\N	t	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30
\.


--
-- Data for Name: holiday_master; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.holiday_master (id, year, holiday_date, holiday_name, holiday_type, applicable_to, created_at) FROM stdin;
\.


--
-- Data for Name: leave_applications; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.leave_applications (id, app_number, config_id, employee_id, leave_type_id, from_date, to_date, applied_days, is_half_day, half_day_session, reason, address_during_leave, status, acting_arrangement_emp_id, current_step_order, submitted_at, last_action_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: leave_approvals; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.leave_approvals (id, application_id, step_id, approver_id, step_order, action, remarks, modified_from_date, modified_to_date, modified_days, acted_at) FROM stdin;
\.


--
-- Data for Name: leave_balances; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited, availed, lop_days, last_updated) FROM stdin;
\.


--
-- Data for Name: leave_documents; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.leave_documents (id, application_id, doc_type, file_path, original_filename, file_size_kb, uploaded_by, uploaded_at) FROM stdin;
\.


--
-- Data for Name: leave_entitlement_rules; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.leave_entitlement_rules (id, category_id, leave_type_id, year_ref, days_per_year, prorata_rate, year1_days, year2_plus_days, max_at_a_stretch, max_in_tenure, carry_forward, special_rules, created_at) FROM stdin;
\.


--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.leave_types (id, code, name, scheme, is_accumulating, max_accumulation, requires_mc, min_days_for_mc, count_holidays, is_half_day_allowed, carry_forward, encashable, validation_rules, created_at) FROM stdin;
\.


--
-- Data for Name: notification_queue; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.notification_queue (id, application_id, recipient_id, channel, subject, body, status, retry_count, scheduled_at, sent_at, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: payroll_export_log; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.payroll_export_log (id, export_from, export_to, export_type, exported_by, file_path, record_count, summary, exported_at) FROM stdin;
\.


--
-- Data for Name: salary_structures; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.salary_structures (id, code, name, description, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: token_blacklist; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.token_blacklist (jti, user_id, expires_at, created_at) FROM stdin;
1e1406bc-047c-422a-9043-97ea97b15b8c	7c68f8e9-a76c-45bd-ae0a-2f09d44dcf1c	2026-06-28 17:42:15.653138+05:30	2026-06-28 15:12:15.652056+05:30
4faf5a43-04b0-478b-a80f-4fe1bbae6046	0c7408dc-93d4-44e1-b1e3-31a085462262	2026-06-28 18:16:47.221038+05:30	2026-06-28 15:46:47.220232+05:30
9c157022-0205-4bea-8050-14aea80b243e	0c7408dc-93d4-44e1-b1e3-31a085462262	2026-06-28 18:22:57.262647+05:30	2026-06-28 15:52:57.261334+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.users (id, username, password_hash, employee_id, role, is_active, must_change_password, tokens_valid_from, last_login, created_at, updated_at, failed_login_attempts, locked_until) FROM stdin;
2a13c221-3ac8-4d0d-9957-6f2b4d65a8c9	workflow_seed_admin	$2b$12$MP7pMwOkvCTnmjsRbw60JuPt9QnDNaETgGGQhtFLB5boI1/7D5gHG	\N	ADMIN	f	f	2026-06-26 18:20:24.258124+05:30	\N	2026-06-26 18:20:24.258124+05:30	2026-06-26 18:20:24.258124+05:30	0	\N
5e00d7ad-a32e-466b-8f1f-0b57a85a1e3f	staff	$2b$12$BXtmyvXeqSaDyQ4qBmUBK.wadFv28LU5yg09zoTtDyXc07HA/RjQa	d2151ea7-9dc9-4009-a560-bbf33d604b1a	STAFF	t	t	2026-06-26 18:20:24.689199+05:30	\N	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30	0	\N
77d1252a-45b6-4e8a-bcea-cefe56fabf24	hod	$2b$12$Dn2u11IFd9hgBl7Yi6D6k.JW9YcrHt8gPYiiFIbzfrhQENJwVYp/e	3d90ea83-a90f-4b96-a17e-5bb0994664ea	HOD	t	f	2026-06-26 18:20:24.689199+05:30	\N	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30	0	\N
b041fe16-7cab-4ea5-9204-922325fcb955	estab	$2b$12$H7mhiiT8fHZ/1flDao2IS.P2QnOam4VT1.dASUNlUZfdAdBkt/3Zi	802c8cce-d5a3-43b1-8131-e71ea96629a3	ESTABLISHMENT_OFFICER	t	f	2026-06-26 18:20:24.689199+05:30	\N	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30	0	\N
ea9c1f87-86e8-4648-83d5-785267fd6c86	registrar	$2b$12$gaDhSgp7vNu3GO1rFiB6HOinOCiQn/JriBXgtN7LQqkACMTlUWeo2	e8808390-f6e4-4875-96fb-1a2905f37e0d	REGISTRAR	t	f	2026-06-26 18:20:24.689199+05:30	\N	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30	0	\N
0fe2f76a-291a-4be8-a46d-68c488d077ac	dean	$2b$12$JxJY2dO4wutpplvvFfbB7u9q3QPygjCXX1.g6DwMAJ.b/X0AfdtMy	8c3f58c6-7d42-4099-8055-e3db4c388934	DEAN_ACADEMIC	t	f	2026-06-26 18:20:24.689199+05:30	\N	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30	0	\N
d9c5d805-9a5f-4b56-9d31-21712336f8e5	director	$2b$12$xraFcBmoQ11d.hkkgILmiuJ606PIPuLGrahKY9X./kbVGnlx9c5Fu	f33aef5b-06ce-46d5-98e0-cf7efc18c6b4	DIRECTOR	t	f	2026-06-26 18:20:24.689199+05:30	\N	2026-06-26 18:20:24.689199+05:30	2026-06-26 18:20:24.689199+05:30	0	\N
bc4be9fe-1088-46b3-8583-51668ce2025a	testHod2	$2b$12$hXVv35SByCd/uBM5z5ErjuZbpsZbETdxFKdzouN08X/v/Jpw8CobG	ad9ca074-5a51-4b8a-bf1e-ebf630efeafd	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
0057a1fd-6731-4758-b7c2-e237919c63ec	testHod3	$2b$12$7z6vo6oA5IiHdsKirFLNNue5GF0/5Xehxaltyt1mrzSTb6IuGFMuK	96b5e3d0-cb19-43da-8607-a2b974f6b775	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
ca601f1a-420e-454b-892e-89148b5cf633	testHod4	$2b$12$EZ2L4A3iRfp3/JLF151ABuwnIPD82GDboKcRNs4iW3acldwszCYZ2	009423de-d6ba-4fa2-9321-d8716d7def36	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
a72ce70d-79cb-4f85-a642-1a49575b5d27	testHod5	$2b$12$xjyZd3BIYLz6Yb7ASy/a...5jYo12Zi9ppavQNIyv.dTzp.Pcg1gO	ac2ae1f8-1d4d-4103-a2f8-e67eb1c391ed	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
6aab1bd5-5d9d-4cec-8679-68f205d9f604	testHod6	$2b$12$ePbMxJ7uvyC19aesx7oRZeQ2BJJrQiTFMAA0LKaKj/mCbOJWRiu8a	8b7196f6-bf7e-4b75-999f-6c31959aab56	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
f315fac6-1ef3-4cdc-b9a5-a19cc5bf1861	testHod7	$2b$12$MaRKdZYaR.FzGLfxQ1RtRu9wSKflQNUVYyMdG0ABBkQ0q7xVyNiTe	6bacdc08-af9c-4f0a-888c-837514cbb238	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
4bed0cde-d45e-4747-9364-754ef0063646	testHod8	$2b$12$gFzzqxsh2SR0ITMsiAsiLOlGIVfI1c4Op6YHx2I9aS9HAbJ.3PvyO	cef59df6-3368-4158-a728-551ffcba72fc	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
891a790d-75af-4117-adfa-4e133d260f02	testHod9	$2b$12$OfY.48FRuuChR55ebc7RpuZWqkH6qK8LYqowVVNKC6.sTjSoioYxu	b040d4e3-3dae-4c84-ad07-fc258c2ef9fa	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
2f7360a4-0f0f-436f-b990-d10a3e5d0173	testHod10	$2b$12$AKn6kJ2L/g9PEwPeI4Gs9O/jqvH.mOyz9gxfHxX3dSUaFBq7ZiQca	36603938-3ef9-4b71-83f7-c8e55c2514fb	HOD	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
ee9b1b0c-2305-41bc-83af-4c95cf688110	testNodal2	$2b$12$7P/Y3hs/inW.DemUIsu03uM2Ha1QNiiFCWljT3wmXjKNpwiwAOeLK	6e266c3a-c081-4da3-9815-bdef4aec6162	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
fef71925-0d19-4cf5-968e-d64406c9c70a	testNodal3	$2b$12$02hlnvnabTVFM.VKA5K/GezdpSPzBeyEtHG1bVDmYnQpLd82jFpea	92c36345-43c2-4b40-b168-5aefe6895a17	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
672c14c3-52af-4963-a118-3f016b51e3e4	testNodal4	$2b$12$oHrJO7BBGmSL4Bh0fCm5x.6FSVV0DSgyfDHEr19aVA1F3NMkSsrEC	f0fccaa8-d333-4348-8e25-54ee9677b246	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
17915ee7-673d-470f-8edd-084814efa5f8	testNodal5	$2b$12$.dIKXYNon1rjYV/BB0Nx0.PGbJv5Dmlyj3kqy1ccyORv.9Q9Bi46q	a38e570e-36c7-41ab-a3ac-a91ad7366a0a	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
fedcb133-7814-4e62-9264-41b2beeea60b	testNodal6	$2b$12$fnWDB3tP1mtAUu4IjAXwbec7/xTwzr3s6djlVnv83H8sTdweYhkLa	40605b2c-e72f-4b07-b16d-cf50c3df526e	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
bb9aa3df-1970-412f-a794-8d155a802295	testNodal7	$2b$12$ZW8smwykFPllWd863Igj7uGHhkYNgsZF0InmuT94V61.8Z4oSgbmu	18547112-8f4a-48dd-beea-323d7ed14612	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
a1fd2c04-4a8a-43d9-b61b-00732b6994c2	testNodal8	$2b$12$/57iR4rSNWg0nRlHONthX.bMk9eTMNo2U.HjA3pA5eRdGkLcy9Vby	1a1c5ba7-8732-4a1c-b22a-caddffe60332	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
b78bff26-ac78-49aa-b9e3-6b7ad5a2eab3	testNodal9	$2b$12$jPg4BAPDbsPz/bDER43jRu9CBqIsQ3RppqYDKTAjnszoge9o7Rs6K	d5b89ff2-6412-4ee0-a0a0-803f842a9a50	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
3dfa1116-d0b0-4266-b22c-a2047c17c901	testNodal10	$2b$12$FyryiP6jsw01p7YomYnQ2epBTNIHw43nB8Rd4EuG4wbatYO9GESpa	94a4f78c-9e3d-49af-9351-67b5bf99cfe4	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
ad297768-c267-4fa6-8a34-76112c841335	testStaff2	$2b$12$m9k23advUQR24vtqLCoiBORlhCAbSRrAmr/MuDpoJJg2toZqWXq4u	76887def-2ad1-4ab7-9d5d-92c98ff84a14	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
d9a39761-aafc-411a-a0d5-dcf0f075e9ed	testStaff3	$2b$12$AlamkVExIsKpW8wXwKvike6VvVb7QcjWP.B7YMecdPWwb9Xa1KwKm	96605df7-62c6-4d2b-90e6-2d1656e49d2d	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
a5b25797-8230-40f8-8e11-1ca1d3cc9a6e	testStaff4	$2b$12$DlWbUzGKxJTBZPz7b4qfDOq4M/jTrR5/KsOXXtG8suNVLJebpd2Ri	8ccce077-d9aa-49ac-8af9-ff203344f996	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
872b6cc2-b79b-4d76-8aa9-7c7edfe5aa76	testStaff5	$2b$12$Dj.bH1f5AlB501rUYcthCOJ6Au.BfN4Zip.4evLRJIYfbEM.R.0/i	e8e41ece-f076-4bf0-b284-a728fa80190d	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
365b122d-a2f2-4b2e-97a2-9d36a4f7ea1e	testStaff6	$2b$12$kw.gr1f7jQpD8slWRwhrXuClLKC/77I4CAMYWsTNbdoSUPEzydD3y	393c6b48-eda9-40d7-8a4a-48025b0ae7f7	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
eecaa383-84fd-4b6b-bbda-eea40333ea01	testStaff7	$2b$12$gv4lY1Dk.z/Dw41vSY/Nr.6AIcoxRpxIYQfFB1zaMS3C4DyD4IuEG	cf5738df-4162-4ce0-bb31-5a5b8d3638b9	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
2cb745cb-9cd2-46c0-afc7-8db42644d38d	testStaff8	$2b$12$.iwJ/LtbpR9fL2g6Z0hY..Dd3STJABPfuQB1N70kfjeQWyaXxHoqS	e00cec16-7212-4787-8970-71784f66fff8	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
58e3586b-b2bf-4f76-988e-751a5455de05	testStaff9	$2b$12$tDzS4hip1vHxUEuMUGAgrel7FwurrIsSKcqgGRM6N1p.KRKncmk1S	5bff0e45-9ad6-4c8c-ac2d-1c4d893feb5d	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
5b4cb957-3a9e-44c7-86dc-de50c11a0490	testStaff10	$2b$12$nkoOc/RiH0VDmKMFJrmPgeii7OE9KKH307VnZCJNIAoaI7a2EbIJG	7fb891be-2993-49c8-adf1-3d5061e6893c	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	\N	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
af422af2-5210-42a5-b228-426ecaaed680	testNodal1	$2b$12$MjWYL6LCG5Lq4stsNlNxPe5XgSrnOKyh.213lRWLcwAazxjsRLY0C	d2d3d271-5686-4d2e-a8a7-dc4690a04f6a	NODAL_OFFICER	t	f	2026-06-26 18:20:27.763714+05:30	2026-06-27 16:05:36.778315+05:30	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
2d238cd6-bcd8-408d-9db3-4ee4b8b852fc	testStaff1	$2b$12$90GvOXRRvrTZMCv/cNjHI.gRGPWWk1cNosa7RLhOuJNCNiaZx5TwK	26a8919d-68eb-498d-9466-875738f168de	STAFF	t	f	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:25:20.265713+05:30	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:25:08.504254+05:30	0	\N
7c68f8e9-a76c-45bd-ae0a-2f09d44dcf1c	testHod1	$2b$12$tzkO1GuDi.G2wV.2dw75fuKGL3D14Vc560mKjcjLkxRdWKvlzfweS	29c34c26-3313-4364-966f-bb0482529f11	HOD	t	f	2026-06-26 18:20:27.763714+05:30	2026-06-28 14:54:57.314018+05:30	2026-06-26 18:20:27.763714+05:30	2026-06-26 18:20:27.763714+05:30	0	\N
0c7408dc-93d4-44e1-b1e3-31a085462262	admin	$2b$12$zV7/ODxDiwc7vo1LxFtPG.mS8P1kbKljmQSXBWcrtoWkey8G23hku	700b79a6-0214-48f8-ba60-a8c59e06a18d	ADMIN	t	f	2026-06-26 18:20:27.763714+05:30	2026-06-28 15:53:18.687937+05:30	2026-06-26 18:20:24.689199+05:30	2026-06-28 15:46:54.422814+05:30	0	\N
\.


--
-- Data for Name: workflow_configs; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.workflow_configs (id, config_name, category_id, leave_type_id, min_days, max_days, is_active, version, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workflow_steps; Type: TABLE DATA; Schema: public; Owner: aiims_hrms
--

COPY public.workflow_steps (id, config_id, step_order, approver_role, approver_office, specific_approver_id, sla_hours, is_final_authority, skip_if_self_applicant, escalation_rule, created_at) FROM stdin;
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: leave_applications no_overlapping_approved_leave; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT no_overlapping_approved_leave EXCLUDE USING gist (employee_id WITH =, daterange(from_date, to_date, '[]'::text) WITH &&) WHERE (((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'UNDER_REVIEW'::character varying, 'APPROVED'::character varying])::text[])));


--
-- Name: attendance_raw pk_attendance_raw; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.attendance_raw
    ADD CONSTRAINT pk_attendance_raw PRIMARY KEY (id);


--
-- Name: audit_log pk_audit_log; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT pk_audit_log PRIMARY KEY (id);


--
-- Name: departments pk_departments; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT pk_departments PRIMARY KEY (id);


--
-- Name: dept_nodal_assignments pk_dept_nodal_assignments; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.dept_nodal_assignments
    ADD CONSTRAINT pk_dept_nodal_assignments PRIMARY KEY (id);


--
-- Name: designations pk_designations; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT pk_designations PRIMARY KEY (id);


--
-- Name: email_templates pk_email_templates; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT pk_email_templates PRIMARY KEY (id);


--
-- Name: employee_categories pk_employee_categories; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employee_categories
    ADD CONSTRAINT pk_employee_categories PRIMARY KEY (id);


--
-- Name: employee_salary_assignments pk_employee_salary_assignments; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT pk_employee_salary_assignments PRIMARY KEY (id);


--
-- Name: employees pk_employees; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT pk_employees PRIMARY KEY (id);


--
-- Name: holiday_master pk_holiday_master; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.holiday_master
    ADD CONSTRAINT pk_holiday_master PRIMARY KEY (id);


--
-- Name: leave_applications pk_leave_applications; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT pk_leave_applications PRIMARY KEY (id);


--
-- Name: leave_approvals pk_leave_approvals; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_approvals
    ADD CONSTRAINT pk_leave_approvals PRIMARY KEY (id);


--
-- Name: leave_balances pk_leave_balances; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT pk_leave_balances PRIMARY KEY (id);


--
-- Name: leave_documents pk_leave_documents; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT pk_leave_documents PRIMARY KEY (id);


--
-- Name: leave_entitlement_rules pk_leave_entitlement_rules; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_entitlement_rules
    ADD CONSTRAINT pk_leave_entitlement_rules PRIMARY KEY (id);


--
-- Name: leave_types pk_leave_types; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT pk_leave_types PRIMARY KEY (id);


--
-- Name: notification_queue pk_notification_queue; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT pk_notification_queue PRIMARY KEY (id);


--
-- Name: payroll_export_log pk_payroll_export_log; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.payroll_export_log
    ADD CONSTRAINT pk_payroll_export_log PRIMARY KEY (id);


--
-- Name: salary_structures pk_salary_structures; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.salary_structures
    ADD CONSTRAINT pk_salary_structures PRIMARY KEY (id);


--
-- Name: token_blacklist pk_token_blacklist; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT pk_token_blacklist PRIMARY KEY (jti);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: workflow_configs pk_workflow_configs; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_configs
    ADD CONSTRAINT pk_workflow_configs PRIMARY KEY (id);


--
-- Name: workflow_steps pk_workflow_steps; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT pk_workflow_steps PRIMARY KEY (id);


--
-- Name: departments uq_departments_code; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uq_departments_code UNIQUE (code);


--
-- Name: dept_nodal_assignments uq_dept_nodal; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.dept_nodal_assignments
    ADD CONSTRAINT uq_dept_nodal UNIQUE (department_id, nodal_user_id);


--
-- Name: designations uq_designations_name; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT uq_designations_name UNIQUE (name);


--
-- Name: email_templates uq_email_templates_event_code; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT uq_email_templates_event_code UNIQUE (event_code);


--
-- Name: employee_categories uq_employee_categories_code; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employee_categories
    ADD CONSTRAINT uq_employee_categories_code UNIQUE (code);


--
-- Name: employee_salary_assignments uq_employee_salary_assignments_employee_id; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT uq_employee_salary_assignments_employee_id UNIQUE (employee_id, effective_from);


--
-- Name: employees uq_employees_emp_code; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT uq_employees_emp_code UNIQUE (emp_code);


--
-- Name: holiday_master uq_holiday_master_holiday_date; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.holiday_master
    ADD CONSTRAINT uq_holiday_master_holiday_date UNIQUE (holiday_date, holiday_type);


--
-- Name: leave_applications uq_leave_applications_app_number; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT uq_leave_applications_app_number UNIQUE (app_number);


--
-- Name: leave_balances uq_leave_balances_employee_id; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT uq_leave_balances_employee_id UNIQUE (employee_id, leave_type_id, leave_year);


--
-- Name: leave_entitlement_rules uq_leave_entitlement_rules_category_id; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_entitlement_rules
    ADD CONSTRAINT uq_leave_entitlement_rules_category_id UNIQUE (category_id, leave_type_id);


--
-- Name: leave_types uq_leave_types_code; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT uq_leave_types_code UNIQUE (code);


--
-- Name: salary_structures uq_salary_structures_code; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.salary_structures
    ADD CONSTRAINT uq_salary_structures_code UNIQUE (code);


--
-- Name: users uq_users_employee_id; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_employee_id UNIQUE (employee_id);


--
-- Name: users uq_users_username; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_username UNIQUE (username);


--
-- Name: workflow_configs uq_workflow_configs_config_name; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_configs
    ADD CONSTRAINT uq_workflow_configs_config_name UNIQUE (config_name, version);


--
-- Name: workflow_steps uq_workflow_steps_config_id; Type: CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT uq_workflow_steps_config_id UNIQUE (config_id, step_order);


--
-- Name: ix_audit_log_actor; Type: INDEX; Schema: public; Owner: aiims_hrms
--

CREATE INDEX ix_audit_log_actor ON public.audit_log USING btree (actor_id);


--
-- Name: ix_audit_log_created_at; Type: INDEX; Schema: public; Owner: aiims_hrms
--

CREATE INDEX ix_audit_log_created_at ON public.audit_log USING btree (created_at);


--
-- Name: ix_audit_log_entity; Type: INDEX; Schema: public; Owner: aiims_hrms
--

CREATE INDEX ix_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: ix_dept_nodal_dept_id; Type: INDEX; Schema: public; Owner: aiims_hrms
--

CREATE INDEX ix_dept_nodal_dept_id ON public.dept_nodal_assignments USING btree (department_id);


--
-- Name: ix_dept_nodal_user_id; Type: INDEX; Schema: public; Owner: aiims_hrms
--

CREATE INDEX ix_dept_nodal_user_id ON public.dept_nodal_assignments USING btree (nodal_user_id);


--
-- Name: ix_token_blacklist_expires_at; Type: INDEX; Schema: public; Owner: aiims_hrms
--

CREATE INDEX ix_token_blacklist_expires_at ON public.token_blacklist USING btree (expires_at);


--
-- Name: audit_log trg_audit_log_no_delete; Type: TRIGGER; Schema: public; Owner: aiims_hrms
--

CREATE TRIGGER trg_audit_log_no_delete BEFORE DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.audit_log_no_mutation();


--
-- Name: audit_log trg_audit_log_no_update; Type: TRIGGER; Schema: public; Owner: aiims_hrms
--

CREATE TRIGGER trg_audit_log_no_update BEFORE UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.audit_log_no_mutation();


--
-- Name: attendance_raw fk_attendance_raw_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.attendance_raw
    ADD CONSTRAINT fk_attendance_raw_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: audit_log fk_audit_log_actor_id_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT fk_audit_log_actor_id_users FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: departments fk_departments_parent_dept_id_departments; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_parent_dept_id_departments FOREIGN KEY (parent_dept_id) REFERENCES public.departments(id);


--
-- Name: dept_nodal_assignments fk_dept_nodal_assignments_assigned_by_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.dept_nodal_assignments
    ADD CONSTRAINT fk_dept_nodal_assignments_assigned_by_users FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: dept_nodal_assignments fk_dept_nodal_assignments_department_id_departments; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.dept_nodal_assignments
    ADD CONSTRAINT fk_dept_nodal_assignments_department_id_departments FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: dept_nodal_assignments fk_dept_nodal_assignments_nodal_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.dept_nodal_assignments
    ADD CONSTRAINT fk_dept_nodal_assignments_nodal_user_id_users FOREIGN KEY (nodal_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: designations fk_designations_category_id_employee_categories; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT fk_designations_category_id_employee_categories FOREIGN KEY (category_id) REFERENCES public.employee_categories(id);


--
-- Name: employee_salary_assignments fk_employee_salary_assignments_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT fk_employee_salary_assignments_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_salary_assignments fk_employee_salary_assignments_structure_id_salary_structures; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employee_salary_assignments
    ADD CONSTRAINT fk_employee_salary_assignments_structure_id_salary_structures FOREIGN KEY (structure_id) REFERENCES public.salary_structures(id);


--
-- Name: employees fk_employees_category_id_employee_categories; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employees_category_id_employee_categories FOREIGN KEY (category_id) REFERENCES public.employee_categories(id);


--
-- Name: employees fk_employees_department_id_departments; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employees_department_id_departments FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees fk_employees_designation_id_designations; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employees_designation_id_designations FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: employees fk_employees_reporting_officer_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employees_reporting_officer_id_employees FOREIGN KEY (reporting_officer_id) REFERENCES public.employees(id);


--
-- Name: leave_applications fk_leave_applications_acting_arrangement_emp_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT fk_leave_applications_acting_arrangement_emp_id_employees FOREIGN KEY (acting_arrangement_emp_id) REFERENCES public.employees(id);


--
-- Name: leave_applications fk_leave_applications_config_id_workflow_configs; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT fk_leave_applications_config_id_workflow_configs FOREIGN KEY (config_id) REFERENCES public.workflow_configs(id);


--
-- Name: leave_applications fk_leave_applications_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT fk_leave_applications_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leave_applications fk_leave_applications_leave_type_id_leave_types; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT fk_leave_applications_leave_type_id_leave_types FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_approvals fk_leave_approvals_application_id_leave_applications; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_approvals
    ADD CONSTRAINT fk_leave_approvals_application_id_leave_applications FOREIGN KEY (application_id) REFERENCES public.leave_applications(id);


--
-- Name: leave_approvals fk_leave_approvals_approver_id_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_approvals
    ADD CONSTRAINT fk_leave_approvals_approver_id_users FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: leave_approvals fk_leave_approvals_step_id_workflow_steps; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_approvals
    ADD CONSTRAINT fk_leave_approvals_step_id_workflow_steps FOREIGN KEY (step_id) REFERENCES public.workflow_steps(id);


--
-- Name: leave_balances fk_leave_balances_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT fk_leave_balances_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leave_balances fk_leave_balances_leave_type_id_leave_types; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT fk_leave_balances_leave_type_id_leave_types FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_documents fk_leave_documents_application_id_leave_applications; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT fk_leave_documents_application_id_leave_applications FOREIGN KEY (application_id) REFERENCES public.leave_applications(id);


--
-- Name: leave_documents fk_leave_documents_uploaded_by_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_documents
    ADD CONSTRAINT fk_leave_documents_uploaded_by_users FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: leave_entitlement_rules fk_leave_entitlement_rules_category_id_employee_categories; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_entitlement_rules
    ADD CONSTRAINT fk_leave_entitlement_rules_category_id_employee_categories FOREIGN KEY (category_id) REFERENCES public.employee_categories(id);


--
-- Name: leave_entitlement_rules fk_leave_entitlement_rules_leave_type_id_leave_types; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.leave_entitlement_rules
    ADD CONSTRAINT fk_leave_entitlement_rules_leave_type_id_leave_types FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: notification_queue fk_notification_queue_application_id_leave_applications; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT fk_notification_queue_application_id_leave_applications FOREIGN KEY (application_id) REFERENCES public.leave_applications(id);


--
-- Name: notification_queue fk_notification_queue_recipient_id_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT fk_notification_queue_recipient_id_users FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: payroll_export_log fk_payroll_export_log_exported_by_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.payroll_export_log
    ADD CONSTRAINT fk_payroll_export_log_exported_by_users FOREIGN KEY (exported_by) REFERENCES public.users(id);


--
-- Name: token_blacklist fk_token_blacklist_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT fk_token_blacklist_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users fk_users_employee_id_employees; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_employee_id_employees FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: workflow_configs fk_workflow_configs_category_id_employee_categories; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_configs
    ADD CONSTRAINT fk_workflow_configs_category_id_employee_categories FOREIGN KEY (category_id) REFERENCES public.employee_categories(id);


--
-- Name: workflow_configs fk_workflow_configs_created_by_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_configs
    ADD CONSTRAINT fk_workflow_configs_created_by_users FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workflow_configs fk_workflow_configs_leave_type_id_leave_types; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_configs
    ADD CONSTRAINT fk_workflow_configs_leave_type_id_leave_types FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: workflow_steps fk_workflow_steps_config_id_workflow_configs; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT fk_workflow_steps_config_id_workflow_configs FOREIGN KEY (config_id) REFERENCES public.workflow_configs(id);


--
-- Name: workflow_steps fk_workflow_steps_specific_approver_id_users; Type: FK CONSTRAINT; Schema: public; Owner: aiims_hrms
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT fk_workflow_steps_specific_approver_id_users FOREIGN KEY (specific_approver_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict GbQ4wfQVbCwYqZXdQf5SGb8Op0Zgso1ctKk7TjrzzPTDmOmeYPThcyxMERiYQLq

