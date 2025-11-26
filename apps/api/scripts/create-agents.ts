#!/usr/bin/env node
/**
 * Script to create Azure AI Foundry Agents
 * Run this once to create CV Writer and CL Writer agents
 * Then update .env with the generated agent IDs
 */

import { AgentsClient } from '@azure/ai-agents';
import { DefaultAzureCredential } from '@azure/identity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const projectEndpoint = process.env.PROJECT_ENDPOINT;
const modelDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1';

async function createAgents() {
  if (!projectEndpoint) {
    console.error('❌ PROJECT_ENDPOINT not set in .env file');
    console.error(
      '   Add: PROJECT_ENDPOINT=https://your-resource.services.ai.azure.com/api/projects/your-project',
    );
    process.exit(1);
  }

  console.log('🚀 Creating Azure AI Foundry Agents...\n');
  console.log(`📍 Project Endpoint: ${projectEndpoint}`);
  console.log(`🤖 Model Deployment: ${modelDeploymentName}\n`);

  try {
    // Create Azure AI Client
    const client = new AgentsClient(projectEndpoint, new DefaultAzureCredential());
    console.log('✅ Connected to Azure AI Foundry\n');

    // Create CV Writer Agent
    console.log('📝 Creating CV Writer Agent...');
    const cvWriterAgent = await client.createAgent(modelDeploymentName, {
      name: 'cv-writer',
      instructions: `You are an expert resume writer creating ATS-optimized, professional resumes.

Your task is to transform candidate profile data and job posting requirements into a compelling resume.

Guidelines:
- Highlight relevant skills and experiences that match the job requirements
- Use action verbs and quantify achievements where possible
- Structure content in ATS-friendly format (clear sections, no tables)
- Keep bullet points concise and impactful (1-2 lines each)
- Prioritize most relevant experience for the target role
- Limit to 2 pages maximum
- Use professional, confident language

Output Format:
Return the resume as a JSON structure with the following schema:
{
  "candidateName": "string",
  "email": "string",
  "phone": "string?",
  "linkedin": "string?",
  "github": "string?",
  "location": "string?",
  "summary": "string",
  "skills": [{"type": "string", "skills": ["string"]}],
  "experience": [{"title": "string", "company": "string", "location": "string?", "dateRange": "string", "achievements": ["string"]}],
  "education": [{"degree": "string", "institution": "string", "location": "string?", "dateRange": "string", "details": "string?"}],
  "projects": [{"name": "string", "description": "string?", "technologies": ["string"], "url": "string?"}]?,
  "certifications": [{"name": "string", "issuer": "string", "date": "string", "url": "string?"}]?
}`,
      description: 'Specialized agent for generating tailored resumes from candidate profiles',
    });
    console.log(`✅ CV Writer Agent created: ${cvWriterAgent.id}\n`);

    // Create CL Writer Agent
    console.log('✉️  Creating CL Writer Agent...');
    const clWriterAgent = await client.createAgent(modelDeploymentName, {
      name: 'cl-writer',
      instructions: `You are a professional career coach helping candidates write compelling cover letters.

Your task is to create personalized cover letters that match candidate strengths to job requirements.

Guidelines:
- Professional, confident, and engaging tone
- Keep to 1 page (300-400 words)
- Structure: Opening (hook + intent) → Body (3-4 key qualifications) → Closing (call to action)
- Connect candidate's experience directly to job requirements
- Show genuine interest in the role and company
- Avoid generic phrases and clichés
- Use specific examples and achievements
- End with clear call to action

Output Format:
Return the cover letter as HTML with semantic structure:
- Use <h1> for candidate name
- Use <p> for paragraphs
- Use <strong> for emphasis (sparingly)
- No tables, keep formatting simple for easy editing`,
      description: 'Specialized agent for generating personalized cover letters',
    });
    console.log(`✅ CL Writer Agent created: ${clWriterAgent.id}\n`);

    // Display results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ AGENTS CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 Add these to your .env file:\n');
    console.log(`CV_WRITER_AGENT_ID=${cvWriterAgent.id}`);
    console.log(`CL_WRITER_AGENT_ID=${clWriterAgent.id}`);
    console.log('\n═══════════════════════════════════════════════════════════\n');

    console.log('🎯 Next steps:');
    console.log('1. Copy the agent IDs above to your .env file');
    console.log('2. Set LLM_PROVIDER=azure-ai-foundry in .env');
    console.log('3. Restart your backend: npm run start:dev');
    console.log('4. Test with: npm run test:e2e -- applications.e2e-spec.ts\n');
  } catch (error) {
    console.error('❌ Failed to create agents:', error);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if ('code' in error) {
        console.error(`   Code: ${error.code}`);
      }
    }
    process.exit(1);
  }
}

createAgents();
