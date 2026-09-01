import { FormEvent, useEffect, useMemo, useState } from 'react';

interface Business {
  id: string;
  name: string;
  role?: string;
}

interface Client {
  id: string;
  name: string;
  email?: string | null;
}

interface LineItem {
  description: string;
  quantity: number;
  price: number;
  category?: string | null;
}

interface Quote {
  id: string;
  clientId: string;
  status: string;
  total: number;
  lineItems: LineItem[];
  client?: Client;
}

interface Invoice {
  id: string;
  clientId: string;
  status: string;
  total: number;
  dueDate?: string | null;
  lineItems: LineItem[];
  payments?: Payment[];
  client?: Client;
}

interface RadarInvoice extends Invoice {
  outstanding: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
}

interface Reminder {
  id: string;
  entityType: 'quote' | 'invoice';
  entityId: string;
  status: string;
  scheduledAt: string;
}

interface Radar {
  unconvertedQuotes: Quote[];
  overdueInvoices: RadarInvoice[];
  totalAtRisk: number;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  business: Business;
}

interface AiGenerateResponse {
  items: LineItem[];
  provider: string;
  degraded: boolean;
}

const dollars = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const REMINDER_CLOCK_SKEW_MS = 60_000;
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Request failed';

export function App() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [radar, setRadar] = useState<Radar | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [message, setMessage] = useState('Sign in with demo login to begin.');
  const [pilotEmail, setPilotEmail] = useState('');
  const [pilotAccessCode, setPilotAccessCode] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quoteQuantity, setQuoteQuantity] = useState('1');
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteTaxRatePercent, setQuoteTaxRatePercent] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0],
    [invoices, selectedInvoiceId]
  );

  const clearWorkspace = () => {
    setBusiness(null);
    setClients([]);
    setQuotes([]);
    setInvoices([]);
    setReminders([]);
    setRadar(null);
    setSelectedInvoiceId('');
  };

  const request = async <T,>(
    path: string,
    init: RequestInit = {},
    businessContext: Business | null = business
  ): Promise<T> => {
    const authPaths = ['/api/auth/demo-login', '/api/auth/pilot-login', '/api/auth/me', '/api/auth/logout'];
    if (!businessContext && !authPaths.includes(path)) {
      throw new Error('Login required');
    }

    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(businessContext ? { 'x-business-id': businessContext.id } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Request failed' }));
      if ((response.status === 401 || response.status === 403) && !authPaths.includes(path)) {
        clearWorkspace();
        setMessage('Session expired. Sign in again.');
      }
      throw new Error(body.error ?? 'Request failed');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };

  const refresh = async (businessContext: Business | null = business) => {
    const [nextClients, nextQuotes, nextInvoices, nextReminders, nextRadar] = await Promise.all([
      request<Client[]>('/api/clients', {}, businessContext),
      request<Quote[]>('/api/quotes', {}, businessContext),
      request<Invoice[]>('/api/invoices', {}, businessContext),
      request<Reminder[]>('/api/reminders', {}, businessContext),
      request<Radar>('/api/radar/insights', {}, businessContext),
    ]);

    setClients(nextClients);
    setQuotes(nextQuotes);
    setInvoices(nextInvoices);
    setReminders(nextReminders);
    setRadar(nextRadar);
    setSelectedInvoiceId((current) => current || nextInvoices[0]?.id || '');
  };

  useEffect(() => {
    request<AuthResponse>('/api/auth/me')
      .then((result) => {
        setBusiness(result.business);
        setMessage(`Session restored for ${result.business.name}.`);
        return refresh(result.business);
      })
      .catch(() => undefined);
  }, []);

  const login = async () => {
    const result = await request<AuthResponse>('/api/auth/demo-login', { method: 'POST' });
    setBusiness(result.business);
    setMessage(`Logged into ${result.business.name}.`);
    await refresh(result.business);
  };

  const pilotLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await request<AuthResponse>('/api/auth/pilot-login', {
        method: 'POST',
        body: JSON.stringify({
          email: pilotEmail,
          accessCode: pilotAccessCode,
        }),
      });
      setBusiness(result.business);
      setPilotAccessCode('');
      setMessage(`Logged into ${result.business.name}.`);
      await refresh(result.business);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const logout = async () => {
    await request<void>('/api/auth/logout', { method: 'POST' });
    clearWorkspace();
    setMessage('Signed out.');
  };

  const createClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      await request<Client>('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name')),
          email: String(form.get('email') || '') || null,
        }),
      });
      formElement.reset();
      setMessage('Client created.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const createQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const clientId = String(form.get('clientId'));
      await request<Quote>('/api/quotes', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          status: 'accepted',
          taxRatePercent: Number(quoteTaxRatePercent || 0),
          lineItems: [
            {
              description: quoteDescription,
              quantity: Number(quoteQuantity || 1),
              price: Math.round(Number(quotePrice || 0) * 100),
              category: 'Service',
            },
          ],
        }),
      });
      formElement.reset();
      setQuoteDescription('');
      setQuoteQuantity('1');
      setQuotePrice('');
      setQuoteTaxRatePercent('');
      setMessage('Accepted quote created.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const generateAiDraft = async () => {
    const notes = aiNotes.trim();
    if (!notes) {
      setMessage('Add job notes before generating a draft.');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const result = await request<AiGenerateResponse>('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
      const firstItem = result.items[0];
      if (!firstItem) {
        setMessage('AI returned no draft line items.');
        return;
      }
      setQuoteDescription(firstItem.description);
      setQuoteQuantity(String(firstItem.quantity));
      setQuotePrice((firstItem.price / 100).toFixed(2));
      setMessage(result.degraded ? 'Draft generated with fallback AI.' : `Draft generated with ${result.provider}.`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const convertQuote = async (quoteId: string) => {
    try {
      const invoice = await request<Invoice>(`/api/quotes/${quoteId}/convert`, { method: 'POST' });
      setSelectedInvoiceId(invoice.id);
      setMessage('Quote converted to invoice.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const createPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInvoice) return;
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      await request<Payment>(`/api/invoices/${selectedInvoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(Number(form.get('amount') || 0) * 100),
          method: String(form.get('method') || 'manual'),
        }),
      });
      formElement.reset();
      setMessage('Payment recorded.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const createReminder = async (entityType: 'quote' | 'invoice', entityId: string) => {
    // This MVP exposes a manual Send action rather than a background scheduler.
    // Create reminders due now so the UI and server enforce the same contract.
    try {
      const scheduledAt = new Date().toISOString();
      await request<Reminder>('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({ entityType, entityId, scheduledAt }),
      });
      setMessage('Reminder scheduled.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const sendReminder = async (id: string) => {
    try {
      await request<Reminder>(`/api/reminders/${id}/send`, { method: 'POST' });
      setMessage('Reminder sent.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const resolveReminder = async (id: string) => {
    try {
      await request<Reminder>(`/api/reminders/${id}/resolve`, { method: 'POST' });
      setMessage('Reminder resolved.');
      await refresh();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  if (!business) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <h1>CashQuote</h1>
          <p>{message}</p>
          <form onSubmit={pilotLogin} className="login-form">
            <input
              value={pilotEmail}
              onChange={(event) => setPilotEmail(event.target.value)}
              placeholder="Pilot email"
              type="email"
              required
            />
            <input
              value={pilotAccessCode}
              onChange={(event) => setPilotAccessCode(event.target.value)}
              placeholder="Access code"
              type="password"
              required
            />
            <button type="submit">Pilot Login</button>
          </form>
          <button type="button" onClick={login}>Demo Login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>CashQuote</h1>
          <p>{business.name}</p>
        </div>
        <button type="button" onClick={() => refresh().catch((error) => setMessage(error.message))}>
          Refresh
        </button>
        <button type="button" onClick={() => logout().catch((error) => setMessage(error.message))}>
          Logout
        </button>
      </header>

      <p className="status">{message}</p>

      <section className="grid">
        <form onSubmit={createClient} className="panel">
          <h2>Clients</h2>
          <input name="name" placeholder="Client name" required />
          <input name="email" placeholder="Email" type="email" />
          <button type="submit">Create Client</button>
          <ul>
            {clients.map((client) => (
              <li key={client.id}>{client.name}</li>
            ))}
          </ul>
        </form>

        <form onSubmit={createQuote} className="panel">
          <h2>Quote Builder</h2>
          <select name="clientId" required>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <textarea
            value={aiNotes}
            onChange={(event) => setAiNotes(event.target.value)}
            placeholder="Job notes"
            rows={3}
          />
          <button type="button" onClick={() => generateAiDraft().catch((error) => setMessage(error.message))} disabled={isGeneratingAi}>
            {isGeneratingAi ? 'Generating...' : 'Generate Draft'}
          </button>
          <input
            name="description"
            placeholder="Line item"
            value={quoteDescription}
            onChange={(event) => setQuoteDescription(event.target.value)}
            required
          />
          <input
            name="quantity"
            type="number"
            min="1"
            value={quoteQuantity}
            onChange={(event) => setQuoteQuantity(event.target.value)}
          />
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={quotePrice}
            onChange={(event) => setQuotePrice(event.target.value)}
            required
          />
          <input
            name="taxRatePercent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Tax %"
            value={quoteTaxRatePercent}
            onChange={(event) => setQuoteTaxRatePercent(event.target.value)}
          />
          <button type="submit">Create Accepted Quote</button>
        </form>

        <section className="panel">
          <h2>Quotes</h2>
          {quotes.map((quote) => (
            <article key={quote.id} className="row">
              <span>{quote.client?.name ?? quote.clientId}</span>
              <strong>{dollars(quote.total)}</strong>
              <button type="button" onClick={() => convertQuote(quote.id)}>Convert</button>
              <button
                type="button"
                onClick={() => createReminder('quote', quote.id)}
                disabled={!quote.client?.email}
                title={quote.client?.email ? undefined : 'Client email is required for reminders'}
              >
                Remind
              </button>
            </article>
          ))}
        </section>

        <section className="panel">
          <h2>Invoices</h2>
          <p className="note">Payments are internal records only; no online card processing is connected.</p>
          <select value={selectedInvoice?.id ?? ''} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.client?.name ?? invoice.clientId} - {dollars(invoice.total)} - {invoice.status}
              </option>
            ))}
          </select>
          {selectedInvoice && (
            <>
              <form onSubmit={createPayment} className="inline-form">
                <input name="amount" type="number" min="0.01" step="0.01" placeholder="Payment" required />
                <input name="method" defaultValue="manual" required />
                <button type="submit">Record</button>
              </form>
              <button
                type="button"
                onClick={() => createReminder('invoice', selectedInvoice.id)}
                disabled={!selectedInvoice.client?.email}
                title={
                  selectedInvoice.client?.email
                    ? undefined
                    : 'Client email is required for reminders'
                }
              >
                Remind
              </button>
              <button type="button" onClick={() => window.print()}>Print</button>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Lost Cash Radar</h2>
          <p>Total at risk: <strong>{dollars(radar?.totalAtRisk ?? 0)}</strong></p>
          <p>{radar?.unconvertedQuotes.length ?? 0} unconverted accepted quotes</p>
          <p>{radar?.overdueInvoices.length ?? 0} overdue unpaid invoices</p>
        </section>

        <section className="panel">
          <h2>Reminders</h2>
          {reminders.map((reminder) => (
            <article key={reminder.id} className="row">
              <span>
                {reminder.entityType} {reminder.status} ({new Date(reminder.scheduledAt).toLocaleString()})
              </span>
              <button
                type="button"
                onClick={() => sendReminder(reminder.id)}
                disabled={
                  reminder.status !== 'pending' ||
                  new Date(reminder.scheduledAt).getTime() > Date.now() + REMINDER_CLOCK_SKEW_MS
                }
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => resolveReminder(reminder.id)}
                disabled={reminder.status === 'sending' || reminder.status === 'resolved'}
              >
                Resolve
              </button>
            </article>
          ))}
        </section>
      </section>

      {selectedInvoice && (
        <section className="print-document">
          <h1>Invoice</h1>
          <p>{selectedInvoice.client?.name ?? selectedInvoice.clientId}</p>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.lineItems.map((item) => (
                <tr key={`${item.description}-${item.price}`}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{dollars(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Total {dollars(selectedInvoice.total)}</h2>
          <p>Status: {selectedInvoice.status}</p>
        </section>
      )}
    </main>
  );
}
