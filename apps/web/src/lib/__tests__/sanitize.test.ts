/**
 * Sanitization Utility Tests
 * 
 * Tests for XSS protection functions in the frontend.
 * Verifies proper sanitization of HTML, text, URLs, and arrays.
 */

import {
  sanitizeHtml,
  sanitizeText,
  sanitizeUrl,
  stripHtml,
  sanitizeArray,
} from '../sanitize';

describe('Sanitization Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeHtml(input);
      
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should remove script tags', () => {
      const input = '<p>Safe</p><script>alert("XSS")</script>';
      const result = sanitizeHtml(input);
      
      expect(result).toContain('<p>');
      expect(result).toContain('Safe');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove inline event handlers', () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should remove dangerous iframes', () => {
      const input = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('iframe');
      expect(result).not.toContain('javascript:');
    });

    it('should allow safe links with http/https', () => {
      const input = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(input);
      
      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Link');
    });

    it('should remove javascript: protocol from links', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('javascript:');
    });

    it('should allow mailto: links', () => {
      const input = '<a href="mailto:test@example.com">Email</a>';
      const result = sanitizeHtml(input);
      
      expect(result).toContain('mailto:test@example.com');
    });
  });

  describe('sanitizeText', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeText(input);
      
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should escape all dangerous characters', () => {
      const input = '< > " \' / &';
      const result = sanitizeText(input);
      
      expect(result).toBe('&lt; &gt; &quot; &#x27; &#x2F; &amp;');
    });

    it('should preserve safe text', () => {
      const input = 'Hello World 123';
      const result = sanitizeText(input);
      
      expect(result).toBe('Hello World 123');
    });

    it('should handle empty strings', () => {
      const result = sanitizeText('');
      expect(result).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeText(null as any)).toBe('');
      expect(sanitizeText(undefined as any)).toBe('');
      expect(sanitizeText(123 as any)).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow http URLs', () => {
      const input = 'http://example.com';
      const result = sanitizeUrl(input);
      
      expect(result).toBe('http://example.com');
    });

    it('should allow https URLs', () => {
      const input = 'https://example.com/path?query=value';
      const result = sanitizeUrl(input);
      
      expect(result).toBe('https://example.com/path?query=value');
    });

    it('should reject javascript: protocol', () => {
      const input = 'javascript:alert("XSS")';
      const result = sanitizeUrl(input);
      
      expect(result).toBe('');
    });

    it('should reject data: protocol', () => {
      const input = 'data:text/html,<script>alert("XSS")</script>';
      const result = sanitizeUrl(input);
      
      expect(result).toBe('');
    });

    it('should reject file: protocol', () => {
      const input = 'file:///etc/passwd';
      const result = sanitizeUrl(input);
      
      expect(result).toBe('');
    });

    it('should handle invalid URLs', () => {
      const result = sanitizeUrl('not a url');
      expect(result).toBe('');
    });

    it('should handle empty strings', () => {
      const result = sanitizeUrl('');
      expect(result).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeUrl(null as any)).toBe('');
      expect(sanitizeUrl(undefined as any)).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '  https://example.com  ';
      const result = sanitizeUrl(input);
      
      expect(result).toBe('https://example.com');
    });
  });

  describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = stripHtml(input);
      
      expect(result).toBe('Hello World');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should remove script tags and content', () => {
      const input = 'Safe text<script>alert("XSS")</script>More text';
      const result = stripHtml(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe text');
      expect(result).toContain('More text');
    });

    it('should handle plain text', () => {
      const input = 'Just plain text';
      const result = stripHtml(input);
      
      expect(result).toBe('Just plain text');
    });

    it('should handle empty strings', () => {
      const result = stripHtml('');
      expect(result).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(stripHtml(null as any)).toBe('');
      expect(stripHtml(undefined as any)).toBe('');
    });
  });

  describe('sanitizeArray', () => {
    it('should sanitize all items in array', () => {
      const input = [
        '<script>alert("XSS")</script>',
        'Safe text',
        '<img src=x onerror=alert(1)>',
      ];
      const result = sanitizeArray(input);
      
      expect(result[0]).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(result[1]).toBe('Safe text');
      expect(result[2]).toContain('&lt;img');
    });

    it('should handle empty array', () => {
      const result = sanitizeArray([]);
      expect(result).toEqual([]);
    });

    it('should handle non-string items', () => {
      const input = ['text', 123 as any, null as any, undefined as any];
      const result = sanitizeArray(input);
      
      expect(result[0]).toBe('text');
      expect(result[1]).toBe('123');
      expect(result[2]).toBe('null');
      expect(result[3]).toBe('undefined');
    });

    it('should handle non-array inputs', () => {
      expect(sanitizeArray(null as any)).toEqual([]);
      expect(sanitizeArray(undefined as any)).toEqual([]);
      expect(sanitizeArray('not array' as any)).toEqual([]);
    });
  });

  describe('XSS Attack Vectors', () => {
    const attackVectors = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<a href="javascript:alert(\'XSS\')">Click</a>',
      '<div style="background:url(javascript:alert(\'XSS\'))">',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<IMG SRC=j&#X41vascript:alert("XSS")>',
    ];

    attackVectors.forEach((vector, index) => {
      it(`should neutralize attack vector #${index + 1}`, () => {
        const htmlResult = sanitizeHtml(vector);
        const textResult = sanitizeText(vector);
        
        // Neither result should contain executable JavaScript
        expect(htmlResult).not.toMatch(/javascript:/i);
        expect(htmlResult).not.toMatch(/onerror=/i);
        expect(htmlResult).not.toMatch(/onload=/i);
        expect(htmlResult).not.toMatch(/onfocus=/i);
        
        expect(textResult).not.toContain('<script');
        expect(textResult).not.toContain('javascript:');
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle user bio with mixed content', () => {
      const input = 'I am a <strong>developer</strong><script>alert("XSS")</script> with 5+ years experience.';
      const result = sanitizeHtml(input);
      
      expect(result).toContain('developer');
      expect(result).toContain('<strong>');
      expect(result).toContain('5+ years');
      expect(result).not.toContain('<script>');
    });

    it('should handle profile summary with safe formatting', () => {
      const input = '<p>Experienced in:</p><ul><li>JavaScript</li><li>TypeScript</li></ul>';
      const result = sanitizeHtml(input);
      
      expect(result).toContain('<p>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
      expect(result).toContain('JavaScript');
      expect(result).toContain('TypeScript');
    });

    it('should handle URLs from untrusted sources', () => {
      const maliciousUrls = [
        'javascript:void(0)',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
      ];

      maliciousUrls.forEach(url => {
        expect(sanitizeUrl(url)).toBe('');
      });
    });

    it('should preserve legitimate content in skills array', () => {
      const skills = ['React', 'Node.js', 'TypeScript & JavaScript', 'C++'];
      const result = sanitizeArray(skills);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('React');
      expect(result[1]).toBe('Node.js');
      expect(result[2]).toBe('TypeScript &amp; JavaScript'); // & escaped
      expect(result[3]).toBe('C++');
    });
  });
});
