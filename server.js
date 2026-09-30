import express from "express";
import pool from "./src/db/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {authenticateToken, authenticateAdmin } from "./src/middleware/auth.js";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";


const app = express();
app.use(express.json());

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Danny E-commerce API",
      version: "1.0.0",
      description: "A learning/portfolio e-commerce REST API built with Express, Node.js, and PostgreSQL, following the project requirements of CodeCademy. This API allows users to register, log in, manage their profiles, browse products, manage their shopping cart, and place orders. Admin users can also manage products.",
    },
    servers: [
      { url: "http://localhost:3000" },
    ],
    components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
     },
    },
   },
  apis: ["./server.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


app.get("/", (req, res) => {
  res.send("Hello Armwrestling store");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database connection failed");
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING userid, username, email",
      [username, email, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Registration failed");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).send("Invalid username or password"); 
    }

    const user = result.rows[0];

    if (user.deleted_at) {
      return res.status(401).send("Invalid username or password"); 
    } 

    const passwordMatch = await bcrypt.compare(password, user.password); 
    
    if (!passwordMatch) {
      return res.status(401).send("Invalid username or password"); 
    }

    const token = jwt.sign({ userid: user.userid }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ userid: user.userid, username: user.username, email: user.email, token });
  } catch (err) {
    console.error(err);
    res.status(500).send("Login failed");
  }
});

app.get("/profile", authenticateToken, async (req,res) => {
  try {
    const result = await pool.query(
      "SELECT userid, username, email FROM users WHERE userid = $1",
      [req.user.userid]
    );
    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Profile retrieval failed");
  }
});

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve a list of all products in the store
 *     responses:
 *       200:
 *         description: A list of products
 */

app.get("/products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT productid, name, description, price, stock, type FROM products"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to retrieve products");
  }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [physical, service]
 *     responses:
 *       201:
 *         description: Product created successfully
 *       401:
 *         description: No token provided
 *       403:
 *         description: Not an admin
 */

app.post("/products", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, type } = req.body;

    const result = await pool.query(
      "INSERT INTO products (name, description, price, stock, type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, description, price, stock, type]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to create product");
  }
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     description: Retrieve one product's details using its product ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Product found
 *       404:
 *         description: Product not found
 */

app.get("/products/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT productid, name, description, price, stock, type FROM products WHERE productid = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Product not found");
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to retrieve product");
  }
});

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product by ID (admin only)
 *     description: Partially update a product's fields. Only send the fields you want to change.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [physical, service]
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       401:
 *         description: No token provided
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Product not found
 */

app.put("/products/:id", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, type } = req.body;

    const result = await pool.query(
      "UPDATE products SET name = COALESCE($1, name), description = COALESCE($2, description), price = COALESCE($3, price), stock = COALESCE($4, stock), type = COALESCE($5, type) WHERE productid = $6 RETURNING *",
      [name, description, price, stock, type, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Product not found");
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to update product");
  }
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Deletes a product (admin only)
 *     description: Permanently delete a product from the database.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Product not found
 */


app.delete("/products/:id", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM products WHERE productid = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Product not found");
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete product");
  }
});

/**
 * @swagger
 * /profile:
 *   put:
 *     summary: Updates the authenticated user's profile.
 *     description: Update your profile information. Only send the fields you want to change.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       404:
 *         description: User not found
 */


app.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { username, email, address, phone, password } = req.body;

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           address = COALESCE($3, address),
           phone = COALESCE($4, phone),
           password = COALESCE($5, password)
       WHERE userid = $6
       RETURNING userid, username, email, address, phone, role, created_at`,
      [username, email, address, phone, hashedPassword, req.user.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to update user");
  }
});

/**
 * @swagger
 * /profile:
 *   delete:
 *     summary: Deletes the authenticated user's account.
 *     description: Anonymizes and soft-deletes the authenticated user's own account.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       404:
 *         description: User not found
 */


app.delete("/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET username = 'deleted_user_' || userid,
           email = NULL,
           password = NULL,
           address = NULL,
           phone = NULL,
           deleted_at = NOW()
       WHERE userid = $1
       RETURNING userid`,
      [req.user.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found");
    }

    res.status(200).send("Account deleted successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete account");
  }
});

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get all products in a user's cart
 *     description: Retrieve a list of all products in the cart for the authenticated user. If the user does not have a cart, a new one will be created.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of products in the cart
 */

