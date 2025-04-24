const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const dbConnected = require('./dbConfig');
const userModel = require('./userDetails'); // Fixed spelling issue from "modles" to "models"

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