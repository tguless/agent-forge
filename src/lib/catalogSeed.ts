/**
 * Seed data for the app catalog + controlled capacity vocabulary.
 *
 * CAPACITIES is the master superset of access levels. Each app type exposes a
 * subset of these (AppTypeSeed.capacities); the consulting agent may add apps,
 * and (guarded) capacities, on the fly per business.
 */

export type CapacitySeed = { key: string; label: string; description: string };

export type AppSeed = {
  slug: string;
  name: string;
  kind: 'saas' | 'oss';
  website?: string;
  description: string;
};

export type AppTypeSeed = {
  key: string;
  label: string;
  description: string;
  /** Subset of capacity keys applicable to this app type. */
  capacities: string[];
  apps: AppSeed[];
};

/** Master controlled vocabulary (the superset). Order drives least→most privilege. */
export const CAPACITIES: CapacitySeed[] = [
  { key: 'viewer', label: 'Viewer', description: 'Read-only access to records and dashboards.' },
  { key: 'editor', label: 'Editor', description: 'Create and edit records.' },
  { key: 'send', label: 'Send', description: 'Send messages / act on behalf (email, chat, notifications).' },
  { key: 'approver', label: 'Approver', description: 'Approve, sign off, or counter-sign items.' },
  { key: 'configure', label: 'Configure', description: 'Configure workflows, automations, and pipelines.' },
  { key: 'export', label: 'Export', description: 'Bulk export data and reports.' },
  { key: 'api_read', label: 'API read', description: 'Programmatic read scope (API/token).' },
  { key: 'api_write', label: 'API write', description: 'Programmatic write scope (API/token).' },
  { key: 'audit', label: 'Audit', description: 'Read audit logs and access history.' },
  { key: 'billing_admin', label: 'Billing admin', description: 'Manage subscription, seats, and billing.' },
  { key: 'admin', label: 'Admin', description: 'Manage settings, users, and permissions.' },
  { key: 'owner', label: 'Owner', description: 'Full ownership / superuser of the workspace.' },
];

