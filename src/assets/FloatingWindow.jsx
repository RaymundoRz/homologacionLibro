import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import './FloatingWindow.css'

const FloatingWindow = ({ title, children, isOpen, onClose, onMinimize }) => {
  const nodeRef = useRef(null);

  if (!isOpen) return null;

  return (
    <Draggable nodeRef={nodeRef} handle=".handle">
      <div ref={nodeRef} className="floating-window">
        <div className="handle">
          <span>{title}</span>
          <button onClick={onMinimize}>_</button>
          <button onClick={onClose}>X</button>
        </div>
        <ResizableBox width={800} height={600} minConstraints={[100, 100]} maxConstraints={[500, 500]}>
          <div className="content">{children}</div>
        </ResizableBox>
      </div>
    </Draggable>
  );
};

export default FloatingWindow;
