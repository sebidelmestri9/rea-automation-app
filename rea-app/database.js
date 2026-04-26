import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, 'data');

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

export const db = {
  all: (col) => load(col),

  findById: (col, id) => load(col).find(x => x.id === id) ?? null,

  findWhere: (col, fn) => load(col).filter(fn),

  insert: (col, item) => {
    const rows = load(col);
    const row = { id: genId(), createdAt: new Date().toISOString(), ...item };
    rows.push(row);
    save(col, rows);
    return row;
  },

  update: (col, id, patch) => {
    const rows = load(col);
    const i = rows.findIndex(x => x.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
    save(col, rows);
    return rows[i];
  },

  upsert: (col, matchFn, data) => {
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

  remove: (col, id) => {
    const rows = load(col).filter(x => x.id !== id);
    save(col, rows);
  },

  removeWhere: (col, fn) => {
    save(col, load(col).filter(x => !fn(x)));
  },

  replaceAll: (col, rows) => save(col, rows),
};
