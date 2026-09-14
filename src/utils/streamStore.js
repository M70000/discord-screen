/**
 * Armazenamento em memória das transmissões ativas.
 * Mapeia userId -> objeto de stream
 */
class StreamStore {
  constructor() {
    this.activeStreams = new Map();
  }

  /**
   * Salva ou atualiza uma transmissão ativa.
   * @param {string} userId ID do transmissor
   * @param {Object} streamData Dados da transmissão
   * @param {string} streamData.roomId ID da sala VDO.ninja
   * @param {string} streamData.channelId ID do canal de texto
   * @param {string} streamData.messageId ID da mensagem pública
   * @param {string} streamData.voiceChannelId ID do canal de voz
   * @param {string} streamData.voiceChannelName Nome do canal de voz
   * @param {string} streamData.pushUrl URL de transmissÿo privada
   * @param {string} streamData.viewUrl URL de visualização pública
   * @param {Date} [streamData.startedAt] Data/hora de início
   */
  setStream(userId, streamData) {
    this.activeStreams.set(userId, {
      ...streamData,
      startedAt: streamData.startedAt || new Date()
    });
  }

  /**
   * Retorna dados da stream ativa de um usuário.
   * @param {string} userId ID do transmissor
   * @returns {Object|null}
   */
  getStream(userId) {
    return this.activeStreams.get(userId) || null;
  }


  /**
   * Remove a stream ativa de um usuário.
   * @param {string} userId ID do transmissor
   * @returns{boolean}
   */
  deleteStream(userId) {
    return this.activeStreams.delete(userId);
  }


  /**
   * Verifica se o usuário Z�  tem uma stream ativa.
   * @param {string} userId
   * @returns {boolean}
   */
  hasActiveStream(userId) {
    return this.activeStreams.has(userId);
  }


  /**
   * Retorna todas as streams ativas.
   * @returns {Map<string, Object>}
   */
  getAllStreams() {
    return this.activeStreams;
  }
}

// Instância singleton compartilhada
const streamStore = new StreamStore();

module.exports = streamStore;