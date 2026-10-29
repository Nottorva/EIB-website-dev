// pdf.js, loaded once from cdnjs on first use (the UMD build, pinned). Used
// by the EIB Night slides page and the Student Agreement reader. Returns
// the global library; rejects if the script cannot load.

const VERSION = "3.11.174";
export const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}/pdf.min.js`;
export const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}/pdf.worker.min.js`;

let loader = null;

export function loadPdfJs() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PDFJS_URL;
      s.async = true;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      s.onerror = () => {
        loader = null; // allow a retry
        reject(new Error("The PDF viewer could not load."));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}
