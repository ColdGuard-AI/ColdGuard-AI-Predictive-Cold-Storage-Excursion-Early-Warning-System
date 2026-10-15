export const ROLES = [
  {
    id: 'cold_storage_manager',
    title: 'Cold Storage Manager',
    icon: 'ShieldCheck'
  },
  {
    id: 'facility_operator',
    title: 'Facility Operator',
    icon: 'Cpu'
  },
  {
    id: 'government_auditor',
    title: 'Government / Quality Auditor',
    icon: 'ClipboardCheck'
  },
  {
    id: 'buyer_retailer',
    title: 'Buyer / Retailer',
    icon: 'ShoppingBag'
  }
];

// Demo credentials for optional reviewer test-fill
export const DEMO_CREDENTIALS = {
  cold_storage_manager: { email: 'manager@coldguard.ai', employee_id: 'EMP-MGR-01', password: 'Manager123!' },
  facility_operator: { email: 'operator@coldguard.ai', employee_id: 'EMP-OPR-02', password: 'Operator123!' },
  government_auditor: { email: 'auditor@fda-quality.gov', employee_id: 'EMP-AUD-03', password: 'Auditor123!' },
  buyer_retailer: { email: 'buyer@freshmart-global.com', employee_id: 'EMP-BYR-04', password: 'Buyer123!' }
};
