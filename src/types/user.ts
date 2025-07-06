export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface TestPaper {
  id: string;
  title: string;
  user_id: string;
  questions: Question[] | any;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'mcq' | 'descriptive';
  question_count: number;
  created_at: string;
  updated_at: string;
  source_document?: string | null;
}

export interface Question {
  id: string;
  question: string;
  type: 'mcq' | 'descriptive';
  options?: string[];
  correctAnswer?: string;
  points: number;
}

export interface SourceDocument {
  path: string;
  name: string;
  type: string;
  size: number;
}