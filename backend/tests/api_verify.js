/**
 * NeoLibrary API Verification Script — ASCII output only
 * Run: node tests/api_verify.js
 */
const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}/api`;

async function req(path, opts = {}) {
  const { headers: extraHeaders, ...restOpts } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...restOpts,
    headers: { 'Content-Type': 'application/json', 'Connection': 'close', ...(extraHeaders || {}) }
  });
  let body;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, ok: res.ok, body };
}

const pass = (msg) => console.log('  PASS: ' + msg);
const fail = (msg) => { console.log('  FAIL: ' + msg); process.exitCode = 1; };
const section = (title) => console.log('\n--- ' + title + ' ---');

async function verify() {
  console.log('================================================');
  console.log('   NeoLibrary Backend API Verification Suite    ');
  console.log('================================================');

  let adminToken = '', patronToken = '', bookId = '', borrowId = '';

  // 1. Admin Login
  section('1. Admin Auth');
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@library.com', password: 'admin123' })
  });
  if (adminLogin.status === 200 && adminLogin.body?.data?.token) {
    adminToken = adminLogin.body.data.token;
    pass('Admin login OK  (role: ' + adminLogin.body.data.user.role + ')');
  } else {
    fail('Admin login failed: ' + JSON.stringify(adminLogin.body));
    return;
  }

  const me = await req('/auth/me', { headers: { Authorization: 'Bearer ' + adminToken } });
  me.ok ? pass('/auth/me returned profile for ' + me.body?.data?.full_name) : fail('/auth/me: ' + JSON.stringify(me.body));

  // 2. Patron Registration
  section('2. Patron Registration & Login');
  const email = 'verify_' + Date.now() + '@test.com';
  const reg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'Test1234!', full_name: 'Verify User', phone: '08012345678', address: '1 Test St' })
  });
  if (reg.status === 201 && reg.body?.data?.token) {
    patronToken = reg.body.data.token;
    pass('Patron registered (id: ' + reg.body.data.user.id.slice(0, 8) + '...)');
  } else {
    fail('Registration failed: ' + JSON.stringify(reg.body));
  }

  const pLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'patron@library.com', password: 'patron123' })
  });
  pLogin.ok ? pass('Existing patron login OK') : fail('Patron login: ' + JSON.stringify(pLogin.body));

  const suspLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'suspended@library.com', password: 'patron123' })
  });
  suspLogin.status === 403
    ? pass('Suspended account correctly blocked (403)')
    : fail('Suspended should be 403, got ' + suspLogin.status);

  // 3. Books Catalog
  section('3. Books Catalog');
  const books = await req('/books');
  if (books.ok && Array.isArray(books.body?.books) && books.body.books.length > 0) {
    bookId = books.body.books[0].id;
    pass('Catalog returned ' + books.body.books.length + ' books. First: "' + books.body.books[0].title + '"');
  } else {
    fail('Catalog fetch failed: ' + JSON.stringify(books.body));
  }

  if (bookId) {
    const detail = await req('/books/' + bookId);
    detail.ok
      ? pass('Book detail OK for "' + detail.body?.data?.title + '"')
      : fail('Book detail: ' + JSON.stringify(detail.body));
  }

  const dynamicIsbn = '978' + String(Date.now()).padStart(10, '0').slice(-10);
  const newBook = await req('/books', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({
      isbn: dynamicIsbn, title: 'Test Book Alpha', author: 'Test Author',
      publisher: 'Test Pub', publication_year: 2024, genre: ['Test'],
      total_copies: 3, available_copies: 3, language: 'English', pages: 100
    })
  });
  newBook.status === 201
    ? pass('Admin created new book OK')
    : fail('Book creation: ' + JSON.stringify(newBook.body));

  // 4. Borrowing Flow
  section('4. Borrowing Flow');
  const checkout = await req('/borrowings', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + patronToken },
    body: JSON.stringify({ book_id: bookId })
  });
  if (checkout.status === 201 && checkout.body?.data?.id) {
    borrowId = checkout.body.data.id;
    pass('Borrow OK (record: ' + borrowId.slice(0, 8) + '...)');
  } else {
    fail('Checkout failed: ' + JSON.stringify(checkout.body));
  }

  if (borrowId) {
    const dbl = await req('/borrowings', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + patronToken },
      body: JSON.stringify({ book_id: bookId })
    });
    dbl.status !== 201
      ? pass('Double-borrow correctly blocked')
      : fail('Double-borrow was NOT blocked!');

    const renew = await req('/borrowings/' + borrowId + '/renew', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + patronToken }
    });
    renew.ok ? pass('Renewal OK') : fail('Renewal: ' + JSON.stringify(renew.body));

    const ret = await req('/borrowings/' + borrowId + '/return', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ notes: 'API verify return.' })
    });
    ret.ok ? pass('Return OK') : fail('Return: ' + JSON.stringify(ret.body));
  }

  // 5. Reservations
  section('5. Reservations');
  const books2 = await req('/books');
  const oos = books2.body?.books?.find(b => b.available_copies === 0);
  if (oos) {
    const reserve = await req('/reservations', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + patronToken },
      body: JSON.stringify({ book_id: oos.id })
    });
    reserve.status === 201
      ? pass('Reserved out-of-stock book "' + oos.title + '"')
      : fail('Reserve: ' + JSON.stringify(reserve.body));
  } else {
    pass('No out-of-stock book (test skipped)');
  }

  // 6. Notifications
  section('6. Notifications');
  const notifs = await req('/notifications', { headers: { Authorization: 'Bearer ' + patronToken } });
  notifs.ok
    ? pass('Notifications returned ' + (notifs.body?.data?.length ?? 0) + ' items')
    : fail('Notifications: ' + JSON.stringify(notifs.body));

  // 7. Dashboard
  section('7. Dashboard Stats');
  const dash = await req('/dashboard/stats', { headers: { Authorization: 'Bearer ' + adminToken } });
  dash.ok
    ? pass('Dashboard stats OK')
    : fail('Dashboard: ' + JSON.stringify(dash.body));

  // 8. RBAC / Security
  section('8. Security / RBAC');
  const noAuth = await req('/books', { method: 'POST', body: JSON.stringify({ title: 'Hack' }) });
  noAuth.status === 401
    ? pass('Unauthenticated POST /books rejected (401)')
    : fail('Expected 401, got ' + noAuth.status);

  const patronHack = await req('/books', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + patronToken },
    body: JSON.stringify({ title: 'Hack' })
  });
  patronHack.status === 403
    ? pass('Patron POST /books rejected (403)')
    : fail('Expected 403, got ' + patronHack.status);

  // Summary
  console.log('\n================================================');
  if ((process.exitCode ?? 0) === 0) {
    console.log('  ALL CHECKS PASSED -- Backend API is healthy!');
  } else {
    console.log('  SOME CHECKS FAILED -- Review output above.');
  }
  console.log('================================================\n');
}

verify().catch(err => { console.error('Fatal error:', err.message); process.exit(1); });
