# Azure AI Foundry Agents Integration Guide

This guide explains how to integrate and use Azure AI Foundry agents for resume and cover letter generation in Smart Apply.

## Overview

Azure AI Foundry agents provide specialized AI capabilities for document generation through dedicated **CV Writer** and **CL Writer** agents. The integration includes:

- **Intelligent Routing**: Automatically routes resume requests to CV Writer and cover letter requests to CL Writer
- **Automatic Fallback**: Falls back to Azure OpenAI if agent endpoints are unavailable
- **Production Ready**: Comprehensive error handling, logging, and timeout management
- **Flexible Response Handling**: Supports multiple response formats from agents

## Architecture

```text
Application Request
       ↓
┌──────────────────┐
│ LLM Service      │
└──────────────────┘
       ↓
┌──────────────────────────────┐
│ Azure AI Foundry Provider    │
│  - Prompt Type Detection     │
│  - Agent Selection           │
│  - Fallback Logic            │
└──────────────────────────────┘
       ↓
   ┌───┴────────┐
   │            │
   ↓            ↓
┌─────────┐  ┌─────────┐
│CV Writer│  │CL Writer│
│ Agent   │  │ Agent   │
└─────────┘  └─────────┘
   │            │
   └─────┬──────┘
         ↓
   Document Content
         ↓
  [Fallback: Azure OpenAI]
```

## Prerequisites

1. **Azure Subscription**: Active Azure subscription with AI Foundry access
2. **Deployed Agents**: CV Writer and CL Writer agents deployed in Azure AI Foundry
3. **API Credentials**: API keys for both AI Foundry and Azure OpenAI (for fallback)
4. **Network Access**: Outbound HTTPS access to Azure endpoints

## Configuration

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Primary LLM Provider
LLM_PROVIDER=azure-ai-foundry

# Azure AI Foundry Agent Endpoints
AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT=https://your-cv-writer-agent.inference.ml.azure.com/score
AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT=https://your-cl-writer-agent.inference.ml.azure.com/score
AZURE_AI_FOUNDRY_API_KEY=your_ai_foundry_api_key

# Azure OpenAI Fallback (Highly Recommended)
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 2. Obtaining Agent Endpoints

#### CV Writer Agent

1. Navigate to Azure AI Foundry portal
2. Select your CV Writer agent deployment
3. Copy the **Scoring Endpoint** URL
4. Set as `AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT`

#### CL Writer Agent

1. Navigate to Azure AI Foundry portal
2. Select your CL Writer agent deployment
3. Copy the **Scoring Endpoint** URL
4. Set as `AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT`

#### API Key

1. In Azure AI Foundry portal, go to agent deployment
2. Navigate to **Keys and endpoints**
3. Copy the **Primary Key** or **Secondary Key**
4. Set as `AZURE_AI_FOUNDRY_API_KEY`

### 3. Fallback Configuration

**Important**: Always configure Azure OpenAI fallback for production reliability:

```bash
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

The fallback is triggered when:

- Agent endpoint is unavailable
- Agent returns an error
- Agent response timeout (60 seconds)
- Agent returns empty/invalid response

## How It Works

### Prompt Detection

The provider automatically detects the document type based on prompt keywords:

**Resume Keywords:**

- `resume`, `cv`, `curriculum vitae`
- `work experience`, `professional experience`
- `education`, `skills`, `qualifications`

**Cover Letter Keywords:**

- `cover letter`, `motivation letter`, `application letter`
- `dear hiring manager`, `i am writing to express`

### Request Flow

1. **Prompt Analysis**: Provider analyzes prompt to determine document type
2. **Agent Selection**: Routes to CV Writer (resume) or CL Writer (cover letter)
3. **API Call**: Sends request to selected agent endpoint with:
   - Prompt content
   - Temperature (0.6 for resume, 0.7 for cover letter)
   - Max tokens (2500 for resume, 1500 for cover letter)
   - System message (optional)
   - 60-second timeout
4. **Response Processing**: Extracts content from agent response (multiple formats supported)
5. **Fallback**: If agent fails, automatically retries with Azure OpenAI
6. **Return**: Generated content returned to application service

### Response Format Support

The provider supports multiple response formats from agents:

```typescript
// Direct string
"Generated content here"

// Content property
{ content: "Generated content" }

// Nested message
{ message: { content: "Generated content" } }

// OpenAI format
{ choices: [{ message: { content: "Generated content" } }] }

// Text property
{ text: "Generated content" }

