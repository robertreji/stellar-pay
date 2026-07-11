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
    <div className="quick-send">
      <h3 className="section-title">Quick Send</h3>
      <div className="quick-send-list">
        <button className="quick-send-item add-new" onClick={onAddNew}>
          <div className="quick-send-avatar add-new-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="quick-send-name">Add New</span>
        </button>
        {contacts.map((contact) => (
          <button
            key={contact.id}
            className="quick-send-item"
            onClick={() => onSelectContact(contact)}
          >
            <div
              className="quick-send-avatar"
              style={{
                background: contact.image ? "none" : `linear-gradient(135deg, ${contact.color}, ${contact.color}88)`,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
            <span className="quick-send-name">{contact.name.startsWith("@") ? contact.name : `@${contact.name}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
