const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const dbConnected = require('./dbConfig');
const userModel = require('./userDetails'); // Fixed spelling issue from "modles" to "models"
const AddToyScheema = require('./toyAddProductScheema');
const userCart = require('./cartSchema');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // for parsing application/json

// Basic route
app.get('/', (req, res) => {
  res.send('API is running...');
});


app.post('/register', async (req, res) => {
    try {
        const { name, email, password, address, mobileNumber } = req.body;

        // Check if the user already exists
        const isUserAlready = await userModel.findOne({ $or: [{ email }, { phone: mobileNumber }] });
        if (isUserAlready) {
            return res.status(400).json({
                message: isUserAlready.email === email
                    ? "Email already registered"
                    : "Phone number already registered"
            });
        }
        // Use bcrypt for secure password hashing instead of Cryptr
        // const saltRounds = 10;
        // const hashedPassword = await bcrypt.hash(password, saltRounds);

        const userDetails = {
            name,
            email,
            // password: hashedPassword,
            password,
            role: "Customer",
            address: address,
            phone: mobileNumber
        };

        const addNewUser = new userModel(userDetails);
        await addNewUser.save(); // Ensuring user is saved before redirecting

        res.status(200).json({ message: "User Created Successfully" });
    } catch (error) {
        console.error('Error registering new user:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
app.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        // console.log("Login request received:", identifier);

        const isPhone = !isNaN(identifier); // check if numeric
        const findUser = await userModel.findOne(
            isPhone
                ? { phone: Number(identifier) }
                : { email: identifier }
        );

        if (!findUser) {
            return res.status(400).json({ message: "User not found" });
        }

        if (findUser.VisibilityStatus === 'Pending') {
            return res.status(403).json({ message: "Your account is pending approval by admin." });
        }

        if (findUser.VisibilityStatus === 'Rejected') {
            return res.status(403).json({ message: "Your account was rejected by admin." });
        }
    
        if (password !== findUser.password) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        res.cookie('email', findUser.email, { httpOnly: true });
        res.cookie('role', findUser.role, { httpOnly: true });
        res.cookie('Category', findUser.category, { httpOnly: true });

        return res.status(200).json({ data:findUser,message: "Login successful" }); // ✅ for frontend handling

    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.post('/updateUser/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, password } = req.body;
        console.log("Update request received for user ID:", id);
        console.log(name, email, address, phone, password);
        const updateUser = await userModel.findByIdAndUpdate(id, {
            name,
            phone,
            email,
            address,
            password,
        }, { new: true });

        if (!updateUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // console.log("User updated:", updateUser);
        res.status(201).json({ message: "User update sucessfully", data: updateUser }); // ✅ Returns detailed error message

    } catch (error) {
        console.error("Error updating user:", error); // ✅ Logs actual error
        res.status(500).json({ message: "User not updated", error: error.message }); // ✅ Returns detailed error message
    }
});

app.get('/category', async (req, res) => {
    try {
        const allCategories = await AddToyScheema.distinct("Category");
        res.status(200).json({ data: allCategories, message: "Categories fetched successfully" });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).send("Internal Server Error");
    }
}
);

app.get('/products', async (req, res) => {
    try {
       
        const getAllToys = await AddToyScheema.find()
            
            res.status(200).json({ data: getAllToys, message: "Toys fetched successfully" });
        
    } 
    catch (error) {
        console.error("Error fetching toys:", error);
        res.status(500).send("Internal Server Error");
    }
    // res.render('index');
});

app.post('/add-to-cart', async (req, res) => {
    try {
      const { product, userId } = req.body;
      const quantityToAdd = parseInt(product.quantity) || parseInt(product.MinimumOrderQuantity) || 1;
  
      let cartItem = await userCart.findOne({ userId, productId: product._id });
      // console.log("Product received:", product);
  
      if (cartItem) {
        cartItem.quantity = quantityToAdd;
        await cartItem.save();
      } else {
        cartItem = new userCart({
          userId,
          productId: product._id,
          quantity: quantityToAdd,
          createdAt: new Date(),
        });
        await cartItem.save();
      }
  
      res.status(200).json({
        message: 'Item added to cart!',
        item: cartItem, // ✅ Return the updated or new cart item
      });
    } catch (err) {
      console.error('Error adding to cart:', err);
      res.status(500).json({ message: 'Failed to add item to cart' });
    }
  });
  
  

  app.post('/remove-from-cart', async (req, res) => {
    const { productId, userId } = req.body;
  
    if (!productId || !userId) {
      return res.status(400).json({ message: 'Missing productId or userId' });
    }
  
    try {
      const item = await userCart.findOne({ userId, productId });
      if (!item) {
        return res.status(404).json({ message: 'Item not found in cart' });
      }
  
      const product = await AddToyScheema.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      const qtyToRemove = parseInt(product.MinimumOrderQuantity) || 1;
      item.quantity -= qtyToRemove;
  
      if (item.quantity <= 0) {
        await userCart.deleteOne({ _id: item._id });
        return res.status(200).json({ message: 'Item removed from cart completely' });
      } else {
        await item.save();
        return res.status(200).json({
          message: 'Item quantity reduced',
          item: item, // Optional: return updated item
        });
      }
    } catch (err) {
      console.error('Error removing from cart:', err);
      res.status(500).json({ message: 'Failed to remove item from cart' });
    }
  });
  
  
  
  app.post('/details', async (req, res) => {
    try {
      const { itemIds } = req.body;
  
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: 'No item IDs provided' });
      }
  
      // Fetch product details from DB using the IDs
      const products = await AddToyScheema.find({ _id: { $in: itemIds } });
      console.log(products)
      // Return full product data
      return res.json(products);
    } catch (error) {
      console.error('Error in /cart/details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/cart', async (req, res) => {
    try {
      const { userId } = req.query; // ✅ should be from query
      const cart = await userCart.find({ userId });
        
      if (!cart || cart.length === 0) {
        return res.status(200).json([]); // ✅ return empty array
      }
      res.status(200).json(cart); // ✅ return full cart
    } catch (err) {
      console.error("Error fetching cart:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  app.post('/remove-from-cart', async (req, res) => {
    const { productId, userId } = req.body;
  
    if (!productId || !userId) {
      return res.status(400).json({ message: 'Missing productId or userId' });
    }
  
    try {
      // Find the cart item for the given userId and productId
      const item = await userCart.findOne({ userId, productId });
      if (!item) {
        return res.status(404).json({ message: 'Item not found in cart' });
      }
  
      // Delete the item from the cart
      await userCart.deleteOne({ _id: item._id });
      
      return res.status(200).json({ message: 'Item removed from cart completely' });
    } catch (err) {
      console.error('Error removing from cart:', err);
      res.status(500).json({ message: 'Failed to remove item from cart' });
    }
  });
  

// Start the server
dbConnected()
    .then(() => {
        app.listen(3000, () => {
            console.log(`Server is running on port 3000`);
        });
    })
    .catch((err) => {
        console.error('Database connection failed:', err);
    });