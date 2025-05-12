// src/assets/ComparisonView.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import "../App.css"; // Asegúrate que la ruta a App.css sea correcta
import * as XLSX from "xlsx"; // Necesario para parseo en hilo principal (para modalData)
import { Button, CircularProgress, Typography, Box, Alert } from "@mui/material"; 
// Otros imports que necesites para PDF, Ventanas Flotantes, etc.
import pdfjsLib from "./pdfWorker"; // Ajusta ruta si es necesario
import FloatingWindow from "./FloatingWindow.jsx"; // Ajusta ruta si es necesario
import DataModal from '../components/DataModal';
import EditableExcelTable from '../components/EditableExcelTable'; 
import { ComparisonViewer } from '../components/ComparisonViewer'; // El viewer simplificado
import { Pagination } from '@mui/material';

/* ============================================================
   LÓGICA DE TRANSFORMACIÓN (para Archivo Nuevo)
   ============================================================ */

// 1. Extrae el año y texto restante de una cadena
function parseYearAndNote(text: string): { year: number; note: string } {
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (!match) return { year: 0, note: text.trim() };
  const year = Number(match[0]);
  const note = text.replace(match[0], "").trim();
  return { year, note };
}

// 2. Prioridad para ordenar condiciones
function getNotePriority(note: string): number {
  const lower = note.toLowerCase();
  if (lower.includes("nueva")) return 1;
  if (lower.includes("usada")) return 2;
  return 3;
}

// 3. Inserta ceros antes y después de tipos específicos
/** Inserta un único 0 antes de cada fila cuyo tipo sea 1 o 2,
 *  únicamente si la fila está en posición ≥10 y encima NO hay ya un 0
 */
function adjustTipoColumn(rows: any[][]): any[][] {
  const result: any[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tipo = Number(row[0]);

    // Solo a partir de la fila 10 (i >= 10), y solo para tipos 1 o 2
    if (i >= 10 && (tipo === 1 || tipo === 2)) {
      // Si la fila anterior ya no es un 0, mete uno
      const prevTipo = result.length
        ? Number(result[result.length - 1][0])
        : null;
      if (prevTipo !== 0) {
        result.push([0, ...Array(row.length - 1).fill('')]);
      }
    }

    // Empuja la fila real
    result.push(row);
  }
  return result;
}




// 4. Reordena años y condiciones dentro de una sección
function reorderYearsInSection(sectionRows: any[][]): any[][] {
  const subBlocks: { year: number; note: string; rows: any[][] }[] = [];
  let currentBlock: { year: number; note: string; rows: any[][] } | null = null;

  for (let i = 0; i < sectionRows.length; i++) {
    const row = sectionRows[i];
    const tipo = Number(row[0]);

    if (tipo === 3) {
      const versionText = row[2] || "";
      const { year, note } = parseYearAndNote(versionText);
      if (currentBlock) subBlocks.push(currentBlock);
      currentBlock = { year, note, rows: [row] };
    } else if (tipo === 4 && currentBlock) {
      currentBlock.rows.push(row);
    }
  }
  if (currentBlock) subBlocks.push(currentBlock);

  subBlocks.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return getNotePriority(a.note) - getNotePriority(b.note);
  });

  const result: any[][] = [];
  if (sectionRows.length > 0 && Number(sectionRows[0][0]) === 2) {
    result.push(sectionRows[0]);
  }
  subBlocks.forEach(block => result.push(...block.rows));
  return result;
}

// 5. Aplica reordenamiento a todo el archivo
function reorderAll(worksheet: any[][]): any[][] {
  if (!worksheet || worksheet.length === 0) return [];
  const header = worksheet[0];
  const dataRows = worksheet.slice(1);
  const result: any[][] = [header];

  let currentSection: any[][] = [];
  let inSection = false;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const tipo = Number(row[0]);

    if (tipo === 2) {
      if (inSection && currentSection.length > 0) {
        const reordered = reorderYearsInSection(currentSection);
        result.push(...reordered);
      }
      currentSection = [row];
      inSection = true;
    } else if (inSection) {
      currentSection.push(row);
    } else {
      result.push(row);
    }
  }

  if (inSection && currentSection.length > 0) {
    const reordered = reorderYearsInSection(currentSection);
    result.push(...reordered);
  }

  return result;
}

