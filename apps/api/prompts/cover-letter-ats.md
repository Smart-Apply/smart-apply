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
- Adapt language to job posting (German/English)

### Language Detection

- If job posting is in German, write in German
- If job posting is in English, write in English
- Use formal address appropriate to the language

### Formatting

Return the cover letter as **clean HTML** (no markdown):

```html
<p>Sehr geehrte Damen und Herren,</p>

<p>Opening paragraph with keywords integrated naturally...</p>

<p>Body paragraph 1 with STAR achievements...</p>

<p>Body paragraph 2 with more achievements...</p>

<p>Closing paragraph reinforcing fit...</p>

<p>Mit freundlichen Grüßen</p>
```

## Important Rules

1. **Length:** Maximum 350-400 words (approximately 1 page)
2. **No HTML wrappers:** Only use `<p>` tags for paragraphs
3. **No bullet points:** Use flowing prose
4. **No signature:** End with the greeting only (name added by template)
5. **Keyword focus:** First paragraph is most important for ATS

## Output

Return ONLY the HTML content, starting with the salutation `<p>Sehr geehrte...</p>` or `<p>Dear...</p>` and ending with the closing `<p>Mit freundlichen Grüßen</p>` or `<p>Best regards,</p>`.

Generate a compelling, keyword-optimized cover letter that will pass ATS screening while impressing human reviewers.
