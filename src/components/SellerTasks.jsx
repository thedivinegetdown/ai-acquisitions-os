import { useEffect, useMemo, useState } from "react";
import {
createSellerTask,
listSellerTasksByPhone,
updateSellerTask,
} from "../services/repositories";
import { formatSafeDate } from "../utils/dates";

const QUICK_TASKS = [
"Call seller",
"Send follow-up",
"Run comps",
"Make offer",
"Send agreement",
];


function getUuidDealId(deal) {
const id = deal?.id;

if (
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
) {
  return id;
}

return null;
}

function StatusBadge({ status }) {
const isComplete = status === "completed";

return (
<span
style={{
background: isComplete ? "#dcfce7" : "#dbeafe",
border: isComplete ? "1px solid #bbf7d0" : "1px solid #bfdbfe",
borderRadius: 999,
color: isComplete ? "#166534" : "#1d4ed8",
fontSize: 12,
fontWeight: 800,
padding: "4px 8px",
textTransform: "capitalize",
}}
>
{status || "open"}
</span>
);
}

function TaskRow({ task, onToggleStatus }) {
  const isComplete = task.status === "completed";

  return (
    <div
      style={{
        background: isComplete ? "#f8fafc" : "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div>
          <strong
            style={{
              color: isComplete ? "#64748b" : "#0f172a",
              textDecoration: isComplete ? "line-through" : "none",
            }}
          >
            {task.title}
          </strong>

          {task.due_at && (
            <div
              style={{
                color: "#64748b",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              Due {formatSafeDate(task.due_at, "")}
            </div>
          )}
        </div>

<StatusBadge status={task.status} />
</div>

<button
type="button"
onClick={() => onToggleStatus(task)}
style={{
marginTop: 10,
padding: "8px 10px",
border: "1px solid #cbd5e1",
borderRadius: 8,
background: "#ffffff",
color: "#0f172a",
cursor: "pointer",
fontWeight: 700,
}}
>
{isComplete ? "Reopen" : "Complete"}
</button>
</div>
);
}

export default function SellerTasks({ deal, selectedPhone }) {
const [tasks, setTasks] = useState([]);
const [title, setTitle] = useState("");
const [dueAt, setDueAt] = useState("");
const [loading, setLoading] = useState(false);
const [saving, setSaving] = useState(false);
const [errorMessage, setErrorMessage] = useState("");

useEffect(() => {
if (!selectedPhone) {
  setTasks([]);
  return;
}

loadTasks();
}, [selectedPhone]);

const openTasks = useMemo(
() => tasks.filter((task) => task.status !== "completed"),
[tasks]
);

const completedTasks = useMemo(
() => tasks.filter((task) => task.status === "completed"),
[tasks]
);

async function loadTasks() {
setLoading(true);
setErrorMessage("");

const result = await listSellerTasksByPhone(selectedPhone);

if (!result.success) {
  console.error("[SellerTasks] Task load failed:", result.error);
  setErrorMessage(result.error?.message || "Could not load tasks. Apply the seller_tasks migration if needed.");
  setTasks([]);
  setLoading(false);
  return;
}

setTasks(result.data || []);
setLoading(false);
}

async function createTask(taskTitle = title) {
const trimmedTitle = taskTitle.trim();

if (!selectedPhone || !trimmedTitle || saving) return;

setSaving(true);
setErrorMessage("");

const payload = {
deal_id: getUuidDealId(deal),
phone: selectedPhone,
title: trimmedTitle,
status: "open",
due_at: dueAt ? new Date(dueAt).toISOString() : null,
};

const result = await createSellerTask(payload);

if (!result.success) {
  console.error("[SellerTasks] Task create failed:", result.error);
  setErrorMessage(result.error?.message || "Could not create task.");
  setSaving(false);
  return;
}

setTitle("");
setDueAt("");
await loadTasks();
setSaving(false);
}

async function toggleTaskStatus(task) {
const nextStatus = task.status === "completed" ? "open" : "completed";

const result = await updateSellerTask(task.id, {
status: nextStatus,
});

if (!result.success) {
  console.error("[SellerTasks] Task update failed:", result.error);
  setErrorMessage(result.error?.message || "Could not update task.");
  return;
}

await loadTasks();
}

return (
<div
style={{
background: "#f8fafc",
border: "1px solid #dbe3ef",
borderRadius: 14,
padding: 18,
marginBottom: 18,
boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
flexWrap: "wrap",
marginBottom: 12,
}}
>
<div>
  <div
    style={{
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 4,
    textTransform: "uppercase",
    }}
  >
    Tasks & Reminders
  </div>
  <strong>{openTasks.length} open</strong>
</div>
</div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        {QUICK_TASKS.map((taskTitle) => (
          <button
            key={taskTitle}
            type="button"
            onClick={() => createTask(taskTitle)}
            disabled={saving}
            style={{
              flex: "1 1 140px",
              minWidth: 0,
              padding: "8px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 999,
              background: "#ffffff",
              color: "#0f172a",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {taskTitle}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            if (openTasks[0]) toggleTaskStatus(openTasks[0]);
          }}
          disabled={saving || openTasks.length === 0}
          style={{
            flex: "1 1 140px",
            minWidth: 0,
            padding: "8px 10px",
            border: "1px solid #0f172a",
            borderRadius: 999,
            background: openTasks.length ? "#0f172a" : "#e5e7eb",
            color: openTasks.length ? "#ffffff" : "#64748b",
            cursor: openTasks.length ? "pointer" : "not-allowed",
            fontWeight: 700,
          }}
        >
          {openTasks.length ? "Complete Next Task" : "No Open Tasks"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
          marginBottom: 14,
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: 10,
          }}
        />

        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: 10,
          }}
        />

        <button
          type="button"
          onClick={() => createTask()}
          disabled={saving || !title.trim()}
          style={{
            padding: "10px 14px",
            border: "1px solid #0f172a",
            borderRadius: 8,
            background: saving || !title.trim() ? "#e5e7eb" : "#0f172a",
            color: saving || !title.trim() ? "#64748b" : "#ffffff",
            cursor: saving || !title.trim() ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {saving ? "Saving..." : "Add"}
        </button>
      </div>

{errorMessage && (
  <p
    style={{
    color: "#b91c1c",
    marginTop: 0,
    }}
  >
    {errorMessage}
  </p>
)}

{loading ? (
  <p>Loading tasks...</p>
) : (
  <>
    <div
      style={{
      display: "grid",
      gap: 10,
      }}
    >
      {openTasks.length === 0 ? (
        <p>No open tasks.</p>
      ) : (
        openTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggleStatus={toggleTaskStatus}
          />
        ))
      )}
    </div>

    <div
      style={{
      borderTop: "1px solid #e5e7eb",
      marginTop: 16,
      paddingTop: 14,
      }}
    >
      <strong>Completed</strong>

      <div
        style={{
        display: "grid",
        gap: 10,
        marginTop: 10,
        }}
      >
        {completedTasks.length === 0 ? (
          <p>No completed tasks.</p>
        ) : (
          completedTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleStatus={toggleTaskStatus}
            />
          ))
        )}
      </div>
    </div>
  </>
)}
</div>
);
}
