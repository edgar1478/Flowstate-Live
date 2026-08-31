
export type TaskStatus = 'sketch' | 'revision' | 'proofreading';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  status: TaskStatus;
  dueDate?: string; // YYYY-MM-DD format
  priority?: TaskPriority;
}

export interface Card {
  id: string;
  content: string;
  color?: string;
  isHidden?: boolean;
  notes?: string;
  tags?: string[];
  task?: Task;
  isLocked?: boolean;
}

export interface Project {
  id: string;
  name: string;
  cards: Card[];
  parentId: string | null;
  category?: string;
  childCategoryName?: string;
  notes?: string;
  lastModified?: string;
  isHidden?: boolean;
}