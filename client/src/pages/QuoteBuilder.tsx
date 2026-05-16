import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createQuoteSchema, CreateQuoteInput, LineItemInput } from 'shared';
import { fetchApi } from '../services/api';

export const QuoteBuilder: React.FC<{ businessId: string, clientId: string }> = ({ businessId, clientId }) => {
  const [aiNotes, setAiNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, control, handleSubmit } = useForm<CreateQuoteInput | any>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      clientId,
      lineItems: [],
    }
  });

  const { fields, append } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const handleAiGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/ai/generate', {
        method: 'POST',
        headers: { 'x-business-id': businessId },
        body: JSON.stringify({ notes: aiNotes })
      });
      res.items.forEach((item: LineItemInput) => append(item));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      alert('AI Generation failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CreateQuoteInput) => {
    try {
      await fetchApi('/quotes', {
        method: 'POST',
        headers: { 'x-business-id': businessId },
        body: JSON.stringify(data)
      });
      alert('Quote created successfully!');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Quote Builder</h1>

      <div className="mb-6 bg-blue-50 p-4 rounded">
        <h2 className="font-bold">AI Copilot</h2>
        <textarea
          className="w-full mt-2 p-2 border rounded"
          rows={3}
          placeholder="e.g. 5 hours dev work at 100/hr..."
          value={aiNotes}
          onChange={(e) => setAiNotes(e.target.value)}
        />
        <button
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleAiGenerate}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Line Items'}
        </button>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)}>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-4 mb-2">
            <input
              {...register(`lineItems.${index}.description` as const)}
              placeholder="Description"
              className="border p-2"
            />
            <input
              {...register(`lineItems.${index}.quantity` as const, { valueAsNumber: true })}
              type="number"
              placeholder="Qty"
              className="border p-2 w-20"
            />
            <input
              {...register(`lineItems.${index}.price` as const, { valueAsNumber: true })}
              type="number"
              placeholder="Price (cents)"
              className="border p-2"
            />
          </div>
        ))}

        <button type="submit" className="mt-4 bg-green-600 text-white px-4 py-2 rounded">
          Save Quote
        </button>
      </form>
    </div>
  );
};