// Result property
{ result: "Generated content" }
```

## Testing

### Unit Tests

Run comprehensive unit tests (46 test cases):

```bash
cd apps/api
npm test test/unit/providers/azure-ai-foundry.provider.spec.ts
```

Test coverage includes:

- Constructor validation
- Resume generation with CV Writer
- Cover letter generation with CL Writer
- Prompt keyword detection
- Multiple response format handling
- Fallback mechanism
- Error handling
- Default parameter values

### Integration Testing

Test with mock provider first:

```bash
# Use mock provider
LLM_PROVIDER=mock
npm run start:dev
```

Then test with Azure AI Foundry:

```bash
# Use Azure AI Foundry
LLM_PROVIDER=azure-ai-foundry
npm run start:dev
```

### Manual Testing

1. **Create Application**: Create a new application in the UI
2. **Generate Documents**: Trigger resume and cover letter generation
3. **Check Logs**: Monitor logs for agent calls and fallback behavior
4. **Verify Output**: Review generated documents for quality

## Monitoring & Observability

### Logs

The provider emits detailed logs for monitoring:

```text
[AzureAIFoundryProvider] Calling CV Writer Agent for resume generation
[AzureAIFoundryProvider] Successfully generated resume with CV Writer Agent
```

```text
[AzureAIFoundryProvider] Azure AI Foundry agent failed: timeout. Falling back to Azure OpenAI
[AzureAIFoundryProvider] Successfully generated text with Azure OpenAI fallback
```

### Log Levels

- **INFO**: Successful agent calls, fallback usage, provider initialization
- **WARN**: Missing configuration, fallback warnings
- **ERROR**: Agent failures, fallback failures, invalid responses

### Metrics to Monitor

1. **Agent Success Rate**: Percentage of successful agent calls
2. **Fallback Rate**: Percentage of requests using Azure OpenAI fallback
3. **Response Time**: Average time for document generation
4. **Error Rate**: Failed generations (both agent and fallback)
5. **Timeout Rate**: Requests exceeding 60-second timeout

## Troubleshooting

### Issue: "Azure AI Foundry configuration missing"

**Cause**: Missing or invalid agent endpoint/API key configuration

**Solution**:

1. Verify all environment variables are set:

   ```bash
   echo $AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT
   echo $AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT
   echo $AZURE_AI_FOUNDRY_API_KEY
   ```

2. Ensure endpoints use HTTPS and include `/score` path
3. Verify API key is valid and not expired
4. Restart the application after updating configuration

### Issue: "No content in Agent response"

**Cause**: Agent returned unexpected response format

**Solution**:

1. Check agent deployment in Azure AI Foundry portal
2. Test agent endpoint directly with curl:

   ```bash
   curl -X POST "$AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT" \
     -H "api-key: $AZURE_AI_FOUNDRY_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Generate resume", "temperature": 0.6}'
   ```

3. Verify response format matches one of the supported formats
4. Check provider logs for detailed error messages

### Issue: "Agent timeout"

**Cause**: Agent processing exceeds 60-second timeout

**Solution**:

1. Check agent performance in Azure AI Foundry portal
2. Verify agent has sufficient compute resources
3. Consider scaling agent deployment
4. Fallback will automatically handle timeouts
5. Monitor fallback rate to assess agent reliability

### Issue: "Fallback unavailable"

**Cause**: Azure OpenAI fallback not configured or credentials invalid

**Solution**:

1. Configure Azure OpenAI fallback:

   ```bash
   AZURE_OPENAI_ENDPOINT=https://...
   AZURE_OPENAI_API_KEY=your_key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
   ```

2. Test Azure OpenAI connectivity:

   ```bash
   curl -X POST "$AZURE_OPENAI_ENDPOINT/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview" \
     -H "api-key: $AZURE_OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"messages": [{"role": "user", "content": "test"}]}'
   ```

3. Verify deployment name matches Azure OpenAI deployment

### Issue: "Wrong agent called"

**Cause**: Prompt keywords not detected correctly

**Solution**:

1. Review prompt content for resume/cover letter keywords
2. Ensure prompts clearly indicate document type
3. Check provider logs to see which agent was selected
4. Add more specific keywords to prompts if needed

## Best Practices

### 1. Configuration

- ✅ Always configure Azure OpenAI fallback
- ✅ Use secure environment variables, never hardcode credentials
- ✅ Rotate API keys regularly (every 90 days)
- ✅ Use separate API keys for dev/staging/prod environments
- ✅ Monitor key expiration dates

### 2. Error Handling

- ✅ Implement retry logic at application level if needed
- ✅ Monitor fallback rate to detect agent issues
- ✅ Set up alerts for high error/fallback rates
- ✅ Log all agent failures for debugging
- ✅ Gracefully degrade to mock provider in testing

### 3. Performance

- ✅ Monitor agent response times
- ✅ Scale agent deployments based on load
- ✅ Use Azure Front Door for geographic distribution
- ✅ Cache frequently generated content when appropriate
- ✅ Implement request batching for bulk operations

### 4. Security

- ✅ Store credentials in Azure Key Vault (production)
- ✅ Use Managed Identity when possible
- ✅ Implement IP whitelisting for agent endpoints
- ✅ Enable Azure Monitor logging for audit trail
- ✅ Use HTTPS for all agent communications

### 5. Cost Optimization

- ✅ Monitor agent usage and costs in Azure portal
- ✅ Set budget alerts for AI Foundry services
- ✅ Use appropriate agent tier based on load
- ✅ Implement caching to reduce duplicate requests
- ✅ Consider reserved capacity for predictable workloads

## Migration Guide

### From Azure OpenAI to Azure AI Foundry

1. **Deploy Agents**: Set up CV Writer and CL Writer agents in Azure AI Foundry
2. **Test Agents**: Verify agents work correctly with sample prompts
3. **Update Configuration**: Add Azure AI Foundry environment variables
4. **Staged Rollout**:
   - Dev environment: Switch to `azure-ai-foundry` provider
   - Test thoroughly with existing prompts
   - Staging environment: Switch and monitor
   - Production: Switch with fallback enabled
5. **Monitor**: Track success/fallback rates for 1-2 weeks
6. **Optimize**: Adjust agent configuration based on metrics

### Rollback Plan

If issues occur, quickly rollback:

```bash
# Fallback to Azure OpenAI
LLM_PROVIDER=azure-openai

# Or mock for testing
LLM_PROVIDER=mock
```

Restart application to apply change immediately.

## Additional Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-foundry/)
- [Azure OpenAI Service](https://learn.microsoft.com/azure/ai-services/openai/)
- [Smart Apply Architecture](../../ARCHITECTURE.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Security Documentation](../security/)

## Support

For issues or questions:

1. Check application logs for detailed error messages
2. Review this troubleshooting guide
3. Test with mock provider to isolate issues
4. Verify Azure service health: [Azure Status](https://status.azure.com/)
5. Open issue on GitHub with logs and configuration (redact credentials)
