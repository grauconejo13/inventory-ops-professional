import { useEffect, useMemo, useState } from "react";
import "./App.css";

const data = [
  {
    id: "A1245580",
    name: "Metal Pallet Shelf",
    category: "Storage",
    location: "Warehouse A",
    quantity: 12,
    condition: "Good",
    status: "Available",
    cost: 1275,
  },
  {
    id: "A1245582",
    name: "Cargo Trolley",
    category: "Equipment",
    location: "Dispatch",
    quantity: 4,
    condition: "Excellent",
    status: "Available",
    cost: 125,
  },
  {
    id: "A1245584",
    name: "Orange Crate",
    category: "Storage",
    location: "Warehouse B",
    quantity: 36,
    condition: "Good",
    status: "Available",
    cost: 40,
  },
  {
    id: "A1245585",
    name: "Blue Storage Bins",
    category: "Storage",
    location: "Warehouse A",
    quantity: 18,
    condition: "Fair",
    status: "Low stock",
    cost: 28,
  },
];
const blank = {
  name: "",
  category: "Equipment",
  location: "",
  quantity: 1,
  condition: "Good",
  status: "Available",
  cost: "",
  barcodeType: "Internal barcode",
  barcode: "",
  image: "",
};
const readStored = (key, fallback) => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [assets, setAssets] = useState(() =>
    readStored("inventory-ops-assets", data),
  );
  const [events, setEvents] = useState(() =>
    readStored("inventory-ops-audit", []),
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All");
  const [chosen, setChosen] = useState(data[1].id);
  const [form, setForm] = useState(null);
  const [archived, setArchived] = useState(false);
  useEffect(
    () =>
      window.localStorage.setItem(
        "inventory-ops-assets",
        JSON.stringify(assets),
      ),
    [assets],
  );
  useEffect(
    () =>
      window.localStorage.setItem(
        "inventory-ops-audit",
        JSON.stringify(events),
      ),
    [events],
  );
  const list = useMemo(
    () =>
      assets.filter(
        (item) =>
          (kind === "All" || item.category === kind) &&
          (archived
            ? item.status === "Archived"
            : item.status !== "Archived") &&
          (item.name + item.id + item.location + (item.barcode || ""))
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [assets, kind, archived, query],
  );
  const selected = assets.find((item) => item.id === chosen) || list[0];
  const update = (key, value) => setForm({ ...form, [key]: value });
  const save = (event) => {
    event.preventDefault();
    if (form.id) {
      setAssets(
        assets.map((item) =>
          item.id === form.id
            ? {
                ...form,
                quantity: Number(form.quantity),
                cost: Number(form.cost),
              }
            : item,
        ),
      );
      setEvents([
        {
          id: crypto.randomUUID(),
          action: "Updated",
          asset: form.name,
          time: new Date().toLocaleString(),
        },
        ...events,
      ]);
    } else {
      const item = {
        ...form,
        id: "A" + (1245590 + assets.length),
        quantity: Number(form.quantity),
        cost: Number(form.cost),
      };
      setAssets([...assets, item]);
      setChosen(item.id);
      setEvents([
        {
          id: crypto.randomUUID(),
          action: "Created",
          asset: item.name,
          time: new Date().toLocaleString(),
        },
        ...events,
      ]);
    }
    setForm(null);
  };
  const archive = () => {
    setAssets(
      assets.map((item) =>
        item.id === selected.id ? { ...item, status: "Archived" } : item,
      ),
    );
    setEvents([
      {
        id: crypto.randomUUID(),
        action: "Archived",
        asset: selected.name,
        time: new Date().toLocaleString(),
      },
      ...events,
    ]);
    setChosen("");
  };
  return (
    <div className="app">
      <aside>
        <b>IO</b>
        <a className="active" href="#inventory">
          ▦
        </a>
        <a href="#activity">◴</a>
        <a href="#settings">⚙</a>
      </aside>
      <nav>
        <h2>
          ◉ inventory
          <br />
          <strong>ops</strong>
        </h2>
        <small>OPERATIONS WORKSPACE</small>
        <input placeholder="Search navigation" />
        <p>COLLECTIONS</p>
        <a className="chosen" href="#inventory">
          ● Inventory
        </a>
        <a href="#people">● People</a>
        <a href="#locations">● Locations</a>
        <p>SAVED VIEWS</p>
        <button onClick={() => setArchived(false)}>Active inventory</button>
        <button onClick={() => setArchived(true)}>Archived assets</button>
        <button className="create nav-create" onClick={() => setForm(blank)}>
          Create ＋
        </button>
      </nav>
      <main id="inventory">
        <header>
          Home <span>/</span> Inventory{" "}
          <button className="create" onClick={() => setForm(blank)}>
            ＋ Add asset
          </button>
        </header>
        <section className="intro">
          <div>
            <small>ASSET MANAGEMENT</small>
            <h1>Inventory</h1>
            <p>Keep every tool, supply, and storage item visible.</p>
          </div>
        </section>
        <section className="filters">
          <label>
            ⌕
            <input
              aria-label="Search assets"
              placeholder="Search assets, IDs, or locations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Category"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option>All</option>
            <option>Equipment</option>
            <option>Storage</option>
          </select>
          <button
            className={!archived ? "tab" : ""}
            onClick={() => setArchived(false)}
          >
            Active
          </button>
          <button
            className={archived ? "tab" : ""}
            onClick={() => setArchived(true)}
          >
            Archived
          </button>
        </section>
        <p className="summary">
          <b>{list.length}</b>{" "}
          {archived ? "archived records" : "assets in inventory"}
        </p>
        <section className="table">
          <div className="thead">
            <span>ASSET</span>
            <span>LOCATION</span>
            <span>CATEGORY</span>
            <span>QTY</span>
            <span>STATUS</span>
          </div>
          {list.length ? (
            list.map((item) => (
              <button
                className={
                  "row " +
                  (selected && selected.id === item.id ? "selected" : "")
                }
                key={item.id}
                onClick={() => setChosen(item.id)}
              >
                <b className={item.category.toLowerCase()}>
                  {item.category === "Storage" ? "▦" : "♙"}
                </b>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.id}</small>
                </span>
                <span>{item.location}</span>
                <span>{item.category}</span>
                <span>{item.quantity}</span>
                <em className={item.status.toLowerCase().replace(" ", "-")}>
                  {item.status}
                </em>
              </button>
            ))
          ) : (
            <div className="empty">No assets found.</div>
          )}
        </section>
        {selected && (
          <section className="details">
            {selected.image && (
              <img
                className="asset-photo"
                src={selected.image}
                alt={selected.name}
              />
            )}
            <b className={selected.category.toLowerCase()}>
              {selected.category === "Storage" ? "▦" : "♙"}
            </b>
            <div>
              <small>SELECTED ASSET</small>
              <h2>{selected.name}</h2>
              <p>
                {selected.id} · {selected.category} · {selected.location}
              </p>
              <p>
                {selected.barcode
                  ? selected.barcodeType + ": " + selected.barcode
                  : "No scannable code attached"}
              </p>
            </div>
            <dl>
              <div>
                <dt>QUANTITY</dt>
                <dd>{selected.quantity}</dd>
              </div>
              <div>
                <dt>CONDITION</dt>
                <dd>{selected.condition}</dd>
              </div>
              <div>
                <dt>UNIT COST</dt>
                <dd>{"$" + selected.cost.toLocaleString()}</dd>
              </div>
            </dl>
            {selected.status !== "Archived" && (
              <div>
                <button onClick={() => setForm(selected)}>Edit</button>
                <button className="danger" onClick={archive}>
                  Archive
                </button>
              </div>
            )}
          </section>
        )}
        <section className="audit" aria-labelledby="audit-title">
          <div>
            <small>LOCAL AUDIT TRAIL</small>
            <h2 id="audit-title">Recent activity</h2>
          </div>
          {events.length ? (
            <ol>
              {events.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <b>{event.action}</b> {event.asset}
                  <time>{event.time}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p>Changes made in this browser will be recorded here.</p>
          )}
        </section>
      </main>
      {form && (
        <div className="overlay">
          <form className="modal" onSubmit={save}>
            <button
              className="close"
              type="button"
              onClick={() => setForm(null)}
            >
              ×
            </button>
            <small>{form.id ? "EDIT RECORD" : "NEW RECORD"}</small>
            <h2>{form.id ? "Edit asset" : "Add an asset"}</h2>
            <div className="form">
              <label>
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  <option>Equipment</option>
                  <option>Storage</option>
                </select>
              </label>
              <label>
                Location
                <input
                  required
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </label>
              <label>
                Quantity
                <input
                  required
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                />
              </label>
              <label>
                Condition
                <select
                  value={form.condition}
                  onChange={(e) => update("condition", e.target.value)}
                >
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option>Available</option>
                  <option>In use</option>
                  <option>Low stock</option>
                </select>
              </label>
              <label>
                Unit cost
                <input
                  required
                  type="number"
                  min="0"
                  value={form.cost}
                  onChange={(e) => update("cost", e.target.value)}
                />
              </label>
              <label>
                Scannable code type
                <select
                  value={form.barcodeType || "Internal barcode"}
                  onChange={(e) => update("barcodeType", e.target.value)}
                >
                  <option>Internal barcode</option>
                  <option>UPC</option>
                  <option>EAN</option>
                  <option>QR</option>
                </select>
              </label>
              <label>
                Scannable code
                <input
                  value={form.barcode || ""}
                  onChange={(e) => update("barcode", e.target.value)}
                  placeholder="Optional code"
                />
              </label>
              <label>
                Asset image URL
                <input
                  type="url"
                  value={form.image || ""}
                  onChange={(e) => update("image", e.target.value)}
                  placeholder="Optional image URL"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="create" type="submit">
                Save asset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
