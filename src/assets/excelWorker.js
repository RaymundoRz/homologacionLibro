// excelWorker.js

// Importa la librería XLSX si es necesario (puedes usar importScripts para cargarla)
// Nota: Algunas versiones de XLSX pueden funcionar en un Worker, pero verifica la compatibilidad.
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

self.onmessage = function (event) {
  const { fileData } = event.data;
  try {
    // Convierte el contenido binario a un workbook de Excel
    const workbook = XLSX.read(fileData, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      blankrows: true,
    });
    // Envía el resultado de vuelta al hilo principal
    self.postMessage({ result: worksheet });
  } catch (error) {
    // En caso de error, lo enviamos de vuelta
    self.postMessage({ error: error.message });
  }
};
