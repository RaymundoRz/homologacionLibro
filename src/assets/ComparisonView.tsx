// src/ComparisonView.tsx
import React, { useState, useRef, useEffect } from 'react';
import "../App.css";
import * as XLSX from "xlsx";
import { Button } from "@mui/material";
import pdfjsLib from "./pdfWorker";
import FloatingWindow from "./FloatingWindow.jsx";
import DataModal from '../components/DataModal';
import EditableExcelTable from '../components/EditableExcelTable';



/* ============================================================
   LÓGICA DE TRANSFORMACIÓN
   ============================================================ */

/**
 * parseYearAndNote:
 * Dado un texto tipo "2025 INTEGRA Unidades Nuevas",
 * extrae el año (p. ej. 2025) y la nota (p. ej. "INTEGRA Unidades Nuevas").
 */
function parseYearAndNote(text: string): { year: number; note: string } {
  // Buscamos un año de 4 dígitos
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (!match) {
    // Si no se encuentra un año, devolvemos año=0 y el texto original
    return { year: 0, note: text.trim() };
  }
  const year = Number(match[0]);
  // Eliminamos el año encontrado para quedarnos con el resto
  const note = text.replace(match[0], "").trim();
  return { year, note };
}


/**
 * getNotePriority:
 * Devuelve un número menor para “Unidades Nuevas”, un número intermedio para “Unidades Usadas”,
 * y un número mayor para cualquier otro caso, de modo que en el sort salgan primero las nuevas,
 * luego las usadas, y luego sin aclaración.
 */
function getNotePriority(note: string): number {
  const lower = note.toLowerCase();
  if (lower.includes("nueva")) return 1;    // "Unidades Nuevas"
  if (lower.includes("usada")) return 2;    // "Unidades Usadas"
  return 3;                                 // Sin aclaración
}


function adjustTipoColumn(rows: any[][]): any[][] {
  // Filtramos las filas 1 y 3 si son ceros
  const filteredRows = rows.filter((row, index) => {
    // Si es la fila 1 o 3 (después del header) y empieza con 0, la eliminamos
    if (index === 1 || index === 3) {
      return row[0] !== 0 && row[0] !== '0';
    }
    return true;
  });

  // Luego aplicamos las reglas de inserción de ceros
  const result: any[][] = [];
  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];
    const tipo = Number(row[0]);
    
    if (tipo === 1) {
      // Insertar 0 antes y después de tipo 1
      if (result.length === 0 || Number(result[result.length - 1][0]) !== 0) {
        result.push([0, ...Array(row.length - 1).fill('')]);
      }
      result.push(row);
      if (i === filteredRows.length - 1 || Number(filteredRows[i + 1]?.[0]) !== 0) {
        result.push([0, ...Array(row.length - 1).fill('')]);
      }
    } else if (tipo === 2) {
      // Insertar 0 antes de tipo 2
      if (result.length === 0 || Number(result[result.length - 1][0]) !== 0) {
        result.push([0, ...Array(row.length - 1).fill('')]);
      }
      result.push(row);
    } else {
      result.push(row);
    }
  }

  return result;
}




/**
 * reorderYearsInSection:
 * Dentro de una sección (iniciada por un tipo=2), agrupa sub-bloques tipo=3 y sus versiones tipo=4,
 * luego ordena esos sub-bloques por año desc y por prioridad de nota (nuevas/usadas).
 */
function reorderYearsInSection(sectionRows: any[][]): any[][] {
  // Array de sub-bloques
  const subBlocks: { 
    year: number; 
    note: string; 
    rows: any[][];  // fila tipo=3 y las filas tipo=4 subsecuentes
  }[] = [];

  let currentBlock: { year: number; note: string; rows: any[][] } | null = null;

  // Recorremos las filas de la sección
  for (let i = 0; i < sectionRows.length; i++) {
    const row = sectionRows[i];
    const tipo = Number(row[0]);

    if (tipo === 3) {
      // Cada vez que encontramos tipo=3, iniciamos un sub-bloque nuevo
      // parseamos el texto donde aparece el año
      const versionesText = row[2] || "";
      const { year, note } = parseYearAndNote(versionesText);

      // Si había un bloque anterior en curso, lo cerramos
      if (currentBlock) {
        subBlocks.push(currentBlock);
      }
      currentBlock = {
        year,
        note,
        rows: [row],
      };
    } else if (tipo === 4 && currentBlock) {
      // Si es tipo=4 y hay un bloque en curso, lo agregamos
      currentBlock.rows.push(row);
    } else {
      // Si es tipo=2 (la cabecera de la sección) o tipo≠3/4,
      // lo ignoramos aquí. O podríamos dejarlo para “cabezal”.
      // Suponiendo que la fila con tipo=2 ya la sacamos aparte.
    }
  }

  // Agrega el último bloque si quedó abierto
  if (currentBlock) {
    subBlocks.push(currentBlock);
  }

  // Ordenar por año desc, luego por prioridad de nota
  subBlocks.sort((a, b) => {
    // Primero comparamos año desc
    if (b.year !== a.year) {
      return b.year - a.year;
    }
    // Mismo año: prioridad de nota
    return getNotePriority(a.note) - getNotePriority(b.note);
  });

  // Reconstruir: 
  // - Devolvemos la primera fila si es tipo=2, 
  // - luego todos los sub-bloques en orden
  const result: any[][] = [];
  if (sectionRows.length > 0 && Number(sectionRows[0][0]) === 2) {
    result.push(sectionRows[0]); // la fila del tipo=2
  }
  subBlocks.forEach(block => {
    result.push(...block.rows);
  });

  return result;
}


