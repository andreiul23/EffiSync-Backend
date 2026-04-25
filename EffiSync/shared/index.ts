// ──────────────────────────────────────────────────────────
// @effisync/shared — Constants, Enums & DTOs
// Shared between frontend and backend.
// ──────────────────────────────────────────────────────────

// ─── Enums (mirror Prisma schema) ───────────────────────

export const TaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  AWAITING_REVIEW: 'AWAITING_REVIEW',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskCategory = {
  CLEANING: 'CLEANING',
  SHOPPING: 'SHOPPING',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  PERSONAL_GROWTH: 'PERSONAL_GROWTH',
  OTHER: 'OTHER',
} as const;

export type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory];

export const TaskType = {
  INDIVIDUAL: 'INDIVIDUAL',
  GROUP: 'GROUP',
} as const;

export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const ChatRole = {
  USER: 'USER',
  AI: 'AI',
} as const;

export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export const GroupType = {
  HOUSEHOLD: 'HOUSEHOLD',
  FRIEND_GROUP: 'FRIEND_GROUP',
  WORK_ENVIRONMENT: 'WORK_ENVIRONMENT',
} as const;

export type GroupType = (typeof GroupType)[keyof typeof GroupType];

// ─── Economy Constants ──────────────────────────────────

/** Points deducted when a user exercises their Veto right. */
export const VETO_COST = 50;

/** Multiplier applied to a task's pointsValue after each veto (Task Bidding). */
export const POINTS_MULTIPLIER = 1.5;

/** Hard cap to prevent infinite inflation of task point values. */
export const MAX_POINTS_VALUE = 500;

/** Points per difficulty level (pointsValue = difficulty * DIFFICULTY_MULTIPLIER). */
export const DIFFICULTY_MULTIPLIER = 10;

// ─── API Request DTOs ───────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  difficulty?: number;
  category?: TaskCategory;
  type?: TaskType;
  householdId: string;
  createdById: string;
  assignedToId?: string;
  dueDate?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  difficulty?: number;
  category?: TaskCategory;
  type?: TaskType;
  assignedToId?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
}

export interface AcceptTaskRequest {
  userId: string;
}

export interface VetoTaskRequest {
  userId: string;
}

export interface ChatRequest {
  message: string;
  userId: string;
}

// ─── API Response DTOs ──────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  [key: string]: T | true;
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  category: TaskCategory;
  type: TaskType;
  difficulty: number;
  pointsValue: number;
  refusalCount: number;
  assignedToId?: string | null;
  createdById: string;
  householdId: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageResponse {
  id: string;
  userId: string;
  text: string;
  role: ChatRole;
  createdAt: string;
}

export interface ChatReply {
  response: string;
  steps: Array<{
    text: string;
    toolCalls: Array<{ tool: string; input: unknown }>;
    toolResults: Array<{ tool: string; output: unknown }>;
  }>;
}
