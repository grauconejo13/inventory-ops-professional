# Inventory Ops Professional

A responsive inventory and equipment-management application for tracking assets, quantities, categories, locations, condition, and audit history.

## Project goals

- Give staff a clear mobile-friendly inventory view.
- Let authorized users create, view, update, archive, and search assets.
- Maintain a trustworthy change history for each asset.
- Support asset photos and scannable identifiers in later milestones.

## Documentation

- [Architecture](docs/architecture.md)
- [Milestones](docs/milestones.md)

## Status

The portfolio demo now includes browser-backed CRUD, audit history, scan-ready identifiers, collision-safe barcode/native-ID resolution, and scan-driven quantity/location updates. The local Express + SQLite backend provides authenticated asset, audit, and scan routes.

## Run the API locally

```bash
npm install
cp .env.example .env
npm run dev:api
```

The API starts at `http://localhost:4000`. Create a staff account with `POST /api/auth/register`, then send its returned JWT as `Authorization: Bearer <token>` to use the inventory endpoints.

## Run the connected workspace

In a second terminal, keep `npm run dev:api` running. Then start the React app with:

```bash
VITE_API_URL=http://localhost:4000 npm run dev
```

Without `VITE_API_URL`, the portfolio preview remains in safe demo mode with browser-only data.


## Scan workflow

With the live API enabled, sign in and use the scan panel to enter a native asset ID, UPC, EAN, QR value, or internal barcode. A lookup must resolve to exactly one asset before inventory can change. Staff can then apply an integer quantity adjustment, move the asset to another location, or do both in one audited operation.

Fresh databases include demonstration identifiers such as `A1245582` and UPC `012345678905`. Existing local databases keep their current records; attach a barcode through the asset editor if needed.
