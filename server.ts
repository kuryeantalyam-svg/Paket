import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || "smartpack.db";

console.log('Sunucu başlatılıyor...');
console.log('Veritabanı yolu:', dbPath);
let db: any;
try {
  db = new Database(dbPath);
  console.log('Veritabanı bağlantısı başarılı.');
} catch (err) {
  console.error('Veritabanı bağlantı hatası:', err);
  process.exit(1);
}

process.on('uncaughtException', (err) => {
  console.error('Beklenmedik hata:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Beklenmedik reddedilme:', reason);
});

// Email Transporter Setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Firebase Admin Setup (New Method)
let firebaseAdminApp: any = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
  }
}

async function sendEmailToCouriers(order: any) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log("Email configuration missing. Skipping email notification.");
    return;
  }

  try {
    const couriers = db.prepare("SELECT email FROM users WHERE role = 'courier'").all() as { email: string }[];
    const emails = couriers.map(c => c.email);

    if (emails.length === 0) return;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Antalya Teslimat" <noreply@example.com>',
      to: emails.join(", "),
      subject: "Yeni Paket Talebi Mevcut!",
      text: `Yeni bir paket talebi oluşturuldu.\n\nAlım Adresi: ${order.pickup_address}\nTeslim Adresi: ${order.delivery_address}\nAraç Tipi: ${order.vehicle_type}\n\nLütfen uygulamaya girerek talebi kabul edin.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">Yeni Paket Talebi!</h2>
          <p>Sistemde yeni bir paket talebi oluşturuldu.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Alım Adresi:</strong> ${order.pickup_address}</p>
            <p><strong>Teslim Adresi:</strong> ${order.delivery_address}</p>
            <p><strong>Araç Tipi:</strong> ${order.vehicle_type}</p>
          </div>
          <p>Lütfen uygulamaya girerek talebi kabul edin.</p>
          <a href="${process.env.APP_URL || '#'}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Uygulamayı Aç</a>
        </div>
      `,
    });
    console.log(`Email notification sent to ${emails.length} couriers.`);
  } catch (error) {
    console.error("Error sending email notification:", error);
  }
}

