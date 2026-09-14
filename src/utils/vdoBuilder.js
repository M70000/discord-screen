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
    'bitrate=9000',
    'prefervideocodec=h264,vp8',
    'screensharecontenthint=motion',
    'proaudio=1',
    'autostart=1'
  ];

  return `${baseUrl}?${params.join('&')}`;
}

/**
 * Constroi a URL do Espectador (View) com parametros confiaveis para mobile e desktop.
 *
 * CORRECOES IMPORTANTES (VDO.NINJA):
 * - Removido "transparent=1": em navegadores normais/mobile torna o fundo branco (#FFFFFF).
 * - Removido "cleanoutput=1": ocultava o spinner de carregamento e o botao "Tap to Play" no mobile.
 * - Adicionado "darkmode=1" e "holdercolor=000000": garante fundo escuro moderno.
 * - Adicionado "videocontrols=1": exibe controles nativos, volume e botao PiP.
 * - Corrigido "scale=100": a escala e uma porcentagem (0-100), scale=1080 era invalido.
 * - Adicionado "codec=h264,vp8": prioriza H264 com fallback automatico para VP8 no Android.
 *
 * @param {string} roomId Identificador da sala
 * @returns {string} URL de visualizacao do VDO.ninja
 */
function buildViewUrl(roomId) {
  const baseUrl = 'https://vdo.ninja/';
  const params = [
    `view=${encodeURIComponent(roomId)}`,
    'darkmode=1',
    'holdercolor=000000',
    'videocontrols=1',
    'codec=h264,vp8',
    'scale=100',
    'autoplay=1'
  ];

  return `${baseUrl}?${params.join('&')}`;
}

module.exports = {
  generateRoomId,
  buildPushUrl,
  buildViewUrl
};