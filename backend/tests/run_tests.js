/**
 * NeoLibrary End-to-End Integration and Business Rules Test Runner
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_PORT = process.env.PORT || 3000;
let serverProcess = null;

// Helper to make API requests with JSON parsing
async function request(endpoint, options = {}) {
  const url = `http://localhost:${TEST_PORT}/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'close',
      ...options.headers
    }
  });
  
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch(e) {}
  
  return {
    status: response.status,
    ok: response.ok,
    body: json || text
  };
}

async function runTests() {
  console.log("====================================================");
  console.log("🚦 Starting neoLibrary System Integration Tests...");
  console.log("====================================================");

  let patronToken = '';
  let patronId = '';
  let adminToken = '';
  let testBookId = '';
  let borrowRecordId = '';

  try {
    // 1. Health Check
    console.log("🏥 Testing health route...");
    const health = await request('/auth/login', {
       method: 'POST',
       body: JSON.stringify({ email: 'admin@library.com', password: 'admin123' }) // Seeded admin
    });
    
    if (health.status !== 200) {
       throw new Error("Unable to log in as seeded administrator. Confirm environment is loaded.");
    }
    adminToken = health.body.data.token;
    console.log("✅ Seeded Admin Login succeeded.");

    // 2. Register a new Patron
    console.log("👤 Registering new patron profile...");
    const patronEmail = `test_patron_${Date.now()}@test.com`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: patronEmail,
        password: 'securePassword123',
        full_name: 'Test Patron User',
        phone: '08012345678',
        address: '10 University Road, Lagos'
      })
    });

    if (regRes.status !== 201) {
      throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);
    }
    patronToken = regRes.body.data.token;
    patronId = regRes.body.data.user.id;
    console.log("✅ Patron registered.");

    // 3. Fetch books
    console.log("📚 Fetching catalog list...");
    const catalog = await request('/books');
    if (!catalog.ok || catalog.body.books.length === 0) {
      throw new Error("Catalog returned empty list.");
    }
    testBookId = catalog.body.books[0].id;
    console.log(`✅ Loaded catalog. Selected book: "${catalog.body.books[0].title}" (ID: ${testBookId})`);

    // 4. Try to checkout book
    console.log("📖 Borrowing book...");
    const checkout = await request('/borrowings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${patronToken}` },
      body: JSON.stringify({ book_id: testBookId })
    });

    if (checkout.status !== 201) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkout.body)}`);
    }
    borrowRecordId = checkout.body.data.id;
    console.log("✅ Checkout succeeded.");

    // 5. Try to double borrow the same book (should fail business rule)
    console.log("📖 Attempting double borrow of same book...");
    const doubleCheckout = await request('/borrowings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${patronToken}` },
      body: JSON.stringify({ book_id: testBookId })
    });

    if (doubleCheckout.status === 201) {
      throw new Error("Business rule violation: Allowed checkout on same book twice.");
    }
    console.log("✅ Double checkout rejected (Business rule enforced successfully).");

    // 6. Test Renewal
    console.log("🔄 Renewing borrow record...");
    const renewal = await request(`/borrowings/${borrowRecordId}/renew`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${patronToken}` }
    });

    if (renewal.status !== 200) {
      throw new Error(`Renewal failed: ${JSON.stringify(renewal.body)}`);
    }
    console.log("✅ Renewal succeeded.");

    // 7. Test Return logic
    console.log("📦 Returning book (Admin execution)...");
    const retLog = await request(`/borrowings/${borrowRecordId}/return`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ notes: "Returned in pristine condition." })
    });

    if (retLog.status !== 200) {
      throw new Error(`Return failed: ${JSON.stringify(retLog.body)}`);
    }
    console.log("✅ Return succeeded.");

    console.log("\n====================================================");
    console.log("🎉 ALL STRATEGIC INTEGRATION TESTS PASSED!");
    console.log("====================================================");
    if (serverProcess) serverProcess.kill();
    process.exitCode = 0;
    setTimeout(() => process.exit(0), 200);

  } catch (err) {
    console.error("\n❌ TEST FAILURE:");
    console.error(err.message || err);
    if (serverProcess) serverProcess.kill();
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 200);
  }
}

function startServerAndTest() {
  console.log("Starting backend server in target test mode...");
  const serverPath = path.join(__dirname, '..', 'server.js');
  
  serverProcess = spawn('node', [serverPath], {
    env: { 
      ...process.env, 
      PORT: TEST_PORT, 
      MOCK_MODE: 'true',
      SERVE_STATIC: 'false'
    },
    stdio: 'ignore'
  });

  // Wait 1.5s for server to start, then execute tests
  setTimeout(() => {
    runTests();
  }, 1500);

  serverProcess.on('close', (code) => {
    console.log(`Server closed with exit status: ${code}`);
  });
}

startServerAndTest();

