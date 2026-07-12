"use client";

import { useState, useEffect } from "react";
import { getContacts, Contact } from "@/lib/contacts";

interface QuickSendProps {
  onSelectContact: (contact: Contact) => void;
  onAddNew: () => void;
}

export default function QuickSend({ onSelectContact, onAddNew }: QuickSendProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    setContacts(getContacts());
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col gap-3 mb-6">
      <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Quick Send</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <button className="flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer group" onClick={onAddNew}>
          <div className="w-12 h-12 rounded-full border border-dashed border-border-theme-hover text-text-muted hover:border-accent-purple hover:text-accent-purple transition-all flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold text-text-secondary w-14 text-center truncate group-hover:text-text-primary transition-colors">Add New</span>
        </button>
        {contacts.map((contact) => (
          <button
            key={contact.id}
            className="flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer group"
            onClick={() => onSelectContact(contact)}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{
                background: contact.image ? "none" : `linear-gradient(135deg, ${contact.color}, ${contact.color}88)`,
                overflow: "hidden",
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
            <span className="text-[10px] font-semibold text-text-secondary w-14 text-center truncate group-hover:text-text-primary transition-colors">{contact.name.startsWith("@") ? contact.name : `@${contact.name}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
