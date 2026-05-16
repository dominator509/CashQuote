import { IAIService, AIGeneratedLineItem } from './ai.service';

export class MockAiAdapter implements IAIService {
  async generateLineItems(notes: string): Promise<AIGeneratedLineItem[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple heuristic to demonstrate mock dynamic behavior, but normally returns a strict deterministic payload
    if (notes.toLowerCase().includes('consulting')) {
      return [
        {
          description: 'Strategy Consulting',
          quantity: 10,
          price: 15000, // $150.00
          category: 'Service',
        }
      ];
    }

    return [
      {
        description: 'Development Work',
        quantity: 5,
        price: 10000, // $100.00
        category: 'Service',
      },
      {
        description: 'Project Management',
        quantity: 2,
        price: 8500, // $85.00
        category: 'Service',
      }
    ];
  }
}
