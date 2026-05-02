/**
 * Supabase Proxy API client - calls our Vercel API endpoint instead of direct Supabase.
 * Auth is forwarded with the current Supabase session token; the server performs admin checks.
 */
import { supabase } from './supabase';

const API_BASE = '/api/supabase-proxy';

interface QueryParams {
  select?: string;
  order?: { column: string; ascending: boolean; nullsFirst?: boolean };
  eq?: Record<string, any>;
  neq?: Record<string, any>;
  gte?: Record<string, any>;
  lte?: Record<string, any>;
  in?: Record<string, any[]>;
  limit?: number;
  range?: [number, number];
  head?: boolean;
  single?: boolean;
  maybeSingle?: boolean;
  count?: boolean;
}

interface SelectResult {
  data?: any[];
  count?: number | null;
  error?: string;
}

async function callProxy(method: string, action: string, table: string | null, params: any = {}): Promise<any> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(API_BASE, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, table, params }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || `Proxy request failed (${res.status})`);
  }
  return payload;
}

class ProxyQuery {
  private _table: string;
  private _params: QueryParams = {};

  constructor(table: string) {
    this._table = table;
  }

  select(columns?: string): ProxyQuery {
    this._params.select = columns || '*';
    return this;
  }

  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): ProxyQuery {
    this._params.order = { 
      column, 
      ascending: opts.ascending ?? true, 
      nullsFirst: opts.nullsFirst 
    };
    return this;
  }

  eq(col: string, val: any): ProxyQuery {
    if (val !== null && val !== undefined) {
      if (!this._params.eq) this._params.eq = {};
      (this._params.eq as Record<string, any>)[col] = val;
    }
    return this;
  }

  neq(col: string, val: any): ProxyQuery {
    if (!this._params.neq) this._params.neq = {};
    (this._params.neq as Record<string, any>)[col] = val;
    return this;
  }

  gte(col: string, val: any): ProxyQuery {
    if (!this._params.gte) this._params.gte = {};
    (this._params.gte as Record<string, any>)[col] = val;
    return this;
  }

  lte(col: string, val: any): ProxyQuery {
    if (!this._params.lte) this._params.lte = {};
    (this._params.lte as Record<string, any>)[col] = val;
    return this;
  }

  in(col: string, values: any[]): ProxyQuery {
    if (!this._params.in) this._params.in = {};
    (this._params.in as Record<string, any[]>)[col] = values;
    return this;
  }

  limit(n: number): ProxyQuery {
    this._params.limit = n;
    return this;
  }

  range(from: number, to: number): ProxyQuery {
    this._params.range = [from, to];
    return this;
  }

  single(): ProxyQuery {
    this._params.single = true;
    return this;
  }

  maybeSingle(): ProxyQuery {
    this._params.maybeSingle = true;
    return this;
  }

  count(): ProxyQuery {
    this._params.count = true;
    this._params.head = true;
    this._params.select = this._params.select || '*';
    return this;
  }

  async run(action: string = 'select'): Promise<SelectResult> {
    const method = action === 'select' || action === 'stats' ? 'POST' : 'GET';
    return callProxy(method, action, this._table, this._params);
  }

  then(resolve: (value: SelectResult) => any, reject?: (reason: any) => any): Promise<SelectResult> {
    return this.run('select').then(resolve, reject);
  }
}

export const proxy = {
  from(table: string): ProxyQuery {
    return new ProxyQuery(table);
  }
};

export async function proxySelect(table: string, params: any = {}): Promise<SelectResult> {
  return callProxy('POST', 'select', table, params);
}

export async function proxyStats(): Promise<any> {
  return callProxy('POST', 'stats', null, {});
}

export async function proxyInsert(table: string, data: any): Promise<any> {
  return callProxy('POST', 'insert', table, { data });
}

export async function proxyUpsert(table: string, data: any, onConflict?: string): Promise<any> {
  return callProxy('POST', 'upsert', table, { data, onConflict });
}

export async function proxyUpdate(table: string, data: any, filters: Record<string, any>): Promise<any> {
  return callProxy('PATCH', 'update', table, { data, eq: filters });
}

export async function proxyDelete(table: string, filters: Record<string, any>): Promise<any> {
  return callProxy('DELETE', 'delete', table, { eq: filters });
}