/**
 * reorderAll:
 * - Toma el worksheet completo (con cabecera).
 * - Separa la cabecera.
 * - Agrupa en “secciones” cada vez que encuentra un tipo=2.
 * - En cada sección, aplica reorderYearsInSection.
 */
function reorderAll(worksheet: any[][]): any[][] {
  if (!worksheet || worksheet.length === 0) return [];

  // 1. Separamos cabecera
  const header = worksheet[0];
  const dataRows = worksheet.slice(1);

  // 2. Recorremos dataRows y cada vez que detectamos un tipo=2 “cerramos” la sección previa
  let result: any[][] = [header];
  let currentSection: any[][] = [];
  let inSection = false;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const tipo = Number(row[0]);

    if (tipo === 2) {
      // Si ya estábamos en una sección, la reordenamos y la añadimos
      if (inSection && currentSection.length > 0) {
        const reordered = reorderYearsInSection(currentSection);
        result.push(...reordered);
      }
      // Iniciamos nueva sección
      currentSection = [row];
      inSection = true;
    } else if (inSection) {
      // Mientras estemos en sección
      currentSection.push(row);
    } else {
      // Fila fuera de sección => va directo a result
      result.push(row);
    }
  }

  // Al final, si quedó una sección abierta, la reordenamos
  if (inSection && currentSection.length > 0) {
    const reordered = reorderYearsInSection(currentSection);
    result.push(...reordered);
  }

  return result;
}


/**
 * Función processNewData:
 * Aplica filtros previos, ajusta la columna Tipo y reordena el archivo.
 */
function processNewData(worksheet: any[][]): any[][] {
  if (!worksheet || worksheet.length === 0) return [];

  // 1. Clonamos el array para no modificar el original
  const newData = JSON.parse(JSON.stringify(worksheet));

  // 2. Eliminamos específicamente las filas 1 y 3 (A2 y A4) si son ceros
  const rowsToCheck = [1, 3];
  for (let i = rowsToCheck.length - 1; i >= 0; i--) {
    const rowIndex = rowsToCheck[i];
    if (newData[rowIndex] && (newData[rowIndex][0] === 0 || newData[rowIndex][0] === '0')) {
      newData.splice(rowIndex, 1);
    }
  }

  // 3. Identificamos y marcamos el primer 2 para NO modificarlo
  let firstTwoIndex = -1;
  for (let i = 0; i < newData.length; i++) {
    if (newData[i][0] === 2 || newData[i][0] === '2') {
      firstTwoIndex = i;
      break;
    }
  }

  // 4. Aplicamos reglas a todos los 2 excepto al primero
  const result: any[][] = [];
  for (let i = 0; i < newData.length; i++) {
    const row = newData[i];
    const tipo = Number(row[0]) || 0;

    if ((tipo === 2 || row[0] === '2') && i !== firstTwoIndex) {
      // Insertar 0 antes de tipo 2 (excepto para el primer 2)
      if (result.length === 0 || Number(result[result.length - 1][0]) !== 0) {
        result.push([0, ...Array(row.length - 1).fill('')]);
      }
      result.push(row);
    } else {
      result.push(row);
    }
  }

  return result;
}




