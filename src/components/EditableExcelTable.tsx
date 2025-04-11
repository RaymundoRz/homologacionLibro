// src/components/EditableExcelTable.tsx
import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, GridCellEditCommitParams } from '@mui/x-data-grid';
import { Button, Box } from '@mui/material';

interface EditableExcelTableProps {
  data: any[]; // Se espera un array de arrays, donde data[0] es la cabecera
  onDataChange?: (newData: any[]) => void;
}

const EditableExcelTable: React.FC<EditableExcelTableProps> = ({ data, onDataChange }) => {
  // Creamos el estado para la data editable
  const [rows, setRows] = useState<any[]>([]);

  // Configuramos las columnas basándonos en la primera fila (cabecera)
  const [columns, setColumns] = useState<GridColDef[]>([]);

  // Al inicializar o cambiar "data", actualizamos filas y columnas
  useEffect(() => {
    if (!data || data.length === 0) return;

    // Construimos columnas a partir de la cabecera
    const header = data[0];
    const cols: GridColDef[] = header.map((colName: string, index: number) => ({
      field: `column${index}`,
      headerName: colName || `Columna ${index + 1}`,
      width: 150,
      editable: true,
    }));
    setColumns(cols);

    // Construimos las filas a partir de los datos (excluyendo la cabecera)
    const newRows = data.slice(1).map((row, rowIndex) => {
      const rowObject: any = { id: rowIndex };
      row.forEach((cell: any, colIndex: number) => {
        rowObject[`column${colIndex}`] = cell;
      });
      return rowObject;
    });
    setRows(newRows);
  }, [data]);

  // Manejador para la edición de celdas
  const handleCellEditCommit = (params: GridCellEditCommitParams) => {
    const updatedRows = rows.map(row => {
      if (row.id === params.id) {
        return { ...row, [params.field]: params.value };
      }
      return row;
    });
    setRows(updatedRows);
    if (onDataChange) {
      // Reconstruir el array de arrays: la cabecera se conserva
      const updatedData = [columns.map(col => col.headerName), ...updatedRows.map(row =>
        columns.map(col => row[col.field])
      )];
      onDataChange(updatedData);
    }
  };

  // Función para agregar una nueva fila (con celdas vacías)
  const handleAddRow = () => {
    const newRow: any = { id: rows.length };
    columns.forEach(col => {
      newRow[col.field] = '';
    });
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    if (onDataChange) {
      const updatedData = [columns.map(col => col.headerName), ...updatedRows.map(row =>
        columns.map(col => row[col.field])
      )];
      onDataChange(updatedData);
    }
  };

  // Función para eliminar la fila seleccionada (suponiendo que se selecciona una fila)
  const handleDeleteRow = () => {
    // En este ejemplo, eliminamos la última fila como muestra
    if (rows.length === 0) return;
    const updatedRows = rows.slice(0, rows.length - 1);
    // Reasignamos IDs para que sean consecutivos
    const reassignedRows = updatedRows.map((row, index) => ({ ...row, id: index }));
    setRows(reassignedRows);
    if (onDataChange) {
      const updatedData = [columns.map(col => col.headerName), ...reassignedRows.map(row =>
        columns.map(col => row[col.field])
      )];
      onDataChange(updatedData);
    }
  };

  return (
    <Box>
      <Box mb={2} display="flex" gap={2}>
        <Button variant="contained" onClick={handleAddRow}>Agregar Fila</Button>
        <Button variant="contained" color="error" onClick={handleDeleteRow}>Eliminar Última Fila</Button>
      </Box>
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          onCellEditCommit={handleCellEditCommit}
        />
      </div>
    </Box>
  );
};

export default EditableExcelTable;
