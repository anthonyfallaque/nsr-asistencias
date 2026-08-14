/**
 * Punto de entrada único de las primitivas de interfaz.
 *
 * Las pantallas importan desde `@/shared/ui`, nunca desde el archivo
 * concreto: así una primitiva puede dividirse o reubicarse sin tocar
 * ninguna de las vistas que la consumen.
 */
export { Button, type ButtonProps } from './Button';
export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export { Card, CardHeader, CardBody, CardFooter } from './Card';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { Field, describedBy } from './Field';
export { Input, type InputProps } from './Input';
export { Modal, type ModalProps } from './Modal';
export { PageHeader, type PageHeaderProps } from './PageHeader';
export { Select, type SelectProps } from './Select';
export { Sheet, type SheetProps } from './Sheet';
export { Skeleton, SkeletonText, SkeletonRows } from './Skeleton';
export { Spinner } from './Spinner';
export { ToastProvider, useToast } from './Toast';