function ComparisonView() {
  const [newData, setNewData] = useState<any>(null);
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPdfWindowOpen, setIsPdfWindowOpen] = useState(false);
  const [isPreviewWindowOpen, setIsPreviewWindowOpen] = useState(false);
  const [minimizedWindows, setMinimizedWindows] = useState<string[]>([]);
  const [isNewWindowOpen, setIsNewWindowOpen] = useState(false);

  // Estado del modal para mostrar la data transformada
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  // Ventanas flotantes
  const handleClosePdfWindow = () => setIsPdfWindowOpen(false);
  const handleClosePreviewWindow = () => setIsPreviewWindowOpen(false);
  const handleMinimizeWindow = (title: string) => {
    setMinimizedWindows(prev => [...prev, title]);
    if (title === "PDF") setIsPdfWindowOpen(false);
    if (title === "Vista Previa") setIsPreviewWindowOpen(false);
    if (title === "Nuevo") setIsNewWindowOpen(false);
  };
  const restoreWindow = (title: string) => {
    setMinimizedWindows(prev => prev.filter(t => t !== title));
    if (title === "PDF") setIsPdfWindowOpen(true);
    if (title === "Vista Previa") setIsPreviewWindowOpen(true);
    if (title === "Nuevo") setIsNewWindowOpen(true);
  };
  const MinimizedWindowsBar = () => (
    <div className="minimized-windows-bar">
      {minimizedWindows.map((title, index) => (
        <button key={index} onClick={() => restoreWindow(title)}>{title}</button>
      ))}
    </div>
  );

  // Renderiza el PDF en un canvas
  useEffect(() => {
    if (isPdfWindowOpen && pdfFile) {
      const canvas = canvasRef.current;
      if (canvas) renderPdf();
    }
  }, [isPdfWindowOpen, pdfFile]);

  // Función para manejar la carga de archivos (Excel y PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'new' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'pdf') {
      setPdfFile(file);
    } else if (type === 'new') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const binaryStr = event.target?.result;
        if (typeof binaryStr !== 'string') return;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
          defval: '',
          blankrows: true,
        });
        // Guarda la data original y de vista previa
        setNewData(worksheet);
        setPreviewData(worksheet);
        // Guarda en SQLite vía IPC (asumiendo que window.api está configurado en preload)
        await window.api.clearData('newData');
        await window.api.addData('newData', worksheet);
      };
      reader.readAsBinaryString(file);
    }
  };

  // Dentro del componente ComparisonView...

