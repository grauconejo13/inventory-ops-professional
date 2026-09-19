import { useEffect, useMemo, useState } from "react";
import "./App.css";

const data = [
  { id: "A1245580", name: "Metal Pallet Shelf", category: "Storage", location: "Warehouse A", quantity: 12, condition: "Good", status: "Available", cost: 1275, barcodeType: "Internal barcode", barcode: "SHELF-A-001" },
  { id: "A1245582", name: "Cargo Trolley", category: "Equipment", location: "Dispatch", quantity: 4, condition: "Excellent", status: "Available", cost: 125, barcodeType: "UPC", barcode: "012345678905" },
  { id: "A1245584", name: "Orange Crate", category: "Storage", location: "Warehouse B", quantity: 36, condition: "Good", status: "Available", cost: 40, barcodeType: "Internal barcode", barcode: "CRATE-ORANGE-01" },
  { id: "A1245585", name: "Blue Storage Bins", category: "Storage", location: "Warehouse A", quantity: 18, condition: "Fair", status: "Low stock", cost: 28, barcodeType: "EAN", barcode: "5901234123457" },
];

const blank = { name: "", category: "Equipment", location: "", quantity: 1, condition: "Good", status: "Available", cost: "", barcodeType: "Internal barcode", barcode: "", image: "" };
const blankScan = { identifier: "", quantityDelta: 1, location: "" };
const apiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const apiEnabled = Boolean(apiUrl);
const read = (key, fallback, storage = window.localStorage) => {
  try {
    return JSON.parse(storage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

const api = async (path, options = {}, token) => {
  const result = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = result.status === 204 ? null : await result.json().catch(() => null);
  if (!result.ok) {
    const error = new Error(body?.error || "The inventory service is unavailable.");
    error.code = body?.code;
    error.data = body;
    throw error;
  }
  return body;
};

const resolveLocalIdentifier = (assets, rawIdentifier) => {
  const identifier = String(rawIdentifier || "").trim();
  if (!identifier) throw new Error("Enter a barcode, UPC, or native asset ID.");

  const idMatches = assets
    .filter((asset) => asset.id.toLowerCase() === identifier.toLowerCase())
    .map((asset) => ({ asset, matchedBy: "asset-id" }));
  const barcodeMatches = assets
    .filter((asset) => asset.barcode && asset.barcode === identifier)
    .map((asset) => ({ asset, matchedBy: "barcode" }));

  const matches = [...idMatches];
  barcodeMatches.forEach((match) => {
    if (!matches.some((candidate) => candidate.asset.id === match.asset.id)) matches.push(match);
  });

  if (!matches.length) throw new Error("No asset matches that identifier.");
  if (matches.length > 1) {
    const error = new Error("Identifier collision: this value matches more than one asset.");
    error.code = "IDENTIFIER_COLLISION";
    error.data = {
      candidates: matches.map(({ asset, matchedBy }) => ({ id: asset.id, name: asset.name, matchedBy })),
    };
    throw error;
  }

  return { identifier, ...matches[0] };
};

export default function App() {
  const [assets, setAssets] = useState(() => read("inventory-ops-assets", data));
  const [events, setEvents] = useState(() => read("inventory-ops-audit", []));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All");
  const [chosen, setChosen] = useState(data[1].id);
  const [form, setForm] = useState(null);
  const [archived, setArchived] = useState(false);
  const [session, setSession] = useState(() => read("inventory-ops-session", null, window.sessionStorage));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState(blankScan);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  const reload = async (token = session?.token) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [nextAssets, audit] = await Promise.all([
        api("/api/assets", {}, token),
        api("/api/audit-events", {}, token),
      ]);
      setAssets(nextAssets);
      setEvents(
        audit.map((event) => ({
          id: event.id,
          action: event.action,
          asset: event.asset_id || "inventory record",
          time: new Date(event.created_at).toLocaleString(),
        })),
      );
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiEnabled && session?.token) reload();
  }, [session]);

  useEffect(() => {
    if (!apiEnabled) window.localStorage.setItem("inventory-ops-assets", JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    if (!apiEnabled) window.localStorage.setItem("inventory-ops-audit", JSON.stringify(events));
  }, [events]);

  const list = useMemo(
    () =>
      assets.filter(
        (item) =>
          (kind === "All" || item.category === kind) &&
          (archived ? item.status === "Archived" : item.status !== "Archived") &&
          (item.name + item.id + item.location + (item.barcode || "")).toLowerCase().includes(query.toLowerCase()),
      ),
    [assets, kind, archived, query],
  );

  const selected = assets.find((item) => item.id === chosen) || list[0];
  const localEvent = (action, asset) =>
    setEvents((current) => [{ id: crypto.randomUUID(), action, asset, time: new Date().toLocaleString() }, ...current]);

  const openForm = (item = blank) => {
    if (apiEnabled && !session) setAuthOpen(true);
    else setForm(item);
  };

  const update = (key, value) => setForm({ ...form, [key]: value });

  const validateLocalIdentifier = (payload) => {
    const barcode = String(payload.barcode || "").trim();
    if (!barcode) return;
    const duplicateBarcode = assets.find((asset) => asset.id !== payload.id && asset.barcode === barcode);
    if (duplicateBarcode) throw new Error(`That barcode is already attached to ${duplicateBarcode.id}.`);
    const nativeCollision = assets.find(
      (asset) => asset.id !== payload.id && asset.id.toLowerCase() === barcode.toLowerCase(),
    );
    if (nativeCollision) throw new Error(`Barcode collides with native asset ID ${nativeCollision.id}.`);
  };

  const save = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      barcode: String(form.barcode || "").trim(),
      quantity: Number(form.quantity),
      cost: Number(form.cost),
    };
    try {
      if (apiEnabled) {
        const saved = form.id
          ? await api(`/api/assets/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) }, session.token)
          : await api("/api/assets", { method: "POST", body: JSON.stringify(payload) }, session.token);
        setChosen(saved.id);
        await reload();
      } else if (form.id) {
        validateLocalIdentifier(payload);
        setAssets(assets.map((item) => (item.id === form.id ? payload : item)));
        localEvent("Updated", form.name);
      } else {
        const item = { ...payload, id: "A" + (1245590 + assets.length) };
        validateLocalIdentifier(item);
        const reverseCollision = assets.find((asset) => asset.barcode === item.id);
        if (reverseCollision) throw new Error(`New native asset ID collides with barcode on ${reverseCollision.id}.`);
        setAssets([...assets, item]);
        setChosen(item.id);
        localEvent("Created", item.name);
      }
      setForm(null);
    } catch (reason) {
      setError(reason.message);
    }
  };

  const archive = async () => {
    try {
      if (apiEnabled) {
        await api(`/api/assets/${selected.id}/archive`, { method: "POST" }, session.token);
        await reload();
      } else {
        setAssets(assets.map((item) => (item.id === selected.id ? { ...item, status: "Archived" } : item)));
        localEvent("Archived", selected.name);
      }
      setChosen("");
    } catch (reason) {
      setError(reason.message);
    }
  };

  const resolveScan = async (event) => {
    event?.preventDefault();
    if (apiEnabled && !session) {
      setAuthOpen(true);
      return;
    }

    setScanBusy(true);
    setScanError("");
    setScanResult(null);
    try {
      const resolved = apiEnabled
        ? await api("/api/scans/resolve", { method: "POST", body: JSON.stringify({ identifier: scan.identifier }) }, session.token)
        : resolveLocalIdentifier(assets, scan.identifier);

      const nextResult = apiEnabled
        ? resolved
        : { identifier: resolved.identifier, matchedBy: resolved.matchedBy, asset: resolved.asset };
      setScanResult(nextResult);
      setChosen(nextResult.asset.id);
      setArchived(nextResult.asset.status === "Archived");
      setScan((current) => ({ ...current, location: nextResult.asset.location }));
    } catch (reason) {
      setScanError(reason.message);
      if (reason.data?.candidates) {
        setScanResult({ collision: true, candidates: reason.data.candidates, identifier: scan.identifier });
      }
    } finally {
      setScanBusy(false);
    }
  };

  const applyScan = async () => {
    if (!scanResult?.asset) return;
    setScanBusy(true);
    setScanError("");

    try {
      const quantityDelta = Number(scan.quantityDelta || 0);
      if (!Number.isInteger(quantityDelta)) throw new Error("Quantity adjustment must be a whole number.");

      if (apiEnabled) {
        const result = await api(
          "/api/scans/adjust",
          {
            method: "POST",
            body: JSON.stringify({
              identifier: scan.identifier,
              quantityDelta,
              location: scan.location,
            }),
          },
          session.token,
        );
        setScanResult(result);
        setChosen(result.asset.id);
        await reload();
      } else {
        const resolved = resolveLocalIdentifier(assets, scan.identifier);
        const nextQuantity = Number(resolved.asset.quantity) + quantityDelta;
        if (nextQuantity < 0) throw new Error(`Adjustment would reduce quantity below zero. Current quantity is ${resolved.asset.quantity}.`);
        const nextLocation = String(scan.location || "").trim() || resolved.asset.location;
        if (quantityDelta === 0 && nextLocation === resolved.asset.location) {
          throw new Error("Provide a quantity adjustment, a new location, or both.");
        }

        const updated = { ...resolved.asset, quantity: nextQuantity, location: nextLocation };
        setAssets((current) => current.map((asset) => (asset.id === updated.id ? updated : asset)));
        localEvent("Scan adjusted", `${updated.id} · qty ${quantityDelta >= 0 ? "+" : ""}${quantityDelta} · ${nextLocation}`);
        setScanResult({ identifier: resolved.identifier, matchedBy: resolved.matchedBy, asset: updated });
      }
      setScan((current) => ({ ...current, quantityDelta: 1 }));
    } catch (reason) {
      setScanError(reason.message);
      if (reason.data?.candidates) {
        setScanResult({ collision: true, candidates: reason.data.candidates, identifier: scan.identifier });
      }
    } finally {
      setScanBusy(false);
    }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const endpoint = authMode === "register" ? "register" : "login";
      const body = authMode === "register" ? auth : { email: auth.email, password: auth.password };
      const next = await api(`/api/auth/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
      window.sessionStorage.setItem("inventory-ops-session", JSON.stringify(next));
      setSession(next);
      setAuthOpen(false);
    } catch (reason) {
      setError(reason.message);
    }
  };

  const signOut = () => {
    window.sessionStorage.removeItem("inventory-ops-session");
    setSession(null);
    setAssets(data);
    setEvents([]);
    setScanResult(null);
  };

  const canArchive = !apiEnabled || session?.user?.role === "admin";

  return (
    <div className="app">
      <aside>
        <b>IO</b>
        <a className="active" href="#inventory">▦</a>
        <a href="#activity">◴</a>
        <a href="#settings">⚙</a>
      </aside>

      <nav>
        <h2>◉ inventory<br /><strong>ops</strong></h2>
        <small>OPERATIONS WORKSPACE</small>
        <input placeholder="Search navigation" />
        <p>COLLECTIONS</p>
        <a className="chosen" href="#inventory">● Inventory</a>
        <a href="#people">● People</a>
        <a href="#locations">● Locations</a>
        <p>SAVED VIEWS</p>
        <button onClick={() => setArchived(false)}>Active inventory</button>
        <button onClick={() => setArchived(true)}>Archived assets</button>
        <button className="create nav-create" onClick={() => openForm()}>Create ＋</button>
      </nav>

      <main id="inventory">
        <header>
          Home <span>/</span> Inventory
          <div className="session-control">
            <span className={apiEnabled ? "mode live" : "mode"}>{apiEnabled ? "LIVE API" : "DEMO MODE"}</span>
            {apiEnabled &&
              (session ? (
                <button className="plain-button" onClick={signOut}>Sign out</button>
              ) : (
                <button className="plain-button" onClick={() => setAuthOpen(true)}>Sign in</button>
              ))}
            <button className="create" onClick={() => openForm()}>＋ Add asset</button>
          </div>
        </header>

        <section className="intro">
          <div>
            <small>ASSET MANAGEMENT</small>
            <h1>Inventory</h1>
            <p>Keep every tool, supply, and storage item visible.</p>
          </div>
        </section>

        {apiEnabled && !session && (
          <section className="notice">
            <b>Sign in to the live workspace.</b> You can still browse the local portfolio demo.{" "}
            <button onClick={() => setAuthOpen(true)}>Sign in</button>
          </section>
        )}

        {error && (
          <section className="notice error">
            <b>Inventory service issue.</b> {error} {session && <button onClick={() => reload()}>Try again</button>}
          </section>
        )}

        <ScannerPanel
          scan={scan}
          setScan={setScan}
          result={scanResult}
          error={scanError}
          busy={scanBusy}
          resolve={resolveScan}
          apply={applyScan}
          locked={apiEnabled && !session}
        />

        <section className="filters">
          <label>⌕
            <input
              aria-label="Search assets"
              placeholder="Search assets, IDs, or locations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select aria-label="Category" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option>All</option>
            <option>Equipment</option>
            <option>Storage</option>
          </select>
          <button className={!archived ? "tab" : ""} onClick={() => setArchived(false)}>Active</button>
          <button className={archived ? "tab" : ""} onClick={() => setArchived(true)}>Archived</button>
        </section>

        <p className="summary"><b>{loading ? "…" : list.length}</b> {archived ? "archived records" : "assets in inventory"}</p>

        <section className="table">
          <div className="thead">
            <span>ASSET</span><span>LOCATION</span><span>CATEGORY</span><span>QTY</span><span>STATUS</span>
          </div>
          {list.length ? (
            list.map((item) => (
              <button
                className={`row ${selected?.id === item.id ? "selected" : ""}`}
                key={item.id}
                onClick={() => setChosen(item.id)}
              >
                <b className={item.category.toLowerCase()}>{item.category === "Storage" ? "▦" : "♙"}</b>
                <span><strong>{item.name}</strong><small>{item.id}</small></span>
                <span>{item.location}</span>
                <span>{item.category}</span>
                <span>{item.quantity}</span>
                <em className={item.status.toLowerCase().replace(" ", "-")}>{item.status}</em>
              </button>
            ))
          ) : (
            <div className="empty">{loading ? "Loading inventory…" : "No assets found."}</div>
          )}
        </section>

        {selected && (
          <section className="details">
            {selected.image && <img className="asset-photo" src={selected.image} alt={selected.name} />}
            <b className={selected.category.toLowerCase()}>{selected.category === "Storage" ? "▦" : "♙"}</b>
            <div>
              <small>SELECTED ASSET</small>
              <h2>{selected.name}</h2>
              <p>{selected.id} · {selected.category} · {selected.location}</p>
              <p>{selected.barcode ? `${selected.barcodeType}: ${selected.barcode}` : "No scannable code attached"}</p>
            </div>
            <dl>
              <div><dt>QUANTITY</dt><dd>{selected.quantity}</dd></div>
              <div><dt>CONDITION</dt><dd>{selected.condition}</dd></div>
              <div><dt>UNIT COST</dt><dd>{"$" + selected.cost.toLocaleString()}</dd></div>
            </dl>
            {selected.status !== "Archived" && (
              <div>
                <button onClick={() => openForm(selected)}>Edit</button>
                {canArchive && <button className="danger" onClick={archive}>Archive</button>}
              </div>
            )}
          </section>
        )}

        <section className="audit" id="activity" aria-labelledby="audit-title">
          <div>
            <small>{apiEnabled ? "SERVER AUDIT TRAIL" : "LOCAL AUDIT TRAIL"}</small>
            <h2 id="audit-title">Recent activity</h2>
          </div>
          {events.length ? (
            <ol>
              {events.slice(0, 5).map((event) => (
                <li key={event.id}><b>{event.action}</b> {event.asset}<time>{event.time}</time></li>
              ))}
            </ol>
          ) : (
            <p>{apiEnabled && session ? "Server changes will appear here." : "Changes made in this browser will be recorded here."}</p>
          )}
        </section>
      </main>

      {form && <AssetForm form={form} update={update} save={save} close={() => setForm(null)} />}
      {authOpen && (
        <AuthForm
          mode={authMode}
          setMode={setAuthMode}
          form={auth}
          setForm={setAuth}
          submit={submitAuth}
          error={error}
          close={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
}

function ScannerPanel({ scan, setScan, result, error, busy, resolve, apply, locked }) {
  return (
    <section className="scanner" aria-labelledby="scanner-title">
      <div className="scanner-heading">
        <div>
          <small>SCAN / IDENTIFIER WORKFLOW</small>
          <h2 id="scanner-title">Receive, move, or adjust inventory</h2>
          <p>Use a hardware scanner, paste a UPC/barcode, or enter the native asset ID.</p>
        </div>
        <span className="scanner-badge">ID ≠ UPC</span>
      </div>

      <form className="scanner-lookup" onSubmit={resolve}>
        <label>
          Identifier
          <input
            aria-label="Scan identifier"
            autoComplete="off"
            placeholder="Scan or enter ID / UPC / barcode"
            value={scan.identifier}
            onChange={(event) => {
              setScan({ ...scan, identifier: event.target.value });
            }}
          />
        </label>
        <button className="create" type="submit" disabled={busy}>
          {busy ? "Checking…" : locked ? "Sign in to scan" : "Lookup"}
        </button>
      </form>

      {error && <p className="scanner-error">{error}</p>}

      {result?.collision && (
        <div className="scan-collision" role="alert">
          <b>Manual resolution required.</b>
          <p>The scanned value is ambiguous, so no inventory change was made.</p>
          <ul>
            {result.candidates.map((candidate) => (
              <li key={candidate.id}>
                <strong>{candidate.id}</strong> · {candidate.name} · matched by {candidate.matchedBy}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.asset && (
        <div className="scan-result">
          <div>
            <small>MATCHED BY {result.matchedBy === "asset-id" ? "NATIVE ASSET ID" : "SCANNABLE CODE"}</small>
            <h3>{result.asset.name}</h3>
            <p>{result.asset.id} · {result.asset.location} · current quantity {result.asset.quantity}</p>
          </div>
          <div className="scan-adjustments">
            <label>
              Quantity +/−
              <input
                aria-label="Quantity adjustment"
                type="number"
                step="1"
                value={scan.quantityDelta}
                onChange={(event) => setScan({ ...scan, quantityDelta: event.target.value })}
              />
            </label>
            <label>
              Move to location
              <input
                aria-label="Scan location"
                value={scan.location}
                onChange={(event) => setScan({ ...scan, location: event.target.value })}
                placeholder={result.asset.location}
              />
            </label>
            <button className="create" type="button" disabled={busy} onClick={apply}>
              Apply scanned update
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AssetForm({ form, update, save, close }) {
  return (
    <div className="overlay">
      <form className="modal" onSubmit={save}>
        <button className="close" type="button" onClick={close}>×</button>
        <small>{form.id ? "EDIT RECORD" : "NEW RECORD"}</small>
        <h2>{form.id ? "Edit asset" : "Add an asset"}</h2>
        <div className="form">
          <label>Name<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)}><option>Equipment</option><option>Storage</option></select></label>
          <label>Location<input required value={form.location} onChange={(event) => update("location", event.target.value)} /></label>
          <label>Quantity<input required type="number" min="0" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></label>
          <label>Condition<select value={form.condition} onChange={(event) => update("condition", event.target.value)}><option>Excellent</option><option>Good</option><option>Fair</option></select></label>
          <label>Status<select value={form.status} onChange={(event) => update("status", event.target.value)}><option>Available</option><option>In use</option><option>Low stock</option></select></label>
          <label>Unit cost<input required type="number" min="0" value={form.cost} onChange={(event) => update("cost", event.target.value)} /></label>
          <label>Scannable code type<select value={form.barcodeType || "Internal barcode"} onChange={(event) => update("barcodeType", event.target.value)}><option>Internal barcode</option><option>UPC</option><option>EAN</option><option>QR</option></select></label>
          <label>Scannable code<input value={form.barcode || ""} onChange={(event) => update("barcode", event.target.value)} placeholder="Optional code" /></label>
          <label>Asset image URL<input type="url" value={form.image || ""} onChange={(event) => update("image", event.target.value)} placeholder="Optional image URL" /></label>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={close}>Cancel</button>
          <button className="create" type="submit">Save asset</button>
        </div>
      </form>
    </div>
  );
}

function AuthForm({ mode, setMode, form, setForm, submit, error, close }) {
  const registering = mode === "register";
  return (
    <div className="overlay">
      <form className="modal auth-modal" onSubmit={submit}>
        <button className="close" type="button" onClick={close}>×</button>
        <small>SECURE WORKSPACE</small>
        <h2>{registering ? "Create staff account" : "Sign in"}</h2>
        <p>Use the shared inventory service from any signed-in device.</p>
        <div className="form auth-form">
          {registering && <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input required type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={() => setMode(registering ? "login" : "register")}>
            {registering ? "I already have an account" : "Create account"}
          </button>
          <button className="create" type="submit">{registering ? "Create account" : "Sign in"}</button>
        </div>
      </form>
    </div>
  );
}