// 6. Formatea modelos, versiones, condiciones y limpia campos
function formatVehicleData(data: any[][]): any[][] {
  const formattedData = [];
  let currentModel = '';
  if (data.length > 0) formattedData.push(data[0]);

  for (let i = 1; i < data.length; i++) {
    const row = [...data[i]];
    const rowType = Number(row[0]) || 0;

    if (rowType === 2) {
      currentModel = row[2] || '';
      formattedData.push(row);
    } else if (rowType === 3) {
      const versionText = row[2] || '';
      const yearMatch = versionText.match(/(20\d{2})/);
      const conditionMatch = versionText.match(/Unidades (Nuevas|Usadas)/);
      const year = yearMatch ? yearMatch[1] : '';
      const condition = conditionMatch ? `Unidades ${conditionMatch[1]}` : '';
      row[2] = `${year} ${currentModel}`.trim();
      row[3] = condition;
      if (row.length > 4) row[4] = '';
      formattedData.push(row);
    } else if (rowType === 4) {
      if (typeof row[3] === 'string') {
        row[3] = row[3].replace('Lista', '').trim();
      }
      formattedData.push(row);
    } else {
      formattedData.push(row);
    }
  }

  return formattedData;
}

// 7. PROCESO PRINCIPAL DE TRANSFORMACIÓN
function processNewData(worksheet: any[][]): any[][] {
  if (!worksheet || worksheet.length === 0) return [];

  const newData = JSON.parse(JSON.stringify(worksheet));
  const result: any[][] = [newData[0]]; // Encabezado

  let filaOriginal = 1; // Empieza después del header

  // Regla especial: eliminar ceros solo en filas 1 y 3 (índices 1 y 3) si están en las primeras 10 filas
  const rowsToDelete = [1, 3];
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    const idx = rowsToDelete[i];
    if (idx < 10 && newData[idx] && Number(newData[idx][0]) === 0) {
      console.log(`🗑️ Eliminando cero en fila original ${idx + 1}`);
      newData.splice(idx, 1);
    }
  }

  for (let i = 1; i < newData.length; i++, filaOriginal++) {
    const currentRow = newData[i];
    const tipo = Number(currentRow[0]);
    const prevRow = result[result.length - 1];
    const prevTipo = Number(prevRow?.[0]);

    const estaEnPrimeras10Filas = filaOriginal < 10;
    const esMarcaOMod = tipo === 1 || tipo === 2;
    const prevNoEsCero = prevTipo !== 0;

    // En filas >10, solo insertar ceros si no hay uno antes
    if (!estaEnPrimeras10Filas && esMarcaOMod && prevNoEsCero) {
      console.log(`✅ Insertando cero antes de fila original ${filaOriginal + 1} (Tipo ${tipo})`);
      result.push([0, ...Array(currentRow.length - 1).fill('')]);
    }

    // En filas >10, no eliminar ningún cero ya existente
    if (!(tipo === 0 && filaOriginal >= 10)) {
      result.push(currentRow);
    } else {
      console.log(`⚠️ Omitido cero ya existente en fila original ${filaOriginal + 1}`);
      result.push(currentRow); // O mantenlo si decides no eliminar ninguno
    }
  }

  const formatted = formatVehicleData(result);     // Aplicar formatos extra
  const reordered = reorderAll(formatted);         // Reordenar si es necesario
  const withZeros = adjustTipoColumn(reordered);
  console.log("🔥 Resultado FINAL con ceros:", withZeros);

  return withZeros;
}






