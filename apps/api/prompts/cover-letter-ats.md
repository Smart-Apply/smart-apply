# Cover Letter Generation with ATS Optimization

## Context

You are writing a cover letter optimized for Applicant Tracking Systems (ATS) while remaining engaging for human readers. Your goal is to strategically place extracted keywords in optimal positions for ATS scanning while maintaining natural, professional content.

## Candidate Profile

{{profile}}

## Job Posting

- **Position:** {{jobTitle}}
- **Company:** {{companyName}}
- **Location:** {{location}}
- **Description:** {{jobDescription}}

## Matched Keywords (Use strategically)

These keywords were found in both the job posting and the candidate's profile. Use them prominently:

{{matchedKeywords}}

### By Category:
- **Technical Skills:** {{technicalKeywords}}
- **Soft Skills:** {{softSkillKeywords}}
- **Experience Keywords:** {{experienceKeywords}}
- **Industry Keywords:** {{industryKeywords}}

## Missing Keywords (Mention if candidate has relevant experience)

These keywords are in the job posting but not explicitly in the profile. Include if the candidate has transferable skills:

{{missingKeywords}}

## Instructions

### Structure (ATS-Optimized)

1. **Opening Paragraph** (CRITICAL for ATS)
   - Include 3-5 top keywords naturally in the first paragraph
   - State the position title exactly as in job posting
   - Mention the top matching technical skill immediately
   - Show enthusiasm while integrating keywords
   - Example: "I am excited to apply for the Senior Full-Stack Developer position. With 5+ years of experience in React, Node.js, and TypeScript, I am confident I can contribute to your team's success."

2. **Body Paragraphs** (2-3 paragraphs)
   - Each paragraph focuses on 2-3 keywords from the job posting
   - Use STAR method (Situation, Task, Action, Result) with keywords
   - Quantify achievements and pair them with keywords
   - Examples:
     * "Led a React development team of 5 engineers, increasing application performance by 40%"
     * "Implemented CI/CD pipeline using Jenkins and Docker, reducing deployment time by 60%"
     * "Collaborated with cross-functional teams using Agile methodology to deliver features on time"

3. **Closing Paragraph**
   - Reinforce top 2-3 keywords one more time
   - Express enthusiasm for the company
   - Include a confident call to action

### Keyword Placement Rules

✅ **DO:**
- Use exact keyword phrases from the job posting
- Place 3-5 keywords in the first paragraph (highest ATS weight)
- Repeat top 3 keywords at least twice (in different contexts)
- Use keywords alongside quantifiable achievements
- Match technical terms exactly (case-sensitive where applicable)
- Use action verbs paired with keywords (Led, Developed, Implemented, Optimized)

❌ **DON'T:**
- Stuff keywords unnaturally (density should be < 3%)
- Use keyword lists or bullet points in the main text
- Sacrifice readability for keyword placement
- Force keywords where they don't fit naturally
- Use the same phrasing for repeated keywords

### Keyword Density Guidelines

- **Optimal density:** 2-3% (keywords should feel natural, not forced)
- **Strategic repetition:** Important keywords appear 2-3 times maximum
- **Varied contexts:** Same keyword used differently each time
  * First mention: In skills context
  * Second mention: In achievement context
  * Third mention: In motivation/value context

### Tone

- Professional yet warm and personable
- Confident but not arrogant
- Specific and concrete, not generic
- Action-oriented with strong verbs

### CRITICAL: Language Requirement

**Detected Language:** {{language}} ({{languageName}})

**YOU MUST write the cover letter in {{languageName}}!**

- If language is "de" → Write EVERYTHING in German (Sehr geehrte Damen und Herren, Mit freundlichen Grüßen)
- If language is "en" → Write EVERYTHING in English (Dear Hiring Manager, Best regards)
- DO NOT mix languages
- Use formal address appropriate to the language (Sie/du in German, you in English)

### Formatting

Return the cover letter as **clean HTML** (no markdown).

**LANGUAGE-SPECIFIC EXAMPLES:**

**If language is "de" (German):**
```html
<p>Sehr geehrte Damen und Herren,</p>

<p>Opening paragraph with keywords integrated naturally IN GERMAN...</p>

<p>Body paragraph 1 with STAR achievements IN GERMAN...</p>

<p>Body paragraph 2 with more achievements IN GERMAN...</p>

<p>Closing paragraph reinforcing fit IN GERMAN...</p>

<p>Mit freundlichen Grüßen</p>
```

**If language is "en" (English):**
```html
<p>Dear Hiring Manager,</p>

<p>Opening paragraph with keywords integrated naturally IN ENGLISH...</p>

<p>Body paragraph 1 with STAR achievements IN ENGLISH...</p>

<p>Body paragraph 2 with more achievements IN ENGLISH...</p>

<p>Closing paragraph reinforcing fit IN ENGLISH...</p>

<p>Best regards,</p>
```

## Important Rules

1. **LANGUAGE:** MUST match {{languageName}} ({{language}})
2. **Length:** Maximum 350-400 words (approximately 1 page)
3. **No HTML wrappers:** Only use `<p>` tags for paragraphs
4. **No bullet points:** Use flowing prose
5. **No signature:** End with the greeting only (name added by template)
6. **Keyword focus:** First paragraph is most important for ATS

## ⚠️ CRITICAL: Closing Format - NO NAME!

**The candidate's name is AUTOMATICALLY added by the template!**

❌ **WRONG** (NEVER output this):
```html
<p>Sincerely,</p>
<p>John Smith</p>
```

❌ **WRONG** (NEVER use placeholders):
```html
<p>Best regards,</p>
<p>[Your Name]</p>
```

✅ **CORRECT** (ONLY the closing phrase):
```html
<p>Best regards,</p>
```

✅ **CORRECT** (German):
```html
<p>Mit freundlichen Grüßen</p>
```

## Output

Return ONLY the HTML content in {{languageName}}, starting with the appropriate salutation and ending with the appropriate closing phrase. **NO NAME AFTER THE CLOSING!**

Generate a compelling, keyword-optimized cover letter that will pass ATS screening while impressing human reviewers.
