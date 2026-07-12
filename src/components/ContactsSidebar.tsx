"use client";

import { useState, useEffect } from "react";
import { getContacts, Contact } from "@/lib/contacts";

interface ContactsSidebarProps {
  onSelectContact: (contact: Contact) => void;
  onAddContact: () => void;
  refreshTrigger: number;
}

export default function ContactsSidebar({
  onSelectContact,
  onAddContact,
  refreshTrigger,
}: ContactsSidebarProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const loadContacts = () => {
    setContacts(getContacts());
  };

  useEffect(() => {
    loadContacts();
  }, [refreshTrigger]);

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = contact.name.toLowerCase().includes(query);
    const addressMatch = contact.address.toLowerCase().includes(query);
    return nameMatch || addressMatch;
  });

  const getInitials = (name: string) => {
    const clean = name.replace("@", "");
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <aside className="hidden xl:flex bg-bg-secondary border-l border-border-theme p-8 flex-col h-screen sticky top-0 z-[90]">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-text-primary">My Contacts</h3>
        <button
          onClick={loadContacts}
          className="w-8 h-8 rounded-full bg-bg-card border border-border-theme text-text-secondary flex items-center justify-center cursor-pointer transition-all duration-300 hover:bg-bg-card-hover hover:text-text-primary"
          title="Refresh Contacts"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>

      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-bg-card border border-border-theme rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold outline-none focus:border-accent-purple/50 focus:ring-4 focus:ring-accent-purple/10 text-text-primary transition-all duration-300"
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 -mx-2 px-2">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-8 px-4 text-text-muted text-sm">
            {searchQuery ? "No contacts match your search." : "No contacts yet."}
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const displayName = contact.name.startsWith("@") ? contact.name : `@${contact.name}`;
            const displayHandle = contact.name.startsWith("@")
              ? `@${contact.name.replace("@", "").toLowerCase()}_stellar`
              : `@${contact.name.toLowerCase()}_stellar`;

            return (
              <div
                key={contact.id}
                className="flex items-center justify-between p-2.5 bg-bg-card border border-border-theme rounded-2xl gap-2 transition-all duration-200 hover:bg-bg-hover hover:border-border-theme-hover group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                    style={{
                      background: contact.image ? "none" : `linear-gradient(135deg, ${contact.color}, ${contact.color}88)`,
                    }}
                  >
                    {contact.image ? (
                      <img
                        src={contact.image}
                        alt={contact.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      getInitials(contact.name)
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {displayName}
                    </span>
                    <span className="text-xs text-text-muted truncate">
                      {displayHandle}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectContact(contact)}
                  className="w-9 h-9 rounded-full border border-accent-purple/20 bg-accent-purple/6 text-accent-purple flex items-center justify-center cursor-pointer transition-all duration-300 flex-shrink-0 hover:bg-accent-purple hover:text-white hover:shadow-[0_0_12px_rgba(27,67,50,0.25)]"
                  title={`Send to ${contact.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: "rotate(45deg) translate(-1px, 1px)" }}>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border-theme">
        <button
          onClick={onAddContact}
          className="w-full flex items-center justify-between py-3 px-4 rounded-2xl bg-bg-card border border-border-theme text-text-secondary text-sm font-medium cursor-pointer transition-all duration-300 hover:border-border-theme-hover hover:bg-[#1b4332]/5 hover:text-accent-purple"
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
            <span>View All Contacts</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
