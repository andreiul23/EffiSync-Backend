import { PrismaClient } from "@prisma/client";
import { sendRealEmailViaGmail } from "./src/services/email.service.js";
import process from "node:process";

const prisma = new PrismaClient();

async function main() {
  // Căutăm primul user care s-a logat cu Google și are un Refresh Token salvat
  const user = await prisma.user.findFirst({
    where: {
      googleRefreshToken: { not: null }
    }
  });

  if (!user) {
    console.log("❌ Nu am găsit niciun utilizator cu cont de Google conectat în baza de date.");
    console.log("Te rog să accesezi http://localhost:3000/google din browser pentru a te autentifica, apoi rulează scriptul din nou.");
    process.exit(1);
  }

  console.log(`✅ Am găsit contul tău conectat: ${user.email}`);
  console.log(`Se trimite emailul către conservatiti23@yahoo.com...`);
  
  await sendRealEmailViaGmail(
    user.id,
    "conservatiti23@yahoo.com",
    "Test vizual din EffiSync 🚀",
    "<h1>Salut!</h1><p>Acesta este un email real trimis din propriul tău backend EffiSync, folosind direct API-ul de la Google (Gmail).</p><p>Dacă vezi acest mesaj, integrarea de e-mail funcționează perfect!</p>"
  );

  console.log("✅ Comanda de trimitere a fost executată! Verifică-ți inbox-ul (sau folderul Spam) pe Yahoo.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
