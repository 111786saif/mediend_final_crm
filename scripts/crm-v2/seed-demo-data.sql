-- Demo-only seed data for crm_v2. Providers and connectors remain disabled.

BEGIN;

INSERT INTO crm_v2."StorageProvider" (
  name, provider_type, is_enabled, is_default, local_root_path
)
SELECT 'Demo local storage', 'LOCAL', false, false, 'D:\mediend2\storage'
WHERE NOT EXISTS (
  SELECT 1 FROM crm_v2."StorageProvider" WHERE name = 'Demo local storage'
);

INSERT INTO crm_v2."Connector" (
  name, connector_type, is_enabled, configuration
)
VALUES
  ('Demo Google connector', 'GOOGLE', false, '{"mode":"oauth2","scope":"drive.readonly"}'::jsonb),
  ('Demo Facebook connector', 'FACEBOOK', false, '{"mode":"webhook","leadSync":true}'::jsonb),
  ('Demo inbound webhook', 'WEBHOOK', false, '{"mode":"signed"}'::jsonb)
ON CONFLICT (connector_type, name) DO NOTHING;

INSERT INTO crm_v2."DmsFolder" (name, path)
VALUES ('Company Documents', '/')
ON CONFLICT (path) DO NOTHING;

INSERT INTO crm_v2."DmsDocument" (folder_id, document_number, title, description, document_type)
SELECT folder.id, 'DMS-DEMO-0001', 'DMS demonstration document', 'Sample record for the new eOffice workspace.', 'POLICY'
FROM crm_v2."DmsFolder" AS folder
WHERE folder.path = '/'
ON CONFLICT (document_number) DO NOTHING;

INSERT INTO crm_v2."DmsWorkflow" (name, document_type)
VALUES ('Standard document approval', 'POLICY')
ON CONFLICT (name) DO NOTHING;

INSERT INTO crm_v2."DmsWorkflowStep" (workflow_id, step_order, name, approver_role_code)
SELECT workflow.id, 1, 'Manager review', 'MANAGER'
FROM crm_v2."DmsWorkflow" AS workflow
WHERE workflow.name = 'Standard document approval'
ON CONFLICT (workflow_id, step_order) DO NOTHING;

COMMIT;
