import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌  MONGODB_URI is not set in .env — aborting.');
  process.exit(1);
}

const COLLECTIONS = ['projects', 'papers', 'decisions', 'appraisals', 'extractions', 'synthesis'];

function loadJson(name) {
  const fp = join(DATA_DIR, `${name}.json`);
  if (!existsSync(fp)) { console.log(`  ⚠️  ${name}.json not found — skipping`); return []; }
  try {
    const rows = JSON.parse(readFileSync(fp, 'utf-8'));
    console.log(`  📂 ${name}.json — ${rows.length} records`);
    return rows;
  } catch {
    console.log(`  ❌  ${name}.json — parse error, skipping`);
    return [];
  }
}

async function seed() {
  console.log('\n🌱 REA → MongoDB Atlas seed script\n');
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('rea-app');
    console.log('✅  Connected to MongoDB Atlas\n');

    for (const col of COLLECTIONS) {
      const rows = loadJson(col);
      if (rows.length === 0) continue;
      const collection = db.collection(col);
      const existing = await collection.countDocuments();
      if (existing > 0) {
        console.log(`  ⏭️  ${col} already has ${existing} docs — skipping (use --force to overwrite)`);
        continue;
      }
      await collection.insertMany(rows);
      console.log(`  ✅  ${col} — inserted ${rows.length} documents`);
    }

    console.log('\n🎉 Seed complete! Your data is now in MongoDB Atlas.\n');
  } finally {
    await client.close();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
