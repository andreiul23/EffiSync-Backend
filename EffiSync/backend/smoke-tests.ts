import { PrismaClient } from "@prisma/client";
import process from "node:process";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

const TEST_EMAIL = `smoke-${Date.now()}@effisync.dev`;
const TEST_PASSWORD = "SmokePass123!";

let testUserId = "";
let testHouseholdId = "";
let testTaskId = "";
let token = "";

function ok(step: string, details?: string) {
  console.log(`OK  ${step}${details ? ` - ${details}` : ""}`);
}

function fail(step: string, details?: string) {
  console.error(`FAIL ${step}${details ? ` - ${details}` : ""}`);
}

type ApiResponse<T = any> = {
  status: number;
  data: T;
};

async function api<T = any>(
  path: string,
  method: string,
  options?: { body?: object; authToken?: string }
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function cleanup() {
  try {
    if (testTaskId) {
      await prisma.task.deleteMany({ where: { id: testTaskId } });
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (testHouseholdId) {
      await prisma.household.deleteMany({ where: { id: testHouseholdId } });
    }
  } catch (error) {
    fail("cleanup", String(error));
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  try {
    const health = await fetch(BASE);
    if (!health.ok) {
      throw new Error(`Server is not reachable on ${BASE}`);
    }
    ok("server", BASE);

    const register = await api<{ success: boolean; userId: string; token: string }>(
      "/api/auth/register",
      "POST",
      {
        body: {
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          name: "Smoke Tester",
        },
      }
    );

    if (register.status !== 200 || !register.data?.success || !register.data?.token) {
      throw new Error(`Register failed: ${JSON.stringify(register.data)}`);
    }

    testUserId = register.data.userId;
    token = register.data.token;
    ok("register", testUserId);

    const me = await api<{ success: boolean; user: { id: string } }>("/api/auth/me", "GET", {
      authToken: token,
    });

    if (me.status !== 200 || !me.data?.success || me.data.user.id !== testUserId) {
      throw new Error(`Auth /me failed: ${JSON.stringify(me.data)}`);
    }
    ok("auth me");

    const household = await api<{ success: boolean; household: { id: string } }>(
      "/api/households",
      "POST",
      {
        authToken: token,
        body: { name: "Smoke Household" },
      }
    );

    if (household.status !== 201 || !household.data?.success) {
      throw new Error(`Create household failed: ${JSON.stringify(household.data)}`);
    }

    testHouseholdId = household.data.household.id;
    ok("create household", testHouseholdId);

    const createTask = await api<{ success: boolean; task: { id: string } }>("/api/tasks", "POST", {
      authToken: token,
      body: {
        title: "Smoke Task",
        description: "Created by smoke tests",
        difficulty: 2,
        type: "GROUP",
        category: "CLEANING",
        assignedToId: testUserId,
      },
    });

    if (createTask.status !== 200 || !createTask.data?.success) {
      throw new Error(`Create task failed: ${JSON.stringify(createTask.data)}`);
    }

    testTaskId = createTask.data.task.id;
    ok("create task", testTaskId);

    const completeTask = await api<{ success: boolean }>(
      `/api/tasks/${testTaskId}/complete`,
      "PATCH",
      {
        authToken: token,
        body: {},
      }
    );

    if (completeTask.status !== 200 || !completeTask.data?.success) {
      throw new Error(`Complete task failed: ${JSON.stringify(completeTask.data)}`);
    }
    ok("complete task");

    const chat = await api<{ response?: string }>("/api/chat", "POST", {
      authToken: token,
      body: {
        message: "Quick smoke check: what should I do next?",
      },
    });

    if (chat.status !== 200 || !chat.data?.response) {
      throw new Error(`Chat failed: ${JSON.stringify(chat.data)}`);
    }
    ok("chat", "response received");

    const history = await api<{ success?: boolean; messages?: unknown[] }>("/api/chat/history", "GET", {
      authToken: token,
    });

    if (history.status !== 200 || !history.data?.success || !Array.isArray(history.data.messages)) {
      throw new Error(`Chat history failed: ${JSON.stringify(history.data)}`);
    }
    ok("chat history", `${history.data.messages.length} messages`);

    console.log("\nSmoke tests passed.");
  } catch (error) {
    fail("smoke suite", String(error));
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

run();
