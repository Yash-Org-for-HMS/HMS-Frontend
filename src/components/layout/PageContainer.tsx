import { Container, type ContainerProps } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Standard page wrapper for Super Admin pages. Keeps the outer width and
 * vertical padding identical across every module so content lines up when
 * switching pages.
 */
export default function PageContainer({
  children,
  maxWidth = "xl",
  ...rest
}: { children: ReactNode } & ContainerProps) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: 4 }} {...rest}>
      {children}
    </Container>
  );
}
