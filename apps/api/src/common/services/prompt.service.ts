import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { Logger } from '@nestjs/common';

export interface PromptVariables {
  [key: string]: string | number | object;
}

/**
 * Service for loading and rendering prompt templates
 */
export class PromptService {
  private static readonly logger = new Logger(PromptService.name);
  private static readonly promptsDir = resolve(process.cwd(), 'prompts');

  /**
   * Load and render a prompt template with variables
   * @param templateName Name of the prompt template file (without .md extension)
   * @param variables Variables to inject into the template
   * @returns Rendered prompt text
   */
  static async renderPrompt(
    templateName: string,
    variables: PromptVariables = {},
  ): Promise<string> {
    try {
      const templatePath = resolve(this.promptsDir, `${templateName}.md`);
      const template = await readFile(templatePath, 'utf-8');

      // Replace variables in template using mustache-style syntax
      let rendered = template;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        const replacement =
          typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
      }

      this.logger.debug(`Rendered prompt template: ${templateName}`);
      return rendered;
    } catch (error) {
      this.logger.error(`Failed to load prompt template ${templateName}: ${error.message}`);
      throw new Error(`Prompt template loading failed: ${error.message}`);
    }
  }

  /**
   * Check if a prompt template exists
   * @param templateName Name of the prompt template file
   * @returns True if template exists
   */
  static async templateExists(templateName: string): Promise<boolean> {
    try {
      const templatePath = resolve(this.promptsDir, `${templateName}.md`);
      await readFile(templatePath);
      return true;
    } catch {
      return false;
    }
  }
}
