import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "../supabaseClient";

export default function LeadImporter({
  refresh,
}) {
  const [loading, setLoading] =
    useState(false);
  const [count, setCount] =
    useState(0);

  async function handleFile(e) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (
        results
      ) => {
        const rows =
          results.data.map(
            (row) => ({
              property_address:
                row.property_address ||
                "",
              lead_score:
                row.lead_score
                  ? Number(
                      row.lead_score
                    )
                  : null,
              motivation:
                row.motivation
                  ? Number(
                      row.motivation
                    )
                  : null,
              owner_name:
                row.owner_name ||
                null,
              source:
                row.source ||
                "CSV Import",
              stage:
                row.stage ||
                "New Lead",
            })
          );

        const {
          error,
        } =
          await supabase
            .from(
              "deals"
            )
            .insert(rows);

        if (error) {
          console.error(
            error
          );
          alert(
            "Import failed"
          );
        } else {
          setCount(
            rows.length
          );
          refresh();
        }

        setLoading(
          false
        );
      },
    });
  }

  return (
    <div
      style={{
        marginBottom: 24,
        background: "#fff",
        border:
          "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Lead Importer
      </h2>

      <input
        type="file"
        accept=".csv"
        onChange={
          handleFile
        }
      />

      <div
        style={{
          marginTop: 10,
          fontSize: 14,
          color: "#475569",
        }}
      >
        {loading
          ? "Importing..."
          : count > 0
          ? `${count} leads imported`
          : "Upload CSV file"}
      </div>
    </div>
  );
}