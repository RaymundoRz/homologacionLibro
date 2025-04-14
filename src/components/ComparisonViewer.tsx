import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Button
} from '@mui/material';
import * as XLSX from 'xlsx';

interface ComparisonViewerProps {
  currentData: any[][];    // Archivo BASE
  referenceData: any[][];  // Archivo NUEVO PROCESADO
}

// ============================================================
// === Funciones de Utilidad (Pre-procesamiento y Clave) ===
// ============================================================

// Función para extraer año y nota (copiada/adaptada de ComparisonView)
function parseYearAndNote(text: string): { year: number | string; note: string } {
  const strText = String(text || '').trim();
  const match = strText.match(/\b(19|20)\d{2}\b/);
  if (!match) {
    // Si no hay año, devolver 0 o un string vacío para el año
    return { year: 0, note: strText }; // Usamos 0 como año por defecto si no se encuentra
  }
  const year = Number(match[0]);
  const note = strText.replace(match[0], "").trim();
  return { year, note };
}

// NUEVO: Función para añadir contexto de año
function preprocessDataWithYear(data: any[][]): any[][] {
    if (!Array.isArray(data) || data.length === 0) {
        console.warn("preprocessDataWithYear recibió data inválida:", data);
        return [];
    }

    let currentYear: number | string = 0; // Año rastreado
    const processedData: any[][] = [];
    
    // Añadir cabecera modificada
    const header = [...data[0], 'AñoContexto']; // Añade nuevo título de columna
    processedData.push(header);

    // Iterar sobre las filas de datos (omitir cabecera original)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        // Validar que la fila sea un array consistente
        if (!Array.isArray(row) || row.length < 3) { // Necesita al menos Tipo, Clase, Versiones
             console.warn(`Fila ${i} inválida en preprocessDataWithYear (saltando):`, row);
             continue; 
        }

        const tipo = Number(row[0]);

        // Si es Tipo 3, actualizar el año actual
        if (tipo === 3) {
            const { year } = parseYearAndNote(row[2]); // Extraer año de la columna Versiones
            currentYear = year; // Actualizar el año rastreado
        }
        
        // Crear nueva fila añadiendo el año de contexto al final
        const newRow = [...row, currentYear]; 
        processedData.push(newRow);
    }

    return processedData;
}


// Función para normalizar celdas individuales (igual que antes)
const normalizeCell = (value: any): string => {
  let normalized = String(value ?? '').trim(); // Usar ?? '' para null/undefined
  normalized = normalized.replace(/\s+/g, ' ');
  const asNumber = parseFloat(normalized.replace(/,/g, '')); 
  if (!isNaN(asNumber)) {
    return asNumber.toString();
  }
  return normalized.toLowerCase();
};

// MODIFICADO: Función getKey - AHORA USA EL AÑO
// Asume que después de preprocess y normalizeData, el Año está en índice 5
const getKey = (row: any[]): string => {
  // El año estará al final después de añadirlo, y luego Temp se quita
  // Índices originales: 0:Tipo, 1:Clase, 2:Versiones, 3:Preciobase, 4:Preciobase2, 5:Temp, 6:AñoContexto
  // Después de quitar Temp (índice 5): 0:Tipo, 1:Clase, 2:Versiones, 3:Preciobase, 4:Preciobase2, 5:AñoContexto
  const yearIndex = 5; // Índice esperado del Año después de quitar Temp
  
  if (!row || row.length <= yearIndex) { // Verifica que la fila y el índice del año sean válidos
    // console.warn("--- getKey: Fila inválida o sin columna Año:", row);
    return 'invalid|invalid|invalid'; 
  }
  const typeValue = row[0];
  const versionValue = row[2]; // Versión original sigue en índice 2
  const yearValue = row[yearIndex]; // Año añadido por preprocess

  const type = normalizeCell(typeValue); 
  const year = normalizeCell(yearValue); // Normalizar el año también

  // Limpiar versión solo como texto
  let version = String(versionValue).trim();
  version = version.replace(/\s+/g, ' ');
  version = version.toLowerCase();

  const finalKey = `${type}|${year}|${version}`; // Clave TIPO | AÑO | VERSION
  // console.log(`--- getKey: final key: "${finalKey}"`); 
  return finalKey;
};

