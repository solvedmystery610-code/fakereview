const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const analyzeImageFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    const image = new Image();

    reader.onload = () => {
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Image load failed"));
    image.onerror = () => reject(new Error("Image load failed"));

    image.onload = () => {
      const width = image.width;
      const height = image.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;
      const pixelCount = width * height;
      const step = Math.max(1, Math.floor(pixelCount / 15000));

      let sum = 0;
      let sumSq = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += brightness;
        sumSq += brightness * brightness;
        count += 1;
      }

      const mean = count ? sum / count : 0;
      const variance = count ? sumSq / count - mean * mean : 0;

      let riskScore = 0;
      const flags = [];

      if (width < 320 || height < 320) {
        riskScore += 20;
        flags.push("Low resolution image detected.");
      }

      if (variance < 200) {
        riskScore += 20;
        flags.push("Low detail image detected.");
      }

      if (mean < 25 || mean > 230) {
        riskScore += 10;
        flags.push("Unusual exposure levels detected.");
      }

      resolve({
        width,
        height,
        mean: Math.round(mean),
        variance: Math.round(variance),
        riskScore: clamp(riskScore, 0, 40),
        flags
      });
    };

    reader.readAsDataURL(file);
  });
