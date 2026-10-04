const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const STORE_PATH = path.join(__dirname, 'mock_store.json');

const defaultData = {
  profiles: [],
  books: [],
  borrowings: [],
  reservations: [],
  categories: [],
  reviews: [],
  notifications: [],
  activity_logs: []
};

// Seed helper
function seedData(store) {
  // Passwords will be hashed here
  const salt = bcrypt.genSaltSync(10);
  const adminId = "7a1bfe12-70b1-43e3-962c-f3c0115df1a0";
  const librarianId = "1a8bfe12-70b1-43e3-962c-f3c0115df1b0";
  const patronId = "9a2bfe12-70b1-43e3-962c-f3c0115df1c0";
  const suspendedPatronId = "ef5bfe12-70b1-43e3-962c-f3c0115df1d0";

  // Auth/Profiles seeds
  store.profiles = [
    {
      id: adminId,
      full_name: "System Admin",
      email: "admin@library.com",
      password_hash: bcrypt.hashSync("admin123", salt),
      role: "admin",
      phone: "+2348011223344",
      address: "12 Library Way, Lagos",
      membership_date: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      status: "active",
      avatar_url: "https://api.dicebear.com/7.x/adventurer/svg?seed=admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: librarianId,
      full_name: "Librarian Chief",
      email: "librarian@library.com",
      password_hash: bcrypt.hashSync("lib123", salt),
      role: "librarian",
      phone: "+2348022334455",
      address: "15 Library Road, Abuja",
      membership_date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
      status: "active",
      avatar_url: "https://api.dicebear.com/7.x/adventurer/svg?seed=librarian",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: patronId,
      full_name: "John Patron",
      email: "patron@library.com",
      password_hash: bcrypt.hashSync("patron123", salt),
      role: "patron",
      phone: "+2348033445566",
      address: "3 Patron Avenue, Yenagoa",
      membership_date: new Date().toISOString(),
      status: "active",
      avatar_url: "https://api.dicebear.com/7.x/adventurer/svg?seed=john",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: suspendedPatronId,
      full_name: "Suspended User",
      email: "suspended@library.com",
      password_hash: bcrypt.hashSync("patron123", salt),
      role: "patron",
      phone: "+2348044556677",
      address: "Block B, Gbagada, Lagos",
      membership_date: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
      status: "suspended",
      avatar_url: "https://api.dicebear.com/7.x/adventurer/svg?seed=suspended",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Categories seeds
  store.categories = [
    { id: "cat-1", name: "Fiction", description: "Narrative literature" },
    { id: "cat-2", name: "Science & Technology", description: "Coding, computer science, maths, engineering" },
    { id: "cat-3", name: "History", description: "Historical literature and chronicles" },
    { id: "cat-4", name: "Self-Improvement", description: "Personal development and growth" }
  ];

  // Books seeds
  store.books = [
    {
      id: "b1c2fe12-70b1-43e3-962c-f3c0115df201",
      isbn: "9780132350884",
      title: "Clean Code",
      author: "Robert C. Martin",
      publisher: "Prentice Hall",
      publication_year: 2008,
      genre: ["Science & Technology", "Coding"],
      description: "A handbook of agile software craftsmanship that teaches you how to write readable, reusable, and refactorable code.",
      cover_image_url: "https://images-na.ssl-images-amazon.com/images/I/41xShCOr8sL._SX379_BO1,204,203,200_.jpg",
      digital_copy_url: "/uploads/clean_code.pdf",
      total_copies: 5,
      available_copies: 4,
      shelf_location: "Aisle A, Shelf 3",
      language: "English",
      pages: 464,
      status: "available",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "b1c2fe12-70b1-43e3-962c-f3c0115df202",
      isbn: "9780134494166",
      title: "Design Patterns",
      author: "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
      publisher: "Addison-Wesley",
      publication_year: 1994,
      genre: ["Science & Technology", "Software Design"],
      description: "Captures 23 classic design patterns in object-oriented software development.",
      cover_image_url: "https://images-na.ssl-images-amazon.com/images/I/51szD9HC9pL._SX395_BO1,204,203,200_.jpg",
      digital_copy_url: null,
      total_copies: 2,
      available_copies: 2,
      shelf_location: "Aisle A, Shelf 4",
      language: "English",
      pages: 395,
      status: "available",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "b1c2fe12-70b1-43e3-962c-f3c0115df203",
      isbn: "9780596007126",
      title: "Head First Design Patterns",
      author: "Eric Freeman, Elisabeth Robson",
      publisher: "O'Reilly Media",
      publication_year: 2004,
      genre: ["Science & Technology", "Coding"],
      description: "A brain-friendly guide to design patterns in software design.",
      cover_image_url: "https://images-na.ssl-images-amazon.com/images/I/61AP8xIAg6L._SX430_BO1,204,203,200_.jpg",
      digital_copy_url: "",
      total_copies: 1,
      available_copies: 0, // Out of stock to test Reservations!
      shelf_location: "Aisle B, Shelf 1",
      language: "English",
      pages: 694,
      status: "borrowed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "b1c2fe12-70b1-43e3-962c-f3c0115df204",
      isbn: "9780201633610",
      title: "Design Patterns: Elements of Reusable Object-Oriented Software",
      author: "GoF",
      publisher: "Addison-Wesley Professional",
      publication_year: 1994,
      genre: ["Science & Technology"],
      description: "Classics book on design patterns.",
      cover_image_url: "https://images-na.ssl-images-amazon.com/images/I/51szD9HC9pL._SX395_BO1,204,203,200_.jpg",
      digital_copy_url: "",
      total_copies: 3,
      available_copies: 3,
      shelf_location: "Aisle A, Shelf 2",
      language: "English",
      pages: 395,
      status: "available",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Sub borrowings seed
  store.borrowings = [
    {
      id: "w3bfe12-70b1-43e3-962c-f3c0115df301",
      book_id: "b1c2fe12-70b1-43e3-962c-f3c0115df201",
      patron_id: patronId,
      borrow_date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), // 10 days ago, fine in 4 days
      due_date: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
      return_date: null,
      status: "active",
      renewal_count: 0,
      fine_amount: 0.00,
      notes: "First time borrow",
      created_at: new Date().toISOString()
    },
    {
      id: "w3bfe12-70b1-43e3-962c-f3c0115df302",
      book_id: "b1c2fe12-70b1-43e3-962c-f3c0115df203", // out of stock book
      patron_id: suspendedPatronId,
      borrow_date: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(), // 20 days ago, due 6 days ago (14d limit)
      due_date: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
      return_date: null,
      status: "overdue",
      renewal_count: 0,
      fine_amount: 300.00, // 6 days * 50
      notes: "Needs return immediately",
      created_at: new Date().toISOString()
    }
  ];

  // Reservations seeds
  store.reservations = [
    {
      id: "r1bfe12-70b1-43e3-962c-f3c0115df401",
      book_id: "b1c2fe12-70b1-43e3-962c-f3c0115df203",
      patron_id: patronId,
      reservation_date: new Date().toISOString(),
      expiry_date: null,
      status: "pending",
      notification_sent: false,
      created_at: new Date().toISOString()
    }
  ];

  // Reviews seeds
  store.reviews = [
    {
      id: "v1bfe12-70b1-43e3-962c-f3c0115df501",
      book_id: "b1c2fe12-70b1-43e3-962c-f3c0115df201",
      patron_id: patronId,
      rating: 5,
      comment: "Absolutely outstanding structure. Groundbreaking rules for code layout.",
      created_at: new Date().toISOString()
    }
  ];

  // Notifications seeds
  store.notifications = [
    {
      id: "n1bfe12-70b1-43e3-962c-f3c0115df601",
      user_id: patronId,
      type: "system",
      title: "Welcome aboard",
      message: "Welcome to the Digital Library! You can search and borrow up to 5 books.",
      is_read: false,
      created_at: new Date().toISOString()
    }
  ];

  // Activity logs
  store.activity_logs = [
    {
      id: "a1c2fe12-70b1-43e3-962c-f3c0115df701",
      user_id: adminId,
      action: "system_init",
      entity_type: "system",
      entity_id: null,
      details: { message: "Mock databases seeded and running." },
      created_at: new Date().toISOString()
    }
  ];
}

class MockDatabase {
  constructor() {
    this.data = { ...defaultData };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const fileContent = fs.readFileSync(STORE_PATH, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        seedData(this.data);
        this.save();
      }
    } catch (err) {
      console.error("Failed to load mock database store:", err);
      this.data = { ...defaultData };
      seedData(this.data);
    }
  }

  save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error("Failed to persist mock database store:", err);
    }
  }

  // Activity Log helper
  logActivity(userId, action, entityType, entityId, details = null) {
    const log = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString()
    };
    this.data.activity_logs.unshift(log);
    this.save();
  }

  // Notification helper
  notify(userId, type, title, message) {
    const notification = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      user_id: userId,
      type,
      title,
      message,
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.data.notifications.unshift(notification);
    this.save();
  }
}

const db = new MockDatabase();
module.exports = db;
