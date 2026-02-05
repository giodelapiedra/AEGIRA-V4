// --- Soft pastel palette matching clean analytics style ---

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#93c5fd',      // blue-300
  MEDIUM: '#fcd34d',   // amber-300
  HIGH: '#fdba74',     // orange-300
  CRITICAL: '#fca5a5', // red-300
};

export const STATUS_COLORS: Record<string, string> = {
  total: '#6366f1',    // indigo-500
  approved: '#34d399', // emerald-400
  rejected: '#f87171', // red-400
  pending: '#fbbf24',  // amber-400
};

export const INCIDENT_TYPE_COLORS: Record<string, string> = {
  PHYSICAL_INJURY: '#fca5a5',   // red-300
  ILLNESS_SICKNESS: '#fdba74',  // orange-300
  MENTAL_HEALTH: '#d8b4fe',     // purple-300
  MEDICAL_EMERGENCY: '#f87171', // red-400
  HEALTH_SAFETY_CONCERN: '#fcd34d', // amber-300
  OTHER: '#cbd5e1',             // slate-300
};

export const REJECTION_COLORS = ['#fca5a5', '#fdba74', '#fcd34d', '#cbd5e1'];

export const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
