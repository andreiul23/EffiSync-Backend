/**
 * EffiSync — End-to-End Integration Test Suite
 *
 * Tests the full backend flow: Auth → CRUD → Economy/Bidding → AI Chat → History.
 *
 * Run:  npx tsx run-tests.ts
 * Make sure the server is running on http://localhost:3000 first (npm run dev).
 */

import { PrismaClient } from "@prisma/client";
import process from "node:process";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────
const sep = () => console.log("─".repeat(60));

async function api<T = any>(
  path: string,
  method: string,
  body?: object
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

function pass(label: string, detail?: string) {
  console.log(`  🟢 ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label: string, detail?: string) {
  console.log(`  🔴 FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}
function info(label: string, detail?: string) {
  console.log(`  🟡 ${label}${detail ? ` — ${detail}` : ""}`);
}

// ── State (populated during tests) ─────────────────────────
let testUserId: string;
let testHouseholdId: string;
let testTaskId: string;
const TEST_EMAIL = `test-${Date.now()}@effisync.dev`;
const TEST_PASSWORD = "TestPass123!";

// ── Cleanup ────────────────────────────────────────────────
async function cleanup() {
  info("CLEANUP", "Removing test data…");
  try {
    if (testTaskId) {
      await prisma.task.deleteMany({ where: { id: testTaskId } });
    }
    if (testUserId) {
      // Cascade deletes will handle PointsTransaction, ChatMessage, etc.
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (testHouseholdId) {
      await prisma.household.deleteMany({ where: { id: testHouseholdId } });
    }
    pass("CLEANUP", "Test data removed");
  } catch (e) {
    fail("CLEANUP", String(e));
  }
}

// ════════════════════════════════════════════════════════════
//  TEST 1 — Authentication
// ════════════════════════════════════════════════════════════
async function testAuth() {
  sep();
  console.log("📋 TEST 1 — Authentication (Register + Login)");
  sep();

  // Register
  const reg = await api("/auth/register", "POST", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: "Test Robot",
  });

  if (reg.status === 200 && reg.data.success) {
    testUserId = reg.data.userId;
    pass("REGISTER", `userId = ${testUserId}`);
  } else {
    fail("REGISTER", JSON.stringify(reg.data));
    throw new Error("Cannot continue without a registered user");
  }

  // Login
  const login = await api("/auth/login", "POST", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (login.status === 200 && login.data.success) {
    pass("LOGIN", `userId confirmed = ${login.data.userId}`);
  } else {
    fail("LOGIN", JSON.stringify(login.data));
    throw new Error("Login failed");
  }
}

// ════════════════════════════════════════════════════════════
//  SETUP — Create household & assign user (no API route for this)
// ════════════════════════════════════════════════════════════
async function setupHousehold() {
  sep();
  console.log("⚙️  SETUP — Creating test household via Prisma");
  sep();

  const household = await prisma.household.create({
    data: {
      name: "Test Household",
      inviteCode: `TEST-${Date.now()}`,
    },
  });
  testHouseholdId = household.id;

  await prisma.user.update({
    where: { id: testUserId },
    data: {
      householdId: testHouseholdId,
      pointsBalance: 200, // Give enough points for veto test (costs 50)
    },
  });

  pass("HOUSEHOLD", `id = ${testHouseholdId}`);
  pass("USER UPDATED", "Assigned to household + 200 starting points");
}

// ════════════════════════════════════════════════════════════
//  TEST 2 — Task CRUD
// ════════════════════════════════════════════════════════════
async function testTaskCRUD() {
  sep();
  console.log("📋 TEST 2 — Task CRUD (Create manual task)");
  sep();

  const create = await api("/api/tasks", "POST", {
    title: "Take out the trash",
    description: "Don't forget the recycling bin too",
    difficulty: 2,
    category: "CLEANING",
    householdId: testHouseholdId,
    createdById: testUserId,
    assignedToId: testUserId,
  });

  if (create.status === 200 && create.data.success) {
    testTaskId = create.data.task.id;
    const t = create.data.task;
    pass("TASK CREATED", `id = ${testTaskId}`);
    info("  DETAILS", `title="${t.title}" | difficulty=${t.difficulty} | points=${t.pointsValue} | status=${t.status}`);
  } else {
    fail("TASK CREATE", JSON.stringify(create.data));
    throw new Error("Cannot continue without a task");
  }
}

// ════════════════════════════════════════════════════════════
//  TEST 3 — Economy / Bidding (Veto)
// ════════════════════════════════════════════════════════════
async function testEconomyBidding() {
  sep();
  console.log("📋 TEST 3 — Economy & Bidding Loop (Veto)");
  sep();

  // Veto the task
  const veto = await api(`/api/tasks/${testTaskId}/veto`, "POST", {
    userId: testUserId,
  });

  if (veto.status === 200 && veto.data.success) {
    pass("VETO EXECUTED", "50 points deducted");
  } else {
    fail("VETO", JSON.stringify(veto.data));
    return;
  }

  // Fetch updated task to verify refusalCount & pointsValue
  const fetch_tasks = await api(`/api/tasks?householdId=${testHouseholdId}`, "GET");

  if (fetch_tasks.status === 200 && fetch_tasks.data.success) {
    const task = fetch_tasks.data.tasks.find((t: any) => t.id === testTaskId);
    if (task) {
      const refusalOk = task.refusalCount === 1;
      const pointsOk = task.pointsValue === 30; // 20 * 1.5 = 30

      if (refusalOk) pass("REFUSAL COUNT", `refusalCount = ${task.refusalCount} (expected 1)`);
      else fail("REFUSAL COUNT", `got ${task.refusalCount}, expected 1`);

      if (pointsOk) pass("POINTS INFLATED", `pointsValue = ${task.pointsValue} (expected 30 = 20×1.5)`);
      else fail("POINTS INFLATED", `got ${task.pointsValue}, expected 30`);

      info("  STATUS", `status = ${task.status} (should be PENDING)`);
      info("  ASSIGNED", `assignedToId = ${task.assignedToId} (should be null)`);
    } else {
      fail("TASK FETCH", "Task not found after veto");
    }
  } else {
    fail("TASK FETCH", JSON.stringify(fetch_tasks.data));
  }

  // Check user points decreased
  const user = await prisma.user.findUnique({ where: { id: testUserId } });
  if (user) {
    const expectedBalance = 200 - 50; // started with 200, veto costs 50
    if (user.pointsBalance === expectedBalance) {
      pass("USER BALANCE", `pointsBalance = ${user.pointsBalance} (200 − 50 = 150) ✓`);
    } else {
      fail("USER BALANCE", `got ${user.pointsBalance}, expected ${expectedBalance}`);
    }
  }
}

// ════════════════════════════════════════════════════════════
//  TEST 4 — AI Chat
// ════════════════════════════════════════════════════════════
async function testAIChat() {
  sep();
  console.log("📋 TEST 4 — AI Chat (Gemini Integration)");
  sep();

  info("SENDING", 'Message: "Hello, what tasks do I have?"');

  const chat = await api("/api/chat", "POST", {
    userId: testUserId,
    message: "Hello, what tasks do I have?",
  });

  if (chat.status === 200 && chat.data.response) {
    pass("🧠 AI RESPONDED");
    console.log(`\n  💬 AI says:\n  "${chat.data.response.slice(0, 300)}${chat.data.response.length > 300 ? "…" : ""}"\n`);

    if (chat.data.steps && chat.data.steps.length > 0) {
      info("TOOL CALLS", `AI used ${chat.data.steps.length} reasoning step(s)`);
      for (const step of chat.data.steps) {
        for (const tc of step.toolCalls || []) {
          info("  ↳ TOOL", `${tc.tool}(${JSON.stringify(tc.input).slice(0, 80)})`);
        }
      }
    }
  } else {
    fail("AI CHAT", JSON.stringify(chat.data));
  }
}

// ════════════════════════════════════════════════════════════
//  TEST 5 — Chat History Persistence
// ════════════════════════════════════════════════════════════
async function testChatHistory() {
  sep();
  console.log("📋 TEST 5 — Chat History (Database Persistence)");
  sep();

  const history = await api(`/api/chat/history?userId=${testUserId}`, "GET");

  if (history.status === 200 && history.data.success) {
    const msgs = history.data.messages;
    pass("HISTORY FETCHED", `${msgs.length} message(s) found`);

    const userMsgs = msgs.filter((m: any) => m.role === "USER");
    const aiMsgs = msgs.filter((m: any) => m.role === "AI");

    info("  USER messages", `${userMsgs.length}`);
    info("  AI messages", `${aiMsgs.length}`);

    if (userMsgs.length > 0 && aiMsgs.length > 0) {
      pass("PERSISTENCE VERIFIED", "Both USER and AI messages saved in DB ✓");
    } else {
      fail("PERSISTENCE", "Expected at least 1 USER and 1 AI message");
    }

    // Print last exchange
    if (msgs.length >= 2) {
      const last2 = msgs.slice(-2);
      console.log("\n  📜 Last exchange:");
      for (const m of last2) {
        const icon = m.role === "USER" ? "👤" : "🤖";
        const text = (m.text || "").slice(0, 120);
        console.log(`    ${icon} [${m.role}] ${text}${(m.text || "").length > 120 ? "…" : ""}`);
      }
      console.log();
    }
  } else {
    fail("HISTORY", JSON.stringify(history.data));
  }
}

// ════════════════════════════════════════════════════════════
//  MAIN RUNNER
// ════════════════════════════════════════════════════════════
async function main() {
  console.log();
  console.log("🚀 EffiSync — End-to-End Integration Tests");
  console.log(`   Server: ${BASE}`);
  console.log(`   Time:   ${new Date().toLocaleString()}`);
  console.log();

  // Sanity check: is the server running?
  try {
    const health = await fetch(BASE);
    if (!health.ok) throw new Error(`Status ${health.status}`);
    pass("SERVER REACHABLE", BASE);
  } catch {
    fail("SERVER NOT REACHABLE", `Make sure the server is running on ${BASE}`);
    process.exit(1);
  }

  let failures = false;

  try {
    await testAuth();
    await setupHousehold();
    await testTaskCRUD();
    await testEconomyBidding();
    await testAIChat();
    await testChatHistory();
  } catch (err) {
    failures = true;
    console.error("\n🔴 TEST ABORTED:", err instanceof Error ? err.message : err);
  } finally {
    sep();
    await cleanup();
    await prisma.$disconnect();
  }

  sep();
  if (failures) {
    console.log("❌ Some tests failed. Review the output above.\n");
    process.exit(1);
  } else {
    console.log("✅ All tests passed! Backend is ready for frontend integration.\n");
    process.exit(0);
  }
}

main();
