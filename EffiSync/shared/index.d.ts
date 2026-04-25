// ──────────────────────────────────────────────────────────
// @effisync/shared — Type Definitions
// ──────────────────────────────────────────────────────────

// ─── Enums ──────────────────────────────────────────────

export declare const TaskStatus: {
  readonly PENDING: 'PENDING';
  readonly IN_PROGRESS: 'IN_PROGRESS';
  readonly AWAITING_REVIEW: 'AWAITING_REVIEW';
  readonly COMPLETED: 'COMPLETED';
  readonly REJECTED: 'REJECTED';
};
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export declare const TaskCategory: {
  readonly CLEANING: 'CLEANING';
  readonly SHOPPING: 'SHOPPING';
  readonly ADMINISTRATIVE: 'ADMINISTRATIVE';
  readonly PERSONAL_GROWTH: 'PERSONAL_GROWTH';
  readonly OTHER: 'OTHER';
};
export type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory];

export declare const TaskType: {
  readonly INDIVIDUAL: 'INDIVIDUAL';
  readonly GROUP: 'GROUP';
};
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export declare const ChatRole: {
  readonly USER: 'USER';
  readonly AI: 'AI';
};
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export declare const GroupType: {
  readonly HOUSEHOLD: 'HOUSEHOLD';
  readonly FRIEND_GROUP: 'FRIEND_GROUP';
  readonly WORK_ENVIRONMENT: 'WORK_ENVIRONMENT';
};
export type GroupType = (typeof GroupType)[keyof typeof GroupType];

// ─── Economy Constants ──────────────────────────────────

export declare const VETO_COST: 50;
export declare const POINTS_MULTIPLIER: 1.5;
export declare const MAX_POINTS_VALUE: 500;
export declare const DIFFICULTY_MULTIPLIER: 10;

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
