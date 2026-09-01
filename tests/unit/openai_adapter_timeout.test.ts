import OpenAI from 'openai';
import { OpenAiAdapter } from '../../server/src/services/ai/openai.adapter';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('OpenAI adapter request bounds', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-key',
    };
    (OpenAI as unknown as jest.Mock).mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      {
                        description: 'Development Work',
                        quantity: 1,
                        price: 100,
                        category: 'Service',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        },
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('uses a bounded single-attempt provider request so fallback can run promptly', async () => {
    await new OpenAiAdapter().generateLineItems('one hour of development');

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      timeout: 30_000,
      maxRetries: 0,
    });
  });
});