// Formatea datos SÓLO para el modal de vista previa "Nuevo (Modificado)"
function formatVehicleDataForModal(data: any[][]): any[][] { 
  const formattedData = [];
  let currentModel = '';
  if (data.length > 0 && Array.isArray(data[0])) {
      formattedData.push(data[0]); 
  } else {
      return [['Error: Cabecera inválida en datos para modal']];
  }
  
  for (let i = 1; i < data.length; i++) {
    if (!Array.isArray(data[i]) || data[i].length < 3) { 
        console.warn(`Fila ${i} inválida para formatVehicleDataForModal`, data[i]);
        continue; 
    }
    const row = [...data[i]]; 
    const rowType = Number(row[0]) || 0;

    if (rowType === 2) { 
        currentModel = String(row[2] ?? ''); 
        formattedData.push(row); 
    } else if (rowType === 3) {
      const versionText = String(row[2] ?? '');
      const yearMatch = versionText.match(/(20\d{2})/);
      const conditionMatch = versionText.match(/Unidades (Nuevas|Usadas)/i); 
      const year = yearMatch ? yearMatch[1] : '';
      const condition = conditionMatch ? conditionMatch[0] : ''; 
      row[2] = `${year} ${currentModel}`.trim(); 
      row[3] = condition; 
      if(row.length > 4) row[4] = ''; 
      formattedData.push(row);
    } else if (rowType === 4) { 
      if (row.length > 3 && typeof row[3] === 'string') {
         row[3] = row[3].replace(/Lista/gi, '').trim(); 
      }
      formattedData.push(row);
    } else { 
        formattedData.push(row); 
    }
  }
  return formattedData;
}