// ============================================================
// === Componente ComparisonViewer ============================
// ============================================================

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  currentData,    // Base
  referenceData   // Nuevo (original, antes de procesar en ComparisonView)
}) => {
  
  // --- PASO 1: Pre-procesar para añadir Año ---
  const currentDataWithYear = preprocessDataWithYear(currentData);
  const referenceDataWithYear = preprocessDataWithYear(referenceData);

  console.log('VIEWER processed currentDataWithYear length:', currentDataWithYear?.length);
  console.log('VIEWER processed referenceDataWithYear length:', referenceDataWithYear?.length);
  // console.log('VIEWER processed currentDataWithYear RAW (first 10 rows):', JSON.stringify(currentDataWithYear?.slice(0, 10)));
  // console.log('VIEWER processed referenceDataWithYear RAW (first 10 rows):', JSON.stringify(referenceDataWithYear?.slice(0, 10)));


  // --- PASO 2: Normalizar (Quitar Columna 'Temp' si existe) ---
  // Nota: Ahora 'AñoContexto' está al final. Si 'Temp' existe, estaba antes.
  const normalizeData = (data: any[][]): any[][] => {
     if (!Array.isArray(data) || data.length === 0) return [];
     // Busca 'Temp' en la cabecera (que ahora incluye 'AñoContexto')
     const tempIndex = data[0]?.findIndex(cell => String(cell).toLowerCase().includes('temp'));
     if (!data[0] || tempIndex === -1) {
         // console.log("Columna 'Temp' no encontrada, no se quita nada.");
         return data; // No se encontró 'Temp', devuelve como está
     }
     // console.log(`Quitando columna 'Temp' en índice: ${tempIndex}`);
     // Quita la columna 'Temp'
     return data.map(row => row.filter((_, i) => i !== tempIndex));
  };

  const cleanCurrent = normalizeData(currentDataWithYear);       // Base con Año, sin Temp
  const cleanReference = normalizeData(referenceDataWithYear);   // Nuevo con Año, sin Temp

  console.log('Calculated cleanCurrent length (after Temp removal):', cleanCurrent?.length);
  console.log('Calculated cleanReference length (after Temp removal):', cleanReference?.length);
  // console.log('Clean Current (first 10):', JSON.stringify(cleanCurrent?.slice(0,10)));
  // console.log('Clean Reference (first 10):', JSON.stringify(cleanReference?.slice(0,10)));


  // --- PASO 3: Comparar y marcar diferencias ---
  const getComparisonResult = (): any[][] => {
    if (!cleanCurrent || cleanCurrent.length === 0) {
        return [['Error: No hay datos base para mostrar']]; 
    }
    if (!cleanReference || cleanReference.length === 0) {
        return cleanCurrent.map((row, i) => i === 0 ? row : row.map(cell => ({ value: cell, isDifferent: true, note: 'No Ref' })));
    }

    const result = [...cleanCurrent]; // Muestra Base con Año, sin Temp

    const referenceVersions = {}; // Usar Objeto plano sigue siendo buena idea
    const dataForRefMap = cleanReference.slice(1); 
    // console.log('Number of rows for reference map (from cleanReference):', dataForRefMap.length);

    dataForRefMap.forEach((row, idx) => {
      if (Array.isArray(row) && row.length > 0) {
          const key = getKey(row); // getKey ahora usa el año del índice 5
          if (key !== 'invalid|invalid|invalid') {
            // console.log(`>>> Storing in reference map - Key: "${key}", Row:`, JSON.stringify(row)); 
            referenceVersions[key] = row; 
          }
      } else {
          // console.warn(`Fila ${idx + 1} inválida en referenceData (saltando):`, row);
      }
    });

    // Recorremos cada fila del Archivo BASE (result) omitiendo cabecera
    for (let i = 1; i < result.length; i++) {
      const baseRow = result[i]; 

      if (!Array.isArray(baseRow)) {
        // console.warn(`Fila ${i} en Archivo Base (currentData) no es un array:`, baseRow);
        result[i] = [{ value: 'Error: Fila base inválida', isDifferent: true }]; 
        continue; 
      }

      const key = getKey(baseRow); // Clave de la fila base (Tipo|Año|Version)
      if (key === 'invalid|invalid|invalid') {
         // console.warn(`Clave inválida para fila base ${i}:`, baseRow);
         result[i] = baseRow.map(cell => ({ value: cell + ' (Clave Inv.)', isDifferent: true })); 
         continue; 
      }

      // console.log(`--- Looking up reference key: "${key}"`);       
      const referenceRow = referenceVersions[key]; // Busca en el objeto del archivo nuevo
      // console.log(`--- Found referenceRow for key "${key}":`, JSON.stringify(referenceRow)); 

      // --- Lógica de comparación ---
      if (!referenceRow) {
        result[i] = baseRow.map(cell => ({ value: cell, isDifferent: true, note: 'No en Ref' }));
      } else if (!Array.isArray(referenceRow)) {
          // console.warn(`El valor encontrado para la clave "${key}" en referenceData no es un array:`, referenceRow);
          result[i] = baseRow.map(cell => ({ value: cell + ' (Ref Inválida)', isDifferent: true })); 
      } else {
          // Comparar celda por celda
          result[i] = baseRow.map((cell, j) => { 
            
            const originalBaseVal = cell;       
            const originalRefVal = (j < referenceRow.length) ? referenceRow[j] : undefined; 

            const baseValNorm = normalizeCell(originalBaseVal); 
            const refValNorm = normalizeCell(originalRefVal); 
            
            const diff = baseValNorm !== refValNorm; 

            // Log detallado para columnas de precio (ÍNDICES SIGUEN SIENDO 3 Y 4)
            // Porque quitamos Temp (5) pero añadimos Año (que ahora es 5).
            if (j === 3 || j === 4) { 
                console.log(
                `Fila base ${i+1}, Col ${j}: ` + 
                `BASE(orig='${originalBaseVal}', norm='${baseValNorm}') vs ` + 
                `REF(orig='${originalRefVal}', norm='${refValNorm}') => ` +   
                `Diferente: ${diff}`
                );
            }

            // Devuelve el valor BASE original y si es diferente del NUEVO
            return { value: originalBaseVal, isDifferent: diff }; 
          }); 
      } 
    } // Fin del bucle for
    
    return result;
  }; // Fin de getComparisonResult
  
  // --- El resto del componente (llamada a getComparisonResult, export, renderizado) ---
   
  let comparisonData: any[][] = [];
  try {
    comparisonData = getComparisonResult();
  } catch (error) {
      console.error("Error durante getComparisonResult:", error);
      comparisonData = [['Error al procesar la comparación']];
  }

  if (!comparisonData || comparisonData.length === 0 || !Array.isArray(comparisonData[0])) {
      comparisonData = [['No hay datos para mostrar o hubo un error']];
  }


  const handleExport = () => {
     const validData = comparisonData.filter(row => Array.isArray(row) && row.length > 0 && !row[0]?.value?.startsWith('Error:'));
     if (validData.length === 0) {
        alert("No hay datos válidos para exportar.");
        return;
     }
    // Quitar la columna de AñoContexto (índice 5) antes de exportar, si se desea
    const exportData = validData.map(row => {
        const rowToExport = row.map(cell => (cell && typeof cell === 'object' && 'value' in cell ? cell.value : cell));
        // Asume que el año está en índice 5 después de quitar Temp
        return rowToExport.filter((_, idx) => idx !== 5); 
    });

    try {
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        // Podrías querer ajustar anchos de columna aquí
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Comparación");
        XLSX.writeFile(wb, "diferencias_base.xlsx");
    } catch (error) {
        console.error("Error al exportar a Excel:", error);
        alert("Hubo un error al generar el archivo Excel.");
    }
  };

  // Renderizado del componente
  return (
    <Box mt={2} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}> 
      <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}> 
        Comparación (Mostrando Archivo Base) 
      </Typography>
      
      <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}> 
        <Table stickyHeader size="small"> 
          <TableHead>
            <TableRow>
              {/* Renderiza la cabecera (sin la columna de año si la filtramos antes) */}
              {/* Asumimos que comparisonData aún tiene el año aquí, lo filtramos al mostrar */}
              {comparisonData[0].filter((_, idx) => idx !== 5) // No mostrar cabecera de AñoContexto
                 .map((header, i) => (
                   <TableCell key={i} sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}> 
                      {header && typeof header === 'object' ? header.value : header}
                   </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {comparisonData.slice(1).map((row, rowIdx) => (
              Array.isArray(row) ? (
                <TableRow key={rowIdx} hover> 
                  {/* Filtramos la columna de año al mostrar las celdas */}
                  {row.filter((_, cellIdx) => cellIdx !== 5) 
                     .map((cell, cellIdxFiltered) => (
                       <TableCell
                         key={cellIdxFiltered} // Usar índice filtrado para la key
                         sx={{
                            // === CAMBIO AQUÍ ===
                            // Si NO es diferente, fuerza el fondo a blanco o transparente
                            bgcolor: cell && cell.isDifferent ? '#ffebee' : '#ffffff', // o 'transparent'
                            // ===================
                            color: cell && cell.isDifferent ? '#d32f2f' : 'inherit', // Mantén el color del texto
                            fontWeight: cell && cell.isDifferent ? 'bold' : 'normal',
                            whiteSpace: 'nowrap',
                            // Puedes mantener o quitar los bordes si no ayudaron:
                            borderRight: '1px solid #e0e0e0', 
                            borderLeft: '1px solid #e0e0e0',  
                            padding: '6px 16px', 
                          }}
                       >
                         {cell && typeof cell === 'object' && 'value' in cell ? cell.value : cell} 
                       </TableCell>
                  ))}
                </TableRow>
              ) : (
                 <TableRow key={rowIdx}><TableCell colSpan={comparisonData[0]?.length ? comparisonData[0].length - 1 : 1}>Error en fila</TableCell></TableRow>
              )
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button 
        variant="contained" 
        onClick={handleExport}
        sx={{ mt: 2, flexShrink: 0 }} 
        disabled={comparisonData.length <= 1} 
      >
        Exportar Diferencias (desde Base)
      </Button>
    </Box>
  );
};

// export default ComparisonViewer; // O export const arriba