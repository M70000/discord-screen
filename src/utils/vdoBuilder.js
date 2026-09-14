const crypto = require('crypto');

/**
 * Gera um identificador unico, aleatorio e seguro para a sala do VDO.ninja.
 * @returns {string} ID unico da sala
 */
function generateRoomId() {
  const timestamp = Date.now().toString(36);
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `live_${timestamp}_${randomSuffix}`;
}

/**
 * Constroi a URL do Transmissor (Push) com parametros otimizados para 1080p 60fps.
 *
 * NOTA CRITICA DO VDO.NINJA:
 * - NUNCA inclua webcam=0, pois o VDO.ninja apenas checa se "webcam" existe na URL,
 *   ativando o modo de camera.
 * - Usamos screenshare puro e quality=0 (1080r nativo) para abrir a captura de tela.
 *
 * @param {string} roomId Identificador da sala
 * @returns {string} URL de push do VDO.ninja
 */
function buildPushUrl(roomId) {
  const baseUrl = 'https://vdo.ninja/';
  const params = [
    `push=${encodeURIComponent(roomId)}`,
    'screenshare',
    'quality=0',
    'fps=60',
    'scale=1080',
    'bitrate=9000',
    'codec=h264',
    'contenthint=motion',
    'proaudio=1',
    'broadcast=1',
    'autostart=1',
    'cleanoutput=1'
  ];

  return `${baseUrl}?${params.join('&')}`;
}

/**
 * Constroi a URL do Espectador (View) com parametros otimizados para PiP e visual limpo.
 * @param {string} roomId Identificador da sala
 * @returns {string} URL de visualizacao do VDO.ninja
 */
function buildViewUrl(roomId) {
  const baseUrl = 'https://vdo.ninja/';
  const params = [
    `view=${encodeURIComponent(roomId)}`,
    'cleanoutput=1',
    'pip=1',
    'scale=1080',
    'transparent=1'
  ];

  return `${baseUrl}?${params.join('&')}`;
}

module.exports = {
  generateRoomId,
  buildPushUrl,
  buildViewUrl
};