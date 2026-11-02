// Touche de raccourci à afficher dans les infobulles : ⌘ sur Mac, Ctrl ailleurs
export const EST_MAC = window.api?.plateforme === 'darwin';
export const MOD = EST_MAC ? '⌘' : 'Ctrl';
