
export interface PossibleCause {
  cause: string;
  likelihood: 'High' | 'Medium' | 'Low';
}

export interface RecommendedSolution {
  solution: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
}

export interface DiagnosticReport {
  possible_causes: PossibleCause[];
  recommended_solutions: RecommendedSolution[];
  estimated_cost: string;
}

export interface DTCCodeMeaning {
  code: string;
  title: string;
  description: string;
  common_symptoms: string[];
  possible_causes: string[];
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  report: DiagnosticReport;
}
