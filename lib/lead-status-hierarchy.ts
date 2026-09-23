export const LEAD_STATUS_HIERARCHY = [
  {
    category: 'Relevant Leads',
    groups: [
      { group: 'New Leads', statuses: ['New Leads'] },
      { group: 'Follow-up', statuses: ['Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Followup'] },
      { group: 'Callback', statuses: ['Call Back (T)', 'Call Back (SD)', 'Call Back Next Week', 'Call Back Next Month'] },
      { group: 'Closed', statuses: ['Closed'] },
      { group: 'Fund Issues', statuses: ['Fund Issues'] },
    ],
  },
  {
    category: 'Appointments',
    groups: [
      { group: 'IPD Done', statuses: ['IPD Done'] },
      { group: 'OPD Done', statuses: ['OPD Done'] },
      { group: 'IPD Schedule', statuses: ['IPD Schedule'] },
      { group: 'OPD Schedule', statuses: ['OPD Schedule'] },
    ],
  },
  {
    category: 'Irrelevant',
    groups: [
      { group: 'Junk', statuses: ['Junk'] },
      { group: 'Out of Station', statuses: ['Out of Station'] },
      { group: 'Out of Station follow-up', statuses: ['Out of Station follow-up'] },
      { group: 'Duplicate lead', statuses: ['Duplicate lead'] },
      { group: 'IPD Lost', statuses: ['IPD Lost'] },
      { group: 'DNP Exhausted', statuses: ['DNP Exhausted'] },
    ],
  },
  {
    category: 'Churning Data',
    groups: [
      { group: 'Nurture', statuses: ['Nurture', 'Nurture 1', 'Nurture 2', 'Nurture 3', 'Nurture 4', 'Nurture5'] },
      { group: 'DNP', statuses: ['DNP', 'DNP 1', 'DNP 2', 'DNP 3', 'DNP 4', 'DNP 5'] },
    ],
  },
] as const

export const LEAD_STATUS_OPTIONS = LEAD_STATUS_HIERARCHY.flatMap((category) =>
  category.groups.flatMap((group) => group.statuses),
)
