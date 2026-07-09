export interface Contact {
  id: string;
  name: string;
  address: string;
  color: string;
  createdAt: string;
}

const CONTACTS_KEY = "stellarpay_contacts";

function generateColor(name: string): string {
  const colors = [
    "#6c2bd9",
    "#9333ea",
    "#ec4899",
    "#06b6d4",
    "#f59e0b",
    "#22c55e",
    "#ef4444",
    "#3b82f6",
    "#8b5cf6",
    "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(CONTACTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addContact(name: string, address: string): Contact {
  const contacts = getContacts();
  const newContact: Contact = {
    id: crypto.randomUUID(),
    name,
    address,
    color: generateColor(name),
    createdAt: new Date().toISOString(),
  };
  contacts.push(newContact);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  return newContact;
}

export function removeContact(id: string): void {
  const contacts = getContacts().filter((c) => c.id !== id);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
