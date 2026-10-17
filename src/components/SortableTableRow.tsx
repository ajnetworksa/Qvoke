import React, { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTableRowProps extends Omit<React.HTMLAttributes<HTMLTableRowElement>, "children"> {
  id: string;
  children: (
    setActivatorNodeRef: (node: HTMLElement | null) => void,
    listeners: any,
    attributes: any
  ) => React.ReactNode;
}

export const SortableTableRow = forwardRef<HTMLTableRowElement, SortableTableRowProps>(
  ({ id, children, style, className, ...props }, ref) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const combinedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' : 'static',
  };

  // Combine our internal setNodeRef with the forwarded ref
  const setRef = (node: HTMLTableRowElement | null) => {
    setNodeRef(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <tr
      ref={setRef}
      style={combinedStyle}
      className={`${className || ''} ${isDragging ? 'bg-[var(--color-primary)]/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-2 ring-[var(--color-primary)] ring-opacity-50 opacity-100 scale-[1.01] backdrop-blur-md' : 'hover:bg-[var(--color-surface-offset)]/50'}`}
      {...props}
    >
      {children(setActivatorNodeRef, listeners, attributes)}
    </tr>
  );
});
