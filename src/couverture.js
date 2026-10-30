// Une couverture est soit un dégradé prédéfini (« grad:id »), soit une image (data URL JPEG).

export const DEGRADES = [
  { id: 'ocean', css: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { id: 'aurore', css: 'linear-gradient(135deg, #7f7fd5, #86a8e7, #91eae4)' },
  { id: 'coucher', css: 'linear-gradient(135deg, #ff7e5f, #feb47b)' },
  { id: 'rose', css: 'linear-gradient(135deg, #ee9ca7, #ffdde1)' },
  { id: 'foret', css: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { id: 'lavande', css: 'linear-gradient(135deg, #834d9b, #d04ed6)' },
  { id: 'nuit', css: 'linear-gradient(135deg, #232526, #414345)' },
  { id: 'sable', css: 'linear-gradient(135deg, #e6dada, #274046)' },
  { id: 'ciel', css: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { id: 'braise', css: 'linear-gradient(135deg, #f12711, #f5af19)' },
];

// Déclaration CSS « background: … » pour une couverture, ou null
export function cssCouverture(valeur) {
  if (!valeur) return null;
  if (valeur.startsWith('grad:')) {
    const d = DEGRADES.find((x) => x.id === valeur.slice(5));
    return d ? `background: ${d.css};` : null;
  }
  if (valeur.startsWith('data:image/')) {
    return `background: url("${valeur}") center / cover no-repeat;`;
  }
  return null;
}

export function styleCouverture(valeur) {
  if (!valeur) return {};
  if (valeur.startsWith('grad:')) {
    const d = DEGRADES.find((x) => x.id === valeur.slice(5));
    return d ? { background: d.css } : {};
  }
  return { backgroundImage: `url("${valeur}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

// Réduit l'image (1600 px de large au plus) pour ne pas alourdir la base de données
export function lireImageCouverture(fichier, largeurMax = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, largeurMax / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}
