import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { setTimeout } from "timers/promises";

async function main() {
  console.log("🚀 Setting up Agent WAF local development environment...\n");

  // 1. Copy .env files if they don't exist
  const backendEnvPath = path.join(process.cwd(), "apps/backend/.env");
  const backendEnvExamplePath = path.join(
    process.cwd(),
    "apps/backend/.env.example"
  );

  if (!fs.existsSync(backendEnvPath)) {
    console.log("📝 Creating apps/backend/.env from .env.example...");
    if (fs.existsSync(backendEnvExamplePath)) {
      fs.copyFileSync(backendEnvExamplePath, backendEnvPath);
      console.log(
        "⚠️ PLEASE NOTE: You need to add your real GEMINI_API_KEY to apps/backend/.env\n"
      );
    } else {
      console.error("❌ Could not find apps/backend/.env.example");
    }
  } else {
    console.log("✅ apps/backend/.env already exists.");
  }

  // 2. Start Docker containers
  console.log("\n🐳 Starting PostgreSQL and Redis containers...");
  execSync("docker compose -f docker-compose.dev.yml up -d", {
    stdio: "inherit",
  });

  // 3. Wait for PostgreSQL to be ready
  console.log("\n⏳ Waiting for databases to initialize (5 seconds)...");
  await setTimeout(5000);

  // 4. Run migrations
  console.log("\n🏗️ Running database migrations...");
  execSync("pnpm --filter backend prisma:deploy", { stdio: "inherit" });

  // 5. Run seed
  console.log("\n🌱 Seeding database with demo data...");
  execSync("pnpm --filter backend seed", { stdio: "inherit" });

  console.log("\n✅ Setup complete! You can now run in separate terminals:");
  console.log("   Terminal 1: pnpm dev:backend");
  console.log("   Terminal 2: pnpm dev:frontend\n");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
