// db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'excel.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS newData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS baseData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL
  );
`);

/**
 * Elimina todos los registros de la tabla especificada.
 *
 * @param {'newData' | 'baseData'} table - La tabla de la que se eliminarán los datos.
 * @returns {void}
 */
export function clearData(table) {
  const stmt = db.prepare(`DELETE FROM ${table}`);
  stmt.run();
}

/**
 * Inserta datos en la tabla especificada.
 *
 * @param {'newData' | 'baseData'} table - La tabla en la que se insertarán los datos.
 * @param {any} data - Los datos a insertar (se almacenan como JSON).
 * @returns {number} El ID del registro insertado.
 */
export function addData(table, data) {
  const stmt = db.prepare(`INSERT INTO ${table} (data) VALUES (?)`);
  const info = stmt.run(JSON.stringify(data));
  return info.lastInsertRowid;
}

/**
 * Obtiene todos los registros de la tabla especificada.
 *
 * @param {'newData' | 'baseData'} table - La tabla de la que se obtendrán los datos.
 * @returns {any[]} Un arreglo con los datos parseados desde JSON.
 */
export function getAllData(table) {
  const stmt = db.prepare(`SELECT data FROM ${table}`);
  const rows = stmt.all();
  return rows.map(row => JSON.parse(row.data));
}

export default db;
