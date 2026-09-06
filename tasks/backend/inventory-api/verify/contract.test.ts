import { expect, test } from 'bun:test';

// biome-ignore lint/suspicious/noUndeclaredEnvVars: the harness sets BASE_URL when it serves the run
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4175';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function url(path: string): string {
  return `${BASE_URL}${path}`;
}

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}
interface Warehouse {
  id: string;
  code: string;
  name: string;
}
interface Product {
  id: string;
  sku: string;
  stock: number;
  reorderThreshold: number;
}

function expectFixedError(body: ErrorBody, code: string) {
  expect(body).toHaveProperty('error');
  expect(body.error).toHaveProperty('code', code);
  expect(typeof body.error.message).toBe('string');
  expect(body.error.message.length).toBeGreaterThan(0);
}

async function createWarehouse(code: string, name: string) {
  const res = await fetch(url('/warehouses'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, name }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

async function createProduct(sku: string, name: string, reorderThreshold: number) {
  const res = await fetch(url('/products'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku, name, reorderThreshold }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

async function postMovement(
  idempotencyKey: string,
  payload: { productId: string; warehouseId: string; type: string; quantity: number },
) {
  return fetch(url('/stock-movements'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
}

let warehouseA: Warehouse;
let productP1: Product;

test('create warehouse: happy path', async () => {
  warehouseA = await createWarehouse(`WH-${RUN}-A`, 'Main Warehouse');
  expect(warehouseA.id).toBeTruthy();
  expect(warehouseA.code).toBe(`WH-${RUN}-A`);
  expect(warehouseA.name).toBe('Main Warehouse');
  expect(warehouseA.createdAt).toBeTruthy();
});

test('create warehouse: validation failure returns fixed error shape', async () => {
  const res = await fetch(url('/warehouses'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'No Code Warehouse' }),
  });
  expect(res.status).toBe(400);
  expectFixedError(await res.json(), 'validation_error');
});

test('list warehouses: happy path includes the created warehouse', async () => {
  const res = await fetch(url('/warehouses?page=1&pageSize=100'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.pagination).toMatchObject({ page: 1, pageSize: 100 });
  expect(body.data.some((w: Warehouse) => w.id === warehouseA.id)).toBe(true);
});

test('create product: happy path', async () => {
  productP1 = await createProduct(`WIDGET-${RUN}-1`, 'Widget One', 5);
  expect(productP1.id).toBeTruthy();
  expect(productP1.sku).toBe(`WIDGET-${RUN}-1`);
  expect(productP1.reorderThreshold).toBe(5);
  expect(productP1.stock).toBe(0);
});

test('create product: missing sku returns fixed error shape', async () => {
  const res = await fetch(url('/products'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'No Sku', reorderThreshold: 1 }),
  });
  expect(res.status).toBe(400);
  expectFixedError(await res.json(), 'validation_error');
});

test('create product: negative reorderThreshold returns fixed error shape', async () => {
  const res = await fetch(url('/products'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: `WIDGET-${RUN}-BAD`, name: 'Bad Threshold', reorderThreshold: -1 }),
  });
  expect(res.status).toBe(400);
  expectFixedError(await res.json(), 'validation_error');
});

test('create product: duplicate sku is a conflict', async () => {
  const res = await fetch(url('/products'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: productP1.sku, name: 'Duplicate', reorderThreshold: 1 }),
  });
  expect(res.status).toBe(409);
  expectFixedError(await res.json(), 'conflict');
});

test('get product: happy path', async () => {
  const res = await fetch(url(`/products/${productP1.id}`));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(productP1.id);
  expect(body.sku).toBe(productP1.sku);
});

test('get product: unknown id returns fixed 404 error shape', async () => {
  const res = await fetch(url(`/products/${crypto.randomUUID()}`));
  expect(res.status).toBe(404);
  expectFixedError(await res.json(), 'not_found');
});

test('update product: happy path', async () => {
  const res = await fetch(url(`/products/${productP1.id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Widget One Renamed', reorderThreshold: 8 }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.name).toBe('Widget One Renamed');
  expect(body.reorderThreshold).toBe(8);
  productP1 = body;
});

test('update product: unknown id returns fixed 404 error shape', async () => {
  const res = await fetch(url(`/products/${crypto.randomUUID()}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ghost' }),
  });
  expect(res.status).toBe(404);
  expectFixedError(await res.json(), 'not_found');
});