async function sendPushNotificationToCouriers(order: any) {
  const fcmServerKey = process.env.FCM_SERVER_KEY;
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!fcmServerKey && !hasServiceAccount) {
    console.log("FCM configuration missing. Skipping push notification.");
    return;
  }

  try {
    const tokens = db.prepare("SELECT token FROM fcm_tokens WHERE user_id IN (SELECT id FROM users WHERE role = 'courier')").all() as { token: string }[];
    const tokenList = tokens.map(t => t.token);

    if (tokenList.length === 0) return;

    // Use Firebase Admin (New Method) if available
    if (firebaseAdminApp) {
      const message = {
        notification: {
          title: "Yeni Paket Talebi! 📦",
          body: `${order.pickup_address} -> ${order.delivery_address}`
        },
        data: {
          orderId: String(order.id),
          type: "new_order"
        },
        tokens: tokenList,
        android: {
          priority: "high" as const,
          notification: {
            sound: "default"
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`FCM V1 Result: ${response.successCount} success, ${response.failureCount} failure`);
      
      if (response.failureCount > 0) {
        const tokensToRemove: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error as any;
            console.error(`FCM Token ${idx} failure:`, error);
            
            // If token is invalid or not registered, mark for removal
            if (error?.code === 'messaging/registration-token-not-registered' || 
                error?.code === 'messaging/invalid-registration-token') {
              tokensToRemove.push(tokenList[idx]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          console.log(`Removing ${tokensToRemove.length} invalid FCM tokens from database.`);
          const placeholders = tokensToRemove.map(() => '?').join(',');
          db.prepare(`DELETE FROM fcm_tokens WHERE token IN (${placeholders})`).run(...tokensToRemove);
        }
      }
      return;
    }

    // Fallback to Legacy Method (Old Method)
    if (fcmServerKey) {
      const payload = {
        registration_ids: tokenList,
        notification: {
          title: "Yeni Paket Talebi! 📦",
          body: `${order.pickup_address} -> ${order.delivery_address}`,
          sound: "default"
        },
        data: {
          orderId: order.id,
          type: "new_order",
          click_action: "FLUTTER_NOTIFICATION_CLICK"
        },
        priority: "high",
        content_available: true
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log("FCM Legacy Result:", result);
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    customer_id TEXT,
    pickup_address TEXT,
    delivery_address TEXT,
    status TEXT DEFAULT 'pending',
    vehicle_type TEXT DEFAULT 'motorcycle',
    payment_method TEXT DEFAULT 'sender',
    package_type TEXT,
    special_request TEXT,
    courier_id TEXT,
    distance REAL,
    pickup_lat REAL,
    pickup_lng REAL,
    delivery_lat REAL,
    delivery_lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations
try {
  db.prepare("ALTER TABLE orders ADD COLUMN package_type TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN special_request TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE orders ADD COLUMN distance REAL").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE orders ADD COLUMN pickup_lat REAL").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN pickup_lng REAL").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN delivery_lat REAL").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN delivery_lng REAL").run();
} catch (e) {}

// Log table info for debugging
try {
  const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
  console.log("Orders table schema:", tableInfo);
} catch (e) {
  console.error("Error checking table info:", e);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    full_name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courier_locations (
    courier_id TEXT PRIMARY KEY,
    lat REAL,
    lng REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS fcm_tokens (
    user_id TEXT,
    token TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, token),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Log database status
try {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  console.log(`Database initialized. Current user count: ${userCount.count}`);
} catch (e) {
  console.log("Database initialized (first run).");
}

// Migration for existing orders table
try {
  db.prepare("ALTER TABLE orders ADD COLUMN vehicle_type TEXT DEFAULT 'motorcycle'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN customer_id TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN customer_phone TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'sender'").run();
} catch (e) {}

// Migration for existing users table
try {
  db.prepare("ALTER TABLE users ADD COLUMN full_name TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
} catch (e) {}

// Migration for saved_addresses (if needed)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
} catch (e) {}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = Number(process.env.PORT) || 3000;

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
  });

  app.use(express.json());

  // Health check endpoint for Render
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Saved Addresses API
  app.get("/api/saved-addresses/:userId", (req, res) => {
    const { userId } = req.params;
    try {
      const addresses = db.prepare("SELECT * FROM saved_addresses WHERE user_id = ? ORDER BY created_at DESC").all(userId);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ error: "Adresler yüklenirken bir hata oluştu" });
    }
  });

  app.post("/api/saved-addresses", (req, res) => {
    const { userId, title, address, lat, lng } = req.body;
    const id = Math.random().toString(36).substring(7);
    try {
      db.prepare("INSERT INTO saved_addresses (id, user_id, title, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, userId, title, address, lat, lng);
      res.json({ id, userId, title, address, lat, lng });
    } catch (error) {
      res.status(500).json({ error: "Adres kaydedilirken bir hata oluştu" });
    }
  });

  app.delete("/api/saved-addresses/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM saved_addresses WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Adres silinirken bir hata oluştu" });
    }
  });

  // WebSocket connection handling
  const clients = new Map<WebSocket, { courierId?: string, role?: string }>();

  wss.on("connection", (ws) => {
    clients.set(ws, {});

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "auth") {
          clients.set(ws, { courierId: data.courierId, role: data.role });
          return;
        }

        if (data.type === "location_update") {
          const { courierId, lat, lng } = data;
          db.prepare("INSERT OR REPLACE INTO courier_locations (courier_id, lat, lng, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")
            .run(courierId, lat, lng);
          
          // Get courier name for broadcast
          const courier = db.prepare("SELECT full_name FROM users WHERE id = ?").get(courierId) as { full_name: string } | undefined;
          
          // Broadcast location to all clients
          broadcast({
            type: "courier_location",
            courierId,
            courierName: courier?.full_name || courierId,
            lat,
            lng,
            updated_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    });

    ws.on("close", () => {
      const info = clients.get(ws);
      if (info?.role === 'courier' && info.courierId) {
        broadcast({
          type: "courier_offline",
          courierId: info.courierId
        });
      }
      clients.delete(ws);
    });
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((_, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // API Routes
  const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const password = req.headers['x-admin-password'];
    const expectedPassword = process.env.ADMIN_PASSWORD || '5807';
    if (password === expectedPassword) {
      next();
    } else {
      res.status(403).json({ error: "Unauthorized admin access" });
    }
  };

  app.post("/api/auth/register", (req, res) => {
    const { email, password, role, fullName, phone } = req.body;
    const id = Math.random().toString(36).substring(7);
    try {
      db.prepare("INSERT INTO users (id, email, password, role, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, email, password, role, fullName, phone);
      res.json({ id, email, role, fullName, phone });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      res.json({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        fullName: user.full_name,
        phone: user.phone
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/admin/debug-fcm", adminAuth, (req, res) => {
    try {
      const tokenCount = db.prepare("SELECT COUNT(*) as count FROM fcm_tokens").get() as { count: number };
      const courierTokenCount = db.prepare("SELECT COUNT(*) as count FROM fcm_tokens WHERE user_id IN (SELECT id FROM users WHERE role = 'courier')").get() as { count: number };
      const hasKey = !!process.env.FCM_SERVER_KEY;
      
      res.json({
        tokenCount: tokenCount.count,
        courierTokenCount: courierTokenCount.count,
        hasFcmServerKey: hasKey,
        fcmKeyLength: process.env.FCM_SERVER_KEY?.length || 0,
        googleServicesJsonExists: fs.existsSync(path.join(__dirname, 'android/app/google-services.json'))
      });
    } catch (error) {
      res.status(500).json({ error: "Debug failed", details: String(error) });
    }
  });

  app.post("/api/auth/fcm-token", (req, res) => {
    const { userId, token } = req.body;
    console.log(`FCM token registration request: userId=${userId}, token=${token?.substring(0, 10)}...`);
    if (!userId || !token) return res.status(400).json({ error: "Missing data" });
    try {
      db.prepare("INSERT OR REPLACE INTO fcm_tokens (user_id, token, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .run(userId, token);
      console.log(`FCM token saved for user ${userId}`);
      res.json({ success: true });
    } catch (error) {
      console.error(`FCM token save failed for user ${userId}:`, error);
      res.status(500).json({ error: "Token save failed" });
    }
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    
    if (user) {
      console.log(`Password reset email sent to: ${email}`);
      // In a real app, you would send an actual email here.
      res.json({ message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi." });
    } else {
      res.status(404).json({ error: "Bu e-posta adresi ile kayıtlı bir kullanıcı bulunamadı." });
    }
  });

  function getPrice(type: string, pkgType: string, dist: number) {
    if (type === 'motorcycle') {
      const cheapTypes = ['Dosya / Evrak', 'Yemek / Gıda', 'Küçük Paket', 'Tıbbi Malzeme'];
      let base = cheapTypes.includes(pkgType) ? 100 : 120;
      if (dist > 8) base *= 1.2;
      return Math.round(base);
    } else if (type === 'car') {
      let base = 300;
      if (dist > 5) {
        base += (dist - 5) * 10;
      }
      return Math.round(base);
    } else if (type === 'van') {
      let base = 500;
      if (dist > 5) {
        base += (dist - 5) * 10;
      }
      return Math.round(base);
    }
    return 0;
  }

  app.get("/api/courier/earnings/:courierId", (req, res) => {
    const { courierId } = req.params;
    try {
      const completedOrders = db.prepare("SELECT * FROM orders WHERE courier_id = ? AND status = 'delivered' ORDER BY created_at DESC").all(courierId) as any[];
      
      const earnings = completedOrders.map(order => {
        const price = getPrice(order.vehicle_type, order.package_type || 'Diğer', order.distance || 0);
        return {
          id: order.id,
          customerName: order.customer_name,
          date: order.created_at,
          amount: price,
          pickup: order.pickup_address,
          delivery: order.delivery_address,
          distance: order.distance
        };
      });

      const totalEarnings = earnings.reduce((sum, item) => sum + item.amount, 0);

      res.json({
        totalEarnings,
        deliveriesCount: earnings.length,
        breakdown: earnings
      });
    } catch (error) {
      console.error("Error fetching courier earnings:", error);
      res.status(500).json({ error: "Kazanç bilgileri alınırken bir hata oluştu" });
    }
  });

  app.get("/api/admin/users", adminAuth, (req, res) => {
    const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    res.json(users);
  });

  app.get("/api/admin/stats", adminAuth, (req, res) => {
    const onlineCouriers = Array.from(clients.values())
      .filter(c => c.role === 'courier').length;
    res.json({ onlineCouriers });
  });

  app.post("/api/admin/notify", adminAuth, (req, res) => {
    const { message, targetRole } = req.body;
    const payload = JSON.stringify({
      type: 'notification',
      message,
      timestamp: new Date().toISOString()
    });

    clients.forEach((clientInfo, ws) => {
      if (!targetRole || clientInfo.role === targetRole) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    });
    res.json({ success: true });
  });

  app.post("/api/orders", (req, res) => {
    try {
      const { 
        customerName, customerPhone, customerId, 
        pickupAddress, deliveryAddress, vehicleType, 
        paymentMethod, packageType, specialRequest, distance,
        pickup_lat, pickup_lng, delivery_lat, delivery_lng
      } = req.body;
      const id = Math.random().toString(36).substring(7);
      
      console.log("New order request received:", req.body);

      db.prepare(`
        INSERT INTO orders (
          id, customer_name, customer_phone, customer_id, 
          pickup_address, delivery_address, vehicle_type, 
          payment_method, package_type, special_request, distance,
          pickup_lat, pickup_lng, delivery_lat, delivery_lng
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, customerName, customerPhone, customerId, 
        pickupAddress, deliveryAddress, vehicleType || 'motorcycle', 
        paymentMethod || 'sender', packageType, specialRequest, distance,
        pickup_lat, pickup_lng, delivery_lat, delivery_lng
      );
      
      const order = { 
        id, 
        customer_name: customerName, 
        customer_phone: customerPhone,
        customer_id: customerId, 
        pickup_address: pickupAddress, 
        delivery_address: deliveryAddress, 
        status: 'pending', 
        vehicle_type: vehicleType || 'motorcycle', 
        payment_method: paymentMethod || 'sender',
        package_type: packageType,
        special_request: specialRequest,
        distance: distance,
        pickup_lat,
        pickup_lng,
        delivery_lat,
        delivery_lng,
        created_at: new Date().toISOString() 
      };
      
      // Send email notifications to couriers
      sendEmailToCouriers(order);
      
      // Send Push Notification to Couriers
      sendPushNotificationToCouriers(order);

      broadcast({
        type: "new_order",
        order
      });

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Sipariş oluşturulurken bir hata oluştu" });
    }
  });

  app.get("/api/orders", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    res.json(orders);
  });

  app.get("/api/courier-location/:courierId", (req, res) => {
    const { courierId } = req.params;
    const location = db.prepare("SELECT courier_id as courierId, lat, lng, updated_at FROM courier_locations WHERE courier_id = ?").get(courierId);
    res.json(location || null);
  });

  app.get("/api/couriers", (req, res) => {
    const onlineCourierIds = Array.from(clients.values())
      .filter(c => c.role === 'courier' && c.courierId)
      .map(c => c.courierId);
    
    if (onlineCourierIds.length === 0) {
      return res.json([]);
    }

    const placeholders = onlineCourierIds.map(() => '?').join(',');
    const couriers = db.prepare(`
      SELECT 
        cl.courier_id as courierId, 
        u.full_name as courierName,
        cl.lat, 
        cl.lng, 
        cl.updated_at 
      FROM courier_locations cl
      LEFT JOIN users u ON cl.courier_id = u.id
      WHERE cl.courier_id IN (${placeholders})
    `).all(...onlineCourierIds);
    res.json(couriers);
  });

  app.get("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const user = db.prepare("SELECT id, email, role, full_name, phone FROM users WHERE id = ?").get(id);
    res.json(user || null);
  });

  app.patch("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const { status, courierId } = req.body;
    
    try {
      const result = db.prepare("UPDATE orders SET status = ?, courier_id = ? WHERE id = ?")
        .run(status, courierId, id);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: "Sipariş bulunamadı" });
      }

      if (status === 'pending') {
        const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
        broadcast({
          type: "new_order",
          order
        });
      } else {
        broadcast({
          type: "order_updated",
          orderId: id,
          status,
          courierId
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Order update error:", error);
      res.status(500).json({ error: "Sipariş güncellenirken bir hata oluştu" });
    }
  });

  // Vite middleware for development or if dist is missing
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.join(__dirname, "dist");

  if (!isProd || !fs.existsSync(distPath)) {
    console.log("Using Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Explicit SPA fallback for Vite middleware
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith("/api")) return next();

      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    console.log("Serving static files from dist...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