// ============================================================
// === Componente Principal ComparisonView =====================
// ============================================================
function ComparisonView() {
  // Contenidos crudos leídos de los archivos
  const [newFileContent, setNewFileContent] = useState<string | ArrayBuffer | null>(null);
  const [baseFileContent, setBaseFileContent] = useState<string | ArrayBuffer | null>(null);
  
  // Estado para el modal "Nuevo Modificado"
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any[][] | null>(null); // Datos procesados para este modal

  // Datos Base procesados listos para mostrar en Comparación (recibidos del worker)
  const [comparisonDisplayData, setComparisonDisplayData] = useState<any[][] | null>(null);
  
  // Resultado (solo diferencias) del Worker
  const [processedBaseData, setProcessedBaseData] = useState<any[][] | null>(null);
  const [comparisonDifferences, setComparisonDifferences] = useState<Set<string> | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [debugExamples, setDebugExamples] = useState<any[]>([]); // Para guardar ejemplos del worker
  
  // Estados de UI generales
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [zIndices, setZIndices] = useState({ archivo: 1300, comparacion: 1301 });
  // Estados para otras ventanas flotantes
  const [pdfFile, setPdfFile] = useState<ArrayBuffer | null>(null); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPdfWindowOpen, setIsPdfWindowOpen] = useState(false);
  const [isPreviewWindowOpen, setIsPreviewWindowOpen] = useState(false);
  const [minimizedWindows, setMinimizedWindows] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[][] | null>(null); // Datos raw para preview


  const workerRef = useRef<Worker | null>(null);

  const PAGE_SIZE = 100;
  const [newPage, setNewPage] = useState(1);
  const [comparePage, setComparePage] = useState(1);

  // Limpieza del worker al desmontar
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        console.log("Terminando worker...");
        workerRef.current.terminate();
      }
    };
  }, []);

  // --- Funciones Z-index ---
  const bringArchivoFront = () => setZIndices({ archivo: 1400, comparacion: 1300 });
  const bringComparacionFront = () => setZIndices({ archivo: 1300, comparacion: 1400 });
  
  // --- Funciones Ventanas Flotantes ---
  const handleClosePdfWindow = () => setIsPdfWindowOpen(false);
  const handleClosePreviewWindow = () => setIsPreviewWindowOpen(false);
   const handleMinimizeWindow = (title: string) => {
    setMinimizedWindows(prev => [...prev, title]);
    if (title === "PDF") setIsPdfWindowOpen(false);
    if (title === "Vista Previa") setIsPreviewWindowOpen(false);
    // Considera si necesitas la ventana "Nuevo" separada
  };
  const restoreWindow = (title: string) => {
    setMinimizedWindows(prev => prev.filter(t => t !== title));
    if (title === "PDF") setIsPdfWindowOpen(true);
    if (title === "Vista Previa") setIsPreviewWindowOpen(true);
    // if (title === "Nuevo") setIsNewWindowOpen(true);
  };
    const MinimizedWindowsBar = () => (
    <div className="minimized-windows-bar">
      {minimizedWindows.map((title, index) => (
        <button key={index} onClick={() => restoreWindow(title)}>{title}</button>
      ))}
    </div>
  );
   const renderPdf = useCallback(() => { 
    const canvas = canvasRef.current;
    if (!canvas || !pdfFile) return;
    const context = canvas.getContext('2d');
    if (!context) return;
     try {
       const loadingTask = pdfjsLib.getDocument(pdfFile); 
       loadingTask.promise.then(pdf => {
         pdf.getPage(1).then(page => {
           const viewport = page.getViewport({ scale: 1.5 });
           canvas.height = viewport.height;
           canvas.width = viewport.width;
           const renderContext = { canvasContext: context, viewport: viewport };
           page.render(renderContext);
         });
       }).catch(pdfError => {
           console.error("Error al cargar PDF con pdfjs:", pdfError);
           alert(`Error al cargar PDF: ${pdfError.message}`);
       });
     } catch (error) {
        console.error("Error renderizando PDF:", error);
        alert("Error inesperado al mostrar PDF.");
     }
   }, [pdfFile]); 

   useEffect(() => {
     if (isPdfWindowOpen && pdfFile && canvasRef.current) {
       renderPdf();
     }
   }, [isPdfWindowOpen, pdfFile, renderPdf]);


  // Función para cargar archivos 
 // Función para cargar archivos CORREGIDA
 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'new' | 'base' | 'pdf') => {
  const file = e.target.files?.[0];
  if (!file) return;

  // --- Reset logic based on upload type ---
  // Siempre limpiar resultados de comparación y errores
  setComparisonDisplayData(null); 
  setComparisonDifferences(null);
  setComparisonError(null);
  setIsComparisonModalOpen(false); 
  setDebugExamples([]);

  if (type === 'new') {
      console.log("Nuevo archivo cargado, limpiando datos anteriores...");
      setModalData(null);        // Resetear vista previa del nuevo
      setModalOpen(false);
      setNewFileContent(null);   // Limpiar contenido crudo anterior explícitamente
      setPreviewData(null);      // Limpiar vista previa raw también
      setBaseFileContent(null);  // limpia el base también para una comparación nueva.
  } else if (type === 'base') {
      console.log("Archivo base cargado, limpiando contenido base anterior...");
       setBaseFileContent(null); // Limpiar contenido crudo anterior explícitamente
       // ¡Importante! NO limpiar newFileContent ni modalData aquí
  }
  // --- Fin Reset ---

  if (type === 'pdf') { 
      const reader = new FileReader();
      reader.onload = (event) => {
          if(event.target?.result instanceof ArrayBuffer) { 
              setPdfFile(event.target.result); 
          } else { console.error("FileReader no devolvió ArrayBuffer para PDF"); }
      }
      reader.onerror = (error) => console.error("Error FileReader PDF:", error);
      reader.readAsArrayBuffer(file); 
  } else { // 'new' or 'base'
      const reader = new FileReader();
      reader.onload = (event) => {
          const fileContent = event.target?.result;
          if (!fileContent || typeof fileContent !== 'string') { 
              console.error("FileReader no devolvió string binario para Excel");
              alert("Error leyendo contenido del archivo Excel.");
              return; 
          }

          if (type === 'new') {
              console.log("Contenido Archivo Nuevo listo.");
              setNewFileContent(fileContent); // Guardar contenido NUEVO
              // Procesar SOLO para el modal de vista previa
              try {
                  console.log("Procesando vista previa para modal Nuevo...");
                  const workbook = XLSX.read(fileContent, { type: 'binary', cellStyles:false, sheetStubs: true });
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false }); 
                  const processedPreview = processNewData(worksheet);
                  setPreviewData(processedPreview);
 // Guarda datos raw para la otra ventana flotante "Vista Previa (Raw)"
 setModalData(processedPreview);
 setNewPage(1);  
                  console.log("Vista previa procesada para modal.");
              } catch (error: any) { 
                  console.error("Error al procesar vista previa:", error);
                  setModalData([['Error al procesar vista previa:', error.message]]);
              }
          } else if (type === 'base') {
              console.log("Contenido Archivo Base listo.");
              setBaseFileContent(fileContent); // Guardar contenido BASE
          }
      };
      reader.onerror = (error) => { console.error("Error FileReader:", error); alert("Error al leer archivo.");};
      reader.readAsBinaryString(file); 
  }
};

  // Función para INICIAR COMPARACIÓN EN WORKER (CORREGIDA)
  const processAndCompare = useCallback(() => {
    // 1. Validar que tenemos el contenido crudo de ambos archivos
    if (!baseFileContent || !newFileContent) {
      alert("Carga ambos archivos (Base y Nuevo) primero.");
      return;
    }

    // 2. Terminar cualquier worker anterior si estuviera activo
    if (workerRef.current) {
        console.log("Terminando worker anterior...");
        workerRef.current.terminate();
    }

    // 3. Actualizar estado de UI para indicar inicio de comparación
    console.log("Hilo Principal: Iniciando Worker para comparación...");
    setIsComparing(true);
    setComparisonError(null);
    setProcessedBaseData(null); // Limpiar datos anteriores
    setComparisonDifferences(null);
    setDebugExamples([]); 
    setIsComparisonModalOpen(true); // Abrir modal para mostrar progreso/resultado

    try {
        // 4. Crear el nuevo Worker
        // Asegúrate que la ruta '/comparisonWorker.js' sea correcta (relativa a 'public')
        workerRef.current = new Worker('/comparisonWorker.js'); 

        // 5. Definir cómo manejar los mensajes RECIBIDOS del worker
        workerRef.current.onmessage = (event) => { 
             // Extraer datos del mensaje del worker
             const { displayData, differences, error, debugExamples: examples } = event.data;
             
             setIsComparing(false); // Indicar que la comparación terminó (éxito o error)

             if (error) {
                // Si el worker envió un error
                console.error("Error recibido del worker:", error);
                setComparisonError(error);
                setProcessedBaseData(null); // Limpiar datos en caso de error
                setComparisonDifferences(null);
             } else if (displayData && differences) {
                // Si el worker envió resultados válidos
                console.log(`Hilo Principal: Recibido displayData (${displayData.length} filas) y differences (${differences.length} coords).`);
                // ---> Log 1: Ver el array differences que llegó <---
                console.log(`Main thread received differences array:`, JSON.stringify(differences));
                const diffSet = new Set(differences); // Crear Set
                
                // ---> Log 2: Ver el contenido del Set creado <---
                console.log('Main thread created Set:', diffSet);

                // === ¡AQUÍ SE ACTUALIZA EL ESTADO CON LOS DATOS DEL WORKER! ===
                setComparisonDisplayData(displayData);
                setComparePage(1);
                setComparisonDifferences(new Set(differences)); // Guardar diferencias como Set
                if (examples) setDebugExamples(examples); // Guardar ejemplos de debug
                // ==============================================================
             } else {
                // Mensaje inesperado
                console.warn("Mensaje vacío o inesperado del worker:", event.data);
                setComparisonError("Respuesta inesperada o vacía del worker.");
                setProcessedBaseData(null);
                setComparisonDifferences(null);
             }
             
             // Terminar el worker después de recibir el mensaje
             if (workerRef.current) workerRef.current.terminate(); 
             workerRef.current = null;
        };

        // 6. Definir cómo manejar ERRORES del propio worker
        workerRef.current.onerror = (error) => { 
             console.error("Error irrecuperable en Worker:", error);
             setComparisonError(`Error grave en Worker: ${error.message}`);
             setIsComparing(false);
             setProcessedBaseData(null); 
             setComparisonDifferences(null);
             if (workerRef.current) workerRef.current.terminate();
             workerRef.current = null;
        };

        // 7. Enviar los contenidos CRUDOS al worker para que ÉL procese todo
        console.log(`Hilo Principal: Enviando contenidos crudos al Worker.`);
        workerRef.current.postMessage({
            currentFileContent: baseFileContent, // Contenido crudo del Archivo Base
            referenceFileContent: newFileContent // Contenido crudo del Archivo Nuevo
        });
       
    } catch (error: any) {
        // Error al *crear* el worker o al *enviar* el primer mensaje (raro)
        console.error("Error al crear/llamar al worker:", error);
        setComparisonError(`Error iniciando comparación: ${error.message}`);
        setIsComparing(false);
         if (workerRef.current) workerRef.current.terminate(); 
         workerRef.current = null;
    }
  }, [baseFileContent, newFileContent]); // Dependencias correctas: los contenidos crudos

  // === AÑADE ESTOS LOGS AQUÍ ===
  console.log('--- Render Check ---');
  console.log('modalData:', modalData ? `Tipo: ${typeof modalData}, Longitud: ${modalData?.length}` : modalData);
  console.log('baseFileContent:', baseFileContent ? `Tipo: ${typeof baseFileContent}, Longitud: ${baseFileContent?.length}` : baseFileContent);
  console.log('newFileContent:', newFileContent ? `Tipo: ${typeof newFileContent}, Longitud: ${newFileContent?.length}` : newFileContent);
  console.log('isComparing:', isComparing);

  console.log('--- Render Check FINAL ---');
