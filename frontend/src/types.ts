export interface TechnologyLevel {
  technology: string;
  level: number;
}

export interface LessonData {
  explanation: string;
  key_concepts: string[];
  example: string;
  summary: string;
}

export interface ExamQuestion {
  question_number: number;
  technology: string;
  level: number;
  question: string;
  answer: string | null;
  scoring: number | null;
  comment: string | null;
  lesson: LessonData | null;
}

export interface ExamState {
  questions: ExamQuestion[];
  currentQuestionIndex: number;
  metadata: {
    timestamp: string;
    totalQuestions: number;
  };
}

export interface GuardianResponse {
  valid: boolean;
  explanation?: string;
}

export interface CheckResponse {
  scoring: number;
  comment: string;
}

export interface LessonResponse {
  explanation: string;
  key_concepts: string[];
  example: string;
  summary: string;
}

export interface SummaryResponse {
  summary: string;
  average_score: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
}

export const TECHNOLOGIES = [
  "Python",
  "SQL",
  "Pandas",
  "Machine Learning",
  "Data Preprocessing",
  "Exploratory Data Analysis",
  "Prompt Engineering",
  "Docker",
  "Git and GitHub",
  "Model Deployment"
] as const;