app.get("/cart", authenticateToken, async (req, res) => {
  try {
    let cartResult = await pool.query(
      "SELECT * FROM carts WHERE userid = $1",
      [req.user.userid]
    );

    if (cartResult.rows.length === 0) {
      cartResult = await pool.query(
        "INSERT INTO carts (userid) VALUES ($1) RETURNING *",
        [req.user.userid]
      );
    }

    const cart = cartResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT cart_items.cartitemid, cart_items.quantity,
              products.productid, products.name, products.price
       FROM cart_items
       JOIN products ON cart_items.productid = products.productid
       WHERE cart_items.cartid = $1`,
      [cart.cartid]
    );

    res.status(200).json({ cartid: cart.cartid, items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to retrieve cart");
  }
});

/**
 * @swagger
 * /cart:
 *   post:
 *     summary: Add an item to the user's cart
 *     description: Adds a product to the authenticated user's cart. If the product is already in the cart, its quantity is increased instead of creating a duplicate entry.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productid:
 *                 type: integer
 *                 description: The ID of the product to add
 *               quantity:
 *                 type: integer
 *                 description: How many of this product to add
 *     responses:
 *       201:
 *         description: Item added to cart successfully
 *       400:
 *         description: Not enough stock available
 *       401:
 *         description: No token provided
 *       404:
 *         description: Product not found
 */

app.post("/cart", authenticateToken, async (req, res) => {
  try {
    console.log("Received body:", req.body); // Log the request body for debugging
    const { productid, quantity } = req.body;
    
    let cartResult = await pool.query(
      "SELECT * FROM carts WHERE userid = $1",
      [req.user.userid]
    );

    if (cartResult.rows.length === 0) {
      cartResult = await pool.query(
        "INSERT INTO carts (userid) VALUES ($1) RETURNING *",
        [req.user.userid]
      );
    }

    const cart = cartResult.rows[0];

    const productResult = await pool.query(
      "SELECT * FROM products WHERE productid = $1",
      [productid]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).send("Product not found");
    }

    const product = productResult.rows[0];

    if (product.stock < quantity) {
      return res.status(400).send("Not enough stock available");
    }

   const existingItem = await pool.query(
      "SELECT * FROM cart_items WHERE cartid = $1 AND productid = $2",
      [cart.cartid, productid]
    );

    let itemResult;

    if (existingItem.rows.length > 0) {
      //THIS is for incrementing the quantity of an (already)  existing item in the cart
      itemResult = await pool.query(
        "UPDATE cart_items SET quantity = quantity + $1 WHERE cartitemid = $2 RETURNING *",
    [quantity, existingItem.rows[0].cartitemid]
      );
    } else {
      // THIS is for adding a new item to the cart that was not already there before
      itemResult = await pool.query(
        "INSERT INTO cart_items (cartid, productid, quantity) VALUES ($1, $2, $3) RETURNING *",
        [cart.cartid, productid, quantity]
      );
    }
    res.status(201).json(itemResult.rows[0]);
   
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to add item to cart");
  }
});

/**
 * @swagger
 * /cart/{itemId}:
 *   put:
 *     summary: Update the quantity of a specific item in the user's cart
 *     description: Update the quantity of a specific item in the authenticated user's cart. Returns 404 if the item doesn't exist or doesn't belong to the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the cart item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 description: The new quantity for the cart item
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       401:
 *         description: No token provided
 *       404:
 *         description: Cart item not found (or does not belong to the authenticated user)
 */

app.put("/cart/:itemId", authenticateToken, async (req, res) => {
  try {
    const { quantity } = req.body;

    const result = await pool.query(
      `UPDATE cart_items
       SET quantity = $1
       FROM carts
       WHERE cart_items.cartitemid = $2
         AND cart_items.cartid = carts.cartid
         AND carts.userid = $3
       RETURNING cart_items.*`,
      [quantity, req.params.itemId, req.user.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Cart item not found");
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to update cart item");
  }
});

/**
 * @swagger
 * /cart/{itemId}:
 *   delete:
 *     summary: Remove an item from the user's cart
 *     description: Deletes a specific item from the authenticated user's cart. Returns 404 if the item doesn't exist or doesn't belong to the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the cart item to remove
 *     responses:
 *       200:
 *         description: Cart item deleted successfully
 *       401:
 *         description: No token provided
 *       404:
 *         description: Cart item not found (or does not belong to the authenticated user)
 */

app.delete("/cart/:itemId", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM cart_items
       USING carts
       WHERE cart_items.cartitemid = $1
         AND cart_items.cartid = carts.cartid
         AND carts.userid = $2
       RETURNING cart_items.*`,
      [req.params.itemId, req.user.userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Cart item not found");
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete cart item");
  }
});

/**
 * @swagger
 * /checkout:
 *   post:
 *     summary: Checkout the user's cart and create an order
 *     description: Processes the authenticated user's cart, creates an order, and clears the cart. Returns 400 if the cart is empty or if there is not enough stock for any item.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: No cart found, cart is empty, or not enough stock for an item
 *       401:
 *         description: No token provided
 */

app.post("/checkout", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cartResult = await client.query(
      "SELECT * FROM carts WHERE userid = $1",
      [req.user.userid]
    );

    if (cartResult.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).send("No cart found");
    }

    const cart = cartResult.rows[0];

    const itemsResult = await client.query(
      `SELECT cart_items.cartitemid, cart_items.quantity,
              products.productid, products.name, products.price, products.stock
       FROM cart_items
       JOIN products ON cart_items.productid = products.productid
       WHERE cart_items.cartid = $1`,
      [cart.cartid]
    );

    if (itemsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).send("Cart is empty");
    }

    const items = itemsResult.rows;

    // First we check the inventory and then proceed to create the order, fetch the cart and its items, and reject if empty. Then we create the order, snapshot the items into order_items, decrement stock, and clear the cart.
    // Step 2 (orders, order_items, stock decrement, clearing cart) down below.

        // Create the order
    const orderResult = await client.query(
      "INSERT INTO orders (userid) VALUES ($1) RETURNING *",
      [req.user.userid]
    );

    const order = orderResult.rows[0];

    // Process each cart item
    for (const item of items) {
     if (item.stock <item.quantity) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).send(`Not enough stock for  ${item.name}`);
      }
      //snapshot into order_items
      await client.query(
        "INSERT INTO order_items (orderid, productid, quantity, price) VALUES ($1, $2, $3, $4)",
        [order.orderid, item.productid, item.quantity, item.price]
      );

      // Decrement stock
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE productid = $2",
        [item.quantity, item.productid]
      );
    }

    // Clear the cart (empty it, but keep the cart row itself)
    await client.query(
      "DELETE FROM cart_items WHERE cartid = $1",
      [cart.cartid]
    );

    await client.query("COMMIT");
    client.release();

    res.status(201).json({ orderid: order.orderid, status: order.status, items });
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    console.error(err);
    res.status(500).send("Checkout failed");
  }
});

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders for the authenticated user
 *     description: Gets a list of all orders placed by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of the authenticated user's orders.
 */

