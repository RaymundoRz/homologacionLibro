/*  public/comparisonWorker.js (v11-fix + fallback 2025-04-21)
   -----------------------------------------------------------
   - normaliza mejor las celdas
   - añade año de contexto robusto
   - usa '_' cuando falta año
   - incluye Map secundario sin año (mapByVersion) y fallback
   --------------------------------------------------------- */

/* =========================================================
 * CARGA DE XLSX EN EL WORKER
 * =======================================================*/
try {
  importScripts(
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
  );
} catch (e) {
  console.error("Worker: Error al importar XLSX", e);
  self.postMessage({
    error: "No se pudo cargar la librería XLSX en el worker.",
  });
  self.close();
}

/* =========================================================
 * UTILIDADES
 * =======================================================*/
function parseYearAndNote(text) {
  const strText = String(text || "").trim();
  const match   = strText.match(/\b(19|20)\d{2}\b/);
  if (!match) return { year: 0, note: strText };
  const year = Number(match[0]);
  const note = strText.replace(match[0], "").trim();
  return { year, note };
}

function preprocessDataWithYear(data) {
  if (!Array.isArray(data) || data.length === 0) return [];

  let currentYear = 0;
  const processed = [];
  const header = Array.isArray(data[0]) ? [...data[0], "AñoContexto"] : ["AñoContexto"];
  processed.push(header);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 3) continue;

    const tipo = Number(row[0]);

    if (tipo === 3 && row[2] != null) {
      const { year } = parseYearAndNote(row[2]);
      if (year) currentYear = year;
    }

    if (tipo === 4 && currentYear === 0) {
      const { year: inlineYear } = parseYearAndNote(row[2]);
      if (inlineYear) currentYear = inlineYear;
    }

    processed.push([...row, currentYear]);
  }
  return processed;
}

function normalizeData(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const header = data[0];
  if (!Array.isArray(header)) return data;
  const tempIdx = header.findIndex((c) => String(c).toLowerCase().includes("temp"));
  if (tempIdx === -1) return data;

  return data.map((row) =>
    Array.isArray(row) ? row.filter((_, i) => i !== tempIdx) : row
  );
}

const normalizeCell = (value) => {
  if (value === null || value === undefined) return "";
  let normalized = String(value).toLowerCase().trim();   // trim antes
  normalized = normalized.replace(/[\$,]/g, "");
  normalized = normalized.replace(/\s+/g, " ").trim();   // trim después
  const num = parseFloat(normalized);
  return !isNaN(num) && num.toString() === normalized ? num.toString() : normalized;
};

const getKey = (row) => {
  if (!Array.isArray(row) || row.length === 0) return "invalid|invalid|invalid";

  const type    = normalizeCell(row[0]);
  const rawYear = normalizeCell(row[row.length - 1]);    // siempre última col
  const year    = rawYear && rawYear !== "0" ? rawYear : "_";
  const version = row[2]
    ? String(row[2]).trim().replace(/\s+/g, " ").toLowerCase()
    : "";

  return `${type}|${year}|${version}`;   /* ← plantilla completa */
};

/* =========================================================
 * WORKER – MANEJADOR DE MENSAJES
 * =======================================================*/
self.onmessage = function (event) {
  const { currentFileContent, referenceFileContent } = event.data;
  if (!self.XLSX || !currentFileContent || !referenceFileContent) return;

  let cleanCurrent = null;
  let differenceSet = new Set();
  let referenceVersions = new Map();   // Map con año

  try {
    /* ------------ 1. Procesar ARCHIVO BASE ------------ */
    const baseWB  = XLSX.read(currentFileContent, { type:"binary", cellStyles:false, sheetStubs:true });
    const baseRaw = XLSX.utils.sheet_to_json(
                     baseWB.Sheets[baseWB.SheetNames[0]],
                     { header:1, defval:"", blankrows:false });
    cleanCurrent  = normalizeData(preprocessDataWithYear(baseRaw));

    /* ------------ 2. Procesar ARCHIVO NUEVO ----------- */
    const refWB   = XLSX.read(referenceFileContent, { type:"binary", cellStyles:false, sheetStubs:true });
    const refRaw  = XLSX.utils.sheet_to_json(
                     refWB.Sheets[refWB.SheetNames[0]],
                     { header:1, defval:"", blankrows:false });
    const cleanReference = normalizeData(preprocessDataWithYear(refRaw));

    /* --- Poblar Map de Referencia (con y sin año) --- */
    const mapByVersion = new Map();           // NUEVO

    cleanReference.slice(1).forEach((row) => {
      if (!Array.isArray(row)) return;

      const kFull = getKey(row);              // type|year|version
      if (kFull === "invalid|invalid|invalid") return;

      const kNoYear = kFull.replace(/\|[^|]*\|/, "||"); // type||version

      referenceVersions.set(kFull, row);      // Map con año
      mapByVersion.set(kNoYear, row);         // Map sin año  (NUEVO)
    });
    /* cleanReference = null;   <-- si quieres liberar memoria */

    /* ------------ 3. Comparar fila a fila ------------- */
    const COLS = 5;
    for (let i = 1; i < cleanCurrent.length; i++) {
      const baseRow = cleanCurrent[i];
      if (!Array.isArray(baseRow)) continue;

      /* --- Obtener fila de referencia (con fallback sin año) --- */
      const keyFull = getKey(baseRow);
      if (keyFull === "invalid|invalid|invalid") continue;

      const keyNoYear = keyFull.replace(/\|[^|]*\|/, "||");   // NUEVO

      let refRow = referenceVersions.get(keyFull);
      if (!refRow) refRow = mapByVersion.get(keyNoYear);      // <-- Fallback NUEVO

      if (!refRow) {
        console.log(`*** Row ${i - 1}: NO match para key="${keyFull}" ni "${keyNoYear}"`);
      }

      /* ---- Comparar columnas 0..4 ---- */
      for (let j = 0; j < COLS; j++) {
        const baseValNorm = normalizeCell(baseRow[j]);
        const refValNorm  =
          refRow && j < refRow.length ? normalizeCell(refRow[j]) : "";

        const isDifferent =
          !(baseValNorm === "" && refValNorm === "") && baseValNorm !== refValNorm;

        if (isDifferent) differenceSet.add(`${i - 1}:${j}`);

        console.log(
          `Row ${i - 1} / Col ${j}  ->  base:"${baseValNorm}"  vs  ref:"${refValNorm}"  ==> diff=${isDifferent}`
        );
      }
    }

    /* ------------ 4. Enviar resultado ---------------- */
    console.log(`Worker: Enviando ${cleanCurrent.length} filas y ${differenceSet.size} diferencias`);
    self.postMessage({
      displayData: cleanCurrent,
      differences: Array.from(differenceSet),
    });
  } catch (err) {
    console.error("Worker error:", err);
    self.postMessage({ error: `Worker Error: ${err.message || "desconocido"}` });
  } finally {
    cleanCurrent = null;
    differenceSet = null;
    referenceVersions = null;
  }
};