console.log('isComparing:', isComparing);
console.log('comparisonError:', comparisonError);
console.log('comparisonDisplayData:', comparisonDisplayData ? `Tiene ${comparisonDisplayData.length} filas` : comparisonDisplayData);
console.log('comparisonDifferences:', comparisonDifferences ? `Tiene ${comparisonDifferences.size} diferencias` : comparisonDifferences);

// Datos paginados para modal "Archivo Nuevo"
// 1) Asegúrate de que modalData no sea null y tenga al menos una fila de encabezado
const allNewData = modalData || [];
const newHeader = allNewData[0] || [];             // fila 0
const newDataRows = allNewData.slice(1);           // resto de filas

// 2) Calcula páginas
const newTotalPages = Math.ceil(newDataRows.length / PAGE_SIZE);
const currentNewRows = newDataRows.slice(
  (newPage - 1) * PAGE_SIZE,
  newPage * PAGE_SIZE
);

// 3) Anteponer el encabezado a la página
const newPageData = [newHeader, ...currentNewRows];


// Datos paginados para modal "Comparación"
const allCompareData = comparisonDisplayData || [];
const compareHeader = allCompareData[0] || [];
const compareDataRows = allCompareData.slice(1);

const compareTotalPages = Math.ceil(compareDataRows.length / PAGE_SIZE);
const currentCompareRows = compareDataRows.slice(
  (comparePage - 1) * PAGE_SIZE,
  comparePage * PAGE_SIZE
);

