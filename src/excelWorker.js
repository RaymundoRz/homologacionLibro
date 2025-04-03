// src/excelWorker.js

// Carga la librería XLSX en el Worker usando importScripts
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

self.onmessage = function (event) {
  const { fileData } = event.data;
  try {
    console.log("Worker: Recibí el contenido del archivo.");
    // Lee el workbook usando XLSX
    const workbook = XLSX.read(fileData, { type: 'binary' });
    console.log("Worker: Workbook leído, hojas:", workbook.SheetNames);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: true,
    });
    console.log("Worker: jsonData length:", jsonData.length);
    
    // Procesa los datos en chunks
    const chunkSize = 1000; // Ajusta según tus necesidades
    const totalChunks = Math.ceil(jsonData.length / chunkSize);
    let result = [];
    
    function processChunk(chunkIndex) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, jsonData.length);
      for (let i = start; i < end; i++) {
        result.push(jsonData[i]);
      }
      
      // Envía el progreso al hilo principal
      self.postMessage({ progress: Math.round(((chunkIndex + 1) / totalChunks) * 100) });
      
      if (chunkIndex + 1 < totalChunks) {
        setTimeout(() => processChunk(chunkIndex + 1), 0);
      } else {
        console.log("Worker: Procesamiento completo.");
        self.postMessage({ result });
      }
    }
    
    processChunk(0);
  } catch (error) {
    console.error("Worker error:", error);
    self.postMessage({ error: error.message });
  }
};
