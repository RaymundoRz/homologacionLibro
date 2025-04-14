import React, { useState } from 'react';
import { ComparisonViewer } from './ComparisonViewer';
import * as XLSX from 'xlsx';
import { Box } from '@mui/material';

export const ComparisonTool: React.FC<{ currentData: any[][] }> = ({ currentData }) => {
  const [referenceData, setReferenceData] = useState<any[][]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: ''
      });
      setReferenceData(worksheet);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Box>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
      />
      {referenceData.length > 0 && (
        <ComparisonViewer 
          currentData={currentData} 
          referenceData={referenceData} 
        />
      )}
    </Box>
  );
};
