// src/components/ComparisonViewer.tsx
import React, { useMemo } from 'react'; 
import { Paper, Typography, Box, Button } from '@mui/material';
// Imports para DataGrid
import { DataGrid, GridColDef, GridCellParams, GridRowId } from '@mui/x-data-grid'; 
import * as XLSX from 'xlsx'; // Para exportar

// Interfaz para las filas que DataGrid espera
interface GridRowModel {
    id: GridRowId; // ID único (usaremos el índice de fila 0..N)
    [key: string]: any; // Columnas dinámicas: col_0, col_1, etc. con los *valores* directos
}

interface ComparisonViewerProps {
  displayData: any[][];       // Datos BASE pre-procesados [fila][columna] (CON cabecera y AñoContexto)
  differences: Set<string>; // Set con coordenadas "fila_datos_idx:columna_original_idx"
}

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  displayData,    
  differences   
}) => {
  
  // Log inicial para verificar props
  console.log('Viewer - Props - displayData length:', displayData?.length);
  console.log('Viewer - Props - differences size:', differences?.size);
  // console.log('Viewer received differences Set:', differences); // Descomentar si se necesita ver el Set completo

  const yearColumnIndex = 5; // Índice de AñoContexto (después de quitar Temp) a ocultar

  // --- Transformar datos y definir columnas para DataGrid ---
  const { columns, rows } = useMemo(() => {
    // console.log("Viewer: Transformando datos para DataGrid...");
    if (!displayData || displayData.length < 1 || !Array.isArray(displayData[0])) {
      console.warn("Viewer: displayData inválido o vacío recibido por ComparisonViewer.");
      return { 
          columns: [{ field: 'error', headerName: 'Error', width: 300 }], 
          rows: [{ id: 'error_row', error: 'No hay datos base válidos para mostrar' }] 
      };
    }

    const headerRow = displayData[0];
    const dataRows = displayData.slice(1);

    // --- Definir Columnas ---
    const MAX_COLS_TO_SHOW = 5; // Mostrar columnas 0, 1, 2, 3, 4
    const cols: GridColDef[] = headerRow
        .map((colName, index) => ({ 
            field: `col_${index}`, // ID único de columna basado en índice *original*
            headerName: String(colName ?? ''), 
            width: index === 2 ? 250 : 150, // Más ancho para Versiones
            sortable: false, // Deshabilitar ordenamiento por defecto
            // Dentro de cellClassName en ComparisonViewer.tsx
cellClassName: (params: GridCellParams) => {
    const colIndexStr = params.field.split('_')[1];
    const colIndex = parseInt(colIndexStr, 10);
    if (isNaN(colIndex)) return ''; 

    // === Creación de coordenada DEBE SER ASÍ ===
    const rowIndexNum = Number(params.row.id);
    const coord = `${rowIndexNum}:${colIndex}`;    
    const hasDiff = differences ? differences.has(coord) : false; 

    // === Log DEBE SER ASÍ ===
  console.log(
    `Viewer cellClassName Check: Coord="${coord}", HasDiff=${hasDiff}, ClassReturned="${
      hasDiff ? 'difference-cell' : ''
    }"`
  );
                
    return hasDiff ? 'difference-cell' : ''; 
},
        }))
        // === Filtro para mostrar SOLO las columnas deseadas ===
        .filter((_, index) => index < MAX_COLS_TO_SHOW); 
        
    // --- Transformar Filas ---
    const gridRows: GridRowModel[] = dataRows.map((row, rowIndex) => { 
        const rowData: GridRowModel = { id: rowIndex }; 
        if (Array.isArray(row)) {
            // Guardamos TODAS las columnas originales en el objeto rowData
            // porque cellClassName necesita el índice original 'j' para buscar.
            // DataGrid solo usará las que estén definidas en 'cols' filtradas.
            row.forEach((cellValue, colIndex) => {
                rowData[`col_${colIndex}`] = cellValue; 
            });
        } else {
             rowData['error'] = 'Fila inválida'; 
        }
        return rowData;
    });

    // console.log(`Viewer: ${gridRows.length} filas y ${cols.length} columnas DEFINIDAS para DataGrid.`);
    return { columns: cols, rows: gridRows };

  }, [displayData, differences]); // Dependencias del useMemo


  // --- Función de Exportación (Adaptada) ---
  const handleExport = () => {
     if (rows.length === 0) { alert("No hay datos para exportar."); return; }
     
      const headerToExport = columns.map(col => col.headerName); 
      const bodyToExport = rows.map(rowObj => {
          return columns.map(col => rowObj[col.field] ?? ''); 
      });

     const exportData = [headerToExport, ...bodyToExport];
     try {
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Comparacion_Base");
        XLSX.writeFile(wb, "diferencias_base.xlsx");
     } catch (error) { console.error("Error al exportar a Excel:", error); alert("Error al generar Excel."); }
  };

  // --- Renderizado del Componente ---
  return (
    <Box mt={2} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}> 
      <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}> 
        Comparación (Mostrando Archivo Base) 
      </Typography>
      
      {/* Contenedor para DataGrid */}
      <Paper sx={{ flexGrow: 1, height: 'calc(100% - 80px)', width: '100%' }}> {/* Altura calculada */}
         {(rows && rows.length > 0 && columns && columns.length > 0 && columns[0].field !== 'error') ? (
             <DataGrid
                rows={rows} 
                columns={columns} 
                getRowId={(row) => row.id}
                density="compact" 
                rowHeight={35} 
                hideFooter // Ocultar pie para scroll infinito
              />
         ) : (
            <Typography sx={{p: 2}}>
                {displayData && displayData.length > 0 ? "Error generando filas/columnas para la tabla." : "Esperando datos de comparación..."}
            </Typography> 
         )}
      </Paper>

      {/* Botón de exportación */}
      <Button 
        variant="contained" 
        onClick={handleExport}
        sx={{ mt: 2, flexShrink: 0 }} 
        disabled={!rows || rows.length === 0} 
      >
        Exportar Diferencias Visibles
      </Button>

      {/* CSS NECESARIO en App.css o index.css:
          .difference-cell {
            background-color: #ffebee !important; 
            color: #d32f2f !important;
            font-weight: bold !important;
          } 
      */}
    </Box>
  );
};

// export default ComparisonViewer;