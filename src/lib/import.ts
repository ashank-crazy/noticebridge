const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 8;
const MAX_TEXT = 50000;

export async function readNoticeFile(file: File, progress: (message: string) => void): Promise<{ text: string; kind: "text" | "pdf" | "image" }> {
  if (file.size > MAX_BYTES) throw new Error("Please choose a file smaller than 10 MB.");
  if (/\.txt$/i.test(file.name) || file.type === "text/plain") {
    const text = await file.text();
    if (text.length > MAX_TEXT) throw new Error("This notice is too long. Please keep it under 50,000 characters.");
    return { text, kind: "text" };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    progress("Opening your PDF…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    let worker: Awaited<ReturnType<typeof makeOcrWorker>> | undefined;
    try {
      if (pdf.numPages > MAX_PAGES) throw new Error(`Please use a notice with ${MAX_PAGES} pages or fewer.`);
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        progress(`Reading page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let text = "";
        let previousY: number | undefined;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5];
          if (previousY !== undefined && Math.abs(y - previousY) > 4 && !text.endsWith("\n")) text += "\n";
          text += item.str + (item.hasEOL ? "\n" : " ");
          previousY = y;
        }
        if (text.trim().length < 30) {
          progress(`Reading scanned page ${i}… first use downloads the text recognition model.`);
          worker ??= await makeOcrWorker(progress);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = window.document.createElement("canvas");
          canvas.width = viewport.width; canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Your browser could not read this scanned page. Try pasting the notice text.");
          await page.render({ canvasContext: context, canvas, viewport }).promise;
          text = (await worker.recognize(canvas)).data.text;
          canvas.width = canvas.height = 0;
        }
        pages.push(text.trim());
        if (pages.join("\n\n").length > MAX_TEXT) throw new Error("This PDF contains too much text. Please upload only the notice pages.");
      }
      return { text: pages.join("\n\n"), kind: "pdf" };
    } finally { await worker?.terminate(); await pdf.destroy(); }
  }
  if (/^image\/(?:png|jpeg|webp|bmp)$/.test(file.type) || /\.(?:png|jpe?g|webp|bmp)$/i.test(file.name)) {
    progress("Reading your image… first use downloads the text recognition model.");
    const worker = await makeOcrWorker(progress);
    try { return { text: (await worker.recognize(file)).data.text, kind: "image" }; }
    finally { await worker.terminate(); }
  }
  throw new Error("Please choose a PDF, PNG, JPG, WebP, or plain text file.");
}

async function makeOcrWorker(progress: (message: string) => void) {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng", 1, { logger: (m: { status: string; progress: number }) => {
    if (m.status === "recognizing text") progress(`Reading text… ${Math.round(m.progress * 100)}%`);
  } });
}
