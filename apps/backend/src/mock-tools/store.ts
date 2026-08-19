export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  tier: "standard" | "premium" | "enterprise";
  balance: number;
  status: "active" | "suspended" | "pending";
}

// In-memory / initial customer store seeded with ~30 records
const INITIAL_CUSTOMERS: CustomerRecord[] = [
  {
    id: "CUST-1001",
    name: "Acme Corp",
    email: "contact@acme.corp",
    tier: "enterprise",
    balance: 54200.5,
    status: "active",
  },
  {
    id: "CUST-1002",
    name: "Beta Systems",
    email: "billing@betasystems.io",
    tier: "premium",
    balance: 12400.0,
    status: "active",
  },
  {
    id: "CUST-1003",
    name: "CyberDyne Labs",
    email: "admin@cyberdyne.tech",
    tier: "enterprise",
    balance: 98000.0,
    status: "active",
  },
  {
    id: "CUST-1004",
    name: "Delta Logistics",
    email: "ops@deltalogistics.com",
    tier: "standard",
    balance: 3400.25,
    status: "active",
  },
  {
    id: "CUST-1005",
    name: "Echo Media",
    email: "hello@echomedia.net",
    tier: "standard",
    balance: 850.0,
    status: "active",
  },
  {
    id: "CUST-1006",
    name: "Foxtrot Finance",
    email: "accounts@foxtrotfin.com",
    tier: "premium",
    balance: 24500.0,
    status: "active",
  },
  {
    id: "CUST-1007",
    name: "Gamma Health",
    email: "support@gammahealth.org",
    tier: "enterprise",
    balance: 67100.0,
    status: "active",
  },
  {
    id: "CUST-1008",
    name: "Helios Energy",
    email: "power@heliosenergy.com",
    tier: "premium",
    balance: 41200.75,
    status: "active",
  },
  {
    id: "CUST-1009",
    name: "InfiniCloud",
    email: "cloud@infinicloud.io",
    tier: "enterprise",
    balance: 112000.0,
    status: "active",
  },
  {
    id: "CUST-1010",
    name: "Jupiter Retail",
    email: "store@jupiterretail.com",
    tier: "standard",
    balance: 5200.1,
    status: "active",
  },
  {
    id: "CUST-1011",
    name: "Krypton Security",
    email: "sec@krypton.io",
    tier: "premium",
    balance: 19800.0,
    status: "active",
  },
  {
    id: "CUST-1012",
    name: "Luna Robotics",
    email: "bot@lunarobotics.ai",
    tier: "enterprise",
    balance: 83400.0,
    status: "active",
  },
  {
    id: "CUST-1013",
    name: "Matrix Networks",
    email: "noc@matrixnet.com",
    tier: "standard",
    balance: 1200.0,
    status: "active",
  },
  {
    id: "CUST-1014",
    name: "Nova Biotech",
    email: "lab@novabio.com",
    tier: "premium",
    balance: 31000.0,
    status: "active",
  },
  {
    id: "CUST-1015",
    name: "Omega Analytics",
    email: "data@omegaanalytics.io",
    tier: "enterprise",
    balance: 76500.0,
    status: "active",
  },
  // Second tier CUST-2xxx series
  {
    id: "CUST-2001",
    name: "Prism Dynamics",
    email: "info@prismdyn.com",
    tier: "standard",
    balance: 4200.0,
    status: "active",
  },
  {
    id: "CUST-2002",
    name: "Quantum Software",
    email: "dev@quantumsoft.net",
    tier: "premium",
    balance: 18900.0,
    status: "active",
  },
  {
    id: "CUST-2003",
    name: "Radiant Cleaners",
    email: "support@radiantclean.com",
    tier: "standard",
    balance: 950.5,
    status: "active",
  },
  {
    id: "CUST-2004",
    name: "Sigma Freight",
    email: "dispatch@sigmafgt.com",
    tier: "enterprise",
    balance: 62000.0,
    status: "active",
  },
  {
    id: "CUST-2005",
    name: "Titan Materials",
    email: "orders@titanmat.com",
    tier: "premium",
    balance: 29500.0,
    status: "active",
  },
  {
    id: "CUST-2006",
    name: "Umbra Defense",
    email: "gov@umbradef.com",
    tier: "enterprise",
    balance: 154000.0,
    status: "active",
  },
  {
    id: "CUST-2007",
    name: "Vortex Gaming",
    email: "play@vortexgame.com",
    tier: "standard",
    balance: 2100.0,
    status: "active",
  },
  {
    id: "CUST-2008",
    name: "Wave Telecom",
    email: "fiber@wavetel.net",
    tier: "premium",
    balance: 37800.0,
    status: "active",
  },
  {
    id: "CUST-2009",
    name: "Xenon AI",
    email: "contact@xenonai.dev",
    tier: "enterprise",
    balance: 89000.0,
    status: "active",
  },
  {
    id: "CUST-2010",
    name: "Yield Financial",
    email: "advisor@yieldfin.org",
    tier: "premium",
    balance: 45000.0,
    status: "active",
  },
  {
    id: "CUST-2011",
    name: "Zenith Aerospace",
    email: "flight@zenithaero.space",
    tier: "enterprise",
    balance: 210000.0,
    status: "active",
  },
  {
    id: "CUST-2012",
    name: "Aura Creative",
    email: "art@auracreative.studio",
    tier: "standard",
    balance: 1500.0,
    status: "active",
  },
  {
    id: "CUST-2013",
    name: "Blaze Express",
    email: "courier@blazeexp.com",
    tier: "standard",
    balance: 2750.0,
    status: "active",
  },
  {
    id: "CUST-2014",
    name: "Crest Petroleum",
    email: "refinery@crestpetro.com",
    tier: "enterprise",
    balance: 340000.0,
    status: "active",
  },
  {
    id: "CUST-2050",
    name: "Zephyr Global",
    email: "ops@zephyrglobal.com",
    tier: "premium",
    balance: 51200.0,
    status: "active",
  },
];

export class MockCustomerStore {
  private customers: Map<string, CustomerRecord>;

  constructor(initialData: CustomerRecord[] = INITIAL_CUSTOMERS) {
    this.customers = new Map();
    for (const c of initialData) {
      this.customers.set(c.id, { ...c });
    }
  }

  get(id: string): CustomerRecord | null {
    const record = this.customers.get(id);
    return record ? { ...record } : null;
  }

  update(id: string, fields: Partial<CustomerRecord>): CustomerRecord | null {
    const record = this.customers.get(id);
    if (!record) return null;
    const updated = { ...record, ...fields, id: record.id };
    this.customers.set(id, updated);
    return { ...updated };
  }

  delete(id: string): boolean {
    return this.customers.delete(id);
  }

  getAll(): CustomerRecord[] {
    return Array.from(this.customers.values()).map((c) => ({ ...c }));
  }

  reset(): void {
    this.customers.clear();
    for (const c of INITIAL_CUSTOMERS) {
      this.customers.set(c.id, { ...c });
    }
  }
}

export const customerStore = new MockCustomerStore();
export { INITIAL_CUSTOMERS };
