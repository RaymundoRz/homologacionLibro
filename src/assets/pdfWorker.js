import * as pdfjsLib from "pdfjs-dist/build/pdf";

// Configura el worker usando `new URL` para obtener la URL correcta del módulo
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

export default pdfjsLib;