const comparePageData = [compareHeader, ...currentCompareRows];





  // --- Renderizado del Componente ---
  return (
    <div className="admin-container">
      {/* Navbar */}
      <nav className="navbar">
        <h1>Administrador de Datos</h1>
        <div className="navbar-buttons">
          <Button variant="contained">Configuración</Button>
          <Button variant="contained">Ayuda</Button>
        </div>
      </nav>


      {/* Main Content */}
      <div className="main-content">
        <div className="upload-section">
          <h3>Cargar Archivos</h3>
          {/* Inputs */}
          <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'new')} />
          <p>Subir Archivo Nuevo</p>
          <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'base')} />
          <p>Subir Archivo Base</p>
          {/* PDF Input */}
          <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, 'pdf')} />
          <p>Subir PDF</p>
          
          {/* Botón Ver Modal Nuevo */}
           <Button 
            variant="outlined" 
            onClick={() => { setModalOpen(true); bringArchivoFront(); }} // Traer al frente al abrir
            style={{ marginTop: '20px' }}
            disabled={!modalData} 
          >
            Ver Archivo Nuevo (Procesado)
          </Button>

          {/* Botón Iniciar Comparación */}
          <Button 
            variant="contained" 
            onClick={() => { processAndCompare(); bringComparacionFront(); }} // Traer al frente al abrir
            style={{ marginTop: '20px', marginLeft: '10px' }}
            disabled={!baseFileContent || !newFileContent || isComparing} 
          >
            {isComparing ? `Comparando...` : 'Comparar Archivos'}
          </Button>
          {isComparing && <CircularProgress size={24} style={{ marginLeft: 10 }} />} 

          {/* Botones extras */}
           <Button variant="outlined" onClick={() => setIsPreviewWindowOpen(true)} style={{ marginTop: '20px', marginLeft: '10px'  }} disabled={!previewData}>
              Vista Previa (Raw)
           </Button>
           <Button variant="outlined" onClick={() => setIsPdfWindowOpen(true)} style={{ marginTop: '20px', marginLeft: '10px'  }} disabled={!pdfFile}>
              Abrir PDF
           </Button>

        </div>
      </div>
      
      {/* Barra y Ventanas Flotantes */}
       <MinimizedWindowsBar />
       <div className="floating-windows-container">
          {/* Visor PDF */}
          <FloatingWindow
            title="Visor de PDF"
            isOpen={isPdfWindowOpen}
            onClose={handleClosePdfWindow}
            onMinimize={() => handleMinimizeWindow("PDF")}
          >
            <canvas ref={canvasRef} />
          </FloatingWindow>
          {/* Vista Previa Raw */}
           <FloatingWindow
            title="Vista Previa Archivo Nuevo (Raw)"
            isOpen={isPreviewWindowOpen}
            onClose={handleClosePreviewWindow}
            onMinimize={() => handleMinimizeWindow("Vista Previa")}
          >
            {previewData ? (
              <div style={{ padding: '10px', height: 400, width: '100%' }}>
                 {/* Asegúrate que EditableExcelTable maneje bien null/undefined o array vacío */}
                 <EditableExcelTable data={previewData || []} onDataChange={setPreviewData} /> 
              </div>
            ) : ( <p>No hay datos para mostrar</p> )}
          </FloatingWindow>
           {/* Otras Floating Windows si las tienes */}
       </div>

