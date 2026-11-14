/**
 * Beatmap JSON Schema Specification (Version 2)
 */

export const BEATMAP_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TriarhythmBeatmap',
  type: 'object',
  required: ['version', 'layout', 'metadata', 'assets', 'settings', 'timingPoints', 'notes'],
  properties: {
    version: {
      type: 'integer',
      const: 2
    },
    layout: {
      type: 'string',
      default: 'triRing9'
    },
    metadata: {
      type: 'object',
      required: ['id', 'title', 'artist', 'creator', 'difficultyName'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        artist: { type: 'string' },
        creator: { type: 'string' },
        creatorUid: { type: 'string' },
        difficultyName: { type: 'string' },
        stars: { type: 'number', minimum: 0 },
        previewTime: { type: 'number', minimum: 0 },
        source: { type: 'string', enum: ['osu', 'manual', 'custom'] },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    assets: {
      type: 'object',
      required: ['audio'],
      properties: {
        audio: { type: 'string' },
        background: { type: ['string', 'null'] },
        video: { type: ['string', 'null'] },
        videoOffset: { type: 'number' },
        hitsounds: { type: 'object' }
      }
    },
    settings: {
      type: 'object',
      required: ['noteSpeed'],
      properties: {
        noteSpeed: { type: 'number', minimum: 1.0, maximum: 10.0 },
        audioLeadIn: { type: 'number', minimum: 0 }
      }
    },
    timingPoints: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['time', 'bpm', 'beatLength', 'meter', 'uninherited'],
        properties: {
          time: { type: 'number' },
          bpm: { type: 'number', exclusiveMinimum: 0 },
          beatLength: { type: 'number', exclusiveMinimum: 0 },
          meter: { type: 'integer', minimum: 1 },
          uninherited: { type: 'boolean' },
          volume: { type: 'number', minimum: 0, maximum: 100 },
          sampleSet: { type: 'string' }
        }
      }
    },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'time'],
        properties: {
          type: {
            type: 'string',
            enum: ['tap', 'hold', 'break', 'slide', 'typing', 'ring']
          },
          time: { type: 'number', minimum: 0 },
          lane: { type: 'integer', minimum: 0, maximum: 8 },
          endTime: { type: 'number', minimum: 0 },
          isHold: { type: 'boolean' },
          isBreakHold: { type: 'boolean' },
          path: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: { type: 'integer', minimum: 0, maximum: 2 }
          },
          waitBeats: { type: 'number', minimum: 0.5, maximum: 4.0 },
          beatsPerSegment: { type: 'number', minimum: 0.5, maximum: 8.0 },
          chars: {
            type: 'array',
            items: {
              type: 'object',
              required: ['time', 'char'],
              properties: {
                time: { type: 'number' },
                char: { type: 'string', minLength: 1, maxLength: 1 }
              }
            }
          }
        }
      }
    }
  }
};
