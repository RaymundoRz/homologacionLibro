// src/ComparisonView.tsx
import React, { useState, useRef, useEffect } from 'react';
import "../App.css";
import * as XLSX from "xlsx"; // Si necesitas, para otras tareas
import { Button, TableContainer, Table, TableHead, TableRow, TableBody, TableCell, Paper } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import pdfjsLib from "./pdfWorker"; // Asegúrate de que pdfWorker existe
import FloatingWindow from "./FloatingWindow.jsx";

function ComparisonView() {
  const [newData, setNewData] = useState<any>(null);
  const [baseData, setBaseData] = useState<any>(null);
  const [differencesNew, setDifferencesNew] = useState<any[]>([]);
  const [differencesBase, setDifferencesBase] = useState<any[]>([]);
  const [isNewWindowOpen, setIsNewWindowOpen] = useState(false);
  const [isBaseWindowOpen, setIsBaseWindowOpen] = useState(false);
  const [isPdfWindowOpen, setIsPdfWindowOpen] = useState(false);
  const [isPreviewWindowOpen, setIsPreviewWindowOpen] = useState(false);
  const [isEditWindowOpen, setIsEditWindowOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [editedValue, setEditedValue] = useState('');
  const [minimizedWindows, setMinimizedWindows] = useState<string[]>([]);
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExcelSplitterOpen, setIsExcelSplitterOpen] = useState(false);

  // Manejo de ventanas
  const handleCloseNewWindow = () => setIsNewWindowOpen(false);
  const handleCloseBaseWindow = () => setIsBaseWindowOpen(false);
  const handleClosePdfWindow = () => setIsPdfWindowOpen(false);
  const handleClosePreviewWindow = () => setIsPreviewWindowOpen(false);
  const handleCloseEditWindow = () => setIsEditWindowOpen(false);

  const handleMinimizeWindow = (title: string) => {
    setMinimizedWindows((prev) => [...prev, title]);
    if (title === "Resultados del Archivo Nuevo") {
      setIsNewWindowOpen(false);
    } else if (title === "Resultados del Archivo Base") {
      setIsBaseWindowOpen(false);
    } else if (title === "Visor de PDF") {
      setIsPdfWindowOpen(false);
    } else if (title === "Vista Previa Completa del Archivo") {
      setIsPreviewWindowOpen(false);
    } else if (title === "Editar Celda") {
      setIsEditWindowOpen(false);
    }
  };

  const restoreWindow = (title: string) => {
    setMinimizedWindows((prev) => prev.filter((t) => t !== title));
    if (title === "Resultados del Archivo Nuevo") {
      setIsNewWindowOpen(true);
    } else if (title === "Resultados del Archivo Base") {
      setIsBaseWindowOpen(true);
    } else if (title === "Visor de PDF") {
      setIsPdfWindowOpen(true);
    } else if (title === "Vista Previa Completa del Archivo") {
      setIsPreviewWindowOpen(true);
    } else if (title === "Editar Celda") {
      setIsEditWindowOpen(true);
    }
  };

  const MinimizedWindowsBar = () => (
    <div className="minimized-windows-bar">
      {minimizedWindows.map((title, index) => (
        <button key={index} onClick={() => restoreWindow(title)}>
          {title}
        </button>
      ))}
    </div>
  );

  // Renderiza el PDF en un canvas
  useEffect(() => {
    if (isPdfWindowOpen && pdfFile) {
      const canvas = canvasRef.current;
      if (canvas) {
        renderPdf();
      }
    }
  }, [isPdfWindowOpen, pdfFile]);

  // Función para procesar el archivo Excel usando un Web Worker
  const processFileWithWorker = (file: File) => {
    return new Promise((resolve, reject) => {
      // Crea el Worker (usa new URL para que Vite lo empaquete correctamente)
      const worker = new Worker(new URL('./excelWorker.js', import.meta.url));
      
      worker.onmessage = (event) => {
        if (event.data.progress !== undefined) {
          setProcessingProgress(event.data.progress);
        }
        if (event.data.result) {
          resolve(event.data.result);
          worker.terminate();
        }
        if (event.data.error) {
          reject(event.data.error);
          worker.terminate();
        }
      };
      
      worker.onerror = (err) => {
        reject(err.message);
        worker.terminate();
      };
      
      // Leer el archivo como binario y enviarlo al Worker
      const reader = new FileReader();
      reader.onload = () => {
        worker.postMessage({ fileData: reader.result });
      };
      reader.onerror = () => {
        reject("Error al leer el archivo");
        worker.terminate();
      };
      reader.readAsBinaryString(file);
    });
  };

  // Manejo de carga de archivo (para Excel y PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'new' | 'base' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    if (type === 'pdf') {
      setPdfFile(file);
    } else {
      try {
        const processedData = await processFileWithWorker(file);
        console.log("Processed Data:", processedData);
        if (type === 'new') {
          setNewData(processedData);
          setPreviewData(processedData);
          await window.api.clearData('newData');
          await window.api.addData('newData', processedData);
        } else if (type === 'base') {
          setBaseData(processedData);
          console.log("Estructura de baseData después de la carga:", JSON.stringify(processedData, null, 2));
          await window.api.clearData('baseData');
          await window.api.addData('baseData', processedData);
        }
      } catch (error) {
        console.error("Error en el procesamiento del archivo:", error);
        alert("Error en el procesamiento del archivo: " + error);
      }
    }
  };
  

  // Función para comparar los datos almacenados (obtenidos mediante IPC)
  const handleComparison = async () => {
    // Aquí deberías usar la API expuesta por el preload, por ejemplo window.api.getAllData
    // Por simplicidad, asumiremos que ya tienes los datos en newData y baseData
    if (!newData || !baseData) {
      alert("Por favor, cargue ambos archivos antes de comparar.");
      return;
    }
    const newDataArray = newData; // Usa el array completo
    const baseDataArray = baseData; // Lo mismo para baseData

    const diffNew = newDataArray.map((newRow: any, rowIndex: number) => {
      const baseRow = baseDataArray[rowIndex] || [];
      const rowDiff = newRow.map((cell: any, cellIndex: number) => {
        const isDifferent = cell !== baseRow[cellIndex];
        return {
          value: cell,
          isDifferent,
          status: isDifferent ? 'incorrect' : 'correct',
        };
      });
      return { data: rowDiff };
    });
    const diffBase = baseDataArray.map((baseRow: any, rowIndex: number) => {
      const newRow = newDataArray[rowIndex] || [];
      const rowDiff = baseRow.map((cell: any, cellIndex: number) => {
        const isMissing = cell !== newRow[cellIndex];
        return {
          value: cell,
          status: isMissing ? 'incorrect' : 'correct',
        };
      });
      return { data: rowDiff };
    });
    setDifferencesNew(diffNew);
    setDifferencesBase(diffBase);
    setIsNewWindowOpen(true);
    setIsBaseWindowOpen(true);
  };

  // Función para renderizar el PDF en el canvas
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
      pdfjsLib.getDocument(typedArray).promise.then(function (pdf) {
        pdf.getPage(1).then(function (page) {
          const viewport = page.getViewport({ scale: 1.5 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          page.render(renderContext);
        });
      });
    };
    fileReader.readAsArrayBuffer(pdfFile);
  };

  // Función para renderizar celdas en el DataGrid
  const renderCell = (params: any) => {
    const { value } = params.value || {};
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
    const color = params.value?.status === 'incorrect' ? 'red' : 'green';
    return <span style={{ color }}>{displayValue}</span>;
  };

  // Manejo de clic en una celda para editarla
  const handleCellClick = (params: any) => {
    setSelectedCell(params);
    setEditedValue(params.value.value);
    setIsEditWindowOpen(true);
  };

  // Guardar cambios de edición en una celda
  const handleEditSave = () => {
    if (selectedCell) {
      const updatedRows = [...differencesNew];
      const rowToUpdate = updatedRows[selectedCell.id];
      if (rowToUpdate) {
        const cellIndex = parseInt(selectedCell.field.replace('column', ''), 10);
        const updatedCell = rowToUpdate.data[cellIndex];
        if (updatedCell) {
          updatedCell.value = editedValue;
          updatedCell.status =
            updatedCell.value === baseData[selectedCell.id][cellIndex]
              ? 'correct'
              : 'incorrect';
        }
        setDifferencesNew(updatedRows);
        setIsEditWindowOpen(false);
      }
    }
  };

  // Función para guardar los cambios en SQLite (actualizando newData) mediante IPC
  const handleSaveChanges = async () => {
    try {
      await window.api.clearData('newData');
      await window.api.addData('newData', differencesNew.map((row: any) => row.data));
      alert("Cambios guardados exitosamente.");
    } catch (error) {
      console.error("Error al guardar los cambios:", error);
      alert("Hubo un error al guardar los cambios.");
    }
  };

  return (
    <div className="admin-container">
      <nav className="navbar">
        <h1>Administrador de Comparación de Datos</h1>
        <div className="navbar-buttons">
          <Button variant="contained">Configuración</Button>
          <Button variant="contained">Ayuda</Button>
        </div>
      </nav>
      <div className="sidebar">
        <ul>
          <li onClick={() => {}}>Dividir Excel</li>
          <li>Comparar Datos</li>
          <li>Ver Diferencias</li>
          <li>Búsqueda en PDF</li>
          <li>Historial</li>
        </ul>
      </div>
      <div className="main-content">
        <div className="upload-section">
          <h3>Cargar Archivos</h3>
          <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'new')} />
          <p>Subir Archivo Nuevo</p>
          <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'base')} />
          <p>Subir Archivo Base</p>
          <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, 'pdf')} />
          <p>Subir PDF</p>
          <Button variant="contained" color="primary" onClick={handleComparison}>Comparar Archivos</Button>
          <Button variant="contained" onClick={() => {}} style={{ marginTop: '20px' }}>
            Vista Previa Completa
          </Button>
          <Button variant="contained" onClick={() => {}} style={{ marginTop: '20px' }}>
            Abrir PDF en Ventana
          </Button>
          {processingProgress > 0 && processingProgress < 100 && (
            <p>Procesando archivo: {processingProgress}%</p>
          )}
        </div>
      </div>
      <footer>
        <Button variant="contained" color="primary" onClick={handleSaveChanges}>
          Guardar Cambios
        </Button>
        <Button variant="contained" color="secondary">Exportar Reporte</Button>
        <Button variant="contained" color="error">Cancelar</Button>
      </footer>
      <MinimizedWindowsBar />
      <div className="floating-windows-container">
        <FloatingWindow
          title="Resultados del Archivo Nuevo"
          isOpen={isNewWindowOpen}
          onClose={() => setIsNewWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Resultados del Archivo Nuevo")}
        >
          {newData && newData.length > 0 ? (
            <DataGrid
              rows={differencesNew.map((row, index) => ({
                id: index,
                ...row.data.reduce((acc: any, cell: any, cellIndex: number) => ({
                  ...acc,
                  [`column${cellIndex}`]: { value: cell.value, status: cell.status }
                }), {})
              }))}
              columns={newData[0].map((header: any, index: number) => ({
                field: `column${index}`,
                headerName: `Columna ${index + 1}`,
                width: 150,
                renderCell: renderCell,
                editable: true,
              }))}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              checkboxSelection
            />
          ) : (
            <p>No hay datos para mostrar</p>
          )}
        </FloatingWindow>
        <FloatingWindow
          title="Resultados del Archivo Base"
          isOpen={isBaseWindowOpen}
          onClose={() => setIsBaseWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Resultados del Archivo Base")}
        >
          {differencesBase && differencesBase.length > 0 ? (
            <DataGrid
              rows={differencesBase.map((row, index) => ({
                id: index,
                ...row.data.reduce((acc: any, cell: any, cellIndex: number) => ({
                  ...acc,
                  [`column${cellIndex}`]: { value: cell.value, status: cell.status }
                }), {})
              }))}
              columns={baseData[0].map((header: any, index: number) => ({
                field: `column${index}`,
                headerName: header,
                width: 150,
                editable: true,
                renderCell: renderCell,
              }))}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              checkboxSelection
            />
          ) : (
            <p>No hay datos para mostrar</p>
          )}
        </FloatingWindow>
        <FloatingWindow
          title="Editar Celda"
          isOpen={isEditWindowOpen}
          onClose={() => setIsEditWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Editar Celda")}
        >
          <div>
            <h3>Editar Valor de la Celda</h3>
            <input
              type="text"
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
            />
            <Button variant="contained" color="primary" onClick={handleEditSave}>
              Guardar
            </Button>
            <Button variant="contained" color="secondary" onClick={() => setIsEditWindowOpen(false)}>
              Cancelar
            </Button>
          </div>
        </FloatingWindow>
        <FloatingWindow
          title="Visor de PDF"
          isOpen={isPdfWindowOpen}
          onClose={() => setIsPdfWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Visor de PDF")}
        >
          <canvas ref={canvasRef} />
        </FloatingWindow>
        <FloatingWindow
          title="Vista Previa Completa del Archivo"
          isOpen={isPreviewWindowOpen}
          onClose={() => setIsPreviewWindowOpen(false)}
          onMinimize={() => handleMinimizeWindow("Vista Previa Completa del Archivo")}
        >
          {previewData ? (
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="complete preview table">
                <TableHead>
                  <TableRow>
                    {previewData[0].map((header, index) => (
                      <TableCell key={index}>{header}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.slice(1).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <p>No hay datos para mostrar</p>
          )}
        </FloatingWindow>
      </div>
    </div>
  );
}

export default ComparisonView;
