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
};

export const TaskCategory = {
  CLEANING: 'CLEANING',
  SHOPPING: 'SHOPPING',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  PERSONAL_GROWTH: 'PERSONAL_GROWTH',
  OTHER: 'OTHER',
};

export const TaskType = {
  INDIVIDUAL: 'INDIVIDUAL',
  GROUP: 'GROUP',
};

export const ChatRole = {
  USER: 'USER',
  AI: 'AI',
};

export const GroupType = {
  HOUSEHOLD: 'HOUSEHOLD',
  FRIEND_GROUP: 'FRIEND_GROUP',
  WORK_ENVIRONMENT: 'WORK_ENVIRONMENT',
};

// ─── Economy Constants ──────────────────────────────────

/** Points deducted when a user exercises their Veto right. */
export const VETO_COST = 50;

/** Multiplier applied to a task's pointsValue after each veto (Task Bidding). */
export const POINTS_MULTIPLIER = 1.5;

/** Hard cap to prevent infinite inflation of task point values. */
export const MAX_POINTS_VALUE = 500;

/** Points per difficulty level (pointsValue = difficulty * DIFFICULTY_MULTIPLIER). */
export const DIFFICULTY_MULTIPLIER = 10;
