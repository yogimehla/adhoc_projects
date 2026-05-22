// ---------------------------------------------------------------------------
// JSZip is an optional peer dependency — only needed when ChromaRestoreButton
// receives a .zip file. Consumers must install jszip themselves.
// ---------------------------------------------------------------------------
declare module 'jszip' {
  const JSZip: any;
  export default JSZip;
}
