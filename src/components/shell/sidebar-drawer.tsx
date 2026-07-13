"use client";

import { useEffect, useCallback } from "react";
import { Sidebar } from "./sidebar";

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SidebarDrawer({ isOpen, onClose }: SidebarDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        id="mobile-drawer"
        className={`fixed left-0 top-0 z-50 h-full w-72 max-w-[280px] border-r border-border bg-bg-surface transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4">
          <span className="mb-6 block text-lg font-bold text-text-primary font-heading">
            Vendeo
          </span>
          <Sidebar isDrawer onNavigate={onClose} />
        </div>
      </div>
    </>
  );
}
