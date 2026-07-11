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
    <aside className="right-sidebar">
      <div className="sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>My Contacts</h3>
        <button
          onClick={loadContacts}
          className="header-icon-btn"
          style={{ width: "32px", height: "32px" }}
          title="Refresh Contacts"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>

      <div className="search-container" style={{ marginBottom: "24px", position: "relative" }}>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input"
          style={{
            paddingLeft: "38px",
            fontSize: "14px",
            background: "rgba(26,28,40,0.4)",
            borderColor: "rgba(255,255,255,0.06)",
            borderRadius: "12px",
            height: "42px"
          }}
        />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <div className="contacts-list-scrollable" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", margin: "0 -8px", padding: "0 8px" }}>
        {filteredContacts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)", fontSize: "14px" }}>
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "16px",
                  background: "rgba(26,28,40,0.3)",
                  border: "1px solid rgba(255,255,255,0.03)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.05)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(26,28,40,0.3)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.03)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: contact.image ? "none" : `linear-gradient(135deg, ${contact.color}, ${contact.color}88)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "white",
                      flexShrink: 0
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
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayName}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayHandle}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectContact(contact)}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "1px solid rgba(139,92,246,0.2)",
                    background: "rgba(139,92,246,0.06)",
                    color: "var(--accent-purple)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--accent-purple)";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.boxShadow = "0 0 12px rgba(139,92,246,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                    e.currentTarget.style.color = "var(--accent-purple)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
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

      <div className="sidebar-footer" style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={onAddContact}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderRadius: "16px",
            background: "rgba(26,28,40,0.5)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "var(--text-secondary)",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-glow)";
            e.currentTarget.style.background = "rgba(139,92,246,0.08)";
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            e.currentTarget.style.background = "rgba(26,28,40,0.5)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
