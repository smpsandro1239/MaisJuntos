// Compressão de imagens no cliente, antes de enviar o comprovativo fotográfico.
// Redimensiona para, no máximo, `maxDim` e exporta JPEG com qualidade controlada,
// para respeitar o limite do backend (~1,6 MB em base64).

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagem inválida.'));
    img.src = src;
  });
}

export async function compressImageFile(
  file: File,
  maxDim = 1024,
  quality = 0.72
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um ficheiro de imagem.');
  }
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
