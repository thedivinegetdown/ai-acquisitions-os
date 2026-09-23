import { useCallback, useEffect, useState } from "react";
import {
  createDocument,
  listClosingRevisionsByDeal,
  listDocumentsByDeal,
  listOfferRevisionsByDeal,
} from "../services/repositories";
import { projectLatestOfferRevision } from "../services/offers";
import { projectLatestClosingRevision } from "../services/transactions";

const TYPES = [
  "Purchase Agreement",
  "Assignment Contract",
  "Seller ID",
  "Title Docs",
  "Photos",
  "Invoice",
  "Other",
];

export default function DocumentVault({
  deal,
}) {
  const [docs, setDocs] =
    useState([]);
  const [lifecycleLinks, setLifecycleLinks] = useState([]);

  const [form, setForm] =
    useState({
      doc_type:
        "Purchase Agreement",
      title: "",
      url: "",
      notes: "",
      association: "",
    });

  const [saving, setSaving] =
    useState(false);

  const loadDocs = useCallback(async () => {
    const result = await listDocumentsByDeal(deal.id);

    if (!result.success) {
      console.error(result.error);
      setDocs([]);
    } else {
      setDocs(result.data || []);
    }
  }, [deal.id]);

  const loadLifecycleLinks = useCallback(async () => {
    const [offerResult, closingResult] = await Promise.all([
      listOfferRevisionsByDeal(deal.id),
      listClosingRevisionsByDeal(deal.id),
    ]);
    const offer = projectLatestOfferRevision(offerResult.success ? offerResult.data : []);
    const closing = projectLatestClosingRevision(closingResult.success ? closingResult.data : []);
    setLifecycleLinks([
      offer ? { value: `offer:${offer.id}`, label: `Offer revision ${offer.revision_number}` } : null,
      closing ? { value: `closing:${closing.id}`, label: `Closing revision ${closing.revision_number}` } : null,
    ].filter(Boolean));
  }, [deal.id]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      loadDocs();
      loadLifecycleLinks();
    });
    return () => {
      cancelled = true;
    };
  }, [loadDocs, loadLifecycleLinks]);

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveDoc(e) {
    e.preventDefault();
    setSaving(true);

    const result = await createDocument({
      deal_id: deal.id,
      offer_revision_id: form.association.startsWith("offer:")
        ? form.association.slice("offer:".length)
        : null,
      closing_revision_id: form.association.startsWith("closing:")
        ? form.association.slice("closing:".length)
        : null,
      ...form,
    });

    if (!result.success) {
      console.error(result.error);
      alert("Error saving doc");
    } else {
      setForm({
        doc_type:
          "Purchase Agreement",
        title: "",
        url: "",
        notes: "",
        association: "",
      });

      loadDocs();
    }

    setSaving(false);
  }

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop:
          "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Document Vault
      </h3>

      <form
        onSubmit={saveDoc}
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <select
          value={
            form.doc_type
          }
          onChange={(e) =>
            update(
              "doc_type",
              e.target.value
            )
          }
        >
          {TYPES.map((t) => (
            <option
              key={t}
              value={t}
            >
              {t}
            </option>
          ))}
        </select>

        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            update(
              "title",
              e.target.value
            )
          }
          required
        />

        <input
          placeholder="URL / Link"
          value={form.url}
          onChange={(e) =>
            update(
              "url",
              e.target.value
            )
          }
        />

        <textarea
          rows="3"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) =>
            update(
              "notes",
              e.target.value
            )
          }
        />

        <select
          aria-label="Lifecycle association"
          value={form.association}
          onChange={(e) => update("association", e.target.value)}
        >
          <option value="">Deal only</option>
          {lifecycleLinks.map((link) => (
            <option key={link.value} value={link.value}>{link.label}</option>
          ))}
        </select>

        <button type="submit">
          {saving
            ? "Saving..."
            : "Add Document"}
        </button>
      </form>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {docs.length === 0 ? (
          <p>
            No documents yet.
          </p>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              style={{
                background:
                  "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                }}
              >
                {doc.title}
              </div>

              <div
                style={{
                  fontSize: 14,
                  color:
                    "#475569",
                  marginTop: 4,
                }}
              >
                {doc.doc_type}
              </div>

              {doc.url ? (
                <div
                  style={{
                    marginTop: 6,
                  }}
                >
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Link
                  </a>
                </div>
              ) : null}

              {doc.notes ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                  }}
                >
                  {doc.notes}
                </div>
              ) : null}
              {doc.offer_revision_id || doc.closing_revision_id ? (
                <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>
                  Linked to {doc.offer_revision_id ? "offer revision" : "closing revision"}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
