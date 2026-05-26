import * as React from 'react';

function useUpload() {
  const [loading, setLoading] = React.useState(false);
  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);
      let base64 = "";

      if ("file" in input && input.file) {
        // Convert file to base64
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(input.file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
        });
      } else if ("base64" in input) {
        base64 = input.base64;
      } else {
        throw new Error("Only file and base64 uploads are supported");
      }

      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ base64 }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 413) {
          throw new Error("Upload failed: File too large.");
        }
        throw new Error(errData.error || "Upload failed");
      }

      const data = await response.json();
      return { url: data.url, mimeType: data.mimeType || null };
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === "string") {
        return { error: uploadError };
      }
      return { error: "Upload failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;