// BHAVANISHREE TAILORING SHOP — தரவுத்தள அடுக்கு (Supabase)
// அனைத்து வாடிக்கையாளர் தரவும் இப்போது Supabase (கிளவுட்) இல் சேமிக்கப்படுகிறது.
// இதனால் பல சாதனங்களில் (தொலைபேசி, கணினி) ஒரே தரவை பயன்படுத்தலாம்.
//
// ⚠️ கட்டாயம் செய்யவேண்டியது: கீழே உள்ள SUPABASE_URL மற்றும் SUPABASE_ANON_KEY
// ஐ உங்கள் சொந்த Supabase project இன் மதிப்புகளால் மாற்றவும்.
// (Supabase Dashboard → Project Settings → API)
//
// அட்டவணைகளை உருவாக்க README.md இல் உள்ள SQL-ஐ Supabase SQL Editor இல் இயக்கவும்.

const SUPABASE_URL = 'https://mbgknkmrxbdyznycbjsd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VlGnU2TO3-PsIm6IwjFdYQ_piNqvCna';

const TABLES = {
  customers: 'customers',
  measurements: 'measurements',
  patterns: 'patterns'
};

let client = null;
let configWarned = false;

function isConfigured() {
  return !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-SUPABASE-ANON-KEY');
}

function getClient() {
  if (!isConfigured()) {
    if (!configWarned) {
      configWarned = true;
      console.error('Supabase அமைக்கப்படவில்லை. js/db.js இல் SUPABASE_URL மற்றும் SUPABASE_ANON_KEY ஐ சேர்க்கவும்.');
    }
    throw new Error('supabase-not-configured');
  }
  if (!client) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('supabase-js-not-loaded');
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function throwIfError(res) {
  if (res.error) {
    // Surface the real Postgres/PostgREST reason (message/details/hint/code)
    // instead of a bare "[object Object]" — this is what shows up both in
    // the browser console and, via router()'s catch, right there on screen.
    const e = res.error;
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    const readable = parts.length ? parts.join(' — ') : JSON.stringify(e);
    console.error('Supabase error', { code: e.code, message: e.message, details: e.details, hint: e.hint });
    const err = new Error(readable + (e.code ? ` (code: ${e.code})` : ''));
    err.original = e;
    throw err;
  }
  return res.data;
}

async function openDb() {
  // Supabase வழக்கில் "திறத்தல்" கட்டாயமில்லை — வெறும் client-ஐ தயார்
  // செய்கிறோம். openDb() பெயர் மற்ற குறியீட்டுடன் ஒத்துப்போக அப்படியே
  // வைக்கப்பட்டுள்ளது.
  return getClient();
}

// ---------------- வரிசை ↔ பொருள் மாற்றிகள் (row <-> object mappers) ----------------

function customerFromRow(r) {
  return {
    id: r.id,
    name: r.name || '',
    phone: r.phone || '',
    model: r.model,
    cuttingType: r.cutting_type || null,
    notes: r.notes || '',
    pinned: !!r.pinned,
    deleted: !!r.deleted,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deletedAt: r.deleted_at != null ? Number(r.deleted_at) : null
  };
}
function customerToRow(c) {
  return {
    id: c.id,
    name: c.name || '',
    phone: c.phone || '',
    model: c.model,
    cutting_type: c.cuttingType || null,
    notes: c.notes || '',
    pinned: !!c.pinned,
    deleted: !!c.deleted,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    deleted_at: c.deletedAt != null ? c.deletedAt : null
  };
}

function measurementFromRow(r) {
  return {
    id: r.id,
    customerId: r.customer_id,
    model: r.model,
    fields: r.fields || {},
    createdAt: Number(r.created_at)
  };
}
function measurementToRow(m) {
  return {
    id: m.id,
    customer_id: m.customerId,
    model: m.model,
    fields: m.fields || {},
    created_at: m.createdAt
  };
}

function patternFromRow(r) {
  return {
    id: r.id,
    label: r.label || '',
    fields: r.fields || {},
    deleted: !!r.deleted,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deletedAt: r.deleted_at != null ? Number(r.deleted_at) : null
  };
}
function patternToRow(p) {
  return {
    id: p.id,
    label: p.label || '',
    fields: p.fields || {},
    deleted: !!p.deleted,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    deleted_at: p.deletedAt != null ? p.deletedAt : null
  };
}

// ---------------- வாடிக்கையாளர்கள் (Customers) ----------------

const Customers = {
  async add(data) {
    const now = Date.now();
    const record = {
      id: uid(),
      name: (data.name || '').trim(),
      phone: (data.phone || '').trim(),
      model: data.model, // 'blouse' | 'chudithar'
      cuttingType: data.cuttingType || null, // 'neer' | 'cross' — பிளவுஸ் மாடலுக்கு மட்டும்
      notes: data.notes || '',
      pinned: false,
      deleted: false,
      createdAt: now,
      updatedAt: now
    };
    const sb = getClient();
    const res = await sb.from(TABLES.customers).insert(customerToRow(record)).select().single();
    return customerFromRow(throwIfError(res));
  },

  async update(id, changes) {
    const sb = getClient();
    const existing = await this.get(id);
    if (!existing) throw new Error('customer-not-found');
    const updated = { ...existing, ...changes, id, updatedAt: Date.now() };
    const res = await sb.from(TABLES.customers).update(customerToRow(updated)).eq('id', id).select().single();
    return customerFromRow(throwIfError(res));
  },

  async get(id) {
    const sb = getClient();
    const res = await sb.from(TABLES.customers).select('*').eq('id', id).maybeSingle();
    const row = throwIfError(res);
    return row ? customerFromRow(row) : null;
  },

  async getAll({ includeDeleted = false } = {}) {
    const sb = getClient();
    let q = sb.from(TABLES.customers).select('*');
    if (!includeDeleted) q = q.eq('deleted', false);
    const res = await q.order('updated_at', { ascending: false });
    return throwIfError(res).map(customerFromRow);
  },

  async setPinned(id, pinned) {
    return this.update(id, { pinned: !!pinned });
  },

  async softDelete(id) {
    return this.update(id, { deleted: true, deletedAt: Date.now() });
  },

  async restore(id) {
    return this.update(id, { deleted: false, deletedAt: null });
  },

  async hardDelete(id) {
    const sb = getClient();
    // measurements.customer_id → customers.id ஆனதால், முதலில் அளவுகளை நீக்கவும்.
    await sb.from(TABLES.measurements).delete().eq('customer_id', id);
    throwIfError(await sb.from(TABLES.customers).delete().eq('id', id));
  },

  async search(query) {
    const sb = getClient();
    const q = (query || '').trim();
    let req = sb.from(TABLES.customers).select('*').eq('deleted', false);
    if (q) req = req.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    const res = await req.order('updated_at', { ascending: false });
    return throwIfError(res).map(customerFromRow);
  },

  async pinnedList() {
    const sb = getClient();
    const res = await sb.from(TABLES.customers).select('*')
      .eq('deleted', false).eq('pinned', true)
      .order('updated_at', { ascending: false });
    return throwIfError(res).map(customerFromRow);
  },

  // Count-only query (head: true) — Supabase/PostgREST returns the row
  // count without sending any actual row data back, so this stays cheap
  // even as the customer list grows.
  async countAll() {
    const sb = getClient();
    const res = await sb.from(TABLES.customers)
      .select('*', { count: 'exact', head: true })
      .eq('deleted', false);
    if (res.error) throwIfError(res);
    return res.count || 0;
  },

  async recentList(limit = 8) {
    const sb = getClient();
    const res = await sb.from(TABLES.customers).select('*')
      .eq('deleted', false)
      .order('updated_at', { ascending: false })
      .limit(limit);
    return throwIfError(res).map(customerFromRow);
  }
};

// ---------------- அளவுகள் (Measurements) ----------------

const Measurements = {
  async add(customerId, model, fields) {
    const record = {
      id: uid(),
      customerId,
      model,
      fields, // { fieldKey: numberOrString }
      createdAt: Date.now()
    };
    const sb = getClient();
    const res = await sb.from(TABLES.measurements).insert(measurementToRow(record)).select().single();
    return measurementFromRow(throwIfError(res));
  },

  async getByCustomer(customerId) {
    const sb = getClient();
    const res = await sb.from(TABLES.measurements).select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    return throwIfError(res).map(measurementFromRow);
  },

  async getLatest(customerId) {
    const list = await this.getByCustomer(customerId);
    return list.length ? list[0] : null;
  },

  async get(id) {
    const sb = getClient();
    const res = await sb.from(TABLES.measurements).select('*').eq('id', id).maybeSingle();
    const row = throwIfError(res);
    return row ? measurementFromRow(row) : null;
  },

  async remove(id) {
    const sb = getClient();
    throwIfError(await sb.from(TABLES.measurements).delete().eq('id', id));
  }
};

// ---------------- உடல் அளவு பேட்டர்ன் (Standalone Body-Measurement Patterns) ----------------
// Fully independent of the Customers/Measurements tables — no customerId link.

const Patterns = {
  async add(label, fields) {
    const record = {
      id: uid(),
      label: (label || '').trim(),
      fields,
      deleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const sb = getClient();
    const res = await sb.from(TABLES.patterns).insert(patternToRow(record)).select().single();
    return patternFromRow(throwIfError(res));
  },

  async update(id, label, fields) {
    const sb = getClient();
    const existing = await this.get(id);
    if (!existing) throw new Error('pattern-not-found');
    const updated = { ...existing, label: (label || '').trim(), fields, updatedAt: Date.now() };
    const res = await sb.from(TABLES.patterns).update(patternToRow(updated)).eq('id', id).select().single();
    return patternFromRow(throwIfError(res));
  },

  async get(id) {
    const sb = getClient();
    const res = await sb.from(TABLES.patterns).select('*').eq('id', id).maybeSingle();
    const row = throwIfError(res);
    return row ? patternFromRow(row) : null;
  },

  async getAll({ includeDeleted = false } = {}) {
    const sb = getClient();
    let q = sb.from(TABLES.patterns).select('*');
    if (!includeDeleted) q = q.eq('deleted', false);
    const res = await q.order('created_at', { ascending: false });
    return throwIfError(res).map(patternFromRow);
  },

  async search(query) {
    const sb = getClient();
    const q = (query || '').trim();
    let req = sb.from(TABLES.patterns).select('*').eq('deleted', false);
    if (q) req = req.ilike('label', `%${q}%`);
    const res = await req.order('created_at', { ascending: false });
    return throwIfError(res).map(patternFromRow);
  },

  async softDelete(id) {
    const sb = getClient();
    const existing = await this.get(id);
    if (!existing) throw new Error('pattern-not-found');
    const updated = { ...existing, deleted: true, deletedAt: Date.now() };
    const res = await sb.from(TABLES.patterns).update(patternToRow(updated)).eq('id', id).select().single();
    return patternFromRow(throwIfError(res));
  },

  async restore(id) {
    const sb = getClient();
    const existing = await this.get(id);
    if (!existing) throw new Error('pattern-not-found');
    const updated = { ...existing, deleted: false, deletedAt: null };
    const res = await sb.from(TABLES.patterns).update(patternToRow(updated)).eq('id', id).select().single();
    return patternFromRow(throwIfError(res));
  },

  async hardDelete(id) {
    const sb = getClient();
    throwIfError(await sb.from(TABLES.patterns).delete().eq('id', id));
  },

  async remove(id) {
    return this.softDelete(id);
  }
};

// ---------------- காப்புப்பிரதி (Backup / Restore / Excel-CSV Import) ----------------

const Backup = {
  async exportAll() {
    const sb = getClient();
    const [customersRes, measurementsRes, patternsRes] = await Promise.all([
      sb.from(TABLES.customers).select('*'),
      sb.from(TABLES.measurements).select('*'),
      sb.from(TABLES.patterns).select('*')
    ]);
    const customers = throwIfError(customersRes).map(customerFromRow);
    const measurements = throwIfError(measurementsRes).map(measurementFromRow);
    const patterns = throwIfError(patternsRes).map(patternFromRow);
    return {
      app: 'bhavanishree-tailoring-shop',
      version: 3,
      exportedAt: new Date().toISOString(),
      data: { customers, measurements, patterns }
    };
  },

  // merge = true: add to existing data, keeping both (ids are unique so no collision).
  // merge = false: wipe existing data first, then load the file exactly.
  // Used both by "காப்புப்பிரதியை மீட்டமை" (JSON backup restore) and by the
  // new "Excel/CSV இறக்குமதி" (Import) settings screen — both build the same
  // { data: { customers, measurements, patterns } } shape and call this.
  async importAll(payload, { merge = false } = {}) {
    if (!payload || !payload.data || !Array.isArray(payload.data.customers)) {
      throw new Error('invalid-backup-file');
    }
    const sb = getClient();
    const customers = payload.data.customers || [];
    const measurements = payload.data.measurements || [];
    const patterns = payload.data.patterns || [];

    if (!merge) {
      await this.wipeAll();
    }

    // Insert order matters: measurements.customer_id references customers.id.
    if (customers.length) {
      const rows = customers.map(customerToRow);
      throwIfError(await sb.from(TABLES.customers).upsert(rows, { onConflict: 'id' }));
    }
    if (patterns.length) {
      const rows = patterns.map(patternToRow);
      throwIfError(await sb.from(TABLES.patterns).upsert(rows, { onConflict: 'id' }));
    }
    if (measurements.length) {
      const rows = measurements.map(measurementToRow);
      throwIfError(await sb.from(TABLES.measurements).upsert(rows, { onConflict: 'id' }));
    }

    return true;
  },

  async wipeAll() {
    const sb = getClient();
    // .neq('id','__none__') is a standard Supabase trick to match "all rows"
    // in a delete() call, since delete() requires at least one filter.
    await sb.from(TABLES.measurements).delete().neq('id', '__none__');
    await sb.from(TABLES.patterns).delete().neq('id', '__none__');
    await sb.from(TABLES.customers).delete().neq('id', '__none__');
    return true;
  }
};

window.DB = { openDb, Customers, Measurements, Patterns, Backup, uid, isConfigured };
