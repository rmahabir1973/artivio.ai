/**
 * Loops.so Email Marketing Integration
 * 
 * Handles contact management and mailing list subscriptions for automated email funnels.
 */

import { logger } from './logger';

const LOOPS_API_URL = 'https://app.loops.so/api/v1';
const LOOPS_API_KEY = process.env.LOOPS_API_KEY;

interface LoopsContact {
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  mailingLists?: Record<string, boolean>;
  [key: string]: any; // Allow custom properties
}

interface LoopsResponse {
  success: boolean;
  id?: string;
  message?: string;
}

interface MailingList {
  id: string;
  name: string;
  isPublic: boolean;
}

export class LoopsService {
  private static headers = {
    'Authorization': `Bearer ${LOOPS_API_KEY}`,
    'Content-Type': 'application/json',
  };

  /**
   * Create or update a contact in Loops.so
   */
  static async createContact(contact: LoopsContact): Promise<LoopsResponse> {
    if (!LOOPS_API_KEY) {
      logger.warn('LOOPS', 'API key not configured - skipping contact creation');
      return { success: false, message: 'API key not configured' };
    }

    try {
      const response = await fetch(`${LOOPS_API_URL}/contacts/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(contact),
      });

      const data = await response.json();

      if (data.success) {
        logger.info('LOOPS', 'Contact created successfully', {
          listCount: Object.keys(contact.mailingLists || {}).length,
        });
      } else {
        logger.error('LOOPS', 'Failed to create contact', {
          error: data.message,
        });
      }

      return data;
    } catch (error: any) {
      logger.error('LOOPS', 'Error calling Loops API', {
        error: error.message,
        endpoint: 'contacts/create',
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Update an existing contact in Loops.so
   */
  static async updateContact(email: string, updates: Partial<LoopsContact>): Promise<LoopsResponse> {
    if (!LOOPS_API_KEY) {
      logger.warn('LOOPS', 'API key not configured - skipping contact update');
      return { success: false, message: 'API key not configured' };
    }

    try {
      const response = await fetch(`${LOOPS_API_URL}/contacts/update`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({ email, ...updates }),
      });

      const data = await response.json();

      if (data.success) {
        logger.info('LOOPS', 'Contact updated successfully');
      } else {
        logger.error('LOOPS', 'Failed to update contact', {
          error: data.message,
        });
      }

      return data;
    } catch (error: any) {
      logger.error('LOOPS', 'Error calling Loops API', {
        error: error.message,
        endpoint: 'contacts/update',
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all mailing lists from Loops.so
   */
  static async getMailingLists(): Promise<MailingList[]> {
    if (!LOOPS_API_KEY) {
      logger.warn('LOOPS', 'API key not configured - cannot fetch lists');
      return [];
    }

    try {
      const response = await fetch(`${LOOPS_API_URL}/lists`, {
        method: 'GET',
        headers: this.headers,
      });

      const data = await response.json();

      if (Array.isArray(data)) {
        logger.info('LOOPS', 'Fetched mailing lists', { count: data.length });
        return data;
      }

      logger.error('LOOPS', 'Unexpected response format for lists', { data });
      return [];
    } catch (error: any) {
      logger.error('LOOPS', 'Error fetching mailing lists', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Find a mailing list by name (case-insensitive)
   */
  static async findListByName(name: string): Promise<MailingList | null> {
    const lists = await this.getMailingLists();
    const normalizedName = name.toLowerCase();
    
    const found = lists.find(list => 
      list.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(list.name.toLowerCase())
    );

    if (found) {
      logger.info('LOOPS', 'Found mailing list', { name, listId: found.id });
    } else {
      logger.warn('LOOPS', 'Mailing list not found', { name });
    }

    return found || null;
  }

  /**
   * Add a contact to the 7-day email funnel
   */
  static async addToSevenDayFunnel(
    email: string,
    firstName?: string,
    lastName?: string,
    userId?: string
  ): Promise<LoopsResponse> {
    // Find the 7-day funnel list
    const funnel = await this.findListByName('7day');

    if (!funnel) {
      logger.error('LOOPS', '7-day funnel not found', { 
        suggestion: 'Please ensure a mailing list with "7day" in the name exists in Loops.so' 
      });
      return { 
        success: false, 
        message: '7-day funnel list not found in Loops.so' 
      };
    }

    // Create contact with funnel subscription
    return await this.createContact({
      email,
      firstName,
      lastName,
      userId,
      mailingLists: {
        [funnel.id]: true, // Subscribe to the 7-day funnel
      },
    });
  }
}
