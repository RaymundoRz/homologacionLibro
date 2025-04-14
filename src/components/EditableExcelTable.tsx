import React from 'react';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  Typography, Box 
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

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

  return (
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
  );
};

export default EditableExcelTable;