export const APP_TYPES: AppTypeSeed[] = [
  {
    key: 'crm',
    label: 'CRM',
    description: 'Customer relationship management and pipeline.',
    capacities: ['viewer', 'editor', 'configure', 'export', 'api_read', 'api_write', 'admin', 'owner', 'audit'],
    apps: [
      { slug: 'hubspot', name: 'HubSpot', kind: 'saas', website: 'https://hubspot.com', description: 'Inbound CRM + marketing/sales suite.' },
      { slug: 'salesforce', name: 'Salesforce', kind: 'saas', website: 'https://salesforce.com', description: 'Enterprise CRM platform.' },
      { slug: 'espocrm', name: 'EspoCRM', kind: 'oss', website: 'https://espocrm.com', description: 'Open-source CRM.' },
      { slug: 'twenty', name: 'Twenty', kind: 'oss', website: 'https://twenty.com', description: 'Modern open-source CRM.' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting / ERP',
    description: 'Bookkeeping, invoicing, and financials.',
    capacities: ['viewer', 'editor', 'approver', 'export', 'api_read', 'api_write', 'admin', 'owner', 'audit'],
    apps: [
      { slug: 'quickbooks', name: 'QuickBooks', kind: 'saas', website: 'https://quickbooks.intuit.com', description: 'SMB accounting.' },
      { slug: 'netsuite', name: 'NetSuite', kind: 'saas', website: 'https://netsuite.com', description: 'Cloud ERP/financials.' },
      { slug: 'erpnext', name: 'ERPNext', kind: 'oss', website: 'https://erpnext.com', description: 'Open-source ERP.' },
      { slug: 'akaunting', name: 'Akaunting', kind: 'oss', website: 'https://akaunting.com', description: 'Open-source accounting.' },
    ],
  },
  {
    key: 'esign',
    label: 'E-signature',
    description: 'Document signing and agreement workflows.',
    capacities: ['viewer', 'editor', 'send', 'approver', 'api_read', 'api_write', 'admin', 'audit'],
    apps: [
      { slug: 'docusign', name: 'DocuSign', kind: 'saas', website: 'https://docusign.com', description: 'E-signature leader.' },
      { slug: 'dropbox-sign', name: 'Dropbox Sign', kind: 'saas', website: 'https://sign.dropbox.com', description: 'E-signature (HelloSign).' },
      { slug: 'documenso', name: 'Documenso', kind: 'oss', website: 'https://documenso.com', description: 'Open-source DocuSign alternative.' },
      { slug: 'opensign', name: 'OpenSign', kind: 'oss', website: 'https://opensignlabs.com', description: 'Open-source e-signature.' },
    ],
  },
  {
    key: 'storage',
    label: 'File storage / DMS',
    description: 'Document storage and management.',
    capacities: ['viewer', 'editor', 'export', 'api_read', 'api_write', 'admin', 'owner', 'audit'],
    apps: [
      { slug: 'google-drive', name: 'Google Drive', kind: 'saas', website: 'https://drive.google.com', description: 'Cloud file storage.' },
      { slug: 'sharepoint', name: 'SharePoint', kind: 'saas', website: 'https://microsoft.com/sharepoint', description: 'Document management.' },
      { slug: 'nextcloud', name: 'Nextcloud', kind: 'oss', website: 'https://nextcloud.com', description: 'Self-hosted file sync/share.' },
      { slug: 'minio', name: 'MinIO', kind: 'oss', website: 'https://min.io', description: 'S3-compatible object storage.' },
    ],
  },
  {
    key: 'email',
    label: 'Email / Comms',
    description: 'Email and team messaging.',
    capacities: ['viewer', 'send', 'api_read', 'api_write', 'admin', 'audit'],
    apps: [
      { slug: 'google-workspace', name: 'Google Workspace', kind: 'saas', website: 'https://workspace.google.com', description: 'Gmail + productivity.' },
      { slug: 'slack', name: 'Slack', kind: 'saas', website: 'https://slack.com', description: 'Team messaging.' },
      { slug: 'mattermost', name: 'Mattermost', kind: 'oss', website: 'https://mattermost.com', description: 'Open-source team chat.' },
      { slug: 'mailcow', name: 'mailcow', kind: 'oss', website: 'https://mailcow.email', description: 'Self-hosted mail server.' },
    ],
  },
  {
    key: 'helpdesk',
    label: 'Helpdesk / Support',
    description: 'Customer support ticketing.',
    capacities: ['viewer', 'editor', 'send', 'configure', 'api_read', 'api_write', 'admin', 'audit'],
    apps: [
      { slug: 'zendesk', name: 'Zendesk', kind: 'saas', website: 'https://zendesk.com', description: 'Support suite.' },
      { slug: 'intercom', name: 'Intercom', kind: 'saas', website: 'https://intercom.com', description: 'Customer messaging + support.' },
      { slug: 'chatwoot', name: 'Chatwoot', kind: 'oss', website: 'https://chatwoot.com', description: 'Open-source support platform.' },
      { slug: 'zammad', name: 'Zammad', kind: 'oss', website: 'https://zammad.org', description: 'Open-source helpdesk.' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics / BI',
    description: 'Dashboards and business intelligence.',
    capacities: ['viewer', 'editor', 'export', 'configure', 'api_read', 'admin'],
    apps: [
      { slug: 'looker', name: 'Looker', kind: 'saas', website: 'https://looker.com', description: 'BI platform.' },
      { slug: 'power-bi', name: 'Power BI', kind: 'saas', website: 'https://powerbi.microsoft.com', description: 'Microsoft BI.' },
      { slug: 'metabase', name: 'Metabase', kind: 'oss', website: 'https://metabase.com', description: 'Open-source BI.' },
      { slug: 'superset', name: 'Apache Superset', kind: 'oss', website: 'https://superset.apache.org', description: 'Open-source data exploration.' },
    ],
  },
  {
    key: 'project',
    label: 'Project management',
    description: 'Work tracking and project delivery.',
    capacities: ['viewer', 'editor', 'configure', 'api_read', 'api_write', 'admin'],
    apps: [
      { slug: 'jira', name: 'Jira', kind: 'saas', website: 'https://atlassian.com/software/jira', description: 'Issue + project tracking.' },
      { slug: 'asana', name: 'Asana', kind: 'saas', website: 'https://asana.com', description: 'Work management.' },
      { slug: 'openproject', name: 'OpenProject', kind: 'oss', website: 'https://openproject.org', description: 'Open-source PM.' },
      { slug: 'plane', name: 'Plane', kind: 'oss', website: 'https://plane.so', description: 'Open-source project tracking.' },
    ],
  },
  {
    key: 'docs',
    label: 'Docs / Knowledge base',
    description: 'Internal documentation and wikis.',
    capacities: ['viewer', 'editor', 'export', 'api_read', 'api_write', 'admin'],
    apps: [
      { slug: 'notion', name: 'Notion', kind: 'saas', website: 'https://notion.so', description: 'Docs + wiki + DB.' },
      { slug: 'confluence', name: 'Confluence', kind: 'saas', website: 'https://atlassian.com/software/confluence', description: 'Team workspace/wiki.' },
      { slug: 'outline', name: 'Outline', kind: 'oss', website: 'https://getoutline.com', description: 'Open-source team wiki.' },
      { slug: 'bookstack', name: 'BookStack', kind: 'oss', website: 'https://bookstackapp.com', description: 'Open-source documentation.' },
    ],
  },
  {
    key: 'automation',
    label: 'Workflow automation',
    description: 'Integration and automation between apps.',
    capacities: ['viewer', 'editor', 'configure', 'api_read', 'api_write', 'admin'],
    apps: [
      { slug: 'zapier', name: 'Zapier', kind: 'saas', website: 'https://zapier.com', description: 'No-code automation.' },
      { slug: 'make', name: 'Make', kind: 'saas', website: 'https://make.com', description: 'Visual automation.' },
      { slug: 'n8n', name: 'n8n', kind: 'oss', website: 'https://n8n.io', description: 'Open-source workflow automation.' },
      { slug: 'activepieces', name: 'Activepieces', kind: 'oss', website: 'https://activepieces.com', description: 'Open-source automation.' },
    ],
  },
];
