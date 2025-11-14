import OpenAI from 'openai';
import { storage } from './storage';

export type ChatModel = 'deepseek-chat' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-3.5-turbo';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamChunk {
  content: string;
  done: boolean;
}

export class ChatService {
  private deepseekClient: OpenAI | null = null;
  private openaiClient: OpenAI | null = null;

  constructor() {
    // Initialize Deepseek client if API key exists
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      this.deepseekClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL: 'https://api.deepseek.com',
      });
    }

    // Initialize OpenAI client if API key exists
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiKey,
      });
    }
  }

  // Get appropriate client based on provider
  private getClient(provider: 'deepseek' | 'openai'): OpenAI {
    if (provider === 'deepseek') {
      if (!this.deepseekClient) {
        throw new Error('Deepseek API key not configured');
      }
      return this.deepseekClient;
    } else {
      if (!this.openaiClient) {
        throw new Error('OpenAI API key not configured');
      }
      return this.openaiClient;
    }
  }

  // Validate model for provider
  validateModel(provider: 'deepseek' | 'openai', model: string): boolean {
    if (provider === 'deepseek') {
      return model === 'deepseek-chat';
    } else {
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'].includes(model);
    }
  }

  // Get credit cost for a model from database
  async getCreditCost(model: string): Promise<number> {
    const pricing = await storage.getPricingByModel(model);
    
    if (pricing) {
      return pricing.creditCost;
    }
    
    // Default fallback costs if not found in database
    const defaultCosts: Record<string, number> = {
      'deepseek-chat': 5,
      'deepseek-reasoner': 10,
      'gpt-4o': 20,
      'gpt-4o-mini': 10,
      'o1': 30,
      'o1-mini': 15,
    };
    
    return defaultCosts[model] || 10;
  }

  // Stream chat completion
  async *streamChat(
    provider: 'deepseek' | 'openai',
    model: string,
    messages: ChatMessage[]
  ): AsyncGenerator<StreamChunk> {
    const client = this.getClient(provider);

    try {
      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          yield {
            content,
            done: false,
          };
        }
      }

      // Send final chunk with full content
      yield {
        content: fullContent,
        done: true,
      };
    } catch (error: any) {
      console.error(`Error streaming chat from ${provider}:`, error);
      throw new Error(`Chat error: ${error.message}`);
    }
  }

  // Non-streaming chat completion (for when streaming is not needed)
  async chat(
    provider: 'deepseek' | 'openai',
    model: string,
    messages: ChatMessage[]
  ): Promise<string> {
    const client = this.getClient(provider);

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error(`Error in chat from ${provider}:`, error);
      throw new Error(`Chat error: ${error.message}`);
    }
  }
}

export const chatService = new ChatService();
