import { useState, type DragEvent } from 'react';

/**
 * Handlers for a bare DOM element that accepts dropped files.
 *
 * Counts enter and leave rather than toggling: both fire again for each child
 * the pointer crosses, which would otherwise flicker the drop state.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [depth, setDepth] = useState(0);

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

  return {
    isDragging: depth > 0,
    dropProps: {
      onDragEnter: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDepth((value) => value + 1);
      },
      onDragLeave: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        setDepth((value) => Math.max(0, value - 1));
      },
      onDragOver: (event: DragEvent) => {
        // Without this the browser navigates to the file instead of dropping it.
        if (hasFiles(event)) event.preventDefault();
      },
      onDrop: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDepth(0);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      },
    },
  };
}

/** Opens the browser's file picker. */
export function pickFiles(accept: string, multiple: boolean, onFiles: (files: File[]) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) onFiles(files);
  };
  input.click();
}
