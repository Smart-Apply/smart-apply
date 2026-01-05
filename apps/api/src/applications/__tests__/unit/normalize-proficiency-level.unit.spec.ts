import { normalizeProficiencyLevel } from '../../resume-template.util';

describe('normalizeProficiencyLevel', () => {
  describe('Native level variants', () => {
    it.each([
      ['Muttersprache', 'level.native'],
      ['muttersprache', 'level.native'],
      ['MUTTERSPRACHE', 'level.native'],
      ['Native', 'level.native'],
      ['native', 'level.native'],
      ['native speaker', 'level.native'],
      ['muttersprachlich', 'level.native'],
      ['langue maternelle', 'level.native'],
      ['madrelingua', 'level.native'],
      ['nativo', 'level.native'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Fluent level variants', () => {
    it.each([
      ['Fließend', 'level.fluent'],
      ['fließend', 'level.fluent'],
      ['fliessend', 'level.fluent'],
      ['Fluent', 'level.fluent'],
      ['fluent', 'level.fluent'],
      ['Verhandlungssicher', 'level.fluent'],
      ['verhandlungssicher', 'level.fluent'],
      ['courant', 'level.fluent'],
      ['fluido', 'level.fluent'],
      ['fluente', 'level.fluent'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Advanced level variants', () => {
    it.each([
      ['Fortgeschritten', 'level.advanced'],
      ['fortgeschritten', 'level.advanced'],
      ['Advanced', 'level.advanced'],
      ['advanced', 'level.advanced'],
      ['avancé', 'level.advanced'],
      ['avanzado', 'level.advanced'],
      ['avanzato', 'level.advanced'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Good level variants', () => {
    it.each([
      ['Gut', 'level.good'],
      ['gut', 'level.good'],
      ['Good', 'level.good'],
      ['good', 'level.good'],
      ['Sehr gut', 'level.good'],
      ['sehr gut', 'level.good'],
      ['Very good', 'level.good'],
      ['very good', 'level.good'],
      ['Gute Kenntnisse', 'level.good'],
      ['gute kenntnisse', 'level.good'],
      ['bon', 'level.good'],
      ['bueno', 'level.good'],
      ['buono', 'level.good'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Intermediate level variants', () => {
    it.each([
      ['Mittelstufe', 'level.intermediate'],
      ['mittelstufe', 'level.intermediate'],
      ['Intermediate', 'level.intermediate'],
      ['intermediate', 'level.intermediate'],
      ['Mittel', 'level.intermediate'],
      ['mittel', 'level.intermediate'],
      ['intermédiaire', 'level.intermediate'],
      ['intermedio', 'level.intermediate'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Conversational level variants', () => {
    it.each([
      ['Konversationssicher', 'level.conversational'],
      ['konversationssicher', 'level.conversational'],
      ['Conversational', 'level.conversational'],
      ['conversational', 'level.conversational'],
      ['conversationnel', 'level.conversational'],
      ['conversacional', 'level.conversational'],
      ['conversazionale', 'level.conversational'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Basic level variants', () => {
    it.each([
      ['Grundkenntnisse', 'level.basic'],
      ['grundkenntnisse', 'level.basic'],
      ['Basic', 'level.basic'],
      ['basic', 'level.basic'],
      ['Basics', 'level.basic'],
      ['basics', 'level.basic'],
      ['notions de base', 'level.basic'],
      ['básico', 'level.basic'],
      ['base', 'level.basic'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Beginner level variants', () => {
    it.each([
      ['Anfänger', 'level.beginner'],
      ['anfänger', 'level.beginner'],
      ['Beginner', 'level.beginner'],
      ['beginner', 'level.beginner'],
      ['débutant', 'level.beginner'],
      ['principiante', 'level.beginner'],
    ])('should normalize "%s" to "%s"', (input, expected) => {
      expect(normalizeProficiencyLevel(input)).toBe(expected);
    });
  });

  describe('Edge cases', () => {
    it('should return undefined for undefined input', () => {
      expect(normalizeProficiencyLevel(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(normalizeProficiencyLevel('')).toBeUndefined();
    });

    it('should return original value for whitespace-only string (no match)', () => {
      // Whitespace-only strings don't match any level, so return original
      expect(normalizeProficiencyLevel('   ')).toBe('   ');
    });

    it('should trim whitespace before normalizing', () => {
      expect(normalizeProficiencyLevel('  Muttersprache  ')).toBe('level.native');
      expect(normalizeProficiencyLevel('  fluent  ')).toBe('level.fluent');
    });

    it('should return original value for unknown levels', () => {
      expect(normalizeProficiencyLevel('Custom Level')).toBe('Custom Level');
      expect(normalizeProficiencyLevel('A1')).toBe('A1');
      expect(normalizeProficiencyLevel('C2')).toBe('C2');
    });

    it('should handle already normalized values (idempotent)', () => {
      // If the value is already a translation key, it should be returned as-is
      expect(normalizeProficiencyLevel('level.native')).toBe('level.native');
      expect(normalizeProficiencyLevel('level.fluent')).toBe('level.fluent');
    });
  });
});
