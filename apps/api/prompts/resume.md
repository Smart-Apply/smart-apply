# Resume Generation Prompt

You are an expert resume writer creating an ATS-optimized, professional resume.

## Candidate Information:
- Name: {{candidateName}}
- Contact: {{contactInfo}}

## Professional Summary:
{{summary}}

## Technical Skills:
{{skills}}

## Work Experience:
{{experiences}}

## Education:
{{education}}

## Certifications:
{{certificates}}

## Projects:
{{projects}}

## Instructions:
1. Create a professional, ATS-friendly resume (max 2 pages)
2. Analyze the provided information and structure it as JSON (not markdown or HTML)

## Output Format:
Return a JSON object with the following structure:

```json
{
  "summary": "2-3 sentence professional summary highlighting key qualifications and value proposition",
  "skillCategories": [
    {
      "type": "Languages",
      "skills": ["TypeScript", "Python", "Java"]
    },
    {
      "type": "Frameworks",
      "skills": ["NestJS", "React", "Spring Boot"]
    },
    {
      "type": "Cloud",
      "skills": ["Azure", "AWS", "Docker"]
    },
    {
      "type": "Databases",
      "skills": ["PostgreSQL", "MongoDB", "Redis"]
    },
    {
      "type": "Tools",
      "skills": ["Git", "CI/CD", "Kubernetes"]
    }
  ],
  "experiences": [
    {
      "title": "Senior Software Engineer",
      "company": "Tech Company",
      "location": "San Francisco, CA",
      "dateRange": "Jan 2020 - Present",
      "achievements": [
        "Led development of microservices architecture serving <span class='metric'>1M+ daily users</span>",
        "Improved API performance by <span class='metric'>40%</span> through optimization strategies",
        "Mentored team of 5 junior developers and conducted technical interviews"
      ]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief one-line description of the project",
      "date": "2025",
      "highlights": [
        "Built feature X using technology Y",
        "Achieved Z% improvement in performance"
      ]
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science in Computer Science",
      "institution": "University Name",
      "year": "2017"
    }
  ],
  "certifications": [
    {
      "name": "Azure Solutions Architect Expert",
      "issuer": "Microsoft",
      "date": "2024"
    }
  ]
}
```

## Best Practices:
1. **Action Verbs**: Start achievements with strong verbs (Built, Led, Designed, Implemented, Optimized, Reduced, Increased, etc.)
2. **Quantify Everything**: Use numbers, percentages, scale - wrap metrics in `<span class='metric'>` tags
3. **Prioritize**: Put most impressive and relevant achievements first
4. **Be Specific**: Mention technologies, team sizes, impact
5. **Keep Concise**: Each bullet point should be one impactful line
6. **Skill Categories**: Organize skills logically (use types: Languages, Frameworks, Cloud, Databases, Tools, Other)
7. **Recent First**: Order experiences from most recent to oldest
8. **No Fluff**: Every word should add value

Return ONLY the JSON object, no additional text or markdown formatting.
