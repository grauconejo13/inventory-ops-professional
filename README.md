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

The portfolio demo is complete through browser-backed CRUD, audit history, barcode metadata, and image URLs. Phase 7 adds a local Express + SQLite backend foundation with authenticated API routes.

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
