import React, { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';

export const InvoiceViewer: React.FC<{ invoiceId: string, businessId: string }> = ({ invoiceId, businessId }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoice, setInvoice] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const data = await fetchApi(`/invoices/${invoiceId}`, {
          headers: { 'x-business-id': businessId }
        });
        setInvoice(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message);
      }
    };
    loadInvoice();
  }, [invoiceId, businessId]);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!invoice) return <div>Loading Invoice...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8 no-print">
        <h1 className="text-2xl font-bold">Invoice #{invoice.id.split('-')[0]}</h1>
        <button
          onClick={() => window.print()}
          className="bg-gray-800 text-white px-4 py-2 rounded"
        >
          Print / PDF
        </button>
      </div>

      <div className="bg-white p-8 rounded shadow print-container">
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold">Billed To:</h2>
            <p>{invoice.client.name}</p>
            {invoice.client.email && <p>{invoice.client.email}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-500">Status: {invoice.status.toUpperCase()}</h2>
            <p>Created: {new Date(invoice.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {invoice.lineItems.map((item: any) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">${(item.price / 100).toFixed(2)}</td>
                <td className="text-right py-2">${((item.quantity * item.price) / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between mb-2">
              <span>Subtotal:</span>
              <span>${(invoice.subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Tax:</span>
              <span>${(invoice.tax / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2 font-bold text-xl border-t pt-2">
              <span>Total:</span>
              <span>${(invoice.total / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
