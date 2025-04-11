// src/components/ComparisonModal.tsx
import React from 'react';
import { Modal, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ComparisonModalProps {
  isOpen: boolean;
  handleClose: () => void;
  title: string;
  data: any;
}

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxHeight: '90vh',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  overflowY: 'auto',
};

const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, handleClose, title, data }) => {
  return (
    <Modal open={isOpen} onClose={handleClose}>
      <Box sx={style}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box mt={2}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
        </Box>
      </Box>
    </Modal>
  );
};

export default ComparisonModal;
