import { containsAny } from './text.js';

export const STRONG_PRODUCT_KEYWORDS = [
  'ssd',
  'ssd nvme',
  'ssd sata',
  'hd externo',
  'hd interno',
  'memoria ram',
  'ddr4',
  'ddr5',
  'placa mae',
  'placa-mãe',
  'motherboard',
  'processador',
  'cpu',
  'ryzen',
  'intel core',
  'gpu',
  'placa de video',
  'placa de vídeo',
  'rtx',
  'radeon',
  'fonte atx',
  'fonte 80 plus',
  'gabinete',
  'cooler',
  'water cooler',
  'monitor gamer',
  'monitor 144hz',
  'monitor 165hz',
  'monitor 240hz',
  'teclado mecanico',
  'teclado mecânico',
  'teclado gamer',
  'mouse gamer',
  'mousepad gamer',
  'headset gamer',
  'microfone usb',
  'webcam full hd',
  'hub usb',
  'dock station',
  'pc gamer',
  'mini pc gamer',
  'placa de captura',
  'capture card'
];

export const CONTEXTUAL_PRODUCT_KEYWORDS = [
  'cabo hdmi',
  'cabo displayport',
  'cabo ethernet',
  'cabo usb',
  'adaptador usb',
  'adaptador usb c',
  'usb c hub',
  'suporte para monitor',
  'suporte para headset',
  'stream deck',
  'fone usb'
];

export const CONTEXTUAL_PRODUCT_HINTS = [
  'pc',
  'computador',
  'desktop',
  'gamer',
  'gaming',
  'setup',
  'monitor',
  'usb',
  'hdmi',
  'displayport',
  'type c',
  'thunderbolt',
  'ethernet',
  'rj45',
  'streaming',
  'webcam',
  'microfone',
  'audio',
  'dock',
  'estacao',
  'station'
];

export const BLOCKED_KEYWORDS = [
  'ps5',
  'playstation',
  'xbox',
  'nintendo',
  'switch oled',
  'controle ps5',
  'controle xbox',
  'jogo ps5',
  'jogo xbox',
  'poltrona',
  'sofa',
  'sofá',
  'cadeira gamer',
  'mesa gamer',
  'celular',
  'smartphone',
  'iphone',
  'capinha',
  'pelicula',
  'película',
  'tablet',
  'kindle',
  'camera de seguranca',
  'câmera de segurança',
  'baba eletronica',
  'babá eletrônica',
  'ring light maquiagem',
  'ring light',
  'luminaria',
  'luminária',
  'smartwatch',
  'carregador sem fio',
  'power bank',
  'fone bluetooth esportivo',
  'impressora',
  'multifuncional',
  'toner',
  'cartucho',
  'refil de tinta',
  'nobreak',
  'filtro de linha',
  'roteador',
  'repetidor wifi',
  'mesh wifi',
  'sinalizacao',
  'sinalização',
  'placa de sinalizacao',
  'placa de sinalização',
  'tesoura',
  'cola para biscuit',
  'biscuit',
  'lixeira',
  'banheiro',
  'pictograma',
  'cadeirante',
  'fumar',
  'papelaria',
  'escolar',
  'tv',
  'televisao',
  'televisão',
  'controle remoto'
];

export const STRONG_CATEGORIES = [
  'Armazenamento SSD',
  'SSD',
  'Memória RAM',
  'RAM',
  'Memory',
  'Placa-mãe',
  'Motherboard',
  'Processador',
  'Processor',
  'Placa de vídeo',
  'Graphics Card',
  'Fonte',
  'Power Supply',
  'Cooler',
  'CPU Cooler',
  'Monitor',
  'Teclado gamer',
  'Gaming Keyboard',
  'Mouse gamer',
  'Gaming Mouse',
  'Mousepad',
  'Headset gamer',
  'Gaming Headset',
  'Microfone',
  'Microphone',
  'Webcam',
  'Hub USB',
  'USB Hub',
  'Placa de captura',
  'Capture Card',
  'Armazenamento',
  'Storage',
  'Mini PC',
  'Gabinete',
  'PC Case',
  'Dock',
  'Hardware'
];

export const CONTEXTUAL_CATEGORIES = [
  'Acessórios',
  'Acessórios de PC',
  'Streaming',
  'Áudio',
  'Audio',
  'Periféricos',
  'Peripherals'
];

export const DISCOVERY_TERMS = [
  ...STRONG_PRODUCT_KEYWORDS,
  ...CONTEXTUAL_PRODUCT_KEYWORDS,
  ...CONTEXTUAL_PRODUCT_HINTS
];

export const RELEVANT_PRODUCT_HINTS = [
  ...STRONG_PRODUCT_KEYWORDS,
  ...CONTEXTUAL_PRODUCT_KEYWORDS,
  ...CONTEXTUAL_PRODUCT_HINTS
];

export const EXCLUDE_KEYWORDS = [
  'usado',
  'recondicionado',
  'refurbished',
  'defeito',
  'quebrado',
  ...BLOCKED_KEYWORDS
];

export const MONITORED_CATEGORIES = [
  ...STRONG_CATEGORIES,
  ...CONTEXTUAL_CATEGORIES
];

export function matchesBlockedKeyword(text) {
  return containsAny(text, BLOCKED_KEYWORDS);
}

export function matchesStrongKeyword(text) {
  return containsAny(text, STRONG_PRODUCT_KEYWORDS);
}

export function matchesContextualKeyword(text) {
  return containsAny(text, CONTEXTUAL_PRODUCT_KEYWORDS);
}

export function hasContextualSupport(text) {
  return containsAny(text, CONTEXTUAL_PRODUCT_HINTS);
}
