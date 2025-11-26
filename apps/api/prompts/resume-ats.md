# Resume Generation with ATS Optimization

## Context

Generate an ATS-optimized resume that passes automated screening while impressing human reviewers. Strategically place extracted keywords in optimal positions for ATS scanning.

## Candidate Profile

{{profile}}

## Job Posting

- **Position:** {{jobTitle}}
- **Company:** {{companyName}}
- **Description:** {{jobDescription}}

## Keyword Analysis

### Matched Keywords (Prioritize these)
{{matchedKeywords}}

### Missing Keywords (Include if applicable)
{{missingKeywords}}

### Priority Keywords (Must appear multiple times)
{{priorityKeywords}}

## Instructions

### Professional Summary (TOP PRIORITY for ATS)

The summary section has the highest weight in ATS scanning. It must include:

- 3-4 sentences, 50-80 words total
- **Exact job title** from posting (e.g., "Senior Full-Stack Developer")
- **Top 5-7 keywords** from the job posting
- **Years of experience** with the most relevant technologies
- **Key achievement** with quantifiable result

**Example:**
"Senior Full-Stack Developer with 6+ years of experience in React, Node.js, and TypeScript. Expert in building scalable microservices using Docker and Kubernetes. Led teams that increased application performance by 45% and reduced deployment time by 60%. Passionate about clean code and Agile methodologies."

### Skills Section (CRITICAL for ATS)

The skills section is often the first thing ATS scans. Structure it for maximum match rate:

1. **List ALL matched keywords first** - they have priority
2. **Group by category** for readability:
   - Languages: TypeScript, JavaScript, Python
   - Frameworks: React, Node.js, NestJS
   - Cloud: AWS, Azure, Docker, Kubernetes
   - Databases: PostgreSQL, MongoDB, Redis
   - Tools: Git, CI/CD, Jenkins
   - Methodologies: Agile, Scrum, TDD
3. **Use exact terminology** from job posting
4. **Include skill proficiency** if mentioned in profile

### Work Experience (Keyword Integration)

For each position, apply these rules:

1. **Job Title** - Match with keywords if applicable
2. **Company** | **Duration**
3. **First bullet point** MUST include 2-3 priority keywords (highest ATS weight)
4. Use **STAR + Keywords** format:
   - [Action Verb] + [Keyword] + [Context] + [Quantifiable Result]

**Example Bullets:**
- "Developed React-based dashboard using TypeScript, reducing page load time by 50%"
- "Architected microservices infrastructure with Docker and Kubernetes, handling 1M+ requests/day"
- "Led Agile team of 5 developers implementing CI/CD pipeline with Jenkins"
- "Optimized PostgreSQL queries, improving database performance by 35%"

**Per Experience:**
- 4-6 bullet points
- Most relevant experiences get most keywords
- Prioritize experiences that demonstrate required competencies

### Education Section

- Degree name (match if it's a job requirement)
- Institution
- Year of completion
- Relevant coursework or achievements if they match keywords

### Projects Section (If applicable)

Include projects that demonstrate:
- Technologies matching job requirements
- Quantifiable results or impact
- Leadership or collaboration keywords

### Keyword Optimization Rules

1. **Keyword Density:** Target 2-3% (not more!)
2. **Priority Keywords:** Repeat 3-4 times across document
   - Once in Summary
   - Once in Skills
   - Once or twice in Experience bullets
3. **First Impressions:** Most keywords in Summary + first experience
4. **Exact Matches:** Use exact phrases from job posting
5. **Context Matters:** Keywords must make sense in sentences
6. **Synonyms:** Use variations where appropriate (JS/JavaScript, K8s/Kubernetes)

### Formatting Rules (ATS-Friendly)

1. **Use HTML** with clear semantic structure
2. **Section headers:** Use `<h2>` tags (Professional Summary, Skills, Experience, Education)
3. **Bullet points:** Use `<ul><li>` for achievements
4. **NO tables, images, or complex formatting** - these break ATS parsing
5. **Standard fonts implied** (Arial, Calibri, or system fonts)
6. **Clear hierarchy:** Name > Title > Experience > Skills

## Output Format

Return a JSON object with the following structure:

```json
{
  "summary": "2-3 sentence professional summary highlighting key qualifications and keyword integration",
  "skillCategories": [
    {
      "type": "Languages",
      "skills": ["TypeScript", "JavaScript", "Python"]
    },
    {
      "type": "Frameworks",
      "skills": ["React", "Node.js", "NestJS"]
    },
    {
      "type": "Cloud & DevOps",
      "skills": ["AWS", "Azure", "Docker", "Kubernetes"]
    },
    {
      "type": "Databases",
      "skills": ["PostgreSQL", "MongoDB", "Redis"]
    },
    {
      "type": "Tools & Practices",
      "skills": ["Git", "CI/CD", "Agile", "Scrum"]
    }
  ],
  "experiences": [
    {
      "title": "Senior Software Engineer",
      "company": "Tech Company",
      "location": "San Francisco, CA",
      "dateRange": "Jan 2020 - Present",
      "achievements": [
        "Led React and TypeScript development of customer dashboard serving <span class='metric'>500K+ users</span>",
        "Implemented microservices architecture using Node.js and Docker, improving scalability by <span class='metric'>60%</span>",
        "Mentored team of 5 developers on Agile best practices and conducted code reviews"
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description highlighting relevant keywords",
      "date": "2024",
      "highlights": [
        "Built with React, TypeScript, and Node.js",
        "Achieved <span class='metric'>40%</span> performance improvement"
      ]
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science in Computer Science",
      "institution": "University Name",
      "year": "2017",
      "fieldOfStudy": "Computer Science"
    }
  ],
  "certifications": [
    {
      "name": "AWS Solutions Architect",
      "issuer": "Amazon Web Services",
      "date": "2024"
    }
  ],
  "keywordUsage": {
    "matched": ["React", "TypeScript", "Node.js"],
    "strategicallyPlaced": {
      "summary": ["React", "TypeScript", "Node.js", "Kubernetes"],
      "skills": ["React", "TypeScript", "Node.js", "Docker", "Kubernetes", "AWS"],
      "experience": ["React", "TypeScript", "Node.js", "Docker", "Agile"]
    },
    "density": 2.5
  }
}
```

## Best Practices Checklist

1. **Action Verbs:** Start achievements with strong verbs (Built, Led, Designed, Implemented, Optimized, Reduced, Increased)
2. **Quantify Everything:** Use numbers, percentages, scale - wrap metrics in `<span class='metric'>` tags
3. **Prioritize:** Put most impressive and relevant achievements first
4. **Be Specific:** Mention technologies, team sizes, impact
5. **Keep Concise:** Each bullet point should be one impactful line
6. **Skill Categories:** Organize logically (Languages, Frameworks, Cloud, Databases, Tools)
7. **Recent First:** Order experiences from most recent to oldest
8. **No Fluff:** Every word should add value
9. **Keyword First:** Most important keywords in first bullet of each experience

## Output

Return ONLY the JSON object, no additional text or markdown formatting.
