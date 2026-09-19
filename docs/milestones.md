# Build Milestones

Each milestone must pass linting, build checks, and the relevant Playwright tests before the next one begins.

## 0. Project foundation — complete

- Initial README, Git ignore rules, architecture, and milestone plan.
- No application scaffold or dependencies yet.

## 1. Inventory list interface

- Responsive desktop table and mobile card view.
- Seeded demo assets with safe placeholder images.
- Search and category filters.
- Playwright smoke tests for page rendering, search, filters, and mobile layout.

## 2. Asset details and create flow

- Asset detail view.
- Validated create-asset form.
- Front-end state for added assets.
- Playwright tests for form validation and successful creation.

## 3. Edit and archive flow

- Update quantity, condition, status, and location.
- Archive confirmation and archived-items view.
- Playwright tests for update and archive behavior.

## 4. Data-backed CRUD — complete (browser demo)

- Select API, database, and authentication approach.
- Persist assets, categories, locations, and audit events.
- Add server and end-to-end test coverage.

## 5. Images and scanning — complete (URL + code metadata)

- Upload asset images.
- Support a separate internal asset code plus optional UPC/barcode.
- Add scanning and validation rules without confusing native IDs with UPCs.

## 6. Polish and deployment — pending

- Accessibility review.
- Empty, loading, and error states.
- Production build, deployment, and final Playwright regression pass.

## 7. Backend foundation — complete (local API)

- Express API with SQLite persistence, seeded inventory, and an audit-event table.
- Registration, login, signed sessions, and staff/admin authorization rules.
- Authenticated asset CRUD contract and admin-only archive endpoint.
- Environment-template and database exclusion rules for safe local development.

## 8. App/API integration and sign-in — complete

- Session-based sign-in and registration interface for the connected workspace.
- Authenticated asset and audit-log requests with a visible demo-mode fallback.
- Loading, authorization, service-error, and retry states.
- Role-aware archive control: the API and interface reserve archiving for administrators.


## 9. Scan and identifier operations — complete

- Resolve native asset IDs and scannable codes through one authenticated scan endpoint.
- Keep native IDs and UPC/barcodes as separate identifier namespaces and reject unsafe cross-namespace collisions.
- Stop ambiguous scans with a 409 collision response and candidate list instead of guessing which asset to update.
- Apply whole-number quantity adjustments and optional location moves from the scan workflow.
- Reject changes that would drive inventory below zero.
- Record every scan-based inventory mutation as a `scan_adjusted` audit event with the matched identifier, before/after quantity, and before/after location.
- Provide the same workflow in portfolio demo mode with seeded scan-ready assets and Playwright coverage.
