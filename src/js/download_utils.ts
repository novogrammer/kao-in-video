
export const downloadURL = (url:string, fileName:string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.style.display = 'none';
  a.click();
  a.remove();
}

export const downloadBinary = (binaryData:Uint8Array, filename:string, mimeType:string) => {
  const blob = new Blob([binaryData], {
    type: mimeType
  });
  const url = window.URL.createObjectURL(blob);

  downloadURL(url, filename);

  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}