import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF subprocess is not traversed by Next's import tracer.
  // Include its local-only runtime closure for this route, not for every page.
  outputFileTracingIncludes: {
    '/api/organizations/*/agents/*/documents/*/process': [
      './scripts/{pdf-extract,pdf-native-layout,ocr-table-cells,ocr-borderless-table,ocr-borderless-numeric,ocr-orientation}.mjs',
      './package-lock.json',
      './src/lib/pdf-extraction.mjs',
      './node_modules/{pdfjs-dist,tesseract.js,tesseract.js-core,bmp-js,idb-keyval,is-url,node-fetch,whatwg-url,tr46,webidl-conversions,regenerator-runtime,wasm-feature-detect,zlibjs}/**/*',
      './node_modules/@napi-rs/canvas*/**/*',
      './node_modules/@tesseract.js-data/por/**/*',
    ],
  },
};

export default nextConfig;
