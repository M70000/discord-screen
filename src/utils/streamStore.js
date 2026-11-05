/**
 * Armazenamento em memória das transmissões ativas.
 * Mapeia userId -> objeto de stream e streamId -> objeto de stream
 */
class StreamStore {
  constructor() {
    this.activeStreams = new Map(); // userId -> streamData
    this.streamsById = new Map();   // streamId -> streamData
    this.preferredChannels = new Map(); // userId -> { channelId, timestamp }
  }

  /**
   * Salva um canal preferencial temporário para o próximo início de live.
   * @param {string} userId
   * @param {string} channelId
   */
  setPreferredChannel(userId, channelId) {
    this.preferredChannels.set(userId, { channelId, timestamp: Date.now() });
  }

  /**
   * Retorna o canal preferencial temporário do usuário (se ainda válido nos últimos 15 min).
   * @param {string} userId
   * @returns {string|null}
   */
  getPreferredChannel(userId) {
    const entry = this.preferredChannels.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > 15 * 60 * 1000) {
      this.preferredChannels.delete(userId);
      return null;
    }
    return entry.channelId;
  }

  /**
   * Limpa o canal preferencial do usuário.
   * @param {string} userId
   */
  clearPreferredChannel(userId) {
    this.preferredChannels.delete(userId);
  }

  /**
   * Salva ou atualiza uma transmissão ativa.
   * @param {string} userId ID do transmissor no Discord
   * @param {Object} streamData Dados da transmissão
   * @param {string} streamData.streamId Identificador único da live
   * @param {string} streamData.streamUrl URL pública do túnel (HLS)
   * @param {string} [streamData.channelId] ID do canal de anúncio no Discord
   * @param {string} [streamData.messageId] ID da mensagem do anúncio
   * @param {string} [streamData.voiceChannelId] ID do canal de voz onde o streamer está
   * @param {string} [streamData.voiceChannelName] Nome do canal de voz
   * @param {Date} [streamData.startedAt] Data/hora de início
   */
  setStream(userId, streamData) {
    // Se já havia uma stream para este userId, remove o streamId antigo do índice secundário
    const existing = this.activeStreams.get(userId);
    if (existing && existing.streamId && existing.streamId !== streamData.streamId) {
      this.streamsById.delete(existing.streamId);
    }

    const record = {
      ...streamData,
      userId,
      startedAt: streamData.startedAt instanceof Date ? streamData.startedAt : new Date()
    };

    this.activeStreams.set(userId, record);
    if (record.streamId) {
      this.streamsById.set(record.streamId, record);
    }

    return record;
  }

  /**
   * Retorna dados da stream ativa de um usuário pelo seu ID do Discord.
   * @param {string} userId ID do transmissor
   * @returns {Object|null}
   */
  getStream(userId) {
    return this.activeStreams.get(userId) || null;
  }

  /**
   * Retorna dados da stream ativa pelo identificador único da live.
   * @param {string} streamId Identificador único da stream
   * @returns {Object|null}
   */
  getStreamById(streamId) {
    return this.streamsById.get(streamId) || null;
  }

  /**
   * Remove a stream ativa de um usuário.
   * @param {string} userId ID do transmissor
   * @returns {boolean}
   */
  deleteStream(userId) {
    const stream = this.activeStreams.get(userId);
    if (!stream) {
      return false;
    }

    if (stream.streamId) {
      this.streamsById.delete(stream.streamId);
    }
    return this.activeStreams.delete(userId);
  }

  /**
   * Remove a stream ativa pelo identificador do stream.
   * @param {string} streamId
   * @returns {boolean}
   */
  deleteStreamById(streamId) {
    const stream = this.streamsById.get(streamId);
    if (!stream) {
      return false;
    }
    return this.deleteStream(stream.userId);
  }

  /**
   * Verifica se o usuário tem uma stream ativa.
   * @param {string} userId
   * @returns {boolean}
   */
  hasActiveStream(userId) {
    return this.activeStreams.has(userId);
  }

  /**
   * Retorna todas as streams ativas em formato de Array.
   * @returns {Array<Object>}
   */
  getAllStreams() {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Limpa todas as streams em memória (útil para testes).
   */
  clear() {
    this.activeStreams.clear();
    this.streamsById.clear();
  }
}

// Instância singleton compartilhada
const streamStore = new StreamStore();

module.exports = streamStore;