{/* === MODAL "ARCHIVO NUEVO (PROCESADO)" === */}
<DataModal
  open={modalOpen}
  title="Archivo Nuevo (Procesado para Vista)"
  onClose={() => setModalOpen(false)}
  modalStyle={{
    width: '45%',
    top: '10%',
    left: '5%',
    transform: 'none',
    zIndex: zIndices.archivo,
    height: '85vh',
    display: 'flex',
    flexDirection: 'column'
  }}
  onMouseDown={bringArchivoFront}
  data={
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {modalData ? (
        <>
          {/* Área de la tabla con scroll */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <EditableExcelTable
              data={newPageData}
              onDataChange={setModalData}
            />
          </Box>

          {/* Control de paginación */}
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
            <Pagination
              count={newTotalPages}
              page={newPage}
              onChange={(_, p) => setNewPage(p)}
              size="small"
            />
          </Box>
        </>
      ) : (
        <Box sx={{ p: 2 }}>
          Carga un archivo nuevo para ver datos procesados.
        </Box>
      )}
    </Box>
  }
/>

{/* === MODAL DE COMPARACIÓN === */}
<DataModal
  open={isComparisonModalOpen}
  title={
    isComparing
      ? "Comparando..."
      : comparisonError
      ? "Error"
      : "Comparación (Base vs Nuevo)"
  }
  onClose={() => setIsComparisonModalOpen(false)}
  modalStyle={{
    width: '45%',
    top: '10%',
    left: '52%',
    transform: 'none',
    zIndex: zIndices.comparacion,
    display: 'flex',
    flexDirection: 'column',
    height: '85vh'
  }}
  onMouseDown={bringComparacionFront}
  data={
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1 }}>
      {/* Indicador de carga */}
      {isComparing && (
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Procesando y comparando datos...</Typography>
        </Box>
      )}

      {/* Mensaje de error */}
      {comparisonError && (
        <Alert severity="error">Error: {comparisonError}</Alert>
      )}

      {/* Tabla paginada de comparación */}
      {!isComparing && !comparisonError && comparisonDisplayData && comparisonDifferences && (
        <>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <ComparisonViewer
              displayData={comparePageData}
              differences={comparisonDifferences}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
            <Pagination
              count={compareTotalPages}
              page={comparePage}
              onChange={(_, p) => setComparePage(p)}
              size="small"
            />
          </Box>
        </>
      )}

      {/* Mensaje inicial si no hay datos */}
      {!isComparing && !comparisonError && !comparisonDisplayData && (
        <Box sx={{ p: 2 }}>
          Resultados de la comparación aparecerán aquí.
        </Box>
      )}
    </Box>
  }
/>


    </div>
  );
}

// <<< ASEGÚRATE DE QUE ESTA LÍNEA ESTÉ AL FINAL Y NO ESTÉ COMENTADA >>>
export default ComparisonView;