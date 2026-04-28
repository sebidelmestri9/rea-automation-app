import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, 'data');

const MONGO_URI = process.env.MONGODB_URI;

// ─── MongoDB mode ─────────────────────────────────────────────────────────────
let _client = null;
let _db = null;

async function getMongo() {
  if (_db) return _db;
  _client = new MongoClient(MONGO_URI);
  await _client.connect();
  _db = _client.db('rea-app');
  console.log('[DB] Connected to MongoDB Atlas');
  return _db;
}

function stripMeta(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

// ─── Local file mode (dev fallback) ──────────────────────────────────────────
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) { return join(DATA_DIR, `${name}.json`); }

function load(name) {
  const fp = filePath(name);
  if (!existsSync(fp)) return [];
  try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return []; }
}

function save(name, data) {
  writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Unified async db interface ───────────────────────────────────────────────
export const db = {

  async all(col) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      return (await mdb.collection(col).find({}).toArray()).map(stripMeta);
    }
    return load(col);
  },

  async findById(col, id) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      return stripMeta(await mdb.collection(col).findOne({ id }));
    }
    return load(col).find(x => x.id === id) ?? null;
  },

  async findWhere(col, fn) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      const all = (await mdb.collection(col).find({}).toArray()).map(stripMeta);
      return all.filter(fn);
    }
    return load(col).filter(fn);
  },

  async insert(col, item) {
    const row = { id: genId(), createdAt: new Date().toISOString(), ...item };
    if (MONGO_URI) {
      const mdb = await getMongo();
      await mdb.collection(col).insertOne({ ...row });
      return row;
    }
    const rows = load(col);
    rows.push(row);
    save(col, rows);
    return row;
  },

  async update(col, id, patch) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      const updated = { ...patch, updatedAt: new Date().toISOString() };
      const result = await mdb.collection(col).findOneAndUpdate(
        { id },
        { $set: updated },
        { returnDocument: 'after' }
      );
      return stripMeta(result);
    }
    const rows = load(col);
    const i = rows.findIndex(x => x.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
    save(col, rows);
    return rows[i];
  },

  async upsert(col, matchFn, data) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      const all = (await mdb.collection(col).find({}).toArray()).map(stripMeta);
      const existing = all.find(matchFn);
      if (existing) {
        const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
        await mdb.collection(col).replaceOne({ id: existing.id }, updated);
        return updated;
      }
      const row = { id: genId(), createdAt: new Date().toISOString(), ...data };
      await mdb.collection(col).insertOne({ ...row });
      return row;
    }
    const rows = load(col);
    const i = rows.findIndex(matchFn);
    if (i === -1) {
      const row = { id: genId(), createdAt: new Date().toISOString(), ...data };
      rows.push(row);
      save(col, rows);
      return row;
    }
    rows[i] = { ...rows[i], ...data, updatedAt: new Date().toISOString() };
    save(col, rows);
    return rows[i];
  },

  async remove(col, id) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      await mdb.collection(col).deleteOne({ id });
      return;
    }
    save(col, load(col).filter(x => x.id !== id));
  },

  async removeWhere(col, fn) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      const all = (await mdb.collection(col).find({}).toArray()).map(stripMeta);
      const ids = all.filter(fn).map(x => x.id);
      if (ids.length > 0) await mdb.collection(col).deleteMany({ id: { $in: ids } });
      return;
    }
    save(col, load(col).filter(x => !fn(x)));
  },

  async replaceAll(col, rows) {
    if (MONGO_URI) {
      const mdb = await getMongo();
      await mdb.collection(col).deleteMany({});
      if (rows.length > 0) await mdb.collection(col).insertMany(rows);
      return;
    }
    save(col, rows);
  },
};