const handleExportExcel = () => {
    // 1. Verifica que haya datos para exportar
    if (!newData || newData.length === 0) {
      alert("No hay datos procesados para exportar.");
      return;
    }

    console.log("Iniciando exportación a Excel...");

    try {
        // 2. Identifica el índice de la columna "Temp" (insensible a mayúsculas/minúsculas)
        // Asegúrate de que newData[0] exista y sea un array
        if (!newData[0] || !Array.isArray(newData[0])) {
             throw new Error("La cabecera de los datos no es válida.");
        }
        const header = newData[0].map(cell => String(cell).toLowerCase()); // Convertir a string y minúsculas
        const tempColIndex = header.findIndex(col => col === 'temp');

        // 3. Crea una nueva matriz de datos EXCLUYENDO la columna "Temp"
        let dataToExport: any[][];
        if (tempColIndex !== -1) {
            console.log(`Excluyendo columna 'Temp' en el índice: ${tempColIndex}`);
            // Mapea cada fila y filtra la celda en el índice tempColIndex
            dataToExport = newData.map(row =>
                row.filter((_, colIndex) => colIndex !== tempColIndex)
            );
        } else {
            console.warn("La columna 'Temp' no se encontró. Exportando todos los datos.");
            // Si no se encuentra 'Temp', exporta todo (o podrías lanzar un error)
            // Hacemos una copia para no arriesgar la mutación accidental
            dataToExport = JSON.parse(JSON.stringify(newData));
        }

        // 4. Crea la hoja de cálculo a partir de la matriz filtrada
        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);

        // --- Opcional: Ajustar anchos de columna ---
        // Esto es un ejemplo básico, puedes ajustar los valores
        const colWidths = dataToExport[0].map((_, i) => {
             // Asigna anchos diferentes basados en el índice (A, B, C...)
             if (i === 0) return { wch: 8 };  // Tipo
             if (i === 1) return { wch: 15 }; // Clase
             if (i === 2) return { wch: 40 }; // Versiones
             if (i === 3) return { wch: 15 }; // Preciobase
             if (i === 4) return { wch: 15 }; // Preciobase2
             return { wch: 12 }; // Ancho por defecto para otras columnas
        });
        worksheet['!cols'] = colWidths;
        // --- Fin Opcional ---


        // 5. Crea el libro de trabajo y añade la hoja
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datos Procesados"); // Nombre de la hoja

        // 6. Genera el archivo y dispara la descarga
        const fileName = "DatosProcesadosSinTemp.xlsx"; // Nombre del archivo a descargar
        XLSX.writeFile(workbook, fileName);

        console.log(`Archivo "${fileName}" generado para descarga.`);

    } catch (error) {
        console.error("Error al exportar a Excel:", error);
        alert("Ocurrió un error al generar el archivo Excel.");
    }
};

  // Función para renderizar el PDF
  const renderPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas no está disponible.");
      return;
    }
    const context = canvas.getContext('2d');
    const fileReader = new FileReader();
    fileReader.onload = function () {
      const typedArray = new Uint8Array(this.result);
      pdfjsLib.getDocument(typedArray).promise.then(pdf => {
        pdf.getPage(1).then(page => {
          const viewport = page.getViewport({ scale: 1.5 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = { canvasContext: context, viewport: viewport };
          page.render(renderContext);
        });
      });
    };
    fileReader.readAsArrayBuffer(pdfFile);
  };

  // Función para aplicar cambios (filtros, ajustes, reordenamiento) al archivo nuevo
  const handleApplyChanges = async () => {
    if (!newData) {
      alert("No hay un archivo nuevo cargado.");
      return;
    }
    const modifiedData = processNewData(newData);
    console.log("Data transformada:", modifiedData);
    setNewData(modifiedData);
    setModalData(modifiedData);
    setModalOpen(true);
    // Actualizar en SQLite vía IPC
    await window.api.clearData('newData');
    await window.api.addData('newData', modifiedData);
  };

  return (
    <div className="admin-container">
      <nav className="navbar">
        <h1>Administrador de Datos (Electron + SQLite)</h1>
        <div className="navbar-buttons">
          <Button variant="contained">Configuración</Button>
          <Button variant="contained">Ayuda</Button>
        </div>
      </nav>
      <div className="sidebar">
        <ul>
          <li>Mostrar Datos</li>
          <li>Búsqueda en PDF</li>
          <li>Historial</li>
        </ul>
      </div>
      <div className="main-content">
        <div className="upload-section">
          <h3>Cargar Archivos</h3>
          <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'new')} />
          <p>Subir Archivo Nuevo</p>
          <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, 'pdf')} />
          <p>Subir PDF</p>
          <Button variant="contained" onClick={handleApplyChanges} style={{ marginTop: '20px' }}>
            Aplicar Cambios (Archivo Nuevo)
          </Button>
          <Button variant="contained" onClick={() => setIsPreviewWindowOpen(true)} style={{ marginTop: '20px' }}>
            Vista Previa Completa
          </Button>
          <Button variant="contained" onClick={() => setIsPdfWindowOpen(true)} style={{ marginTop: '20px' }}>
            Abrir PDF en Ventana
          </Button>
        </div>
      </div>
      <footer>
        <Button variant="contained" color="primary">Guardar Cambios</Button>
        <Button variant="contained" color="secondary">Exportar Reporte</Button>
        <Button variant="contained" color="error">Cancelar</Button>
      </footer>

      <MinimizedWindowsBar />

      <div className="floating-windows-container">
        <FloatingWindow
          title="Datos del Archivo Nuevo"
          isOpen={isNewWindowOpen}
          onClose={() => setIsNewWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Nuevo")}
        >
          {newData ? (
            <div style={{ height: 400, width: '100%' }}>
              <EditableExcelTable data={newData} onDataChange={(updated) => setNewData(updated)} />
            </div>
          ) : (
            <p>No hay datos para mostrar</p>
          )}
        </FloatingWindow>

        <FloatingWindow
          title="Visor de PDF"
          isOpen={isPdfWindowOpen}
          onClose={handleClosePdfWindow}
          onMinimize={() => handleMinimizeWindow("PDF")}
        >
          <canvas ref={canvasRef} />
        </FloatingWindow>

        <FloatingWindow
          title="Vista Previa Completa del Archivo"
          isOpen={isPreviewWindowOpen}
          onClose={() => setIsPreviewWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Vista Previa")}
        >
          {previewData ? (
            <div style={{ padding: '10px' }}>
              <EditableExcelTable data={previewData} onDataChange={(updated) => setPreviewData(updated)} />
            </div>
          ) : (
            <p>No hay datos para mostrar</p>
          )}
        </FloatingWindow>
      </div>

      <DataModal
        open={modalOpen}
        title="Archivo Nuevo (Modificado)"
        onClose={() => setModalOpen(false)}
        data={<EditableExcelTable data={modalData} onDataChange={(updated) => setModalData(updated)} />}
      />
    </div>
  );
}

export default ComparisonView;