test('update product: empty body returns fixed validation error shape', async () => {
  const res = await fetch(url(`/products/${productP1.id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  expectFixedError(await res.json(), 'validation_error');
});

test('pagination: page size limits the returned products', async () => {
  for (let i = 2; i <= 5; i++) {
    await createProduct(`WIDGET-${RUN}-${i}`, `Widget ${i}`, 1);
  }
  const res = await fetch(url('/products?page=1&pageSize=2'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBe(2);
  expect(body.pagination.page).toBe(1);
  expect(body.pagination.pageSize).toBe(2);
  expect(body.pagination.total).toBeGreaterThanOrEqual(5);
});

test('pagination: the next page returns different products', async () => {
  const first = await (await fetch(url('/products?page=1&pageSize=2'))).json();
  const second = await (await fetch(url('/products?page=2&pageSize=2'))).json();
  expect(second.data.length).toBe(2);
  const firstIds = new Set(first.data.map((p: Product) => p.id));
  for (const item of second.data) {
    expect(firstIds.has(item.id)).toBe(false);
  }
});

test('pagination: a page beyond the last returns an empty page, not an error', async () => {
  const totalRes = await (await fetch(url('/products?page=1&pageSize=1'))).json();
  const total = totalRes.pagination.total as number;
  const farPage = Math.ceil(total / 1) + 50;
  const res = await fetch(url(`/products?page=${farPage}&pageSize=1`));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toEqual([]);
  expect(body.pagination.total).toBe(total);
});

test('stock movement: happy path applies the delta', async () => {
  const res = await postMovement(`receipt-${RUN}-1`, {
    productId: productP1.id,
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 10,
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.resultingStock).toBe(10);
  expect(body.idempotencyKey).toBe(`receipt-${RUN}-1`);
});

test('stock movement: replaying the same idempotency key does not double-apply', async () => {
  const first = await (
    await postMovement(`receipt-${RUN}-1`, {
      productId: productP1.id,
      warehouseId: warehouseA.id,
      type: 'receipt',
      quantity: 10,
    })
  ).json();

  const res = await postMovement(`receipt-${RUN}-1`, {
    productId: productP1.id,
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 10,
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.id).toBe(first.id);
  expect(body.resultingStock).toBe(10);

  const product = await (await fetch(url(`/products/${productP1.id}`))).json();
  expect(product.stock).toBe(10);
});

test('stock movement: reusing an idempotency key with a different body is a conflict', async () => {
  const res = await postMovement(`receipt-${RUN}-1`, {
    productId: productP1.id,
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 999,
  });
  expect(res.status).toBe(409);
  expectFixedError(await res.json(), 'conflict');
});

test('stock movement: missing Idempotency-Key header is a validation failure', async () => {
  const res = await fetch(url('/stock-movements'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productId: productP1.id,
      warehouseId: warehouseA.id,
      type: 'receipt',
      quantity: 1,
    }),
  });
  expect(res.status).toBe(400);
  expectFixedError(await res.json(), 'validation_error');
});

test('stock movement: unknown productId returns fixed 404 error shape', async () => {
  const res = await postMovement(`receipt-${RUN}-ghost`, {
    productId: crypto.randomUUID(),
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 1,
  });
  expect(res.status).toBe(404);
  expectFixedError(await res.json(), 'not_found');
});

test('stock movement: non-positive quantity for a receipt is a validation failure', async () => {
  const res = await postMovement(`receipt-${RUN}-zero`, {
    productId: productP1.id,
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 0,
  });
  expect(res.status).toBe(400);
  expectFixedError(await res.json(), 'validation_error');
});

test('stock movement: a shipment larger than warehouse stock is a conflict', async () => {
  const res = await postMovement(`shipment-${RUN}-too-big`, {
    productId: productP1.id,
    warehouseId: warehouseA.id,
    type: 'shipment',
    quantity: 100000,
  });
  expect(res.status).toBe(409);
  expectFixedError(await res.json(), 'conflict');
});

test('low-stock report: a product pushed below its threshold appears in the report', async () => {
  const wellStocked = await createProduct(`WIDGET-${RUN}-well-stocked`, 'Well Stocked', 3);
  await postMovement(`receipt-${RUN}-well-stocked`, {
    productId: wellStocked.id,
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 5,
  });

  const lowStock = await createProduct(`WIDGET-${RUN}-low-stock`, 'Soon Low Stock', 3);
  await postMovement(`receipt-${RUN}-low-stock-in`, {
    productId: lowStock.id,
    warehouseId: warehouseA.id,
    type: 'receipt',
    quantity: 5,
  });
  await postMovement(`shipment-${RUN}-low-stock-out`, {
    productId: lowStock.id,
    warehouseId: warehouseA.id,
    type: 'shipment',
    quantity: 3,
  });

  const res = await fetch(url('/reports/low-stock?page=1&pageSize=100'));
  expect(res.status).toBe(200);
  const body = await res.json();
  const reported = body.data.find(
    (item: { productId?: string; sku?: string }) => item.productId === lowStock.id,
  );
  expect(reported).toBeTruthy();
  expect(reported.stock).toBe(2);
  expect(reported.stock).toBeLessThan(reported.reorderThreshold);
});

test('low-stock report: a well-stocked product does not appear', async () => {
  const res = await fetch(url('/reports/low-stock?page=1&pageSize=100'));
  const body = await res.json();
  const wellStockedInReport = body.data.some(
    (item: { productId?: string; sku?: string }) => item.sku === `WIDGET-${RUN}-well-stocked`,
  );
  expect(wellStockedInReport).toBe(false);
});
