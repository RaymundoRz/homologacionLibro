// src/components/DataModal.tsx
import React from 'react';
import { Modal, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface DataModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  data: React.ReactNode;
}

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxHeight: '80vh',
  bgcolor: '#ffffff',
  border: '2px solid #1976d2',
  borderRadius: '8px',
  boxShadow: 24,
  p: 4,
  overflowY: 'auto',
};

const DataModal: React.FC<DataModalProps> = ({ open, title, onClose, data }) => {
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="data-modal-title">
      <Box sx={style}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography id="data-modal-title" variant="h6">
            {title}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <div style={{ padding: '10px', background: '#f9f9f9', borderRadius: '4px' }}>
          {data}
        </div>
      </Box>
    </Modal>
  );
};

export default DataModal;
