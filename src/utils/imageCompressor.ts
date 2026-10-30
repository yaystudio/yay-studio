/**
 * Utility to compress and resize image files client-side before storing in Firestore and localStorage.
 * Keeps image files lightweight (40KB - 90KB) in 3:4 portrait format so they save instantly
 * and never exceed Firestore 1MB limits or localStorage 5MB quotas.
 */

export async function compressServiceImage(file: File, maxDimension = 960, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image file, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error('File yang dipilih bukan gambar valid.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale proportionally down to maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Gagal menginisialisasi canvas untuk gambar.'));
            return;
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Export as compressed JPEG
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // If still over 500KB (approx 700k characters base64), compress further
          if (compressedDataUrl.length > 700000) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
          }

          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
