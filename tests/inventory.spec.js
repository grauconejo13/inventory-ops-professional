import { test, expect } from '@playwright/test'

test('search and category filtering update the inventory list', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()
  await page.getByLabel('Search assets').fill('Cargo')
  await expect(page.getByText('Cargo Trolley')).toBeVisible()
  await expect(page.getByText('Orange Crate')).not.toBeVisible()
  await page.getByLabel('Search assets').fill('')
  await page.getByLabel('Category').selectOption('Storage')
  await expect(page.getByText('Orange Crate')).toBeVisible()
  await expect(page.getByText('Cargo Trolley')).not.toBeVisible()
})

test('staff can create, update, and archive an asset', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /add asset/i }).click()
  await page.getByLabel('Name').fill('Safety Cone')
  await page.getByLabel('Location').fill('Loading Bay')
  await page.getByLabel('Quantity').fill('8')
  await page.getByLabel('Unit cost').fill('16')
  await page.getByRole('button', { name: 'Save asset' }).click()
  await expect(page.getByText('Safety Cone')).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Quantity').fill('10')
  await page.getByRole('button', { name: 'Save asset' }).click()
  await expect(page.getByText('10', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Safety Cone')).not.toBeVisible()
  await page.getByRole('button', { name: 'Archived' }).click()
  await expect(page.getByText('Safety Cone')).toBeVisible()
})

test('mobile inventory is usable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /add asset/i })).toBeVisible()
  await expect(page.getByText('Cargo Trolley')).toBeVisible()
})
