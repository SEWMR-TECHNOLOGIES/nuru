// hooks/useMeta.ts
import { useEffect } from "react";

const BRAND_NAME = "Nuru";

interface MetaOptions {
  title: string;
  description?: string;
}

export const useMeta = ({ title, description }: MetaOptions) => {
  useEffect(() => {
    // Set the page title with brand
    document.title = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`;

    // Set or create meta description
    if (description) {
      let metaTag = document.querySelector('meta[name="description"]');
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute('name', 'description');
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', description);
    }
  }, [title, description]);
};
