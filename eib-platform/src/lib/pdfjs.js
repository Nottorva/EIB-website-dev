// pdf.js, loaded once from cdnjs on first use (the UMD build, pinned). Used
// by the EIB Night slides page and the Student Agreement reader. Returns
// the global library; rejects if the script cannot load.

import { useEffect, useRef, useState } from "react";

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

/* ---------- React hooks shared by the two viewers ---------- */

// Loads the document at `src`. Returns { doc, error }.
export function usePdfDocument(src, { withCredentials = false, message = "Could not load the PDF.", onError } = {}) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadPdfJs()
      .then((lib) => lib.getDocument(withCredentials ? { url: src, withCredentials } : src).promise)
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch((e) => { if (!cancelled) { setError(e.message || message); onError?.(); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return { doc, error };
}

// The element's width drives the render scale; re-measured on resize.
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Renders one page to a canvas, only once its box comes within `rootMargin`
// of the viewport. Returns the refs to attach and the page's height/width.
export function usePdfPage(doc, index, width, { rootMargin, ratio: initialRatio }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(initialRatio);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!near) return undefined;
    let cancelled = false;
    let task = null;
    doc.getPage(index).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; if (task) task.cancel(); };
  }, [near, doc, index, width]);

  return { canvasRef, boxRef, ratio };
}
