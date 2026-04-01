export interface Submission {
  id: string
  created_at: string
  submitter_name: string
  team: string
  title: string
  problem: string
  solution: string
  beneficiary: string
  success_metric: string
  pillars: string[]
  g1: string
  g2: string
  g3: string
  strategic_fit: number
  value_potential: number
  ai_suitability: number
  delivery_feasibility: number
  data_readiness: number
  total_score: number
  feedback: string
  status: string
  reviewed_at: string | null
}

export interface Vote {
  submission_id: string
  voter_name: string
}

export const PILLARS: Record<string, string> = {
  p1: 'Operational Efficiency',
  p2: 'Experience',
  p3: 'AI-Native Platform',
  p4: 'Responsible & Compliant',
}

export const GATES = [
  { id: 'g1' as const, label: 'Clear beneficiary' },
  { id: 'g2' as const, label: 'POC feasibility' },
  { id: 'g3' as const, label: 'Error cost awareness' },
]

export const SHORTLISTED_TITLES = [
  'AI assisted BTL Portfolio upload',
  'Ai Requirements Reviewer',
  'AI-Assisted Field Mapping and Data Translation for System Integration',
  'AI-Assisted Document & Data Capture',
  'Research Agent',
]
