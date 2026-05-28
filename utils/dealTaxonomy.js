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
  'processador',
  'cpu',
  'gpu',
  'placa de video',
  'fonte atx',
  'gabinete',
  'cooler',
  'water cooler',
  'monitor',
  'teclado',
  'mouse',
  'mousepad',
  'headset',
  'microfone usb',
  'webcam',
  'hub usb',
  'dock station',
  'roteador',
  'switch gigabit',
  'repetidor wifi',
  'mesh wifi',
  'nobreak',
  'filtro de linha',
  'impressora',
  'toner',
  'cartucho',
  'notebook',
  'mini pc',
  'pc gamer',
  'all in one',
  'usb c hub',
  'station'
];

export const CONTEXTUAL_PRODUCT_KEYWORDS = [
  'cabo',
  'adaptador',
  'dock station',
  'capture card',
  'stream deck',
  'suporte para monitor',
  'suporte para headset',
  'fone usb',
  'adaptador usb',
  'adaptador usb c',
  'cabo hdmi',
  'cabo displayport',
  'cabo ethernet',
  'cabo usb'
];

export const CONTEXTUAL_PRODUCT_HINTS = [
  'pc',
  'notebook',
  'monitor',
  'usb',
  'hdmi',
  'displayport',
  'type c',
  'thunderbolt',
  'ethernet',
  'rj45',
  'wifi',
  'rede',
  'gaming',
  'gamer',
  'streaming',
  'webcam',
  'microfone',
  'audio',
  'roteador',
  'switch',
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
  'poltrona',
  'sofa',
  'celular',
  'smartphone',
  'iphone',
  'capinha',
  'pelicula',
  'tablet',
  'kindle',
  'camera de seguranca',
  'baba eletronica',
  'ring light maquiagem',
  'luminaria',
  'smartwatch',
  'carregador sem fio',
  'power bank',
  'fone bluetooth esportivo',
  'controle ps5',
  'controle xbox',
  'sinalizacao',
  'placa de sinalizacao',
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
  'Headset gamer',
  'Gaming Headset',
  'Microfone',
  'Microphone',
  'Webcam',
  'Hub USB',
  'USB Hub',
  'Placa de captura',
  'Capture Card',
  'Rede',
  'Networking',
  'Impressora',
  'Printer',
  'Armazenamento',
  'Storage',
  'Notebook',
  'Notebook',
  'Mini PC',
  'Mini PC',
  'Gabinete',
  'PC Case',
  'Dock',
  'Periféricos',
  'Peripherals',
  'Hardware',
  'Espaço Gamer'
];

export const CONTEXTUAL_CATEGORIES = [
  'Acessórios',
  'Acessórios de PC',
  'Streaming',
  'Áudio',
  'Audio'
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
  'quebrado'
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
