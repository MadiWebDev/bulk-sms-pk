const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

// 1. Read .env file for MongoDB config
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const { DEFAULT_TEMPLATES } = require("../public/seedoftemplate.js");

async function seed() {
  console.log(`🚀 Found ${DEFAULT_TEMPLATES.length} templates in public/seedoftemplate.js`);

  // Write to lib/default-templates.ts
  const defaultTemplatesPath = path.join(__dirname, "..", "lib", "default-templates.ts");
  const tsContent = `import { TemplateRecord } from "./types";\n\nexport const DEFAULT_TEMPLATES: TemplateRecord[] = ${JSON.stringify(
    DEFAULT_TEMPLATES,
    null,
    2
  )};\n`;
  fs.writeFileSync(defaultTemplatesPath, tsContent, "utf-8");
  console.log(`✅ Updated lib/default-templates.ts with all ${DEFAULT_TEMPLATES.length} templates`);

  // Connect to MongoDB
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "BulkSMSPakistan";

  if (!uri) {
    console.error("❌ MONGODB_URI is not defined in .env");
    process.exit(1);
  }

  console.log(`📡 Connecting to MongoDB (${dbName})...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection("templates");

  console.log("📥 Seeding templates into MongoDB collection 'templates'...");
  let upsertedCount = 0;
  for (const tpl of DEFAULT_TEMPLATES) {
    await collection.updateOne(
      { id: tpl.id },
      {
        $set: {
          id: tpl.id,
          name: tpl.name,
          category: tpl.category,
          isPreset: true,
          variables: tpl.variables,
          text: tpl.text,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
    upsertedCount++;
  }

  const totalInDb = await collection.countDocuments();
  console.log(`🎉 Successfully seeded ${upsertedCount} templates to MongoDB! Total in DB: ${totalInDb}`);

  await client.close();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
