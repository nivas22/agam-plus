import { ReactNode } from "react";

export const metadata = {
  title: "Agam Plus - Mobile",
  description: "Connect · Consult · Care - Mobile Healthcare Management",
};

type MobileLayoutProps = {
  children: ReactNode;
};

export default function MobileLayout({ children }: MobileLayoutProps) {
  return children;
}
