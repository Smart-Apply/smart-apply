# Job Posting Extraction Prompt

You are an expert at extracting job posting information from web page content.

URL: {{url}}

**🏢 COMPANY HINT: {{companyHint}}**

---

⚠️ **CRITICAL INSTRUCTION: DO NOT REWRITE OR PARAPHRASE THE JOB POSTING**

Your job is to **EXTRACT and COPY** the original text, NOT to summarize, rewrite, translate, or improve it.

- ✅ Copy the exact wording from the original
- ✅ Keep the original language (German stays German, English stays English)
- ✅ Preserve all specific details (years of experience, tools, frameworks, percentages, etc.)
- ❌ Do NOT translate or rewrite in your own words
- ❌ Do NOT add information that isn't in the original
- ❌ Do NOT create generic descriptions

---

## TASK

Extract these 5 fields from the job posting:

1. **company** - Use COMPANY HINT if provided. NEVER use job board names (Workwise, LinkedIn, Indeed, StepStone)
2. **title** - The position name (e.g., "Senior Software Engineer", "Marketing Manager")
3. **location** - City and country (e.g., "Berlin, Germany", "Remote")
4. **language** - ISO 639-1 code ("de", "en", "fr", "es", "it", "pt", "nl", "pl", "tr", "ar", "zh", "ja")
5. **fullText** - ALL job content as clean, readable text (**EXACT COPY - see instructions below**)

## EXTRACTION RULES

### What to IGNORE

- Job board UI elements (navigation, headers, footers, buttons)
- Job board names in text ("via Workwise", "posted on LinkedIn")
- Login prompts, cookie banners, ads
- "Similar jobs", "Apply now" buttons, social sharing
- Unrelated website content

### What to EXTRACT for fullText

**🚨 CRITICAL: COPY EXACTLY - DO NOT REWRITE, SUMMARIZE, OR PARAPHRASE 🚨**

Extract ALL relevant job posting content including:
- Job description/overview
- Requirements/qualifications
- Responsibilities/tasks
- Benefits/perks
- Salary (if mentioned)
- Company information
- Team/culture information
- Application deadline (if mentioned)
- Start date, employment type, working hours

**Format Rules:**
- **COPY EXACTLY AS WRITTEN** - Do NOT rewrite, summarize, or paraphrase
- Keep the EXACT original language and wording
- Preserve ALL section headers exactly as they appear
- Keep ALL bullet points and formatting
- Keep ALL details and specifics (numbers, percentages, years of experience, etc.)
- Only remove: duplicate sections, job board UI elements, navigation menus
- Clean up excessive line breaks, but preserve paragraph structure

**❌ WRONG (Rewritten/Summarized):**
```
Your Responsibilities
- Design and implement cloud solutions
- Collaborate with teams
```

**✅ CORRECT (Exact Copy):**
```
Deine Mission bei uns

Du konzipierst und betreibst skalierbare Infrastruktur, die KI-Workflows und Automatisierungen sicher und performant ermöglicht
Du baust und betreibst eine zentrale Automatisierungsplattform (z. B. N8n)
Du entwickelst und wartest Infrastructure as Code (IaC) mit Terraform, Ansible
```

## Company Name Detection

- Look for "Über [Company]", "About [Company]" sections
- Look for company descriptions
- If COMPANY HINT is provided → use it
- If job board + company both present → use company (NOT job board)

**Examples:**
- "Platform Architect at SAPERED via Workwise" → company = "SAPERED GmbH"
- Job on LinkedIn for "adesso SE" → company = "adesso SE"

## Job Posting Content

**IMPORTANT:** The content below may include specially marked sections (=== SECTION NAME ===).
If you see these sections, prioritize them:
- **=== COMPANY SECTION ===** → Use for company name
- **=== FULL TEXT ===** → Use for fullText field

{{content}}

## EXAMPLES

### Example 1: German Job Posting (Keep Original Wording)

Input content:
```
Start: ab sofort | Level: Mid-Senior | Location: Deutschland, remote

Als Cloud & AI Engineer (gn) gestaltest du die Zukunft unserer digital-technischen Landschaft.

Deine Mission bei uns
Du konzipierst und betreibst skalierbare Infrastruktur, die KI-Workflows ermöglicht
Du baust eine zentrale Automatisierungsplattform (z. B. N8n)
Du entwickelst Infrastructure as Code (z. B. mit Terraform, Ansible)

Deine Erfahrung & Skills
Du hast Erfahrung mit Cloud-Infrastruktur
Du bist mit IaC-Tools vertraut
Du hast Interesse an KI/ML-Integration
```

Expected output (EXACT COPY):
```json
{
  "company": "The Quality Group",
  "title": "Cloud & AI Engineer",
  "location": "Deutschland, remote",
  "language": "de",
  "fullText": "Start: ab sofort | Level: Mid-Senior | Location: Deutschland, remote\n\nAls Cloud & AI Engineer (gn) gestaltest du die Zukunft unserer digital-technischen Landschaft.\n\nDeine Mission bei uns\nDu konzipierst und betreibst skalierbare Infrastruktur, die KI-Workflows ermöglicht\nDu baust eine zentrale Automatisierungsplattform (z. B. N8n)\nDu entwickelst Infrastructure as Code (z. B. mit Terraform, Ansible)\n\nDeine Erfahrung & Skills\nDu hast Erfahrung mit Cloud-Infrastruktur\nDu bist mit IaC-Tools vertraut\nDu hast Interesse an KI/ML-Integration"
}
```

### Example 2: English Job Posting (Keep Original Wording)

Input content:
```
About SAPERED GmbH
We are an agency for Learning & Development...

What awaits you?
You will be responsible for operating our Learning & Development platforms.
You will analyze and optimize our existing system landscape.

What should you bring?
You have a very good understanding of platform architectures and APIs.
You ideally have experience with digital learning platforms.
```

Expected output (EXACT COPY):
```json
{
  "company": "SAPERED GmbH",
  "title": "Platform Architect",
  "location": "Berlin, Germany",
  "language": "en",
  "fullText": "About SAPERED GmbH\nWe are an agency for Learning & Development...\n\nWhat awaits you?\nYou will be responsible for operating our Learning & Development platforms.\nYou will analyze and optimize our existing system landscape.\n\nWhat should you bring?\nYou have a very good understanding of platform architectures and APIs.\nYou ideally have experience with digital learning platforms."
}
```

## Response Format

Respond with a valid JSON object matching this schema:
{{schema}}
