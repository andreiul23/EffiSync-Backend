import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  
  if (!user) {
    console.log("No user found in the database. Please connect a user first by visiting http://localhost:3000/auth/google");
    process.exit(1);
  }

  console.log(`Testing with user: ${user.name || user.email} (${user.id})`);

  try {
    console.log("Sending POST request to http://127.0.0.1:3000/api/chat...");
    const response = await fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        message: "Salut! Sunt Andrei. Ce am în calendar azi și ce task-uri îmi recomanzi?",
      }),
    });

    const data = await response.json();
    console.log("\n==================== API RESPONSE ====================");
    console.log(JSON.stringify(data, null, 2));
    console.log("======================================================");
  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
