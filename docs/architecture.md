# Architecture

## Overview

Inventory Ops Professional is a responsive inventory and asset-management application. It begins with a focused CRUD workflow and can grow to include image storage, barcode/UPC scanning, roles, and maintenance history.

```mermaid
flowchart TD
  U["Staff or Admin"] --> W["Web or Mobile App"]
  W --> A["Inventory API"]
  A --> AU["Authentication and Roles"]
  A --> I["Inventory Service"]
  I --> DB[("Database")]
  I --> FS["Image Storage"]
  DB --> T["Assets, Categories, Locations, Users, Audit Logs"]
```

## Core entities

- **Asset** — internal asset ID, name, category, quantity, condition, status, location, optional image, and optional barcode/UPC.
- **Category** — a grouping such as Equipment or Storage.
- **Location** — the asset's current storage or work location.
- **User** — an authenticated staff member or administrator.
- **Audit log** — a timestamped record of asset changes and the user who made them.

## CRUD rules

- **Create:** authorized users add an asset and optionally attach an image.
- **Read:** staff search, filter, and view asset details.
- **Update:** authorized users adjust quantity, condition, status, or location.
- **Archive:** assets are archived rather than permanently deleted to preserve history.

## Phase 7 backend foundation

- **API:** Express REST API with `/api/auth`, `/api/assets`, and `/api/audit-events` endpoints.
- **Database:** SQLite for a zero-setup local data foundation. Assets, users, and audit events are separate records; PostgreSQL can replace SQLite at deployment without changing the API contract.
- **Authentication:** bcrypt password hashes and signed JWT sessions. Staff can create/update assets; only administrators can archive records.
- **Integrity:** The native asset ID remains the primary key. An optional barcode/UPC is a separate, unique lookup value, never the record’s identity.

## Technology direction

The React front end can connect to the Express API through `VITE_API_URL`; without it, it deliberately remains in portfolio demo mode. Image storage is intentionally deferred until a hosted storage provider is selected.


## Scan and identifier workflow

Scanning is an operational lookup layer, not a second asset identity system.

- `POST /api/scans/resolve` accepts a scanner value and resolves it against the native asset ID namespace and the barcode/UPC namespace.
- If the same value points at two different records, the API returns `409 IDENTIFIER_COLLISION` with candidates and performs no mutation.
- `POST /api/scans/adjust` repeats the safe resolution, then applies an integer quantity delta and/or a location move.
- Quantity cannot fall below zero.
- Barcode writes are checked against both existing barcodes and native asset IDs. Native IDs are likewise checked against existing barcode values when new assets are created.
- Successful scan mutations emit a `scan_adjusted` audit event that preserves the scanned identifier, match type, quantity transition, and location transition.

This lets keyboard-wedge USB/Bluetooth scanners work with the same text field as manually entered IDs while preserving a clean distinction between the application's native record key and external product identifiers.
