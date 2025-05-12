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
  Button,
  Menu,
  MenuItem
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

  // Estados y funciones para el menú contextual
  const [contextMenu, setContextMenu] = React.useState<{
    mouseX: number;
    mouseY: number;
    rowIndex: number;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, rowIndex: number) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, rowIndex });
  };

  const handleAddRow = (insertIndex: number) => {
    // Determinar el tipo de fila basado en la fila anterior
    let rowType = '';
    if (insertIndex > 0 && data[insertIndex]) {
      const prevRowType = data[insertIndex][0];
      rowType = ['2', '3', '4'].includes(String(prevRowType)) ? prevRowType : '4';
    }
    
    // Crear nueva fila con el mismo número de columnas que el header
    const newRow = Array(data[0].length).fill('');
    if (rowType) newRow[0] = rowType;
    
    // Insertar la nueva fila
    const newData = [
      ...data.slice(0, insertIndex + 1),
      newRow,
      ...data.slice(insertIndex + 1)
    ];
    
    // Actualizar el estado
    onDataChange(newData);
  };

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
    // Verificar que hay datos
    if (!data || data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
  
    // Crear copia profunda de los datos actuales
    const dataToExport = JSON.parse(JSON.stringify(data));
    
    // Eliminar columna Temp si existe
    const tempIndex = dataToExport[0].findIndex(
      cell => String(cell).toLowerCase() === 'temp'
    );
    
    const exportData = tempIndex !== -1
      ? dataToExport.map(row => row.filter((_, i) => i !== tempIndex))
      : dataToExport;
  
    // Crear el archivo Excel
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    
    // Construir el nombre del archivo utilizando la fecha actual
  const now = new Date();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const month = monthNames[now.getMonth()];
  const yearTwoDigits = now.getFullYear().toString().slice(-2);
  const fileName = `Guía Libro Azul ${month} ${yearTwoDigits}.xls`;

  // Descargar
  XLSX.writeFile(workbook, fileName);
  };

  return (
    <div onContextMenu={(e) => e.preventDefault()}>
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
              const actualRowIndex = rowIndex + 1; // ya que la cabecera es la fila 0
              // Filtrar los errores que correspondan a esta fila.
              const rowErrors = validationErrors
                .filter(e => e.rowIndex === actualRowIndex)
                .flatMap(e => e.messages);
              // Determina si esta fila es de versiones (tipo 4)
              const isVersionRow = tipoIndex !== -1 && parseInt(row[tipoIndex]) === 4;

              return (
                <TableRow
                  key={actualRowIndex}
                  onContextMenu={(e) => handleContextMenu(e, actualRowIndex)}
                >
                  {row.map((cell, colIndex) => {
                    // Define si tiene error basado en la validación
                    let hasError = false;
                    const colName = header[colIndex];
                    if (isVersionRow) {
                      if (
                        colName.includes('preciobase') &&
                        (cell === '' || cell == null)
                      ) {
                        hasError = true;
                      }
                      if (colName.includes('preciobase2') && precioBaseIndex !== -1) {
                        const precioBase = parseFloat(row[precioBaseIndex]);
                        const precioBase2 = parseFloat(cell);
                        if (
                          !isNaN(precioBase) &&
                          !isNaN(precioBase2) &&
                          precioBase2 >= precioBase
                        ) {
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
                          value={
                            cell === null || cell === undefined ? '' : cell
                          }
                          onChange={(e) =>
                            handleCellChange(actualRowIndex, colIndex, e.target.value)
                          }
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
      {/* Botón para descargar el Excel final */}
      <Box display="flex" justifyContent="center" mt={2}>
        <Button variant="contained" color="primary" onClick={handleDownloadExcel}>
          Descargar Excel Final
        </Button>
      </Box>
      {/* Menú contextual para insertar fila */}
      <Menu
  open={Boolean(contextMenu)}
  onClose={() => setContextMenu(null)}
  anchorReference="anchorPosition"
  anchorPosition={
    contextMenu
      ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
      : undefined
  }
  // 1) Este zIndex va en el propio Popover (no solo en el Paper)
  sx={{ zIndex: 2000 }}
  // 2) Y de paso dejas también el PaperProps por si acaso
  PaperProps={{
    style: { zIndex: 2000 }
  }}
>
  <MenuItem onClick={() => contextMenu && handleAddRow(contextMenu.rowIndex)}>
    Insertar fila aquí
  </MenuItem>
</Menu>

    </div>
  );
};

export default EditableExcelTable;
