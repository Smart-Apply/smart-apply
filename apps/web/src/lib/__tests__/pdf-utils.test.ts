/**
 * Tests for PDF utility functions, especially generatePdfFilename
 */

import { generatePdfFilename, generateFilename } from '../pdf-utils';

describe('generatePdfFilename', () => {
  describe('Normal cases with all data', () => {
    it('should generate filename with all components', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        firstName: 'Max',
        company: 'BWI GmbH',
        position: 'Solution Architect',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Mustermann_BWI-GmbH_Solution-Architect_Anschreiben.pdf');
    });
    
    it('should generate resume filename', () => {
      const result = generatePdfFilename({
        lastName: 'Schmidt',
        company: 'SAP',
        position: 'Developer',
        documentType: 'Lebenslauf',
      });
      
      expect(result).toBe('Schmidt_SAP_Developer_Lebenslauf.pdf');
    });
  });
  
  describe('Umlaut replacement', () => {
    it('should replace German umlauts correctly', () => {
      const result = generatePdfFilename({
        lastName: 'Müller',
        company: 'Städtische Werke München',
        position: 'Geschäftsführer',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Mueller_Staedtische-Werke-Muenchen_Geschaeftsfuehrer_Anschreiben.pdf');
    });
    
    it('should replace ß with ss', () => {
      const result = generatePdfFilename({
        lastName: 'Große',
        company: 'Straßenbau',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Grosse_Strassenbau_Anschreiben.pdf');
    });
  });
  
  describe('Special character handling', () => {
    it('should remove special characters', () => {
      const result = generatePdfFilename({
        lastName: "O'Brien",
        company: 'Tech & Co.',
        position: 'Software Engineer (m/w/d)',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('OBrien_Tech-Co_Software-Engineer-mwd_Anschreiben.pdf');
    });
    
    it('should normalize spaces to hyphens', () => {
      const result = generatePdfFilename({
        lastName: 'Van der Berg',
        company: 'International Business Machines',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Van-der-Berg_International-Business-Machines_Anschreiben.pdf');
    });
    
    it('should remove duplicate separators', () => {
      const result = generatePdfFilename({
        lastName: 'Test--Name',
        company: 'Company  &  Co',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Test-Name_Company-Co_Anschreiben.pdf');
    });
  });
  
  describe('Length management', () => {
    it('should truncate position when too long', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        company: 'BWI',
        position: 'Senior Solution Architect for Enterprise Cloud Infrastructure and DevOps',
        documentType: 'Anschreiben',
        maxLength: 80,
      });
      
      // Position should be truncated to 20 chars
      expect(result.length).toBeLessThanOrEqual(80);
      expect(result).toContain('Mustermann');
      expect(result).toContain('BWI');
    });
    
    it('should remove position when still too long', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        company: 'Bundesamt für Migration und Flüchtlinge',
        position: 'Senior Solution Architect',
        documentType: 'Anschreiben',
        maxLength: 60,
      });
      
      expect(result.length).toBeLessThanOrEqual(60);
      expect(result).toContain('Mustermann');
      expect(result).not.toContain('Senior');
    });
    
    it('should truncate company when too long', () => {
      const result = generatePdfFilename({
        lastName: 'Schmidt',
        company: 'Bundesministerium für Wirtschaft und Klimaschutz Abteilung Digitalisierung',
        documentType: 'Anschreiben',
        maxLength: 80,
      });
      
      expect(result.length).toBeLessThanOrEqual(80);
      expect(result).toContain('Schmidt');
    });
    
    it('should respect custom maxLength', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        company: 'Very Long Company Name Corporation International',
        position: 'Position',
        documentType: 'Anschreiben',
        maxLength: 50,
      });
      
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });
  
  describe('Edge cases and fallbacks', () => {
    it('should handle missing company', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        position: 'Developer',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Mustermann_Developer_Anschreiben.pdf');
    });
    
    it('should handle missing position', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        company: 'BWI',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Mustermann_BWI_Anschreiben.pdf');
    });
    
    it('should handle only lastname', () => {
      const result = generatePdfFilename({
        lastName: 'Mustermann',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Mustermann_Anschreiben.pdf');
    });
    
    it('should handle only firstname (no lastname)', () => {
      const result = generatePdfFilename({
        firstName: 'Max',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Max_Anschreiben.pdf');
    });
    
    it('should use generic fallback when no name provided', () => {
      const result = generatePdfFilename({
        company: 'BWI',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Bewerbung_Anschreiben.pdf');
    });
    
    it('should handle empty strings', () => {
      const result = generatePdfFilename({
        lastName: '',
        firstName: '',
        company: '',
        position: '',
        documentType: 'Anschreiben',
      });
      
      expect(result).toBe('Bewerbung_Anschreiben.pdf');
    });
  });
  
  describe('Document types', () => {
    it('should handle Anschreiben document type', () => {
      const result = generatePdfFilename({
        lastName: 'Test',
        documentType: 'Anschreiben',
      });
      
      expect(result).toContain('Anschreiben.pdf');
    });
    
    it('should handle Lebenslauf document type', () => {
      const result = generatePdfFilename({
        lastName: 'Test',
        documentType: 'Lebenslauf',
      });
      
      expect(result).toContain('Lebenslauf.pdf');
    });
  });
});

describe('generateFilename (legacy)', () => {
  it('should use new format with profile data', () => {
    const result = generateFilename(
      'cover-letter',
      'BWI GmbH',
      'Solution Architect',
      'Mustermann',
      'Max'
    );
    
    expect(result).toBe('Mustermann_BWI-GmbH_Solution-Architect_Anschreiben.pdf');
  });
  
  it('should work without profile data', () => {
    const result = generateFilename(
      'resume',
      'SAP',
      'Developer'
    );
    
    expect(result).toBe('Bewerbung_Lebenslauf.pdf');
  });
  
  it('should map cover-letter to Anschreiben', () => {
    const result = generateFilename(
      'cover-letter',
      'Company',
      undefined,
      'Test'
    );
    
    expect(result).toContain('Anschreiben.pdf');
  });
  
  it('should map resume to Lebenslauf', () => {
    const result = generateFilename(
      'resume',
      'Company',
      undefined,
      'Test'
    );
    
    expect(result).toContain('Lebenslauf.pdf');
  });
});