app.get("/orders", authenticateToken, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      "SELECT * FROM orders WHERE userid = $1",
      [req.user.userid]
    );

    res.status(200).json(ordersResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving orders");
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get details of a specific order
 *     description: Retrieve details of a specific order placed by the authenticated user. Returns 404 if the order doesn't exist or doesn't belong to the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The order ID
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *       401:
 *         description: No token provided
 *       404:
 *         description: Order not found (or does not belong to the authenticated user)
 */

app.get("/orders/:id", authenticateToken, async (req, res) => {
  try {
    const orderResult = await pool.query(
      "SELECT * FROM orders WHERE orderid = $1 AND userid = $2",
      [req.params.id, req.user.userid]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).send("Order not found");
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT order_items.orderitemid, order_items.quantity, order_items.price,
              products.productid, products.name
       FROM order_items
       JOIN products ON order_items.productid = products.productid
       WHERE order_items.orderid = $1`,
      [order.orderid]
    );

    res.status(200).json({ order, items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving order details");
  }
});
//note that we are selecting order_items.price, not products.price, because the price of the product may have changed since the order was placed, and we want to reflect the price at the time of purchase.

/**
 * @swagger
 * /orders/{id}/cancel:
 *   patch:
 *     summary: Cancel an order
 *     description: Cancel an order that has not yet been shipped. Restores stock for each item in the order and updates the order status to "cancelled".
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The order ID
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Cannot cancel an order that is already shipped or cancelled
 *       401:
 *         description: No token provided
 *       404:
 *         description: Order not found (or does not belong to the authenticated user)
 */

app.patch("/orders/:id/cancel", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      "SELECT * FROM orders WHERE orderid = $1 AND userid = $2",
      [req.params.id, req.user.userid]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).send("Order not found");
    }

    const order = orderResult.rows[0];

    if (order.status === "shipped" || order.status === "cancelled") {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).send(`Cannot cancel an order that is already ${order.status}`);
    }

    const itemsResult = await client.query(
      "SELECT productid, quantity FROM order_items WHERE orderid = $1",
      [order.orderid]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        "UPDATE products SET stock = stock + $1 WHERE productid = $2",
        [item.quantity, item.productid]
      );
    }

    const updateResult = await client.query(
      "UPDATE orders SET status = 'cancelled' WHERE orderid = $1 RETURNING *",
      [order.orderid]
    );

    await client.query("COMMIT");
    client.release();

    res.status(200).json(updateResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    console.error(err);
    res.status(500).send("Failed to cancel order");
  }
});


app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

