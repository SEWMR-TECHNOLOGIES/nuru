/**
 * Uploads API - File upload endpoints
 * Aligned with backend/nuru-routes/uploads.py
 */

import { postFormData } from "./helpers";

export const uploadsApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return postFormData<{ id: string; url: string; file_name: string }>("/uploads/", formData);
  },
};
