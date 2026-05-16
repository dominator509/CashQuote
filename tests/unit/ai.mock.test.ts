import { MockAiAdapter } from '../../server/src/services/ai/mock.adapter';
import { aiGeneratedLineItemSchema } from '../../server/src/services/ai/ai.service';
import { z } from 'zod';

const runTests = async () => {
  console.log('Running AI Mock Adapter tests...');

  const adapter = new MockAiAdapter();

  // Test 1: Standard output
  const items1 = await adapter.generateLineItems('need to bill for dev work');
  if (items1.length !== 2) throw new Error('Expected 2 items for standard notes');
  z.array(aiGeneratedLineItemSchema).parse(items1);

  // Test 2: Heuristic output
  const items2 = await adapter.generateLineItems('I did 10 hours of consulting');
  if (items2.length !== 1) throw new Error('Expected 1 item for consulting notes');
  if (items2[0].description !== 'Strategy Consulting') throw new Error('Expected Strategy Consulting');
  z.array(aiGeneratedLineItemSchema).parse(items2);

  console.log('AI Mock Adapter tests passed!');
};

runTests().catch(e => {
  console.error('AI test failed:', e);
  process.exit(1);
});
