import React from 'react';
import { Paper, IconButton, Typography, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Draggable from 'react-draggable';

interface DataModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  data: React.ReactNode;
  modalStyle?: React.CSSProperties;
  onFocus?: () => void;
}

const DataModal: React.FC<DataModalProps> = ({ 
  open, 
  title, 
  onClose, 
  data, 
  modalStyle,
  onFocus
}) => {
  if (!open) return null;

  const combinedStyle: React.CSSProperties = {
    position: 'fixed',
    width: '45%',
    maxHeight: '80vh',
    backgroundColor: '#ffffff',
    border: '2px solid #1976d2',
    borderRadius: '8px',
    boxShadow: '0px 11px 15px -7px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    zIndex: modalStyle?.zIndex || 1300,
    ...modalStyle
  };

  return (
    <Draggable handle="#draggable-handle" cancel=".MuiButton-root, .MuiInputBase-root">
      <Paper 
        style={combinedStyle}
        onMouseDown={onFocus}
        onClick={onFocus}
      >
        <Box 
          id="draggable-handle"
          sx={{
            cursor: 'move',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1976d2',
            color: 'white'
          }}
        >
          <Typography variant="h6">{title}</Typography>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ 
          padding: 2,
          overflowY: 'auto',
          flex: 1,
          '&:focus': {
            outline: 'none'
          }
        }}>
          {data}
        </Box>
      </Paper>
    </Draggable>
  );
};

export default DataModal;