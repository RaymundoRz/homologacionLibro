import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Typography, Box, Button
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';

interface EditableExcelTableProps {
  data: any[][];
  onDataChange: (updatedData: any[][]) => void;
  validationErrors?: { rowIndex: number; messages: string[] }[];
}

const EditableExcelTable: React.FC<EditableExcelTableProps> = ({
  data,
  onDataChange,
  validationErrors = []
}) => {
  if (!data || data.length === 0) return <p>No hay datos para mostrar</p>;

  // Obtener los índices de las columnas clave
  const header = data[0].map(cell => cell.toString().toLowerCase());
  const tipoIndex = header.findIndex(col => col.includes('tipo'));
  const precioBaseIndex = header.findIndex(col => col.includes('preciobase'));
  const precioBase2Index = header.findIndex(col => col.includes('preciobase2'));

  const handleCellChange = (rowIndex: number, colIndex: number, value: any) => {
    const updatedData = [...data];
    updatedData[rowIndex][colIndex] = value;
    onDataChange(updatedData);
  };

  // Función para descargar el Excel final omitiendo la columna "Temp"
  const handleDownloadExcel = () => {
    // Clonar los datos para no modificar el original
    const dataToDownload = JSON.parse(JSON.stringify(data));
    // Buscar el índice de la columna "Temp" (comparando en minúsculas)
    const tempIndex = dataToDownload[0].findIndex(cell => cell.toString().toLowerCase() === 'temp');
    // Filtrar la data si se encontró la columna "Temp"
    const filteredData = tempIndex !== -1
      ? dataToDownload.map(row => row.filter((_, i) => i !== tempIndex))
      : dataToDownload;

    // Crear el worksheet y el workbook a partir de los datos filtrados
    const worksheet = XLSX.utils.aoa_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hoja1");
    // Descargar el archivo Excel final
    XLSX.writeFile(workbook, "final.xlsx");
  };

  return (
    <>
      <TableContainer component={Paper} style={{ maxHeight: 400, overflow: 'auto' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {data[0].map((cell, colIndex) => (
                <TableCell key={colIndex}>{cell}</TableCell>
              ))}
              <TableCell>Validación</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.slice(1).map((row, rowIndex) => {
              const actualRowIndex = rowIndex + 1; // porque la cabecera es fila 0
              // Filtrar los errores que correspondan a esta fila.
              const rowErrors = validationErrors
                .filter(e => e.rowIndex === actualRowIndex)
                .flatMap(e => e.messages);
              // Determina si esta fila es de versiones (tipo 4)
              const isVersionRow = tipoIndex !== -1 && parseInt(row[tipoIndex]) === 4;

              return (
                <TableRow key={actualRowIndex}>
                  {row.map((cell, colIndex) => {
                    // Define si tiene error basado en la validación
                    let hasError = false;
                    const colName = header[colIndex];
                    if (isVersionRow) {
                      // Si la columna es "preciobase" y está vacía, se marca error
                      if (colName.includes('preciobase') && (cell === '' || cell == null)) {
                        hasError = true;
                      }
                      // Si es "preciobase2", comparamos con el precio base
                      if (colName.includes('preciobase2') && precioBaseIndex !== -1) {
                        const precioBase = parseFloat(row[precioBaseIndex]);
                        const precioBase2 = parseFloat(cell);
                        if (!isNaN(precioBase) && !isNaN(precioBase2) && precioBase2 >= precioBase) {
                          hasError = true;
                        }
                      }
                    }
                    return (
                      <TableCell
                        key={colIndex}
                        style={{
                          backgroundColor: hasError ? '#ffebee' : 'inherit',
                          padding: '8px'
                        }}
                      >
                        <input
                          value={cell === null || cell === undefined ? '' : cell}
                          onChange={(e) => handleCellChange(actualRowIndex, colIndex, e.target.value)}
                          style={{
                            border: hasError ? '2px solid red' : '1px solid #ddd',
                            width: '100%',
                            padding: '4px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </TableCell>
                    );
                  })}
                  {/* Celda de Validación */}
                  <TableCell
                    style={{
                      backgroundColor: rowErrors.length > 0 ? '#fff8e1' : 'inherit',
                      color: 'red',
                      padding: '8px'
                    }}
                  >
                    {rowErrors.length > 0 ? (
                      <Box display="flex" alignItems="center">
                        <WarningIcon color="error" style={{ marginRight: 8 }} />
                        <div style={{ fontSize: '0.8rem' }}>
                          {rowErrors.join('; ')}
                        </div>
                      </Box>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Botón para descargar el Excel final, dentro del mismo modal */}
      <Box display="flex" justifyContent="center" mt={2}>
        <Button variant="contained" color="primary" onClick={handleDownloadExcel}>
          Descargar Excel Final
        </Button>
      </Box>
    </>
  );
};

export default EditableExcelTable;
