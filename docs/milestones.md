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

## 4. Data-backed CRUD

- Select API, database, and authentication approach.
- Persist assets, categories, locations, and audit events.
- Add server and end-to-end test coverage.

## 5. Images and scanning

- Upload asset images.
- Support a separate internal asset code plus optional UPC/barcode.
- Add scanning and validation rules without confusing native IDs with UPCs.

## 6. Polish and deployment

- Accessibility review.
- Empty, loading, and error states.
- Production build, deployment, and final Playwright regression pass.
