// src/components/ExcelTable.tsx
import React from 'react';

interface ExcelTableProps {
  data: any[];
}

const ExcelTable: React.FC<ExcelTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p>No hay datos para mostrar</p>;
  }

  // Estilos de tabla básicos
  const tableStyle: React.CSSProperties = {
    borderCollapse: 'collapse',
    width: '100%',
    backgroundColor: '#ffffff',  // Fondo de la tabla
  };

  const thStyle: React.CSSProperties = {
    border: '1px solid #ccc',
    padding: '8px',
    background: '#eaeaea',  // Un gris claro para encabezados
    color: '#333',          // Texto gris oscuro
    fontWeight: 'bold',
    textAlign: 'left',
  };

  const tdStyle: React.CSSProperties = {
    border: '1px solid #ccc',
    padding: '8px',
    color: '#333',          // Texto gris oscuro
  };

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {data[0].map((header: any, index: number) => (
            <th key={index} style={thStyle}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.slice(1).map((row: any, rowIndex: number) => (
          <tr key={rowIndex}>
            {row.map((cell: any, cellIndex: number) => (
              <td key={cellIndex} style={tdStyle}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ExcelTable;
