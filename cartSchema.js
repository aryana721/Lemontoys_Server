const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserDetails', // reference your actual User model name
        required: true,
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // assuming you'll reference a Product model
        required: true,
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
