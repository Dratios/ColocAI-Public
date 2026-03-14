import { type Database } from './database.types';

export type User = Database['public']['Tables']['users']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type ChoreHistory = Database['public']['Tables']['chore_history']['Row'];
export type InventoryItem = Database['public']['Tables']['inventory']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type PlannedMeal = Database['public']['Tables']['planned_meals']['Row'];

export interface TaskWithPoints extends Omit<Task, 'currentPoints' | 'daysLate'> {
  currentPoints: number;
  daysLate: number;
  lastPerformers?: string[];
}
