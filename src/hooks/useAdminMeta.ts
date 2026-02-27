/**
 * Sets document title for admin pages dynamically.
 */
import { useEffect } from "react";

export const useAdminMeta = (title: string) => {
  useEffect(() => {
    document.title = `${title} | Nuru Admin`;
  }, [title]);
};
